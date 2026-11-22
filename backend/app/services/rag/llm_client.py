"""Cliente LLM sobre la API compatible con OpenAI (Groq). Cambiar LLM_BASE_URL permite usar llama.cpp local."""
import logging
import time

import openai

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable

logger = logging.getLogger("doculocal.llm")

_client: openai.OpenAI | None = None


def _get_client() -> openai.OpenAI:
    global _client
    settings = get_settings()
    # llama-server local no necesita clave: se usa un placeholder porque el SDK exige una.
    api_key = settings.groq_api_key or ("sin-clave" if settings.llm_is_local else "")
    if not api_key:
        raise ServiceUnavailable("El asistente no está configurado (falta la clave del proveedor, GROQ_API_KEY).",
                                 "llm_no_disponible")
    if _client is None:
        _client = openai.OpenAI(api_key=api_key, base_url=settings.llm_base_url,
                                timeout=settings.llm_timeout_seconds, max_retries=settings.llm_max_retries)
    return _client


def _diagnose(exc: openai.OpenAIError) -> str:
    """Causa probable y qué hacer, para quien lee el log."""
    s = get_settings()
    host = s.llm_host
    if isinstance(exc, openai.APITimeoutError):
        return (f"timeout tras {s.llm_timeout_seconds}s ({s.llm_max_retries + 1} intentos): "
                "sube LLM_TIMEOUT_SECONDS o usa un modelo más rápido")
    if isinstance(exc, openai.APIConnectionError):
        if s.llm_is_local:
            return f"conexión rechazada en {host}: ¿está encendido llama-server? (backend/scripts/llama_local.ps1)"
        return f"sin conexión con {host}: revisa internet o el proxy"
    if isinstance(exc, openai.RateLimitError):
        return "cupo de Groq agotado (429): espera o cambia a modo local" if not s.llm_is_local else "servidor local saturado (429)"
    if isinstance(exc, openai.AuthenticationError):
        return "clave del proveedor rechazada (401): revisa GROQ_API_KEY"
    if isinstance(exc, openai.APIStatusError):
        return f"el proveedor respondió {exc.status_code}: revisa LLM_MODEL y LLM_BASE_URL"
    return "error del cliente LLM"


class LLMClient:
    """Interfaz mínima: un solo método, fácil de reemplazar o simular en pruebas."""

    def chat(self, messages: list[dict], model: str, temperature: float = 0.1, json_mode: bool = False,
             max_tokens: int = 1500) -> str:
        extra: dict = {}
        if json_mode:
            extra["response_format"] = {"type": "json_object"}
        if model.startswith("openai/gpt-oss") and not get_settings().llm_is_local:
            extra["reasoning_effort"] = "low"  # solo Groq: evita gastar tokens razonando
        started = time.perf_counter()
        try:
            resp = _get_client().chat.completions.create(
                model=model, messages=messages, temperature=temperature, max_tokens=max_tokens, **extra
            )
        except openai.OpenAIError as exc:  # red, timeout, 4xx/5xx del proveedor
            logger.error("Falló la llamada al LLM modelo=%s ms=%d: %s [%s]", model,
                         round((time.perf_counter() - started) * 1000), _diagnose(exc), type(exc).__name__)
            raise ServiceUnavailable("El asistente no está disponible por ahora. Intenta de nuevo.",
                                     "llm_no_disponible") from None
        usage = resp.usage
        logger.info("LLM ok modelo=%s ms=%d tokens_entrada=%s tokens_salida=%s", model,
                    round((time.perf_counter() - started) * 1000),
                    usage.prompt_tokens if usage else "?", usage.completion_tokens if usage else "?")
        return resp.choices[0].message.content or ""


llm = LLMClient()


def prompt_injection_score(text: str) -> float:
    """Probabilidad (0..1) de inyección según Prompt Guard. Groq devuelve el puntaje como texto.

    Si el guard falla no se bloquea el chat: se devuelve 0.0 y se registra.
    Sin LLM_GUARD_MODEL (p. ej. modo local) no se llama: 0.0 (el aviso se registra una vez al arrancar).
    """
    guard = get_settings().llm_guard_model
    if not guard:
        return 0.0
    try:
        raw = llm.chat([{"role": "user", "content": text}], guard, temperature=0, max_tokens=10)
        return float(raw.strip())
    except Exception as exc:
        logger.warning("Prompt guard no disponible: %s", type(exc).__name__)
        return 0.0
