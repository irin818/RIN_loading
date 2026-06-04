#!/usr/bin/env bash
set -Eeuo pipefail

launcher_dir="$(cd "$(dirname "$0")" && pwd)"

exec bash "$launcher_dir/scripts/start-rin-local-model.sh"
