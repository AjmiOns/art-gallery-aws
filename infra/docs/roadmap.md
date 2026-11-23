# Roadmap

> Moved out of the infra README. Back to the [README](../README.md).

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
- [x] Resilience demo evidence ([T7](t7.md))
- [x] Rolling update demo ([T8](t8.md))
- [x] Snapshot and restore demo (T9), snapshot step in `destroy.sh`
- [x] S3 remote state with bucket versioning, native locking and local backups
- [x] CloudWatch dashboard and metric alarms deployed
- [x] SNS e-mail notifications configured and tested (an alarm e-mail was received)
- [x] CloudWatch log shipping (4 log groups, one stream per instance)
- [x] Real-mode rebuild timing: 14 min 17 s (`./apply.sh`, 54 resources with HTTPS)
- [x] HTTPS on `gallery.<your-domain>` (ACM certificate, Route 53 alias, HTTP to HTTPS redirect), verified with `curl`
- [ ] k6 load test (T11)
- [ ] boto3 scripts (RDS snapshot and restore, resilience test, cost report)
- [ ] Optional: ECR registry in `bootstrap/` as an upgrade of the deployment method
