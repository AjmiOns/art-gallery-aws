#!/usr/bin/env bash
# Destroys everything and then checks that no billable resource is left.
set -uo pipefail
cd "$(dirname "$0")"
REGION="${AWS_REGION:-us-east-1}"

# Logs: one journal line per destroy + the remaining credit (docs/compte-aws.md).
# shellcheck source=scripts/log-helpers.sh
source ./scripts/log-helpers.sh
START=$(date +%s)
RESULT="FAILED"
DESTROYED="no"
finish() {
  journal_add "destroy.sh" $(( $(date +%s) - START )) "$RESULT"
  case "$RESULT" in FAILED*) ;; *) ask_credit "$DESTROYED" ;; esac
}
trap finish EXIT

echo ">>> terraform destroy"
terraform destroy -auto-approve || { echo "DESTROY FAILED - fix it before leaving!"; RESULT="FAILED (terraform destroy)"; exit 1; }

# Remove the local backup copy only after Terraform confirms a successful destroy.
rm -f "./state-backups/terraform.tfstate" "./state-backups/terraform.tfstate.backup" "./state-backups/.terraform.tfstate.backup.tmp" 2>/dev/null || true

# If the folder is empty afterwards, it can stay as a placeholder or be removed.
if [ -d "./state-backups" ] && [ -z "$(ls -A ./state-backups 2>/dev/null)" ]; then
  rmdir "./state-backups" 2>/dev/null || true
fi

# The leftover check cannot tell "nothing left" from "AWS refused the call":
# with expired lab credentials every query comes back empty. Stop in that case.
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials are not valid: the leftover check cannot run. Refresh them and check by hand."
  RESULT="destroy done, leftover check NOT run (credentials)"
  exit 2
fi

# The account and region are shared with other projects. Only resources of THIS
# project can make the check fail: they carry the tag Project=<PROJECT>.
# ALB, RDS and RDS snapshots are matched by name prefix, and log groups by the
# /<PROJECT> prefix. Other resources are listed below as ignored, never touched.
PROJECT="${PROJECT:-art-gallery}"
TAG="Name=tag:Project,Values=$PROJECT"

echo ">>> Leftover check in $REGION (project: $PROJECT)"
LEFT=0

EC2=$(aws ec2 describe-instances --region "$REGION" \
  --filters "$TAG" Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[].Instances[].InstanceId' --output text)
NAT=$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter "$TAG" Name=state,Values=pending,available \
  --query 'NatGateways[].NatGatewayId' --output text)
EIP=$(aws ec2 describe-addresses --region "$REGION" \
  --filters "$TAG" \
  --query 'Addresses[].AllocationId' --output text)
ALB=$(aws elbv2 describe-load-balancers --region "$REGION" \
  --query "LoadBalancers[?starts_with(LoadBalancerName, '$PROJECT')].LoadBalancerArn" --output text 2>/dev/null)
RDS=$(aws rds describe-db-instances --region "$REGION" \
  --query "DBInstances[?starts_with(DBInstanceIdentifier, '$PROJECT')].DBInstanceIdentifier" --output text 2>/dev/null)
# Available EBS volumes and account-owned snapshots can keep incurring storage charges.
EBS_VOLUMES=$(aws ec2 describe-volumes --region "$REGION" \
  --filters "$TAG" Name=status,Values=available \
  --query 'Volumes[].VolumeId' --output text)
EBS_SNAPSHOTS=$(aws ec2 describe-snapshots --region "$REGION" --owner-ids self \
  --filters "$TAG" \
  --query 'Snapshots[].SnapshotId' --output text)
# Manual RDS snapshots persist after the database instance is deleted.
RDS_SNAPSHOTS=$(aws rds describe-db-snapshots --region "$REGION" --snapshot-type manual \
  --query "DBSnapshots[?starts_with(DBInstanceIdentifier, '$PROJECT')].DBSnapshotIdentifier" --output text)
# CloudWatch log groups with this project prefix are included in the leftover report.
CLOUDWATCH_LOG_GROUPS=$(aws logs describe-log-groups --region "$REGION" \
  --log-group-name-prefix "/$PROJECT" \
  --query 'logGroups[].logGroupName' --output text)

for pair in "EC2:$EC2" "NAT:$NAT" "EIP:$EIP" "ALB:$ALB" "RDS:$RDS" \
  "EBS volume:$EBS_VOLUMES" "EBS snapshot:$EBS_SNAPSHOTS" \
  "RDS snapshot:$RDS_SNAPSHOTS" "CloudWatch log group:$CLOUDWATCH_LOG_GROUPS"; do
  name="${pair%%:*}"; val="${pair#*:}"
  if [ -n "$val" ] && [ "$val" != "None" ]; then
    echo "!! $name still exists: $val"; LEFT=1
  fi
done

if [ "$LEFT" -eq 0 ]; then
  echo "OK: nothing billable left."; RESULT="OK, nothing billable left"; DESTROYED="yes"
else
  echo "Delete the resources above manually!"; RESULT="LEFTOVERS found, delete manually"
fi

# Costly resources WITHOUT this project's tag. They belong to someone else (or
# are untagged leaks): shown for information only, NOT counted and NOT touched.
not_in() { # not_in LABEL "<all ids>" "<ids of this project>": print the ids missing from the second list
  local label="$1" skip=" $(echo $3) " x
  for x in $2; do case "$skip" in *" $x "*) ;; *) echo "   - $label $x" ;; esac; done
}
ALL_EC2=$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[].Instances[].InstanceId' --output text)
ALL_NAT=$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter Name=state,Values=pending,available \
  --query 'NatGateways[].NatGatewayId' --output text)
ALL_EIP=$(aws ec2 describe-addresses --region "$REGION" \
  --query 'Addresses[].AllocationId' --output text)
OTHER=$( { not_in EC2 "$ALL_EC2" "$EC2"; not_in NAT "$ALL_NAT" "$NAT"; not_in EIP "$ALL_EIP" "$EIP"; } )
echo ">>> Resources not tagged Project=$PROJECT (ignored, not touched)"
if [ -n "$OTHER" ]; then echo "$OTHER"; else echo "   (none)"; fi

# Persistent resources (created by bootstrap/, intentionally NOT destroyed here).
# Informational only: they do not change the exit code.
echo ">>> Persistent buckets left on purpose (bootstrap/)"
BUCKETS=$(aws s3api list-buckets --region "$REGION" \
  --query "Buckets[?starts_with(Name, 'art-gallery-')].Name" --output text 2>/dev/null)
if [ -n "$BUCKETS" ] && [ "$BUCKETS" != "None" ]; then
  for b in $BUCKETS; do echo "   - $b"; done
else
  echo "   (none)"
fi

exit "$LEFT"
