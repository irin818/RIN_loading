#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  RIN One-Click Launcher
#  Backend:  http://127.0.0.1:8765
#  Frontend: http://127.0.0.1:5173
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_DIR="$SCRIPT_DIR/python"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
DEFAULT_DATA_DIR="$SCRIPT_DIR/.rin-data"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
    set +a
fi

LOCAL_HOST="127.0.0.1"
LOCAL_PORT="8765"
LOCAL_URL="http://127.0.0.1:8765"
BACKEND_READY_URL="$LOCAL_URL/api/glitch-core/snapshot"

FRONTEND_HOST="${RIN_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${RIN_FRONTEND_PORT:-5173}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

OLLAMA_URL="${RIN_OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${RIN_OLLAMA_MODEL:-qwen3:4b}"
MODEL_ADAPTER="${RIN_MODEL_ADAPTER:-rin-ollama-local}"
TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"
NUM_PREDICT="${RIN_OLLAMA_NUM_PREDICT:-1024}"
DATA_DIR="${RIN_PYTHON_DATA_DIR:-$DEFAULT_DATA_DIR}"

# The preferred UI is the Vite Glitch Core shell. Keep the env override for
# local experiments, for example RIN_STARTUP_UI_PATH=/glitch-core.
UI_PATH="${RIN_STARTUP_UI_PATH:-/}"
if [[ "$UI_PATH" != /* ]]; then
    UI_PATH="/$UI_PATH"
fi
UI_URL="$FRONTEND_URL$UI_PATH"

SERVER_PID=""
FRONTEND_PID=""
MAX_WAIT="${RIN_STARTUP_TIMEOUT_SEC:-60}"

cleanup() {
    if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
        echo ""
        echo "Stopping RIN frontend (pid $FRONTEND_PID)..."
        kill "$FRONTEND_PID" >/dev/null 2>&1 || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi

    if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        echo ""
        echo "Stopping RIN backend (pid $SERVER_PID)..."
        kill "$SERVER_PID" >/dev/null 2>&1 || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup INT TERM EXIT

print_ok() { echo "  OK   $*"; }
print_warn() { echo "  WARN $*"; }
print_err() { echo "  ERR  $*"; }
print_info() { echo "  INFO $*"; }

print_banner() {
    echo ""
    echo "============================================================"
    echo " RIN Local Runtime"
    echo " Backend:  $LOCAL_URL"
    echo " Frontend: $FRONTEND_URL"
    echo " UI:       $UI_URL"
    echo " Adapter:  $MODEL_ADAPTER"
    echo "============================================================"
    echo ""
}

find_python() {
    if [[ -x "$VENV_PYTHON" ]]; then
        echo "$VENV_PYTHON"
        return
    fi

    for candidate in python3.12 python3.13 python3.11 python3; do
        if command -v "$candidate" >/dev/null 2>&1; then
            echo "$candidate"
            return
        fi
    done

    echo ""
}

port_in_use() {
    local port="$1"
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_url() {
    local url="$1"
    local name="$2"
    local waited=0

    echo "Waiting for $name at $url"
    while [[ $waited -lt $MAX_WAIT ]]; do
        if curl -fsS --connect-timeout 1 --max-time 2 "$url" >/dev/null 2>&1; then
            print_ok "$name is ready."
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    print_err "$name did not become ready after ${MAX_WAIT}s."
    return 1
}

ensure_python_runtime() {
    if [[ ! -d "$PYTHON_DIR" ]]; then
        print_err "Python directory not found: $PYTHON_DIR"
        exit 1
    fi

    local python_bin
    python_bin="$(find_python)"
    if [[ -z "$python_bin" ]]; then
        print_err "No Python 3 installation found."
        echo "Install Python 3.12+ or use Homebrew: brew install python@3.12"
        exit 1
    fi
    print_ok "Python: $python_bin ($($python_bin --version 2>&1))"

    if [[ ! -x "$VENV_PYTHON" ]]; then
        print_warn "Python venv not found. Creating python/.venv..."
        "$python_bin" -m venv "$PYTHON_DIR/.venv"
    fi

    if ! "$VENV_PYTHON" -c "import fastapi, jinja2, uvicorn, rin" >/dev/null 2>&1; then
        print_warn "Python packages missing. Installing python package..."
        "$VENV_PYTHON" -m pip install -e "$PYTHON_DIR[dev]" --quiet
    fi
}

ensure_frontend_runtime() {
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        print_err "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        print_err "npm is not installed or not available in PATH."
        echo "Install Node.js first, then rerun this launcher."
        exit 1
    fi

    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        print_warn "frontend/node_modules not found. Running npm install..."
        (cd "$FRONTEND_DIR" && npm install)
    fi
}

check_model_backend() {
    case "$MODEL_ADAPTER" in
        rin-ollama-local)
            if curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
                print_ok "Ollama reachable at $OLLAMA_URL"
                if curl -fsS "$OLLAMA_URL/api/tags" 2>/dev/null | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$OLLAMA_MODEL\""; then
                    print_ok "Model '$OLLAMA_MODEL' is available."
                else
                    print_warn "Model '$OLLAMA_MODEL' is not pulled yet."
                    echo "Run: ollama pull $OLLAMA_MODEL"
                fi
            else
                print_warn "Ollama is not reachable at $OLLAMA_URL"
                echo "Chat may fail until the local model backend is running."
            fi
            ;;
        rin-mock-local)
            print_info "Mock adapter selected. No model backend needed."
            ;;
        *)
            print_info "Adapter: $MODEL_ADAPTER"
            ;;
    esac
}

export_runtime_env() {
    mkdir -p "$DATA_DIR"
    export RIN_PYTHON_DATA_DIR="$DATA_DIR"
    export RIN_MODEL_ADAPTER="$MODEL_ADAPTER"
    export RIN_OLLAMA_BASE_URL="$OLLAMA_URL"
    export RIN_OLLAMA_MODEL="$OLLAMA_MODEL"
    export RIN_OLLAMA_TIMEOUT_MS="$TIMEOUT_MS"
    export RIN_OLLAMA_NUM_PREDICT="$NUM_PREDICT"
}

start_backend() {
    if port_in_use "$LOCAL_PORT"; then
        if curl -fsS "$BACKEND_READY_URL" >/dev/null 2>&1; then
            print_ok "RIN backend already running at $LOCAL_URL"
            return
        fi
        print_err "Port $LOCAL_PORT is in use, but RIN backend is not responding."
        lsof -iTCP:"$LOCAL_PORT" -sTCP:LISTEN || true
        exit 1
    fi

    echo "Starting RIN backend..."
    (cd "$PYTHON_DIR" && "$VENV_PYTHON" -m rin.cli.production_server) &
    SERVER_PID=$!
    wait_for_url "$BACKEND_READY_URL" "backend"
}

start_frontend() {
    if port_in_use "$FRONTEND_PORT"; then
        if curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
            print_ok "RIN frontend already running at $FRONTEND_URL"
            return
        fi
        print_err "Port $FRONTEND_PORT is in use, but the frontend is not responding."
        lsof -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN || true
        exit 1
    fi

    echo "Starting RIN Glitch Core frontend..."
    (cd "$FRONTEND_DIR" && npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT") &
    FRONTEND_PID=$!
    wait_for_url "$FRONTEND_URL" "frontend"
}

print_banner
ensure_python_runtime
ensure_frontend_runtime
check_model_backend
export_runtime_env
start_backend
start_frontend

echo ""
print_info "Opening $UI_URL"
open "$UI_URL"

echo ""
echo "RIN is running."
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $LOCAL_URL"
echo "Press Ctrl-C to stop services launched by this window."
echo ""

if [[ -n "${SERVER_PID:-}" ]]; then
    wait "$SERVER_PID" || true
else
    while true; do
        sleep 3600
    done
fi
