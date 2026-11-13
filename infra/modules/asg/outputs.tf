output "asg_name" { value = aws_autoscaling_group.app.name }

output "cpu_scaling_policy_name" {
  value = aws_autoscaling_policy.cpu_target_tracking.name
}
