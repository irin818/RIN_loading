#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  RIN — One-Click Startup Script
#  一键启动脚本
# ============================================================

# Resolve script directory (works even when double-clicked in Finder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- Paths ----
PYTHON_DIR="$SCRIPT_DIR/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
DEFAULT_DATA_DIR="$SCRIPT_DIR/.rin-data"
LOCAL_URL="http://127.0.0.1:8765"
LOCAL_HOST="127.0.0.1"
LOCAL_PORT="8765"

# ---- Load .env overrides (if present) ----
# This lets you customise the adapter, model, ports, etc.
# without editing this script.  Copy .env.example → .env to start.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
    set +a
fi

# ---- Configuration (env vars take precedence) ----
OLLAMA_URL="${RIN_OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${RIN_OLLAMA_MODEL:-qwen3:4b}"
MODEL_ADAPTER="${RIN_MODEL_ADAPTER:-rin-ollama-local}"
TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"
NUM_PREDICT="${RIN_OLLAMA_NUM_PREDICT:-1024}"
DATA_DIR="${RIN_PYTHON_DATA_DIR:-$DEFAULT_DATA_DIR}"

# ---- Internal state ----
SERVER_PID=""
MAX_WAIT="${RIN_STARTUP_TIMEOUT_SEC:-60}"

# ---- Cleanup on exit ----
cleanup() {
    if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        echo ""
        echo "Stopping RIN server (pid $SERVER_PID)..."
        kill "$SERVER_PID" >/dev/null 2>&1 || true
        wait "$SERVER_PID" 2>/dev/null || true
        echo "RIN server stopped."
    fi
}
trap cleanup INT TERM EXIT

# ---- Helpers ----
print_ok()    { echo "  ✅  $*"; }
print_warn()  { echo "  ⚠️   $*"; }
print_err()   { echo "  ❌  $*"; }
print_info()  { echo "  ℹ️   $*"; }
print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║     RIN — Local Personal AI Runtime       ║"
    echo "╠════════════════════════════════════════════╣"
    echo "║  URL:      $LOCAL_URL          ║"
    printf "║  Adapter:  %-32s ║\n" "$MODEL_ADAPTER"
    echo "╚════════════════════════════════════════════╝"
    echo ""
}

# ---- Step 1: find a working Python ----
find_python() {
    # Prefer the venv python if it already exists; otherwise pick system python3
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

PYTHON_BIN="$(find_python)"
if [[ -z "$PYTHON_BIN" ]]; then
    print_err "No Python 3 installation found."
    echo "  Install Python 3.12+ from https://www.python.org/downloads/"
    echo "  or via Homebrew:  brew install python@3.12"
    exit 1
fi
print_ok "Python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"

# ---- Step 2: ensure venv exists ----
if [[ ! -x "$VENV_PYTHON" ]]; then
    print_warn "Python venv not found — creating it now..."
    "$PYTHON_BIN" -m venv "$PYTHON_DIR/.venv" || {
        print_err "Failed to create Python venv at $PYTHON_DIR/.venv"
        exit 1
    }
    print_ok "Venv created."
fi

# ---- Step 3: ensure packages are installed ----
if ! "$VENV_PYTHON" -c "import fastapi, jinja2, uvicorn, rin" >/dev/null 2>&1; then
    print_warn "Python packages missing — installing now..."
    "$VENV_PYTHON" -m pip install -e "$PYTHON_DIR[dev]" --quiet || {
        print_err "Failed to install Python packages."
        echo "  Try manually: cd $PYTHON_DIR && .venv/bin/pip install -e '.[dev]'"
        exit 1
    }
    print_ok "Packages installed."
fi

# ---- Step 4: port conflict detection ----
if lsof -i ":$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    # Something is listening on our port — check if it's RIN
    if curl -fsS "$LOCAL_URL" >/dev/null 2>&1; then
        print_ok "RIN is already running at $LOCAL_URL"
        print_info "Opening browser..."
        open "$LOCAL_URL"
        exit 0
    else
        print_err "Port $LOCAL_PORT is in use by another process:"
        lsof -i ":$LOCAL_PORT" -sTCP:LISTEN
        echo ""
        echo "  Kill the conflicting process or set a different port via .env:"
        echo "    RIN_PORT=8766"
        exit 1
    fi
fi

# ---- Step 5: pre-flight checks ----
case "$MODEL_ADAPTER" in
    rin-ollama-local)
        if curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
            print_ok "Ollama reachable at $OLLAMA_URL"
            if curl -fsS "$OLLAMA_URL/api/tags" 2>/dev/null | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$OLLAMA_MODEL\""; then
                print_ok "Model '$OLLAMA_MODEL' is available."
            else
                print_warn "Model '$OLLAMA_MODEL' not pulled yet."
                echo "         Pull it:  ollama pull $OLLAMA_MODEL"
                echo "         Starting anyway — chat will fail until the model is ready."
            fi
        else
            print_warn "Ollama is not reachable at $OLLAMA_URL"
            echo "         Start Ollama first, then re-launch this script."
            echo "         Starting anyway — chat will fail without a model backend."
        fi
        ;;
    rin-mock-local)
        print_info "Mock adapter — no external model needed."
        ;;
    *)
        print_info "Adapter: $MODEL_ADAPTER"
        ;;
esac

# ---- Step 6: ensure data directory exists ----
mkdir -p "$DATA_DIR"

# ---- Step 7: export environment ----
export RIN_PYTHON_DATA_DIR="$DATA_DIR"
export RIN_MODEL_ADAPTER="$MODEL_ADAPTER"
export RIN_OLLAMA_BASE_URL="$OLLAMA_URL"
export RIN_OLLAMA_MODEL="$OLLAMA_MODEL"
export RIN_OLLAMA_TIMEOUT_MS="$TIMEOUT_MS"
export RIN_OLLAMA_NUM_PREDICT="$NUM_PREDICT"

# ---- Step 8: start the server ----
print_banner
echo "Starting RIN Python server..."

"$VENV_PYTHON" -m rin.cli.production_server &
SERVER_PID=$!

# ---- Step 9: wait until the server responds, then open browser ----
echo "Waiting for server to be ready"
echo -n "  "
WAITED=0
SERVER_READY=0

while [[ $WAITED -lt $MAX_WAIT ]]; do
    if curl -fsS --connect-timeout 1 --max-time 2 "$LOCAL_URL" >/dev/null 2>&1; then
        SERVER_READY=1
        break
    fi

    # Server died? bail out
    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        wait "$SERVER_PID" 2>/dev/null || true
        echo ""
        print_err "RIN server exited before becoming ready (exit code ${PIPESTATUS[0]:-unknown})."
        echo "  Check the output above for Python traceback details."
        exit 1
    fi

    sleep 1
    WAITED=$((WAITED + 1))
    # Print a dot every 2 s so the user sees progress
    if [[ $((WAITED % 2)) -eq 0 ]]; then
        echo -n "."
    fi
done

if [[ $SERVER_READY -eq 0 ]]; then
    echo ""
    print_err "Timed out after ${MAX_WAIT}s waiting for RIN at $LOCAL_URL"
    print_info "The server may still be starting — check the output above."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    exit 1
fi

# ---- Step 10: open browser ----
echo ""
print_ok "RIN server is ready (took ${WAITED}s)."
print_info "Opening $LOCAL_URL in your browser..."
sleep 0.5

# Try the primary open method; fall back if needed
if ! open "$LOCAL_URL" 2>/dev/null; then
    print_warn "'open' command failed — you can manually visit:"
    echo "         $LOCAL_URL"
fi

echo ""
echo "  Press Ctrl-C to stop the server."
echo ""

# ---- Step 11: wait for server to exit ----
wait "$SERVER_PID" || true
echo ""
echo "RIN server exited."
