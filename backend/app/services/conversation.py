"""
Conversation service — persistent per-user chat memory ("shared memory").

Every chat exchange is appended to a JSON file keyed by user_id, so when the
user returns the assistant restores the full prior context. A rolling window
of the most recent turns is supplied to the LLM as session_history; the rest
remains on disk for audit / replay.

File layout:  data/conversations/<user_id>.json
{
  "user_id": "...",
  "created_at": "...",
  "updated_at": "...",
  "messages": [
    {"id": "...", "role": "user"|"assistant",
     "content": "...", "timestamp": "...",
     "intent": "...", "access_denied": false,
     "memory_updated": false}
  ]
}
"""

import json
import os
import uuid
from datetime import datetime
from typing import List, Optional

from app.core.config import (
    CONVERSATION_DIR,
    CONVERSATION_MAX_TURNS,
    CONVERSATION_CONTEXT_WINDOW,
)


def _path(user_id: str) -> str:
    return os.path.join(CONVERSATION_DIR, f"{user_id}.json")


def _empty(user_id: str) -> dict:
    now = datetime.now().isoformat()
    return {
        "user_id": user_id,
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }


def _load(user_id: str) -> dict:
    path = _path(user_id)
    if not os.path.exists(path):
        return _empty(user_id)
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            data.setdefault("user_id", user_id)
            data.setdefault("messages", [])
            return data
        except json.JSONDecodeError:
            return _empty(user_id)


def _save(user_id: str, data: dict) -> None:
    data["updated_at"] = datetime.now().isoformat()
    if len(data["messages"]) > CONVERSATION_MAX_TURNS:
        data["messages"] = data["messages"][-CONVERSATION_MAX_TURNS:]
    with open(_path(user_id), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ─── Public API ───────────────────────────────────────────────────────────────

def get_history(user_id: str) -> List[dict]:
    """Return the full persisted conversation for a user."""
    return _load(user_id)["messages"]


def get_context_window(user_id: str, window: Optional[int] = None) -> List[dict]:
    """Return the trailing N messages to feed the LLM as session_history."""
    n = window or CONVERSATION_CONTEXT_WINDOW
    return get_history(user_id)[-n:]


def append_message(
    user_id: str,
    role: str,
    content: str,
    *,
    intent: Optional[str] = None,
    access_denied: bool = False,
    memory_updated: bool = False,
    retrieved_context: Optional[list] = None,
) -> dict:
    """Append a single message to the persisted conversation."""
    data = _load(user_id)
    entry = {
        "id": f"msg_{uuid.uuid4().hex[:10]}",
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    }
    if intent:
        entry["intent"] = intent
    if access_denied:
        entry["access_denied"] = True
    if memory_updated:
        entry["memory_updated"] = True
    if retrieved_context:
        # Persist a slim copy — IDs and owners only, not full content
        entry["retrieved_context"] = [
            {
                "document_id": d.get("document_id"),
                "portfolio_owner": d.get("portfolio_owner"),
                "client_id": d.get("client_id"),
            }
            for d in retrieved_context
        ]
    data["messages"].append(entry)
    _save(user_id, data)
    return entry


def append_exchange(
    user_id: str,
    user_message: str,
    assistant_message: str,
    *,
    intent: Optional[str] = None,
    access_denied: bool = False,
    memory_updated: bool = False,
    retrieved_context: Optional[list] = None,
) -> None:
    """Convenience — persist a full user/assistant turn in one call."""
    append_message(user_id, "user", user_message)
    append_message(
        user_id,
        "assistant",
        assistant_message,
        intent=intent,
        access_denied=access_denied,
        memory_updated=memory_updated,
        retrieved_context=retrieved_context,
    )


def clear(user_id: str) -> None:
    """Wipe the persisted conversation for this user."""
    path = _path(user_id)
    if os.path.exists(path):
        os.remove(path)


def summary(user_id: str) -> dict:
    data = _load(user_id)
    msgs = data["messages"]
    return {
        "user_id": user_id,
        "message_count": len(msgs),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "last_message_at": msgs[-1]["timestamp"] if msgs else None,
    }
