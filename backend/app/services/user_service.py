from datetime import datetime, timezone

from app.core.errors import Conflict, NotFound
from app.core.security import hash_password
from app.repositories import user_repository
from app.schemas.common import make_page
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import audit_service
from app.services.access import level_to_int, level_to_name


def to_user_out(row: dict) -> UserOut:
    return UserOut(**{**row, "access_level": level_to_name(row["access_level"])})


def list_users(q: str | None, pagina: int, tamano: int) -> dict:
    rows, total = user_repository.list_users(q, tamano, (pagina - 1) * tamano)
    return make_page([to_user_out(r) for r in rows], total, pagina, tamano)


def get_user(user_id: str) -> UserOut:
    row = user_repository.get_by_id(user_id)
    if row is None:
        raise NotFound("El usuario no existe.", "usuario_no_encontrado")
    return to_user_out(row)


def create_user(actor: dict, data: UserCreate) -> UserOut:
    try:
        row = user_repository.create(
            data.email, hash_password(data.password), data.display_name, data.role,
            level_to_int(data.access_level), data.department,
        )
    except user_repository.DuplicateEmail:
        raise Conflict("Ya existe un usuario con ese correo.", "email_duplicado") from None
    audit_service.record(str(actor["id"]), "user.create", "user", str(row["id"]))
    return to_user_out(row)


def update_user(actor: dict, user_id: str, data: UserUpdate) -> UserOut:
    fields = data.model_dump(exclude_unset=True)
    if str(actor["id"]) == user_id and (fields.get("role") not in (None, "admin") or fields.get("is_active") is False):
        raise Conflict("No puedes quitarte el rol de administrador ni desactivarte a ti mismo.",
                       "no_puedes_degradarte")
    if "password" in fields:
        password = fields.pop("password")
        if password is not None:
            fields["password_hash"] = hash_password(password)
            fields["password_changed_at"] = datetime.now(timezone.utc)  # invalida los tokens anteriores
    if "access_level" in fields and fields["access_level"] is not None:
        fields["access_level"] = level_to_int(fields["access_level"])
    # Campos obligatorios no aceptan null explícito; department sí (limpiarlo).
    fields = {k: v for k, v in fields.items() if v is not None or k == "department"}
    if not fields:
        return get_user(user_id)
    row = user_repository.update(user_id, fields)
    if row is None:
        raise NotFound("El usuario no existe.", "usuario_no_encontrado")
    audit_service.record(str(actor["id"]), "user.update", "user", user_id)
    return to_user_out(row)


def delete_user(actor: dict, user_id: str) -> None:
    if str(actor["id"]) == user_id:
        raise Conflict("No puedes eliminar tu propio usuario.", "no_puedes_eliminarte")
    if not user_repository.delete(user_id):
        raise NotFound("El usuario no existe.", "usuario_no_encontrado")
    audit_service.record(str(actor["id"]), "user.delete", "user", user_id)
