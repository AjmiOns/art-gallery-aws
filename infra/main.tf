# ---------------------------------------------------------------------------
# Root module: wires the three modules together (network, security, compute).
# Each module is a reusable block with its own variables.tf, main.tf and
# outputs.tf. Values flow between modules through their outputs.
# ---------------------------------------------------------------------------

# Ask AWS which availability zones (AZs) are currently usable in the region.
# state = "available" filters out zones that are impaired or unavailable.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
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
  instance_profile = var.instance_profile
  app_port         = var.app_port
  public_subnet_id = module.network.public_subnet_ids[0]
  app_subnet_id    = module.network.app_subnet_ids[0]
  bastion_sg_id    = module.security.bastion_sg_id
  app_sg_id        = module.security.app_sg_id
}
