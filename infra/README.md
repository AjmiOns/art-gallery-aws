# Infrastructure (Terraform)

Modules à écrire : `network` (VPC, sous-réseaux, NAT/endpoints), `compute` (ALB, Launch Template, ASG), `rds` (PostgreSQL), `s3` (frontend + images).
Ne jamais versionner `*.tfstate` ni `*.tfvars` (voir `.gitignore`).
