"""Estado de la API para el front: BD (obligatoria) y proveedor LLM (degradable, cacheado)."""
import logging
import time

import httpx

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.repositories import db

logger = logging.getLogger("doculocal.salud")

CACHE_SECONDS = 30
_cache: tuple[float, str] | None = None


def _probe_llm() -> str:
    """Comprobación barata: GET {LLM_BASE_URL}/models (no consume cupo de tokens)."""
    s = get_settings()
    if not s.groq_api_key and not s.llm_is_local:
        return "sin_configurar"
    try:
        r = httpx.get(f"{s.llm_base_url.rstrip('/')}/models", timeout=3,
                      headers={"Authorization": f"Bearer {s.groq_api_key or 'sin-clave'}",
                               # Anthropic (modo compatible) exige estas dos cabeceras; Groq y llama.cpp las ignoran
                               "x-api-key": s.groq_api_key, "anthropic-version": "2023-06-01"})
    except httpx.HTTPError as exc:
        logger.warning("LLM no disponible modo=%s: %s", s.llm_mode, type(exc).__name__)
        return "no_disponible"
    if r.status_code >= 400:
        logger.warning("LLM no disponible modo=%s: /models respondió %s", s.llm_mode, r.status_code)
        return "no_disponible"
    return "ok"


def llm_status() -> str:
    global _cache
    now = time.monotonic()
    if _cache is None or now - _cache[0] > CACHE_SECONDS:
        _cache = (now, _probe_llm())
    return _cache[1]


def status() -> dict:
    try:
        db.ping()
    except Exception as exc:
        logger.error("Health: la base de datos no responde (%s)", type(exc).__name__)
        raise ServiceUnavailable("La base de datos no responde.", "bd_no_disponible") from None
    return {"estado": "ok", "db": "ok", "llm": llm_status(), "modo": get_settings().llm_mode}
