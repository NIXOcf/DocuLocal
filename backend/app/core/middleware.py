"""Middleware ASGI: id de petición (X-Request-ID) y log de acceso. Nunca registra query string ni cabecera Authorization."""
import logging
import time

from starlette.datastructures import Headers, MutableHeaders

from app.core.logging import new_request_ctx

logger = logging.getLogger("doculocal.acceso")
HEADER = "X-Request-ID"


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
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
            logger.log(level, "%s %s status=%s ms=%d user_id=%s", scope["method"], path, status, ms, ctx["user_id"] or "-")

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
