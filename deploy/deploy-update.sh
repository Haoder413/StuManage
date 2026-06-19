#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3001}"
RUN_SEED="${RUN_SEED:-0}"

if [ -z "$REPO_URL" ]; then
  echo "Please set REPO_URL first."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_ROOT/releases/$TIMESTAMP"
SHARED_DIR="$APP_ROOT/shared"

mkdir -p "$APP_ROOT/releases" "$SHARED_DIR/storage/resources" "$APP_ROOT/backups"

if [ -f "$SHARED_DIR/dev.db" ]; then
  cp "$SHARED_DIR/dev.db" "$APP_ROOT/backups/dev-$TIMESTAMP.db"
fi

git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$RELEASE_DIR"

cd "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/.env" ".env"
mkdir -p storage
ln -sfn "$SHARED_DIR/storage/resources" "storage/resources"

npm ci
npx prisma generate
npx prisma db push --skip-generate

if [ "$RUN_SEED" = "1" ]; then
  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
fi

npm run build

ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  cd "$APP_ROOT/current"
  PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start -- -p "$PORT"
fi

find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Deploy complete: $RELEASE_DIR"
