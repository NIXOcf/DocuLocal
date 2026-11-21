from contextlib import contextmanager
from typing import Iterator

from pgvector.psycopg import register_vector
from psycopg import Cursor
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

_pool: ConnectionPool | None = None


def _configure(conn) -> None:
    register_vector(conn)


def open_pool() -> None:
    global _pool
    _pool = ConnectionPool(
        get_settings().database_dsn,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
        configure=_configure,
        open=False,
    )
    _pool.open(wait=True, timeout=10)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def cursor() -> Iterator[Cursor]:
    """Cursor dentro de una transacción: commit al salir, rollback si hay excepción."""
    assert _pool is not None, "El pool de conexiones no está abierto"
    with _pool.connection() as conn, conn.cursor() as cur:
        yield cur


def ping() -> bool:
    with cursor() as cur:
        cur.execute("SELECT 1")
        return True
