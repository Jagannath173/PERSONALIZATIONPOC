"""System endpoints — users, clients, health."""

from fastapi import APIRouter

from app.services import registry

router = APIRouter()


@router.get("/users")
async def list_users():
    return {uid: registry.public_user(u) for uid, u in registry.all_users().items()}


@router.get("/clients")
async def list_clients():
    return {"clients": registry.all_clients()}


@router.get("/health")
async def api_health():
    return {"status": "ok"}
