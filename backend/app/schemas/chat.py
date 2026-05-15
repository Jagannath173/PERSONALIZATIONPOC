"""Pydantic schemas for the chat / conversation endpoints."""

from typing import List, Optional
from pydantic import BaseModel, Field


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    session_history: List[HistoryMessage] = Field(default_factory=list)
    use_persistent_memory: bool = True


class RetrievedDoc(BaseModel):
    document_id: Optional[str] = None
    portfolio_owner: Optional[str] = None
    client_id: Optional[str] = None
    document_type: Optional[str] = None
    content: Optional[str] = None
    access_scope: Optional[str] = None
    created_at: Optional[str] = None
    score: Optional[float] = None


class ChatResponse(BaseModel):
    response: str
    retrieved_context: list = []
    memory_used: list = []
    access_denied: bool = False
    denial_reason: str = ""
    memory_updated: bool = False
    intent: str = ""
    conversation_length: int = 0


class ConversationMessage(BaseModel):
    id: Optional[str] = None
    role: str
    content: str
    timestamp: Optional[str] = None
    intent: Optional[str] = None
    access_denied: Optional[bool] = None
    memory_updated: Optional[bool] = None


class ConversationResponse(BaseModel):
    user_id: str
    messages: List[ConversationMessage] = []
    message_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
