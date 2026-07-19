#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy/install-maintenance-cron.sh"
  exit 1
fi

if [[ ! "$APP_NAME" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "APP_NAME may contain only letters, numbers, underscores, and hyphens."
  exit 1
fi

if [[ "$APP_ROOT" != /* || "$APP_ROOT" == *[[:space:]]* ]]; then
  echo "APP_ROOT must be an absolute path without spaces."
  exit 1
fi

CRON_FILE="/etc/cron.d/${APP_NAME}-maintenance"
mkdir -p "$APP_ROOT/backups"

cat > "$CRON_FILE" <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root cd $APP_ROOT/current && npm run devices:cleanup >> $APP_ROOT/backups/device-cleanup.log 2>&1
CRON

chmod 0644 "$CRON_FILE"
echo "Installed daily device history cleanup: $CRON_FILE"
