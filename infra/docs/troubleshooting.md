# Troubleshooting

> Moved out of the infra README. Back to the [README](../README.md).

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
| Site loads but shows no artworks / tables empty | The seed was not loaded: check `aws s3 ls s3://<data bucket>/seed/`, then `sudo grep seed: /var/log/art-gallery-boot.log` on an instance. Upload the dump (step 4b) and rebuild, or restore by hand: [RDS.md](../RDS.md#4-common-problems) |
| `invalid byte sequence for encoding "UTF8": 0xff` when restoring | The dump was written by PowerShell `>` (UTF-16). Make it again with the `-f` + `docker cp` commands of step 4b |
| `relation "..." already exists` when restoring by hand | The backend already created empty tables. Drop them first, see [RDS.md](../RDS.md#4-common-problems) |
| `invalid option name: pipefail` running a `.sh` file | Windows line endings (CRLF). Convert to LF and add the `.gitattributes` lines (see Prerequisites) |
| `aws: command not found` running `bootstrap.sh` | Wrong `bash` (WSL has no AWS CLI). Use Git Bash |
| `Permission denied (publickey)` and no `labsuser.pem` | Skip SSH: EC2 console, select the instance, Connect, **Session Manager** |
| `502 Bad Gateway` right after replacing instances | The new instances are still booting (3 to 5 minutes). Check target health, see T7 |
| `AccessDenied` when opening an S3 object URL in the browser | Expected: the bucket is private. Open `http://<app_url>/api/uploads/<file>` instead ([S3.md](../S3.md#6-common-problems)) |
| Uploaded images land on the instance disk, not in S3 | The site runs the old backend: rebuild and upload `backend-<version>.tar.gz` with `@aws-sdk/client-s3` installed, then apply |
| `plan` fails with `no matching ACM Certificate found` | The certificate is not `ISSUED` yet, was requested in another region (it must be `us-east-1`), or is not for `<app_subdomain>.<domain_name>`. Check with `aws acm describe-certificate --region us-east-1 --certificate-arn <ARN> --query Certificate.Status` |
| ACM stays `PENDING_VALIDATION` | The name servers at the registrar do not point to the Route 53 zone yet (`dig +short NS <your-domain>` must list the four `awsdns` servers), or the validation CNAME is missing from the zone |
| `gallery.<your-domain>` does not resolve right after `apply` | The alias record needs a minute or two. Check `dig +short gallery.<your-domain>` |
| Site loads over HTTPS but shows no artworks | Mixed content (an absolute `http://` API URL built into the frontend): read the browser console |
| Old ECR repositories show up | Leftovers from earlier tests: `aws ecr delete-repository --repository-name <name> --force` |
