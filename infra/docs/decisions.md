# Deployment options and design decisions

> Moved out of the infra README. Back to the [README](../README.md).

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
4. **Versioned and reversible.** `backend-v1.tar.gz` / `frontend-v1.tar.gz` are immutable by name. A new version is a new file plus one Terraform variable (`app_version`), which creates a new launch template version. The lab denies `autoscaling:StartInstanceRefresh`, so the running instances are replaced one at a time by hand (see [T8](t8.md)): no total interruption.
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

> Check that no ECR repository is left over from earlier experiments (see [leftover check](verification.md#leftover-check)): `aws ecr describe-repositories`.

### Entry point: one origin behind the ALB

| Option | Description | Verdict |
|---|---|---|
| **A. nginx on the app instances** | nginx serves the static site and proxies `/api` to the API on the same instance. The ALB is the only public entry point and exposes **one origin** (no CORS, no mixed HTTP/HTTPS content) | **Chosen** |
| B. S3 + CloudFront | Static site on S3, CloudFront in front, `/api/*` as a second origin to the ALB | Rejected for now: CloudFront is optional in the cahier, heavier, and needs an extra origin to avoid mixed content |

How the site and API are built is described in the [frontend](../../frontend/README.md#build-et-déploiement) and [backend](../../backend/README.md#déploiement) READMEs.

## Other decisions

| Topic | Chosen | Alternatives | Why |
|---|---|---|---|
| Outbound access | 1 NAT Gateway (AZ a) + free S3 gateway endpoint | NAT per AZ, NAT instance, endpoints only | Budget: a second NAT doubles the biggest line. A NAT instance means patching and failover to manage. Endpoints only cover AWS services |
| Secrets | SSM Parameter Store (SecureString), generated by Terraform | Secrets Manager | Secrets Manager is not on the §4 list, Parameter Store standard tier is free. **Verified:** `LabRole` can read the parameters (instances booted and reached RDS) |
| Persistent buckets | `bootstrap/bootstrap.sh` (AWS CLI) | Terraform `aws_s3_bucket` | The Learner Lab denies `s3:GetBucketObjectLockConfiguration`, which the Terraform provider reads after creating any bucket (fails on v4, v5, v6). The main stack only *reads* the bucket with a data source |
| Bucket layout | 1 data bucket, 2 prefixes (`artifacts/`, `artworks/`) + 1 state bucket | Separate buckets per use | Fewer resources, simpler leftover check |
| Database | RDS PostgreSQL 16, `db.t3.micro`, **single-AZ**, encrypted, 7-day backups | Multi-AZ, DB in a container on EC2 | Multi-AZ doubles RDS hours and is not required. A DB on an ASG instance would vanish at replacement, and the cahier requires RDS with backups |
| Load balancer protocol | HTTP :80 by default. With `enable_https = true`: HTTPS :443 (ACM certificate) and port 80 redirects (301) | HTTP only | A domain you own allows a free ACM certificate. TLS ends at the ALB, traffic stays HTTP inside the VPC. Details: [HTTPS and custom domain](https.md#https-and-custom-domain) |
| DNS and certificate | Route 53 hosted zone + ACM certificate created **once by hand** (CLI), only *looked up* by Terraform | Create them in Terraform | They must survive every `destroy` (the certificate needs DNS validation and the registrar keeps the zone name servers). Neither Route 53 nor ACM is in the cahier §4.1 list: they are documented additions |
| ASG health check | `ELB` type, 300 s grace period | `EC2` type | An instance the ALB sees as unhealthy is replaced, not only one that is powered off |
| Instance metadata | IMDSv2 required, hop limit 2 | IMDSv1 | Security hardening. Hop limit 2 lets the AWS SDK work if a container is ever used |
| Deregistration delay | 30 s | 300 s default | Faster demos and faster destroy |
