"""
Memory service — JSON-file-backed, scoped by user_id or client_id.

Memory types:
  user_preference                  — response format preferences
  business_context                 — recurring domain facts
  admin_instruction                — org-level rules from super_admin
  client_communication_preference  — how a client wants updates delivered
"""

import json
import os
import uuid
from datetime import datetime
from config import MEMORY_DIR

os.makedirs(MEMORY_DIR, exist_ok=True)


def _path(scope_type: str, scope_id: str) -> str:
    return os.path.join(MEMORY_DIR, f"{scope_type}_{scope_id}.json")


def _load(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"memories": []}


def _save(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ─── User memory ───────────────────────────────────────────────────────────────

def get_user_memories(user_id: str) -> list:
    return _load(_path("user", user_id))["memories"]


def add_user_memory(user_id: str, memory_type: str, content: str) -> dict:
    path = _path("user", user_id)
    data = _load(path)
    now = datetime.now().isoformat()

    # Overwrite if same type already exists (idempotent preference update)
    for mem in data["memories"]:
        if mem["memory_type"] == memory_type:
            mem["content"] = content
            mem["updated_at"] = now
            _save(path, data)
            return mem

    entry = {
        "memory_id": f"mem_{user_id}_{uuid.uuid4().hex[:6]}",
        "user_id": user_id,
        "memory_type": memory_type,
        "content": content,
        "created_at": now,
        "updated_at": now,
    }
    data["memories"].append(entry)
    _save(path, data)
    return entry


def get_user_preferences(user_id: str) -> list:
    return [
        m for m in get_user_memories(user_id)
        if m["memory_type"] in ("user_preference", "business_context", "admin_instruction")
    ]


# ─── Client communication preference ──────────────────────────────────────────

def get_client_preference(client_id: str):
    data = _load(_path("client", client_id))
    prefs = [m for m in data["memories"] if m["memory_type"] == "client_communication_preference"]
    return prefs[0] if prefs else None


def set_client_preference(client_id: str, preference: str, modified_by: str) -> dict:
    path = _path("client", client_id)
    data = _load(path)
    now = datetime.now().isoformat()

    entry = {
        "memory_id": f"cpref_{client_id}",
        "client_id": client_id,
        "memory_type": "client_communication_preference",
        "content": preference,
        "modified_by": modified_by,
        "updated_at": now,
    }

    for i, mem in enumerate(data["memories"]):
        if mem["memory_type"] == "client_communication_preference":
            entry["created_at"] = mem.get("created_at", now)
            data["memories"][i] = entry
            _save(path, data)
            return entry

    entry["created_at"] = now
    data["memories"].append(entry)
    _save(path, data)
    return entry


def get_all_client_preferences() -> dict:
    result = {}
    for fname in os.listdir(MEMORY_DIR):
        if fname.startswith("client_") and fname.endswith(".json"):
            client_id = fname[len("client_"):-len(".json")]
            pref = get_client_preference(client_id)
            if pref:
                result[client_id] = pref
    return result


def get_all_memories_for_user(user_id: str) -> dict:
    return {
        "user_memories": get_user_memories(user_id),
        "client_preferences": get_all_client_preferences() if user_id == "super_admin" else {},
    }
