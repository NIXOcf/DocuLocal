from app.repositories import db

_COLUMNS = "id, conversation_id, role, content, feedback, grounded, created_at"


def count(conversation_id: str) -> int:
    with db.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM messages WHERE conversation_id = %s", (conversation_id,))
        return cur.fetchone()["n"]


def insert(conversation_id: str, role: str, content: str, grounded: bool | None = None) -> dict:
    with db.cursor() as cur:
        cur.execute(
            f"INSERT INTO messages (conversation_id, role, content, grounded) VALUES (%s, %s, %s, %s) "
            f"RETURNING {_COLUMNS}",
            (conversation_id, role, content, grounded),
        )
        return cur.fetchone()


def insert_sources(message_id: str, rows: list[dict]) -> None:
    """rows: ref_number, chunk_id, document_id, filename, page, score, snippet."""
    if not rows:
        return
    with db.cursor() as cur:
        cur.executemany(
            "INSERT INTO message_sources (message_id, ref_number, chunk_id, document_id, filename, page, score, "
            "snippet) VALUES (%(message_id)s, %(ref_number)s, %(chunk_id)s, %(document_id)s, %(filename)s, "
            "%(page)s, %(score)s, %(snippet)s)",
            [{**r, "message_id": message_id} for r in rows],
        )


def list_by_conversation(conversation_id: str) -> list[dict]:
    """Mensajes en orden cronológico; cada uno trae su lista `sources` (vacía si no tiene)."""
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM messages WHERE conversation_id = %s ORDER BY created_at, id",
                    (conversation_id,))
        messages = cur.fetchall()
        cur.execute(
            "SELECT s.message_id, s.ref_number, s.chunk_id, s.document_id, s.filename, s.page, s.score, s.snippet "
            "FROM message_sources s JOIN messages m ON m.id = s.message_id "
            "WHERE m.conversation_id = %s ORDER BY s.ref_number",
            (conversation_id,),
        )
        sources = cur.fetchall()
    by_message: dict = {}
    for s in sources:
        by_message.setdefault(s["message_id"], []).append(s)
    for m in messages:
        m["sources"] = by_message.get(m["id"], [])
    return messages


def recent(conversation_id: str, limit: int) -> list[dict]:
    """Últimos `limit` mensajes en orden cronológico (solo rol y contenido)."""
    with db.cursor() as cur:
        cur.execute(
            "SELECT role, content FROM (SELECT role, content, created_at, id FROM messages "
            "WHERE conversation_id = %s ORDER BY created_at DESC, id DESC LIMIT %s) t ORDER BY created_at, id",
            (conversation_id, limit),
        )
        return cur.fetchall()


def get_in_conversation(message_id: str, conversation_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM messages WHERE id = %s AND conversation_id = %s",
                    (message_id, conversation_id))
        return cur.fetchone()


def set_feedback(message_id: str, feedback: str | None) -> dict:
    with db.cursor() as cur:
        cur.execute(f"UPDATE messages SET feedback = %s WHERE id = %s RETURNING {_COLUMNS}", (feedback, message_id))
        row = cur.fetchone()
    row["sources"] = get_sources(message_id)
    return row


def get_sources(message_id: str) -> list[dict]:
    with db.cursor() as cur:
        cur.execute(
            "SELECT message_id, ref_number, chunk_id, document_id, filename, page, score, snippet "
            "FROM message_sources WHERE message_id = %s ORDER BY ref_number", (message_id,))
        return cur.fetchall()
