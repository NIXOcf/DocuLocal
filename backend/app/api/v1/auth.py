from fastapi import APIRouter

from app.core.deps import CurrentUser
from app.schemas.user import LoginIn, LoginOut, UserOut
from app.services import auth_service
from app.services.user_service import to_user_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn):
    return auth_service.login(body.email, body.password)


@router.get("/me", response_model=UserOut, response_model_by_alias=True)
def me(user: CurrentUser):
    return to_user_out(user)
