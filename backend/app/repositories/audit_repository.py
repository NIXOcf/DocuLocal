from psycopg.types.json import Jsonb

from app.repositories import db


def insert(user_id: str | None, action: str, resource: str, resource_id: str | None, detail: dict) -> None:
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO audit_log (user_id, action, resource, resource_id, detail) VALUES (%s, %s, %s, %s, %s)",
            (user_id, action, resource, resource_id, Jsonb(detail)),
        )
