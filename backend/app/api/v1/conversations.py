from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.core.deps import CurrentUser
from app.schemas.common import Page
from app.schemas.conversation import (AnswerOut, ConversationCreate, ConversationDetailOut, ConversationOut,
                                      ConversationUpdate, FeedbackUpdate, MessageCreate, MessageOut)
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=Page[ConversationOut])
def list_conversations(user: CurrentUser, pagina: Annotated[int, Query(ge=1, le=10000)] = 1,
                       tamano: Annotated[int, Query(ge=1, le=100)] = 20):
    return conversation_service.list_conversations(user, pagina, tamano)


@router.post("", response_model=ConversationOut, status_code=201)
def create_conversation(user: CurrentUser, response: Response, body: ConversationCreate | None = None):
    conv = conversation_service.create_conversation(user, body.title if body else None)
    response.headers["Location"] = f"/api/v1/conversations/{conv.id}"
    return conv


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(user: CurrentUser, conversation_id: UUID):
    return conversation_service.get_conversation(user, str(conversation_id))


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(user: CurrentUser, conversation_id: UUID, body: ConversationUpdate):
    return conversation_service.rename_conversation(user, str(conversation_id), body.title)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(user: CurrentUser, conversation_id: UUID):
    conversation_service.delete_conversation(user, str(conversation_id))
    return Response(status_code=204)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(user: CurrentUser, conversation_id: UUID):
    return conversation_service.list_messages(user, str(conversation_id))


@router.post("/{conversation_id}/messages", response_model=AnswerOut, status_code=201)
def post_message(user: CurrentUser, conversation_id: UUID, body: MessageCreate, response: Response):
    answer = conversation_service.post_message(user, str(conversation_id), body.content)
    response.headers["Location"] = f"/api/v1/conversations/{conversation_id}/messages/{answer.id}"
    return answer


@router.patch("/{conversation_id}/messages/{message_id}", response_model=MessageOut)
def set_feedback(user: CurrentUser, conversation_id: UUID, message_id: UUID, body: FeedbackUpdate):
    return conversation_service.set_feedback(user, str(conversation_id), str(message_id), body.feedback)
