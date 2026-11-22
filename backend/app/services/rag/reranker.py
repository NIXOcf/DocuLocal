"""Re-ranking local con cross-encoder multilingüe (fastembed/ONNX). Se carga en el primer uso."""
import logging
import threading
import time

from fastembed.rerank.cross_encoder import TextCrossEncoder

from app.core.config import get_settings

logger = logging.getLogger("doculocal.reranker")
_model: TextCrossEncoder | None = None
_lock = threading.Lock()


def _get_model() -> TextCrossEncoder:
    global _model
    with _lock:
        if _model is None:
            name, started = get_settings().rerank_model, time.perf_counter()
            try:
                _model = TextCrossEncoder(name)
            except Exception as exc:
                logger.error("No se pudo cargar el modelo reranker %s (%s): la primera vez se descarga; "
                             "revisa internet y el espacio en disco", name, type(exc).__name__)
                raise
            logger.info("Modelo reranker cargado modelo=%s ms=%d", name, round((time.perf_counter() - started) * 1000))
        return _model


def rerank(query: str, texts: list[str]) -> list[float]:
    """Puntaje de relevancia (logit) por texto, en el mismo orden de entrada."""
    if not texts:
        return []
    return [float(s) for s in _get_model().rerank(query, texts)]
