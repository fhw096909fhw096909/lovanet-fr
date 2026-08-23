#!/usr/bin/env bash
set -euo pipefail

# Script to enforce the Lovable default theme in this repository.
# Usage: bash scripts/apply-lovable-default-theme.sh [branch]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_TARGET_FILE="$ROOT_DIR/.lovable/sync-target.env"
if [[ -f "$SYNC_TARGET_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SYNC_TARGET_FILE"
fi

SYNC_REMOTE_NAME="${LOVABLE_SYNC_REMOTE_NAME:-lovable-sync}"
if [[ -n "${LOVABLE_SYNC_REMOTE_URL:-}" ]]; then
  SYNC_REMOTE_URL="$LOVABLE_SYNC_REMOTE_URL"
else
  if git -C "$ROOT_DIR" remote get-url "$SYNC_REMOTE_NAME" >/dev/null 2>&1; then
    SYNC_REMOTE_URL="$(git -C "$ROOT_DIR" remote get-url "$SYNC_REMOTE_NAME")"
  elif git -C "$ROOT_DIR" remote get-url origin >/dev/null 2>&1; then
    SYNC_REMOTE_URL="$(git -C "$ROOT_DIR" remote get-url origin)"
  else
    echo "Unable to resolve remote URL. Set LOVABLE_SYNC_REMOTE_URL or configure remote '$SYNC_REMOTE_NAME'." >&2
    exit 1
  fi
fi

CURRENT_BRANCH="$(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true)"
BRANCH="${1:-${LOVABLE_SYNC_BRANCH:-${CURRENT_BRANCH:-main}}}"
THEME_ID="mint-vibrant-cyber"

FILES=(
  "$ROOT_DIR/src/components/ThemeBubble.tsx"
  "$ROOT_DIR/frontend/src/components/ThemeBubble.tsx"
)

echo "Using branch: $BRANCH"
cd "$ROOT_DIR"

if git remote get-url "$SYNC_REMOTE_NAME" >/dev/null 2>&1; then
  git remote set-url "$SYNC_REMOTE_NAME" "$SYNC_REMOTE_URL"
else
  git remote add "$SYNC_REMOTE_NAME" "$SYNC_REMOTE_URL"
fi

if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Branch '$BRANCH' does not exist locally. Fetching from origin..."
  git fetch "$SYNC_REMOTE_NAME" "$BRANCH":"$BRANCH"
fi

if git show-ref --verify --quiet "refs/remotes/$SYNC_REMOTE_NAME/$BRANCH"; then
  git fetch "$SYNC_REMOTE_NAME" "$BRANCH"
fi

git switch "$BRANCH"

git_status_changed=false

for file in "${FILES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Updating theme default in $file"
    if grep -q 'DEFAULT_THEME_ID = "'$THEME_ID'"' "$file"; then
      echo "  Already set to $THEME_ID"
    else
      perl -pi -e 's/DEFAULT_THEME_ID = \"[^\"]*\";/DEFAULT_THEME_ID = "'$THEME_ID'";/' "$file"
      git add "$file"
      git_status_changed=true
    fi
  else
    echo "  File not found, skipping: $file"
  fi
done

if [[ "$git_status_changed" == true ]]; then
  git commit -m "Apply Lovable default theme: $THEME_ID"
  git push "$SYNC_REMOTE_NAME" "$BRANCH"
  echo "Committed and pushed changes to branch $BRANCH."
else
  echo "No changes needed. Theme already set to $THEME_ID in available files."
fi

echo "Done. If you need to publish from Lovable, use remote $SYNC_REMOTE_NAME and branch $BRANCH."
