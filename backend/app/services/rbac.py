"""RBAC enforcement — every permission decision flows through this module.

Hierarchy
    super_admin                    — full access, can manage employees + clients
        ├── employee_a              — own portfolio scope, own clients only
        │   ├── client …
        │   └── client …
        └── employee_b              — own portfolio scope, own clients only
            └── client …

Rules
    • An employee can ONLY see / modify clients in their `assigned_clients`.
    • An employee can ONLY see / modify their own portfolio scope.
    • super_admin can see and modify anything.
"""

from typing import Optional

from app.services import registry


def get_user(user_id: str):
    return registry.get_user(user_id)


def get_all_employee_ids() -> list:
    return registry.employee_ids()


# ─── Portfolio scope ─────────────────────────────────────────────────────────
def get_allowed_scopes(user: dict):
    """List of portfolio owners this user may access. None = unrestricted."""
    scope = user.get("allowed_portfolio_scope", [])
    if "*" in scope:
        return None  # super_admin
    return list(scope)


def can_access_portfolio(user: dict, portfolio_owner: str) -> bool:
    scopes = get_allowed_scopes(user)
    if scopes is None:
        return True
    return portfolio_owner in scopes


def can_modify_portfolio(user: dict, portfolio_owner: str) -> bool:
    if user["role"] == "super_admin":
        return True
    return portfolio_owner in user.get("allowed_portfolio_scope", [])


# ─── Client access ───────────────────────────────────────────────────────────
def can_access_client(user: dict, client_id: str) -> bool:
    if user["role"] == "super_admin":
        return True
    return client_id in user.get("assigned_clients", [])


def can_modify_client_preference(user: dict) -> bool:
    return user["role"] == "super_admin"


# ─── Admin gate ──────────────────────────────────────────────────────────────
def is_super_admin(user: dict) -> bool:
    return user.get("role") == "super_admin"


# ─── Retrieval helpers ───────────────────────────────────────────────────────
def resolve_retrieval_scopes(user: dict, requested_owner: Optional[str] = None):
    allowed = get_allowed_scopes(user)
    if requested_owner:
        if allowed is None or requested_owner in (allowed or []):
            return [requested_owner]
        return []
    return allowed


def get_all_accessible_portfolio_owners(user: dict) -> list:
    scopes = get_allowed_scopes(user)
    if scopes is None:
        return get_all_employee_ids()
    return scopes
