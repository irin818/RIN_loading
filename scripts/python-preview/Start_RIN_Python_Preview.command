#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h:h}"
PYTHON_DIR="$REPO_ROOT/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
PRODUCTION_DATA="/Users/irin/Documents/RIN_loading/.rin-data"

echo "RIN Python Preview Candidate Mode"
echo "This launcher is preview-only and does not replace TypeScript RIN."
echo "Production data path is forbidden: $PRODUCTION_DATA"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing Python venv at: $VENV_PYTHON"
  echo "Run: cd \"$PYTHON_DIR\" && python3.12 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\""
  exit 1
fi

PREVIEW_DATA="${RIN_PYTHON_PREVIEW_DATA_DIR:-$(mktemp -d /tmp/rin-python-preview-XXXXXX)}"
RESOLVED_PREVIEW="$(cd "$(dirname "$PREVIEW_DATA")" && pwd -P)/$(basename "$PREVIEW_DATA")"
RESOLVED_PRODUCTION="$(cd "$(dirname "$PRODUCTION_DATA")" && pwd -P)/$(basename "$PRODUCTION_DATA")"

if [[ "$RESOLVED_PREVIEW" == "$RESOLVED_PRODUCTION" ]]; then
  echo "Refusing to use production .rin-data."
  exit 1
fi

case "$RESOLVED_PREVIEW" in
  /private/tmp/rin-python-preview-*|/tmp/rin-python-preview-*)
    ;;
  *)
    echo "Preview data must be under /tmp/rin-python-preview-*"
    exit 1
    ;;
esac

export RIN_PYTHON_PREVIEW_DATA_DIR="$RESOLVED_PREVIEW"

echo "Preview data: $RIN_PYTHON_PREVIEW_DATA_DIR"
echo "Local URL: http://127.0.0.1:8765"
echo "Press Ctrl-C to stop the preview server."

cd "$PYTHON_DIR"
exec "$VENV_PYTHON" -m rin.cli.preview_server
