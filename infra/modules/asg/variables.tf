variable "name" { type = string }
variable "region" { type = string }
variable "instance_type" { type = string }
variable "key_name" { type = string }
variable "instance_profile" { type = string }
variable "app_sg_id" { type = string }
variable "app_subnet_ids" { type = list(string) }
variable "target_group_arn" { type = string }
variable "tags" { type = map(string) }

variable "ami_id" {
  description = "Pin an AMI. null = latest Amazon Linux 2023."
  type        = string
  default     = null
}

variable "min_size" { type = number }
variable "max_size" { type = number }
variable "desired_capacity" { type = number }

# ---- boot script inputs (no secret values, only names of SSM parameters) ----
variable "artifact_bucket" { type = string }
variable "app_version" { type = string }
variable "backend_entry" { type = string }
variable "node_env" { type = string }
variable "public_host" { type = string }
variable "db_host" { type = string }
variable "db_port" { type = number }
variable "db_name" { type = string }
variable "db_user" { type = string }
variable "ssm_db_password" { type = string }
variable "ssm_jwt_secret" { type = string }
variable "ssm_admin_password" { type = string }
