resource "aws_cloudwatch_log_group" "boot" {
  name              = "/${var.name}/boot"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "nginx_access" {
  name              = "/${var.name}/nginx-access"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "nginx_error" {
  name              = "/${var.name}/nginx-error"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.name}/app"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_sns_topic" "alarm_notifications" {
  name = "${var.name}-alarm-notifications"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "alarm_email" {
  topic_arn = aws_sns_topic.alarm_notifications.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

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
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]
  ok_actions          = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = var.tags
}

# 5xx answers produced by the instances (nginx returns 502 when the API is down).
# The metric only exists while errors happen: no data means no error.
resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  alarm_name          = "${var.name}-alb-target-5xx"
  alarm_description   = "The instances returned ${var.alb_5xx_alarm_threshold} or more 5xx responses in one minute."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = var.alb_5xx_alarm_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]
  ok_actions          = [aws_sns_topic.alarm_notifications.arn]

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
  alarm_actions       = [aws_sns_topic.alarm_notifications.arn]
  ok_actions          = [aws_sns_topic.alarm_notifications.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${var.name}-operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "alarm"
        x      = 0
        y      = 0
        width  = 24
        height = 3
        properties = {
          title = "Alarm status"
          alarms = [
            aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn,
            aws_cloudwatch_metric_alarm.alb_target_5xx.arn,
            aws_cloudwatch_metric_alarm.rds_high_cpu.arn,
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 3
        width  = 8
        height = 6
        properties = {
          title   = "ALB target health"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Minimum", label = "Healthy targets" }],
            ["AWS/ApplicationELB", "UnHealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Maximum", label = "Unhealthy targets" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 3
        width  = 8
        height = 6
        properties = {
          title   = "ALB requests and target errors"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", label = "Requests" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Sum", label = "Target 5xx responses" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 3
        width  = 8
        height = 6
        properties = {
          title   = "Target response time"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 60
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Average", label = "Average seconds" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 9
        width  = 8
        height = 6
        properties = {
          title   = "RDS CPU utilization"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 300
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.db_instance_identifier, { stat = "Average", label = "CPU percent" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 9
        width  = 8
        height = 6
        properties = {
          title   = "RDS database connections"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 300
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.db_instance_identifier, { stat = "Maximum", label = "Connections" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 9
        width  = 8
        height = 6
        properties = {
          title   = "RDS free storage"
          view    = "timeSeries"
          stacked = false
          region  = var.region
          period  = 300
          yAxis = {
            left = { label = "Bytes" }
          }
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.db_instance_identifier, { stat = "Minimum", label = "Free bytes" }],
          ]
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 15
        width  = 24
        height = 6
        properties = {
          title  = "Latest application errors"
          view   = "table"
          region = var.region
          query  = "SOURCE '${aws_cloudwatch_log_group.app.name}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
        }
      },
    ]
  })
}