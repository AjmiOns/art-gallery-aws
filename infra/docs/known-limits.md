# Known limits

> Moved out of the infra README. Back to the [README](../README.md).

## Known limits

| Topic | Today | Why / what to do |
|---|---|---|
| Single NAT | One NAT in AZ a: if AZ a fails, AZ b loses outbound traffic (npm, dnf). Inbound user traffic through the ALB is not affected | Accepted cost trade-off. Test and mention in the defence |
| DB data between sessions | Lost at `destroy` (no final snapshot), but **restored from `seed/gallery.sql`** at the next apply. Data created on AWS after the restore is lost | Save it as the new seed before destroying ([RDS.md](../RDS.md#3-keep-the-data-created-on-aws-before-a-destroy)), or snapshot + `db_snapshot_identifier` (T9) |
| Uploaded artwork images | Stored in S3 and kept after a destroy, but an image shows only if an artwork row points to it (rows come back as of the seed) | Save the live database as the new seed before destroying ([RDS.md](../RDS.md#3-keep-the-data-created-on-aws-before-a-destroy)) |
| TLS to PostgreSQL | `db_force_ssl = false` (RDS PostgreSQL 15+ forces TLS by default) | Traffic stays in the private VPC. Set `true` once the API connects with TLS (`DB_SSL`, see the [backend](../../backend/README.md#configuration)) |
| Secrets in state | Generated values are also in the Terraform state | Keep the state in the private, encrypted, versioned bucket |
| HTTPS | HTTPS on `gallery.<your-domain>` with `enable_https = true`, HTTP only otherwise. TLS ends at the ALB: ALB to instance traffic is HTTP inside the VPC | Route 53 zone and ACM certificate are created once by hand and are not managed by Terraform. End-to-end TLS would need a certificate on the instances |
| Hosted zone and certificate persist | `./destroy.sh` keeps the Route 53 zone and the ACM certificate (only the alias record is destroyed with the stack). The zone costs about 0.50 USD per month, the public certificate is free | Delete both at the end of the course (see [HTTPS](https.md#https-and-custom-domain)) |
| ASG CPU target tracking | Scale-in is intentionally slow by design; AWS creates the policy's CloudWatch alarms and deletes them automatically with the policy | Expected behavior; observe it during the T11 load test |
| CloudWatch Logs delivery | If `LabInstanceProfile` cannot write to CloudWatch Logs, the groups stay empty | Agent setup is non-fatal; the app still runs |
| Remote state | The state is stored in the private S3 state bucket with locking (`versions.tf`, `backend.hcl`). A local copy goes to `state-backups/` after each apply and is removed after a successful destroy | A crashed Terraform run can leave a stale lock: check that no other run is active, then `terraform force-unlock <ID>` |
| Instance refresh | The lab SCP denies `autoscaling:StartInstanceRefresh`, so `enable_instance_refresh` is `false` | Replace instances by hand (T8) |
| CloudFront | Not available in the lab account: all traffic goes through the ALB | HTTPS is done at the ALB instead |
| Leftover check | `destroy.sh` only fails for resources tagged `Project=art-gallery` (ALB, RDS and RDS snapshots by name prefix). Other resources in the account are listed as ignored and never touched | An untagged resource leaked by this project would not make the check fail |
| `npm ci` at boot | Depends on the npm registry through the NAT | Bundle `node_modules` in the artifact if it becomes a problem |
