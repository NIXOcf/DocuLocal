"""Middleware ASGI: id de petición (X-Request-ID) y log de acceso (nunca registra query string ni Authorization),
límite de tamaño de cuerpo y cabeceras de seguridad."""
import logging
import time

from starlette.datastructures import Headers, MutableHeaders

from app.core.config import get_settings
from app.core.errors import build_error_response
from app.core.logging import new_request_ctx

logger = logging.getLogger("doculocal.acceso")
HEADER = "X-Request-ID"


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        client = scope.get("client")
        ctx = new_request_ctx(Headers(scope=scope).get(HEADER))
        started = time.perf_counter()
        status = 500
        logged = False

        def log() -> None:
            nonlocal logged
            if logged:
                return
            logged = True
            path = scope["path"]
            ms = round((time.perf_counter() - started) * 1000)
            level = logging.DEBUG if path.endswith("/health") else logging.INFO  # el front consulta la salud a menudo
            logger.log(level, "%s %s status=%s ms=%d user_id=%s",
                       scope["method"], path, status, ms, ctx["user_id"] or "-")

        async def send_wrapper(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message)[HEADER] = ctx["request_id"]
            elif message["type"] == "http.response.body" and not message.get("more_body"):
                log()
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            log()  # si la petición terminó con excepción sin respuesta, queda registrada como 500


UPLOAD_PATH = "/api/v1/documents"
UPLOAD_EXTRA_BYTES = 1024 * 1024  # holgura del multipart sobre MAX_UPLOAD_MB
DEFAULT_BODY_LIMIT = 64 * 1024


class BodyLimitMiddleware:
    """Rechaza con 413 los cuerpos grandes antes de autenticar: por Content-Length y también contando los bytes
    recibidos (sin Content-Length, chunked o con la cabecera falseada)."""

    def __init__(self, app):
        self.app = app

    @staticmethod
    def _limit(scope) -> int:
        if scope["method"] == "POST" and scope["path"] == UPLOAD_PATH:
            return get_settings().max_upload_mb * 1024 * 1024 + UPLOAD_EXTRA_BYTES
        return DEFAULT_BODY_LIMIT

    async def _reject(self, scope, receive, send, limit: int) -> None:
        resp, ref = build_error_response(413, "cuerpo_demasiado_grande",
                                         f"El cuerpo de la solicitud supera el máximo de {limit // 1024} KB.")
        logger.info("%s %s -> 413 motivo=cuerpo_demasiado_grande ref=%s", scope["method"], scope["path"], ref)
        await resp(scope, receive, send)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        limit = self._limit(scope)
        declared = Headers(scope=scope).get("content-length", "")
        if declared.isdigit() and int(declared) > limit:
            return await self._reject(scope, receive, send, limit)

        received = 0
        exceeded = False
        started = False

        async def limited_receive():
            nonlocal received, exceeded
            if exceeded:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    exceeded = True  # la app ve una desconexión; la respuesta la damos nosotros
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            nonlocal started
            if exceeded and not started:
                return  # descarta lo que la app intente responder tras el corte
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except Exception:
            if not exceeded or started:
                raise
        if exceeded and not started:
            await self._reject(scope, receive, send, limit)


DOCS_PATHS = ("/docs", "/redoc")  # Swagger/ReDoc cargan scripts: la CSP estricta los rompería
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in DOCS_PATHS:
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in SECURITY_HEADERS.items():
                    headers[name] = value
            await send(message)

        await self.app(scope, receive, send_wrapper)
