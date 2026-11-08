output "db_password" {
  value     = random_password.db.result
  sensitive = true
}

output "db_password_param" { value = aws_ssm_parameter.db_password.name }
output "jwt_secret_param" { value = aws_ssm_parameter.jwt_secret.name }
output "admin_password_param" { value = aws_ssm_parameter.admin_password.name }
