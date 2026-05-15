"""Structured logging — one nicely-formatted line per pipeline step."""

import logging
import sys

LOG_FORMAT = "%(asctime)s %(levelname)-5s [%(name)s] %(message)s"
DATE_FORMAT = "%H:%M:%S"


def configure(level: str = "INFO") -> None:
    root = logging.getLogger()
    if root.handlers:
        return  # already configured (e.g. uvicorn reload)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Quiet the noisy libs
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)


def get(name: str) -> logging.Logger:
    return logging.getLogger(name)
