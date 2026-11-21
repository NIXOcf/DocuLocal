import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import Conflict, NotFound, register_error_handlers
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.services.access import level_to_int, level_to_name
from app.services.document_service import format_size
from app.services.rag.chunking import MIN_CHARS, chunk_pages, split_text
from app.services.rag.parsing import normalize


def test_access_level_mapping_roundtrip():
    assert [level_to_int(n) for n in ("General", "Jefatura", "Gerencia")] == [1, 2, 3]
    assert [level_to_name(i) for i in (1, 2, 3)] == ["General", "Jefatura", "Gerencia"]
    with pytest.raises(ValueError):
        level_to_int("Otro")


def test_chunking_overlap_and_size():
    text = " ".join(f"Palabra{i}" for i in range(600))
    parts = split_text(text)
    assert len(parts) > 1
    assert all(len(p) <= 900 for p in parts)
    # el final de un chunk reaparece al inicio del siguiente (solape)
    tail = parts[0][-60:]
    assert tail in parts[1]


def test_chunking_keeps_page_and_drops_short():
    long_text = "Esta es una oración suficientemente larga para ser un chunk válido. " * 3
    chunks = chunk_pages([(1, "corto"), (2, long_text), (None, long_text)])
    assert [c.page for c in chunks] == [2, None]
    assert [c.index for c in chunks] == [0, 1]
    assert all(len(c.content) >= MIN_CHARS for c in chunks)


def test_normalize_hyphen_and_spaces():
    assert normalize("conta-\nbilidad   anual\t2026") == "contabilidad anual 2026"


def test_format_size():
    assert format_size(856 * 1024) == "856 KB"
    assert format_size(int(2.4 * 1024 * 1024)) == "2.4 MB"


def test_password_hash_and_verify():
    h = hash_password("secreta123")
    assert h != "secreta123"
    assert verify_password("secreta123", h)
    assert not verify_password("otra", h)
    assert not verify_password("x", "no-es-un-hash")


def test_jwt_roundtrip_and_tamper():
    token = create_access_token("abc", "admin")
    claims = decode_access_token(token)
    assert claims["sub"] == "abc" and claims["role"] == "admin"
    assert decode_access_token(token + "x") is None


class _Body(BaseModel):
    n: int


def _client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/nf")
    def nf():
        raise NotFound("No está.", "demo_no_encontrado")

    @app.get("/conflict")
    def conflict():
        raise Conflict(detalle={"campo": "email"})

    @app.get("/boom")
    def boom():
        raise RuntimeError("secreto interno")

    @app.post("/val")
    def val(body: _Body):
        return body

    return TestClient(app, raise_server_exceptions=False)


def test_error_format_app_error():
    r = _client().get("/nf")
    assert r.status_code == 404
    body = r.json()
    assert set(body) == {"error", "mensaje", "detalle", "ref"}
    assert body["error"] == "demo_no_encontrado" and re.fullmatch(r"err_[0-9a-f]{6}", body["ref"])
    assert _client().get("/conflict").json()["detalle"] == {"campo": "email"}


def test_error_format_validation_unknown_route_and_unhandled():
    c = _client()
    r = c.post("/val", json={"n": "x"})
    assert r.status_code == 422 and r.json()["error"] == "validacion_fallida"
    assert "n" in r.json()["detalle"]["campos"]
    assert c.get("/no-existe").status_code == 404
    r = c.get("/boom")
    assert r.status_code == 500 and "secreto" not in r.text
