#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Compatibility launcher. Default owner launcher is Start_RIN.command."
exec "$SCRIPT_DIR/Start_RIN.command"
