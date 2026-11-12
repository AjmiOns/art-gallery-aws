variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "alarm_email" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "db_instance_identifier" {
  type = string
}

variable "tags" {
  type = map(string)
}