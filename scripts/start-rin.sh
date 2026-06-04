#!/usr/bin/env bash
set -Eeuo pipefail

CONSOLE_PORT="${RIN_CONSOLE_PORT:-4173}"
CONSOLE_URL="http://127.0.0.1:${CONSOLE_PORT}"
SERVER_PID=""

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"

pause_on_error() {
  local exit_code="$1"
  if [ "$exit_code" -ne 0 ] && [ -t 0 ]; then
    echo ""
    read -r -p "Startup failed. Press Return to close this window. " _
  fi
}

cleanup() {
  local exit_code=$?
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "Stopping RIN Console..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  pause_on_error "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

echo "RIN one-click launcher"
echo "Starting safe local Console mode."
echo "External APIs are not required and are not enabled by this launcher."
echo ""

cd "$repo_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 22 or newer, then try Start_RIN.command again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found."
  echo "Install npm with Node.js, then try Start_RIN.command again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Dependencies are not installed."
  echo "Run this once from the RIN repository:"
  echo "  npm install"
  echo "Then double-click Start_RIN.command again."
  exit 1
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""
echo "Running lightweight RIN readiness check..."
npm run rin:readiness

echo ""
echo "Starting RIN Console at ${CONSOLE_URL}"
echo "Leave this terminal open while using RIN."
echo "Press Control-C in this window to stop the Console."
echo ""

npm run rin:console &
SERVER_PID="$!"

for _ in {1..40}; do
  if node -e "fetch('${CONSOLE_URL}/api/health').then((r)=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1));" >/dev/null 2>&1; then
    echo "RIN Console is ready."
    open "$CONSOLE_URL"
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID"
    exit $?
  fi

  sleep 0.5
done

echo "RIN Console did not become ready at ${CONSOLE_URL}."
echo "Check the logs above for the startup error."
exit 1
