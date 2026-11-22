"""Logging centralizado: consola + archivo rotativo, con el id de petición en cada línea."""
import logging
import re
import secrets
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler

from app.core.config import get_settings

# Diccionario mutable por petición: así un cambio hecho en un hilo (dependencias síncronas) lo ve el middleware.
_ctx: ContextVar[dict | None] = ContextVar("request_ctx", default=None)
_VALID_ID = re.compile(r"[A-Za-z0-9-]{1,64}")
_CONTROL = re.compile(r"[\x00-\x08\x0a-\x1f\x7f]")  # caracteres de control salvo el tabulador


def sanitize(text: str) -> str:
    r"""Reemplaza CR, LF y demás caracteres de control por escapes visibles (\n, \r, \x1b): evita falsificar líneas."""
    return _CONTROL.sub(lambda m: m.group().encode("unicode_escape").decode(), text)


def new_request_ctx(incoming: str | None) -> dict:
    """Respeta un X-Request-ID válido (≤64, alfanumérico o guion); si no, genera uno."""
    rid = incoming if incoming and _VALID_ID.fullmatch(incoming) else secrets.token_hex(4)
    ctx = {"request_id": rid, "user_id": None}
    _ctx.set(ctx)
    return ctx


def current_request_id() -> str:
    return (_ctx.get() or {}).get("request_id", "-")


def set_user_id(user_id: str) -> None:
    ctx = _ctx.get()
    if ctx is not None:
        ctx["user_id"] = user_id


def mask_email(email: str) -> str:
    """t***@aguanube.cl: suficiente para ubicar al usuario sin guardar el correo completo."""
    local, sep, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if sep and local else "***"


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Mensaje final saneado (cubre ruta, nombres de campo y cualquier dato del cliente); args ya consumidos.
        record.msg, record.args = sanitize(record.getMessage()), None
        record.request_id = current_request_id()
        record.modulo = record.name.removeprefix("doculocal.")
        return True


def setup_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    settings.log_path.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(modulo)s] req=%(request_id)s %(message)s")
    handlers = [
        logging.StreamHandler(),
        RotatingFileHandler(settings.log_path / "doculocal.log", maxBytes=5 * 1024 * 1024, backupCount=5,
                            encoding="utf-8"),
    ]
    root = logging.getLogger("doculocal")
    root.handlers.clear()
    root.setLevel(level)
    root.propagate = False
    for h in handlers:
        h.setFormatter(fmt)
        h.addFilter(_ContextFilter())
        root.addHandler(h)
    logging.getLogger("uvicorn.access").disabled = True  # el middleware ya registra cada petición
