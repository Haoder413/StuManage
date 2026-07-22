#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3001}"
RUN_SEED="${RUN_SEED:-0}"
KEEP_BACKUPS="${KEEP_BACKUPS:-15}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:$PORT/api/health}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-30}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root with an explicit environment: sudo env REPO_URL=... BRANCH=... APP_ROOT=... bash deploy-update.sh"
  exit 1
fi

# Never let an invoking shell redirect Prisma or migration commands away from shared/.env.
unset DATABASE_URL

if [ -z "$REPO_URL" ]; then
  echo "Please set REPO_URL first."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_ROOT/releases/$TIMESTAMP"
SHARED_DIR="$APP_ROOT/shared"

mkdir -p \
  "$APP_ROOT/releases" \
  "$SHARED_DIR/storage/resources" \
  "$SHARED_DIR/storage/public-materials" \
  "$SHARED_DIR/storage/lesson-videos" \
  "$SHARED_DIR/storage/lesson-attachments" \
  "$APP_ROOT/backups"

for command in flock sqlite3 curl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required deployment command is missing: $command"
    exit 1
  fi
done

exec 9>"$APP_ROOT/deploy.lock"
if ! flock -n 9; then
  echo "Another deployment is already running."
  exit 1
fi

PREVIOUS_RELEASE="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
ROLLBACK_REQUIRED=0

restore_previous_release() {
  echo "Deployment failed; restoring the previous release."
  PREVIOUS_RELEASE="$PREVIOUS_RELEASE" \
    APP_ROOT="$APP_ROOT" \
    APP_NAME="$APP_NAME" \
    PORT="$PORT" \
    bash "$RELEASE_DIR/deploy/restore-release.sh"
}

handle_failure() {
  status="$1"
  trap - ERR
  if [ "$ROLLBACK_REQUIRED" = "1" ]; then
    if ! restore_previous_release; then
      echo "Automatic previous-release recovery failed; manual intervention is required." >&2
      exit 1
    fi
  fi
  exit "$status"
}

trap 'handle_failure $?' ERR

git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$RELEASE_DIR"

cd "$RELEASE_DIR"
ln -sfn "$SHARED_DIR/.env" ".env"
mkdir -p storage
ln -sfn "$SHARED_DIR/storage/resources" "storage/resources"
ln -sfn "$SHARED_DIR/storage/public-materials" "storage/public-materials"
ln -sfn "$SHARED_DIR/storage/lesson-videos" "storage/lesson-videos"
ln -sfn "$SHARED_DIR/storage/lesson-attachments" "storage/lesson-attachments"

npm ci
DB_PATH="$(node --import tsx scripts/resolve-sqlite-database-path.ts)"
DATABASE_URL="file:$DB_PATH"
export DATABASE_URL
if [ "$(node --import tsx scripts/resolve-sqlite-database-path.ts)" != "$DB_PATH" ]; then
  echo "DATABASE_URL and the resolved SQLite path do not match."
  exit 1
fi
npx prisma generate

npm run build

ROLLBACK_REQUIRED=1
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 stop "$APP_NAME"
fi

if [ -f "$DB_PATH" ]; then
  BACKUP_FILE="$APP_ROOT/backups/dev-$TIMESTAMP.db"
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
  if [ "$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")" != "ok" ]; then
    echo "Database backup integrity check failed: $BACKUP_FILE"
    false
  fi
  find "$APP_ROOT/backups" -maxdepth 1 -type f -name "dev-*.db" -print | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
  echo "Consistent database backup created: $BACKUP_FILE"
fi

npx prisma db push --skip-generate
npm run devices:migrate

if [ "$RUN_SEED" = "1" ]; then
  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
fi

if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
  ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/previous"
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME"
fi
cd "$APP_ROOT/current"
PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start -- -p "$PORT"

HEALTHY=0
for ((attempt = 1; attempt <= HEALTHCHECK_ATTEMPTS; attempt += 1)); do
  if curl -fsS --max-time 3 "$HEALTHCHECK_URL" >/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 1
done
if [ "$HEALTHY" != "1" ]; then
  echo "Health check failed: $HEALTHCHECK_URL"
  false
fi

if ! pm2 save; then
  echo "Failed to save the healthy PM2 process list."
  false
fi

ROLLBACK_REQUIRED=0
trap - ERR

find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Deploy complete: $RELEASE_DIR"
