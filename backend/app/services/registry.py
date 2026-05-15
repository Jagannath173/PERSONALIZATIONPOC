"""
Registry — file-backed source of truth for users (super_admin + employees)
and clients. Replaces the previously hardcoded USERS/CLIENTS dicts so the
Super Admin can add / update / remove employees and clients at runtime.

Storage layout (under DATA_DIR / "registry"):
    users.json     — { user_id: {...} }
    clients.json   — { client_id: {...} }

On first boot, if the files are missing, seed defaults are written.
All writes are atomic (tmp file → rename).
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from typing import Optional

from app.core.config import DATA_DIR
from app.core.logging import get

log = get("registry")

REGISTRY_DIR = DATA_DIR / "registry"
USERS_PATH    = REGISTRY_DIR / "users.json"
CLIENTS_PATH  = REGISTRY_DIR / "clients.json"

_lock = threading.RLock()

# ─── Defaults (used only when registry files don't exist yet) ────────────────
_DEFAULT_USERS = {
    "super_admin": {
        "user_id": "super_admin",
        "role": "super_admin",
        "name": "Super Admin",
        "email": "admin@wealthassistant.local",
        "password": "admin123",
        "allowed_portfolio_scope": ["*"],
        "assigned_clients": [],
    },
    "emp_1": {
        "user_id": "emp_1",
        "role": "employee",
        "name": "Employee 1",
        "email": "emp1@wealthassistant.local",
        "password": "emp123",
        "allowed_portfolio_scope": ["emp_1"],
        "assigned_clients": ["client_rahul", "client_priya"],
    },
    "emp_2": {
        "user_id": "emp_2",
        "role": "employee",
        "name": "Employee 2",
        "email": "emp2@wealthassistant.local",
        "password": "emp234",
        "allowed_portfolio_scope": ["emp_2"],
        "assigned_clients": ["client_arjun", "client_meera"],
    },
}

_DEFAULT_CLIENTS = {
    "client_rahul": {"client_id": "client_rahul", "name": "Rahul", "assigned_employee": "emp_1"},
    "client_priya": {"client_id": "client_priya", "name": "Priya", "assigned_employee": "emp_1"},
    "client_arjun": {"client_id": "client_arjun", "name": "Arjun", "assigned_employee": "emp_2"},
    "client_meera": {"client_id": "client_meera", "name": "Meera", "assigned_employee": "emp_2"},
}


# ─── IO helpers ───────────────────────────────────────────────────────────────
def _read(path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            log.error("registry file corrupted %s: %s", path, e)
            return {}


def _write_atomic(path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _ensure_seeded() -> None:
    if not USERS_PATH.exists():
        _write_atomic(USERS_PATH, _DEFAULT_USERS)
        log.info("seeded default users.json with %d users", len(_DEFAULT_USERS))
    else:
        # Backfill any new fields we've introduced post-seed
        users = _read(USERS_PATH)
        changed = False
        for uid, u in users.items():
            if "email" not in u:
                u["email"] = f"{uid}@wealthassistant.local"
                changed = True
        if changed:
            _write_atomic(USERS_PATH, users)
            log.info("backfilled missing email fields on users.json")

    if not CLIENTS_PATH.exists():
        _write_atomic(CLIENTS_PATH, _DEFAULT_CLIENTS)
        log.info("seeded default clients.json with %d clients", len(_DEFAULT_CLIENTS))


# ─── Public — read ────────────────────────────────────────────────────────────
def all_users() -> dict:
    with _lock:
        _ensure_seeded()
        return _read(USERS_PATH)


def all_clients() -> dict:
    with _lock:
        _ensure_seeded()
        return _read(CLIENTS_PATH)


def get_user(user_id: str) -> Optional[dict]:
    return all_users().get(user_id)


def get_client(client_id: str) -> Optional[dict]:
    return all_clients().get(client_id)


def employee_ids() -> list:
    return [u["user_id"] for u in all_users().values() if u.get("role") == "employee"]


# ─── Public — write (super-admin gated at the API layer) ─────────────────────
def upsert_user(user: dict) -> dict:
    with _lock:
        users = all_users()
        existing = users.get(user["user_id"], {})
        merged = {**existing, **user}
        # defaults
        merged.setdefault("role", "employee")
        merged.setdefault("assigned_clients", [])
        if merged["role"] == "employee":
            merged.setdefault("allowed_portfolio_scope", [merged["user_id"]])
        users[merged["user_id"]] = merged
        _write_atomic(USERS_PATH, users)
        log.info("upsert user=%s role=%s", merged["user_id"], merged["role"])
        return merged


def delete_user(user_id: str) -> bool:
    with _lock:
        users = all_users()
        if user_id not in users:
            return False
        if users[user_id].get("role") == "super_admin":
            raise ValueError("Cannot delete the super admin")
        # Detach this employee's clients (don't delete them, just unassign).
        clients = all_clients()
        for cid, c in clients.items():
            if c.get("assigned_employee") == user_id:
                c["assigned_employee"] = None
        _write_atomic(CLIENTS_PATH, clients)
        del users[user_id]
        _write_atomic(USERS_PATH, users)
        log.info("deleted user=%s", user_id)
        return True


def upsert_client(client: dict) -> dict:
    with _lock:
        clients = all_clients()
        existing = clients.get(client["client_id"], {})
        merged = {**existing, **client}
        clients[merged["client_id"]] = merged
        _write_atomic(CLIENTS_PATH, clients)
        # Reflect on the employee's assigned_clients list
        assignee = merged.get("assigned_employee")
        users = all_users()
        for uid, u in users.items():
            assigned = u.setdefault("assigned_clients", [])
            if uid == assignee:
                if merged["client_id"] not in assigned:
                    assigned.append(merged["client_id"])
            else:
                if merged["client_id"] in assigned:
                    assigned.remove(merged["client_id"])
        _write_atomic(USERS_PATH, users)
        log.info("upsert client=%s assigned_to=%s", merged["client_id"], assignee)
        return merged


def delete_client(client_id: str) -> bool:
    with _lock:
        clients = all_clients()
        if client_id not in clients:
            return False
        del clients[client_id]
        _write_atomic(CLIENTS_PATH, clients)
        users = all_users()
        for u in users.values():
            assigned = u.get("assigned_clients", [])
            if client_id in assigned:
                assigned.remove(client_id)
        _write_atomic(USERS_PATH, users)
        log.info("deleted client=%s", client_id)
        return True


def public_user(u: dict) -> dict:
    """Strip the password before exposing a user."""
    return {k: v for k, v in u.items() if k != "password"}
