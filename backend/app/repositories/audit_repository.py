from app.repositories import db


def insert(user_id: str | None, action: str, resource: str, resource_id: str | None) -> None:
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO audit_log (user_id, action, resource, resource_id) VALUES (%s, %s, %s, %s)",
            (user_id, action, resource, resource_id),
        )


def purge_older_than(days: int) -> int:
    with db.cursor() as cur:
        cur.execute("DELETE FROM audit_log WHERE created_at < now() - make_interval(days => %s)", (days,))
        return cur.rowcount
