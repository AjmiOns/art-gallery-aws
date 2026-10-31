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

variable "app_port" {
  type    = number
  default = 3000
}
