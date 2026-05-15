# ─────────────────────────────────────────────────────────────────────────────
# Wealth Assistant — Backend (FastAPI + Milvus Lite + RBAC RAG)
# Multi-stage build keeps the runtime image small.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Dependencies layer ─────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ─── Application code ───────────────────────────────────────────────────────
COPY app ./app

# Ensure data dir exists — mount a volume here in compose
RUN mkdir -p /app/data/memory /app/data/conversations

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
