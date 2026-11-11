#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

terraform apply "$@"
./backup-state.sh