#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

backup_dir="${STATE_BACKUP_DIR:-$ROOT_DIR/state-backups}"
mkdir -p "$backup_dir"

backup_path="${backup_dir}/terraform.tfstate.backup"
temporary_path="${backup_dir}/.terraform.tfstate.backup.tmp"
trap 'rm -f "$temporary_path"' EXIT

terraform state pull > "$temporary_path"
chmod 600 "$temporary_path"
mv -f "$temporary_path" "$backup_path"
trap - EXIT

echo "Latest local state backup saved at $backup_path"