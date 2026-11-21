import logging
import secrets

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import current_request_id

logger = logging.getLogger("doculocal.errores")


class AppError(Exception):
    status = 500
    error = "error_interno"
    mensaje = "Ocurrió un error inesperado."

    def __init__(self, mensaje: str | None = None, error: str | None = None, detalle: dict | None = None,
                 headers: dict[str, str] | None = None):
        super().__init__(mensaje or self.mensaje)
        self.mensaje = mensaje or self.mensaje
        self.error = error or self.error
        self.detalle = detalle or {}
        self.headers = headers or {}  # cabeceras extra de la respuesta (p. ej. Retry-After)


class BadRequest(AppError):
    status, error, mensaje = 400, "solicitud_invalida", "La solicitud no es válida."


class Unauthorized(AppError):
    status, error, mensaje = 401, "no_autenticado", "Debes iniciar sesión."


class Forbidden(AppError):
    status, error, mensaje = 403, "prohibido", "No tienes permiso para esta acción."


class NotFound(AppError):
    status, error, mensaje = 404, "no_encontrado", "El recurso no existe."


class Conflict(AppError):
    status, error, mensaje = 409, "conflicto", "La operación entra en conflicto con el estado actual."


class PayloadTooLarge(AppError):
    status, error, mensaje = 413, "archivo_demasiado_grande", "El archivo supera el tamaño permitido."


class UnsupportedMedia(AppError):
    status, error, mensaje = 415, "tipo_no_soportado", "El tipo de archivo no está soportado."


class Unprocessable(AppError):
    status, error, mensaje = 422, "entidad_no_procesable", "No se pudo procesar la solicitud."


class TooManyRequests(AppError):
    status, error, mensaje = 429, "demasiadas_solicitudes", "Hiciste demasiadas solicitudes. Intenta más tarde."


class ServiceUnavailable(AppError):
    status, error, mensaje = 503, "servicio_no_disponible", "El servicio no está disponible."


def build_error_response(status: int, error: str, mensaje: str, detalle: dict | None = None,
                         headers: dict[str, str] | None = None) -> tuple[JSONResponse, str]:
    """Devuelve la respuesta y su `ref`, para que el log lo incluya junto al request id."""
    ref = "err_" + secrets.token_hex(3)
    resp = JSONResponse(
        status_code=status,
        content={"error": error, "mensaje": mensaje, "detalle": detalle or {}, "ref": ref},
        # los 500 sin controlar salen por fuera del middleware
        headers={**(headers or {}), "X-Request-ID": current_request_id()},
    )
    return resp, ref


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        resp, ref = build_error_response(exc.status, exc.error, exc.mensaje, exc.detalle, exc.headers)
        msg = "%s %s -> %s motivo=%s ref=%s"
        args = (request.method, request.url.path, exc.status, exc.error, ref)
        if exc.status >= 500:
            logger.error(msg, *args, exc_info=exc)
        elif exc.status in (401, 403):
            logger.warning(msg, *args)
        else:
            logger.info(msg, *args)
        return resp

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError):
        campos = {}
        for e in exc.errors():
            campo = ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path", "form"))
            campos[campo or "solicitud"] = e["msg"]
        resp, ref = build_error_response(422, "validacion_fallida", "Hay campos inválidos en la solicitud.", {"campos": campos})
        logger.info("%s %s -> 422 motivo=validacion_fallida campos=%s ref=%s", request.method, request.url.path,
                    ",".join(campos), ref)
        return resp

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, exc: StarletteHTTPException):
        codes = {401: "no_autenticado", 403: "prohibido", 404: "no_encontrado", 405: "metodo_no_permitido"}
        error = codes.get(exc.status_code, "error_http")
        resp, ref = build_error_response(exc.status_code, error, str(exc.detail))
        logger.log(logging.WARNING if exc.status_code in (401, 403) else logging.INFO,
                   "%s %s -> %s motivo=%s ref=%s", request.method, request.url.path, exc.status_code, error, ref)
        return resp

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        resp, ref = build_error_response(500, "error_interno", "Ocurrió un error inesperado. Intenta de nuevo más tarde.")
        logger.error("Error no controlado en %s %s ref=%s", request.method, request.url.path, ref, exc_info=exc)
        return resp
