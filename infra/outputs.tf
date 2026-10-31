# ---------------------------------------------------------------------------
# Root outputs: values Terraform prints after "terraform apply" and on demand
# with "terraform output". They give you the facts you need to use the
# infrastructure (IP addresses, SSH command) without opening the AWS console.
# Each value comes from a child module's outputs.tf.
# ---------------------------------------------------------------------------

# ID of the VPC created by the network module.
# Useful to find the VPC in the console or to reference it in later phases.
output "vpc_id" {
  value = module.network.vpc_id
}

output "bastion_public_ip" {
  value = module.compute.bastion_public_ip
}

output "backend_private_ip" {
  value = module.compute.backend_private_ip
}

output "ssh_to_backend" {
  value = "ssh -J ec2-user@${module.compute.bastion_public_ip} ec2-user@${module.compute.backend_private_ip}"
}
