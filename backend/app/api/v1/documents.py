from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.deps import AdminUser, CurrentUser
from app.schemas.common import AccessLevel, Page
from app.schemas.document import ChunkOut, DocumentOut, DocumentUpdate
from app.services import document_service
from app.services.rag.ingestion import index_document

router = APIRouter(tags=["documents"])


@router.get("/documents", response_model=Page[DocumentOut])
def list_documents(user: CurrentUser, pagina: Annotated[int, Query(ge=1)] = 1,
                   tamano: Annotated[int, Query(ge=1, le=100)] = 20,
                   estado: Annotated[str | None, Query(pattern="^(Procesando|Indexado|Error)$")] = None,
                   nivel: AccessLevel | None = None, q: str | None = None):
    return document_service.list_documents(user, pagina, tamano, estado, nivel, q)


@router.post("/documents", response_model=DocumentOut, status_code=202)
def upload_document(admin: AdminUser, file: UploadFile, access_level: Annotated[AccessLevel, Form(alias="accessLevel")],
                    tasks: BackgroundTasks, response: Response, department: Annotated[str | None, Form()] = None):
    limit = get_settings().max_upload_mb * 1024 * 1024
    content = file.file.read(limit + 1)  # +1 byte para detectar que se pasó del límite
    doc = document_service.upload(admin, file.filename or "", content, access_level, department)
    tasks.add_task(index_document, str(doc.id))
    response.headers["Location"] = f"/api/v1/documents/{doc.id}"
    return doc


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(user: CurrentUser, document_id: UUID):
    return document_service.get_document(user, str(document_id))


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def update_document(admin: AdminUser, document_id: UUID, body: DocumentUpdate):
    return document_service.update_document(admin, str(document_id), body)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(admin: AdminUser, document_id: UUID):
    document_service.delete_document(admin, str(document_id))
    return Response(status_code=204)


@router.get("/documents/{document_id}/file")
def download_document(user: CurrentUser, document_id: UUID):
    path, name, mime = document_service.get_file(user, str(document_id))
    return FileResponse(path, media_type=mime, filename=name)


@router.get("/chunks/{chunk_id}", response_model=ChunkOut)
def get_chunk(user: CurrentUser, chunk_id: UUID):
    return document_service.get_chunk(user, str(chunk_id))
