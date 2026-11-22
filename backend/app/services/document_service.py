import hashlib
import io
import uuid
import zipfile
from pathlib import Path
from typing import BinaryIO, Callable

from app.core.config import get_settings
from app.core.errors import BadRequest, Conflict, NotFound, PayloadTooLarge, UnsupportedMedia
from app.repositories import chunk_repository, document_repository
from app.schemas.common import make_page
from app.schemas.document import ChunkOut, DocumentOut, DocumentUpdate
from app.services import audit_service
from app.services.access import level_to_int, level_to_name
from app.services.rag.ingestion import index_document

MIME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


PDF_MAGIC = b"%PDF-"
# Marcador interno que identifica cada formato OOXML (un ZIP cualquiera no basta)
ZIP_MARKERS = {".docx": "word/document.xml", ".xlsx": "xl/workbook.xml"}
MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024  # suma de lo descomprimido en un DOCX/XLSX
MAX_COMPRESSION_RATIO = 100  # file_size / compress_size por entrada


def _validate_content(ext: str, content: bytes) -> None:
    """Comprueba el tipo real (no solo la extensión) y rechaza bombas de descompresión, antes de guardar."""
    mismatch = UnsupportedMedia(f"El contenido no corresponde a un archivo {ext[1:].upper()} válido.", "tipo_no_coincide")
    if ext == ".pdf":
        if not content.startswith(PDF_MAGIC):
            raise mismatch
        return
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise mismatch
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            infos = zf.infolist()
    except zipfile.BadZipFile:
        raise mismatch from None
    if ZIP_MARKERS[ext] not in {i.filename for i in infos}:
        raise mismatch
    # shortcut: usa los tamaños declarados en el ZIP (falsificables); al extraer, leer con límite de bytes.
    if (sum(i.file_size for i in infos) > MAX_UNCOMPRESSED_BYTES
            or any(i.compress_size > 0 and i.file_size / i.compress_size > MAX_COMPRESSION_RATIO for i in infos)):
        raise UnsupportedMedia("El archivo tiene una estructura sospechosa y fue rechazado.", "archivo_sospechoso")


def format_size(size_bytes: int) -> str:
    if size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    if size_bytes >= 1024:
        return f"{round(size_bytes / 1024)} KB"
    return f"{size_bytes} B"


def to_document_out(row: dict) -> DocumentOut:
    return DocumentOut(
        id=row["id"], name=row["original_name"], size=format_size(row["size_bytes"]),
        size_bytes=row["size_bytes"], uploaded_at=row["created_at"], status=row["status"],
        access_level=level_to_name(row["access_level"]), department=row["department"],
        page_count=row["page_count"], chunk_count=row["chunk_count"], error_message=row["error_message"],
    )


def _is_admin(user: dict) -> bool:
    return user["role"] == "admin"


def _get_row(user: dict, document_id: str) -> dict:
    """Admin gestiona todos los documentos; el empleado solo los que la regla de acceso le permite."""
    if _is_admin(user):
        row = document_repository.get_by_id(document_id)
    else:
        row = document_repository.get_visible(document_id, user["access_level"], user["department"])
    if row is None:
        raise NotFound("El documento no existe.", "documento_no_encontrado")
    return row


def list_documents(user: dict, pagina: int, tamano: int, estado: str | None, nivel: str | None,
                   q: str | None) -> dict:
    viewer = None if _is_admin(user) else (user["access_level"], user["department"])
    rows, total = document_repository.list_documents(
        viewer=viewer, status=estado, level=level_to_int(nivel) if nivel else None,
        q=q, limit=tamano, offset=(pagina - 1) * tamano,
    )
    return make_page([to_document_out(r) for r in rows], total, pagina, tamano)


def get_document(user: dict, document_id: str) -> DocumentOut:
    return to_document_out(_get_row(user, document_id))


def upload(actor: dict, stream: BinaryIO, filename: str, access_level: str, department: str | None,
           schedule: Callable[..., None]) -> DocumentOut:
    """Valida y guarda el archivo; `schedule(fn, *args)` agenda la indexación (p. ej. BackgroundTasks.add_task)."""
    settings = get_settings()
    ext = Path(filename).suffix.lower()
    if ext not in MIME_TYPES:
        raise UnsupportedMedia("Solo se aceptan archivos PDF, DOCX o XLSX.", "tipo_no_soportado")
    content = stream.read(settings.max_upload_mb * 1024 * 1024 + 1)  # +1 byte para detectar que se pasó del límite
    if not content:
        raise BadRequest("El archivo está vacío.", "archivo_vacio")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise PayloadTooLarge(f"El archivo supera el máximo de {settings.max_upload_mb} MB.")
    _validate_content(ext, content)
    stored_name = f"{uuid.uuid4()}{ext}"
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    path = settings.storage_path / stored_name
    path.write_bytes(content)
    try:
        row = document_repository.create(
            original_name=Path(filename).name, stored_name=stored_name, mime_type=MIME_TYPES[ext],
            size_bytes=len(content), checksum=hashlib.sha256(content).hexdigest(),
            access_level=level_to_int(access_level), department=department or None, uploaded_by=str(actor["id"]),
        )
    except Exception as exc:
        path.unlink(missing_ok=True)
        if isinstance(exc, document_repository.DuplicateChecksum):
            raise Conflict("Este documento ya fue subido.", "documento_duplicado") from None
        raise
    audit_service.record(str(actor["id"]), "document.upload", "document", str(row["id"]), nombre=row["original_name"])
    schedule(index_document, str(row["id"]))
    return to_document_out(row)


def update_document(actor: dict, document_id: str, data: DocumentUpdate) -> DocumentOut:
    fields = data.model_dump(exclude_unset=True)
    if fields.get("access_level") is not None:
        fields["access_level"] = level_to_int(fields["access_level"])
    fields = {k: v for k, v in fields.items() if v is not None or k == "department"}
    if not fields:
        return get_document(actor, document_id)
    row = document_repository.update_access(document_id, fields)
    if row is None:
        raise NotFound("El documento no existe.", "documento_no_encontrado")
    audit_service.record(str(actor["id"]), "document.update", "document", document_id, campos=sorted(fields))
    return to_document_out(row)


def delete_document(actor: dict, document_id: str) -> None:
    row = document_repository.get_by_id(document_id)
    if row is None or not document_repository.delete(document_id):
        raise NotFound("El documento no existe.", "documento_no_encontrado")
    (get_settings().storage_path / row["stored_name"]).unlink(missing_ok=True)
    audit_service.record(str(actor["id"]), "document.delete", "document", document_id, nombre=row["original_name"])


def get_file(user: dict, document_id: str) -> tuple[Path, str, str]:
    row = _get_row(user, document_id)
    path = get_settings().storage_path / row["stored_name"]
    if not path.is_file():
        raise NotFound("El archivo no está disponible.", "archivo_no_encontrado")
    audit_service.record(str(user["id"]), "document.download", "document", document_id)
    return path, row["original_name"], row["mime_type"]


def get_chunk(user: dict, chunk_id: str) -> ChunkOut:
    row = chunk_repository.get_visible(chunk_id, user["access_level"], user["department"])
    if row is None:
        raise NotFound("El fragmento no existe.", "fragmento_no_encontrado")
    return ChunkOut(**row)
