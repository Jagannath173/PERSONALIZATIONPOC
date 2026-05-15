#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Wealth Assistant — macOS / Linux launcher (no Docker required)
#
#  Usage from the project root:
#      ./start.sh              first-time setup + start backend + frontend
#      ./start.sh seed         (re)seed Milvus with sample portfolio data
#      ./start.sh stop         stop backend + frontend
#      ./start.sh logs         tail backend.log and frontend.log
#      ./start.sh status       show what's running
#      ./start.sh clean        stop, wipe venv/node_modules/memory
#
#  Requirements: Python 3.10+, Node.js 18+
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
PID_DIR="$ROOT/.run"
mkdir -p "$PID_DIR"

C_CYAN='\033[36m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_DIM='\033[2m'; C_OFF='\033[0m'
say()  { printf "${C_CYAN}» %s${C_OFF}\n" "$1"; }
ok()   { printf "${C_GREEN}✓ %s${C_OFF}\n" "$1"; }
warn() { printf "${C_YELLOW}! %s${C_OFF}\n" "$1"; }
err()  { printf "${C_RED}✗ %s${C_OFF}\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1; }

# ─── Detect runtimes ─────────────────────────────────────────────────────────
if   need python3; then PY=python3
elif need python;  then PY=python
else err "Python 3 not found. Install from https://www.python.org/downloads/"; exit 1
fi
need node || { err "Node.js not found. Install from https://nodejs.org/"; exit 1; }
need npm  || { err "npm not found.";  exit 1; }

VENV="$ROOT/backend/venv"
VENV_PY="$VENV/bin/python"
VENV_PIP="$VENV/bin/pip"
VENV_UV="$VENV/bin/uvicorn"

# ─── Helpers ─────────────────────────────────────────────────────────────────
ensure_env() {
    if [[ ! -f backend/.env ]]; then
        if [[ -f backend/.env.example ]]; then
            cp backend/.env.example backend/.env
            warn "Created backend/.env from .env.example — edit it to set OPENAI_API_KEY"
        else
            err "Missing backend/.env (and no .env.example)"; exit 1
        fi
    fi
}

setup_backend() {
    if [[ ! -d "$VENV" ]]; then
        say "Creating Python virtual environment..."
        $PY -m venv "$VENV"
    fi

    local stamp="$VENV/.deps-installed"
    if [[ ! -f "$stamp" ]] || [[ backend/requirements.txt -nt "$stamp" ]]; then
        say "Installing backend dependencies (may take a few minutes the first time)..."
        "$VENV_PIP" install -q --upgrade pip setuptools wheel
        "$VENV_PIP" install -q -r backend/requirements.txt
        touch "$stamp"
    fi
    ok "Backend ready"
}

setup_frontend() {
    if [[ ! -d frontend/node_modules ]]; then
        say "Installing frontend dependencies..."
        (cd frontend && npm install --silent --no-audit --no-fund)
    fi
    ok "Frontend ready"
}

is_running() {
    local pidfile="$PID_DIR/$1.pid"
    [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

start_backend() {
    if is_running backend; then
        warn "Backend already running (PID $(cat "$PID_DIR/backend.pid"))"
        return
    fi
    say "Starting backend on http://localhost:8000 ..."
    (
        cd backend
        nohup "$VENV_UV" app.main:app --host 0.0.0.0 --port 8000 --reload \
            > "$PID_DIR/backend.log" 2>&1 &
        echo $! > "$PID_DIR/backend.pid"
    )

    # Wait until /health responds (max ~30s) — the first import of
    # sentence-transformers can take a while.
    for _ in $(seq 1 60); do
        if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
            ok "Backend is healthy (PID $(cat "$PID_DIR/backend.pid"))"
            return
        fi
        sleep 0.5
    done
    warn "Backend did not respond to /health within 30s — check $PID_DIR/backend.log"
}

start_frontend() {
    if is_running frontend; then
        warn "Frontend already running (PID $(cat "$PID_DIR/frontend.pid"))"
        return
    fi
    say "Starting frontend on http://localhost:5173 ..."
    (
        cd frontend
        nohup npm run dev > "$PID_DIR/frontend.log" 2>&1 &
        echo $! > "$PID_DIR/frontend.pid"
    )
    sleep 2
    ok "Frontend running (PID $(cat "$PID_DIR/frontend.pid"))"
}

stop_one() {
    local name=$1
    local pidfile="$PID_DIR/$name.pid"
    if [[ -f "$pidfile" ]]; then
        local pid; pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            # kill the process group so child workers also exit
            kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
            sleep 0.4
            kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
            ok "Stopped $name (PID $pid)"
        else
            warn "$name was not running"
        fi
        rm -f "$pidfile"
    else
        warn "No $name PID file"
    fi
}

seed_data() {
    say "Seeding Milvus with portfolio data + client preferences..."
    (cd backend && "$VENV_PY" -m app.scripts.seed_data)
    ok "Seed complete"
}

# ─── Dispatch ────────────────────────────────────────────────────────────────
cmd="${1:-up}"

case "$cmd" in
    up|start|"")
        ensure_env
        setup_backend
        setup_frontend

        # First-run convenience: seed if there's no Milvus DB yet
        if [[ ! -f backend/data/milvus_poc.db && ! -f backend/milvus_poc.db ]]; then
            warn "No Milvus DB found — seeding sample portfolio data..."
            seed_data
        fi

        start_backend
        start_frontend
        echo
        ok "Wealth Assistant is running:"
        printf "   ${C_GREEN}Web UI ${C_OFF}: http://localhost:5173\n"
        printf "   API    : http://localhost:8000\n"
        printf "   Docs   : http://localhost:8000/docs\n"
        echo
        printf "${C_DIM}./start.sh logs    tail backend + frontend logs\n"
        printf "./start.sh status  show what's running\n"
        printf "./start.sh stop    stop everything\n"
        printf "./start.sh seed    reseed Milvus${C_OFF}\n"
        ;;
    seed)
        ensure_env
        setup_backend
        seed_data
        ;;
    stop|down)
        stop_one backend
        stop_one frontend
        ;;
    restart)
        stop_one backend
        stop_one frontend
        exec "$0" up
        ;;
    logs)
        shopt -s nullglob
        logs=("$PID_DIR"/*.log)
        if (( ${#logs[@]} == 0 )); then
            warn "No logs yet — run './start.sh' first"
        else
            say "Tailing ${logs[*]##*/} — Ctrl-C to stop"
            tail -F "${logs[@]}"
        fi
        ;;
    status)
        for s in backend frontend; do
            if is_running "$s"; then
                ok "$s running (PID $(cat "$PID_DIR/$s.pid"))"
            else
                warn "$s not running"
            fi
        done
        ;;
    clean)
        stop_one backend; stop_one frontend
        warn "Removing venv, node_modules, persisted memory, Milvus DB..."
        rm -rf "$VENV" frontend/node_modules \
               backend/data/conversations backend/data/memory \
               backend/data/milvus_poc.db* backend/milvus_poc.db*
        ok "Clean complete"
        ;;
    *)
        echo "Usage: ./start.sh [up|seed|stop|restart|logs|status|clean]"
        exit 1
        ;;
esac
