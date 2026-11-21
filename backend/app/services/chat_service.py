"""Orquestador del chat: guard -> condensar -> planificar -> recuperar -> generar -> verificar citas."""
import time

from app.repositories import conversation_repository, message_repository
from app.services import audit_service
from app.services.rag import generator, query_planner, retriever
from app.services.rag.generator import NO_INFO_ANSWER
from app.services.rag.llm_client import prompt_injection_score

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


def _compose(question: str, history: list[dict], user: dict) -> tuple[str, list[retriever.RetrievedChunk], str | None]:
    """Devuelve (texto, fuentes citadas, texto fijo si no hubo búsqueda). Las fuentes ya vienen en orden de cita."""
    standalone = query_planner.condense(question, history)
    plan = query_planner.plan(standalone)
    if plan.tipo == "saludo":
        return GREETING_ANSWER, [], "saludo"
    if plan.tipo == "fuera_de_alcance":
        return OUT_OF_SCOPE_ANSWER, [], "fuera_de_alcance"

    chunks = retriever.retrieve(standalone, plan, user)
    if not chunks:  # compuerta anti-alucinación: sin LLM y sin revelar si hay documentos restringidos
        return NO_INFO_ANSWER, [], "sin_resultados"

    text, cited = generator.generate_answer(standalone, chunks, history)
    if not cited:
        return NO_INFO_ANSWER, [], "sin_citas"
    return generator.renumber_citations(text, cited), [chunks[n - 1] for n in cited], None


def answer(user: dict, conversation_id: str, question: str) -> dict:
    started = time.perf_counter()
    user_id = str(user["id"])
    history = message_repository.recent(conversation_id, HISTORY_WINDOW)
    first_question = not history
    user_msg = message_repository.insert(conversation_id, "user", question)

    if prompt_injection_score(question) > INJECTION_THRESHOLD:
        text, sources, grounded = BLOCKED_ANSWER, [], False
        audit_service.record(user_id, "consulta_bloqueada", "conversation", conversation_id, motivo="inyeccion")
        mode = "bloqueada"
    else:
        text, sources, mode = _compose(question, history, user)
        grounded = mode is None and bool(sources)

    assistant = message_repository.insert(conversation_id, "assistant", text, grounded)
    message_repository.insert_sources(str(assistant["id"]), [
        {"ref_number": i, "chunk_id": c.chunk_id, "document_id": c.document_id, "filename": c.filename,
         "page": c.page, "score": c.score, "snippet": _snippet(c.content)}
        for i, c in enumerate(sources, start=1)
    ])
    assistant["sources"] = message_repository.get_sources(str(assistant["id"]))
    conversation_repository.touch(conversation_id, question[:TITLE_CHARS] if first_question else None)

    ms = round((time.perf_counter() - started) * 1000)
    if mode != "bloqueada":
        audit_service.record(user_id, "consulta", "conversation", conversation_id,
                             n_fuentes=len(sources), grounded=grounded, ms=ms)
    return {"question": {**user_msg, "sources": []}, "answer": assistant, "ms": ms}
