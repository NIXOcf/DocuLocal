import logging

from app.repositories import audit_repository

logger = logging.getLogger("doculocal.auditoria")


def record(user_id: str | None, action: str, resource: str, resource_id: str | None = None) -> None:
    """Auditoría mínima (Ley 21.719): fecha, quién (user_id), acción y recurso. Sin IP, correo, textos ni detalle libre.
    Nunca debe romper la operación principal: si falla, solo se registra en el log."""
    try:
        audit_repository.insert(user_id, action, resource, resource_id)
    except Exception:
        logger.exception("No se pudo escribir en audit_log (%s)", action)


RETENTION_DAYS = 30


def purge_expired() -> None:
    """Retención de 30 días (Ley 21.719). Se ejecuta al arrancar; si falla, solo se registra."""
    try:
        n = audit_repository.purge_older_than(RETENTION_DAYS)
        logger.info("Auditoría: %d registros vencidos eliminados", n)
    except Exception:
        logger.exception("No se pudo purgar audit_log")
