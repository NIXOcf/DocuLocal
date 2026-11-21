import logging

from app.core.config import get_settings
from app.repositories import chunk_repository, document_repository
from app.services.rag import chunking, embeddings, parsing

logger = logging.getLogger("doculocal")

NO_TEXT = "El documento no contiene texto extraíble (¿escaneado sin OCR?)"


def index_document(document_id: str) -> None:
    """Parsea, fragmenta, embebe e inserta. Corre en segundo plano; nunca propaga excepciones."""
    try:
        doc = document_repository.get_by_id(document_id)
        if doc is None:  # borrado antes de indexarse
            return
        pages = parsing.extract_pages(get_settings().storage_path / doc["stored_name"])
        chunks = chunking.chunk_pages(pages)
        if not chunks:
            document_repository.mark_error(document_id, NO_TEXT)
            return
        vectors = embeddings.embed_documents([c.content for c in chunks])
        chunk_repository.insert_batch(
            document_id, [(c.index, c.page, c.content, v) for c, v in zip(chunks, vectors)]
        )
        page_count = max((n for n, _ in pages if n is not None), default=None)
        document_repository.mark_indexed(document_id, page_count, len(chunks))
    except Exception as exc:
        logger.exception("Falló la indexación del documento %s", document_id)
        try:
            chunk_repository.delete_by_document(document_id)
            document_repository.mark_error(document_id, f"No se pudo procesar el documento: {type(exc).__name__}")
        except Exception:
            logger.exception("No se pudo marcar el documento %s como Error", document_id)
