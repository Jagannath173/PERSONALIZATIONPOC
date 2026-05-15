"""
Chat endpoint — RBAC-aware orchestrator with persistent ("shared") memory.

Flow per request:
  1. Resolve user (RBAC)
  2. Classify intent (keyword + LLM)
  3. Apply RBAC guards
  4. Route to handler
  5. Persist exchange to conversation memory (shared across sessions)
  6. Return response + debug payload for UI panels
"""

import time

from fastapi import APIRouter, HTTPException

from app.core.logging import get
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import conversation, llm, memory, rbac, vector

log = get("chat")
router = APIRouter()


def _deny(user_id: str, user_msg: str, reason: str, intent: str = "") -> ChatResponse:
    conversation.append_exchange(
        user_id, user_msg, reason,
        intent=intent, access_denied=True,
    )
    return ChatResponse(
        response=reason,
        access_denied=True,
        denial_reason=reason,
        intent=intent,
        conversation_length=len(conversation.get_history(user_id)),
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    started = time.perf_counter()
    log.info("─── chat ─── user=%s msg=%r", req.user_id, req.message[:80])

    user = rbac.get_user(req.user_id)
    if not user:
        log.warning("unknown user_id=%s", req.user_id)
        raise HTTPException(status_code=401, detail=f"Unknown user: {req.user_id}")

    persisted = conversation.get_context_window(req.user_id) if req.use_persistent_memory else []
    client_history = [m.model_dump() for m in req.session_history]
    history = persisted + client_history if persisted else client_history
    log.info("memory: loaded %d prior turn(s) from shared memory", len(persisted))

    intent_result = llm.classify_intent(req.message, user)
    intent        = intent_result.get("intent", "QUERY_PORTFOLIO")
    target_owner  = intent_result.get("target_portfolio_owner")
    target_client = intent_result.get("target_client_id")

    # ─── RBAC guards ────────────────────────────────────────────────────────────
    if target_owner and target_owner != req.user_id and not rbac.can_access_portfolio(user, target_owner):
        log.warning("rbac: DENY %s cannot access portfolio of %s", req.user_id, target_owner)
        return _deny(
            req.user_id, req.message,
            f"Access denied: You do not have permission to access {target_owner}'s portfolio data. "
            "Only your own assigned portfolio is accessible.",
            intent,
        )
    log.info("rbac: portfolio access check passed")

    if intent == "UPDATE_PORTFOLIO":
        update_owner = target_owner or req.user_id
        if not rbac.can_modify_portfolio(user, update_owner):
            return _deny(
                req.user_id, req.message,
                f"Access denied: You do not have permission to update {update_owner}'s portfolio data.",
                intent,
            )

    if intent == "SET_CLIENT_PREFERENCE" and not rbac.can_modify_client_preference(user):
        return _deny(
            req.user_id, req.message,
            "Access denied: You do not have permission to modify client communication preferences. "
            "Only the Super Admin can update client communication preferences.",
            intent,
        )

    if intent == "GENERATE_CLIENT_UPDATE" and target_client:
        if not rbac.can_access_client(user, target_client):
            return _deny(
                req.user_id, req.message,
                f"Access denied: You do not have permission to generate updates for {target_client}. "
                "You can only generate updates for clients assigned to you.",
                intent,
            )

    # ─── Intent handlers ────────────────────────────────────────────────────────
    if intent == "SET_USER_PREFERENCE":
        pref = llm.extract_preference(req.user_id, req.message)
        memory.add_user_memory(req.user_id, "user_preference", pref)
        response_text = f"Got it! Your preference has been saved.\n\n**Stored:** {pref}"
        conversation.append_exchange(
            req.user_id, req.message, response_text,
            intent=intent, memory_updated=True,
        )
        return ChatResponse(
            response=response_text,
            memory_updated=True,
            intent=intent,
            memory_used=memory.get_user_memories(req.user_id),
            conversation_length=len(conversation.get_history(req.user_id)),
        )

    if intent == "SET_CLIENT_PREFERENCE":
        if not target_client:
            response_text = "Please specify which client's communication preference you'd like to update."
            conversation.append_exchange(req.user_id, req.message, response_text, intent=intent)
            return ChatResponse(
                response=response_text,
                intent=intent,
                conversation_length=len(conversation.get_history(req.user_id)),
            )
        pref = llm.extract_preference(req.user_id, req.message)
        memory.set_client_preference(target_client, pref, req.user_id)
        response_text = f"Client communication preference for **{target_client}** updated.\n\n**Stored:** {pref}"
        conversation.append_exchange(
            req.user_id, req.message, response_text,
            intent=intent, memory_updated=True,
        )
        return ChatResponse(
            response=response_text,
            memory_updated=True,
            intent=intent,
            conversation_length=len(conversation.get_history(req.user_id)),
        )

    if intent == "GENERATE_REPORT":
        return await _handle_generate_report(user, req.message, history)

    if intent == "UPDATE_PORTFOLIO":
        return await _handle_portfolio_update(user, req.message, target_owner, target_client)

    if intent == "GENERATE_CLIENT_UPDATE" and target_client:
        return await _handle_client_update(user, req.message, target_client)

    return await _handle_query(user, req.message, target_owner, target_client, intent, history)


# ─── Sub-handlers ──────────────────────────────────────────────────────────────

async def _handle_query(user, message, target_owner, target_client, intent, history):
    scopes = rbac.resolve_retrieval_scopes(user, target_owner)
    log.info("vector: searching scopes=%s client=%s top_k=6", scopes, target_client)
    docs = []
    t0 = time.perf_counter()
    try:
        docs = vector.search_documents(
            query=message,
            allowed_scopes=scopes,
            top_k=6,
            client_id_filter=target_client,
        )
    except Exception as e:
        log.error("vector search error: %s", e)
    log.info("vector: retrieved %d doc(s) in %.0fms",
             len(docs), (time.perf_counter() - t0) * 1000)

    user_mems = memory.get_user_preferences(user["user_id"])
    log.info("memory: %d user preference(s) injected", len(user_mems))

    log.info("llm: generating response (history=%d turns, docs=%d)", len(history), len(docs))
    t0 = time.perf_counter()
    response = llm.generate_response(
        user_message=message,
        user=user,
        retrieved_docs=docs,
        user_memories=user_mems,
        session_history=history,
    )
    log.info("llm: response ready (%d chars, %.0fms)",
             len(response), (time.perf_counter() - t0) * 1000)

    conversation.append_exchange(
        user["user_id"], message, response,
        intent=intent, retrieved_context=docs,
    )
    total = len(conversation.get_history(user["user_id"]))
    log.info("conversation: persisted exchange (total=%d messages)", total)

    return ChatResponse(
        response=response,
        retrieved_context=docs,
        memory_used=user_mems,
        intent=intent,
        conversation_length=total,
    )


async def _handle_portfolio_update(user, message, target_owner, target_client):
    owner = target_owner or user["user_id"]
    client_id = target_client or "general"

    content = llm.extract_preference(
        user["user_id"],
        f'Extract and format only the portfolio data from this message as a structured portfolio note: "{message}"',
    )
    doc_id = vector.insert_document(
        portfolio_owner=owner,
        client_id=client_id,
        document_type="portfolio_note",
        content=content,
    )
    response_text = (
        f"Portfolio data updated successfully.\n\n"
        f"**Owner:** {owner}  \n**Client:** {client_id}  \n"
        f"**Document ID:** `{doc_id}`\n\n**Stored content:**\n{content}"
    )
    conversation.append_exchange(
        user["user_id"], message, response_text,
        intent="UPDATE_PORTFOLIO", memory_updated=True,
    )
    return ChatResponse(
        response=response_text,
        memory_updated=True,
        intent="UPDATE_PORTFOLIO",
        conversation_length=len(conversation.get_history(user["user_id"])),
    )


async def _handle_client_update(user, message, client_id):
    scopes = rbac.resolve_retrieval_scopes(user, user["user_id"] if user["role"] == "employee" else None)
    docs = []
    try:
        docs = vector.search_documents(
            query=f"portfolio data investments for {client_id}",
            allowed_scopes=scopes,
            top_k=6,
            client_id_filter=client_id,
        )
    except Exception as e:
        print(f"[vector search error] {e}")

    client_pref = memory.get_client_preference(client_id)
    update_text = llm.generate_client_update(
        client_id=client_id,
        docs=docs,
        client_preference=client_pref,
        requesting_user=user,
    )
    pref_note = f"\n\n*Applied client preference: {client_pref['content']}*" if client_pref else ""
    response_text = f"## Weekly Investment Update — {client_id}\n\n{update_text}{pref_note}"
    conversation.append_exchange(
        user["user_id"], message, response_text,
        intent="GENERATE_CLIENT_UPDATE", retrieved_context=docs,
    )
    return ChatResponse(
        response=response_text,
        retrieved_context=docs,
        intent="GENERATE_CLIENT_UPDATE",
        conversation_length=len(conversation.get_history(user["user_id"])),
    )


async def _handle_generate_report(user, message, history):
    all_owners = rbac.get_all_accessible_portfolio_owners(user)
    reports = {}
    for owner in all_owners:
        docs = []
        try:
            docs = vector.search_documents(
                query="portfolio summary performance clients investments",
                allowed_scopes=[owner],
                top_k=8,
            )
        except Exception as e:
            print(f"[vector search error for {owner}] {e}")
        emp_mems = memory.get_user_preferences(owner)
        reports[owner] = llm.generate_employee_report(owner, docs, emp_mems, "weekly")

    summary_parts = [f"### {owner}\n{text}" for owner, text in reports.items()]
    admin_mems = memory.get_user_preferences(user["user_id"])
    org_summary = llm.generate_response(
        user_message="Generate an executive org-wide summary from these employee reports.",
        user=user,
        retrieved_docs=[],
        user_memories=admin_mems,
        session_history=history,
        extra_context="\n\n".join(summary_parts),
    )
    full = (
        "## Weekly Employee Reports\n\n"
        + "\n\n---\n\n".join(summary_parts)
        + "\n\n---\n\n## Organisation-Wide Executive Summary\n\n"
        + org_summary
    )
    conversation.append_exchange(
        user["user_id"], message, full,
        intent="GENERATE_REPORT",
    )
    return ChatResponse(
        response=full,
        intent="GENERATE_REPORT",
        memory_used=admin_mems,
        conversation_length=len(conversation.get_history(user["user_id"])),
    )
