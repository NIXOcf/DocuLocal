"""Mapeo entre los niveles de acceso de la API (texto) y de la BD (1..3)."""
from typing import get_args

from app.schemas.common import AccessLevel

_NAMES = get_args(AccessLevel)  # ("General", "Jefatura", "Gerencia")


def level_to_int(name: str) -> int:
    return _NAMES.index(name) + 1


def level_to_name(level: int) -> str:
    return _NAMES[level - 1]
