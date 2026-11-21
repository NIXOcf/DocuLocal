"""Embeddings locales (fastembed/ONNX). El modelo se carga en el primer uso."""
import logging
import threading
import time

import numpy as np
from fastembed import TextEmbedding

from app.core.config import get_settings

logger = logging.getLogger("doculocal.embeddings")
_model: TextEmbedding | None = None
_lock = threading.Lock()


def _get_model() -> TextEmbedding:
    global _model
    with _lock:
        if _model is None:
            name, started = get_settings().embedding_model, time.perf_counter()
            try:
                _model = TextEmbedding(name)
            except Exception as exc:
                logger.error("No se pudo cargar el modelo de embeddings %s (%s): la primera vez se descarga "
                             "(~1 GB); revisa internet y el espacio en disco", name, type(exc).__name__)
                raise
            logger.info("Modelo de embeddings cargado modelo=%s ms=%d", name, round((time.perf_counter() - started) * 1000))
        return _model


# paraphrase-multilingual-mpnet no usa prefijos ("query: "/"passage: "), por eso no se aplican.
def embed_documents(texts: list[str]) -> list[np.ndarray]:
    return list(_get_model().embed(texts, batch_size=32))


def embed_query(text: str) -> np.ndarray:
    return embed_documents([text])[0]
