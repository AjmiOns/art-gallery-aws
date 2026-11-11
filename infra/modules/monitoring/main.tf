resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.name}-alb-unhealthy-hosts"
  alarm_description   = "ALB target group has unhealthy targets for two consecutive minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.name}-rds-high-cpu"
  alarm_description   = "RDS CPU utilization exceeds 80 percent for ten consecutive minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  tags = var.tags
}