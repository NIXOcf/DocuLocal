import logging

from app.core.logging import current_ip, current_request_id
from app.repositories import audit_repository

logger = logging.getLogger("doculocal.auditoria")


def record(user_id: str | None, action: str, resource: str, resource_id: str | None = None, **detail) -> None:
    """La auditoría nunca debe romper la operación principal: si falla, solo se registra en el log."""
    try:
        # quién (user_id) + desde dónde (ip) + qué petición (request_id, cruzable con el log de acceso)
        detail = {**detail, "ip": current_ip(), "request_id": current_request_id()}
        audit_repository.insert(user_id, action, resource, resource_id, detail)
    except Exception:
        logger.exception("No se pudo escribir en audit_log (%s)", action)
