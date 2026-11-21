from psycopg import errors as pg_errors

from app.repositories import db

_COLUMNS = "id, email, password_hash, display_name, role, access_level, department, is_active, created_at"


class DuplicateEmail(Exception):
    pass


def get_by_id(user_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM users WHERE id = %s", (user_id,))
        return cur.fetchone()


def get_by_email(email: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM users WHERE email = %s", (email,))
        return cur.fetchone()


def list_users(q: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    pattern = f"%{q}%" if q else None
    where = "WHERE (%(p)s::text IS NULL OR email ILIKE %(p)s OR display_name ILIKE %(p)s)"
    with db.cursor() as cur:
        cur.execute(f"SELECT count(*) AS n FROM users {where}", {"p": pattern})
        total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT {_COLUMNS} FROM users {where} ORDER BY created_at DESC LIMIT %(l)s OFFSET %(o)s",
            {"p": pattern, "l": limit, "o": offset},
        )
        return cur.fetchall(), total


def create(email: str, password_hash: str, display_name: str, role: str, access_level: int,
           department: str | None) -> dict:
    try:
        with db.cursor() as cur:
            cur.execute(
                f"INSERT INTO users (email, password_hash, display_name, role, access_level, department) "
                f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING {_COLUMNS}",
                (email, password_hash, display_name, role, access_level, department),
            )
            return cur.fetchone()
    except pg_errors.UniqueViolation as exc:
        raise DuplicateEmail from exc


# Columnas que PATCH puede modificar (lista blanca; los nombres nunca vienen del cliente).
_UPDATABLE = {"display_name", "role", "access_level", "department", "is_active", "password_hash"}


def update(user_id: str, fields: dict) -> dict | None:
    assert fields and set(fields) <= _UPDATABLE
    sets = ", ".join(f"{col} = %({col})s" for col in fields)
    with db.cursor() as cur:
        cur.execute(
            f"UPDATE users SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING {_COLUMNS}",
            {**fields, "id": user_id},
        )
        return cur.fetchone()


def delete(user_id: str) -> bool:
    with db.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        return cur.rowcount > 0
