"""Cliente LLM sobre la API compatible con OpenAI (Groq). Cambiar LLM_BASE_URL permite usar llama.cpp local."""
import logging

import openai

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable

logger = logging.getLogger("doculocal")

TIMEOUT_SECONDS = 30
_client: openai.OpenAI | None = None


def _get_client() -> openai.OpenAI:
    global _client
    settings = get_settings()
    if not settings.groq_api_key:
        raise ServiceUnavailable("El asistente no está configurado (falta GROQ_API_KEY).", "llm_no_disponible")
    if _client is None:
        _client = openai.OpenAI(
            api_key=settings.groq_api_key, base_url=settings.llm_base_url, timeout=TIMEOUT_SECONDS, max_retries=2
        )
    return _client


class LLMClient:
    """Interfaz mínima: un solo método, fácil de reemplazar o simular en pruebas."""

    def chat(self, messages: list[dict], model: str, temperature: float = 0.1, json_mode: bool = False,
             max_tokens: int = 1500) -> str:
        extra: dict = {}
        if json_mode:
            extra["response_format"] = {"type": "json_object"}
        if model.startswith("openai/gpt-oss"):
            extra["reasoning_effort"] = "low"  # verificado: Groq lo acepta; evita gastar tokens razonando
        try:
            resp = _get_client().chat.completions.create(
                model=model, messages=messages, temperature=temperature, max_tokens=max_tokens, **extra
            )
        except openai.OpenAIError as exc:  # red, timeout, 4xx/5xx del proveedor
            logger.error("Falló la llamada al LLM (%s): %s", model, type(exc).__name__)
            raise ServiceUnavailable("El asistente no está disponible por ahora. Intenta de nuevo.",
                                     "llm_no_disponible") from None
        return resp.choices[0].message.content or ""


llm = LLMClient()


def prompt_injection_score(text: str) -> float:
    """Probabilidad (0..1) de inyección según Prompt Guard. Groq devuelve el puntaje como texto.

    Si el guard falla no se bloquea el chat: se devuelve 0.0 y se registra.
    """
    try:
        raw = llm.chat([{"role": "user", "content": text}], get_settings().llm_guard_model, temperature=0,
                       max_tokens=10)
        return float(raw.strip())
    except Exception as exc:
        logger.warning("Prompt guard no disponible: %s", type(exc).__name__)
        return 0.0
