#!/usr/bin/env bash
set -Eeuo pipefail

OLLAMA_BASE_URL="${RIN_OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${RIN_OLLAMA_MODEL:-qwen3:4b}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"

pause_on_error() {
  local exit_code="$1"
  if [ "$exit_code" -ne 0 ] && [ -t 0 ]; then
    echo ""
    read -r -p "Startup failed. Press Return to close this window. " _
  fi
}

trap 'pause_on_error $?' EXIT

echo "RIN local model launcher"
echo "This launcher explicitly selects local Ollama only."
echo "External APIs are not required and are not enabled."
echo ""

cd "$repo_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 22 or newer, then try Start_RIN_Local_Model.command again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found."
  echo "Install npm with Node.js, then try Start_RIN_Local_Model.command again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Dependencies are not installed."
  echo "Run this once from the RIN repository:"
  echo "  npm install"
  echo "Then double-click Start_RIN_Local_Model.command again."
  exit 1
fi

echo "Checking Ollama at ${OLLAMA_BASE_URL} for model ${OLLAMA_MODEL}..."

set +e
RIN_OLLAMA_BASE_URL="$OLLAMA_BASE_URL" RIN_OLLAMA_MODEL="$OLLAMA_MODEL" node <<'NODE'
const baseUrl = process.env.RIN_OLLAMA_BASE_URL;
const model = process.env.RIN_OLLAMA_MODEL;

(async () => {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      process.exit(2);
    }

    const body = await response.json();
    const models = Array.isArray(body.models) ? body.models : [];
    const available = models.some((entry) => entry?.name === model);

    process.exit(available ? 0 : 3);
  } catch {
    process.exit(2);
  }
})();
NODE
status=$?
set -e

if [ "$status" -ne 0 ]; then
  if [ "$status" -eq 3 ]; then
    echo "Ollama is reachable, but ${OLLAMA_MODEL} is not available."
    echo "Install it with:"
    echo "  ollama pull ${OLLAMA_MODEL}"
  else
    echo "Ollama is not reachable at ${OLLAMA_BASE_URL}."
    echo "Start Ollama first, then try again."
  fi
  exit "$status"
fi

echo "Ollama model is available."
echo ""

export RIN_MODEL_ADAPTER="rin-ollama-local"
export RIN_OLLAMA_BASE_URL="$OLLAMA_BASE_URL"
export RIN_OLLAMA_MODEL="$OLLAMA_MODEL"

trap - EXIT
exec bash "$script_dir/start-rin.sh"
