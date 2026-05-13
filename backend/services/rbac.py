"""
RBAC enforcement layer.

All permission checks flow through this module.
Nothing is hard-coded for a specific agent — every decision
derives from the user registry in config.py.
"""

from config import USERS, CLIENTS


def get_user(user_id: str):
    return USERS.get(user_id)


def get_all_agent_ids() -> list:
    return [u["user_id"] for u in USERS.values() if u["role"] == "agent"]


def get_allowed_scopes(user: dict):
    """Return list of portfolio owners this user may access. None = unrestricted."""
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


def can_modify_client_preference(user: dict) -> bool:
    return user["role"] == "super_admin"


def can_access_client(user: dict, client_id: str) -> bool:
    if user["role"] == "super_admin":
        return True
    return client_id in user.get("assigned_clients", [])


def resolve_retrieval_scopes(user: dict, requested_owner: str = None):
    allowed = get_allowed_scopes(user)
    if requested_owner:
        if allowed is None or requested_owner in (allowed or []):
            return [requested_owner]
        return []
    return allowed


def get_all_accessible_portfolio_owners(user: dict) -> list:
    scopes = get_allowed_scopes(user)
    if scopes is None:
        return get_all_agent_ids()
    return scopes
