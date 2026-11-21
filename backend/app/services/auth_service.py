from app.core.config import get_settings
from app.core.errors import Forbidden, Unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import user_repository
from app.schemas.user import LoginOut
from app.services import audit_service
from app.services.user_service import to_user_out

# Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
_DUMMY_HASH = hash_password("relleno-no-valido")


def login(email: str, password: str) -> LoginOut:
    user = user_repository.get_by_email(email)
    valid = verify_password(password, user["password_hash"] if user else _DUMMY_HASH)
    if user is None or not valid:
        audit_service.record(str(user["id"]) if user else None, "auth.login_failed", "user", email=email)
        raise Unauthorized("Correo o contraseña incorrectos.", "credenciales_invalidas")
    if not user["is_active"]:
        audit_service.record(str(user["id"]), "auth.login_blocked", "user", str(user["id"]))
        raise Forbidden("Tu cuenta está desactivada. Contacta al administrador.", "usuario_inactivo")
    audit_service.record(str(user["id"]), "auth.login", "user", str(user["id"]))
    token = create_access_token(str(user["id"]), user["role"])
    return LoginOut(
        access_token=token,
        expires_in=get_settings().jwt_expires_minutes * 60,
        user=to_user_out(user),
    )
