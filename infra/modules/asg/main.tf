# ---------------------------------------------------------------------------
# Application tier: Launch Template + Auto Scaling Group across the two private
# app subnets (one per AZ). Provisioning is only user_data, never by hand.
# ---------------------------------------------------------------------------
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_launch_template" "app" {
  name_prefix   = "${var.name}-app-"
  image_id      = coalesce(var.ami_id, data.aws_ami.al2023.id)
  instance_type = var.instance_type
  key_name      = var.key_name

  iam_instance_profile {
    name = var.instance_profile
  }

  vpc_security_group_ids = [var.app_sg_id]

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tpl", {
    region                 = var.region
    bucket                 = var.artifact_bucket
    app_version            = var.app_version
    backend_entry          = var.backend_entry
    node_env               = var.node_env
    public_host            = var.public_host
    public_scheme          = var.public_scheme
    db_host                = var.db_host
    db_port                = var.db_port
    db_name                = var.db_name
    db_user                = var.db_user
    ssm_db_password        = var.ssm_db_password
    ssm_jwt_secret         = var.ssm_jwt_secret
    ssm_admin_password     = var.ssm_admin_password
    log_group_boot         = var.log_group_boot
    log_group_nginx_access = var.log_group_nginx_access
    log_group_nginx_error  = var.log_group_nginx_error
    log_group_app          = var.log_group_app
  }))

  # IMDSv2 only.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 8
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  # Provider default_tags do not reach instances launched by an ASG.
  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = "${var.name}-app" })
  }

  tag_specifications {
    resource_type = "volume"
    tags          = merge(var.tags, { Name = "${var.name}-app" })
  }

  tag_specifications {
    resource_type = "network-interface"
    tags          = merge(var.tags, { Name = "${var.name}-app" })
  }

  update_default_version = true

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.name}-asg"
  min_size            = var.min_size
  max_size            = var.max_size
  desired_capacity    = var.desired_capacity
  vpc_zone_identifier = var.app_subnet_ids # one subnet per AZ

  target_group_arns = [var.target_group_arn]

  # ELB health: an instance the ALB sees as unhealthy is terminated and replaced.
  health_check_type         = "ELB"
  health_check_grace_period = 300 # dnf + S3 download + npm ci take a few minutes

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  # Optional rolling replacement when the launch template changes. It calls
  # autoscaling:StartInstanceRefresh, which the AWS Academy lab SCP denies, so
  # it is disabled by default. Without it, a new launch template version only
  # applies to new instances: replace the running ones by hand (README, T8).
  dynamic "instance_refresh" {
    for_each = var.enable_instance_refresh ? [1] : []
    content {
      strategy = "Rolling"
      preferences {
        min_healthy_percentage = 50
        instance_warmup        = 180
      }
    }
  }

  # terraform apply returns only when the targets are healthy in the ALB.
  wait_for_capacity_timeout = "15m"
  min_elb_capacity          = var.min_size

  tag {
    key                 = "Name"
    value               = "${var.name}-app"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.tags["Project"]
    propagate_at_launch = true
  }

  tag {
    key                 = "Managed"
    value               = var.tags["Managed"]
    propagate_at_launch = true
  }

  tag {
    key                 = "Group"
    value               = var.tags["Group"]
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "cpu_target_tracking" {
  name                   = "${var.name}-cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  estimated_instance_warmup = var.estimated_instance_warmup

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }

    target_value = var.scale_cpu_target
  }
}
