#!/bin/bash
# Boot script of every app instance (Launch Template user_data).
# No secret in this file: passwords are read from SSM Parameter Store at boot.
# Do NOT add "set -x": it would print the secrets in the logs.
set -u
exec > >(tee -a /var/log/art-gallery-boot.log) 2>&1

REGION="${region}"
BUCKET="${bucket}"
VER="${app_version}"
APP_DIR=/opt/art-gallery

echo "=== art-gallery boot: version $VER, $(date -u +%FT%TZ)"

# ---- 1. packages (outbound access through the NAT Gateway) ----
dnf install -y nginx
dnf install -y nodejs20 nodejs20-npm || dnf install -y nodejs nodejs-npm

# ---- 2. secrets from SSM Parameter Store (instance role, no key in the file) ----
get_param() {
  for i in 1 2 3 4 5; do
    v=$(aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption \
          --query Parameter.Value --output text) && { echo "$v"; return 0; }
    sleep 5
  done
  return 1
}
DB_PASSWORD=$(get_param "${ssm_db_password}")
JWT_SECRET=$(get_param "${ssm_jwt_secret}")
ADMIN_PASSWORD=$(get_param "${ssm_admin_password}")

# ---- 3. application artifacts from S3 (through the S3 gateway endpoint) ----
id appuser >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin appuser
mkdir -p "$APP_DIR/backend/uploads" /usr/share/nginx/html

MODE=fallback
if aws s3 cp "s3://$BUCKET/artifacts/backend-$VER.tar.gz" /tmp/backend.tar.gz --region "$REGION" \
   && aws s3 cp "s3://$BUCKET/artifacts/frontend-$VER.tar.gz" /tmp/frontend.tar.gz --region "$REGION"; then
  tar -xzf /tmp/backend.tar.gz -C "$APP_DIR/backend"
  tar -xzf /tmp/frontend.tar.gz -C /usr/share/nginx/html
  if (cd "$APP_DIR/backend" && npm ci --omit=dev); then
    MODE=real
  fi
fi
echo "=== mode: $MODE"

# Fallback: the infrastructure still comes up healthy when the artifacts are not
# uploaded yet. The ALB health check passes, but the page says what is missing.
if [ "$MODE" = fallback ]; then
  cat > "$APP_DIR/fallback.js" <<'JS'
require('http').createServer(function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'fallback', note: 'artifacts not found in S3' }));
}).listen(3001, '127.0.0.1');
JS
  echo "art-gallery: artifacts $VER not found in s3://$BUCKET/artifacts/" > /usr/share/nginx/html/index.html
fi

# ---- 3b. seed the database from S3 (fresh RDS only) ----
# s3://BUCKET/seed/gallery.sql is a pg_dump kept in the persistent data bucket.
# It is loaded BEFORE the backend starts (otherwise the backend would create empty
# tables first). Skipped when there is no dump, or when the users table already
# exists. The load is one transaction (-1): if two instances race, the loser fails
# on "already exists" and rolls back, so nothing is applied twice. A failure here
# never stops the boot.
seed_database() {
  dnf install -y postgresql16 || { echo "seed: cannot install psql, skipping"; return 0; }
  aws s3 cp "s3://$BUCKET/seed/gallery.sql" /tmp/seed.sql --region "$REGION" \
    || { echo "seed: no dump in s3://$BUCKET/seed/, skipping"; return 0; }
  sed -i '/^\\restrict/d;/^\\unrestrict/d' /tmp/seed.sql
  export PGPASSWORD="$DB_PASSWORD"
  CONN="host=${db_host} port=${db_port} dbname=${db_name} user=${db_user} sslmode=require"
  for i in $(seq 1 30); do
    psql "$CONN" -Atc "select 1" >/dev/null 2>&1 && break
    sleep 10
  done
  HAS_USERS=$(psql "$CONN" -Atc "select to_regclass('public.users') is not null" 2>/dev/null)
  if [ "$HAS_USERS" = "f" ]; then
    if psql "$CONN" -v ON_ERROR_STOP=1 -1 -q -f /tmp/seed.sql >/dev/null; then
      echo "seed: database restored from the dump"
      # Images uploaded locally were saved with a full http://localhost:3001/uploads/... link.
      # On AWS they are served by the API from S3: make the links relative (host independent).
      psql "$CONN" -q -c "update artworks set image_url = '/api/uploads/' || regexp_replace(image_url, '^.*/uploads/', '') where image_url ~ '^https?://[^/]+/uploads/'" \
        && echo "seed: image links normalised" || echo "seed: image link update failed"
    else
      echo "seed: restore failed or done by another instance (nothing applied twice)"
    fi
  else
    echo "seed: users table already present (or database unreachable), skipping"
  fi
  rm -f /tmp/seed.sql
  unset PGPASSWORD
}
seed_database

# ---- 4. backend as a systemd service (restarts by itself if it crashes) ----
cat > /etc/art-gallery.env <<EOF
NODE_ENV=${node_env}
PORT=3001
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
ADMIN_PASSWORD=$ADMIN_PASSWORD
S3_BUCKET=$BUCKET
AWS_REGION=$REGION
FRONTEND_URL=http://${public_host}
PUBLIC_API_URL=http://${public_host}
EOF
chmod 600 /etc/art-gallery.env

NODE_BIN=$(command -v node)
if [ "$MODE" = real ]; then
  EXEC="$NODE_BIN ${backend_entry}"
else
  EXEC="$NODE_BIN $APP_DIR/fallback.js"
fi

cat > /etc/systemd/system/art-gallery.service <<UNIT
[Unit]
Description=Art Gallery API ($MODE)
After=network-online.target
Wants=network-online.target

[Service]
User=appuser
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=/etc/art-gallery.env
ExecStart=$EXEC
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

chown -R appuser:appuser "$APP_DIR"
chmod -R a+rX /usr/share/nginx/html

# ---- 5. nginx: serves the static frontend, proxies /api to the backend ----
cat > /etc/nginx/nginx.conf <<'NGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /var/log/nginx/access.log;
  sendfile on;
  client_max_body_size 10m;

  server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;

    location /api/ {
      proxy_pass http://127.0.0.1:3001;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
      try_files $uri $uri.html $uri/ /index.html;
    }
  }
}
NGINX

systemctl daemon-reload
systemctl enable --now art-gallery
systemctl enable --now nginx
echo "=== boot finished, $(date -u +%FT%TZ)"
