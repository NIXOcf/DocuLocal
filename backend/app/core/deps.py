from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.repositories import user_repository

_bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> dict:
    claims = decode_access_token(creds.credentials) if creds else None
    if claims is None:
        raise Unauthorized("Sesión inválida o expirada.", "token_invalido")
    user = user_repository.get_by_id(claims["sub"])
    if user is None or not user["is_active"]:
        raise Unauthorized("Sesión inválida o expirada.", "token_invalido")
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> dict:
    if user["role"] != "admin":
        raise Forbidden("Esta acción requiere rol de administrador.", "requiere_admin")
    return user


AdminUser = Annotated[dict, Depends(require_admin)]
