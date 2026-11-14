variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "alarm_email" {
  type = string
}

variable "log_retention_days" {
  type = number
}

variable "alb_5xx_alarm_threshold" {
  type = number
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