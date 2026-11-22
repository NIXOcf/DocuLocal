import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, conversations, documents, health, users
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import BodyLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from app.repositories import db


MIN_JWT_SECRET_CHARS = 32


def _log_startup() -> None:
    """Resumen de configuración para diagnóstico; nunca incluye claves ni contraseñas."""
    s = get_settings()
    if len(s.jwt_secret) < MIN_JWT_SECRET_CHARS:
        raise RuntimeError(f"JWT_SECRET debe tener al menos {MIN_JWT_SECRET_CHARS} caracteres.")
    log = logging.getLogger("doculocal.arranque")
    log.info("DocuLocal API iniciando modo_llm=%s llm_host=%s modelo=%s modelo_rapido=%s guard=%s clave_llm=%s "
             "timeout_llm=%ds reintentos_llm=%d bd=%s:%s/%s log_level=%s log_dir=%s",
             s.llm_mode, s.llm_host, s.llm_model, s.llm_fast_model,
             s.llm_guard_model or "desactivado", "si" if s.groq_api_key else "no", s.llm_timeout_seconds,
             s.llm_max_retries, s.postgres_host, s.postgres_port, s.postgres_db, s.log_level.upper(), s.log_path)
    if not s.llm_guard_model:
        log.warning("Detector de inyección desactivado (LLM_GUARD_MODEL vacío): las consultas no se filtran")
    if not s.groq_api_key and not s.llm_is_local:
        log.warning("Falta GROQ_API_KEY: el chat responderá 503 llm_no_disponible")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    _log_startup()
    db.open_pool()
    yield
    db.close_pool()


def create_app() -> FastAPI:
    docs = get_settings().enable_docs
    app = FastAPI(title="DocuLocal API", version="1.0.0", lifespan=lifespan,
                  docs_url="/docs" if docs else None, redoc_url="/redoc" if docs else None,
                  openapi_url="/openapi.json" if docs else None)
    # Cada add_middleware queda por fuera del anterior: el límite de cuerpo va dentro de CORS (así el 413 lleva
    # sus cabeceras) y el contexto de petición queda como capa externa.
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Location", "X-Request-ID"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    for module in (health, auth, users, documents, conversations):
        app.include_router(module.router, prefix="/api/v1")
    return app


app = create_app()
