"""Datos de demostración (idempotente). Uso, desde la raíz del repo:
    backend/.venv/Scripts/python backend/scripts/seed.py
"""
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import ROOT_DIR  # noqa: E402
from app.core.errors import Conflict  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.repositories import db, document_repository, user_repository  # noqa: E402
from app.services import document_service  # noqa: E402
from app.services.rag.ingestion import index_document  # noqa: E402

DEMO_PASSWORD = "DocuLocal2026!"
USERS = [  # email, nombre, rol, nivel, departamento
    ("admin@aguanube.cl", "Administrador AguaNube", "admin", 3, "Gerencia"),
    ("trabajador@aguanube.cl", "Trabajador AguaNube", "employee", 1, "General"),
    ("jefe@aguanube.cl", "Jefatura AguaNube", "employee", 2, "Jefatura"),
    ("gerente@aguanube.cl", "Gerencia AguaNube", "employee", 3, "Gerencia"),
]
LEVELS = {  # prefijo numérico del PDF -> nivel de acceso
    **dict.fromkeys(["01", "07", "08", "11", "12", "13", "19", "20"], "General"),
    **dict.fromkeys(["02", "06", "14", "15", "16", "17"], "Jefatura"),
    **dict.fromkeys(["03b", "05", "09", "10", "18"], "Gerencia"),
}
PDF_DIR = ROOT_DIR / "Docs" / "prueba"


def seed_users() -> dict:
    admin = None
    for email, name, role, level, dept in USERS:
        row = user_repository.get_by_email(email)
        if row is None:
            row = user_repository.create(email, hash_password(DEMO_PASSWORD), name, role, level, dept)
            print(f"  usuario creado: {email}")
        else:
            print(f"  usuario existente: {email}")
        if role == "admin":
            admin = row
    return admin


def seed_documents(admin: dict) -> None:
    existing = {d["original_name"] for d in document_repository.list_documents(
        viewer=None, status=None, level=None, q=None, limit=100, offset=0)[0]}
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        level = LEVELS.get(pdf.name.split("_")[0])
        if level is None or pdf.name in existing:
            print(f"  omitido: {pdf.name}")
            continue
        start = time.time()
        try:
            doc = document_service.upload(
                admin, io.BytesIO(pdf.read_bytes()), pdf.name, level, None,
                lambda fn, *args: None)  # la indexación se hace abajo, de forma sincrónica
        except Conflict:
            print(f"  ya existe (mismo contenido): {pdf.name}")
            continue
        index_document(str(doc.id))  # sincrónico para ver el progreso
        row = document_repository.get_by_id(str(doc.id))
        print(f"  {pdf.name} [{level}] -> {row['status']}, {row['chunk_count']} fragmentos ({time.time() - start:.1f}s)")


if __name__ == "__main__":
    db.open_pool()
    try:
        print("Usuarios:")
        seed_documents(seed_users())
    finally:
        db.close_pool()
    print(f"Listo. Contraseña demo: {DEMO_PASSWORD}")
