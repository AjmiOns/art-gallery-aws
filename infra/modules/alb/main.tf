# ---------------------------------------------------------------------------
# Entry point: the ONLY resource exposed to the Internet (cahier §5.2 "Entree").
# HTTP by default. With enable_https = true: HTTPS on 443 (ACM) and 80 redirects to it.
# ---------------------------------------------------------------------------
resource "aws_lb" "this" {
  name                       = "${var.name}-alb"
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [var.alb_sg_id]
  subnets                    = var.public_subnet_ids # spans both AZs
  drop_invalid_header_fields = true
  tags                       = { Name = "${var.name}-alb" }
}


# Targets are the nginx on each instance (port 80). nginx proxies /api to Node.
resource "aws_lb_target_group" "app" {
  name                 = "${var.name}-tg"
  port                 = var.app_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "instance"
  deregistration_delay = 30 # default 300 s makes demos and destroy slow

  # A target failing this check is removed from rotation automatically.
  health_check {
    path                = var.health_check_path
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.name}-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  # HTTPS off: forward to the target group (HTTP only, as before).
  dynamic "default_action" {
    for_each = var.enable_https ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.app.arn
    }
  }

  # HTTPS on: permanent redirect to the HTTPS hostname.
  dynamic "default_action" {
    for_each = var.enable_https ? [1] : []
    content {
      type = "redirect"
      redirect {
        host        = var.https_hostname
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

# TLS ends at the ALB; traffic to the instances stays HTTP inside the VPC.
resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  lifecycle {
    precondition {
      condition     = var.certificate_arn != null
      error_message = "enable_https = true needs an ISSUED ACM certificate (certificate_arn)."
    }
  }
}
