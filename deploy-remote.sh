#!/usr/bin/env bash
# deploy-remote.sh - Deploy Parthenon on the production host over SSH.
#
# Default mode promotes a committed git ref on the server with deploy-ref.sh,
# then lets the server run deploy.sh. This is the safest path for normal work:
# commit locally, push, then deploy from any machine with SSH access.
#
# Usage:
#   ./deploy-remote.sh --frontend
#   ./deploy-remote.sh --ref main -- --frontend
#   ./deploy-remote.sh --push --frontend
#   ./deploy-remote.sh --sync --frontend
#
# Defaults can be overridden with flags or environment variables:
#   DEPLOY_REMOTE_HOST=parthenon.acumenus.net
#   DEPLOY_REMOTE_USER=smudoshi
#   DEPLOY_REMOTE_TARGET=smudoshi@parthenon.acumenus.net
#   DEPLOY_REMOTE_DIR=/home/smudoshi/Github/Parthenon
#   DEPLOY_REMOTE_GIT_REMOTE=origin

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REMOTE_HOST="${DEPLOY_REMOTE_HOST:-parthenon.acumenus.net}"
REMOTE_USER="${DEPLOY_REMOTE_USER:-smudoshi}"
REMOTE_TARGET="${DEPLOY_REMOTE_TARGET:-}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-}"
GIT_REMOTE="${DEPLOY_REMOTE_GIT_REMOTE:-origin}"
REF="${DEPLOY_REMOTE_REF:-}"

MODE="ref"
PUSH=false
DRY_RUN=false
LOCAL_CHECK=true
ALLOW_LOCAL_DIRTY=false
SYNC_DELETE=false

DEPLOY_REF_ARGS=()
DEPLOY_ARGS=()
SSH_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  ./deploy-remote.sh [remote options] [deploy.sh args]
  ./deploy-remote.sh [remote options] -- [deploy.sh args]

Common examples:
  ./deploy-remote.sh --frontend
  ./deploy-remote.sh --push --frontend
  ./deploy-remote.sh --ref main -- --frontend
  ./deploy-remote.sh --ref v1.0.4
  ./deploy-remote.sh --sync --frontend

Remote options:
  --host <host>          SSH host. Default: parthenon.acumenus.net
  --user <user>          SSH user. Default: smudoshi
  --target <ssh-target>  Full SSH target, for example prod-alias or user@host
  --dir <path>           Remote repo path. Default: /home/<user>/Github/Parthenon
  --remote <name>        Git remote name used on local/server repos. Default: origin
  --ref <git-ref>        Commit, tag, or branch for deploy-ref.sh. Default: current branch
  --push                 Push the current branch to the git remote before deploying
  --skip-fetch           Pass --skip-fetch to server-side deploy-ref.sh
  --allow-server-dirty   Pass --allow-dirty to server-side deploy-ref.sh
  --allow-local-dirty    Allow ref deploy even with uncommitted local changes
  --allow-dirty          Alias for both --allow-local-dirty and --allow-server-dirty
  --no-local-check       Skip local dirty/upstream checks before ref deploy
  --sync                 Rsync the local working tree, then run remote deploy.sh directly
  --sync-delete          With --sync, delete remote files missing locally (honors excludes)
  --ssh-option <option>  Add one raw option to ssh, for example "-p 2222"
  --dry-run              Show/resolve the deploy without applying it
  -h, --help             Show this help text

Deploy args:
  --php --frontend --db --docs --openapi are passed through to deploy.sh.
  Put any future deploy.sh args after "--" so this wrapper does not parse them.

Notes:
  - Ref mode deploys committed/pushed code. Uncommitted local edits are not included.
  - Sync mode is intentionally explicit because it can make the server checkout dirty.
  - This wrapper never runs npm build locally; the server runs ./deploy.sh.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

warn() {
  echo "Warning: $*" >&2
}

quote_args() {
  local arg
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
}

remote_shell_quote() {
  printf '%q' "$1"
}

dirty_worktree() {
  ! git diff --quiet --ignore-submodules HEAD -- ||
    ! git diff --cached --quiet --ignore-submodules -- ||
    [ -n "$(git ls-files --others --exclude-standard)" ]
}

current_branch() {
  git symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      DEPLOY_ARGS+=("$@")
      break
      ;;
    --host)
      [ $# -ge 2 ] || die "--host requires a value"
      REMOTE_HOST="$2"
      shift 2
      ;;
    --user)
      [ $# -ge 2 ] || die "--user requires a value"
      REMOTE_USER="$2"
      shift 2
      ;;
    --target)
      [ $# -ge 2 ] || die "--target requires a value"
      REMOTE_TARGET="$2"
      shift 2
      ;;
    --dir)
      [ $# -ge 2 ] || die "--dir requires a value"
      REMOTE_DIR="$2"
      shift 2
      ;;
    --remote)
      [ $# -ge 2 ] || die "--remote requires a value"
      GIT_REMOTE="$2"
      shift 2
      ;;
    --ref)
      [ $# -ge 2 ] || die "--ref requires a value"
      REF="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    --skip-fetch)
      DEPLOY_REF_ARGS+=("--skip-fetch")
      shift
      ;;
    --allow-server-dirty)
      DEPLOY_REF_ARGS+=("--allow-dirty")
      shift
      ;;
    --allow-local-dirty)
      ALLOW_LOCAL_DIRTY=true
      shift
      ;;
    --allow-dirty)
      ALLOW_LOCAL_DIRTY=true
      DEPLOY_REF_ARGS+=("--allow-dirty")
      shift
      ;;
    --no-local-check)
      LOCAL_CHECK=false
      shift
      ;;
    --sync)
      MODE="sync"
      shift
      ;;
    --sync-delete)
      SYNC_DELETE=true
      shift
      ;;
    --ssh-option)
      [ $# -ge 2 ] || die "--ssh-option requires a value"
      SSH_ARGS+=("$2")
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      DEPLOY_REF_ARGS+=("--dry-run")
      shift
      ;;
    --php|--frontend|--db|--docs|--openapi)
      DEPLOY_ARGS+=("$1")
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      die "unknown option: $1 (put deploy.sh-only args after --)"
      ;;
    *)
      die "unexpected argument: $1 (put deploy.sh args after --)"
      ;;
  esac
done

[ -n "$REMOTE_DIR" ] || REMOTE_DIR="/home/${REMOTE_USER}/Github/Parthenon"
[ -n "$REMOTE_TARGET" ] || REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

cd "$SCRIPT_DIR"

if [ "$MODE" = "ref" ]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git work tree"

  DEFAULTED_REF=false
  BRANCH="$(current_branch)"
  if [ -z "$REF" ]; then
    if [ -n "$BRANCH" ]; then
      REF="$BRANCH"
      DEFAULTED_REF=true
    else
      REF="$(git rev-parse --verify HEAD)"
      DEFAULTED_REF=true
    fi
  fi

  if $PUSH; then
    [ -n "$BRANCH" ] || die "--push requires a checked-out local branch"
    [ "$REF" = "$BRANCH" ] || die "--push only supports the current branch; use --ref $BRANCH or omit --ref"
    if $DRY_RUN; then
      echo "Would run: git push $GIT_REMOTE $BRANCH"
    else
      git push "$GIT_REMOTE" "$BRANCH"
    fi
  fi

  if $LOCAL_CHECK && $DEFAULTED_REF; then
    if dirty_worktree && ! $ALLOW_LOCAL_DIRTY; then
      git status --short >&2
      die "local changes are not included in ref deploys; commit/push them, use --sync, or add --allow-local-dirty"
    fi

    if [ -n "$BRANCH" ] && ! $PUSH; then
      UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name "${BRANCH}@{u}" 2>/dev/null || true)"
      [ -n "$UPSTREAM" ] || die "current branch has no upstream; use --push, --ref, or --no-local-check"

      git fetch --quiet "$GIT_REMOTE"
      LOCAL_SHA="$(git rev-parse --verify "$BRANCH")"
      UPSTREAM_SHA="$(git rev-parse --verify "$UPSTREAM")"
      if [ "$LOCAL_SHA" != "$UPSTREAM_SHA" ]; then
        die "local $BRANCH ($LOCAL_SHA) differs from $UPSTREAM ($UPSTREAM_SHA); push/pull first, use --push, or use --no-local-check"
      fi
    fi
  fi

  REMOTE_CMD="cd $(remote_shell_quote "$REMOTE_DIR") && { if [ ! -x ./deploy-ref.sh ]; then echo 'Error: deploy-ref.sh not found or not executable' >&2; exit 1; fi; ./deploy-ref.sh --remote $(remote_shell_quote "$GIT_REMOTE")$(quote_args "${DEPLOY_REF_ARGS[@]}") $(remote_shell_quote "$REF")"
  if [ "${#DEPLOY_ARGS[@]}" -gt 0 ]; then
    REMOTE_CMD+=" --$(quote_args "${DEPLOY_ARGS[@]}")"
  fi
  REMOTE_CMD+="; }"

  echo "==> Parthenon remote deploy (ref mode)"
  echo "    SSH target: $REMOTE_TARGET"
  echo "    Remote dir: $REMOTE_DIR"
  echo "    Git ref:    $REF"
  echo "    Deploy:     ./deploy.sh ${DEPLOY_ARGS[*]:-(default)}"
  echo ""

  ssh "${SSH_ARGS[@]}" "$REMOTE_TARGET" "$REMOTE_CMD"
  exit $?
fi

if [ "$MODE" = "sync" ]; then
  command -v rsync >/dev/null 2>&1 || die "rsync is required for --sync mode"

  RSYNC_ARGS=(
    -az
    --human-readable
    --itemize-changes
    --filter=":- .gitignore"
    --exclude=".git/"
    --exclude=".env"
    --exclude=".env.local"
    --exclude="*.env.local"
    --exclude="backend/.env"
    --exclude="frontend/.env.local"
    --exclude=".claudeapikey"
    --exclude=".resendapikey"
    --exclude=".secrets"
  )

  if $SYNC_DELETE; then
    RSYNC_ARGS+=("--delete")
  fi
  if $DRY_RUN; then
    RSYNC_ARGS+=("--dry-run")
  fi

  echo "==> Parthenon remote deploy (sync mode)"
  echo "    SSH target: $REMOTE_TARGET"
  echo "    Remote dir: $REMOTE_DIR"
  echo "    Deploy:     ./deploy.sh ${DEPLOY_ARGS[*]:-(default)}"
  if ! $SYNC_DELETE; then
    warn "--sync-delete not set; removed local files will remain on the server"
  fi
  echo ""

  if ! $DRY_RUN; then
    ssh "${SSH_ARGS[@]}" "$REMOTE_TARGET" "mkdir -p $(remote_shell_quote "$REMOTE_DIR")"
  fi
  rsync "${RSYNC_ARGS[@]}" "$SCRIPT_DIR"/ "$REMOTE_TARGET:$REMOTE_DIR"/

  REMOTE_CMD="cd $(remote_shell_quote "$REMOTE_DIR") && { if [ ! -f ./deploy.sh ]; then echo 'Error: deploy.sh not found after sync' >&2; exit 1; fi; chmod +x ./deploy.sh 2>/dev/null || true; ./deploy.sh$(quote_args "${DEPLOY_ARGS[@]}"); }"

  if $DRY_RUN; then
    echo ""
    echo "Dry run only. Would run remotely:"
    echo "$REMOTE_CMD"
    exit 0
  fi

  echo ""
  ssh "${SSH_ARGS[@]}" "$REMOTE_TARGET" "$REMOTE_CMD"
  exit $?
fi

die "unknown mode: $MODE"
