import re

from app.repositories import db
from app.repositories.document_repository import visibility_clause, visibility_params


def insert_batch(document_id: str, rows: list[tuple[int, int | None, str, list[float]]]) -> None:
    """rows: (chunk_index, page, content, embedding). Todo en una transacción."""
    with db.cursor() as cur:
        cur.executemany(
            "INSERT INTO chunks (document_id, chunk_index, page, content, embedding) VALUES (%s, %s, %s, %s, %s)",
            [(document_id, idx, page, content, emb) for idx, page, content, emb in rows],
        )


def delete_by_document(document_id: str) -> None:
    with db.cursor() as cur:
        cur.execute("DELETE FROM chunks WHERE document_id = %s", (document_id,))


def get_visible(chunk_id: str, access_level: int, department: str | None) -> dict | None:
    """Fragmento con su documento, solo si el usuario puede verlo (misma regla que la recuperación)."""
    with db.cursor() as cur:
        cur.execute(
            "SELECT c.id, c.document_id, d.original_name AS filename, c.page, c.content "
            f"FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.id = %(id)s AND {visibility_clause()}",
            {"id": chunk_id, **visibility_params(access_level, department)},
        )
        return cur.fetchone()


# Columnas comunes de la recuperación. Toda búsqueda une chunks con documents y filtra por
# visibility_clause() en el WHERE: el filtrado ocurre en SQL, antes de que el LLM vea nada.
_SEARCH_COLUMNS = "c.id, c.document_id, c.chunk_index, c.page, c.content, d.original_name AS filename"


def search_vector(embedding, k: int, user_level: int, user_department: str | None) -> list[dict]:
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_SEARCH_COLUMNS} FROM chunks c JOIN documents d ON d.id = c.document_id "
            f"WHERE {visibility_clause()} ORDER BY c.embedding <=> %(emb)s LIMIT %(k)s",
            {"emb": embedding, "k": k, **visibility_params(user_level, user_department)},
        )
        return cur.fetchall()


def _search_tsquery(tsquery_fn: str, query: str, k: int, user_level: int, user_department: str | None) -> list[dict]:
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_SEARCH_COLUMNS} FROM chunks c JOIN documents d ON d.id = c.document_id, "
            f"{tsquery_fn}('spanish', %(q)s) AS tq "
            f"WHERE c.tsv @@ tq AND {visibility_clause()} ORDER BY ts_rank_cd(c.tsv, tq) DESC LIMIT %(k)s",
            {"q": query, "k": k, **visibility_params(user_level, user_department)},
        )
        return cur.fetchall()


def search_text(query: str, k: int, user_level: int, user_department: str | None) -> list[dict]:
    """Texto completo en español: websearch_to_tsquery y, si no hay coincidencias, OR de palabras."""
    rows = _search_tsquery("websearch_to_tsquery", query, k, user_level, user_department)
    if rows:
        return rows
    words = sorted({w for w in re.findall(r"[^\W_]+", query.lower()) if len(w) > 2})
    if not words:
        return []
    return _search_tsquery("to_tsquery", " | ".join(words), k, user_level, user_department)


def get_neighbors(document_id: str, chunk_index: int, user_level: int, user_department: str | None) -> list[dict]:
    """Fragmentos contiguos (índice ±1) del mismo documento, con la misma regla de visibilidad."""
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_SEARCH_COLUMNS} FROM chunks c JOIN documents d ON d.id = c.document_id "
            f"WHERE c.document_id = %(doc)s AND c.chunk_index IN (%(i)s - 1, %(i)s + 1) AND {visibility_clause()} "
            "ORDER BY c.chunk_index",
            {"doc": document_id, "i": chunk_index, **visibility_params(user_level, user_department)},
        )
        return cur.fetchall()
