# =============================================================================
# Livrable 3:
#
#   1. un VPC (reseau isole)
#   2. des sous-reseaux sur 2 AZ
#   3. un Internet Gateway (entree/sortie des sous-reseaux PUBLICS)
#   4. UN NAT Gateway (sortie Internet des sous-reseaux PRIVES)
#   5. un groupe de securite (pare-feu)
#   6. une cle SSH
#   7. le bastion (sas SSH, IP publique) + la 1re instance (privee)
#
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls   = { source = "hashicorp/tls", version = "~> 4.0" }
    local = { source = "hashicorp/local", version = "~> 2.0" }
  }
}

provider "aws" {
  region = "us-east-1"
}

# IP en lab : 0.0.0.0/0 || l'IP change.
variable "mon_ip" {
  type    = string
  default = "0.0.0.0/0"
}

# Learner Lab : "LabInstanceProfile". Compte perso : "".
variable "profil_iam" {
  type    = string
  default = "LabInstanceProfile"
}

data "aws_availability_zones" "dispo" {
  state = "available"
}

data "aws_ami" "linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

locals {
  az_a = data.aws_availability_zones.dispo.names[0]
  az_b = data.aws_availability_zones.dispo.names[1]
}

# 1.VPC -----------------------------------------------------------------

resource "aws_vpc" "lab" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "galerie-vpc" }
}

# 2.Sous-reseaux multi-AZ -----------------------------------------------
# 2 publics (bastion + NAT) et 2 prives (la 1re instance, plus tard l'API).

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.lab.id
  cidr_block              = "10.0.0.0/24"
  availability_zone       = local.az_a
  map_public_ip_on_launch = true
  tags                    = { Name = "galerie-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.lab.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = local.az_b
  map_public_ip_on_launch = true
  tags                    = { Name = "galerie-public-b" }
}

resource "aws_subnet" "prive_a" {
  vpc_id            = aws_vpc.lab.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = local.az_a
  tags              = { Name = "galerie-prive-a" }
}

resource "aws_subnet" "prive_b" {
  vpc_id            = aws_vpc.lab.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = local.az_b
  tags              = { Name = "galerie-prive-b" }
}

# 3.Internet Gateway (sous-reseaux publics) -----------------------------

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.lab.id
  tags   = { Name = "galerie-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.lab.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "galerie-rt-public" }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# 4.Acces sortant : UN NAT ---------

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]
  tags       = { Name = "galerie-nat-ip" }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id
  tags          = { Name = "galerie-nat" }
}

resource "aws_route_table" "prive" {
  vpc_id = aws_vpc.lab.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = { Name = "galerie-rt-prive" }
}

resource "aws_route_table_association" "prive_a" {
  subnet_id      = aws_subnet.prive_a.id
  route_table_id = aws_route_table.prive.id
}

resource "aws_route_table_association" "prive_b" {
  subnet_id      = aws_subnet.prive_b.id
  route_table_id = aws_route_table.prive.id
}

# 5.Groupe de securite --------------------------------------------------

resource "aws_security_group" "ssh" {
  name   = "galerie-ssh"
  vpc_id = aws_vpc.lab.id

  # Entrant : SSH depuis la machine (bastion)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.mon_ip]
  }

  # L'instance privee accepte SSH seulement depuis ce meme SG (le bastion)
  ingress {
    from_port = 22
    to_port   = 22
    protocol  = "tcp"
    self      = true
  }

  # Sortant : tout (yum / curl via NAT ou IGW)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "galerie-ssh" }
}

# 6.Cle SSH (fichier galerie.pem) ------------------

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "ssh" {
  key_name   = "galerie-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "local_file" "pem" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/galerie.pem"
  file_permission = "0600"
}

# 7.Premiere instance (privee) -----------

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.linux.id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public_a.id
  vpc_security_group_ids      = [aws_security_group.ssh.id]
  key_name                    = aws_key_pair.ssh.key_name
  associate_public_ip_address = true
  iam_instance_profile        = var.profil_iam == "" ? null : var.profil_iam
  tags                        = { Name = "galerie-bastion" }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.linux.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.prive_a.id
  vpc_security_group_ids = [aws_security_group.ssh.id]
  key_name               = aws_key_pair.ssh.key_name
  iam_instance_profile   = var.profil_iam == "" ? null : var.profil_iam
  tags                   = { Name = "galerie-instance-1" }
}

# Affiche a la fin de "terraform apply" ----------------------------------

output "commande_ssh" {
  value = "ssh -i galerie.pem -J ec2-user@${aws_instance.bastion.public_ip} ec2-user@${aws_instance.app.private_ip}"
}

output "preuve_sortant" {
  value = "Connecte, tapez :  curl -I https://example.com"
}
