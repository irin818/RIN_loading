#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_DIR="$SCRIPT_DIR/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
PRODUCTION_DATA="$SCRIPT_DIR/.rin-data"
MARKER="$PRODUCTION_DATA/config/python_cutover_marker.json"
LOCAL_URL="http://127.0.0.1:8765/"
OLLAMA_URL="${RIN_OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${RIN_OLLAMA_MODEL:-qwen3:4b}"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo
    echo "Stopping RIN server..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "RIN Local Console"
echo "Default launcher: local Ollama / $OLLAMA_MODEL"
echo "URL: $LOCAL_URL"
echo "Production data: $PRODUCTION_DATA"
echo

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing Python venv at: $VENV_PYTHON"
  echo "Run: cd \"$PYTHON_DIR\" && python3.12 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\""
  exit 1
fi

if ! "$VENV_PYTHON" -c "import fastapi, jinja2, rin" >/dev/null 2>&1; then
  echo "Python packages are not installed in the venv."
  echo "Run: cd \"$PYTHON_DIR\" && .venv/bin/python -m pip install -e \".[dev]\""
  exit 1
fi

if [[ ! -f "$MARKER" ]]; then
  echo "Refusing to start Python production server."
  echo "Missing migration marker: $MARKER"
  echo "Run and review: docs/python-migration/PYTHON_REAL_DATA_MIGRATION_APPLY.md"
  exit 1
fi

if curl -fsS "$LOCAL_URL" >/dev/null 2>&1; then
  echo "RIN already appears to be running. Opening browser."
  open "$LOCAL_URL"
  exit 0
fi

if ! curl -fsS "$OLLAMA_URL/api/tags" >/tmp/rin-ollama-tags.$$ 2>/dev/null; then
  echo "Ollama is not reachable at: $OLLAMA_URL"
  echo "Start Ollama locally, then double-click this launcher again."
  rm -f /tmp/rin-ollama-tags.$$
  exit 1
fi

if ! grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$OLLAMA_MODEL\"" /tmp/rin-ollama-tags.$$; then
  echo "Local Ollama model is not ready: $OLLAMA_MODEL"
  echo "Install/pull locally, for example: ollama pull $OLLAMA_MODEL"
  rm -f /tmp/rin-ollama-tags.$$
  exit 1
fi
rm -f /tmp/rin-ollama-tags.$$

export RIN_PYTHON_DATA_DIR="$PRODUCTION_DATA"
export RIN_MODEL_ADAPTER="rin-ollama-local"
export RIN_OLLAMA_BASE_URL="$OLLAMA_URL"
export RIN_OLLAMA_MODEL="$OLLAMA_MODEL"
export RIN_OLLAMA_TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"
export RIN_OLLAMA_NUM_PREDICT="${RIN_OLLAMA_NUM_PREDICT:-1024}"

echo "Starting Python FastAPI server..."
echo "Adapter: $RIN_MODEL_ADAPTER"
echo "Local model: $RIN_OLLAMA_MODEL"
echo "External APIs are disabled."
echo "Press Ctrl-C to stop the server."
echo

(
  cd "$PYTHON_DIR"
  exec "$VENV_PYTHON" -m rin.cli.production_server
) &
SERVER_PID=$!

echo "Waiting for $LOCAL_URL ..."
for _ in {1..60}; do
  if curl -fsS "$LOCAL_URL" >/dev/null 2>&1; then
    echo "RIN is ready. Opening browser once."
    open "$LOCAL_URL"
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "RIN server exited before it became ready."
    wait "$SERVER_PID" || true
    exit 1
  fi

  sleep 1
done

echo "Timed out waiting for RIN at $LOCAL_URL"
exit 1
