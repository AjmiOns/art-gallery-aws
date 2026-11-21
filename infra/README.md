<!--
TODO before submission (delete this block when done):
1. Every [ADD SCREENSHOT] marker names the file to add in images/screenshots/. The other screenshots are listed in EVIDENCE.md (same folder).
2. Blur the admin IP, the AWS account ID and any password in each screenshot.
3. Fill every "___" in the measurement tables (real-mode apply time, destroy time, artifact sizes, test results).
4. Never screenshot the output of `--with-decryption` (it prints a secret).
5. HTTPS: add `v2-13-https.png` (padlock, and the `curl -sI http://...` redirect). Blur the account ID and your IP.
-->

# Online Art Gallery - AWS Infrastructure (Terraform)

![Terraform](https://img.shields.io/badge/Terraform-v2%20applied%20and%20verified-7B42BC?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Learner%20Lab-FF9900?logo=amazonaws&logoColor=white)
![Resources](https://img.shields.io/badge/resources-52%20(54%20with%20HTTPS)-blue)

Infrastructure as Code for the **Online Art Gallery** project ([project overview](../README.md)), deployed on **AWS Academy Learner Lab** (region `us-east-1`).

- This README covers **infrastructure only**. The application is documented in its own READMEs: [`frontend/`](../frontend/README.md) and [`backend/`](../backend/README.md).
- Deliverables covered here: **L3** (network, security, outbound access, destroy script) and **L4/L5** (ALB, Auto Scaling Group, RDS, secrets, artifact deployment). Architecture v2 has been **applied end to end**: 52 resources (network, ALB, Auto Scaling Group with a CPU scaling policy, RDS, secrets, CloudWatch log groups and alarms), 54 with HTTPS. The real application answers behind the load balancer, and over HTTPS at `https://gallery.viewmyart.me` when `enable_https = true` ([HTTPS and custom domain](#https-and-custom-domain)).
- **The database data is restored automatically** at the first boot of a new stack, from a dump kept in the persistent data bucket (`seed/gallery.sql`). `terraform apply` is the only command needed to get the application back with its data. Details, queries and commands: [RDS.md](RDS.md).
- **Images uploaded from a computer go to S3 automatically** (`artworks/uploads/` in the persistent data bucket) and are served by the API. What lives in the buckets, the commands and the cost: [S3.md](S3.md).
- Still to do (see [Roadmap](#roadmap-future-work)): rolling update demo, snapshot restore demo, k6 load test. CloudWatch log shipping is done: every instance sends its boot, nginx and application logs to the four `/art-gallery/*` log groups.

> **Evidence.** This README keeps only the key screenshots. Every command has its screenshot in [EVIDENCE.md](EVIDENCE.md), grouped under the same headings.

> Rule of the course: nothing is built by hand in the AWS console. Everything is created and destroyed with Terraform (or, for the persistent buckets, a documented AWS CLI script). The console is used **only to look**, and this document shows resources with the **AWS CLI**.

## Contents

- [At a glance](#at-a-glance)
- [Architecture](#architecture)
- [How do we deploy the application? Options compared](#how-do-we-deploy-the-application-options-compared)
- [Other decisions](#other-decisions)
- [HTTPS and custom domain](#https-and-custom-domain)
- [What is deployed (52-resource baseline)](#what-is-deployed-52-resource-baseline)
- [Project structure](#project-structure)
- [Bootstrap (persistent buckets)](#bootstrap-persistent-buckets)
- [How an instance boots](#how-an-instance-boots)
- [Database: seed, queries and backup (RDS.md)](#database-seed-queries-and-backup)
- [S3: buckets and uploaded images (S3.md)](S3.md)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Build time](#build-time)
- [Cost](#cost)
- [Verification with the AWS CLI (every resource)](#verification-with-the-aws-cli-every-resource)
- [Tests](#tests)
- [Non-functional objectives](#non-functional-objectives)
- [Roadmap (future work)](#roadmap-future-work)
- [Known limits](#known-limits)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Appendix: L3 baseline (29 resources)](#appendix-l3-baseline-29-resources)
- [Full screenshot evidence (EVIDENCE.md)](EVIDENCE.md)

## At a glance

| Item | Value |
|---|---|
| Region / account type | `us-east-1`, AWS Academy Learner Lab (`LabRole`, `LabInstanceProfile`) |
| Resources in the main stack | **52** (54 with `enable_https = true`). `terraform state list` shows 56 entries (60 with HTTPS) because it also lists 4 read-only data sources (6 with HTTPS) |
| Full build time (measured) | **14 min 17 s** in real mode with HTTPS (`./apply.sh`, 54 resources). Earlier fallback-mode run: 11.5 min. RDS (about 9 min) is the critical path |
| Running cost | **about 0.15 USD per hour** (approximate, see [Cost](#cost)) |
| Deployment method | Versioned **tar.gz artifacts in S3**, installed at boot by `user_data` (no Docker, no ECR) |
| Entry point | One public URL: the ALB (`terraform output app_url`). With `enable_https = true`: `https://gallery.viewmyart.me` (HTTP redirects to HTTPS) |
| Persistent between sessions | 2 S3 buckets (versioned and locked Terraform state; artifacts, images and the database seed `seed/gallery.sql`), created by `bootstrap/bootstrap.sh`. Also the Route 53 hosted zone and the ACM certificate, created once by hand (see [HTTPS](#https-and-custom-domain)) |
| Uploaded images | Stored by the backend in `s3://<data bucket>/artworks/uploads/` and served at `/api/uploads/<file>` (see [S3.md](S3.md)) |
| Database content after a rebuild | Restored by the first booting instance from `seed/gallery.sql` (no manual step). See [RDS.md](RDS.md) |
| Destroyed every session | Everything else (`./destroy.sh`, ends with `OK: nothing billable left.`) |

## Architecture

Editable source: `images/architecture-v2.1.drawio` (draw.io).

![Architecture version 2](images/architecture-v3.jpg)

```
Customers -> Internet Gateway -> ALB :80 (public subnets 1+2, health check /api/health)
                                   |
                  ASG min 2, one per AZ (private app subnets)
                  nginx :80 (static frontend, proxies /api) -> Node.js :3001
                                   |  (5432, from app-sg only)
                       RDS PostgreSQL (private DB subnets, no internet route)

Admin -> Bastion (SSH 22, admin IP /32) -> app instances (SSH 22, from bastion-sg)
App instances -> NAT Gateway -> Internet Gateway   (dnf, npm: outbound only)
App instances -> S3 gateway endpoint -> S3         (artifacts, free path)
Persistent (bootstrap/): S3 state bucket + S3 data bucket (artifacts/, artworks/)
```

| Tier | AZ a | AZ b | Internet access |
|---|---|---|---|
| Public | 10.0.1.0/24 | 10.0.2.0/24 | Two-way, via Internet Gateway (ALB, bastion, NAT) |
| App (private) | 10.0.11.0/24 | 10.0.12.0/24 | Outbound only, via NAT Gateway |
| DB (private) | 10.0.21.0/24 | 10.0.22.0/24 | None |

### Security (`modules/security`)

| Security group | Accepts | From |
|---|---|---|
| `art-gallery-alb-sg` | 80, 443 (443 answers only when `enable_https = true`) | Internet |
| `art-gallery-bastion-sg` | 22 | Admin IP only (`/32`) |
| `art-gallery-app-sg` | 80 (nginx), 22 | `alb-sg`, `bastion-sg` |
| `art-gallery-db-sg` | 5432 | `app-sg` only |

Each tier trusts only the tier before it. Rules reference security groups, not IP addresses.

## How do we deploy the application? Options compared

### The question

The application instances sit in **private subnets** inside an **Auto Scaling Group**. Any instance can be replaced at any time, so each new instance must install the right version of the application **on its own, at first boot**. How does the code reach it?

Constraints that decide the answer:

| Constraint | Source |
|---|---|
| ASG of EC2 instances built from a Launch Template + `user_data` is the required architecture | cahier §4/§5 |
| The AWS services list is closed (EC2, ASG, ALB, RDS, S3, CloudWatch, ...). Containers (ECR/ECS/EKS) are not on it | cahier §4, §7 |
| No secret in `user_data` or in Git | cahier §5.2 |
| Rebuild from zero in 15 minutes or less (our own L1 target) | L1 |
| Budget 50 USD, everything destroyed after each session | cahier §3 |
| Instances are `t3.micro` (1 GB RAM, 2 vCPU) | cost |

### Options

| # | Option | How it works | Weight per new version | Boot work | On the cahier list | Main drawback | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Plain artifacts in S3** | The application is built once and packed into two versioned `.tar.gz` files (backend, frontend) uploaded to S3. `user_data` downloads them, installs production dependencies and starts the services with systemd | **A few MB** (backend ___ MB, frontend ___ MB) | `dnf install nginx nodejs`, `aws s3 cp`, `npm ci` (~25 s) | Yes (S3, LT, user_data) | `npm ci` needs the npm registry at boot (through the NAT) | **Chosen** |
| 2 | Docker image as tarball in S3 | `docker build`, `docker save`, upload tar. `user_data` installs Docker, `docker load`, `docker run` | ~224 MB, whole file every time | Install Docker, load image | Yes (S3) | Heavy upload, Docker daemon on 1 GB RAM, IMDS hop-limit setting needed | Rejected |
| 3 | Docker image in **ECR** | `docker push` / `docker pull` with the instance role | Only changed layers (~224 MB first time) | Install Docker, log in, pull | **Grey zone** (not listed, not forbidden) | Permissions in the Learner Lab unverified, Docker daemon on 1 GB RAM, repository to clean | Kept as a **possible upgrade**, not built |
| 4 | ECS (EC2 or Fargate) | Container service schedules the containers | Image in ECR | Task definitions, services | **No** (replaces the required ASG design) | Changes the architecture the grading expects | Rejected |
| 5 | EKS (Kubernetes) | Managed control plane | Image in ECR | Cluster, node groups, manifests | **No** | About +0.10 USD/h for the control plane alone, large complexity | Rejected |
| 6 | `git clone` + build on the instance | Instance clones the repo and builds | Zero upload | Needs git credentials, `npm run build` on 1 GB RAM, slow and heavy | Needs a secret or public repo | Not reproducible, build can run out of memory, slower boot | Rejected |
| 7 | Pre-baked AMI (Packer) | Image already contains the app | New AMI per version | Fastest boot | Extra tool, not in course | More tooling, AMI storage, rebuild of the AMI at each change | Rejected (over-engineering) |
| 8 | Elastic Beanstalk | AWS manages EC2/ASG/ALB from a zip | Zip upload | Managed | **No** | Hides the infrastructure the course wants us to write in Terraform | Rejected |

### Why option 1 (plain artifacts in S3)

1. **It matches the cahier exactly.** S3 is on the list, the instances come from a Launch Template with `user_data`, and no credential appears anywhere: the instance role reads S3 and SSM by itself.
2. **Smallest upload.** A few MB instead of a ~224 MB image. Uploads only happen **when the code changes**, never during a normal apply/destroy cycle, because the bucket is persistent.
3. **Fast and light boot.** No Docker install, no image load, no daemon eating RAM on a 1 GB `t3.micro`. `npm ci` takes about 25 s.
4. **Versioned and reversible.** `backend-v1.tar.gz` / `frontend-v1.tar.gz` are immutable by name. A new version is a new file plus one Terraform variable (`app_version`), which creates a new launch template version. The lab denies `autoscaling:StartInstanceRefresh`, so the running instances are replaced one at a time by hand (see [T8](#t8-new-version-without-total-interruption)): no total interruption.
5. **Reproducible.** `package-lock.json` pins the dependency versions, and the artifact is the same on every instance.
6. **Safe fallback.** If the artifacts are missing, the instance still boots in *fallback mode* and answers `/api/health`, so the infrastructure can be demonstrated before the application is packaged.

What we give up, and why it is acceptable:

| We give up | Why acceptable |
|---|---|
| "Identical everywhere" guarantee of an image | `package-lock.json` pins versions, Amazon Linux 2023 is the same base on every instance |
| Image scanning (ECR) | Out of scope for this deliverable, listed as a possible upgrade |
| Independence from the npm registry at boot | The NAT Gateway already exists for outbound access. Fallback if needed: bundle `node_modules` in the artifact |

### Why not ECR (and what changes if we add it later)

ECR is technically a good service and is billed by storage (about 0.10 USD per GB per month), not by the hour, so it would be consistent with the "destroy hourly-billed resources" rule. We did not build on it because it is **not on the closed §4 list**, because the Docker daemon costs RAM and boot time on a `t3.micro`, and because option 1 already meets every requirement. The registry would live in `bootstrap/` (never destroyed), only the download step in `user_data` would change, and `destroy.sh` would need an ECR check in its leftover list.

> Check that no ECR repository is left over from earlier experiments (see [leftover check](#leftover-check)): `aws ecr describe-repositories`.

### Entry point: one origin behind the ALB

| Option | Description | Verdict |
|---|---|---|
| **A. nginx on the app instances** | nginx serves the static site and proxies `/api` to the API on the same instance. The ALB is the only public entry point and exposes **one origin** (no CORS, no mixed HTTP/HTTPS content) | **Chosen** |
| B. S3 + CloudFront | Static site on S3, CloudFront in front, `/api/*` as a second origin to the ALB | Rejected for now: CloudFront is optional in the cahier, heavier, and needs an extra origin to avoid mixed content |

How the site and API are built is described in the [frontend](../frontend/README.md#build-et-déploiement) and [backend](../backend/README.md#déploiement) READMEs.

## Other decisions

| Topic | Chosen | Alternatives | Why |
|---|---|---|---|
| Outbound access | 1 NAT Gateway (AZ a) + free S3 gateway endpoint | NAT per AZ, NAT instance, endpoints only | Budget: a second NAT doubles the biggest line. A NAT instance means patching and failover to manage. Endpoints only cover AWS services |
| Secrets | SSM Parameter Store (SecureString), generated by Terraform | Secrets Manager | Secrets Manager is not on the §4 list, Parameter Store standard tier is free. **Verified:** `LabRole` can read the parameters (instances booted and reached RDS) |
| Persistent buckets | `bootstrap/bootstrap.sh` (AWS CLI) | Terraform `aws_s3_bucket` | The Learner Lab denies `s3:GetBucketObjectLockConfiguration`, which the Terraform provider reads after creating any bucket (fails on v4, v5, v6). The main stack only *reads* the bucket with a data source |
| Bucket layout | 1 data bucket, 2 prefixes (`artifacts/`, `artworks/`) + 1 state bucket | Separate buckets per use | Fewer resources, simpler leftover check |
| Database | RDS PostgreSQL 16, `db.t3.micro`, **single-AZ**, encrypted, 7-day backups | Multi-AZ, DB in a container on EC2 | Multi-AZ doubles RDS hours and is not required. A DB on an ASG instance would vanish at replacement, and the cahier requires RDS with backups |
| Load balancer protocol | HTTP :80 by default. With `enable_https = true`: HTTPS :443 (ACM certificate) and port 80 redirects (301) | HTTP only | The domain `viewmyart.me` allows a free ACM certificate. TLS ends at the ALB, traffic stays HTTP inside the VPC. Details: [HTTPS and custom domain](#https-and-custom-domain) |
| DNS and certificate | Route 53 hosted zone + ACM certificate created **once by hand** (CLI), only *looked up* by Terraform | Create them in Terraform | They must survive every `destroy` (the certificate needs DNS validation and the registrar keeps the zone name servers). Neither Route 53 nor ACM is in the cahier §4.1 list: they are documented additions |
| ASG health check | `ELB` type, 300 s grace period | `EC2` type | An instance the ALB sees as unhealthy is replaced, not only one that is powered off |
| Instance metadata | IMDSv2 required, hop limit 2 | IMDSv1 | Security hardening. Hop limit 2 lets the AWS SDK work if a container is ever used |
| Deregistration delay | 30 s | 300 s default | Faster demos and faster destroy |

## HTTPS and custom domain

The site is served at `https://gallery.viewmyart.me` when `enable_https = true` (default `false`: HTTP only, same as before). Port 80 answers with a permanent redirect (301) to the HTTPS address. TLS ends at the ALB, and the traffic between the ALB and the instances stays HTTP inside the VPC.

### One-time setup (outside Terraform)

The hosted zone and the certificate are created **once** by hand and kept between sessions. Terraform only *looks them up*, so `./destroy.sh` never deletes them and a rebuild needs no new certificate.

```bash
# 1. Public hosted zone. Note the four name servers it returns.
aws route53 create-hosted-zone --name viewmyart.me --caller-reference "$(date +%s)"

# 2. At the registrar (Namecheap): Nameservers -> Custom DNS -> the four name servers of the zone. Save.
#    Check (it can take from minutes to hours): dig +short NS viewmyart.me

# 3. Certificate for the application hostname. It must be in us-east-1 (same region as the ALB).
aws acm request-certificate --region us-east-1 \
  --domain-name gallery.viewmyart.me --validation-method DNS

# 4. Create the validation CNAME that ACM asks for, in the zone.
read NAME VALUE < <(aws acm describe-certificate --region us-east-1 --certificate-arn <CERTIFICATE_ARN> \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.[Name,Value]' --output text)
aws route53 change-resource-record-sets --hosted-zone-id <ZONE_ID> --change-batch \
  "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$NAME\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$VALUE\"}]}}]}"

# 5. Wait for ISSUED (it validates by itself once the name servers are live).
aws acm describe-certificate --region us-east-1 --certificate-arn <CERTIFICATE_ARN> \
  --query 'Certificate.Status' --output text
```

Never put the certificate ARN or the zone ID in a screenshot without blurring the account ID.

### Turn it on

Add to `terraform.tfvars` (it is not committed):

```
enable_https = true
```

Optional variables: `domain_name` (default `viewmyart.me`) and `app_subdomain` (default `gallery`).

With `enable_https = true`, Terraform:

- looks up the Route 53 zone and the **ISSUED** certificate (`plan` fails if the certificate is not issued, so nothing half-built is created),
- adds the HTTPS listener on :443 (policy `ELBSecurityPolicy-TLS13-1-2-2021-06`) and turns the :80 listener into a 301 redirect,
- creates the alias record `gallery.viewmyart.me` to the ALB, destroyed with the stack,
- gives the backend `https://gallery.viewmyart.me` as `FRONTEND_URL` and `PUBLIC_API_URL`.

Without the variable, the plan is unchanged: the only new resources with it on are the HTTPS listener and the alias record (52 become 54).

### Verify

```bash
curl -sI http://gallery.viewmyart.me | head -3            # expected: 301 Moved Permanently
curl -s https://gallery.viewmyart.me/api/health            # expected: the health JSON
curl -sI https://gallery.viewmyart.me | head -3            # expected: HTTP/2 200
```

Result on 15 Nov 2026: the HTTP request is redirected with a 301 by the ALB, HTTPS answers `HTTP/2 200` and the health endpoint is healthy. `terraform apply` created 54 resources in 14 min 17 s.

> **[ADD SCREENSHOT]** `v2-13-https.png`: browser padlock on `gallery.viewmyart.me` and the `curl` redirect

![HTTPS with the custom domain](images/screenshots/v2-13-https.png)

### After the project

`./destroy.sh` keeps the zone and the certificate. When the course is over, remove them (the zone costs about 0.50 USD per month, the certificate is free): delete the validation record and the other records in the zone, then `aws route53 delete-hosted-zone --id <ZONE_ID>` and `aws acm delete-certificate --region us-east-1 --certificate-arn <CERTIFICATE_ARN>`.

## What is deployed (52-resource baseline)

The applied v2 baseline has 52 resources, including the CloudWatch log groups, the scaling policy and the alarms. With `enable_https = true` there are 2 more (the HTTPS listener and the Route 53 alias record), so 54. Full list: `terraform state list`.

| Area | Resources | Module |
|---|---|---|
| Network | VPC, Internet Gateway, 6 subnets, 3 route tables + routes + 6 associations, Elastic IP, NAT Gateway, S3 gateway endpoint, DB subnet group | `network` |
| Security | 4 security groups (rules defined in the module) | `security` |
| Bastion | 1 `t3.micro` in public subnet 1 | `compute` |
| Secrets | 3 random values + 3 SSM SecureString parameters (`/art-gallery/db-password`, `jwt-secret`, `admin-password`) | `secrets` |
| Load balancer | ALB, target group (`/api/health`, 15 s), HTTP :80 listener (forward, or 301 redirect when HTTPS is on). With `enable_https`: HTTPS :443 listener and a Route 53 alias record for `gallery.viewmyart.me` | `alb` / root |
| Database | RDS PostgreSQL instance + parameter group | `rds` |
| Application | Launch Template, Auto Scaling Group (min 2, max 3, one instance per AZ) | `asg` |
| Monitoring | Operations dashboard, ALB and RDS metrics, 4 log groups, three alarms (unhealthy hosts, target 5xx, RDS CPU), SNS e-mail notifications (confirm the subscription e-mail after each apply) | `monitoring` |
| Read-only lookups | Data bucket, availability zones, AMI (latest Amazon Linux 2023). With `enable_https`: the Route 53 zone and the ISSUED ACM certificate | root / `asg` |

### ASG CPU target tracking
- The ASG scales its capacity to keep average CPU utilization near the target.
- CPU target: 60%; estimated instance warmup: 300 seconds.
- Capacity remains minimum 2, desired 2, maximum 3 instances.
- Test during the planned T11 k6 load test, then inspect ASG scaling activities and the `asg_cpu_scaling_policy_name` output.

- `/var/log/art-gallery-boot.log` ships to `/art-gallery/boot`.
- `/var/log/nginx/access.log` and `/var/log/nginx/error.log` ship to `/art-gallery/nginx-access` and `/art-gallery/nginx-error`; `/var/log/art-gallery-app.log` ships to `/art-gallery/app`.
- The CloudWatch agent setup is non-fatal; Terraform owns all four groups and their seven-day retention so `terraform destroy` removes them.
- The first end-to-end log shipping test happens at the next apply, when new instances boot.
- Check boot streams with `aws logs describe-log-streams --log-group-name /art-gallery/boot --region us-east-1`.

## Project structure

```
infra/
|-- versions.tf                 providers (aws ~> 5.0, random ~> 3.6) + region + default tags
|-- variables.tf                inputs and defaults
|-- main.tf                     wires the modules together
|-- outputs.tf                  app URL, health URL, bastion IP, RDS endpoint, helper commands
|-- terraform.tfvars.example    template for your personal values
|-- destroy.sh                  destroy + leftover check (EC2, NAT, EIP, ALB, RDS)
|-- .gitignore                  state, tfvars, keys, credentials, SQL dumps
|-- RDS.md                      seed, query the database, save and restore data
|-- S3.md                       buckets, image uploads, commands, cost
|-- .terraform.lock.hcl         provider versions (committed)
|-- images/                     architecture diagrams + screenshots
|-- bootstrap/                  bootstrap.sh: 2 persistent S3 buckets (AWS CLI)
`-- modules/
    |-- network/                VPC, subnets, gateways, routes, endpoint
    |-- security/               4 security groups
    |-- compute/                bastion
    |-- secrets/                DB password, JWT secret, admin password (SSM)
    |-- alb/                    load balancer, target group, HTTP listener (+ optional HTTPS listener)
    |-- rds/                    PostgreSQL in the private DB subnets
    |-- monitoring/             CloudWatch dashboard and alarms for ALB and RDS
    `-- asg/                    launch template (+ boot script) and Auto Scaling Group
```

Each module has `variables.tf` (inputs), `main.tf` (resources), `outputs.tf` (outputs).

## Bootstrap (persistent buckets)

`bootstrap/bootstrap.sh` creates two S3 buckets that are **not** removed by `./destroy.sh`. It is a bash script: on Windows run it in **Git Bash** (not PowerShell or WSL without the AWS CLI), and make sure the file has Unix (LF) line endings, otherwise bash stops with `invalid option name: pipefail`. The repository's `.gitattributes` (`*.sh text eol=lf`) prevents this:

| Bucket | Purpose | Protection |
|---|---|---|
| `art-gallery-tfstate-<suffix>` | Terraform state of the main stack | public access blocked, AES256 encryption, **versioning on** |
| `art-gallery-data-<suffix>` | Application artifacts (`artifacts/`), artwork images (`artworks/`) and the database seed (`seed/gallery.sql`) | public access blocked, AES256 encryption |

```bash
cd bootstrap
./bootstrap.sh <unique_suffix>     # e.g. ./bootstrap.sh hamza-tek26 (idempotent, safe to run again)
```

Why a persistent stack: the state must survive `destroy` (cahier rule 7), and re-uploading the artifacts after every session would waste time. Buckets are billed by storage (cents), not by the hour, so keeping them is consistent with the destroy rule. Bucket names are global: if the script says `BucketAlreadyExists`, change the suffix, and use the **same** suffix as `unique_suffix` in `terraform.tfvars`. At the end of the semester, delete the buckets so nothing keeps costing.

The main stack stores Terraform state in the versioned S3 state bucket with S3-native locking. `./apply.sh` saves an additional timestamped local copy after a successful apply.

## How an instance boots

`modules/asg/user_data.sh.tpl`, run once at first boot of every app instance:

1. Installs nginx and Node.js 20 (`dnf`, through the NAT Gateway).
2. Reads the 3 secrets from SSM Parameter Store (retries 5 times). **No secret is in `user_data` or in Git.** The script never uses `set -x`, so secrets are not printed in logs.
3. Downloads `artifacts/backend-<version>.tar.gz` and `artifacts/frontend-<version>.tar.gz` from the data bucket (through the free S3 endpoint), runs `npm ci --omit=dev`.
4. **Seeds the database (step 3b).** Installs the PostgreSQL client, downloads `s3://<data bucket>/seed/gallery.sql` and, **only if the `users` table does not exist yet**, loads it in a single transaction **before the backend starts** (otherwise the backend would create empty tables first). If two instances boot together, the loser fails on `already exists` and rolls back, so nothing is applied twice. No dump in S3, or any failure here, never stops the boot (the database is then simply empty).
5. Writes the backend environment, including `S3_BUCKET` and `AWS_REGION`: with them, uploaded images go to S3 instead of the instance disk ([S3.md](S3.md#2-how-an-uploaded-image-reaches-s3)).
6. Starts the API with **systemd** (`Restart=always`) on `127.0.0.1:3001`, and serves the frontend with nginx on port 80, proxying `/api` to the API.
7. **Fallback:** if the artifacts are missing or `npm ci` fails, a tiny server answers `/api/health` with `{"status":"fallback"}`, so the ALB sees healthy targets and the page says what is missing.

Logs on an instance: `/var/log/art-gallery-boot.log`, `/var/log/cloud-init-output.log`, `journalctl -u art-gallery`. The seed step writes one of these lines in the boot log:

```bash
sudo grep -E "seed:|=== mode" /var/log/art-gallery-boot.log
# seed: database restored from the dump          (fresh database, data loaded)
# seed: users table already present ... skipping (second instance, or a restored snapshot)
# seed: no dump in s3://.../seed/, skipping      (nothing uploaded in step 4b)
```

## Database: seed, queries and backup

The full guide is **[RDS.md](RDS.md)**. In short:

| I want to... | Where |
|---|---|
| Make `terraform apply` bring the application back **with its data** | Usage step 4b below (upload `seed/gallery.sql` once), then [RDS.md, seed](RDS.md#1-the-seed-data-that-comes-back-at-every-apply) |
| Look at the tables and run `select` on `users`, `payments`... | [RDS.md, queries](RDS.md#2-look-inside-the-database-tables-and-select) |
| Keep the data created on AWS before a destroy | [RDS.md, save](RDS.md#3-keep-the-data-created-on-aws-before-a-destroy) |
| Fix an error (UTF-16 dump, `already exists`, 502...) | [RDS.md, problems](RDS.md#4-common-problems) |

## Prerequisites

- Terraform >= 1.5 (`sudo snap install terraform --classic`)
- AWS CLI v2 (`sudo snap install aws-cli --classic`)
- Node.js 20+ and npm (to build the artifacts)
- Docker Desktop with the local `art-gallery-db` container (to make the database seed)
- On Windows: **Git Bash** to run `.sh` scripts, and a `.gitattributes` with `*.sh text eol=lf` and `*.tpl text eol=lf` so Git never converts them to CRLF
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
nano terraform.tfvars        # set unique_suffix to the same value used by bootstrap
```

`./apply.sh` detects your current public IPv4 and passes it as `admin_cidr` for bastion SSH access. For a plan that matches the apply, run:

```bash
ADMIN_IP=$(curl -4fsS https://checkip.amazonaws.com | tr -d '[:space:]')
terraform plan -var="admin_cidr=${ADMIN_IP}/32"
```

Each variable name must appear **once** in `terraform.tfvars` (a duplicate keeps the last value and is easy to miss).

To serve the site over HTTPS on your domain, add `enable_https = true` (after the one-time setup in [HTTPS and custom domain](#https-and-custom-domain)). Without it the stack is HTTP only, as before.

*Screenshot: [admin IP and tfvars](EVIDENCE.md#2-configure)*

### 3. Bootstrap (once)

```bash
cd bootstrap && ./bootstrap.sh <unique_suffix> && cd ..
cp backend.hcl.example backend.hcl
# Set bucket in backend.hcl to art-gallery-tfstate-<same suffix>
```

*Screenshot: [bootstrap](EVIDENCE.md#3-bootstrap-once)*

### 4. Upload the artifacts (only when the code changes)

The infrastructure expects two files in the persistent data bucket, one pair per version:

| File | Content | Built following |
|---|---|---|
| `artifacts/backend-<version>.tar.gz` | the backend build output and its package files | [backend README](../backend/README.md#déploiement) |
| `artifacts/frontend-<version>.tar.gz` | the static export of the site | [frontend README](../frontend/README.md#build-et-déploiement) |

```bash
ls -lh /tmp/backend-v1.tar.gz /tmp/frontend-v1.tar.gz      # sizes for the comparison table
aws s3 cp /tmp/backend-v1.tar.gz  s3://art-gallery-data-<suffix>/artifacts/
aws s3 cp /tmp/frontend-v1.tar.gz s3://art-gallery-data-<suffix>/artifacts/
```

The version in the file names must match the Terraform variable `app_version` (default `v1`).

*Screenshot: [artifact sizes and upload](EVIDENCE.md#4-upload-the-artifacts-only-when-the-code-changes)*

### 4b. Upload the database seed (once, and again only when you want newer data)

The boot script restores `seed/gallery.sql` into the empty RDS of every new stack. Create it from the local Docker database (Docker Desktop running, PowerShell, from `infra/`):

```powershell
docker exec art-gallery-db pg_dump -U gallery --no-owner --no-acl -f /tmp/gallery.sql art_gallery
docker cp art-gallery-db:/tmp/gallery.sql ..\gallery.sql
aws s3 cp ..\gallery.sql s3://art-gallery-data-<suffix>/seed/gallery.sql
aws s3 ls s3://art-gallery-data-<suffix>/seed/ --human-readable
```

> **Do not** write the dump with `pg_dump ... > gallery.sql` in Windows PowerShell: it saves the file as UTF-16 and the restore fails with `invalid byte sequence for encoding "UTF8": 0xff`. The `-f` + `docker cp` way above keeps plain UTF-8.

The file contains the users' emails and password hashes: keep it in the private bucket, never commit it (`gallery.sql` is in `.gitignore`).

### 5. Deploy

```bash
cd infra
terraform init -backend-config=backend.hcl
terraform validate
ADMIN_IP=$(curl -4fsS https://checkip.amazonaws.com | tr -d '[:space:]')
terraform plan -var="admin_cidr=${ADMIN_IP}/32"  # review the current plan with your public IP
time ./apply.sh                                  # prompts for approval; saves a local state backup
```

During the apply, the first app instance restores the seed into RDS (see [How an instance boots](#how-an-instance-boots)). Nothing to run by hand: when `apply` returns, the site already shows the data.

*Screenshot: [terraform plan summary](EVIDENCE.md#5-deploy)*

![terraform apply complete and outputs](images/screenshots/v2-05-apply-complete.png)

```bash
terraform output app_url                                # open it in a browser
curl "$(terraform output -raw health_url)"
eval "$(terraform output -raw read_admin_password)"     # admin password of this session
```

![the site in the browser](images/screenshots/v2-06-site.png)

### 6. Destroy (mandatory at the end of every session)

```bash
time ./destroy.sh
```

The script runs `terraform destroy`, then checks EC2, NAT Gateways, Elastic IPs, load balancers and RDS. It must finish with `OK: nothing billable left.` RDS takes several minutes to delete, so do not close the terminal early.

RDS and its data are deleted with the stack. The next `terraform apply` restores `seed/gallery.sql`. Anything created on the live site since then (new orders, accounts) is lost, unless you first save it as the new seed: [RDS.md, section 3](RDS.md#3-keep-the-data-created-on-aws-before-a-destroy).

*Screenshot: [destroy and leftover check](EVIDENCE.md#6-destroy-mandatory-at-the-end-of-every-session)*

## Build time

### Measured: first full apply of architecture v2 (fallback mode, 41 resources)

Taken from the `terraform apply` log. Resources are created in parallel, so the total is the **critical path**, not the sum.

| Resource | Time to create | On the critical path |
|---|---|---|
| VPC | 15 s | start |
| Subnets, route tables, security groups, endpoint | 1 to 12 s each | no |
| NAT Gateway | 1 min 38 s | no (finishes long before RDS) |
| Application Load Balancer | 2 min 18 s | no |
| **RDS PostgreSQL** | **9 min 14 s** | **yes** |
| Launch Template | 8 s | yes (waits for the RDS endpoint) |
| **Auto Scaling Group** (waits for healthy targets) | **1 min 38 s** | **yes** |
| **Total** | **about 11.5 minutes** | RDS (9m14s) + Launch Template (8s) + ASG (1m38s) + network start |

The ASG depends on the RDS endpoint (the boot script needs the DB host), which is why it cannot start earlier.

### Measured: full rebuild in real mode with HTTPS (54 resources)

`time ./apply.sh` after a full destroy, on 15 Nov 2026: **14 min 17 s** (real mode, artifacts and seed from S3, HTTPS on). This includes the precheck and the local state backup done by `apply.sh`. The margin to the 15-minute target (L1) is 43 seconds, so RDS creation speed decides the result: measure again during the demonstration.

### Measurements to complete

| Measurement | Command | Result |
|---|---|---|
| Full apply, real mode (artifacts in S3, HTTPS on) | `time ./apply.sh` | 14 min 17 s |
| Destroy and leftover check | `time ./destroy.sh` | ___ min ___ s |
| Replacement of a killed instance (until `healthy`) | see [T7](docs/t7.md) | approximately 53 s (`20:58:14` to `20:59:07`) |
| Rolling update to `v2` | see [T8](#t8-new-version-without-total-interruption) | ___ min |
| Rebuild target (L1) | 15 minutes or less | Met: 14 min 17 s in real mode (11.5 min in fallback mode) |

> **[ADD SCREENSHOT]** `v2-08-timing.png`: timing of apply and destroy

![timing of apply and destroy](images/screenshots/v2-08-timing.png)

## Cost

> Approximate, from public **on-demand `us-east-1`** prices. They can change, so confirm with the [AWS Pricing Calculator](https://calculator.aws/). The Learner Lab credit counter is the real source for what was charged.

### While the stack is running

| Item | Quantity | Price | Per hour |
|---|---|---|---|
| NAT Gateway | 1 | 0.045 USD/h (+ 0.045 USD per GB processed) | 0.045 |
| Application Load Balancer | 1 | 0.0225 USD/h | 0.0225 |
| ALB capacity units (low traffic) | about 1 | about 0.008 USD/h | 0.008 |
| EC2 `t3.micro` (2 app + 1 bastion) | 3 | 0.0104 USD/h | 0.031 |
| RDS `db.t3.micro` PostgreSQL, single-AZ | 1 | 0.018 USD/h | 0.018 |
| Public IPv4 addresses (NAT, bastion, 2 for the ALB) | 4 | 0.005 USD/h | 0.020 |
| EBS gp3, 3 x 8 GB | 24 GB | 0.08 USD/GB-month | 0.003 |
| RDS storage gp3, 20 GB | 20 GB | about 0.115 USD/GB-month | 0.003 |
| VPC, subnets, route tables, security groups, S3 gateway endpoint, SSM standard parameters | | free | 0 |
| **Total** | | | **about 0.15 USD/h** |

> Not in the hourly total: the Route 53 hosted zone (about 0.50 USD per month, kept between sessions). The ACM public certificate and the ALB HTTPS listener add no hourly cost.

### What it means for the budget (50 USD)

| Scenario | Estimate |
|---|---|
| One 2-hour session | about 0.30 USD |
| 10 sessions of 3 hours | about 4.50 USD |
| Left running one day | about 3.60 USD |
| Left running one week | about 25 USD (half the credit) |
| Left running one month | about 110 USD (more than the credit) |
| Hours of running time the whole 50 USD buys | about 330 hours |

### What stays between sessions

| Item | Cost |
|---|---|
| 2 S3 buckets (a few MB of artifacts, small state file) | well under 0.01 USD per month (about 0.023 USD/GB-month) |
| Manual RDS snapshot (if kept) | cents per month (billed on used size, about 0.095 USD/GB-month) |
| ECR (not used) | would be about 0.10 USD/GB-month |

### Where the money goes and how to reduce it

- **NAT Gateway + public IPv4 + ALB** are about 60% of the hourly cost and are billed even with zero traffic. Destroying at the end of each session is the biggest saving.
- **Multi-AZ RDS** would add about 0.018 USD/h. A second NAT would add 0.045 USD/h. Neither is enabled (budget decision).
- Cost of the deployment options not chosen: EKS would add about 0.10 USD/h for the control plane alone, more than the whole database and compute together.

### Check what was actually spent

```bash
# Often denied in the Learner Lab: if so, read the credit counter in the AWS Academy panel instead
aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-09 \
  --granularity DAILY --metrics UnblendedCost --query 'ResultsByTime[].[TimePeriod.Start,Total.UnblendedCost.Amount]' --output table
```

*Screenshot: [cost evidence](EVIDENCE.md#check-what-was-actually-spent)*

## Verification with the AWS CLI (every resource)

Run these **while the stack is up**, in one terminal, and take one screenshot per block. Nothing here changes anything. Set the variables first:

```bash
cd ~/projet/art-gallery-aws/infra
export AWS_REGION=us-east-1
SUFFIX=<your unique_suffix>
VPC=$(terraform output -raw vpc_id)
DATA=art-gallery-data-$SUFFIX
STATE=art-gallery-tfstate-$SUFFIX
```

### V0. Who am I, and what does Terraform manage?

```bash
aws sts get-caller-identity --query '[Arn]' --output text      # blur the account ID
terraform state list | wc -l                                    # expected: 56 (52 resources + 4 data sources); 60 with HTTPS (54 + 6)
terraform state list | grep -vE '(^|\.)data\.' | wc -l          # expected: 52 (resources only); 54 with HTTPS
terraform output
```

![identity, resource count, outputs](images/screenshots/v2-10-identity-state.png)

### V1. Inventory of everything tagged for the project

Common Terraform tags are `Project` (default `art-gallery`), `Managed=terraform`, and `Group` (default `tek26`); resource-specific `Name` and existing subnet `Tier` tags are retained.
ASG tags propagate `Name`, `Project`, `Managed`, and `Group`; the launch template applies common tags to instances, EBS volumes, and network interfaces.
The bootstrap script applies `Group` to persistent S3 buckets alongside their existing `Project`, `Managed`, `Lifecycle`, and `Purpose` tags.

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=art-gallery \
  --query 'ResourceTagMappingList[].ResourceARN' --output text | tr '\t' '\n' | sed 's/:[0-9]\{12\}:/:ACCOUNT:/' | sort
```

If this call is denied in the lab, skip it: the blocks below cover each resource type. (Some resources, such as route table associations, are not taggable, so the count is lower than 41.)

*Screenshot: [tagged resource inventory](EVIDENCE.md#v1-inventory-of-everything-tagged-for-the-project)*

### V2. Persistent buckets and artifacts

```bash
aws s3api list-buckets --query "Buckets[?starts_with(Name,'art-gallery-')].Name" --output table
for b in $STATE $DATA; do
  echo "== $b"
  aws s3api get-public-access-block --bucket $b --query 'PublicAccessBlockConfiguration' --output table
  aws s3api get-bucket-encryption   --bucket $b --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text
  aws s3api get-bucket-versioning   --bucket $b --query 'Status' --output text
done
aws s3 ls s3://$DATA/artifacts/ --human-readable
```

Expected: all four public-access settings `True`, encryption `AES256`, versioning `Enabled` on the state bucket, and both `.tar.gz` artifacts listed.

*Screenshot: [S3 buckets and artifacts](EVIDENCE.md#v2-persistent-buckets-and-artifacts)*

### V3. VPC and subnets

```bash
aws ec2 describe-vpcs --vpc-ids $VPC \
  --query 'Vpcs[].[VpcId,CidrBlock,State,EnableDnsSupport]' --output table

aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC \
  --query 'sort_by(Subnets,&CidrBlock)[].[Tags[?Key==`Name`]|[0].Value,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' --output table
```

Expected: `10.0.0.0/16` and 6 subnets over `us-east-1a` / `us-east-1b` (`MapPublicIpOnLaunch` true only for the 2 public ones, if set in the module).

![VPC and subnets](images/screenshots/v2-13-vpc-subnets.png)

### V4. Internet Gateway, NAT Gateway, Elastic IP, S3 endpoint

```bash
aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$VPC \
  --query 'InternetGateways[].[InternetGatewayId,Attachments[0].State]' --output table

aws ec2 describe-nat-gateways --filter Name=vpc-id,Values=$VPC \
  --query 'NatGateways[].[NatGatewayId,State,ConnectivityType,SubnetId,NatGatewayAddresses[0].PublicIp]' --output table

aws ec2 describe-addresses \
  --query 'Addresses[].[AllocationId,PublicIp,AssociationId,Tags[?Key==`Name`]|[0].Value]' --output table

aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=$VPC \
  --query 'VpcEndpoints[].[VpcEndpointId,ServiceName,VpcEndpointType,State]' --output table
```

Expected: IGW `available`, NAT `available` and `public` in a public subnet, an Elastic IP attached to the NAT, an S3 endpoint of type `Gateway` (keep the NAT public IP: [T6](#t6-outbound-access-goes-through-the-nat-gateway) compares it).

*Screenshot: [gateways and endpoint](EVIDENCE.md#v4-internet-gateway-nat-gateway-elastic-ip-s3-endpoint)*

### V5. Route tables

```bash
aws ec2 describe-route-tables --filters Name=vpc-id,Values=$VPC \
  --query 'RouteTables[].{Name:Tags[?Key==`Name`]|[0].Value,Subnets:length(Associations[?SubnetId]),Routes:Routes[].[DestinationCidrBlock,GatewayId,NatGatewayId]}' \
  --output yaml
```

Expected: `rt-public` (2 subnets) has `0.0.0.0/0` to the Internet Gateway, `rt-app` (2 subnets) has `0.0.0.0/0` to the NAT Gateway, `rt-db` (2 subnets) has **only the local route**. The unnamed table is the VPC's automatic main route table (0 subnets).

*Screenshot: [route tables](EVIDENCE.md#v5-route-tables)*

### V6. Security groups and their rules

```bash
aws ec2 describe-security-groups --filters Name=vpc-id,Values=$VPC Name=group-name,Values='art-gallery-*' \
  --query 'SecurityGroups[].{Name:GroupName,Id:GroupId,Ingress:IpPermissions[].{Port:FromPort,FromCidr:IpRanges[].CidrIp,FromGroup:UserIdGroupPairs[].GroupId}}' \
  --output yaml     # blur the admin IP
```

Expected: `alb-sg` open to `0.0.0.0/0` on 80, `bastion-sg` only to the admin `/32` on 22, `app-sg` only from the ALB and bastion groups, `db-sg` only from the `app-sg` id on 5432.

![security groups](images/screenshots/v2-16-security-groups.png)

### V7. Instances (bastion and application)

```bash
aws ec2 describe-instances --filters Name=tag:Project,Values=art-gallery Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[Tags[?Key==`Name`]|[0].Value,InstanceId,InstanceType,Placement.AvailabilityZone,PrivateIpAddress,PublicIpAddress]' --output table
```

Expected: 1 `art-gallery-bastion` with a public IP, 2 `art-gallery-app` in **different AZs** and with **no public IP** (blur the bastion IP).

*Screenshot: [instances](EVIDENCE.md#v7-instances-bastion-and-application)*

### V8. Launch Template and Auto Scaling Group

```bash
ASG=art-gallery-asg
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG \
  --query 'AutoScalingGroups[].{Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,HealthCheck:HealthCheckType,Grace:HealthCheckGracePeriod,Subnets:VPCZoneIdentifier,Instances:Instances[].[InstanceId,AvailabilityZone,LifecycleState,HealthStatus]}' \
  --output yaml

LT=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG --query 'AutoScalingGroups[0].LaunchTemplate.LaunchTemplateId' --output text)
aws ec2 describe-launch-template-versions --launch-template-id $LT --versions '$Latest' \
  --query 'LaunchTemplateVersions[0].LaunchTemplateData.{Type:InstanceType,Profile:IamInstanceProfile.Name,IMDS:MetadataOptions,Disk:BlockDeviceMappings[0].Ebs}' --output yaml
```

Expected: min 2, max 3, desired 2, health check `ELB`, 2 instances `InService` / `Healthy` in two AZs. Launch template: `t3.micro`, `LabInstanceProfile`, `HttpTokens: required`, encrypted 8 GB gp3 volume.

*Screenshot: [auto scaling group and launch template](EVIDENCE.md#v8-launch-template-and-auto-scaling-group)*

### V9. Load balancer, listener, target group, target health

```bash
ALB=$(aws elbv2 describe-load-balancers --names art-gallery-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
aws elbv2 describe-load-balancers --names art-gallery-alb \
  --query 'LoadBalancers[].[LoadBalancerName,Scheme,Type,State.Code,AvailabilityZones[].ZoneName]' --output yaml

aws elbv2 describe-listeners --load-balancer-arn $ALB \
  --query 'Listeners[].[Port,Protocol,DefaultActions[0].Type]' --output table

TG=$(aws elbv2 describe-target-groups --names art-gallery-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-groups --target-group-arns $TG \
  --query 'TargetGroups[].[TargetGroupName,Port,HealthCheckPath,HealthCheckIntervalSeconds,HealthyThresholdCount,UnhealthyThresholdCount]' --output table

aws elbv2 describe-target-health --target-group-arn $TG \
  --query 'TargetHealthDescriptions[].[Target.Id,Target.Port,TargetHealth.State]' --output table
```

Expected: `internet-facing` `application` ALB `active` in 2 AZs, listener `80 HTTP forward`, health path `/api/health` every 15 s, **both targets `healthy`**.

![load balancer and target health](images/screenshots/v2-19-alb-targets.png)

### V10. RDS

```bash
aws rds describe-db-instances --db-instance-identifier art-gallery-db \
  --query 'DBInstances[].{Status:DBInstanceStatus,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,MultiAZ:MultiAZ,Public:PubliclyAccessible,Encrypted:StorageEncrypted,BackupDays:BackupRetentionPeriod,Storage:AllocatedStorage,AZ:AvailabilityZone,Endpoint:Endpoint.Address}' --output yaml

PG=$(aws rds describe-db-instances --db-instance-identifier art-gallery-db --query 'DBInstances[0].DBParameterGroups[0].DBParameterGroupName' --output text)
aws rds describe-db-parameters --db-parameter-group-name $PG \
  --query "Parameters[?ParameterName=='rds.force_ssl'].[ParameterName,ParameterValue]" --output table
```

Expected: `available`, PostgreSQL 16, `db.t3.micro`, `Public: false`, `Encrypted: true`, 7 backup days, endpoint in the DB subnets, `rds.force_ssl` = `0` (documented limit).

![RDS](images/screenshots/v2-20-rds.png)

### V11. Secrets (names and type only, never the values)

```bash
aws ssm describe-parameters --parameter-filters Key=Name,Option=BeginsWith,Values=/art-gallery/ \
  --query 'Parameters[].[Name,Type,LastModifiedDate]' --output table
```

Expected: 3 parameters of type `SecureString`. **Do not** add `get-parameter --with-decryption` to a screenshot.

*Screenshot: [SSM parameters](EVIDENCE.md#v11-secrets-names-and-type-only-never-the-values)*

### Leftover check

After `./destroy.sh`, the same check as the script, written out so it can be shown:

```bash
aws ec2 describe-instances --filters Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId' --output text
aws ec2 describe-nat-gateways --filter Name=state,Values=pending,available --query 'NatGateways[].NatGatewayId' --output text
aws ec2 describe-addresses --query 'Addresses[].AllocationId' --output text
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text
aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier' --output text
aws ecr describe-repositories --query 'repositories[].repositoryName' --output text   # old experiments
aws s3api list-buckets --query "Buckets[?starts_with(Name,'art-gallery-')].Name" --output text   # expected: the 2 persistent buckets
```

Expected: every line empty except the 2 persistent buckets.

> **[ADD SCREENSHOT]** `v2-22-leftover.png`: leftover check

![leftover check](images/screenshots/v2-22-leftover.png)

## Tests

Each test: what it proves, the commands, the expected result, a screenshot. Run T1 to T6 on a fresh apply, then the destructive ones (T7, T8) and finish with T10.

| # | Test | Proves | Status |
|---|---|---|---|
| T1 | Health endpoint | ALB, target group, API alive | PASS — [full procedure and screenshots](docs/t1-t3.md) |
| T2 | Frontend and DB-backed API through the single URL | nginx serves the pages and proxies `/api`, DB reachable | PASS — [full procedure and screenshots](docs/t1-t3.md) |
| T3 | Instances booted in real mode, secrets read | Artifacts, SSM access, no fallback | PASS — [full procedure and screenshots](docs/t1-t3.md) |
| T4 | Database reachable only from the app tier | Network isolation | PASS — [full procedure and screenshots](docs/t4.md) |
| T5 | Private instances not reachable from the Internet | Security groups, no public IP | PASS — [full procedure and screenshots](docs/t5.md) |
| T6 | Outbound goes through the NAT | NAT route works | PASS — [full procedure and screenshots](docs/t6.md) |
| T7 | Resilience: kill one instance | Fault tolerance (graded) | PASS — [full procedure and screenshots](docs/t7.md) |
| T8 | New version without total interruption | Rolling update | PASS — [full procedure and screenshots](docs/t8.md) |
| T9 | Backup and restore | Data protection (graded) | PASS — [full procedure and screenshots](docs/t9.md) |
| T10 | Rebuild from zero, timed | Rebuild target | partly done (11.5 min fallback) |
| T11 | Load test (k6) | 50 concurrent users, 100 peak | planned |
| T12 | Sensitive data: password hashes and card data | Passwords stored as bcrypt hashes, no card number or security code stored | done, see [RDS.md](RDS.md#5-verification-passwords-and-cards) |
| T13 | Alarms: trigger each one | Monitoring and notifications | PASS — [full procedure and screenshots](docs/t13.md) |

### T10. Rebuild from zero, timed

After a full `./destroy.sh` (leftover check clean):

```bash
time terraform apply -auto-approve
curl -s "$(terraform output -raw health_url)"; echo
```

Expected: 15 minutes or less and a healthy application. Result: **14 min 17 s** (15 Nov 2026, real mode, HTTPS on, `./apply.sh`).

*Screenshot: [T10 rebuild time](EVIDENCE.md#t10-rebuild-from-zero-timed)*

### T11. Load test (planned)

k6 against `app_url`: 50 concurrent users, 100 at peak, report p95 latency and error rate, while watching `aws autoscaling describe-auto-scaling-groups`. Script and results to add.

### T12. Sensitive data: passwords and cards

Checks on the RDS database itself (queried from an app instance through Session Manager, see [RDS.md](RDS.md#2-look-inside-the-database-tables-and-select)) that the sensitive data is protected:

```sql
select count(*) as utilisateurs,
       count(*) filter (where password_hash ~ '^\$2[aby]\$10\$') as bcrypt_ok,
       min(length(password_hash)) as longueur_min,
       max(length(password_hash)) as longueur_max
from users;

select count(*) as lignes_suspectes from payments where card_last4 !~ '^\d{4}$';
```

Result: **22 users, 22 bcrypt hashes** (cost 10, 60 characters), and **0 suspect rows** in `payments`: the application stores only the card brand and the last 4 digits, never the card number or the security code. Full steps with the five screenshots: [RDS.md, section 5](RDS.md#5-verification-passwords-and-cards).

![bcrypt hashes in the users table](images/screenshots/v2-t12-2-bcrypt-count.png)

![payments hold only brand and last 4 digits](images/screenshots/v2-t12-4-payments-table.png)

## Non-functional objectives

| Objective | Target | Status |
|---|---|---|
| Instance loss tolerance | No downtime if one app instance stops | 2 AZs, ALB, ASG with ELB health check built. Demonstration: [T7](docs/t7.md) |
| Load | 50 concurrent users (100 peak) | k6 test planned (T11) |
| Rebuild time | 15 minutes or less | **14 min 17 s measured** in real mode with HTTPS (11.5 min in fallback mode). Margin: 43 s |
| Max data loss | 5 minutes or less | RDS automated backups (7 days) with point-in-time recovery enabled. Restore demonstration: T9 |
| Budget | 50 USD or less | About 0.15 USD/h, destroy after every session, single NAT, `t3.micro` |

## Roadmap (future work)

- [x] VPC, multi-AZ subnets, route tables
- [x] Security groups (ALB -> app -> DB)
- [x] NAT Gateway outbound access + S3 gateway endpoint
- [x] Bastion
- [x] Destroy script with leftover check
- [x] Persistent S3 buckets for state and app data (`bootstrap/bootstrap.sh`, CLI because of a Learner Lab restriction)
- [x] Secrets in SSM Parameter Store (applied, readable by `LabRole`)
- [x] Application Load Balancer, health check `GET /api/health` (applied)
- [x] Launch Template + Auto Scaling Group, min 2, one per AZ (applied)
- [x] RDS PostgreSQL with automated backups (applied)
- [x] Application artifacts deployed from S3 (real mode: API and site answer)
- [x] Architecture diagram version 2 (`images/architecture-v2.1.drawio`)
- [x] First full-stack timing (11.5 min, fallback mode)
- [x] Database seed restored automatically at first boot (`seed/gallery.sql`, boot script step 3b)
- [x] Uploaded images stored in S3 (`artworks/uploads/`), served by the API
- [x] Real-mode deployment verified: site, API and restored data behind the ALB
- [ ] One-command rebuild script (`rebuild.sh`: bootstrap, apply, health check)
- [x] Resilience demo evidence ([T7](docs/t7.md))
- [x] Rolling update demo ([T8](docs/t8.md))
- [ ] Snapshot and restore demo (T9), snapshot step in `destroy.sh`
- [x] S3 remote state with bucket versioning, native locking and local backups
- [x] CloudWatch dashboard and metric alarms deployed
- [x] SNS e-mail notifications configured and tested (an alarm e-mail was received)
- [x] CloudWatch log shipping (4 log groups, one stream per instance)
- [x] Real-mode rebuild timing: 14 min 17 s (`./apply.sh`, 54 resources with HTTPS)
- [x] HTTPS on `gallery.viewmyart.me` (ACM certificate, Route 53 alias, HTTP to HTTPS redirect), verified with `curl`
- [ ] k6 load test (T11)
- [ ] boto3 scripts (RDS snapshot and restore, resilience test, cost report)
- [ ] Optional: ECR registry in `bootstrap/` as an upgrade of the deployment method

## Known limits

| Topic | Today | Why / what to do |
|---|---|---|
| Single NAT | One NAT in AZ a: if AZ a fails, AZ b loses outbound traffic (npm, dnf). Inbound user traffic through the ALB is not affected | Accepted cost trade-off. Test and mention in the defence |
| DB data between sessions | Lost at `destroy` (no final snapshot), but **restored from `seed/gallery.sql`** at the next apply. Data created on AWS after the restore is lost | Save it as the new seed before destroying ([RDS.md](RDS.md#3-keep-the-data-created-on-aws-before-a-destroy)), or snapshot + `db_snapshot_identifier` (T9) |
| Uploaded artwork images | Stored in S3 and kept after a destroy, but an image shows only if an artwork row points to it (rows come back as of the seed) | Save the live database as the new seed before destroying ([RDS.md](RDS.md#3-keep-the-data-created-on-aws-before-a-destroy)) |
| TLS to PostgreSQL | `db_force_ssl = false` (RDS PostgreSQL 15+ forces TLS by default) | Traffic stays in the private VPC. Set `true` once the API connects with TLS (`DB_SSL`, see the [backend](../backend/README.md#configuration)) |
| Secrets in state | Generated values are also in the Terraform state | Keep the state in the private, encrypted, versioned bucket |
| HTTPS | HTTPS on `gallery.viewmyart.me` with `enable_https = true`, HTTP only otherwise. TLS ends at the ALB: ALB to instance traffic is HTTP inside the VPC | Route 53 zone and ACM certificate are created once by hand and are not managed by Terraform. End-to-end TLS would need a certificate on the instances |
| Hosted zone and certificate persist | `./destroy.sh` keeps the Route 53 zone and the ACM certificate (only the alias record is destroyed with the stack). The zone costs about 0.50 USD per month, the public certificate is free | Delete both at the end of the course (see [HTTPS](#https-and-custom-domain)) |
| ASG CPU target tracking | Scale-in is intentionally slow by design; AWS creates the policy's CloudWatch alarms and deletes them automatically with the policy | Expected behavior; observe it during the T11 load test |
| CloudWatch Logs delivery | If `LabInstanceProfile` cannot write to CloudWatch Logs, the groups stay empty | Agent setup is non-fatal; the app still runs |
| Remote state | The state is stored in the private S3 state bucket with locking (`versions.tf`, `backend.hcl`). A local copy goes to `state-backups/` after each apply and is removed after a successful destroy | A crashed Terraform run can leave a stale lock: check that no other run is active, then `terraform force-unlock <ID>` |
| Instance refresh | The lab SCP denies `autoscaling:StartInstanceRefresh`, so `enable_instance_refresh` is `false` | Replace instances by hand (T8) |
| CloudFront | Not available in the lab account: all traffic goes through the ALB | HTTPS is done at the ALB instead |
| Leftover check | `destroy.sh` only fails for resources tagged `Project=art-gallery` (ALB, RDS and RDS snapshots by name prefix). Other resources in the account are listed as ignored and never touched | An untagged resource leaked by this project would not make the check fail |
| `npm ci` at boot | Depends on the npm registry through the NAT | Bundle `node_modules` in the artifact if it becomes a problem |

## Security notes

- Never commit `terraform.tfvars`, `*.tfstate`, `.terraform/`, `labsuser.pem` or AWS credentials (covered by `.gitignore`). Commit `.terraform.lock.hcl`.
- The state lives in the private S3 state bucket: never delete that bucket before `destroy`, because Terraform cannot find your resources without the state.
- User passwords are stored as bcrypt hashes and card numbers are never stored (only the brand and the last 4 digits): verified on the live database in [T12](#t12-sensitive-data-passwords-and-cards).
- The database password, JWT secret and admin password are generated by Terraform, stored in SSM Parameter Store and never in Git or in `user_data`. Read the admin password with `terraform output read_admin_password`.
- `seed/gallery.sql` contains users' emails and password hashes. It stays in the private, encrypted data bucket. Never commit it, and delete any temporary copy (`tmp/` prefix, `/tmp` on an instance) after use.
- If your public IP changes, update `admin_cidr` and run `terraform apply` again.
- Blur the admin IP, the account ID, public IPs and any secret in every screenshot before committing.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Permission denied: ./destroy.sh` | `chmod +x destroy.sh` |
| `ExpiredToken` / auth error, or `UnauthorizedOperation ... explicit deny ... voc-cancel-cred` | The lab session ended or was cancelled and the old credentials are blocked. Start the lab again, paste the new credentials into `~/.aws/credentials`, check with `aws sts get-caller-identity` |
| SSH to bastion hangs | Your IP changed: update `admin_cidr`, `terraform apply` |
| `Permission denied (publickey)` | `ssh-add labsuser.pem`, check with `ssh-add -l` |
| `plan` fails on `data.aws_s3_bucket.data` | `bootstrap.sh` not run, or `unique_suffix` differs from the one used there |
| Wrong `unique_suffix` or `admin_cidr` still a placeholder | A variable defined twice in `terraform.tfvars`: the last line wins. Keep one line each |
| `GetObjectLockConfiguration` AccessDenied | Lab policy, see Bootstrap: never create buckets with `aws_s3_bucket` in this lab |
| ALB targets stay unhealthy | On an instance: `/var/log/art-gallery-boot.log`, `systemctl status art-gallery nginx`, `journalctl -u art-gallery` |
| Boot log says `mode: fallback` | Artifacts missing in `s3://<bucket>/artifacts/` for this `app_version`, or `npm ci` failed |
| `/api/artworks` returns 500 | Backend cannot reach the DB: check `db_force_ssl`, test `nc -vz <rds endpoint> 5432` from an instance, `journalctl -u art-gallery` |
| SSM `AccessDenied` in the boot log | LabRole cannot read Parameter Store in your lab: the secret mechanism must change |
| `apply` times out waiting for capacity | Instances never became healthy: read the boot log of one before destroying |
| Site loads but shows no artworks / tables empty | The seed was not loaded: check `aws s3 ls s3://<data bucket>/seed/`, then `sudo grep seed: /var/log/art-gallery-boot.log` on an instance. Upload the dump (step 4b) and rebuild, or restore by hand: [RDS.md](RDS.md#4-common-problems) |
| `invalid byte sequence for encoding "UTF8": 0xff` when restoring | The dump was written by PowerShell `>` (UTF-16). Make it again with the `-f` + `docker cp` commands of step 4b |
| `relation "..." already exists` when restoring by hand | The backend already created empty tables. Drop them first, see [RDS.md](RDS.md#4-common-problems) |
| `invalid option name: pipefail` running a `.sh` file | Windows line endings (CRLF). Convert to LF and add the `.gitattributes` lines (see Prerequisites) |
| `aws: command not found` running `bootstrap.sh` | Wrong `bash` (WSL has no AWS CLI). Use Git Bash |
| `Permission denied (publickey)` and no `labsuser.pem` | Skip SSH: EC2 console, select the instance, Connect, **Session Manager** |
| `502 Bad Gateway` right after replacing instances | The new instances are still booting (3 to 5 minutes). Check target health, see T7 |
| `AccessDenied` when opening an S3 object URL in the browser | Expected: the bucket is private. Open `http://<app_url>/api/uploads/<file>` instead ([S3.md](S3.md#6-common-problems)) |
| Uploaded images land on the instance disk, not in S3 | The site runs the old backend: rebuild and upload `backend-<version>.tar.gz` with `@aws-sdk/client-s3` installed, then apply |
| `plan` fails with `no matching ACM Certificate found` | The certificate is not `ISSUED` yet, was requested in another region (it must be `us-east-1`), or is not for `<app_subdomain>.<domain_name>`. Check with `aws acm describe-certificate --region us-east-1 --certificate-arn <ARN> --query Certificate.Status` |
| ACM stays `PENDING_VALIDATION` | The name servers at the registrar do not point to the Route 53 zone yet (`dig +short NS viewmyart.me` must list the four `awsdns` servers), or the validation CNAME is missing from the zone |
| `gallery.viewmyart.me` does not resolve right after `apply` | The alias record needs a minute or two. Check `dig +short gallery.viewmyart.me` |
| Site loads over HTTPS but shows no artworks | Mixed content (an absolute `http://` API URL built into the frontend): read the browser console |
| Old ECR repositories show up | Leftovers from earlier tests: `aws ecr delete-repository --repository-name <name> --force` |

## Appendix: L3 baseline (29 resources)

The first verified deployment (VPC, NAT, bastion, one test backend on port 3000). It was applied, tested through the bastion, and destroyed cleanly (29 created, 29 destroyed). The screenshots are kept as history; the v2 verification above replaces them.

<details>
<summary>Show the L3 screenshots</summary>

![terraform init](images/screenshots/02-terraform-init.webp)

![terraform plan, summary](images/screenshots/05-terraform-plan-summary.webp)

![terraform apply, complete and outputs](images/screenshots/08-apply-complete.webp)

![VPC resource map](images/screenshots/09-console-vpc-resource-map.webp)

![NAT Gateway](images/screenshots/13-console-nat-gateway.webp)

![Security groups](images/screenshots/15-console-security-groups.webp)

![SSH through the bastion and tests on the backend](images/screenshots/17-ssh-backend-test.webp)

![Destroy and leftover check](images/screenshots/18-destroy.webp)

</details>