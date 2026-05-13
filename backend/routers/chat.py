"""
Main chat endpoint.

Flow per request:
  1. Identify user
  2. Classify intent (keyword + LLM)
  3. RBAC guard — deny early if not authorised
  4. Route to sub-handler
  5. Return response + debug payload for UI panels
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

import services.rbac as rbac
import services.memory as memory
import services.vector as vector
import services.llm as llm

router = APIRouter()


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    session_history: List[HistoryMessage] = []


class ChatResponse(BaseModel):
    response: str
    retrieved_context: list = []
    memory_used: list = []
    access_denied: bool = False
    denial_reason: str = ""
    memory_updated: bool = False
    intent: str = ""


def _deny(reason: str, intent: str = "") -> ChatResponse:
    return ChatResponse(
        response=reason,
        access_denied=True,
        denial_reason=reason,
        intent=intent,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # 1. Resolve user
    user = rbac.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=401, detail=f"Unknown user: {req.user_id}")

    # 2. Classify intent
    intent_result = llm.classify_intent(req.message, user["role"])
    intent         = intent_result.get("intent", "QUERY_PORTFOLIO")
    target_owner   = intent_result.get("target_portfolio_owner")
    target_client  = intent_result.get("target_client_id")
    history        = [m.model_dump() for m in req.session_history]

    # 3. RBAC guards ────────────────────────────────────────────────────────────

    # Cross-agent portfolio access
    if target_owner and target_owner != req.user_id and not rbac.can_access_portfolio(user, target_owner):
        return _deny(
            f"Access denied: You do not have permission to access {target_owner}'s portfolio data. "
            "Only your own assigned portfolio is accessible.",
            intent,
        )

    # Portfolio update scope
    if intent == "UPDATE_PORTFOLIO":
        update_owner = target_owner or req.user_id
        if not rbac.can_modify_portfolio(user, update_owner):
            return _deny(
                f"Access denied: You do not have permission to update {update_owner}'s portfolio data.",
                intent,
            )

    # Client communication preference modification
    if intent == "SET_CLIENT_PREFERENCE" and not rbac.can_modify_client_preference(user):
        return _deny(
            "Access denied: You do not have permission to modify client communication preferences. "
            "Only the Super Admin can update client communication preferences.",
            intent,
        )

    # Client update — agent can only generate for their assigned clients
    if intent == "GENERATE_CLIENT_UPDATE" and target_client:
        if not rbac.can_access_client(user, target_client):
            return _deny(
                f"Access denied: You do not have permission to generate updates for {target_client}. "
                "You can only generate updates for clients assigned to you.",
                intent,
            )

    # 4. Intent handlers ────────────────────────────────────────────────────────

    if intent == "SET_USER_PREFERENCE":
        pref = llm.extract_preference(req.user_id, req.message)
        memory.add_user_memory(req.user_id, "user_preference", pref)
        return ChatResponse(
            response=f"Got it! Your preference has been saved.\n\n**Stored:** {pref}",
            memory_updated=True,
            intent=intent,
            memory_used=memory.get_user_memories(req.user_id),
        )

    if intent == "SET_CLIENT_PREFERENCE":
        if not target_client:
            return ChatResponse(
                response="Please specify which client's communication preference you'd like to update.",
                intent=intent,
            )
        pref = llm.extract_preference(req.user_id, req.message)
        memory.set_client_preference(target_client, pref, req.user_id)
        return ChatResponse(
            response=f"Client communication preference for **{target_client}** updated.\n\n**Stored:** {pref}",
            memory_updated=True,
            intent=intent,
        )

    if intent == "GENERATE_REPORT":
        return await _handle_generate_report(user, req.message, history)

    if intent == "UPDATE_PORTFOLIO":
        return await _handle_portfolio_update(user, req.message, target_owner, target_client)

    if intent == "GENERATE_CLIENT_UPDATE" and target_client:
        return await _handle_client_update(user, target_client)

    # Default: QUERY_PORTFOLIO / GENERAL
    return await _handle_query(user, req.message, target_owner, target_client, intent, history)


# ─── Sub-handlers ──────────────────────────────────────────────────────────────

async def _handle_query(user, message, target_owner, target_client, intent, history):
    scopes = rbac.resolve_retrieval_scopes(user, target_owner)
    docs = []
    try:
        docs = vector.search_documents(
            query=message,
            allowed_scopes=scopes,
            top_k=6,
            client_id_filter=target_client,
        )
    except Exception as e:
        print(f"[vector search error] {e}")

    user_mems = memory.get_user_preferences(user["user_id"])
    response = llm.generate_response(
        user_message=message,
        user=user,
        retrieved_docs=docs,
        user_memories=user_mems,
        session_history=history,
    )
    return ChatResponse(response=response, retrieved_context=docs, memory_used=user_mems, intent=intent)


async def _handle_portfolio_update(user, message, target_owner, target_client):
    owner = target_owner or user["user_id"]
    client_id = target_client or "general"

    content = llm.extract_preference(
        user["user_id"],
        f'Extract and format only the portfolio data from this message as a structured portfolio note: "{message}"'
    )
    doc_id = vector.insert_document(
        portfolio_owner=owner,
        client_id=client_id,
        document_type="portfolio_note",
        content=content,
    )
    return ChatResponse(
        response=(
            f"Portfolio data updated successfully.\n\n"
            f"**Owner:** {owner}  \n**Client:** {client_id}  \n"
            f"**Document ID:** `{doc_id}`\n\n**Stored content:**\n{content}"
        ),
        memory_updated=True,
        intent="UPDATE_PORTFOLIO",
    )


async def _handle_client_update(user, client_id):
    scopes = rbac.resolve_retrieval_scopes(user, user["user_id"] if user["role"] == "agent" else None)
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
    return ChatResponse(
        response=f"## Weekly Investment Update — {client_id}\n\n{update_text}{pref_note}",
        retrieved_context=docs,
        intent="GENERATE_CLIENT_UPDATE",
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
        agent_mems = memory.get_user_preferences(owner)
        reports[owner] = llm.generate_agent_report(owner, docs, agent_mems, "weekly")

    summary_parts = [f"### {owner}\n{text}" for owner, text in reports.items()]
    admin_mems = memory.get_user_preferences(user["user_id"])
    org_summary = llm.generate_response(
        user_message="Generate an executive org-wide summary from these agent reports.",
        user=user,
        retrieved_docs=[],
        user_memories=admin_mems,
        session_history=history,
        extra_context="\n\n".join(summary_parts),
    )
    full = (
        "## Weekly Agent Reports\n\n"
        + "\n\n---\n\n".join(summary_parts)
        + "\n\n---\n\n## Organisation-Wide Executive Summary\n\n"
        + org_summary
    )
    return ChatResponse(response=full, intent="GENERATE_REPORT", memory_used=admin_mems)
