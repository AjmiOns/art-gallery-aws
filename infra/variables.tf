variable "region" {
  type    = string
  default = "us-east-1" # AWS Academy Learner Lab
}

variable "project" {
  type    = string
  default = "art-gallery"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "app_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.21.0/24", "10.0.22.0/24"]
}

variable "admin_cidr" {
  description = "Your public IP in CIDR form, e.g. 41.226.1.2/32 (SSH to bastion)"
  type        = string
}

variable "key_name" {
  description = "Existing EC2 key pair name (Academy: vockey)"
  type        = string
  default     = "vockey"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "instance_profile" {
  description = "IAM instance profile available in AWS Academy"
  type        = string
  default     = "LabInstanceProfile"
}

# Port of nginx on the instances. The Node.js API listens on 3001 behind nginx,
# so the 3000 vs 3001 mismatch of the L3 test server no longer matters.
variable "app_port" {
  type    = number
  default = 80
}

# ---------------------------------------------------------------------------
# Architecture v2 (ALB, Auto Scaling Group, RDS)
# ---------------------------------------------------------------------------

variable "unique_suffix" {
  description = "Same value as the argument of bootstrap/bootstrap.sh: it gives the data bucket name"
  type        = string
}

variable "app_version" {
  description = "Artifact version in S3: artifacts/backend-<v>.tar.gz and artifacts/frontend-<v>.tar.gz. Changing it replaces the instances one by one."
  type        = string
  default     = "v1"
}

variable "backend_entry" {
  description = "Start file of the NestJS build inside backend-<v>.tar.gz"
  type        = string
  default     = "dist/main.js"
}

variable "node_env" {
  description = "NODE_ENV of the API. TypeORM only creates the tables outside production, so keep development until real migrations exist, then switch to production."
  type        = string
  default     = "development"
}

variable "asg_min_size" {
  type    = number
  default = 2
}

variable "asg_max_size" {
  type    = number
  default = 3
}

variable "asg_desired_capacity" {
  type    = number
  default = 2
}

variable "ami_id" {
  description = "Pin an AMI id. null = latest Amazon Linux 2023."
  type        = string
  default     = null
}

variable "db_name" {
  type    = string
  default = "art_gallery"
}

variable "db_username" {
  type    = string
  default = "gallery"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_engine_version" {
  type    = string
  default = "16"
}

variable "db_parameter_group_family" {
  description = "Must match db_engine_version"
  type        = string
  default     = "postgres16"
}

variable "db_multi_az" {
  description = "RDS standby in the other AZ (doubles RDS hours: cost decision)"
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_snapshot_identifier" {
  description = "Restore the database from this snapshot (null = new empty database)"
  type        = string
  default     = null
}

variable "db_force_ssl" {
  description = "Force TLS on PostgreSQL connections. Keep false until the backend is configured for TLS."
  type        = bool
  default     = false
}
