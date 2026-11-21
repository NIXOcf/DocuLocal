from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.core.deps import AdminUser
from app.schemas.common import Page
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserOut])
def list_users(_: AdminUser, pagina: Annotated[int, Query(ge=1, le=10000)] = 1,
               tamano: Annotated[int, Query(ge=1, le=100)] = 20, q: Annotated[str | None, Query(max_length=100)] = None):
    return user_service.list_users(q, pagina, tamano)


@router.post("", response_model=UserOut, status_code=201)
def create_user(admin: AdminUser, body: UserCreate, response: Response):
    user = user_service.create_user(admin, body)
    response.headers["Location"] = f"/api/v1/users/{user.id}"
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(_: AdminUser, user_id: UUID):
    return user_service.get_user(str(user_id))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(admin: AdminUser, user_id: UUID, body: UserUpdate):
    return user_service.update_user(admin, str(user_id), body)


@router.delete("/{user_id}", status_code=204)
def delete_user(admin: AdminUser, user_id: UUID):
    user_service.delete_user(admin, str(user_id))
    return Response(status_code=204)
