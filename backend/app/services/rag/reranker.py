"""Re-ranking local con cross-encoder multilingüe (fastembed/ONNX). Se carga en el primer uso."""
import threading

from fastembed.rerank.cross_encoder import TextCrossEncoder

from app.core.config import get_settings

_model: TextCrossEncoder | None = None
_lock = threading.Lock()


def _get_model() -> TextCrossEncoder:
    global _model
    with _lock:
        if _model is None:
            _model = TextCrossEncoder(get_settings().rerank_model)
        return _model


def rerank(query: str, texts: list[str]) -> list[float]:
    """Puntaje de relevancia (logit) por texto, en el mismo orden de entrada."""
    if not texts:
        return []
    return [float(s) for s in _get_model().rerank(query, texts)]
