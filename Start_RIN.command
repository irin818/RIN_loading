#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  RIN One-Click Launcher
#  Backend:  http://127.0.0.1:8765
#  Frontend: http://127.0.0.1:5173
#
#  Secrets policy:
#  - .env.example is the committed template.
#  - .env is the local untracked secret/config file.
#  - This launcher may report whether a key is present, but it must never print it.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_DIR="$SCRIPT_DIR/python"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
DEFAULT_DATA_DIR="$SCRIPT_DIR/.rin-data"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE_FILE="$SCRIPT_DIR/.env.example"

LOCAL_HOST="127.0.0.1"
LOCAL_PORT="8765"
LOCAL_URL="http://${LOCAL_HOST}:${LOCAL_PORT}"
BACKEND_READY_URL="$LOCAL_URL/api/glitch-core/snapshot"

FRONTEND_HOST="${RIN_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${RIN_FRONTEND_PORT:-5173}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

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

load_local_env() {
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        # shellcheck source=/dev/null
        source "$ENV_FILE"
        set +a
        print_ok "Loaded local environment from .env"
        return
    fi

    print_warn "No local .env file found."
    if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
        echo "       Create one with: cp .env.example .env"
        echo "       Then edit .env and set RIN_API_CHAT_KEY."
    else
        echo "       .env.example is also missing; use shell exports for API config."
    fi
}

check_env_file_safety() {
    if [[ ! -f "$ENV_FILE" ]]; then
        return
    fi

    if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if git ls-files --error-unmatch .env >/dev/null 2>&1; then
            print_err ".env is tracked by Git. Remove it from version control immediately."
            echo "       Run: git rm --cached .env"
            exit 1
        fi

        if git check-ignore -q .env; then
            print_ok ".env is ignored by Git."
        else
            print_warn ".env is not ignored by Git. Add '.env' to .gitignore before committing."
        fi
    fi
}

read_runtime_config() {
    CHAT_PROVIDER="${RIN_CHAT_PROVIDER:-openai-compatible}"
    API_CHAT_BASE_URL="${RIN_API_CHAT_BASE_URL:-}"
    API_CHAT_MODEL="${RIN_API_CHAT_MODEL:-deepseek-v4-flash}"
    API_CHAT_TIMEOUT_MS="${RIN_API_CHAT_TIMEOUT_MS:-180000}"
    API_CHAT_TEMPERATURE="${RIN_API_CHAT_TEMPERATURE:-0.5}"
    API_CHAT_MAX_TOKENS="${RIN_API_CHAT_MAX_TOKENS:-1024}"
    API_CHAT_TOP_P="${RIN_API_CHAT_TOP_P:-0.9}"
    API_CHAT_THINKING="${RIN_API_CHAT_THINKING:-}"

    COST_INPUT_PER_1K_TOKENS_CNY="${RIN_COST_INPUT_PER_1K_TOKENS_CNY:-0.001}"
    COST_OUTPUT_PER_1K_TOKENS_CNY="${RIN_COST_OUTPUT_PER_1K_TOKENS_CNY:-0.002}"
    COST_CURRENCY="${RIN_COST_CURRENCY:-CNY}"

    DATA_DIR="${RIN_PYTHON_DATA_DIR:-$DEFAULT_DATA_DIR}"
}

validate_runtime_config() {
    if [[ "$CHAT_PROVIDER" != "openai-compatible" ]]; then
        print_err "Unsupported RIN_CHAT_PROVIDER: $CHAT_PROVIDER"
        echo "       Supported value: openai-compatible"
        exit 1
    fi

    case "$API_CHAT_THINKING" in
        ""|disabled|enabled)
            ;;
        *)
            print_err "Invalid RIN_API_CHAT_THINKING: $API_CHAT_THINKING"
            echo "       Supported values: disabled, enabled, or empty/unset."
            exit 1
            ;;
    esac
}

print_banner() {
    echo ""
    echo "============================================================"
    echo " RIN Local Runtime"
    echo " Backend:  $LOCAL_URL"
    echo " Frontend: $FRONTEND_URL"
    echo " UI:       $UI_URL"
    echo " Provider: $CHAT_PROVIDER"
    echo " Model:    $API_CHAT_MODEL"
    echo " Thinking: ${API_CHAT_THINKING:-unset}"
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

verify_background_image() {
    local bg_path="$FRONTEND_DIR/public/picture/rin-core-background.png"
    if [[ -f "$bg_path" ]]; then
        print_ok "Glitch Core background: frontend/public/picture/rin-core-background.png"
    else
        print_warn "Glitch Core background image not found: $bg_path"
        echo "       The Core background image is missing. Place rin-core-background.png in frontend/public/picture/"
    fi
}

check_chat_provider_config() {
    print_info "Chat provider: $CHAT_PROVIDER"
    print_info "Chat model: $API_CHAT_MODEL"
    print_info "Thinking mode: ${API_CHAT_THINKING:-unset}"

    if [[ -z "$API_CHAT_BASE_URL" ]]; then
        print_warn "RIN_API_CHAT_BASE_URL is not set. Chat will fail safely with API_PROVIDER_UNCONFIGURED."
    else
        print_ok "API base URL configured."
    fi

    if [[ -z "${RIN_API_CHAT_KEY:-}" ]]; then
        print_warn "RIN_API_CHAT_KEY is not set. Chat will fail safely with API_PROVIDER_UNCONFIGURED."
    else
        print_ok "API key env var is present."
    fi

    print_info "Cost estimate: input=${COST_INPUT_PER_1K_TOKENS_CNY}/${COST_CURRENCY} per 1K, output=${COST_OUTPUT_PER_1K_TOKENS_CNY}/${COST_CURRENCY} per 1K"
}

export_runtime_env() {
    mkdir -p "$DATA_DIR"

    export RIN_PYTHON_DATA_DIR="$DATA_DIR"

    export RIN_CHAT_PROVIDER="$CHAT_PROVIDER"
    export RIN_API_CHAT_MODEL="$API_CHAT_MODEL"
    export RIN_API_CHAT_TIMEOUT_MS="$API_CHAT_TIMEOUT_MS"
    export RIN_API_CHAT_TEMPERATURE="$API_CHAT_TEMPERATURE"
    export RIN_API_CHAT_MAX_TOKENS="$API_CHAT_MAX_TOKENS"
    export RIN_API_CHAT_TOP_P="$API_CHAT_TOP_P"

    export RIN_COST_INPUT_PER_1K_TOKENS_CNY="$COST_INPUT_PER_1K_TOKENS_CNY"
    export RIN_COST_OUTPUT_PER_1K_TOKENS_CNY="$COST_OUTPUT_PER_1K_TOKENS_CNY"
    export RIN_COST_CURRENCY="$COST_CURRENCY"

    if [[ -n "$API_CHAT_BASE_URL" ]]; then
        export RIN_API_CHAT_BASE_URL="$API_CHAT_BASE_URL"
    fi

    if [[ -n "$API_CHAT_THINKING" ]]; then
        export RIN_API_CHAT_THINKING="$API_CHAT_THINKING"
    else
        unset RIN_API_CHAT_THINKING || true
    fi
}

run_optional_api_smoke() {
    if [[ "${RIN_RUN_API_SMOKE_ON_START:-0}" != "1" ]]; then
        return
    fi

    echo ""
    print_info "Running optional API chat smoke test..."
    (cd "$PYTHON_DIR" && "$VENV_PYTHON" -m rin.cli.api_chat_smoke)
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

load_local_env
check_env_file_safety
read_runtime_config
validate_runtime_config
print_banner
ensure_python_runtime
ensure_frontend_runtime
verify_background_image
check_chat_provider_config
export_runtime_env
run_optional_api_smoke
start_backend
start_frontend

echo ""
print_info "Opening $UI_URL"
open "$UI_URL"

echo ""
print_ok "RIN is running. Close this terminal window or press Ctrl+C to stop backend/frontend started by this launcher."

wait