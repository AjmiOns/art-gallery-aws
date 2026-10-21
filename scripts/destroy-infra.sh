#!/usr/bin/env bash
# a lancer en fin de chaque seance
set -e
cd "$(dirname "$0")/../infra"
terraform destroy -auto-approve
echo "OK. Verifiez qu'il ne reste pas d'Elastic IP"
