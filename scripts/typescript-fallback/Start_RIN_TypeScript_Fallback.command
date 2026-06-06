#!/usr/bin/env bash
set -Eeuo pipefail

launcher_dir="$(cd "$(dirname "$0")" && pwd)"

echo "RIN TypeScript fallback launcher"
echo "Use only for rollback from the Python primary runtime."
echo "Preferred active launchers are at the repository root:"
echo "- Start_RIN_Python.command"
echo "- Start_RIN_Python_Local_Model.command"
echo "Fallback Git tag: typescript-final-fallback"
echo ""

exec bash "$launcher_dir/start-rin.sh"
