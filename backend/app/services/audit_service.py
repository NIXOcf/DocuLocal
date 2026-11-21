import logging

from app.repositories import audit_repository

logger = logging.getLogger("doculocal")


def record(user_id: str | None, action: str, resource: str, resource_id: str | None = None, **detail) -> None:
    """La auditoría nunca debe romper la operación principal: si falla, solo se registra en el log."""
    try:
        audit_repository.insert(user_id, action, resource, resource_id, detail)
    except Exception:
        logger.exception("No se pudo escribir en audit_log (%s)", action)
