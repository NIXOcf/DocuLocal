from psycopg import errors as pg_errors

from app.repositories import db

_COLUMNS = (
    "d.id, d.original_name, d.stored_name, d.mime_type, d.size_bytes, d.access_level, d.department, "
    "d.status, d.error_message, d.page_count, d.chunk_count, d.created_at"
)


class DuplicateChecksum(Exception):
    pass


def visibility_clause(alias: str = "d") -> str:
    """Fragmento SQL de la regla de acceso (docs/diseño §4): nivel y departamento, y solo documentos Indexados.

    Parámetros nombrados requeridos: %(user_level)s y %(user_department)s (ver `visibility_params`).
    La recuperación vectorial y de texto (fase 2) debe incluirlo en su WHERE, uniendo chunks con
    documents bajo el alias dado, para que el LLM nunca reciba fragmentos no autorizados.
    """
    return (
        f"({alias}.status = 'Indexado' AND {alias}.access_level <= %(user_level)s "
        f"AND ({alias}.department IS NULL OR {alias}.department = %(user_department)s))"
    )


def visibility_params(access_level: int, department: str | None) -> dict:
    return {"user_level": access_level, "user_department": department}


def get_by_id(document_id: str) -> dict | None:
    with db.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM documents d WHERE d.id = %s", (document_id,))
        return cur.fetchone()


def get_visible(document_id: str, access_level: int, department: str | None) -> dict | None:
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_COLUMNS} FROM documents d WHERE d.id = %(id)s AND {visibility_clause()}",
            {"id": document_id, **visibility_params(access_level, department)},
        )
        return cur.fetchone()


def list_documents(*, viewer: tuple[int, str | None] | None, status: str | None, level: int | None,
                   q: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    """viewer=None: administrador (ve todo). Si no, (nivel, departamento) del empleado."""
    params: dict = {"status": status, "level": level, "p": f"%{q}%" if q else None, "l": limit, "o": offset}
    where = [
        "(%(status)s::text IS NULL OR d.status = %(status)s)",
        "(%(level)s::int IS NULL OR d.access_level = %(level)s)",
        "(%(p)s::text IS NULL OR d.original_name ILIKE %(p)s)",
    ]
    if viewer is not None:
        where.append(visibility_clause())
        params.update(visibility_params(*viewer))
    clause = "WHERE " + " AND ".join(where)
    with db.cursor() as cur:
        cur.execute(f"SELECT count(*) AS n FROM documents d {clause}", params)
        total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT {_COLUMNS} FROM documents d {clause} ORDER BY d.created_at DESC LIMIT %(l)s OFFSET %(o)s",
            params,
        )
        return cur.fetchall(), total


def create(*, original_name: str, stored_name: str, mime_type: str, size_bytes: int, checksum: str,
           access_level: int, department: str | None, uploaded_by: str) -> dict:
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (original_name, stored_name, mime_type, size_bytes, checksum, "
                "access_level, department, uploaded_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                "RETURNING id",
                (original_name, stored_name, mime_type, size_bytes, checksum, access_level, department, uploaded_by),
            )
            new_id = cur.fetchone()["id"]
    except pg_errors.UniqueViolation as exc:
        raise DuplicateChecksum from exc
    return get_by_id(str(new_id))


def update_access(document_id: str, fields: dict) -> dict | None:
    assert fields and set(fields) <= {"access_level", "department"}
    sets = ", ".join(f"{col} = %({col})s" for col in fields)
    with db.cursor() as cur:
        cur.execute(
            f"UPDATE documents SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING id",
            {**fields, "id": document_id},
        )
        if cur.fetchone() is None:
            return None
    return get_by_id(document_id)


def mark_indexed(document_id: str, page_count: int | None, chunk_count: int) -> None:
    with db.cursor() as cur:
        cur.execute(
            "UPDATE documents SET status = 'Indexado', error_message = NULL, page_count = %s, "
            "chunk_count = %s, updated_at = now() WHERE id = %s",
            (page_count, chunk_count, document_id),
        )


def mark_error(document_id: str, message: str) -> None:
    with db.cursor() as cur:
        cur.execute(
            "UPDATE documents SET status = 'Error', error_message = %s, updated_at = now() WHERE id = %s",
            (message, document_id),
        )


def delete(document_id: str) -> bool:
    with db.cursor() as cur:
        cur.execute("DELETE FROM documents WHERE id = %s", (document_id,))
        return cur.rowcount > 0
