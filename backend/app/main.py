from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, conversations, documents, health, users
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.repositories import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.open_pool()
    yield
    db.close_pool()


def create_app() -> FastAPI:
    app = FastAPI(title="DocuLocal API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Location"],
    )
    register_error_handlers(app)
    for module in (health, auth, users, documents, conversations):
        app.include_router(module.router, prefix="/api/v1")
    return app


app = create_app()
