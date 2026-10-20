output "bastion_public_ip" { value = aws_instance.bastion.public_ip }
output "backend_private_ip" { value = aws_instance.backend.private_ip }
