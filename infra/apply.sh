#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

admin_ip="$(curl -4fsS --max-time 10 https://checkip.amazonaws.com | tr -d '[:space:]')"
if [[ ! "$admin_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
	echo "Could not determine a valid public IPv4 address: $admin_ip" >&2
	exit 1
fi

echo "Using $admin_ip/32 for bastion SSH access."
./scripts/precheck.sh
time terraform apply -var="admin_cidr=${admin_ip}/32" "$@"
./scripts/backup-state.sh