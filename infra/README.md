# Online Art Gallery - AWS Infrastructure (Terraform)

![Terraform](https://img.shields.io/badge/Terraform-planned-7B42BC?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Learner%20Lab-FF9900?logo=amazonaws&logoColor=white)

Infrastructure as Code for the **Online Art Gallery** project ([project overview](../README.md)), deployed on **AWS Academy Learner Lab** (region `us-east-1`).

- Application stack: Next.js static frontend ([`frontend/`](../frontend/README.md)), NestJS API ([`backend/`](../backend/README.md)), PostgreSQL on Amazon RDS
- Deliverable covered by this folder: **L3** (VPC, multi-AZ subnets, security groups, first instance, outbound access, destroy script)

> Rule of the course: nothing is built by hand in the AWS console. Everything is created and destroyed with Terraform.

## Contents

- [Architecture](#architecture)
- [What is deployed today](#what-is-deployed-today-29-resources)
- [Outbound access: justification](#outbound-access-justification)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Cost](#cost)
- [Non-functional objectives](#non-functional-objectives-from-l1)
- [Roadmap](#roadmap-future-work)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Architecture

![Architecture version 1](images/architercture-v1.png)

Editable source: `images/` (draw.io). Faded elements in the diagram are planned for the next phases and are **not created yet**.

```
Internet
   |
Internet Gateway
   |
[Public subnet 1 | Public subnet 2]   Bastion, NAT Gateway
   |  (NAT = outbound only)
[App subnet 1    | App subnet 2   ]   Backend (Node.js)
   |  (port 5432 from app-sg only)
[DB subnet 1     | DB subnet 2    ]   reserved for RDS PostgreSQL Multi-AZ
```

**Target (see roadmap):** the frontend is exported as static files and served by S3 + CloudFront. The API runs on private EC2 instances in an Auto Scaling Group behind an Application Load Balancer, across two AZs. The database is an RDS PostgreSQL Multi-AZ instance in private subnets.

## What is deployed today (29 resources)

### Network (`modules/network`)

| Resource | Count | Detail |
|---|---|---|
| VPC | 1 | `10.0.0.0/16`, DNS enabled |
| Internet Gateway | 1 | Two-way internet for public subnets |
| Subnets | 6 | 2 AZs (`us-east-1a`, `us-east-1b`) x 3 tiers |
| Route tables | 3 | public, app, db |
| Routes | 2 | public -> IGW, app -> NAT |
| Route table associations | 6 | one per subnet |
| Elastic IP | 1 | for the NAT Gateway |
| NAT Gateway | 1 | in public subnet 1, outbound-only access |
| S3 gateway endpoint | 1 | free private path to S3 (no bucket yet) |
| DB subnet group | 1 | ready for RDS Multi-AZ |

| Tier | AZ a | AZ b | Internet access |
|---|---|---|---|
| Public | 10.0.1.0/24 | 10.0.2.0/24 | Two-way, via Internet Gateway |
| App (private) | 10.0.11.0/24 | 10.0.12.0/24 | Outbound only, via NAT Gateway |
| DB (private) | 10.0.21.0/24 | 10.0.22.0/24 | None |

### Security (`modules/security`)

| Security group | Accepts | From |
|---|---|---|
| `alb-sg` | 80, 443 | Internet |
| `bastion-sg` | 22 (SSH) | Admin IP only (`/32`) |
| `app-sg` | 3000 (API), 22 | `alb-sg`, `bastion-sg` |
| `db-sg` | 5432 (PostgreSQL) | `app-sg` only |

Each tier trusts only the tier before it. Rules reference security groups, not IP addresses.

> **Port to align:** `app-sg` and the test server use port `3000`, but the NestJS API listens on `3001` locally (`/api/health` is the planned ALB health check). Before deploying the real API, either set the app port to `3000` in the backend configuration or change the `app-sg` rule and the ALB target group to `3001`.

### Compute (`modules/compute`)

| Instance | Subnet | Public IP | Role |
|---|---|---|---|
| `art-gallery-bastion` | Public 1 | Yes | SSH jump server |
| `art-gallery-backend-1` | App 1 (private) | No | Node.js test server on port 3000 |

Both are `t3.micro` on Amazon Linux 2023. The backend runs a startup script (`user_data`) that installs Node.js through the NAT Gateway, which proves that outbound access works.

## Outbound access: justification

Private instances must download packages (dnf, npm) but must never be reachable from the internet.

| Option | Pros | Cons | Decision |
|---|---|---|---|
| NAT Gateway (one, AZ a) | Managed, simple, reliable | ~0.045 USD/h + data | **Chosen** |
| NAT Gateway per AZ | Highest availability | Doubles the cost | Rejected (budget) |
| NAT instance | Cheaper | We manage patching and failover | Rejected (operational risk) |
| VPC endpoints only | No NAT cost | Only covers AWS services | Used **in addition** (S3 gateway endpoint, free) |

Known weakness: one NAT in AZ a means an AZ a failure cuts the outbound traffic of AZ b. Inbound user traffic (through the future ALB) is not affected. This is an accepted cost trade-off for a 50 USD budget.

## Project structure

```
infra/
|-- versions.tf                 provider + region + default tags
|-- variables.tf                inputs and defaults
|-- main.tf                     calls the 3 modules
|-- outputs.tf                  bastion IP, backend IP, SSH command
|-- terraform.tfvars.example    template for your personal values
|-- destroy.sh                  destroy + leftover check
|-- images/                     architecture diagrams + screenshots
`-- modules/
    |-- network/                VPC, subnets, gateways, routes, endpoint
    |-- security/               4 security groups
    `-- compute/                bastion + first backend
```

Each module has `variables.tf` (inputs), `main.tf` (resources), `outputs.tf` (outputs). The `rds` and `s3` modules are planned (see roadmap).

## Prerequisites

- Terraform >= 1.5 (`sudo snap install terraform --classic`)
- AWS CLI v2 (`sudo snap install aws-cli --classic`)
- An active AWS Academy Learner Lab session
- The Learner Lab key `labsuser.pem` (`chmod 400 labsuser.pem`)

## Usage

All commands are run from the `infra/` folder.

### 1. Credentials (every lab session)

AWS Academy -> Start Lab -> AWS Details -> Show. Paste the 3 values into `~/.aws/credentials`:

```
[default]
aws_access_key_id=...
aws_secret_access_key=...
aws_session_token=...
```

Check: `aws sts get-caller-identity`. Credentials expire when the lab session ends.

### 2. Configure

```bash
cp terraform.tfvars.example terraform.tfvars
curl -4 ifconfig.me        # your public IPv4
nano terraform.tfvars      # admin_cidr = "YOUR.IP/32"
```

![Public IP and terraform.tfvars](images/screenshots/01-admin-ip-tfvars.webp)

*The admin IP is read with `curl -4 ifconfig.me` and written to `admin_cidr` in `terraform.tfvars` (IP blurred). Only this address can reach the bastion on port 22.*

### 3. Deploy

```bash
terraform init
terraform validate
terraform plan             # expected: Plan: 29 to add
terraform apply
```

**Init and validate**

![terraform init](images/screenshots/02-terraform-init.webp)

![terraform validate](images/screenshots/03-terraform-validate.webp)

**Plan: 29 resources to add, 0 to change, 0 to destroy**

![terraform plan, start](images/screenshots/04-terraform-plan.webp)

![terraform plan, summary](images/screenshots/05-terraform-plan-summary.webp)

**Apply: 29 resources created**

![terraform apply, start](images/screenshots/06-terraform-apply.webp)

![terraform apply, progress](images/screenshots/07-apply-progress.webp)

The NAT Gateway is the slowest resource (about 2 minutes to create). The two instances are ready in about 15 seconds.

![terraform apply, complete and outputs](images/screenshots/08-apply-complete.webp)

### 4. Verify in the AWS console

Everything below was created by Terraform, nothing by hand.

**VPC resource map**: `art-gallery-vpc` (`10.0.0.0/16`) with its 6 subnets across `us-east-1a` / `us-east-1b`, the route tables, the Internet Gateway, the NAT Gateway and the S3 endpoint.

![VPC resource map](images/screenshots/09-console-vpc-resource-map.webp)

**Subnets**

![Subnets](images/screenshots/10-console-subnets.webp)

**Route tables**: `rt-public`, `rt-app` and `rt-db`, two subnets each. The extra "Main" route table is created automatically by AWS with every VPC and is not used.

![Route tables](images/screenshots/11-console-route-tables.webp)

**Internet Gateway**

![Internet Gateway](images/screenshots/12-console-internet-gateway.webp)

**NAT Gateway**: public, zonal, placed in public subnet 1.

![NAT Gateway](images/screenshots/13-console-nat-gateway.webp)

**S3 gateway endpoint**

![S3 gateway endpoint](images/screenshots/14-console-s3-endpoint.webp)

**Security groups**: `alb-sg`, `bastion-sg`, `app-sg`, `db-sg`. The two `default` groups belong to the VPCs, not to us.

![Security groups](images/screenshots/15-console-security-groups.webp)

**Instances**: the bastion (public IP) and the backend (no public IP), both running and passing 3/3 status checks.

![EC2 instances](images/screenshots/16-console-instances.webp)

### 5. Test

```bash
eval "$(ssh-agent -s)"
ssh-add labsuser.pem
ssh -J ec2-user@<bastion_public_ip> ec2-user@<backend_private_ip>
curl localhost:3000           # expected: art-gallery backend OK
curl -s https://ifconfig.me   # expected: the NAT Gateway Elastic IP
```

![SSH through the bastion and tests on the backend](images/screenshots/17-ssh-backend-test.webp)

Two things are proven here:

- The private backend (`10.0.11.x`) is reachable only through the bastion, and the Node.js server answers `art-gallery backend OK`.
- The backend reaches the internet through the NAT Gateway: its outbound public IP is the NAT Gateway's Elastic IP (same address as in the NAT Gateway screenshot), not an address of the instance itself.

### 6. Destroy (mandatory at the end of every session)

```bash
./destroy.sh
```

The script runs `terraform destroy`, then checks EC2, NAT Gateways, Elastic IPs, load balancers and RDS. It must finish with `OK: nothing billable left.`

![Destroy and leftover check](images/screenshots/18-destroy.webp)

*29 resources destroyed (the NAT Gateway takes about 1 minute). The leftover check confirms nothing billable remains.*

## Cost

| Item | Approx. cost while running |
|---|---|
| NAT Gateway | 0.045 USD/h + data |
| 2 x t3.micro | ~0.02 USD/h |
| Public IPv4 addresses | ~0.005 USD/h each |
| VPC, subnets, routes, security groups, endpoint | free |

About **0.08-0.10 USD per hour**. A forgotten week costs about 35% of the 50 USD credit, so **always destroy at the end of the session**.

## Non-functional objectives (from L1)

| Objective | Target | How it is addressed |
|---|---|---|
| Instance loss tolerance | No downtime if one app instance stops | 2 AZs now; ALB + Auto Scaling Group next |
| Load | 50 concurrent users (100 peak) | k6 load test planned |
| Rebuild time | <= 15 minutes | Terraform apply from scratch, timed |
| Max data loss | <= 5 minutes | RDS automated backups with point-in-time recovery (planned) |
| Budget | <= 50 USD | Destroy after every session, single NAT, t3.micro |

## Roadmap (future work)

- [x] VPC, multi-AZ subnets, route tables
- [x] Security groups (ALB -> app -> DB)
- [x] NAT Gateway outbound access + S3 gateway endpoint
- [x] Bastion + first backend instance
- [x] Destroy script with leftover check
- [ ] Application Load Balancer (public subnets), health check `GET /api/health`
- [ ] Launch Template + Auto Scaling Group (min 2, one per AZ)
- [ ] RDS PostgreSQL Multi-AZ with automated backups (5-minute RPO)
- [ ] S3 bucket for artwork images (presigned URLs, see [backend](../backend/README.md#déploiement))
- [ ] S3 bucket + CloudFront for the static frontend (`frontend/out`, see [frontend](../frontend/README.md#build-et-déploiement))
- [ ] Secrets Manager for `JWT_SECRET`, `ADMIN_PASSWORD`, RDS password, Stripe key
- [ ] CloudWatch logs, metrics and alarms
- [ ] Deploy the Next.js export and the NestJS API
- [ ] Remote state in S3 (team collaboration)
- [ ] k6 load test and full rebuild-time measurement
- [ ] boto3 scripts (RDS snapshot and restore, resilience test, cost report)
- [ ] Architecture diagram version 2 (with ALB, ASG, RDS, CloudFront)

## Security notes

- Never commit `terraform.tfvars`, `*.tfstate`, `.terraform/`, `labsuser.pem` or AWS credentials (all covered by `.gitignore`).
- Commit `.terraform.lock.hcl`.
- Keep `terraform.tfstate` until you have run `destroy`; without it Terraform cannot find your resources.
- Database passwords must be passed as `sensitive` variables, never written in Git.
- If your public IP changes, update `admin_cidr` and run `terraform apply` again.
- Screenshots in `images/screenshots/` have the admin IP and the AWS account ID blurred. Do the same for any new screenshot before committing it.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Permission denied: ./destroy.sh` | `chmod +x destroy.sh` |
| `ExpiredToken` / auth error | Restart the lab, paste new credentials |
| SSH to bastion hangs | Your IP changed: update `admin_cidr`, `terraform apply` |
| `Permission denied (publickey)` | `ssh-add labsuser.pem`, check with `ssh-add -l` |
| `curl localhost:3000` fails | Wait 1-2 minutes (Node.js installing), check `/var/log/cloud-init-output.log` |