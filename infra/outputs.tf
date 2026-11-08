# ---------------------------------------------------------------------------
# Root outputs: values Terraform prints after "terraform apply" and on demand
# with "terraform output". They give you the facts you need to use the
# infrastructure without opening the AWS console.
# ---------------------------------------------------------------------------

output "vpc_id" {
  value = module.network.vpc_id
}

output "app_url" {
  description = "Open this in a browser: the only public entry point"
  value       = "http://${module.alb.dns_name}"
}

output "health_url" {
  value = "http://${module.alb.dns_name}/api/health"
}

output "bastion_public_ip" {
  value = module.compute.bastion_public_ip
}

output "rds_endpoint" {
  value = "${module.rds.address}:${module.rds.port}"
}

output "list_app_instances" {
  description = "Private IPs of the running app instances (then: ssh -J ec2-user@<bastion> ec2-user@<ip>)"
  value       = "aws ec2 describe-instances --region ${var.region} --filters Name=tag:Name,Values=${var.project}-app Name=instance-state-name,Values=running --query 'Reservations[].Instances[].[InstanceId,PrivateIpAddress,Placement.AvailabilityZone]' --output table"
}

output "read_admin_password" {
  description = "The generated admin password is in SSM, never in Git"
  value       = "aws ssm get-parameter --region ${var.region} --name ${module.secrets.admin_password_param} --with-decryption --query Parameter.Value --output text"
}
