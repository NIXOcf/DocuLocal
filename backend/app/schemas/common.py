from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

AccessLevel = Literal["General", "Jefatura", "Gerencia"]
Role = Literal["employee", "admin"]

T = TypeVar("T")


class CamelModel(BaseModel):
    """Respuestas en camelCase (el front es TypeScript); también acepta snake_case al construir."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CamelInput(CamelModel):
    """Entradas: camelCase y lista blanca estricta de campos."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Pagination(BaseModel):
    pagina: int
    tamano: int
    total: int
    paginas: int


class Page(BaseModel, Generic[T]):
    datos: list[T]
    paginacion: Pagination


def make_page(items: list, total: int, pagina: int, tamano: int) -> dict:
    return {
        "datos": items,
        "paginacion": {"pagina": pagina, "tamano": tamano, "total": total, "paginas": -(-total // tamano)},
    }
