import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, memory, portfolio, reports
from config import USERS, CLIENTS

app = FastAPI(
    title="Secure Personalized Wealth Assistant",
    description="RBAC-Aware RAG + Shared Memory POC",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,      prefix="/api", tags=["Chat"])
app.include_router(memory.router,    prefix="/api", tags=["Memory"])
app.include_router(portfolio.router, prefix="/api", tags=["Portfolio"])
app.include_router(reports.router,   prefix="/api", tags=["Reports"])


@app.get("/api/users")
async def list_users():
    return {
        uid: {
            "user_id": u["user_id"],
            "role": u["role"],
            "name": u["name"],
            "allowed_portfolio_scope": u["allowed_portfolio_scope"],
            "assigned_clients": u.get("assigned_clients", []),
        }
        for uid, u in USERS.items()
    }


@app.get("/api/clients")
async def list_clients():
    return {"clients": CLIENTS}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
