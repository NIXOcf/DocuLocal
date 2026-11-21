import logging
import time

from app.core.config import get_settings
from app.repositories import chunk_repository, document_repository
from app.services.rag import chunking, embeddings, parsing

logger = logging.getLogger("doculocal.ingestion")

NO_TEXT = "El documento no contiene texto extraíble (¿escaneado sin OCR?)"


def index_document(document_id: str) -> None:
    """Parsea, fragmenta, embebe e inserta. Corre en segundo plano; nunca propaga excepciones."""
    started = time.perf_counter()
    try:
        doc = document_repository.get_by_id(document_id)
        if doc is None:  # borrado antes de indexarse
            return
        logger.info("Indexación iniciada documento=%s", document_id)
        pages = parsing.extract_pages(get_settings().storage_path / doc["stored_name"])
        chunks = chunking.chunk_pages(pages)
        logger.info("Texto extraído documento=%s paginas=%d chunks=%d", document_id, len(pages), len(chunks))
        if not chunks:
            logger.warning("Documento sin texto extraíble documento=%s: ¿PDF escaneado sin OCR?", document_id)
            document_repository.mark_error(document_id, NO_TEXT)
            return
        t = time.perf_counter()
        vectors = embeddings.embed_documents([c.content for c in chunks])
        logger.info("Embeddings listos documento=%s ms=%d", document_id, round((time.perf_counter() - t) * 1000))
        chunk_repository.insert_batch(
            document_id, [(c.index, c.page, c.content, v) for c, v in zip(chunks, vectors)]
        )
        page_count = max((n for n, _ in pages if n is not None), default=None)
        document_repository.mark_indexed(document_id, page_count, len(chunks))
        logger.info("Indexado documento=%s chunks=%d ms=%d", document_id, len(chunks),
                    round((time.perf_counter() - started) * 1000))
    except Exception as exc:
        logger.exception("Error al indexar documento=%s motivo=%s", document_id, type(exc).__name__)
        try:
            chunk_repository.delete_by_document(document_id)
            document_repository.mark_error(document_id, f"No se pudo procesar el documento: {type(exc).__name__}")
        except Exception:
            logger.exception("No se pudo marcar el documento %s como Error", document_id)
