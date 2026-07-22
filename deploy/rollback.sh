#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management}"
APP_ROOT="${APP_ROOT:-/opt/student-management}"
PORT="${PORT:-3001}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo env APP_ROOT=$APP_ROOT APP_NAME=$APP_NAME PORT=$PORT bash deploy/rollback.sh"
  exit 1
fi

PREVIOUS_RELEASE="$(readlink -f "$APP_ROOT/previous" 2>/dev/null || true)"

if [ -z "$PREVIOUS_RELEASE" ]; then
  CURRENT_TARGET="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
  PREVIOUS_RELEASE="$(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | grep -v "$CURRENT_TARGET" | tail -n 1)"
fi

if [ -z "$PREVIOUS_RELEASE" ]; then
  echo "No previous release found."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PREVIOUS_RELEASE="$PREVIOUS_RELEASE" \
  APP_ROOT="$APP_ROOT" \
  APP_NAME="$APP_NAME" \
  PORT="$PORT" \
  bash "$SCRIPT_DIR/restore-release.sh"
