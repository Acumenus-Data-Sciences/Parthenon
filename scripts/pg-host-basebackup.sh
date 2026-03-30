#!/usr/bin/env bash
# Create a compressed physical base backup of the host PostgreSQL cluster.

set -euo pipefail

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${PG_BASEBACKUP_ROOT:-/mnt/md0/postgres-backups/base}"
TARGET_DIR="$BACKUP_ROOT/base-$TIMESTAMP"
LATEST_LINK="$BACKUP_ROOT/latest"
PG_URL="${PG_SUPERUSER_URL:-postgresql://smudoshi@localhost:5432/postgres}"
WAL_METHOD="${PG_BASEBACKUP_WAL_METHOD:-}"

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
