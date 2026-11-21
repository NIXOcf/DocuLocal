from app.repositories import db
from app.repositories.document_repository import visibility_clause, visibility_params

UNAVAILABLE_NAME = "Documento no disponible"

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


# Fuentes guardadas: el nombre y el extracto reales solo salen si el usuario ve HOY el documento (mismo criterio que
# la recuperación); si perdió el acceso o el documento ya no existe, se enmascaran en la propia consulta.
_SOURCES_SQL = f"""
SELECT message_id, ref_number, score, visible,
       CASE WHEN visible THEN chunk_id END AS chunk_id,
       CASE WHEN visible THEN document_id END AS document_id,
       CASE WHEN visible THEN page END AS page,
       CASE WHEN visible THEN filename ELSE '{UNAVAILABLE_NAME}' END AS filename,
       CASE WHEN visible THEN snippet ELSE '' END AS snippet
FROM (
  SELECT s.message_id, s.ref_number, s.score, s.chunk_id, s.document_id, s.page, s.filename, s.snippet,
         COALESCE(d.id IS NOT NULL AND {visibility_clause("d")}, false) AS visible
  FROM message_sources s
  JOIN messages m ON m.id = s.message_id
  LEFT JOIN documents d ON d.id = s.document_id
  WHERE {{where}}
) t ORDER BY ref_number
"""


def list_by_conversation(conversation_id: str, access_level: int, department: str | None) -> list[dict]:
    """Mensajes en orden cronológico; cada uno trae su lista `sources` (vacía si no tiene)."""
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM messages WHERE conversation_id = %s ORDER BY created_at, id",
                    (conversation_id,))
        messages = cur.fetchall()
        cur.execute(_SOURCES_SQL.format(where="m.conversation_id = %(conv)s"),
                    {"conv": conversation_id, **visibility_params(access_level, department)})
        sources = cur.fetchall()
    by_message: dict = {}
    for s in sources:
        by_message.setdefault(s["message_id"], []).append(s)
    for m in messages:
        m["sources"] = by_message.get(m["id"], [])
    return messages


def recent(conversation_id: str, limit: int, access_level: int, department: str | None) -> list[dict]:
    """Últimos `limit` mensajes en orden cronológico (solo rol y contenido) para enviar al LLM.

    Excluye las respuestas del asistente con alguna fuente que el usuario ya no puede ver: su texto podría
    contener información restringida.
    """
    with db.cursor() as cur:
        cur.execute(
            "SELECT role, content FROM (SELECT m.role, m.content, m.created_at, m.id FROM messages m "
            "WHERE m.conversation_id = %(conv)s AND NOT (m.role = 'assistant' AND EXISTS ("
            "  SELECT 1 FROM message_sources s LEFT JOIN documents d ON d.id = s.document_id "
            f"  WHERE s.message_id = m.id AND NOT COALESCE(d.id IS NOT NULL AND {visibility_clause('d')}, false))) "
            "ORDER BY m.created_at DESC, m.id DESC LIMIT %(lim)s) t ORDER BY created_at, id",
            {"conv": conversation_id, "lim": limit, **visibility_params(access_level, department)},
        )
        return cur.fetchall()


def get_in_conversation(message_id: str, conversation_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM messages WHERE id = %s AND conversation_id = %s",
                    (message_id, conversation_id))
        return cur.fetchone()


def set_feedback(message_id: str, feedback: str | None, access_level: int, department: str | None) -> dict:
    with db.cursor() as cur:
        cur.execute(f"UPDATE messages SET feedback = %s WHERE id = %s RETURNING {_COLUMNS}", (feedback, message_id))
        row = cur.fetchone()
    row["sources"] = get_sources(message_id, access_level, department)
    return row


def get_sources(message_id: str, access_level: int, department: str | None) -> list[dict]:
    with db.cursor() as cur:
        cur.execute(_SOURCES_SQL.format(where="s.message_id = %(msg)s"),
                    {"msg": message_id, **visibility_params(access_level, department)})
        return cur.fetchall()
