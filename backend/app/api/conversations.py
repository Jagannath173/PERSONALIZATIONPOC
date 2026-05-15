"""Conversation memory endpoints — load, list, and clear persisted chat."""

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ConversationResponse
from app.services import conversation, rbac

router = APIRouter()


@router.get("/conversations/{user_id}", response_model=ConversationResponse)
async def get_conversation(user_id: str):
    user = rbac.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    messages = conversation.get_history(user_id)
    info = conversation.summary(user_id)
    return ConversationResponse(
        user_id=user_id,
        messages=messages,
        message_count=info["message_count"],
        created_at=info["created_at"],
        updated_at=info["updated_at"],
    )


@router.delete("/conversations/{user_id}")
async def clear_conversation(user_id: str):
    user = rbac.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    conversation.clear(user_id)
    return {"status": "cleared", "user_id": user_id}


@router.get("/conversations/{user_id}/summary")
async def conversation_summary(user_id: str):
    user = rbac.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return conversation.summary(user_id)
