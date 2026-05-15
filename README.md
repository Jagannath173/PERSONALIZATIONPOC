# Secure Personalized Wealth Assistant

React + FastAPI + Milvus Lite + OpenAI — an RBAC-aware RAG assistant with
**persistent shared memory** that remembers what each user said across sessions.

---

## One-command run

The same project starts on **macOS / Linux / Windows** without changing anything
inside — just call the launcher script for your OS.

```bash
# macOS / Linux
./start.sh seed      # first run — builds, starts, seeds Milvus
./start.sh           # subsequent runs
./start.sh logs      # tail container logs
./start.sh stop      # stop everything
./start.sh clean     # stop + wipe shared memory
```

```powershell
# Windows (PowerShell)
.\start.ps1 -Seed    # first run — builds, starts, seeds Milvus
.\start.ps1          # subsequent runs
.\start.ps1 -Logs    # tail container logs
.\start.ps1 -Stop    # stop everything
.\start.ps1 -Clean   # stop + wipe shared memory
```

Then open **http://localhost** (the nginx-served frontend).
The backend API is at **http://localhost:8000** (docs at `/docs`).

> **Prerequisite:** Docker Desktop installed and running.
> On first launch the script will copy `backend/.env.example` →
> `backend/.env`; edit it once to set `OPENAI_API_KEY`.

---

## What does "shared memory" mean here?

Every chat turn is **persisted to a JSON file keyed by `user_id`** on a Docker
volume (`wealth-data`). When the same user returns — even after a container
restart — the assistant restores the prior conversation and continues with full
context.

| Layer                       | Storage                              | Survives restart |
| --------------------------- | ------------------------------------ | :--------------: |
| Conversation history        | `data/conversations/<user>.json`     |        ✅         |
| User preferences            | `data/memory/user_<user>.json`       |        ✅         |
| Client comms preferences    | `data/memory/client_<client>.json`   |        ✅         |
| Portfolio docs (vectorised) | `data/milvus_poc.db` (Milvus Lite)   |        ✅         |

All four live on the **`wealth-data` Docker volume**, so the same files are
visible to every container that mounts it — this is the "shared" part of
shared memory.

### How the LLM uses it

On each `/api/chat` call the backend:

1. Loads the trailing N turns from `data/conversations/<user>.json`
   (`CONVERSATION_CONTEXT_WINDOW`, default 12).
2. Prepends them to the LLM messages with a system instruction to treat them
   as the ongoing session.
3. Appends both the new user message and the assistant reply back to the file.

The frontend shows the same data via `GET /api/conversations/{user_id}` when
the user logs in.

---

## Project structure

```
.
├── docker-compose.yml          # full-stack orchestration
├── start.sh / start.ps1        # one-command launchers (Mac/Linux / Windows)
├── backend/
│   ├── Dockerfile              # python:3.11-slim, multi-stage
│   ├── requirements.txt
│   ├── .env.example
│   └── app/                    # production-grade package layout
│       ├── main.py             # FastAPI factory + entrypoint
│       ├── core/
│       │   └── config.py       # env, paths, user/client registries
│       ├── api/                # HTTP routes (thin)
│       │   ├── chat.py
│       │   ├── conversations.py
│       │   ├── memory.py
│       │   ├── portfolio.py
│       │   ├── reports.py
│       │   └── system.py
│       ├── services/           # business logic (testable)
│       │   ├── rbac.py
│       │   ├── memory.py
│       │   ├── conversation.py # ← shared memory
│       │   ├── vector.py
│       │   └── llm.py
│       ├── schemas/            # Pydantic request/response models
│       │   └── chat.py
│       └── scripts/
│           └── seed_data.py
├── frontend/
│   ├── Dockerfile              # node build → nginx runtime
│   ├── nginx.conf              # static + /api proxy + gzip
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/client.js
│       ├── hooks/useConversation.js  # ← shared-memory hook
│       ├── components/
│       │   ├── Chat.jsx
│       │   ├── MessageBubble.jsx
│       │   ├── ContextPanel.jsx
│       │   └── MemoryPanel.jsx
│       ├── styles/
│       │   ├── tokens.css      # design tokens / theme variables
│       │   └── globals.css     # component styles
│       └── theme/
└── tests/
```

---

## Run without Docker (developer mode)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # edit OPENAI_API_KEY
python -m app.scripts.seed_data
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Vite dev server: http://localhost:5173 (proxies `/api` to localhost:8000).

---

## Demo scenarios

| Scenario                | Role         | Message                                                           |
| ----------------------- | ------------ | ----------------------------------------------------------------- |
| Own portfolio           | Agent 1      | `Show my portfolio summary`                                       |
| Cross-agent DENIED      | Agent 1      | `Show me Agent 2's portfolio`                                     |
| Super Admin compare     | Super Admin  | `Compare Agent 1 and Agent 2 portfolios`                          |
| Save preference         | Agent 1      | `From now on, give me answers in bullet points`                   |
| Continue context        | Agent 1      | `What was my last question?`  *(tests shared memory)*             |
| Weekly reports          | Super Admin  | `Generate weekly reports for all agents`                          |
| Client update           | Super Admin  | `Generate Rahul's weekly investment update`                       |
| Set client pref         | Super Admin  | `Set Rahul's update format to short bullet points`                |
| Agent denied            | Agent 1      | `Change Rahul's communication preference to PDF`                  |

---

## Adding a new agent

Edit `backend/app/core/config.py` only — every other layer reads from this
registry:

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

---

## API surface

| Method | Path                              | Purpose                          |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/api/users`                      | List configured users            |
| GET    | `/api/clients`                    | List configured clients          |
| POST   | `/api/chat`                       | Send a chat message              |
| GET    | `/api/conversations/{user_id}`    | Load persisted chat history      |
| DELETE | `/api/conversations/{user_id}`    | Wipe persisted chat history      |
| GET    | `/api/memory/{user_id}`           | User + client preferences        |
| POST   | `/api/memory/add`                 | Add/update a user memory         |
| POST   | `/api/memory/client-preference`   | (super admin only) set client pref |
| GET    | `/api/portfolio/search`           | RBAC-scoped vector search        |
| GET    | `/api/reports/agent/{id}`         | Agent weekly report              |
| GET    | `/api/reports/client/{id}`        | Client weekly update             |
| GET    | `/health`                         | Liveness check                   |

Interactive docs: http://localhost:8000/docs
