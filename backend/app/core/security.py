from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(user_id: str, role: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_expires_minutes)
    return jwt.encode({"sub": user_id, "role": role, "iat": now, "exp": exp}, settings.jwt_secret,
                      algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Devuelve los claims o None si el token es inválido o expiró."""
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM],
                          options={"require": ["exp", "sub", "iat"]})
    except jwt.PyJWTError:
        return None
