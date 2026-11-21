from app.core.config import get_settings
import logging
import threading

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


# Cada intento se reserva antes de verificar la contraseña (así los intentos concurrentes no se cuelan) y se
# descarta si el login sale bien. Tres límites; cualquiera que se active responde 429 con el mayor Retry-After:
LOGIN_MAX_PER_PAIR = 5          # por (IP, correo)
LOGIN_MAX_PER_ACCOUNT = 10      # por correo, sumando todas las IP (ataque distribuido)
LOGIN_MAX_PER_IP = 20           # por IP, sumando todos los correos (password spraying)
LOGIN_WINDOW_SECONDS = 15 * 60
# shortcut: el límite por cuenta permite que un atacante bloquee a un usuario legítimo (DoS de la cuenta),
# mejorar con retrasos progresivos o CAPTCHA.
login_pair_limiter = SlidingWindowLimiter(LOGIN_MAX_PER_PAIR, LOGIN_WINDOW_SECONDS)
login_account_limiter = SlidingWindowLimiter(LOGIN_MAX_PER_ACCOUNT, LOGIN_WINDOW_SECONDS)
login_ip_limiter = SlidingWindowLimiter(LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS)
_login_lock = threading.Lock()  # comprobar los tres y reservar en todos o en ninguno


def clear_login_limits() -> None:
    for lim in (login_pair_limiter, login_account_limiter, login_ip_limiter):
        lim.clear()


def _reserve_login_attempt(ip: str, account: str) -> int:
    """Reserva un intento en los tres límites; si alguno está lleno no reserva nada y devuelve la mayor espera."""
    with _login_lock:
        waits = [login_pair_limiter.retry_after((ip, account)), login_account_limiter.retry_after(account),
                 login_ip_limiter.retry_after(ip)]
        if any(waits):
            return max(waits)
        login_pair_limiter.try_acquire((ip, account))
        login_account_limiter.try_acquire(account)
        login_ip_limiter.try_acquire(ip)
        return 0


def login(email: str, password: str, client_ip: str | None = None) -> LoginOut:
    ip, account = client_ip or "desconocida", email.strip().lower()
    wait = _reserve_login_attempt(ip, account)
    if wait:
        logger.warning("Login bloqueado motivo=demasiados_intentos email=%s espera=%ds", mask_email(email), wait)
        raise TooManyRequests("Demasiados intentos fallidos. Intenta de nuevo más tarde.", "demasiados_intentos",
                              headers={"Retry-After": str(wait)})
    user = user_repository.get_by_email(email)
    valid = verify_password(password, user["password_hash"] if user else _DUMMY_HASH)
    if user is None or not valid:
        # sin el correo completo en la auditoría: user_id si existe, si no el correo enmascarado
        audit_service.record(str(user["id"]) if user else None, "auth.login_failed", "user",
                             **({} if user else {"email": mask_email(email)}))
        logger.warning("Login fallido motivo=credenciales email=%s", mask_email(email))
        raise Unauthorized("Correo o contraseña incorrectos.", "credenciales_invalidas")
    if not user["is_active"]:
        audit_service.record(str(user["id"]), "auth.login_blocked", "user", str(user["id"]))
        logger.warning("Login fallido motivo=inactivo user_id=%s", user["id"])
        raise Forbidden("Tu cuenta está desactivada. Contacta al administrador.", "usuario_inactivo")
    login_pair_limiter.reset((ip, account))  # éxito: limpia el par y descarta el intento reservado en los demás
    login_account_limiter.release(account)
    login_ip_limiter.release(ip)
    audit_service.record(str(user["id"]), "auth.login", "user", str(user["id"]))
    logger.info("Login exitoso user_id=%s", user["id"])
    token = create_access_token(str(user["id"]), user["role"])
    return LoginOut(
        access_token=token,
        expires_in=get_settings().jwt_expires_minutes * 60,
        user=to_user_out(user),
    )
