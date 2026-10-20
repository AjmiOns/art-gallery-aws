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
