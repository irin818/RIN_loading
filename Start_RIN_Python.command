#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PYTHON_DIR="$SCRIPT_DIR/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
PRODUCTION_DATA="$SCRIPT_DIR/.rin-data"
MARKER="$PRODUCTION_DATA/config/python_cutover_marker.json"

echo "RIN Python primary launcher"
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

export RIN_PYTHON_DATA_DIR="$PRODUCTION_DATA"
export RIN_OLLAMA_TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"

echo "Local UI: http://127.0.0.1:8765/"
echo "Adapter: ${RIN_MODEL_ADAPTER:-rin-mock-local}"
echo "External APIs are disabled by default."
echo "Press Ctrl-C to stop the Python server."

cd "$PYTHON_DIR"
exec "$VENV_PYTHON" -m rin.cli.production_server
