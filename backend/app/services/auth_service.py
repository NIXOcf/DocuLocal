from app.core.config import get_settings
import logging
import threading
import time
from uuid import UUID

from app.core.errors import Forbidden, TooManyRequests, Unauthorized
from app.core.logging import mask_email
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.repositories import user_repository
from app.schemas.user import LoginOut
from app.services import audit_service
from app.services.rate_limiter import SlidingWindowLimiter
from app.services.user_service import to_user_out

logger = logging.getLogger("doculocal.auth")

# Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
_DUMMY_HASH = hash_password("relleno-no-valido")


# Cada intento se reserva antes de verificar la contraseña (así los intentos concurrentes no se cuelan) y se
# descarta si el login sale bien. Dos bloqueos duros (429 con Retry-After = la mayor espera):
LOGIN_MAX_PER_PAIR = 5          # por (IP, correo)
LOGIN_MAX_PER_IP = 20           # por IP, sumando todos los correos (password spraying)
LOGIN_WINDOW_SECONDS = 15 * 60
# Por cuenta (sumando IP) no hay bloqueo, solo un retraso progresivo y acotado antes de verificar:
LOGIN_ACCOUNT_FREE_ATTEMPTS = 5
LOGIN_ACCOUNT_MAX_DELAY_SECONDS = 8
LOGIN_ACCOUNT_TRACKED = 1000    # tope de intentos recordados por cuenta (memoria acotada)
# shortcut: el retraso por cuenta ocupa un hilo hasta 8 s y no frena ataques distribuidos muy grandes, mejorar
# con CAPTCHA o colas de reintento cuando haya tráfico real; no bloquea la cuenta para no permitir un DoS al usuario.
login_pair_limiter = SlidingWindowLimiter(LOGIN_MAX_PER_PAIR, LOGIN_WINDOW_SECONDS)
login_ip_limiter = SlidingWindowLimiter(LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS)
login_account_limiter = SlidingWindowLimiter(LOGIN_ACCOUNT_TRACKED, LOGIN_WINDOW_SECONDS)
_login_lock = threading.Lock()  # comprobar los bloqueos duros y reservar en todos o en ninguno
_sleep = time.sleep  # sustituible en pruebas


def account_delay(attempts: int) -> int:
    """Segundos de espera antes de verificar la contraseña, según los intentos recientes sobre la cuenta."""
    if attempts <= LOGIN_ACCOUNT_FREE_ATTEMPTS:
        return 0
    return min(2 ** (attempts - LOGIN_ACCOUNT_FREE_ATTEMPTS), LOGIN_ACCOUNT_MAX_DELAY_SECONDS)


def get_active_user(token: str | None) -> dict:
    """Usuario de un JWT válido, activo y emitido después del último cambio de contraseña; si no, 401."""
    invalid = Unauthorized("Sesión inválida o expirada.", "token_invalido")
    claims = decode_access_token(token) if token else None
    if claims is None:
        raise invalid
    try:
        user_id = str(UUID(claims["sub"]))
    except (TypeError, ValueError):
        raise invalid from None
    user = user_repository.get_by_id(user_id)
    if user is None or not user["is_active"]:
        raise invalid
    changed = user.get("password_changed_at")
    if changed is not None and claims["iat"] < int(changed.timestamp()):  # iat va en segundos enteros
        raise invalid
    return user


def clear_login_limits() -> None:
    for lim in (login_pair_limiter, login_account_limiter, login_ip_limiter):
        lim.clear()


def _reserve_login_attempt(ip: str, account: str) -> tuple[int, dict]:
    """Reserva un intento en los tres contadores; si el par o la IP están llenos no reserva nada y devuelve
    (espera, {}). Si no, (0, tokens)."""
    with _login_lock:
        wait = max(login_pair_limiter.retry_after((ip, account)), login_ip_limiter.retry_after(ip))
        if wait:
            return wait, {}
        tokens = {"pair": login_pair_limiter.try_acquire((ip, account))[1],
                  "ip": login_ip_limiter.try_acquire(ip)[1],
                  "account": login_account_limiter.try_acquire(account)[1]}
        return 0, tokens


def login(email: str, password: str, client_ip: str | None = None) -> LoginOut:
    ip, account = client_ip or "desconocida", email.strip().lower()
    wait, tokens = _reserve_login_attempt(ip, account)
    if wait:
        logger.warning("Login bloqueado motivo=demasiados_intentos email=%s espera=%ds", mask_email(email), wait)
        raise TooManyRequests("Demasiados intentos fallidos. Intenta de nuevo más tarde.", "demasiados_intentos",
                              headers={"Retry-After": str(wait)})
    delay = account_delay(login_account_limiter.count(account))
    if delay:
        _sleep(delay)
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
    login_ip_limiter.release(ip, tokens["ip"])
    login_account_limiter.release(account, tokens["account"])
    audit_service.record(str(user["id"]), "auth.login", "user", str(user["id"]))
    logger.info("Login exitoso user_id=%s", user["id"])
    token = create_access_token(str(user["id"]), user["role"])
    return LoginOut(
        access_token=token,
        expires_in=get_settings().jwt_expires_minutes * 60,
        user=to_user_out(user),
    )
