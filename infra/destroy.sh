#!/usr/bin/env bash
# Destroys everything and then checks that no billable resource is left.
set -uo pipefail
REGION="${AWS_REGION:-us-east-1}"

echo ">>> terraform destroy"
terraform destroy -auto-approve || { echo "DESTROY FAILED - fix it before leaving!"; exit 1; }

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

for pair in "EC2:$EC2" "NAT:$NAT" "EIP:$EIP" "ALB:$ALB" "RDS:$RDS"; do
  name="${pair%%:*}"; val="${pair#*:}"
  if [ -n "$val" ] && [ "$val" != "None" ]; then
    echo "!! $name still exists: $val"; LEFT=1
  fi
done

[ "$LEFT" -eq 0 ] && echo "OK: nothing billable left." || echo "Delete the resources above manually!"
exit "$LEFT"
