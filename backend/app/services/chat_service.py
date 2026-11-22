"""Orquestador del chat: guard -> condensar -> planificar -> recuperar -> generar -> verificar citas."""
import logging
import time

from app.repositories import conversation_repository, message_repository
from app.services import audit_service
from app.services.rag import generator, query_planner, retriever
from app.services.rag.generator import NO_INFO_ANSWER
from app.services.rag.llm_client import prompt_injection_score

logger = logging.getLogger("doculocal.chat")

INJECTION_THRESHOLD = 0.9
SNIPPET_CHARS = 400
TITLE_CHARS = 60
DEFAULT_TITLE = "Nueva conversación"
HISTORY_WINDOW = 6

BLOCKED_ANSWER = ("No puedo procesar esa solicitud. Puedo ayudarte con preguntas sobre la documentación interna "
                  "de la empresa.")
GREETING_ANSWER = ("¡Hola! Soy el asistente de documentación interna. Puedo responder preguntas sobre los "
                   "documentos de la empresa a los que tienes acceso (políticas, contratos, manuales, planes) "
                   "e indicarte en qué documento y página está la información. ¿Qué necesitas saber?")
OUT_OF_SCOPE_ANSWER = ("Solo puedo responder preguntas sobre la documentación interna de la empresa. "
                       "Prueba con una consulta sobre políticas, contratos, manuales o planes.")


def _snippet(text: str) -> str:
    return text if len(text) <= SNIPPET_CHARS else text[:SNIPPET_CHARS - 1].rstrip() + "…"


def _stopwatch(stages: dict):
    """Devuelve lap(etapa): guarda en `stages` los ms desde la marca anterior."""
    last = time.perf_counter()

    def lap(name: str) -> None:
        nonlocal last
        now = time.perf_counter()
        stages[name] = round((now - last) * 1000)
        last = now
    return lap


def _compose(question: str, history: list[dict], user: dict,
             stages: dict) -> tuple[str, list[retriever.RetrievedChunk], str | None]:
    """Devuelve (texto, fuentes citadas, texto fijo si no hubo búsqueda). Las fuentes ya vienen en orden de cita."""
    lap = _stopwatch(stages)
    standalone = query_planner.condense(question, history)
    lap("condensar")
    plan = query_planner.plan(standalone)
    lap("planificar")
    stages["plan"], stages["subconsultas"] = plan.tipo, len(plan.subqueries)
    if plan.tipo == "saludo":
        return GREETING_ANSWER, [], "saludo"
    if plan.tipo == "fuera_de_alcance":
        return OUT_OF_SCOPE_ANSWER, [], "fuera_de_alcance"

    chunks = retriever.retrieve(standalone, plan, user)
    lap("recuperar")
    if not chunks:  # compuerta anti-alucinación: sin LLM y sin revelar si hay documentos restringidos
        return NO_INFO_ANSWER, [], "sin_resultados"

    text, cited = generator.generate_answer(standalone, chunks, history)
    lap("generar")
    if not cited:
        return NO_INFO_ANSWER, [], "sin_citas"
    return generator.renumber_citations(text, cited), [chunks[n - 1] for n in cited], None


def answer(user: dict, conversation_id: str, question: str) -> dict:
    started = time.perf_counter()
    user_id = str(user["id"])
    history = message_repository.recent(conversation_id, HISTORY_WINDOW, user["access_level"], user["department"])
    first_question = message_repository.count(conversation_id) == 0

    stages: dict = {}
    logger.debug("Pregunta recibida: %r", question[:120])
    t_guard = time.perf_counter()
    score = prompt_injection_score(question)
    stages["guard"] = round((time.perf_counter() - t_guard) * 1000)
    if score > INJECTION_THRESHOLD:
        text, sources, grounded = BLOCKED_ANSWER, [], False
        audit_service.record(user_id, "consulta_bloqueada", "conversation", conversation_id)
        mode = "bloqueada"
        logger.warning("Consulta bloqueada por posible inyección puntaje=%.2f", score)
    else:
        text, sources, mode = _compose(question, history, user, stages)
        grounded = mode is None and bool(sources)

    # La pregunta solo se guarda junto con su respuesta: si el LLM falló (503) no queda un mensaje huérfano.
    user_msg, assistant = message_repository.insert_exchange(conversation_id, question, text, grounded, [
        {"ref_number": i, "chunk_id": c.chunk_id, "document_id": c.document_id, "filename": c.filename,
         "page": c.page, "score": c.score, "snippet": _snippet(c.content)}
        for i, c in enumerate(sources, start=1)
    ])
    assistant["sources"] = message_repository.get_sources(str(assistant["id"]), user["access_level"], user["department"])
    conversation_repository.touch(conversation_id, question[:TITLE_CHARS] if first_question else None)

    ms = round((time.perf_counter() - started) * 1000)
    plan_tipo, n_sub = stages.pop("plan", "-"), stages.pop("subconsultas", 0)
    logger.info("Consulta resuelta modo=%s plan=%s subconsultas=%d fuentes=%d grounded=%s largo_pregunta=%d "
                "ms=%d etapas_ms={%s}", mode or "respondida", plan_tipo, n_sub, len(sources), grounded,
                len(question), ms, " ".join(f"{k}={v}" for k, v in stages.items()))
    if mode != "bloqueada":
        audit_service.record(user_id, "consulta", "conversation", conversation_id)
    return {"question": {**user_msg, "sources": []}, "answer": assistant, "ms": ms}
