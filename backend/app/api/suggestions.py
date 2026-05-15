"""
Suggestions endpoint.

Builds a list of contextual starter prompts for the logged-in user, grounded
only in documents and clients the user can actually access. RBAC is enforced
the same way as chat:

  • Vector search is run with allowed_scopes from rbac.resolve_retrieval_scopes
  • Accessible clients are filtered through registry + rbac.can_access_client
  • The result is passed to the LLM with strict instructions not to mention
    anyone outside that scope.

This means an employee's suggestions can never reference another employee's
clients or data — same guarantee as chat.
"""

from fastapi import APIRouter, HTTPException

from app.core.logging import get
from app.services import llm, rbac, registry, vector

log = get("suggestions")
router = APIRouter()


@router.get("/suggestions/{user_id}")
async def get_suggestions(user_id: str, count: int = 6):
    user = registry.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")

    # 1. RBAC-scoped accessible clients
    all_clients = registry.all_clients()
    accessible_clients = [
        c for c in all_clients.values() if rbac.can_access_client(user, c["client_id"])
    ]

    # 2. RBAC-scoped sample of indexed docs (NEVER fall back to unfiltered)
    scopes = rbac.resolve_retrieval_scopes(user)
    sample_docs = []
    try:
        sample_docs = vector.search_documents(
            query="portfolio summary performance holdings clients",
            allowed_scopes=scopes,
            top_k=8,
        )
    except Exception as e:
        log.warning("sample doc fetch failed for %s: %s", user_id, e)

    log.info("suggestions: user=%s role=%s clients=%d sample_docs=%d scopes=%s",
             user_id, user["role"], len(accessible_clients), len(sample_docs), scopes)

    # 3. Defence-in-depth: re-verify none of the sample docs are out of scope
    if scopes is not None:
        before = len(sample_docs)
        sample_docs = [d for d in sample_docs if d.get("portfolio_owner") in scopes]
        if before != len(sample_docs):
            log.error("scope leak prevented: dropped %d doc(s) outside %s",
                      before - len(sample_docs), scopes)

    suggestions = llm.generate_suggestions(
        user=user,
        accessible_clients=accessible_clients,
        sample_docs=sample_docs,
        count=count,
    )

    return {
        "user_id": user_id,
        "suggestions": suggestions,
        "context": {
            "client_count": len(accessible_clients),
            "doc_sample_size": len(sample_docs),
        },
    }
