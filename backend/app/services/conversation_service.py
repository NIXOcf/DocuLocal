from datetime import datetime

from app.core.errors import Conflict, NotFound, TooManyRequests, Unprocessable
from app.repositories import conversation_repository, message_repository
from app.schemas.common import make_page
from app.schemas.conversation import (AnswerOut, ConversationDetailOut, ConversationOut, MessageOut,
                                      SourceOut)
from app.services import chat_service
from app.services.rate_limiter import SlidingWindowLimiter

MAX_CONVERSATIONS = 50
MAX_MESSAGES = 100
ASK_MAX_PER_MINUTE = 10
ask_limiter = SlidingWindowLimiter(ASK_MAX_PER_MINUTE, 60)  # por usuario


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def to_conversation_out(row: dict) -> ConversationOut:
    return ConversationOut(id=row["id"], title=row["title"], created_at=_ms(row["created_at"]),
                           updated_at=_ms(row["updated_at"]))


def to_message_out(row: dict) -> MessageOut:
    return MessageOut(
        id=row["id"], role=row["role"], content=row["content"], feedback=row["feedback"],
        grounded=row["grounded"], created_at=_ms(row["created_at"]),
        sources=[SourceOut(id=s["chunk_id"], ref=s["ref_number"], filename=s["filename"],
                           document_id=s["document_id"], page=s["page"], score=s["score"], snippet=s["snippet"])
                 for s in row.get("sources", [])],
    )


def _owned(user: dict, conversation_id: str) -> dict:
    row = conversation_repository.get_owned(conversation_id, str(user["id"]))
    if row is None:
        raise NotFound("La conversación no existe.", "conversacion_no_encontrada")
    return row


def list_conversations(user: dict, pagina: int, tamano: int) -> dict:
    rows, total = conversation_repository.list_by_user(str(user["id"]), tamano, (pagina - 1) * tamano)
    return make_page([to_conversation_out(r) for r in rows], total, pagina, tamano)


def create_conversation(user: dict, title: str | None) -> ConversationOut:
    if conversation_repository.count_by_user(str(user["id"])) >= MAX_CONVERSATIONS:
        raise Conflict(f"Alcanzaste el máximo de {MAX_CONVERSATIONS} conversaciones. Elimina alguna.",
                       "limite_conversaciones")
    return to_conversation_out(conversation_repository.create(str(user["id"]), title or chat_service.DEFAULT_TITLE))


def get_conversation(user: dict, conversation_id: str) -> ConversationDetailOut:
    row = _owned(user, conversation_id)
    messages = message_repository.list_by_conversation(conversation_id, user["access_level"], user["department"])
    return ConversationDetailOut(**to_conversation_out(row).model_dump(),
                                 messages=[to_message_out(m) for m in messages])


def rename_conversation(user: dict, conversation_id: str, title: str) -> ConversationOut:
    _owned(user, conversation_id)
    return to_conversation_out(conversation_repository.update_title(conversation_id, title))


def delete_conversation(user: dict, conversation_id: str) -> None:
    _owned(user, conversation_id)
    conversation_repository.delete(conversation_id)


def list_messages(user: dict, conversation_id: str) -> list[MessageOut]:
    _owned(user, conversation_id)
    messages = message_repository.list_by_conversation(conversation_id, user["access_level"], user["department"])
    return [to_message_out(m) for m in messages]


def post_message(user: dict, conversation_id: str, content: str) -> AnswerOut:
    _owned(user, conversation_id)
    wait = ask_limiter.consume(str(user["id"]))
    if wait:
        raise TooManyRequests("Estás haciendo demasiadas preguntas. Espera un momento.", "demasiadas_consultas",
                              headers={"Retry-After": str(wait)})
    if message_repository.count(conversation_id) + 2 > MAX_MESSAGES:
        raise Conflict(f"La conversación alcanzó el máximo de {MAX_MESSAGES} mensajes. Inicia una nueva.",
                       "limite_mensajes")
    result = chat_service.answer(user, conversation_id, content)
    return AnswerOut(**to_message_out(result["answer"]).model_dump(),
                     question=to_message_out(result["question"]))


def set_feedback(user: dict, conversation_id: str, message_id: str, feedback: str | None) -> MessageOut:
    _owned(user, conversation_id)
    msg = message_repository.get_in_conversation(message_id, conversation_id)
    if msg is None:
        raise NotFound("El mensaje no existe.", "mensaje_no_encontrado")
    if msg["role"] != "assistant":
        raise Unprocessable("Solo se puede valorar una respuesta del asistente.", "feedback_no_permitido")
    updated = message_repository.set_feedback(message_id, feedback, user["access_level"], user["department"])
    return to_message_out(updated)
