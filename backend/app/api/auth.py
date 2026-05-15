"""Auth endpoints — login and identity lookup.

POC-grade: validates plaintext credentials against the registry and
returns the user object. The frontend stores it in localStorage; no
JWT/session cookie is issued for this POC.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.logging import get
from app.services import registry

log = get("auth")
router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: dict


@router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = registry.get_user(req.username)
    if not user or user.get("password") != req.password:
        log.warning("login failed for username=%s", req.username)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    log.info("login ok user=%s role=%s", user["user_id"], user["role"])
    return LoginResponse(user=registry.public_user(user))


@router.get("/auth/me/{user_id}")
async def me(user_id: str):
    user = registry.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return registry.public_user(user)


class ProfilePatch(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.patch("/auth/profile/{user_id}")
async def update_profile(user_id: str, patch: ProfilePatch):
    """Self-update: a user can edit their own name, email, and password.

    Changing the password requires sending the current password.
    """
    user = registry.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")

    updates = {}
    if patch.name is not None and patch.name.strip():
        updates["name"] = patch.name.strip()
    if patch.email is not None:
        updates["email"] = str(patch.email)

    if patch.new_password is not None:
        if not patch.current_password or patch.current_password != user.get("password"):
            raise HTTPException(status_code=403, detail="Current password is incorrect")
        if len(patch.new_password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        updates["password"] = patch.new_password

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    merged = registry.upsert_user({**user, **updates})
    log.info("profile updated user=%s fields=%s", user_id, list(updates.keys()))
    return registry.public_user(merged)
