from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.common import CamelInput, CamelModel


class ConversationOut(CamelModel):
    id: UUID
    title: str
    created_at: int  # epoch ms, igual que el front
    updated_at: int


class SourceOut(CamelModel):
    id: UUID | None  # id del fragmento (null si el documento se borró después)
    ref: int
    filename: str
    document_id: UUID | None
    page: int | None
    score: float
    snippet: str


class MessageOut(CamelModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    sources: list[SourceOut] = []
    feedback: Literal["up", "down"] | None = None
    grounded: bool | None = None
    created_at: int


class AnswerOut(MessageOut):
    """Respuesta de POST /messages: el mensaje del asistente y la pregunta guardada."""

    question: MessageOut


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]


class ConversationCreate(CamelInput):
    title: str | None = Field(default=None, min_length=1, max_length=120)


class ConversationUpdate(CamelInput):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class MessageCreate(CamelInput):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class FeedbackUpdate(CamelInput):
    feedback: Literal["up", "down"] | None
