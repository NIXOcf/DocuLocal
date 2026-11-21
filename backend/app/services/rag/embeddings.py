"""Embeddings locales (fastembed/ONNX). El modelo se carga en el primer uso."""
import threading

import numpy as np
from fastembed import TextEmbedding

from app.core.config import get_settings

_model: TextEmbedding | None = None
_lock = threading.Lock()


def _get_model() -> TextEmbedding:
    global _model
    with _lock:
        if _model is None:
            _model = TextEmbedding(get_settings().embedding_model)
        return _model


# paraphrase-multilingual-mpnet no usa prefijos ("query: "/"passage: "), por eso no se aplican.
def embed_documents(texts: list[str]) -> list[np.ndarray]:
    return list(_get_model().embed(texts, batch_size=32))


def embed_query(text: str) -> np.ndarray:
    return embed_documents([text])[0]
