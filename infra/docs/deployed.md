# What is deployed

> Moved out of the infra README. Back to the [README](../README.md).

## What is deployed (52-resource baseline)

The applied v2 baseline has 52 resources, including the CloudWatch log groups, the scaling policy and the alarms. With `enable_https = true` there are 2 more (the HTTPS listener and the Route 53 alias record), so 54. Full list: `terraform state list`.

| Area | Resources | Module |
|---|---|---|
| Network | VPC, Internet Gateway, 6 subnets, 3 route tables + routes + 6 associations, Elastic IP, NAT Gateway, S3 gateway endpoint, DB subnet group | `network` |
| Security | 4 security groups (rules defined in the module) | `security` |
| Bastion | 1 `t3.micro` in public subnet 1 | `compute` |
| Secrets | 3 random values + 3 SSM SecureString parameters (`/art-gallery/db-password`, `jwt-secret`, `admin-password`) | `secrets` |
| Load balancer | ALB, target group (`/api/health`, 15 s), HTTP :80 listener (forward, or 301 redirect when HTTPS is on). With `enable_https`: HTTPS :443 listener and a Route 53 alias record for `gallery.<your-domain>` | `alb` / root |
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
