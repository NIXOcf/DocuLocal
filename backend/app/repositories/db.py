import logging
from contextlib import contextmanager
from typing import Iterator

from pgvector.psycopg import register_vector
from psycopg import Cursor
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

logger = logging.getLogger("doculocal.bd")
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
    try:
        _pool.open(wait=True, timeout=10)
    except Exception as exc:
        s = get_settings()
        logger.error("No se pudo conectar a PostgreSQL en %s:%s (%s): ¿Docker apagado? Ejecuta "
                     "'docker compose up -d db' y revisa POSTGRES_PORT en .env", s.postgres_host, s.postgres_port,
                     type(exc).__name__)
        raise
    logger.info("Pool de conexiones abierto")


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


def like_contains(text: str) -> str:
    r"""Patrón `%texto%` con %, _ y \ escapados; usar con ILIKE ... ESCAPE '\'."""
    escaped = text.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"
