"""
LLM service — wraps OpenAI GPT-4o-mini.

Handles: intent classification, preference extraction,
response generation, client update generation, agent report generation.
"""

import re
import json
from openai import OpenAI
from config import OPENAI_API_KEY, LLM_MODEL

_client = OpenAI(api_key=OPENAI_API_KEY)

INTENTS = (
    "QUERY_PORTFOLIO",
    "UPDATE_PORTFOLIO",
    "SET_USER_PREFERENCE",
    "GENERATE_CLIENT_UPDATE",
    "SET_CLIENT_PREFERENCE",
    "GENERATE_REPORT",
    "GENERAL",
)


# ─── Internal helper ───────────────────────────────────────────────────────────

def _chat(system: str, user: str, max_tokens: int = 500) -> str:
    resp = _client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return resp.choices[0].message.content.strip()


def _chat_with_history(system: str, messages: list, max_tokens: int = 2000) -> str:
    full = [{"role": "system", "content": system}] + messages
    resp = _client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=max_tokens,
        messages=full,
    )
    return resp.choices[0].message.content.strip()


# ─── Intent classification ─────────────────────────────────────────────────────

def _keyword_intent(msg: str):
    m = msg.lower()
    for sig in ["set client","change client","update client","client's preference",
                "client's format","client's communication","communication preference",
                "communication format","weekly update format"]:
        if sig in m: return "SET_CLIENT_PREFERENCE"
    for sig in ["from now on","always give me","i prefer ","my preference",
                "make my reports","format my","i want my responses","i'd like my",
                "show me in","give me my answers in"]:
        if sig in m: return "SET_USER_PREFERENCE"
    for sig in ["update my portfolio","add to my portfolio","record that client",
                "store portfolio","add client","add that client","portfolio update"]:
        if sig in m: return "UPDATE_PORTFOLIO"
    for sig in ["generate weekly report","weekly reports for all","generate report for all",
                "generate reports for both","compare agent","org summary",
                "organization summary","generate summary for all agents"]:
        if sig in m: return "GENERATE_REPORT"
    for sig in ["generate.*update for client","weekly update for client",
                "client.*weekly update","send update to client",
                "generate update for","client update"]:
        if re.search(sig, m): return "GENERATE_CLIENT_UPDATE"
    return None


def classify_intent(message: str, user_role: str) -> dict:
    fast = _keyword_intent(message)
    system = "You classify messages for a wealth management AI assistant. Respond ONLY with valid JSON."
    user_prompt = f"""User role: {user_role}
Message: "{message}"

Classify as ONE of: {", ".join(INTENTS)}

Extract (null if not present):
- target_portfolio_owner: "agent_1" or "agent_2" only if message explicitly references another agent's data
- target_client_id: map names: rahul->client_rahul, priya->client_priya, arjun->client_arjun, meera->client_meera

{"Preliminary: " + fast + ". Confirm or correct." if fast else ""}

JSON only:
{{"intent":"...","target_portfolio_owner":null,"target_client_id":null}}"""

    try:
        text = _chat(system, user_prompt, max_tokens=150)
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            result = json.loads(m.group())
            if result.get("intent") not in INTENTS:
                result["intent"] = fast or "QUERY_PORTFOLIO"
            return result
    except Exception as e:
        print(f"[intent error] {e}")
    return {"intent": fast or "QUERY_PORTFOLIO", "target_portfolio_owner": None, "target_client_id": None}


# ─── Preference extraction ─────────────────────────────────────────────────────

def extract_preference(user_id: str, message: str) -> str:
    return _chat(
        "You extract user preferences and rewrite them as clean third-person statements.",
        f'User said: "{message}"\n\nRewrite as a third-person preference for storage. Example: "Agent prefers portfolio summaries in bullet points." Output ONLY the sentence.',
        max_tokens=100,
    )


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_memories(memories: list) -> str:
    if not memories:
        return "No stored preferences. Use a professional default format."
    return "\n".join(f"  • [{m['memory_type']}] {m['content']}" for m in memories)


def _fmt_docs(docs: list) -> str:
    if not docs:
        return "No portfolio data retrieved for this query."
    return "\n\n".join(
        f"[Doc {i}] Owner:{d['portfolio_owner']} | Client:{d['client_id']} | Type:{d['document_type']}\n{d['content']}"
        for i, d in enumerate(docs, 1)
    )


# ─── Main response generation ──────────────────────────────────────────────────

def generate_response(
    user_message: str,
    user: dict,
    retrieved_docs: list,
    user_memories: list,
    session_history: list = None,
    client_preference: dict = None,
    extra_context: str = None,
) -> str:
    allowed = user.get("allowed_portfolio_scope", [])
    scope_desc = "ALL portfolios (Super Admin)" if "*" in allowed else ", ".join(allowed)

    system = f"""You are a secure Wealth Management Assistant.

CURRENT USER
  Name : {user["name"]}
  Role : {user["role"]}
  Scope: {scope_desc}

HARD SECURITY RULES (never violate)
1. Answer ONLY from the retrieved portfolio data provided.
2. Never reveal or infer data outside the user's allowed scope.
3. If no relevant data retrieved, say so — never fabricate figures.
4. Agents may only discuss their own portfolio scope.
5. Super Admin may discuss and compare all agent portfolios.

USER STORED PREFERENCES (apply to format/style)
{_fmt_memories(user_memories)}

CLIENT COMMUNICATION PREFERENCE (apply when generating client update)
{f"Apply strictly: {client_preference['content']}" if client_preference else "N/A"}

ADDITIONAL CONTEXT
{extra_context or "None"}"""

    messages = list((session_history or [])[-6:])
    doc_block = f"\n\n---\nRETRIEVED PORTFOLIO DATA:\n{_fmt_docs(retrieved_docs)}\n---"
    messages.append({"role": "user", "content": user_message + doc_block})
    return _chat_with_history(system, messages, max_tokens=2000)


# ─── Specialised generators ────────────────────────────────────────────────────

def generate_client_update(client_id: str, docs: list, client_preference: dict, requesting_user: dict) -> str:
    style = client_preference["content"] if client_preference else "Professional, concise investment update."
    portfolio_text = "\n\n".join(d["content"] for d in docs) or "No portfolio data found."
    return _chat(
        "You generate client-facing investment updates. Follow the communication style strictly.",
        f"Generate a weekly investment update for client {client_id}.\n\nPORTFOLIO DATA:\n{portfolio_text}\n\nCOMMUNICATION STYLE:\n{style}\n\nDo NOT include internal notes or system metadata.",
        max_tokens=1200,
    )


def generate_agent_report(agent_id: str, docs: list, agent_memories: list, report_type: str = "weekly") -> str:
    pref = "; ".join(m["content"] for m in agent_memories if "preference" in m.get("memory_type",""))
    style = pref or "Professional portfolio report format."
    portfolio_text = "\n\n".join(d["content"] for d in docs) or "No portfolio data found."
    return _chat(
        "You generate internal portfolio reports for wealth management agents.",
        f"Generate a {report_type} portfolio report for {agent_id}.\n\nPORTFOLIO DATA:\n{portfolio_text}\n\nFORMAT: {style}\n\nInclude: summary, client highlights, key metrics, notable changes.",
        max_tokens=1500,
    )
