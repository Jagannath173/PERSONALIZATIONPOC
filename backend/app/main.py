"""FastAPI entrypoint — wires routers, CORS, logging, and lifespan."""

import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import (
    admin,
    auth,
    chat,
    conversations,
    memory,
    portfolio,
    reports,
    suggestions,
    system,
    upload,
)
from app.core import logging as applog
from app.core.config import CORS_ORIGINS, LOG_LEVEL

applog.configure(LOG_LEVEL)
log = applog.get("http")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Secure Personalized Wealth Assistant",
        description="RBAC-Aware RAG + Shared Memory POC",
        version=__version__,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = (time.perf_counter() - started) * 1000
        log.info("%s %s → %d  %.0fms",
                 request.method, request.url.path, response.status_code, elapsed)
        return response

    app.include_router(auth.router,          prefix="/api", tags=["Auth"])
    app.include_router(admin.router,         prefix="/api", tags=["Admin"])
    app.include_router(upload.router,        prefix="/api", tags=["Admin"])
    app.include_router(chat.router,          prefix="/api", tags=["Chat"])
    app.include_router(conversations.router, prefix="/api", tags=["Conversations"])
    app.include_router(memory.router,        prefix="/api", tags=["Memory"])
    app.include_router(portfolio.router,     prefix="/api", tags=["Portfolio"])
    app.include_router(reports.router,       prefix="/api", tags=["Reports"])
    app.include_router(suggestions.router,   prefix="/api", tags=["Suggestions"])
    app.include_router(system.router,        prefix="/api", tags=["System"])

    @app.on_event("startup")
    async def _startup():
        log.info("Wealth Assistant API v%s started (log level %s)", __version__, LOG_LEVEL)

    @app.get("/health")
    async def health():
        return {"status": "ok", "version": __version__}

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
