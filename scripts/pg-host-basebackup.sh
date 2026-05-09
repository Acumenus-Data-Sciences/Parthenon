#!/usr/bin/env bash
# Create a compressed physical base backup of the host PostgreSQL cluster.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${PG_BASEBACKUP_ROOT:-/mnt/md0/postgres-backups/base}"
TARGET_DIR="$BACKUP_ROOT/base-$TIMESTAMP"
LATEST_LINK="$BACKUP_ROOT/latest"
PG_URL="${PG_SUPERUSER_URL:-postgresql://smudoshi@localhost:5432/postgres}"
WAL_METHOD="${PG_BASEBACKUP_WAL_METHOD:-}"
MIN_FREE_GB="${PG_BASEBACKUP_MIN_FREE_GB:-300}"
MIN_POST_BACKUP_FREE_GB="${PG_BASEBACKUP_MIN_POST_FREE_GB:-100}"
RUN_PRUNE="${PG_BASEBACKUP_RUN_PRUNE:-1}"
PRUNE_SCRIPT="${PG_BASEBACKUP_PRUNE_SCRIPT:-$SCRIPT_DIR/pg-host-prune-backups.sh}"

mkdir -p "$BACKUP_ROOT"

available_kb="$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 {print $4}')"
min_free_kb=$((MIN_FREE_GB * 1024 * 1024))

if [ "$available_kb" -lt "$min_free_kb" ]; then
  available_gb=$((available_kb / 1024 / 1024))
  echo "ERROR: $BACKUP_ROOT has ${available_gb}GB free; refusing base backup below ${MIN_FREE_GB}GB threshold" >&2
  echo "       Run $PRUNE_SCRIPT or free space, then retry. Override with PG_BASEBACKUP_MIN_FREE_GB if needed." >&2
  exit 1
fi

latest_target=""
if [ -e "$LATEST_LINK" ]; then
  latest_target="$(readlink -f "$LATEST_LINK" || true)"
fi

if [ -z "$latest_target" ]; then
  latest_target="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'base-*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk 'NR == 1 {print $2}')"
fi

if [ -n "$latest_target" ] && [ -d "$latest_target" ]; then
  latest_backup_kb="$(du -sk "$latest_target" | awk '{print $1}')"
  min_post_kb=$((MIN_POST_BACKUP_FREE_GB * 1024 * 1024))
  projected_free_kb=$((available_kb - latest_backup_kb))

  if [ "$projected_free_kb" -lt "$min_post_kb" ]; then
    available_gb=$((available_kb / 1024 / 1024))
    latest_gb=$((latest_backup_kb / 1024 / 1024))
    projected_gb=$((projected_free_kb / 1024 / 1024))
    echo "ERROR: $BACKUP_ROOT has ${available_gb}GB free and latest backup is about ${latest_gb}GB." >&2
    echo "       Refusing because projected free space during the next backup is ${projected_gb}GB, below ${MIN_POST_BACKUP_FREE_GB}GB." >&2
    echo "       Free space or override with PG_BASEBACKUP_MIN_POST_FREE_GB if this run is intentional." >&2
    exit 1
  fi
fi

mkdir -p "$TARGET_DIR"

if [ -z "$WAL_METHOD" ]; then
  archive_mode="$(psql "$PG_URL" -P pager=off -Atqc "show archive_mode;" 2>/dev/null || echo off)"
  if [ "$archive_mode" = "on" ]; then
    WAL_METHOD="none"
  else
    WAL_METHOD="stream"
  fi
fi

echo "==> Host PostgreSQL base backup"
echo "    Target: $TARGET_DIR"
echo "    WAL:    $WAL_METHOD"

pg_basebackup \
  -d "$PG_URL" \
  -D "$TARGET_DIR" \
  -Ft \
  -z \
  -X "$WAL_METHOD" \
  -c fast \
  -P

cat > "$TARGET_DIR/backup-metadata.txt" <<EOF
timestamp=$TIMESTAMP
pg_url=$PG_URL
hostname=$(hostname -f 2>/dev/null || hostname)
base_dir=$TARGET_DIR
wal_method=$WAL_METHOD
EOF

ln -sfn "$TARGET_DIR" "$LATEST_LINK"

echo "==> Base backup complete"

if [ "$RUN_PRUNE" = "1" ] && [ -x "$PRUNE_SCRIPT" ]; then
  echo "==> Pruning old base/WAL backups after successful base backup"
  PG_BASEBACKUP_ROOT="$BACKUP_ROOT" "$PRUNE_SCRIPT"
fi
