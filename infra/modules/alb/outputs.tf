output "dns_name" { value = aws_lb.this.dns_name }
output "target_group_arn" { value = aws_lb_target_group.app.arn }

# Needed later for CloudWatch alarms (L6).
output "alb_arn_suffix" { value = aws_lb.this.arn_suffix }
output "target_group_arn_suffix" { value = aws_lb_target_group.app.arn_suffix }

# Needed for the Route 53 alias record.
output "zone_id" { value = aws_lb.this.zone_id }
