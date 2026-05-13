import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Milvus Lite — file-based, no separate server required
MILVUS_URI = os.getenv("MILVUS_DB_PATH", "./milvus_poc.db")
COLLECTION_NAME = "wealth_portfolio"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

MEMORY_DIR = os.path.join(os.path.dirname(__file__), "data", "memory")

# ─── User Registry ─────────────────────────────────────────────────────────────
# Single source of truth. Add a new agent here — zero other code changes needed.
USERS: dict = {
    "super_admin": {
        "user_id": "super_admin",
        "role": "super_admin",
        "name": "Super Admin",
        "allowed_portfolio_scope": ["*"],
        "assigned_clients": [],
    },
    "agent_1": {
        "user_id": "agent_1",
        "role": "agent",
        "name": "Agent 1",
        "allowed_portfolio_scope": ["agent_1"],
        "assigned_clients": ["client_rahul", "client_priya"],
    },
    "agent_2": {
        "user_id": "agent_2",
        "role": "agent",
        "name": "Agent 2",
        "allowed_portfolio_scope": ["agent_2"],
        "assigned_clients": ["client_arjun", "client_meera"],
    },
}

# ─── Client Registry ───────────────────────────────────────────────────────────
CLIENTS: dict = {
    "client_rahul": {"client_id": "client_rahul", "name": "Rahul", "assigned_agent": "agent_1"},
    "client_priya": {"client_id": "client_priya", "name": "Priya", "assigned_agent": "agent_1"},
    "client_arjun": {"client_id": "client_arjun", "name": "Arjun", "assigned_agent": "agent_2"},
    "client_meera": {"client_id": "client_meera", "name": "Meera", "assigned_agent": "agent_2"},
}
