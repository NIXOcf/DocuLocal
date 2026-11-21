"""Request id, enmascarado de correo y estado del LLM en /health (sin BD ni red)."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.logging import mask_email
from app.main import create_app
from app.services import health_service


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(health_service.db, "ping", lambda: True)
    monkeypatch.setattr(health_service, "_cache", None)
    return TestClient(create_app())  # sin `with`: no corre el lifespan (ni abre el pool)


def test_request_id_generated_respected_and_replaced(client):
    assert client.get("/api/v1/ruta-inexistente").headers["X-Request-ID"]
    ok = client.get("/api/v1/ruta-inexistente", headers={"X-Request-ID": "abc-123"})
    assert ok.headers["X-Request-ID"] == "abc-123"
    bad = client.get("/api/v1/ruta-inexistente", headers={"X-Request-ID": "x" * 65})
    assert bad.headers["X-Request-ID"] != "x" * 65
    bad = client.get("/api/v1/ruta-inexistente", headers={"X-Request-ID": "a b;c"})
    assert bad.headers["X-Request-ID"] != "a b;c"


def test_mask_email():
    assert mask_email("trabajador@aguanube.cl") == "t***@aguanube.cl"
    assert mask_email("sin-arroba") == "***"


def test_health_llm_down_still_200(client, monkeypatch):
    monkeypatch.setattr(health_service, "_probe_llm", lambda: "no_disponible")
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["llm"] == "no_disponible" and r.json()["db"] == "ok"
    assert r.json()["modo"] in ("groq", "local")


def test_health_db_down_is_503(client, monkeypatch):
    def boom():
        raise RuntimeError("sin bd")
    monkeypatch.setattr(health_service.db, "ping", boom)
    assert client.get("/api/v1/health").status_code == 503


def test_llm_mode_from_base_url():
    assert Settings(jwt_secret="x", llm_base_url="http://127.0.0.1:8081/v1").llm_mode == "local"
    assert Settings(jwt_secret="x", llm_base_url="https://api.groq.com/openai/v1").llm_mode == "groq"
