"""Condensación de la pregunta con el historial y planificación de la búsqueda (modelo rápido)."""
import json
import logging
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.services.rag.llm_client import llm

logger = logging.getLogger("doculocal")

TIPOS = ("documental", "saludo", "fuera_de_alcance")
MAX_SUBQUERIES = 4
HISTORY_WINDOW = 6

CONDENSE_PROMPT = (
    "Reescribe la última pregunta del usuario como una pregunta autónoma en español, que se entienda sin el "
    "historial (resuelve pronombres y referencias como 'eso', 'y cuántos son'). No respondas la pregunta ni "
    "agregues datos. Devuelve solo la pregunta reescrita."
)

PLAN_PROMPT = """Eres el planificador de búsqueda de un asistente interno de empresa que responde sobre sus documentos \
(contratos, políticas, manuales, planes, estatutos, presupuestos). Analiza la pregunta y responde SOLO un JSON:
{"tipo": "documental" | "saludo" | "fuera_de_alcance", "pregunta_busqueda": "string", "subconsultas": [strings], "palabras_clave": "string"}

Reglas:
- tipo "saludo": solo saludos, agradecimientos o preguntas sobre qué puede hacer el asistente.
- tipo "fuera_de_alcance": temas ajenos a la empresa (clima, deportes, programación, cultura general).
- tipo "documental": cualquier pregunta que podría responderse con documentos de la empresa. Ante la duda, elige "documental".
- pregunta_busqueda: la pregunta completa reescrita en forma impersonal o en tercera persona y con vocabulario documental, sin "yo/me/mi" (ej. "¿Cuántos días de vacaciones tengo?" -> "¿Cuántos días de feriado anual o vacaciones corresponden a los trabajadores?"; "¿Cuánto gano?" -> "¿Cuál es la remuneración del trabajador según el contrato?").
- subconsultas: de 1 a 4 búsquedas en español. Si la pregunta es vaga o corta, expándela con sinónimos y \
reformulaciones del dominio laboral y empresarial (ej. "si me enfermo" -> licencia médica, ausencia por enfermedad, \
permisos y reposo). Si es compleja o comparativa, descomponla en subpreguntas atómicas, una por aspecto. Si es \
simple, usa solo 1.
- palabras_clave: 3 a 8 términos clave de búsqueda separados por espacio (sin signos).
"""


@dataclass
class QueryPlan:
    tipo: str = "documental"
    subqueries: list[str] = field(default_factory=list)
    keywords: str = ""
    search_question: str = ""  # pregunta impersonal con vocabulario documental; se usa para rerankear


def _history_text(history: list[dict]) -> str:
    return "\n".join(f"{'Usuario' if m['role'] == 'user' else 'Asistente'}: {m['content'][:500]}"
                     for m in history[-HISTORY_WINDOW:])


def condense(question: str, history: list[dict]) -> str:
    if not history:
        return question
    user = f"Historial:\n{_history_text(history)}\n\nÚltima pregunta: {question}"
    out = llm.chat([{"role": "system", "content": CONDENSE_PROMPT}, {"role": "user", "content": user}],
                   get_settings().llm_fast_model, temperature=0, max_tokens=300).strip()
    return out or question


def parse_plan(raw: str, question: str) -> QueryPlan:
    """Valida y sanea el JSON del modelo; ante cualquier problema, plan documental con la pregunta tal cual."""
    fallback = QueryPlan("documental", [question], "", question)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return fallback
        tipo = data.get("tipo") if data.get("tipo") in TIPOS else "documental"
        subs = data.get("subconsultas")
        subs = [s.strip() for s in subs if isinstance(s, str) and s.strip()] if isinstance(subs, list) else []
        keywords = data.get("palabras_clave")
        keywords = keywords.strip() if isinstance(keywords, str) else ""
        search_q = data.get("pregunta_busqueda")
        search_q = search_q.strip() if isinstance(search_q, str) and search_q.strip() else question
        return QueryPlan(tipo, subs[:MAX_SUBQUERIES] or [question], keywords, search_q)
    except (ValueError, TypeError):
        return fallback


def plan(question: str) -> QueryPlan:
    try:
        raw = llm.chat([{"role": "system", "content": PLAN_PROMPT}, {"role": "user", "content": question}],
                       get_settings().llm_fast_model, temperature=0, json_mode=True, max_tokens=600)
    except Exception:  # sin planificador igual se puede buscar con la pregunta original
        logger.warning("Planificador no disponible; se usa la pregunta tal cual")
        return QueryPlan("documental", [question], "", question)
    return parse_plan(raw, question)
