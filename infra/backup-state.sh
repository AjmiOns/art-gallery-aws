#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$(dirname "$0")"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="terraform.tfstate.backup.${timestamp}"
temporary_path="${backup_path}.tmp"
trap 'rm -f "$temporary_path"' EXIT

terraform state pull > "$temporary_path"
chmod 600 "$temporary_path"
mv "$temporary_path" "$backup_path"
trap - EXIT
echo "Remote state backup created at $backup_path"