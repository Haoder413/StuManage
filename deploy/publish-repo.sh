#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="${1:-}"
BRANCH="${2:-main}"

if [ -z "$REMOTE_URL" ]; then
  echo "Usage: ./deploy/publish-repo.sh <REMOTE_URL> [BRANCH]"
  echo "Example: ./deploy/publish-repo.sh git@github.com:yourname/student-management.git main"
  exit 1
fi

if [ ! -d ".git" ]; then
  git init
fi

git branch -M "$BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git add .
git commit -m "deploy: prepare server scripts" || true
git push -u origin "$BRANCH"
