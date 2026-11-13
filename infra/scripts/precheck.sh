#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-art-gallery}"
TFVARS_FILE="${1:-terraform.tfvars}"

if [[ "$TFVARS_FILE" != /* ]]; then
  TFVARS_FILE="$ROOT_DIR/$TFVARS_FILE"
fi

if [[ ! -f "$TFVARS_FILE" ]]; then
  echo "Preflight failed: $TFVARS_FILE is missing. Create it from terraform.tfvars.example first." >&2
  exit 1
fi

extract_tfvar() {
  local name="$1"
  grep -E "^[[:space:]]*${name}[[:space:]]*=" "$TFVARS_FILE" | head -n 1 \
    | sed -E "s/^[[:space:]]*${name}[[:space:]]*=[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/"
}

unique_suffix="$(extract_tfvar unique_suffix)"
app_version="$(extract_tfvar app_version)"

if [[ -z "$unique_suffix" ]]; then
  echo "Preflight failed: unique_suffix is not set in $TFVARS_FILE." >&2
  exit 1
fi

if [[ -z "$app_version" ]]; then
  app_version="v1"
fi

state_bucket="${PROJECT}-tfstate-${unique_suffix}"
data_bucket="${PROJECT}-data-${unique_suffix}"
required_paths=(
  "artifacts/backend-${app_version}.tar.gz"
  "artifacts/frontend-${app_version}.tar.gz"
  "seed/gallery.sql"
)

check_bucket_exists() {
  local bucket_name="$1"
  if ! aws s3api head-bucket --bucket "$bucket_name" --region "$REGION" >/dev/null 2>&1; then
    echo "Preflight failed: S3 bucket '$bucket_name' does not exist in $REGION." >&2
    echo "Create it first with ./bootstrap/bootstrap.sh $unique_suffix" >&2
    exit 1
  fi
}

check_object_exists() {
  local bucket_name="$1"
  local object_key="$2"

  if ! aws s3api head-object --bucket "$bucket_name" --key "$object_key" --region "$REGION" >/dev/null 2>&1; then
    echo "Preflight failed: missing required object '$object_key' in bucket '$bucket_name'." >&2
    exit 1
  fi
}

check_bucket_exists "$state_bucket"
check_bucket_exists "$data_bucket"

for object_key in "${required_paths[@]}"; do
  check_object_exists "$data_bucket" "$object_key"
done

if [[ ! -f "../gallery.sql" ]]; then
  echo "Warning: ../gallery.sql was not found locally. The S3 seed file is present, so apply can continue." >&2
fi

echo "Preflight OK: buckets and required artifacts exist for suffix '$unique_suffix'."
