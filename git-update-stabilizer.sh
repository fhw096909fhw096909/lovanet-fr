#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_TARGET_FILE="$ROOT_DIR/.lovable/sync-target.env"

log() {
  printf '[stabilizer] %s\n' "$*"
}

resolve_current_branch() {
  git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true
}

resolve_upstream_remote() {
  local branch
  branch="$(resolve_current_branch)"
  if [[ -n "$branch" ]]; then
    git -C "$ROOT_DIR" for-each-ref --format='%(upstream:remotename)' "refs/heads/$branch" 2>/dev/null | head -n1
  fi
}

resolve_upstream_branch() {
  local branch
  branch="$(resolve_current_branch)"
  if [[ -n "$branch" ]]; then
    git -C "$ROOT_DIR" for-each-ref --format='%(upstream:short)' "refs/heads/$branch" 2>/dev/null | sed -n 's|^[^/]*/||p' | head -n1
  fi
}

if [[ -f "$ROOT_DIR/create-lovable-backup.sh" ]]; then
  free_mb="$(df -Pm "$ROOT_DIR" | awk 'NR==2{print $4}')"
  if [[ -n "$free_mb" && "$free_mb" -ge 3072 ]]; then
    log "Creating safety backup (best effort)."
    bash "$ROOT_DIR/create-lovable-backup.sh" "$ROOT_DIR" || log "Backup failed, continuing."
  else
    log "Skipping backup: low disk space (${free_mb:-unknown}MB free)."
  fi
fi

if [[ -f "$SYNC_TARGET_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SYNC_TARGET_FILE"
fi

REMOTE_NAME="${LOVABLE_SYNC_REMOTE_NAME:-$(resolve_upstream_remote)}"
REMOTE_NAME="${REMOTE_NAME:-emergent}"
BRANCH="${LOVABLE_SYNC_BRANCH:-$(resolve_upstream_branch)}"
BRANCH="${BRANCH:-main}"

if [[ -n "${LOVABLE_SYNC_REMOTE_URL:-}" ]]; then
  REMOTE_URL="$LOVABLE_SYNC_REMOTE_URL"
else
  REMOTE_URL="$(git -C "$ROOT_DIR" remote get-url "$REMOTE_NAME" 2>/dev/null || true)"
fi

if [[ -z "$REMOTE_URL" ]]; then
  log "Unable to resolve URL for remote '$REMOTE_NAME'."
  exit 1
fi

log "Using remote: $REMOTE_NAME"
log "Using branch: $BRANCH"

if git -C "$ROOT_DIR" remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  git -C "$ROOT_DIR" remote set-url "$REMOTE_NAME" "$REMOTE_URL"
else
  git -C "$ROOT_DIR" remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

log "Fetching latest from $REMOTE_NAME/$BRANCH"
git -C "$ROOT_DIR" fetch "$REMOTE_NAME" "$BRANCH"

CURRENT_BRANCH="$(resolve_current_branch)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]] && [[ -n "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null)" ]]; then
  log "Working tree has local changes; keeping current branch '$CURRENT_BRANCH'."
  if [[ -n "$CURRENT_BRANCH" ]] && git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/$REMOTE_NAME/$BRANCH"; then
    log "Skipping branch switch due to local changes."
  fi
elif ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$ROOT_DIR" switch -c "$BRANCH" --track "$REMOTE_NAME/$BRANCH"
else
  git -C "$ROOT_DIR" switch "$BRANCH"
fi

if [[ "$(resolve_current_branch)" == "$BRANCH" ]]; then
  log "Fast-forwarding local branch"
  git -C "$ROOT_DIR" merge --ff-only "$REMOTE_NAME/$BRANCH"
else
  log "Branch fast-forward skipped (current: $(resolve_current_branch), target: $BRANCH)."
fi

# Guardrail: never deploy from a stale local target branch.
if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$BRANCH" && \
   git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/$REMOTE_NAME/$BRANCH"; then
  read -r ahead_count behind_count < <(git -C "$ROOT_DIR" rev-list --left-right --count "$BRANCH...$REMOTE_NAME/$BRANCH")
  if [[ "${behind_count:-0}" -gt 0 ]]; then
    log "Refusing deployment: local '$BRANCH' is behind '$REMOTE_NAME/$BRANCH' by $behind_count commit(s)."
    log "Run: git -C '$ROOT_DIR' switch '$BRANCH' && git -C '$ROOT_DIR' merge --ff-only '$REMOTE_NAME/$BRANCH'"
    exit 1
  fi
fi

ACTIVE_BRANCH_CHECK="$(resolve_current_branch)"
if [[ "$ACTIVE_BRANCH_CHECK" != "$BRANCH" ]]; then
  log "Refusing deployment: active branch '$ACTIVE_BRANCH_CHECK' is not target branch '$BRANCH'."
  log "Commit/stash local changes, then switch to '$BRANCH' before running stabilization."
  exit 1
fi

log "Installing dependencies"
if command -v bun >/dev/null 2>&1; then
  (cd "$ROOT_DIR" && bun install --frozen-lockfile)
  log "Building with bun"
  (cd "$ROOT_DIR" && bun run build)
else
  if ! (cd "$ROOT_DIR" && npm ci); then
    log "npm ci failed, falling back to npm install."
    (cd "$ROOT_DIR" && npm install)
  fi
  log "Building with npm"
  (cd "$ROOT_DIR" && npm run build)
fi

log "Writing deployment marker"
ACTIVE_BRANCH="$(resolve_current_branch)"
ACTIVE_BRANCH="${ACTIVE_BRANCH:-$BRANCH}"
printf 'deployed_at=%s\ncommit=%s\nbranch=%s\nremote=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(git -C "$ROOT_DIR" rev-parse HEAD)" \
  "$ACTIVE_BRANCH" \
  "$REMOTE_NAME" >"$ROOT_DIR/DEPLOY_MARKER_LOVABLE.txt"

log "Stabilization completed successfully."
