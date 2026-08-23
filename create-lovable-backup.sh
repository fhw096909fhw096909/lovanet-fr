#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-/app}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/backups/lovable-$TIMESTAMP"
ARCHIVE_PATH="$BACKUP_DIR/lovable.tar.gz"

mkdir -p "$BACKUP_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

# Store git context when source is inside a git workspace.
if git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$SOURCE_DIR" rev-parse HEAD >"$BACKUP_DIR/git-head.txt" || true
  git -C "$SOURCE_DIR" status --short >"$BACKUP_DIR/git-status.txt" || true
fi

tar -czf "$ARCHIVE_PATH" \
  --exclude='./backups' \
  --exclude='./node_modules' \
  --exclude='./backend/.venv' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/build' \
  --exclude='./dist' \
  -C "$SOURCE_DIR" .

echo "Backup created: $ARCHIVE_PATH"
