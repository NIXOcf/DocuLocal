from app.core.config import get_settings
import logging

from app.core.errors import Forbidden, TooManyRequests, Unauthorized
from app.core.logging import mask_email
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import user_repository
from app.schemas.user import LoginOut
from app.services import audit_service
from app.services.rate_limiter import SlidingWindowLimiter
from app.services.user_service import to_user_out

logger = logging.getLogger("doculocal.auth")

# Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
_DUMMY_HASH = hash_password("relleno-no-valido")


# 5 fallos en 15 minutos por (IP, correo) bloquean los siguientes intentos; un login exitoso limpia el contador.
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_SECONDS = 15 * 60
login_limiter = SlidingWindowLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS)


def login(email: str, password: str, client_ip: str | None = None) -> LoginOut:
    key = (client_ip or "desconocida", email.strip().lower())
    wait = login_limiter.retry_after(key)
    if wait:
        logger.warning("Login bloqueado motivo=demasiados_intentos email=%s espera=%ds", mask_email(email), wait)
        raise TooManyRequests("Demasiados intentos fallidos. Intenta de nuevo más tarde.", "demasiados_intentos",
                              headers={"Retry-After": str(wait)})
    user = user_repository.get_by_email(email)
    valid = verify_password(password, user["password_hash"] if user else _DUMMY_HASH)
    if user is None or not valid:
        login_limiter.add(key)
        # sin el correo completo en la auditoría: user_id si existe, si no el correo enmascarado
        audit_service.record(str(user["id"]) if user else None, "auth.login_failed", "user",
                             **({} if user else {"email": mask_email(email)}))
        logger.warning("Login fallido motivo=credenciales email=%s", mask_email(email))
        raise Unauthorized("Correo o contraseña incorrectos.", "credenciales_invalidas")
    if not user["is_active"]:
        audit_service.record(str(user["id"]), "auth.login_blocked", "user", str(user["id"]))
        logger.warning("Login fallido motivo=inactivo user_id=%s", user["id"])
        raise Forbidden("Tu cuenta está desactivada. Contacta al administrador.", "usuario_inactivo")
    login_limiter.reset(key)
    audit_service.record(str(user["id"]), "auth.login", "user", str(user["id"]))
    logger.info("Login exitoso user_id=%s", user["id"])
    token = create_access_token(str(user["id"]), user["role"])
    return LoginOut(
        access_token=token,
        expires_in=get_settings().jwt_expires_minutes * 60,
        user=to_user_out(user),
    )
