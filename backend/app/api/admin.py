"""
Admin endpoints — super-admin-only CRUD for employees and clients.

All routes require ?requesting_user_id=<super_admin_id> or it's a 403.
This is POC-grade auth; production should use a session token or JWT.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.logging import get
from app.services import rbac, registry

log = get("admin")
router = APIRouter()


def _require_admin(user_id: str):
    user = registry.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not rbac.is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


# ─── Schemas ─────────────────────────────────────────────────────────────────
class EmployeeIn(BaseModel):
    user_id: str
    name: str
    password: str
    assigned_clients: list[str] = []


class EmployeePatch(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    assigned_clients: Optional[list[str]] = None


class ClientIn(BaseModel):
    client_id: str
    name: str
    assigned_employee: Optional[str] = None


class ClientPatch(BaseModel):
    name: Optional[str] = None
    assigned_employee: Optional[str] = None


# ─── Employees ───────────────────────────────────────────────────────────────
@router.get("/admin/employees")
async def list_employees(requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    return [
        registry.public_user(u)
        for u in registry.all_users().values()
        if u.get("role") == "employee"
    ]


@router.post("/admin/employees")
async def create_employee(body: EmployeeIn, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    if registry.get_user(body.user_id):
        raise HTTPException(status_code=409, detail=f"User {body.user_id} already exists")
    user = registry.upsert_user({
        "user_id": body.user_id,
        "role": "employee",
        "name": body.name,
        "password": body.password,
        "allowed_portfolio_scope": [body.user_id],
        "assigned_clients": body.assigned_clients,
    })
    # Reflect assignments in clients
    for cid in body.assigned_clients:
        c = registry.get_client(cid)
        if c:
            registry.upsert_client({**c, "assigned_employee": body.user_id})
    log.info("admin created employee=%s by=%s", body.user_id, requesting_user_id)
    return registry.public_user(user)


@router.patch("/admin/employees/{user_id}")
async def patch_employee(user_id: str, body: EmployeePatch, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    current = registry.get_user(user_id)
    if not current or current.get("role") != "employee":
        raise HTTPException(status_code=404, detail=f"Employee {user_id} not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    merged = registry.upsert_user({**current, **updates})

    if "assigned_clients" in updates:
        for c in registry.all_clients().values():
            if c.get("assigned_employee") == user_id and c["client_id"] not in updates["assigned_clients"]:
                registry.upsert_client({**c, "assigned_employee": None})
        for cid in updates["assigned_clients"]:
            c = registry.get_client(cid)
            if c and c.get("assigned_employee") != user_id:
                registry.upsert_client({**c, "assigned_employee": user_id})

    log.info("admin patched employee=%s fields=%s by=%s",
             user_id, list(updates.keys()), requesting_user_id)
    return registry.public_user(merged)


@router.delete("/admin/employees/{user_id}")
async def delete_employee(user_id: str, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    try:
        ok = registry.delete_user(user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail=f"Employee {user_id} not found")
    log.info("admin deleted employee=%s by=%s", user_id, requesting_user_id)
    return {"status": "deleted", "user_id": user_id}


# ─── Clients ─────────────────────────────────────────────────────────────────
@router.get("/admin/clients")
async def list_clients(requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    return list(registry.all_clients().values())


@router.post("/admin/clients")
async def create_client(body: ClientIn, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    if registry.get_client(body.client_id):
        raise HTTPException(status_code=409, detail=f"Client {body.client_id} already exists")
    if body.assigned_employee and not registry.get_user(body.assigned_employee):
        raise HTTPException(status_code=400, detail=f"Unknown employee {body.assigned_employee}")
    client = registry.upsert_client(body.model_dump())
    log.info("admin created client=%s assigned_to=%s by=%s",
             body.client_id, body.assigned_employee, requesting_user_id)
    return client


@router.patch("/admin/clients/{client_id}")
async def patch_client(client_id: str, body: ClientPatch, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    current = registry.get_client(client_id)
    if not current:
        raise HTTPException(status_code=404, detail=f"Client {client_id} not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "assigned_employee" in updates and updates["assigned_employee"]:
        if not registry.get_user(updates["assigned_employee"]):
            raise HTTPException(status_code=400, detail="Unknown employee")
    client = registry.upsert_client({**current, **updates})
    log.info("admin patched client=%s fields=%s by=%s",
             client_id, list(updates.keys()), requesting_user_id)
    return client


@router.delete("/admin/clients/{client_id}")
async def delete_client(client_id: str, requesting_user_id: str = Query(...)):
    _require_admin(requesting_user_id)
    ok = registry.delete_client(client_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Client {client_id} not found")
    log.info("admin deleted client=%s by=%s", client_id, requesting_user_id)
    return {"status": "deleted", "client_id": client_id}
