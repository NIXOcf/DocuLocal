import logging
import secrets

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("doculocal")


class AppError(Exception):
    status = 500
    error = "error_interno"
    mensaje = "Ocurrió un error inesperado."

    def __init__(self, mensaje: str | None = None, error: str | None = None, detalle: dict | None = None):
        super().__init__(mensaje or self.mensaje)
        self.mensaje = mensaje or self.mensaje
        self.error = error or self.error
        self.detalle = detalle or {}


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


class ServiceUnavailable(AppError):
    status, error, mensaje = 503, "servicio_no_disponible", "El servicio no está disponible."


def _response(status: int, error: str, mensaje: str, detalle: dict | None = None) -> JSONResponse:
    ref = "err_" + secrets.token_hex(3)
    return JSONResponse(
        status_code=status,
        content={"error": error, "mensaje": mensaje, "detalle": detalle or {}, "ref": ref},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        resp = _response(exc.status, exc.error, exc.mensaje, exc.detalle)
        logger.warning("%s %s -> %s (%s)", request.method, request.url.path, exc.status, exc.error)
        return resp

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError):
        campos = {}
        for e in exc.errors():
            campo = ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path", "form"))
            campos[campo or "solicitud"] = e["msg"]
        return _response(422, "validacion_fallida", "Hay campos inválidos en la solicitud.", {"campos": campos})

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, exc: StarletteHTTPException):
        codes = {401: "no_autenticado", 403: "prohibido", 404: "no_encontrado", 405: "metodo_no_permitido"}
        return _response(exc.status_code, codes.get(exc.status_code, "error_http"), str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        resp = _response(500, "error_interno", "Ocurrió un error inesperado. Intenta de nuevo más tarde.")
        logger.exception("Error no controlado en %s %s", request.method, request.url.path)
        return resp
