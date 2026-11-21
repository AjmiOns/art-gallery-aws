# ---------------------------------------------------------------------------
# Root module: wires the modules together (architecture v2).
# Each module is a reusable block with its own variables.tf, main.tf and
# outputs.tf. Values flow between modules through their outputs.
#
#   network   VPC, 6 subnets, IGW, NAT, S3 endpoint, DB subnet group
#   security  alb-sg, bastion-sg, app-sg, db-sg
#   compute   bastion
#   secrets   DB password, JWT secret, admin password (SSM Parameter Store)
#   alb       Application Load Balancer + target group + listener
#   rds       PostgreSQL (private DB subnets)
#   asg       Launch Template + Auto Scaling Group (min 2, one per AZ)
#   monitoring CloudWatch alarms for ALB target health and RDS CPU
# ---------------------------------------------------------------------------

# Ask AWS which availability zones (AZs) are currently usable in the region.
# state = "available" filters out zones that are impaired or unavailable.
data "aws_availability_zones" "available" {
  state = "available"
}



# The persistent data bucket is created by bootstrap/bootstrap.sh and is never destroyed.
# This lookup fails at plan time with a clear error if bootstrap.sh was not run
# (or if unique_suffix differs from the one used there).
data "aws_s3_bucket" "data" {
  bucket = "${var.project}-data-${var.unique_suffix}"
}

# HTTPS only: the zone and the ISSUED certificate are looked up, never created.
# If the certificate is not ISSUED (or the zone is missing), plan fails here.
data "aws_route53_zone" "app" {
  count        = var.enable_https ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

data "aws_acm_certificate" "app" {
  count       = var.enable_https ? 1 : 0
  domain      = "${var.app_subdomain}.${var.domain_name}"
  statuses    = ["ISSUED"]
  most_recent = true
}

locals {
  app_hostname  = var.enable_https ? "${var.app_subdomain}.${var.domain_name}" : null
  public_host   = var.enable_https ? local.app_hostname : module.alb.dns_name
  public_scheme = var.enable_https ? "https" : "http"

  azs = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project = var.project
    Managed = "terraform"
    Group   = var.group
  }
}

module "network" {
  source              = "./modules/network"
  name                = var.project
  region              = var.region
  vpc_cidr            = var.vpc_cidr
  azs                 = local.azs
  public_subnet_cidrs = var.public_subnet_cidrs
  app_subnet_cidrs    = var.app_subnet_cidrs
  db_subnet_cidrs     = var.db_subnet_cidrs
}

module "security" {
  source     = "./modules/security"
  name       = var.project
  vpc_id     = module.network.vpc_id
  admin_cidr = var.admin_cidr
  app_port   = var.app_port
}

module "compute" {
  source           = "./modules/compute"
  name             = var.project
  instance_type    = var.instance_type
  key_name         = var.key_name
  public_subnet_id = module.network.public_subnet_ids[0]
  bastion_sg_id    = module.security.bastion_sg_id
  tags             = local.tags
}

module "secrets" {
  source = "./modules/secrets"
  name   = var.project
}

module "alb" {
  source            = "./modules/alb"
  name              = var.project
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  alb_sg_id         = module.security.alb_sg_id
  app_port          = var.app_port

  enable_https    = var.enable_https
  certificate_arn = one(data.aws_acm_certificate.app[*].arn)
  https_hostname  = local.app_hostname
}

# DNS record for the application, created and destroyed with the stack.
resource "aws_route53_record" "app" {
  count   = var.enable_https ? 1 : 0
  zone_id = data.aws_route53_zone.app[0].zone_id
  name    = local.app_hostname
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

module "rds" {
  source                 = "./modules/rds"
  name                   = var.project
  db_subnet_group_name   = module.network.db_subnet_group_name
  db_sg_id               = module.security.db_sg_id
  instance_class         = var.db_instance_class
  engine_version         = var.db_engine_version
  parameter_group_family = var.db_parameter_group_family
  multi_az               = var.db_multi_az
  backup_retention_days  = var.db_backup_retention_days
  db_name                = var.db_name
  db_username            = var.db_username
  db_password            = module.secrets.db_password
  snapshot_identifier    = var.db_snapshot_identifier
  force_ssl              = var.db_force_ssl
}

module "monitoring" {
  source = "./modules/monitoring"

  name                    = var.project
  region                  = var.region
  alarm_email             = var.alarm_email
  log_retention_days      = var.log_retention_days
  alb_5xx_alarm_threshold = var.alb_5xx_alarm_threshold
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  db_instance_identifier  = module.rds.identifier
  tags                    = local.tags
}

module "asg" {
  source                 = "./modules/asg"
  name                   = var.project
  region                 = var.region
  instance_type          = var.instance_type
  key_name               = var.key_name
  instance_profile       = var.instance_profile
  ami_id                 = var.ami_id
  tags                   = local.tags
  log_group_boot         = module.monitoring.log_group_names.boot
  log_group_nginx_access = module.monitoring.log_group_names.nginx_access
  log_group_nginx_error  = module.monitoring.log_group_names.nginx_error
  log_group_app          = module.monitoring.log_group_names.app

  app_sg_id        = module.security.app_sg_id
  app_subnet_ids   = module.network.app_subnet_ids
  target_group_arn = module.alb.target_group_arn

  min_size                  = var.asg_min_size
  max_size                  = var.asg_max_size
  desired_capacity          = var.asg_desired_capacity
  scale_cpu_target          = var.scale_cpu_target
  estimated_instance_warmup = var.estimated_instance_warmup
  enable_instance_refresh   = var.enable_instance_refresh

  artifact_bucket    = data.aws_s3_bucket.data.id
  app_version        = var.app_version
  backend_entry      = var.backend_entry
  node_env           = var.node_env
  public_host        = local.public_host
  public_scheme      = local.public_scheme
  db_host            = module.rds.address
  db_port            = module.rds.port
  db_name            = var.db_name
  db_user            = var.db_username
  ssm_db_password    = module.secrets.db_password_param
  ssm_jwt_secret     = module.secrets.jwt_secret_param
  ssm_admin_password = module.secrets.admin_password_param

  # Instances need the NAT route (dnf, npm) from their very first second.
  depends_on = [module.network]
}
