variable "region" {
  type    = string
  default = "us-east-1" # AWS Academy Learner Lab
}

variable "project" {
  type    = string
  default = "art-gallery"
}

variable "group" {
  description = "Group prefix applied as a resource tag."
  type        = string
  default     = "tek26"

  validation {
    condition     = can(regex("^[A-Za-z0-9-]{1,32}$", var.group))
    error_message = "The group tag must contain 1 to 32 letters, digits, or hyphens."
  }
}

variable "alarm_email" {
  description = "Email address subscribed to CloudWatch alarm notifications"
  type        = string
}

variable "log_retention_days" {
  description = "Number of days CloudWatch log groups retain events."
  type        = number
  default     = 7
}

variable "alb_5xx_alarm_threshold" {
  description = "Number of 5xx responses returned by the instances in one minute that triggers the 5xx alarm."
  type        = number
  default     = 5

  validation {
    condition     = var.alb_5xx_alarm_threshold >= 1
    error_message = "alb_5xx_alarm_threshold must be at least 1."
  }
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
# HTTPS and custom domain (optional, off by default)
# The Route 53 hosted zone and the ACM certificate are created ONCE, outside
# Terraform, so they survive every destroy. Terraform only looks them up.
# ---------------------------------------------------------------------------

variable "enable_https" {
  description = "true: HTTPS listener (443), HTTP redirect, and a DNS record for the app hostname"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Your own domain, whose public hosted zone already exists in Route 53 (required when enable_https = true)"
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_https || var.domain_name != ""
    error_message = "enable_https = true needs domain_name: set your own domain in terraform.tfvars."
  }
}

variable "app_subdomain" {
  description = "Subdomain of the application (the ACM certificate must be issued for <app_subdomain>.<domain_name>)"
  type        = string
  default     = "gallery"
}

# ---------------------------------------------------------------------------
# Architecture v2 (ALB, Auto Scaling Group, RDS)
# ---------------------------------------------------------------------------

variable "unique_suffix" {
  description = "Same value as the argument of bootstrap/bootstrap.sh: it gives the data bucket name"
  type        = string
}

variable "app_version" {
  description = "Artifact version in S3: artifacts/backend-<v>.tar.gz and artifacts/frontend-<v>.tar.gz. Changing it creates a new launch template version used by new instances. Running instances are replaced manually (see T8 in the README): the lab denies StartInstanceRefresh."
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

variable "scale_cpu_target" {
  description = "Target average CPU utilization percentage for ASG target tracking."
  type        = number
  default     = 60

  validation {
    condition     = var.scale_cpu_target >= 20 && var.scale_cpu_target <= 90
    error_message = "scale_cpu_target must be between 20 and 90 percent."
  }
}

variable "estimated_instance_warmup" {
  description = "Estimated seconds for a newly launched ASG instance to warm up."
  type        = number
  default     = 300
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

variable "enable_instance_refresh" {
  description = "Requires autoscaling:StartInstanceRefresh. The AWS Academy lab SCP denies it, so keep false in the lab."
  type        = bool
  default     = false
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
  description = "PostgreSQL major version of the RDS instance. Must match db_parameter_group_family (16 -> postgres16)."
  type        = string
  default     = "16"
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
