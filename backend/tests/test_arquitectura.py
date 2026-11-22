"""Reglas de capas (api -> services -> repositories), verificadas con ast sin importar la app."""
import ast
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"
PROHIBIDOS = {"api": {"app.repositories", "psycopg"}, "services": {"fastapi", "starlette", "psycopg", "app.api"},
              "repositories": {"app.services", "app.api"}}


def _imports(tree):
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            yield from ((a.name, n.lineno) for a in n.names)
        elif isinstance(n, ast.ImportFrom) and n.level == 0 and n.module:
            yield n.module, n.lineno
            yield from ((f"{n.module}.{a.name}", n.lineno) for a in n.names)


def test_capas_respetan_dependencias():
    fallos = [f"{p.relative_to(APP)}:{ln} importa {mod}" for capa, malos in PROHIBIDOS.items()
              for p in (APP / capa).rglob("*.py") for mod, ln in _imports(ast.parse(p.read_text(encoding="utf-8")))
              if any(mod == m or mod.startswith(m + ".") for m in malos)]
    assert not fallos, "Violaciones de capas:\n" + "\n".join(fallos)
