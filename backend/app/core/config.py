"""Application configuration — environment, paths, runtime settings.

User and client records live in the registry service (file-backed, mutable
at runtime). Edit `services/registry.py::_DEFAULT_USERS` only for first-boot
seed values.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
MEMORY_DIR = DATA_DIR / "memory"
CONVERSATION_DIR = DATA_DIR / "conversations"
REGISTRY_DIR = DATA_DIR / "registry"

for d in (MEMORY_DIR, CONVERSATION_DIR, REGISTRY_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ─── LLM ──────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# ─── Vector store (Milvus Lite) ───────────────────────────────────────────────
MILVUS_URI = os.getenv("MILVUS_DB_PATH", str(DATA_DIR / "milvus_poc.db"))
COLLECTION_NAME = "wealth_portfolio"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = 384

# ─── Conversation memory ──────────────────────────────────────────────────────
CONVERSATION_MAX_TURNS = int(os.getenv("CONVERSATION_MAX_TURNS", "100"))
CONVERSATION_CONTEXT_WINDOW = int(os.getenv("CONVERSATION_CONTEXT_WINDOW", "12"))

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost",
).split(",")

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
