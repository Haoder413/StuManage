#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"
PORT="${PORT:-3001}"
PREVIOUS_RELEASE="${PREVIOUS_RELEASE:-}"

if [ -z "$PREVIOUS_RELEASE" ] || [ ! -d "$PREVIOUS_RELEASE" ]; then
  echo "Previous release is unavailable: $PREVIOUS_RELEASE" >&2
  exit 1
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  if ! pm2 delete "$APP_NAME"; then
    echo "Failed to stop the unsuccessful release." >&2
    exit 1
  fi
fi

if ! ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/current"; then
  echo "Failed to restore the current release symlink." >&2
  exit 1
fi
if ! cd "$PREVIOUS_RELEASE"; then
  echo "Failed to enter previous release: $PREVIOUS_RELEASE" >&2
  exit 1
fi
if ! PORT="$PORT" pm2 start npm --name "$APP_NAME" -- start -- -p "$PORT"; then
  echo "Failed to start previous release." >&2
  exit 1
fi
if ! pm2 save; then
  echo "Previous release started, but PM2 state could not be saved." >&2
  exit 1
fi

echo "Previous release restored: $PREVIOUS_RELEASE"
