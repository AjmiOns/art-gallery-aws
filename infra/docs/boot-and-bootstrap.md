# Bootstrap and instance boot

> Moved out of the infra README. Back to the [README](../README.md).

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
5. Writes the backend environment, including `S3_BUCKET` and `AWS_REGION`: with them, uploaded images go to S3 instead of the instance disk ([S3.md](../S3.md#2-how-an-uploaded-image-reaches-s3)).
6. Starts the API with **systemd** (`Restart=always`) on `127.0.0.1:3001`, and serves the frontend with nginx on port 80, proxying `/api` to the API.
7. **Fallback:** if the artifacts are missing or `npm ci` fails, a tiny server answers `/api/health` with `{"status":"fallback"}`, so the ALB sees healthy targets and the page says what is missing.

Logs on an instance: `/var/log/art-gallery-boot.log`, `/var/log/cloud-init-output.log`, `journalctl -u art-gallery`. The seed step writes one of these lines in the boot log:

```bash
sudo grep -E "seed:|=== mode" /var/log/art-gallery-boot.log
# seed: database restored from the dump          (fresh database, data loaded)
# seed: users table already present ... skipping (second instance, or a restored snapshot)
# seed: no dump in s3://.../seed/, skipping      (nothing uploaded in step 4b)
```
