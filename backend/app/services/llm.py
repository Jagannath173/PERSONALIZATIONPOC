"""LLM service — intent classification, preference extraction, response generation.

Intent classification is fully LLM-driven (no regex / keyword shortcuts).
The classifier is grounded by injecting the live registry of employees and
clients into the prompt, so it adapts automatically when the Super Admin
adds or removes people.
"""

import json

from openai import OpenAI

from app.core.config import LLM_MODEL, OPENAI_API_KEY
from app.core.logging import get
from app.services import registry

_client = OpenAI(api_key=OPENAI_API_KEY)
log = get("llm")

INTENTS = (
    "QUERY_PORTFOLIO",
    "UPDATE_PORTFOLIO",
    "SET_USER_PREFERENCE",
    "GENERATE_CLIENT_UPDATE",
    "SET_CLIENT_PREFERENCE",
    "GENERATE_REPORT",
    "GENERAL",
)

# Human-readable descriptions the classifier sees so it knows WHEN to pick each.
INTENT_DEFINITIONS = {
    "QUERY_PORTFOLIO":
        "User is asking to view portfolio data, AUM, holdings, performance, "
        "or any read-only information about a portfolio.",
    "UPDATE_PORTFOLIO":
        "User is recording a new fact about a portfolio: a holding changed, "
        "a position was added, a balance updated. Anything that should be "
        "WRITTEN to the portfolio knowledge base.",
    "SET_USER_PREFERENCE":
        "User is stating how THEY (the speaker) want THEIR OWN responses "
        "formatted going forward. Phrases like 'I prefer …', 'from now on …', "
        "'format my reports as …' — applies to the caller themselves.",
    "SET_CLIENT_PREFERENCE":
        "User is changing how a specific CLIENT's reports / updates should "
        "be written. The pronoun shifts to the client (e.g. 'set Rahul's "
        "update format to short bullets').",
    "GENERATE_CLIENT_UPDATE":
        "User wants the assistant to PRODUCE a client-facing investment "
        "update for one specific client (e.g. 'generate Priya's weekly "
        "update', 'send Arjun an update').",
    "GENERATE_REPORT":
        "User wants an INTERNAL report — typically covering multiple "
        "employees, the whole organisation, or comparisons between "
        "employees / books. Only super_admin should normally hit this.",
    "GENERAL":
        "Small talk, greetings, meta questions about the prior conversation, "
        "or anything that doesn't match the above.",
}


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


# ─── Intent classification (LLM-driven, registry-grounded) ────────────────────

def _registry_snapshot() -> tuple[str, str]:
    """Snapshot the live registry for grounding the classifier."""
    users   = registry.all_users()
    clients = registry.all_clients()
    emp_lines = [f"  - {u['user_id']}  ({u['name']})"
                 for u in users.values() if u.get("role") == "employee"]
    cli_lines = [f"  - {c['client_id']}  ({c['name']})" for c in clients.values()]
    return (
        "EMPLOYEES:\n" + ("\n".join(emp_lines) if emp_lines else "  (none)"),
        "CLIENTS:\n"   + ("\n".join(cli_lines) if cli_lines else "  (none)"),
    )


def classify_intent(message: str, user: dict) -> dict:
    """
    Pure LLM classification using JSON mode + the live registry. Returns:
        {
          "intent": one of INTENTS,
          "target_portfolio_owner": user_id or null,
          "target_client_id": client_id or null,
          "confidence": 0.0–1.0,
          "reasoning": "short justification"
        }
    """
    emp_block, cli_block = _registry_snapshot()
    intent_doc = "\n".join(f"  - {k}: {v}" for k, v in INTENT_DEFINITIONS.items())

    system = f"""You are the intent router for a Wealth Management AI assistant.
You will be given a single message from a logged-in user and must return ONE
JSON object that classifies the intent and extracts any referenced targets.

OUTPUT SCHEMA (always return JSON in this exact shape — no markdown, no prose):
{{
  "intent": "<one of {', '.join(INTENTS)}>",
  "target_portfolio_owner": "<employee user_id from the registry, or null>",
  "target_client_id": "<client_id from the registry, or null>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<one short sentence>"
}}

INTENT DEFINITIONS
{intent_doc}

EXTRACTION RULES
- target_portfolio_owner: set ONLY when the user explicitly asks about
  ANOTHER employee's portfolio (not their own). Use the canonical user_id
  from the EMPLOYEES list. Leave null when the user is talking about
  themselves or "my portfolio".
- target_client_id: set whenever a client is named anywhere in the message.
  Match by first name against the CLIENTS list — return the canonical
  client_id (e.g. "Rahul" → "client_rahul"). Use null if no client is
  referenced.
- Never invent IDs that are not in the registry below.
- If the message is ambiguous, prefer QUERY_PORTFOLIO and set lower confidence.

LIVE REGISTRY (the authoritative list — only IDs in here are valid)
{emp_block}

{cli_block}

CALLER
  user_id : {user['user_id']}
  role    : {user['role']}
  name    : {user['name']}"""

    raw = None
    try:
        resp = _client.chat.completions.create(
            model=LLM_MODEL,
            temperature=0,
            max_tokens=200,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": message},
            ],
        )
        raw = resp.choices[0].message.content
        result = json.loads(raw)
    except Exception as e:
        log.error("intent classifier failed (%s) — raw=%r", e, raw)
        return {
            "intent": "QUERY_PORTFOLIO",
            "target_portfolio_owner": None,
            "target_client_id": None,
            "confidence": 0.0,
            "reasoning": f"classifier error: {e}",
        }

    # Validate against the schema — clamp anything off-piste.
    if result.get("intent") not in INTENTS:
        log.warning("classifier returned unknown intent %r — defaulting to QUERY_PORTFOLIO",
                    result.get("intent"))
        result["intent"] = "QUERY_PORTFOLIO"

    valid_employees = {u["user_id"] for u in registry.all_users().values()
                       if u.get("role") == "employee"}
    if result.get("target_portfolio_owner") and result["target_portfolio_owner"] not in valid_employees:
        log.warning("classifier returned unknown employee %r — dropping",
                    result["target_portfolio_owner"])
        result["target_portfolio_owner"] = None

    valid_clients = set(registry.all_clients().keys())
    if result.get("target_client_id") and result["target_client_id"] not in valid_clients:
        log.warning("classifier returned unknown client %r — dropping",
                    result["target_client_id"])
        result["target_client_id"] = None

    log.info("intent=%s owner=%s client=%s conf=%.2f reasoning=%r",
             result["intent"],
             result.get("target_portfolio_owner"),
             result.get("target_client_id"),
             float(result.get("confidence", 0)),
             result.get("reasoning", ""))
    return result


# ─── Preference extraction ─────────────────────────────────────────────────────

def extract_preference(user_id: str, message: str) -> str:
    return _chat(
        "You extract user preferences and rewrite them as clean third-person statements.",
        f'User said: "{message}"\n\nRewrite as a third-person preference for storage. Example: "Employee prefers portfolio summaries in bullet points." Output ONLY the sentence.',
        max_tokens=100,
    )


# ─── Formatters ────────────────────────────────────────────────────────────────

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

    history_for_llm = []
    for m in (session_history or [])[-8:]:
        role = m.get("role")
        if role in ("user", "assistant"):
            history_for_llm.append({"role": role, "content": m.get("content", "")})

    system = f"""You are a secure Wealth Management Assistant with persistent memory of this user's prior turns.

CURRENT USER
  Name : {user["name"]}
  Role : {user["role"]}
  Scope: {scope_desc}

HARD SECURITY RULES (never violate)
1. Answer ONLY from the retrieved portfolio data provided.
2. Never reveal or infer data outside the user's allowed scope.
3. If no relevant data retrieved, say so — never fabricate figures.
4. Employees may only discuss their own portfolio scope and their assigned clients.
5. Super Admin may discuss and compare all employees and all clients.

CONVERSATION CONTINUITY
Treat the prior messages as the user's ongoing session — refer back to earlier turns
when the user uses pronouns ("that", "the previous one", "as we discussed").

USER STORED PREFERENCES (apply to format/style)
{_fmt_memories(user_memories)}

CLIENT COMMUNICATION PREFERENCE (apply when generating client update)
{f"Apply strictly: {client_preference['content']}" if client_preference else "N/A"}

ADDITIONAL CONTEXT
{extra_context or "None"}"""

    doc_block = f"\n\n---\nRETRIEVED PORTFOLIO DATA:\n{_fmt_docs(retrieved_docs)}\n---"
    history_for_llm.append({"role": "user", "content": user_message + doc_block})
    return _chat_with_history(system, history_for_llm, max_tokens=2000)


# ─── Specialised generators ────────────────────────────────────────────────────

def generate_client_update(client_id: str, docs: list, client_preference: dict, requesting_user: dict) -> str:
    style = client_preference["content"] if client_preference else "Professional, concise investment update."
    portfolio_text = "\n\n".join(d["content"] for d in docs) or "No portfolio data found."
    return _chat(
        "You generate client-facing investment updates. Follow the communication style strictly.",
        f"Generate a weekly investment update for client {client_id}.\n\nPORTFOLIO DATA:\n{portfolio_text}\n\nCOMMUNICATION STYLE:\n{style}\n\nDo NOT include internal notes or system metadata.",
        max_tokens=1200,
    )


def generate_suggestions(
    user: dict,
    accessible_clients: list,
    sample_docs: list,
    count: int = 6,
) -> list:
    """
    Generate short, contextual prompt suggestions for the logged-in user.

    The caller MUST pass `sample_docs` and `accessible_clients` that already
    respect the user's RBAC scope. This function does not enforce RBAC; it
    only summarises what was given to it.
    """
    scope = "ALL employees and clients (Super Admin)" \
        if user.get("role") == "super_admin" \
        else f"only {user['name']}'s own portfolio and clients"

    if accessible_clients:
        client_lines = "\n".join(
            f"  - {c['client_id']}: {c['name']}" for c in accessible_clients
        )
    else:
        client_lines = "  (none assigned)"

    doc_lines = []
    for d in sample_docs[:8]:
        snippet = (d.get("content") or "").replace("\n", " ")[:160]
        doc_lines.append(
            f"  - [{d.get('document_type')}] client={d.get('client_id')} :: {snippet}…"
        )
    docs_block = "\n".join(doc_lines) if doc_lines else "  (no documents indexed yet)"

    system = (
        "You craft short, useful starter prompts for a Wealth Management "
        "assistant. The prompts must be things THIS specific logged-in user "
        "would realistically want to ask, grounded ONLY in the data the user "
        "actually has access to. Never invent clients or employees. Output "
        "valid JSON: {\"suggestions\": [\"…\", \"…\"]}."
    )

    user_prompt = f"""Generate exactly {count} short prompt suggestions (each
under 80 characters, in second-person imperative, no numbering, no quotes
in the strings themselves).

CALLER
  name : {user['name']}
  role : {user['role']}
  scope: {scope}

THE CALLER'S ACCESSIBLE CLIENTS
{client_lines}

REPRESENTATIVE DOCUMENTS THE CALLER CAN ACCESS (do not echo verbatim — use
to choose what would actually be useful to ask)
{docs_block}

RULES
- Reference clients only by their first name (e.g. "Rahul"), never by ID.
- Mix at least one preference-setting prompt ("From now on…").
- Include at least one action that produces something (update, summary, report).
- If the caller is super_admin, include at least one cross-employee / org-wide prompt.
- If the caller is an employee, NEVER mention another employee or another
  employee's clients.
- Output ONLY the JSON object — no markdown."""

    try:
        resp = _client.chat.completions.create(
            model=LLM_MODEL,
            temperature=0.3,
            max_tokens=400,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user_prompt},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        suggestions = data.get("suggestions") or []
        clean = [s.strip() for s in suggestions if isinstance(s, str) and s.strip()]
        log.info("suggestions: generated %d for user=%s", len(clean), user["user_id"])
        return clean[:count]
    except Exception as e:
        log.error("suggestion generation failed for %s: %s", user["user_id"], e)
        return []


def generate_employee_report(employee_id: str, docs: list, employee_memories: list, report_type: str = "weekly") -> str:
    pref = "; ".join(m["content"] for m in employee_memories if "preference" in m.get("memory_type", ""))
    style = pref or "Professional portfolio report format."
    portfolio_text = "\n\n".join(d["content"] for d in docs) or "No portfolio data found."
    return _chat(
        "You generate internal portfolio reports for wealth management employees.",
        f"Generate a {report_type} portfolio report for {employee_id}.\n\nPORTFOLIO DATA:\n{portfolio_text}\n\nFORMAT: {style}\n\nInclude: summary, client highlights, key metrics, notable changes.",
        max_tokens=1500,
    )
