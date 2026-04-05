#!/usr/bin/env bash
# deploy-ref.sh — Promote an exact git ref, then run deploy.sh
#
# This is a server-side promotion wrapper for deploying a specific tested
# commit, tag, or remote branch without giving CI shell access to the host.
#
# Safety model:
#   - Refuses a dirty checkout by default
#   - Fetches from the configured remote before resolving the target ref
#   - Leaves the repo on a detached HEAD at the deployed commit
#
# Usage:
#   ./deploy-ref.sh main
#   ./deploy-ref.sh v1.0.4
#   ./deploy-ref.sh 1a2b3c4 -- --frontend
#   ./deploy-ref.sh --remote upstream release/1.0 -- --php

set -euo pipefail

REMOTE="origin"
SKIP_FETCH=false
ALLOW_DIRTY=false
DRY_RUN=false
TARGET_REF=""
DEPLOY_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  ./deploy-ref.sh [options] <git-ref> [-- <deploy.sh args>]

Options:
  --remote <name>   Git remote to fetch from and prefer for branch refs
  --skip-fetch      Resolve refs from local git state only
  --allow-dirty     Allow running from a dirty checkout (not recommended)
  --dry-run         Resolve and print the target without switching or deploying
  -h, --help        Show this help text

Examples:
  ./deploy-ref.sh main
  ./deploy-ref.sh v1.0.4
  ./deploy-ref.sh release/1.0 -- --php
  ./deploy-ref.sh a1b2c3d -- --frontend

Notes:
  - The repo is left on a detached HEAD at the deployed commit.
  - This script is intentionally separate from deploy.sh so daily
    rapid-development deploys remain unchanged.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --remote)
      [ $# -ge 2 ] || die "--remote requires a value"
      REMOTE="$2"
      shift 2
      ;;
    --skip-fetch)
      SKIP_FETCH=true
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      DEPLOY_ARGS=("$@")
      break
      ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      if [ -z "$TARGET_REF" ]; then
        TARGET_REF="$1"
      else
        DEPLOY_ARGS+=("$1")
      fi
      shift
      ;;
  esac
done

[ -n "$TARGET_REF" ] || {
  usage >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[ -f "./deploy.sh" ] || die "deploy.sh not found in $SCRIPT_DIR"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git work tree"

if ! $ALLOW_DIRTY; then
  if ! git diff --quiet --ignore-submodules HEAD -- || \
     ! git diff --cached --quiet --ignore-submodules -- || \
     [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "Refusing to promote from a dirty checkout." >&2
    echo "Commit/stash your changes first, or rerun with --allow-dirty if you accept the risk." >&2
    git status --short >&2
    exit 1
  fi
fi

if ! $SKIP_FETCH; then
  git remote get-url "$REMOTE" >/dev/null 2>&1 || die "remote '$REMOTE' does not exist"
  echo "==> Fetching from $REMOTE"
  git fetch --prune --tags "$REMOTE"
fi

TARGET_SPEC=""
TARGET_DISPLAY=""
PREFER_LOCAL=false
case "$TARGET_REF" in
  HEAD|refs/*)
    PREFER_LOCAL=true
    ;;
  *)
    if [[ "$TARGET_REF" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
      PREFER_LOCAL=true
    fi
    ;;
esac

if ! $PREFER_LOCAL && git rev-parse --verify --quiet "refs/remotes/$REMOTE/$TARGET_REF^{commit}" >/dev/null; then
  TARGET_SPEC="refs/remotes/$REMOTE/$TARGET_REF"
  TARGET_DISPLAY="$REMOTE/$TARGET_REF"
elif git rev-parse --verify --quiet "${TARGET_REF}^{commit}" >/dev/null; then
  TARGET_SPEC="$TARGET_REF"
  TARGET_DISPLAY="$TARGET_REF"
else
  die "could not resolve '$TARGET_REF' as a commit, tag, or branch"
fi

TARGET_SHA="$(git rev-parse --verify "${TARGET_SPEC}^{commit}")"
CURRENT_SHA="$(git rev-parse --verify HEAD)"
if CURRENT_REF="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)"; then
  :
else
  CURRENT_REF="$CURRENT_SHA"
fi

echo "==> Current ref: $CURRENT_REF (${CURRENT_SHA:0:12})"
echo "==> Target ref:  $TARGET_DISPLAY (${TARGET_SHA:0:12})"

if $DRY_RUN; then
  echo "==> Dry run only. No checkout or deploy executed."
  exit 0
fi

echo "==> Switching to detached HEAD at ${TARGET_SHA:0:12}"
git switch --detach "$TARGET_SHA" >/dev/null

LOG_DIR="${DEPLOY_REF_LOG_DIR:-$SCRIPT_DIR/backups}"
LOG_FILE="${DEPLOY_REF_LOG_FILE:-$LOG_DIR/deploy-ref-history.log}"
mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP="$(date -Iseconds)"
DEPLOY_LABEL="${DEPLOY_ARGS[*]:-(default deploy)}"

set +e
./deploy.sh "${DEPLOY_ARGS[@]}"
DEPLOY_STATUS=$?
set -e

printf '%s\tstatus=%s\tfrom=%s\tto=%s\tref=%s\targs=%s\n' \
  "$TIMESTAMP" \
  "$DEPLOY_STATUS" \
  "$CURRENT_SHA" \
  "$TARGET_SHA" \
  "$TARGET_DISPLAY" \
  "$DEPLOY_LABEL" >> "$LOG_FILE"

if [ "$DEPLOY_STATUS" -eq 0 ]; then
  printf '%s\n' "$TARGET_SHA" > .last-deployed-sha
  printf '%s\n' "$TARGET_DISPLAY" > .last-deployed-ref
  echo "==> Deployed ${TARGET_DISPLAY} (${TARGET_SHA:0:12})"
  echo "==> Repo remains detached at the deployed commit."
  echo "==> Log written to $LOG_FILE"
else
  echo "==> deploy.sh failed for ${TARGET_DISPLAY} (${TARGET_SHA:0:12})" >&2
  echo "==> Repo remains detached at the attempted commit for inspection." >&2
  echo "==> Log written to $LOG_FILE" >&2
fi

exit "$DEPLOY_STATUS"
