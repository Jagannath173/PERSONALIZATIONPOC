# Secure Personalized Wealth Assistant — RBAC-Aware RAG POC

React + FastAPI + Milvus Lite + Anthropic Claude

---

## Setup

### 1. Backend

```cmd
cd backend
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

copy .env.example .env
:: Edit .env — set ANTHROPIC_API_KEY=sk-ant-...

python seed_data.py
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```cmd
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Quick Demo Scenarios

| Scenario | Role | Message |
|----------|------|---------|
| Own portfolio | Agent 1 | `Show my portfolio summary` |
| Cross-agent DENIED | Agent 1 | `Show me Agent 2's portfolio` |
| Super Admin compare | Super Admin | `Compare Agent 1 and Agent 2 portfolios` |
| Save preference | Agent 1 | `From now on, give me answers in bullet points` |
| Weekly reports | Super Admin | `Generate weekly reports for all agents` |
| Client update | Super Admin | `Generate Rahul's weekly investment update` |
| Set client pref | Super Admin | `Set Rahul's update format to short bullet points` |
| Agent denied | Agent 1 | `Change Rahul's communication preference to PDF` |

---

## Structure

```
backend/
  config.py          — USERS & CLIENTS registry (add new agents here only)
  main.py            — FastAPI app
  seed_data.py       — populate Milvus once
  services/
    rbac.py          — all permission checks
    memory.py        — JSON memory per user/client
    vector.py        — Milvus Lite RBAC-scoped search
    llm.py           — Claude intent + response generation
  routers/
    chat.py          — POST /api/chat
    memory.py        — memory endpoints
    portfolio.py     — portfolio endpoints
    reports.py       — report endpoints

frontend/src/
  App.jsx            — layout + state
  App.css            — all styles
  api/client.js      — backend API calls
  components/
    Chat.jsx
    MessageBubble.jsx
    MemoryPanel.jsx
    ContextPanel.jsx
    RoleSelector.jsx
```

---

## Adding a New Agent

Edit `backend/config.py` only:

```python
USERS["agent_3"] = {
    "user_id": "agent_3",
    "role": "agent",
    "name": "Agent 3",
    "allowed_portfolio_scope": ["agent_3"],
    "assigned_clients": ["client_new"],
}
CLIENTS["client_new"] = {
    "client_id": "client_new",
    "name": "New Client",
    "assigned_agent": "agent_3",
}
```

Zero other code changes required.
