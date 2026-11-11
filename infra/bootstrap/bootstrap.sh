#!/usr/bin/env bash
# Creates the two PERSISTENT buckets (never touched by ../destroy.sh):
#   art-gallery-tfstate-<suffix>  Terraform state (versioned)
#   art-gallery-data-<suffix>     app artifacts (artifacts/) and artwork images (artworks/)
#
# Why a script and not Terraform: in the AWS Academy Learner Lab a service control
# policy denies s3:GetBucketObjectLockConfiguration, and the Terraform AWS provider
# reads it after creating any aws_s3_bucket (all versions fail on AccessDenied).
# Documented fallback, cahier §3.1 "Posture face aux limitations".
#
# Idempotent: safe to run again (reuses existing buckets, re-applies the settings).
# Usage:  ./bootstrap.sh <unique_suffix>      e.g. ./bootstrap.sh hamza-tek26
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-art-gallery}"
SUFFIX="${1:-${UNIQUE_SUFFIX:-}}"

if ! [[ "$SUFFIX" =~ ^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$ ]]; then
  echo "Usage: $0 <unique_suffix>   (3-32 chars: lowercase letters, digits, hyphens)" >&2
  exit 1
fi

setup_bucket() {
  local name="$1" purpose="$2" versioned="$3"
  echo ">>> $name"

  if aws s3api head-bucket --bucket "$name" --region "$REGION" 2>/dev/null; then
    echo "    already exists, reusing it"
  else
    local args=(--bucket "$name" --region "$REGION")
    [ "$REGION" != "us-east-1" ] && args+=(--create-bucket-configuration "LocationConstraint=$REGION")
    if ! aws s3api create-bucket "${args[@]}" >/dev/null; then
      echo "    FAILED. If the error says BucketAlreadyExists, the name is taken by another account: change the suffix." >&2
      exit 1
    fi
    echo "    created"
  fi

  # Nobody on the internet can read or list it.
  aws s3api put-public-access-block --bucket "$name" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  # Encryption at rest.
  aws s3api put-bucket-encryption --bucket "$name" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  # Versioning only on the state bucket: go back if the state is corrupted.
  if [ "$versioned" = "yes" ]; then
    aws s3api put-bucket-versioning --bucket "$name" --versioning-configuration Status=Enabled
  fi

  aws s3api put-bucket-tagging --bucket "$name" --tagging \
    "TagSet=[{Key=Project,Value=$PROJECT},{Key=Managed,Value=bootstrap-script},{Key=Lifecycle,Value=persistent},{Key=Purpose,Value=$purpose}]"
}

setup_bucket "$PROJECT-tfstate-$SUFFIX" "terraform-state"           yes
setup_bucket "$PROJECT-data-$SUFFIX"    "app-artifacts-and-images" no

echo
echo ">>> Verification"
for b in "$PROJECT-tfstate-$SUFFIX" "$PROJECT-data-$SUFFIX"; do
  echo "--- $b"
  aws s3api get-public-access-block --bucket "$b" --query 'PublicAccessBlockConfiguration' --output json
  aws s3api get-bucket-encryption  --bucket "$b" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text
  echo "versioning: $(aws s3api get-bucket-versioning --bucket "$b" --query Status --output text)"
done
echo
echo "OK. Put the same suffix in infra/terraform.tfvars:  unique_suffix = \"$SUFFIX\""
