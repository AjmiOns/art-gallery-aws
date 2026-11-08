variable "name" { type = string }
variable "db_subnet_group_name" { type = string }
variable "db_sg_id" { type = string }

variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "engine_version" {
  description = "PostgreSQL major version (AWS picks the latest minor)"
  type        = string
  default     = "16"
}

variable "parameter_group_family" {
  description = "Must match engine_version, e.g. postgres16"
  type        = string
  default     = "postgres16"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "multi_az" {
  description = "Standby in the other AZ. Doubles the RDS hours: a cost decision."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Automated backups (point-in-time recovery). 0 disables them."
  type        = number
  default     = 7
}

variable "db_name" { type = string }
variable "db_username" { type = string }

variable "db_password" {
  type      = string
  sensitive = true
}

variable "snapshot_identifier" {
  description = "Restore from this snapshot instead of creating an empty database"
  type        = string
  default     = null
}

variable "force_ssl" {
  description = "RDS PostgreSQL 15+ refuses non-TLS connections by default. false turns that off so the backend works without TLS settings (traffic stays inside the private VPC)."
  type        = bool
  default     = false
}
