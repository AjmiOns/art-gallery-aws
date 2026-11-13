#!/usr/bin/env bash
# Destroys everything and then checks that no billable resource is left.
set -uo pipefail
REGION="${AWS_REGION:-us-east-1}"

echo ">>> terraform destroy"
terraform destroy -auto-approve || { echo "DESTROY FAILED - fix it before leaving!"; exit 1; }

# Remove the local backup copy only after Terraform confirms a successful destroy.
rm -f "./state-backups/terraform.tfstate" "./state-backups/terraform.tfstate.backup" "./state-backups/.terraform.tfstate.backup.tmp" 2>/dev/null || true

# If the folder is empty afterwards, it can stay as a placeholder or be removed.
if [ -d "./state-backups" ] && [ -z "$(ls -A ./state-backups 2>/dev/null)" ]; then
  rmdir "./state-backups" 2>/dev/null || true
fi

echo ">>> Leftover check in $REGION"
LEFT=0

EC2=$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[].Instances[].InstanceId' --output text)
NAT=$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter Name=state,Values=pending,available \
  --query 'NatGateways[].NatGatewayId' --output text)
EIP=$(aws ec2 describe-addresses --region "$REGION" \
  --query 'Addresses[].AllocationId' --output text)
ALB=$(aws elbv2 describe-load-balancers --region "$REGION" \
  --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null)
RDS=$(aws rds describe-db-instances --region "$REGION" \
  --query 'DBInstances[].DBInstanceIdentifier' --output text 2>/dev/null)
# Available EBS volumes and account-owned snapshots can keep incurring storage charges.
EBS_VOLUMES=$(aws ec2 describe-volumes --region "$REGION" \
  --filters Name=status,Values=available \
  --query 'Volumes[].VolumeId' --output text)
EBS_SNAPSHOTS=$(aws ec2 describe-snapshots --region "$REGION" --owner-ids self \
  --query 'Snapshots[].SnapshotId' --output text)
# Manual RDS snapshots persist after the database instance is deleted.
RDS_SNAPSHOTS=$(aws rds describe-db-snapshots --region "$REGION" --snapshot-type manual \
  --query 'DBSnapshots[].DBSnapshotIdentifier' --output text)
# CloudWatch log groups with this project prefix are included in the leftover report.
CLOUDWATCH_LOG_GROUPS=$(aws logs describe-log-groups --region "$REGION" \
  --log-group-name-prefix "/art-gallery" \
  --query 'logGroups[].logGroupName' --output text)

for pair in "EC2:$EC2" "NAT:$NAT" "EIP:$EIP" "ALB:$ALB" "RDS:$RDS" \
  "EBS volume:$EBS_VOLUMES" "EBS snapshot:$EBS_SNAPSHOTS" \
  "RDS snapshot:$RDS_SNAPSHOTS" "CloudWatch log group:$CLOUDWATCH_LOG_GROUPS"; do
  name="${pair%%:*}"; val="${pair#*:}"
  if [ -n "$val" ] && [ "$val" != "None" ]; then
    echo "!! $name still exists: $val"; LEFT=1
  fi
done

[ "$LEFT" -eq 0 ] && echo "OK: nothing billable left." || echo "Delete the resources above manually!"

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
