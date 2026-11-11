output "alb_unhealthy_hosts_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn
}

output "rds_high_cpu_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.rds_high_cpu.arn
}