#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PYTHON_DIR="$SCRIPT_DIR/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
PRODUCTION_DATA="$SCRIPT_DIR/.rin-data"
MARKER="$PRODUCTION_DATA/config/python_cutover_marker.json"
OLLAMA_URL="${RIN_OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${RIN_OLLAMA_MODEL:-qwen3:4b}"

echo "RIN Python primary launcher (local model)"
echo "TypeScript fallback moved to: scripts/typescript-fallback/"
echo "Production data: $PRODUCTION_DATA"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing Python venv at: $VENV_PYTHON"
  echo "Run: cd \"$PYTHON_DIR\" && python3.12 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\""
  exit 1
fi

if [[ ! -f "$MARKER" ]]; then
  echo "Refusing to start Python production server."
  echo "Missing migration marker: $MARKER"
  echo "Run and review: docs/python-migration/PYTHON_REAL_DATA_MIGRATION_APPLY.md"
  exit 1
fi

if ! curl -fsS "$OLLAMA_URL/api/tags" | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$OLLAMA_MODEL\""; then
  echo "Local Ollama model is not ready: $OLLAMA_MODEL at $OLLAMA_URL"
  echo "Install/pull locally, for example: ollama pull $OLLAMA_MODEL"
  exit 1
fi

export RIN_PYTHON_DATA_DIR="$PRODUCTION_DATA"
export RIN_MODEL_ADAPTER="rin-ollama-local"
export RIN_OLLAMA_BASE_URL="$OLLAMA_URL"
export RIN_OLLAMA_MODEL="$OLLAMA_MODEL"
export RIN_OLLAMA_TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"
export RIN_OLLAMA_NUM_PREDICT="${RIN_OLLAMA_NUM_PREDICT:-1024}"

echo "Local UI: http://127.0.0.1:8765/"
echo "Adapter: rin-ollama-local"
echo "Local model: $RIN_OLLAMA_MODEL"
echo "External APIs are disabled."
echo "Press Ctrl-C to stop the Python server."

cd "$PYTHON_DIR"
exec "$VENV_PYTHON" -m rin.cli.production_server
