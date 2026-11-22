from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import Forbidden
from app.core.logging import set_user_id
from app.services import auth_service

_bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> dict:
    user = auth_service.get_active_user(creds.credentials if creds else None)
    set_user_id(str(user["id"]))
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> dict:
    if user["role"] != "admin":
        raise Forbidden("Esta acción requiere rol de administrador.", "requiere_admin")
    return user


AdminUser = Annotated[dict, Depends(require_admin)]
