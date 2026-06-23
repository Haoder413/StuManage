#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/student-management}"
DB_PATH="${DB_PATH:-$APP_ROOT/shared/dev.db}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-15}"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/dev-$(date +%Y%m%d-%H%M%S).db"
cp "$DB_PATH" "$BACKUP_FILE"

find "$BACKUP_DIR" -maxdepth 1 -type f -name "dev-*.db" -print | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

echo "Database backup created: $BACKUP_FILE"
