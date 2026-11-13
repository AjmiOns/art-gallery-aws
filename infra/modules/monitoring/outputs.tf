output "alb_unhealthy_hosts_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn
}

output "rds_high_cpu_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.rds_high_cpu.arn
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.operations.dashboard_name
}

output "log_group_names" {
  value = {
    boot         = aws_cloudwatch_log_group.boot.name
    nginx_access = aws_cloudwatch_log_group.nginx_access.name
    nginx_error  = aws_cloudwatch_log_group.nginx_error.name
    app          = aws_cloudwatch_log_group.app.name
  }
}