#!/usr/bin/env bash
# One-command rebuild of the whole Art Gallery stack from zero.
#
#   ./rebuild.sh                    normal rebuild (asks for approval before terraform apply)
#   ./rebuild.sh --yes              no question asked (demo / defence)
#   ./rebuild.sh --force-artifacts  rebuild and re-upload backend/frontend even if already in S3
#   ./rebuild.sh --refresh-seed     re-dump the local Docker database and overwrite seed/gallery.sql
#
# Steps (every step is idempotent, safe to run again):
#   0. checks tools and valid AWS credentials
#   1. persistent buckets (bootstrap/bootstrap.sh)
#   2. artifacts: builds backend and frontend ONLY if missing in S3 (or --force-artifacts)
#   3. database seed: checks seed/gallery.sql exists in S3 (uploads ../gallery.sql if only that is missing)
#   4. terraform init + ./apply.sh (precheck, apply, state backup)
#   5. waits for /api/health, prints the URL, logs the duration in docs/journal-destructions.md
#
# Not done here on purpose: the Route 53 zone and ACM certificate (created once by hand, docs/https.md).
# The persistent buckets survive ./destroy.sh by design, so "from zero" means "after destroy.sh".
set -euo pipefail

cd "$(dirname "$0")"
INFRA_DIR="$(pwd)"
REPO_ROOT="$(cd .. && pwd)"            # contains infra/, backend/, frontend/
REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-art-gallery}"
TFVARS_FILE="terraform.tfvars"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-600}"   # seconds to wait for the health check after apply

AUTO_YES=0; FORCE_ARTIFACTS=0; REFRESH_SEED=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)           AUTO_YES=1 ;;
    --force-artifacts)  FORCE_ARTIFACTS=1 ;;
    --refresh-seed)     REFRESH_SEED=1 ;;
    -h|--help)          sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (see ./rebuild.sh --help)" >&2; exit 1 ;;
  esac
done

step() { echo; echo ">>> $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

tfvar() { # tfvar NAME: value of NAME in terraform.tfvars (empty if absent)
  local line
  line="$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$TFVARS_FILE" | head -n 1 || true)"
  [ -n "$line" ] && sed -E "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/" <<< "$line" || true
}

START=$(date +%s)
RESULT="FAILED"
# shellcheck source=scripts/log-helpers.sh
source ./scripts/log-helpers.sh
# Runs on every exit: one line per rebuild in docs/journal-destructions.md (cahier, Annexe A).
log_journal() { journal_add "rebuild.sh" $(( $(date +%s) - START )) "$RESULT"; }
trap log_journal EXIT

# ---------------------------------------------------------------- 0. checks
step "0/5 Checks"
for tool in aws terraform curl tar; do
  command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not installed or not in PATH."
done
[ -f "$TFVARS_FILE" ] || die "$TFVARS_FILE is missing. Create it from terraform.tfvars.example first."

SUFFIX="$(tfvar unique_suffix)"
VERSION="$(tfvar app_version)"; VERSION="${VERSION:-v1}"
[ -n "$SUFFIX" ] || die "unique_suffix is not set in $TFVARS_FILE."
case "$SUFFIX" in CHANGE-ME*) die "unique_suffix in $TFVARS_FILE is still the example value." ;; esac

DATA_BUCKET="$PROJECT-data-$SUFFIX"
STATE_BUCKET="$PROJECT-tfstate-$SUFFIX"

aws sts get-caller-identity >/dev/null 2>&1 \
  || die "AWS credentials are not valid. Learner Lab -> Start Lab -> AWS Details -> paste into ~/.aws/credentials."
echo "AWS credentials OK, region $REGION, suffix '$SUFFIX', app version '$VERSION'."

# ---------------------------------------------------------------- 1. buckets
step "1/5 Persistent buckets (state + data)"
( cd bootstrap && ./bootstrap.sh "$SUFFIX" )

if [ ! -f backend.hcl ]; then
  sed "s#art-gallery-tfstate-<suffix>#$STATE_BUCKET#" backend.hcl.example > backend.hcl
  echo "backend.hcl created for bucket $STATE_BUCKET."
fi

# ---------------------------------------------------------------- 2. artifacts
step "2/5 Application artifacts ($VERSION)"
object_exists() { aws s3api head-object --bucket "$DATA_BUCKET" --key "$1" --region "$REGION" >/dev/null 2>&1; }

BACK_KEY="artifacts/backend-$VERSION.tar.gz"
FRONT_KEY="artifacts/frontend-$VERSION.tar.gz"
NEED_BUILD=0
if [ "$FORCE_ARTIFACTS" -eq 1 ]; then
  NEED_BUILD=1; echo "--force-artifacts: rebuilding both artifacts."
else
  for key in "$BACK_KEY" "$FRONT_KEY"; do
    if object_exists "$key"; then echo "present in S3: $key"; else echo "missing in S3: $key"; NEED_BUILD=1; fi
  done
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  command -v npm >/dev/null 2>&1 || die "npm is required to build the artifacts (Node.js 20+)."
  [ -d "$REPO_ROOT/backend" ]  || die "$REPO_ROOT/backend not found: run this script from infra/ inside the full repo."
  [ -d "$REPO_ROOT/frontend" ] || die "$REPO_ROOT/frontend not found: run this script from infra/ inside the full repo."
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"; log_journal' EXIT

  echo "--- backend"
  ( cd "$REPO_ROOT/backend" && npm ci && npm run build )
  [ -f "$REPO_ROOT/backend/dist/main.js" ] || die "backend/dist/main.js not found after the build (see backend_entry in variables.tf)."
  tar -czf "$TMP/backend.tar.gz" -C "$REPO_ROOT/backend" dist package.json package-lock.json

  echo "--- frontend"
  ( cd "$REPO_ROOT/frontend" && npm ci && NEXT_PUBLIC_API_URL=/api npm run build )
  [ -f "$REPO_ROOT/frontend/out/index.html" ] || die "frontend/out/index.html not found after the build (static export missing)."
  tar -czf "$TMP/frontend.tar.gz" -C "$REPO_ROOT/frontend/out" .

  ls -lh "$TMP"/*.tar.gz
  aws s3 cp "$TMP/backend.tar.gz"  "s3://$DATA_BUCKET/$BACK_KEY"  --region "$REGION"
  aws s3 cp "$TMP/frontend.tar.gz" "s3://$DATA_BUCKET/$FRONT_KEY" --region "$REGION"
fi

# ---------------------------------------------------------------- 3. seed
step "3/5 Database seed (seed/gallery.sql)"
LOCAL_SEED="$REPO_ROOT/gallery.sql"

if [ "$REFRESH_SEED" -eq 1 ]; then
  command -v docker >/dev/null 2>&1 || die "--refresh-seed needs Docker (container art-gallery-db running)."
  # -f then docker cp keeps a UTF-8 file (a shell redirect would break the restore on Windows).
  MSYS_NO_PATHCONV=1 docker exec art-gallery-db pg_dump -U gallery --no-owner --no-acl -f /tmp/gallery.sql art_gallery
  MSYS_NO_PATHCONV=1 docker cp art-gallery-db:/tmp/gallery.sql "$LOCAL_SEED"
  aws s3 cp "$LOCAL_SEED" "s3://$DATA_BUCKET/seed/gallery.sql" --region "$REGION"
elif object_exists "seed/gallery.sql"; then
  echo "present in S3: seed/gallery.sql"
elif [ -f "$LOCAL_SEED" ]; then
  echo "seed missing in S3, uploading $LOCAL_SEED"
  aws s3 cp "$LOCAL_SEED" "s3://$DATA_BUCKET/seed/gallery.sql" --region "$REGION"
else
  die "seed/gallery.sql is missing in S3 and $LOCAL_SEED does not exist. Make one with ./rebuild.sh --refresh-seed (Docker running) or see docs/usage.md step 4b."
fi
object_exists "seed/gallery.sql" || die "seed/gallery.sql is still not in s3://$DATA_BUCKET after the upload."
SEED_SIZE="$(aws s3api head-object --bucket "$DATA_BUCKET" --key seed/gallery.sql --region "$REGION" --query ContentLength --output text)"
[ "${SEED_SIZE:-0}" -gt 0 ] || die "seed/gallery.sql in S3 is empty."
echo "seed OK ($SEED_SIZE bytes)."

# ---------------------------------------------------------------- 4. terraform
step "4/5 Terraform init + apply"
terraform init -input=false -backend-config=backend.hcl
if [ "$AUTO_YES" -eq 1 ]; then
  ./apply.sh -auto-approve        # apply.sh: precheck, admin IP, terraform apply, state backup
else
  ./apply.sh
fi

# ---------------------------------------------------------------- 5. health
step "5/5 Health check"
HEALTH_URL="$(terraform output -raw health_url)"
APP_URL="$(terraform output -raw app_url)"
echo "Waiting for $HEALTH_URL (max ${HEALTH_TIMEOUT}s)..."
waited=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)" = "200" ]; do
  [ "$waited" -ge "$HEALTH_TIMEOUT" ] && die "health check still failing after ${HEALTH_TIMEOUT}s. See docs/troubleshooting.md."
  sleep 10; waited=$(( waited + 10 ))
done
curl -s --max-time 10 "$HEALTH_URL"; echo

RESULT="OK"
echo
echo "Rebuild complete. Application: $APP_URL"
echo "Reminders: click the new SNS confirmation e-mail, note the remaining Learner Lab credit, and run ./destroy.sh at the end of the session."
