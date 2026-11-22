from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import AccessLevel, CamelInput, CamelModel, Role


class UserOut(CamelModel):
    id: UUID
    email: str
    display_name: str
    role: Role
    access_level: AccessLevel
    department: str | None
    is_active: bool
    created_at: datetime


MAX_PASSWORD_BYTES = 72  # límite de bcrypt: más largo daría un error 500 al hashear


def _check_password_bytes(v: str | None) -> str | None:
    if v is not None and len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"La contraseña no puede superar {MAX_PASSWORD_BYTES} bytes en UTF-8.")
    return v


class UserCreate(CamelInput):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    role: Role = "employee"
    access_level: AccessLevel = "General"
    department: str | None = Field(default=None, max_length=80)

    _password_bytes = field_validator("password")(_check_password_bytes)


class UserUpdate(CamelInput):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    access_level: AccessLevel | None = None
    department: str | None = Field(default=None, max_length=80)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

    _password_bytes = field_validator("password")(_check_password_bytes)


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
