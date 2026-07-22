#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/student-management}"
APP_DIR="${APP_DIR:-$APP_ROOT/current}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-15}"

if [ -z "${DB_PATH:-}" ]; then
  if [ ! -d "$APP_DIR" ]; then
    echo "Application directory not found: $APP_DIR"
    exit 1
  fi
  unset DATABASE_URL
  DB_PATH="$(cd "$APP_DIR" && node --import tsx scripts/resolve-sqlite-database-path.ts)"
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for a consistent database backup."
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/dev-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
if [ "$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")" != "ok" ]; then
  echo "Database backup integrity check failed: $BACKUP_FILE"
  exit 1
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name "dev-*.db" -print | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

echo "Database backup created: $BACKUP_FILE"
