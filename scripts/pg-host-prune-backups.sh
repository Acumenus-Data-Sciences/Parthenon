#!/usr/bin/env bash
# Prune host PostgreSQL base backups and WAL archives using conservative defaults.

set -euo pipefail

BASE_ROOT="${PG_BASEBACKUP_ROOT:-/mnt/md0/postgres-backups/base}"
WAL_ROOT="${PG_WAL_ARCHIVE_DIR:-/mnt/md0/postgres-backups/wal}"
BASE_KEEP_COUNT="${PG_BASEBACKUP_KEEP_COUNT:-2}"
WAL_KEEP_DAYS="${PG_WAL_KEEP_DAYS:-8}"

echo "==> Pruning host PostgreSQL backups"

base_pruned=0
while IFS= read -r old_dir; do
  rm -rf "$old_dir"
  base_pruned=$((base_pruned + 1))
done < <(find "$BASE_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'base-*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk -v keep="$BASE_KEEP_COUNT" 'NR > keep { print $2 }')

wal_pruned=0
while IFS= read -r wal_file; do
  rm -f "$wal_file"
  wal_pruned=$((wal_pruned + 1))
done < <(find "$WAL_ROOT" -type f -mtime +"$WAL_KEEP_DAYS" 2>/dev/null)

echo "    Base backups pruned: $base_pruned"
echo "    WAL files pruned:    $wal_pruned"
