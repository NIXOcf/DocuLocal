from fastapi import APIRouter

from app.core.errors import ServiceUnavailable
from app.repositories import db

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    try:
        db.ping()
    except Exception:
        raise ServiceUnavailable("La base de datos no responde.", "bd_no_disponible") from None
    return {"estado": "ok", "db": "ok"}
