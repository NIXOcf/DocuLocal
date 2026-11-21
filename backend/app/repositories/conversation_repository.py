from app.repositories import db

_COLUMNS = "id, title, created_at, updated_at"


def count_by_user(user_id: str) -> int:
    with db.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM conversations WHERE user_id = %s", (user_id,))
        return cur.fetchone()["n"]


def list_by_user(user_id: str, limit: int, offset: int) -> tuple[list[dict], int]:
    with db.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM conversations WHERE user_id = %s", (user_id,))
        total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT {_COLUMNS} FROM conversations WHERE user_id = %s ORDER BY updated_at DESC LIMIT %s OFFSET %s",
            (user_id, limit, offset),
        )
        return cur.fetchall(), total


def create(user_id: str, title: str) -> dict:
    with db.cursor() as cur:
        cur.execute(
            f"INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING {_COLUMNS}", (user_id, title)
        )
        return cur.fetchone()


def get_owned(conversation_id: str, user_id: str) -> dict | None:
    """Solo devuelve la conversación si pertenece al usuario (ajena o inexistente => None)."""
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_COLUMNS} FROM conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id)
        )
        return cur.fetchone()


def update_title(conversation_id: str, title: str) -> dict:
    with db.cursor() as cur:
        cur.execute(
            f"UPDATE conversations SET title = %s, updated_at = now() WHERE id = %s RETURNING {_COLUMNS}",
            (title, conversation_id),
        )
        return cur.fetchone()


def touch(conversation_id: str, title: str | None = None) -> None:
    with db.cursor() as cur:
        cur.execute(
            "UPDATE conversations SET updated_at = now(), title = COALESCE(%s, title) WHERE id = %s",
            (title, conversation_id),
        )


def delete(conversation_id: str) -> None:
    with db.cursor() as cur:
        cur.execute("DELETE FROM conversations WHERE id = %s", (conversation_id,))
