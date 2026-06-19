#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"

CURRENT_TARGET="$(readlink "$APP_ROOT/current" || true)"
PREVIOUS_RELEASE="$(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | grep -v "$CURRENT_TARGET" | tail -n 1)"

if [ -z "$PREVIOUS_RELEASE" ]; then
  echo "No previous release found."
  exit 1
fi

ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/current"
pm2 restart "$APP_NAME" --update-env

echo "Rolled back to: $PREVIOUS_RELEASE"
