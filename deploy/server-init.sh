#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3001}"
NODE_MAJOR=20

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy/server-init.sh"
  exit 1
fi

if [ -z "$REPO_URL" ]; then
  echo "Please set REPO_URL first."
  echo "Example: REPO_URL=https://gitee.com/yourname/student-management.git bash deploy/server-init.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx sqlite3

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/storage/resources" "$APP_ROOT/backups"

if [ ! -f "$APP_ROOT/shared/.env" ]; then
  cat > "$APP_ROOT/shared/.env" <<ENV
DATABASE_URL="file:$APP_ROOT/shared/dev.db"
NODE_ENV="production"
PORT="$PORT"
ENV
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_URL="$REPO_URL" BRANCH="$BRANCH" APP_ROOT="$APP_ROOT" APP_NAME="$APP_NAME" PORT="$PORT" bash "$SCRIPT_DIR/deploy-update.sh"

cat > "/etc/nginx/sites-available/$APP_NAME" <<NGINX
server {
    listen 80;
    server_name _;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
nginx -t
systemctl reload nginx
pm2 save

echo "Server init complete."
echo "Open: http://YOUR_SERVER_IP"
echo "Env file: $APP_ROOT/shared/.env"
