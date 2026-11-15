variable "name" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "alb_sg_id" { type = string }
variable "app_port" { type = number }
variable "health_check_path" {
  type    = string
  default = "/api/health"
}

# HTTPS (optional). The certificate is requested and validated once, outside
# Terraform (Route 53 zone + ACM), so it survives every destroy.
variable "enable_https" {
  type    = bool
  default = false
}

variable "certificate_arn" {
  description = "ISSUED ACM certificate for the public hostname (required when enable_https = true)"
  type        = string
  default     = null
}

variable "https_hostname" {
  description = "Public hostname. When set, HTTP requests are redirected to https://<hostname>"
  type        = string
  default     = null
}
