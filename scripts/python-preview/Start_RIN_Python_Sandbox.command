#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h:h}"
PYTHON_DIR="$REPO_ROOT/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
SANDBOX_DATA="$REPO_ROOT/.rin-python-preview-data"
PRODUCTION_DATA="/Users/irin/Documents/RIN_loading/.rin-data"

echo "RIN Python Persistent Sandbox Mode"
echo "This launcher uses sandbox data, not production .rin-data."
echo "TypeScript fallback launchers remain available."
echo "Sandbox data: $SANDBOX_DATA"
echo "Forbidden production data: $PRODUCTION_DATA"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing Python venv at: $VENV_PYTHON"
  echo "Run: cd \"$PYTHON_DIR\" && python3.12 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\""
  exit 1
fi

RESOLVED_SANDBOX="$(cd "$(dirname "$SANDBOX_DATA")" && pwd -P)/$(basename "$SANDBOX_DATA")"
RESOLVED_PRODUCTION="$(cd "$(dirname "$PRODUCTION_DATA")" && pwd -P)/$(basename "$PRODUCTION_DATA")"

if [[ "$RESOLVED_SANDBOX" == "$RESOLVED_PRODUCTION" ]]; then
  echo "Refusing to use production .rin-data."
  exit 1
fi

if [[ "$RESOLVED_SANDBOX" != "$REPO_ROOT/.rin-python-preview-data" ]]; then
  echo "Sandbox data must be the repo-local .rin-python-preview-data path."
  exit 1
fi

export RIN_PYTHON_PREVIEW_DATA_DIR="$RESOLVED_SANDBOX"
export RIN_OLLAMA_TIMEOUT_MS="${RIN_OLLAMA_TIMEOUT_MS:-180000}"

echo "Local URL: http://127.0.0.1:8765"
echo "Adapter: ${RIN_MODEL_ADAPTER:-rin-mock-local}"
echo "Set RIN_MODEL_ADAPTER=rin-ollama-local before launch to use local Ollama."
echo "Press Ctrl-C to stop the sandbox server."

cd "$PYTHON_DIR"
exec "$VENV_PYTHON" -m rin.cli.sandbox_server
