#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="terraform.tfstate.backup.${timestamp}"
temporary_path="${backup_path}.tmp"

terraform state pull > "$temporary_path"
mv "$temporary_path" "$backup_path"
echo "Remote state backup created at $backup_path"