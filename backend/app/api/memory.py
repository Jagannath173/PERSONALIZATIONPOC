"""Long-term memory endpoints — preferences scoped per user / client."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import memory, rbac

router = APIRouter()


@router.get("/memory/{user_id}")
async def get_memory(user_id: str):
    user = rbac.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return memory.get_all_memories_for_user(user_id)


@router.get("/memory/{user_id}/preferences")
async def get_preferences(user_id: str):
    user = rbac.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return {"preferences": memory.get_user_preferences(user_id)}


@router.get("/memory/client/{client_id}/preference")
async def get_client_pref(client_id: str, requesting_user_id: str):
    user = rbac.get_user(requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.can_access_client(user, client_id):
        raise HTTPException(status_code=403, detail="Access denied")
    pref = memory.get_client_preference(client_id)
    return {"client_id": client_id, "preference": pref}


class AddMemoryRequest(BaseModel):
    user_id: str
    memory_type: str
    content: str


@router.post("/memory/add")
async def add_memory(req: AddMemoryRequest):
    user = rbac.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    entry = memory.add_user_memory(req.user_id, req.memory_type, req.content)
    return {"status": "saved", "entry": entry}


class SetClientPrefRequest(BaseModel):
    requesting_user_id: str
    client_id: str
    preference: str


@router.post("/memory/client-preference")
async def set_client_preference(req: SetClientPrefRequest):
    user = rbac.get_user(req.requesting_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.can_modify_client_preference(user):
        raise HTTPException(
            status_code=403,
            detail="Only Super Admin can modify client communication preferences.",
        )
    entry = memory.set_client_preference(req.client_id, req.preference, req.requesting_user_id)
    return {"status": "saved", "entry": entry}
