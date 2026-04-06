#!/usr/bin/env bash
# pg-wal-retention.sh — Purge archived WAL segments older than the latest base backup.
#
# Finds the most recent EXISTING base backup directory (not just a symlink),
# then deletes all archived WAL segments older than that backup (with 1h safety margin).
#
# Falls back to age-based cleanup (default 3 days) if no base backup exists,
# so WAL never accumulates unbounded.
#
# Usage:
#   ./scripts/pg-wal-retention.sh              # dry-run (default)
#   ./scripts/pg-wal-retention.sh --purge      # actually delete
#
# Cron (daily at 4:00am):
#   0 4 * * * /home/smudoshi/Github/Parthenon/scripts/pg-wal-retention.sh --purge >> /var/log/pg-wal-retention.log 2>&1

set -euo pipefail

ARCHIVE_DIR="${PG_WAL_ARCHIVE_DIR:-/mnt/md0/postgres-backups/wal}"
BACKUP_BASE="${PG_BACKUP_DIR:-/mnt/md0/postgres-backups/base}"
FALLBACK_DAYS="${PG_WAL_FALLBACK_DAYS:-3}"
DRY_RUN=true

if [ "${1:-}" = "--purge" ]; then
  DRY_RUN=false
fi

# Find the most recent EXISTING base backup directory.
# Don't trust the 'latest' symlink — it may be dangling if prune ran first.
LATEST_BACKUP=""
while IFS= read -r dir; do
  if [ -d "$dir" ]; then
    LATEST_BACKUP="$dir"
    break
  fi
done < <(find "$BACKUP_BASE" -mindepth 1 -maxdepth 1 -type d -name 'base-*' \
  -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}')

REF_FILE=$(mktemp)
trap 'rm -f "$REF_FILE"' EXIT

if [ -n "$LATEST_BACKUP" ]; then
  BACKUP_NAME="$(basename "$LATEST_BACKUP")"
  BACKUP_MTIME=$(stat -c '%Y' "$LATEST_BACKUP")
  SAFE_EPOCH=$((BACKUP_MTIME - 3600))
  touch -d "@$SAFE_EPOCH" "$REF_FILE"
  echo "$(date -Iseconds) Using base backup: $BACKUP_NAME (cutoff: 1h before its mtime)"
else
  # No base backup exists — fall back to age-based cleanup so WAL can't grow forever
  echo "$(date -Iseconds) WARNING: No base backup found in $BACKUP_BASE"
  echo "$(date -Iseconds) Falling back to age-based cleanup: delete WAL older than ${FALLBACK_DAYS} days"
  touch -d "${FALLBACK_DAYS} days ago" "$REF_FILE"
fi

TOTAL_SEGMENTS=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' 2>/dev/null | wc -l)

if $DRY_RUN; then
  TO_DELETE=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" 2>/dev/null | wc -l)
  BYTES=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -printf '%s\n' 2>/dev/null | awk '{s+=$1}END{print s+0}')
  GB=$((BYTES / 1073741824))
  echo "$(date -Iseconds) DRY RUN: Would delete $TO_DELETE of $TOTAL_SEGMENTS segments (~${GB}GB)"
  echo "$(date -Iseconds) Run with --purge to execute"
else
  TO_DELETE=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -delete -printf '.' | wc -c)
  REMAINING=$((TOTAL_SEGMENTS - TO_DELETE))
  echo "$(date -Iseconds) Purged $TO_DELETE segments. Remaining: ~$REMAINING"
  echo "$(date -Iseconds) Disk: $(df -h "$ARCHIVE_DIR" | tail -1 | awk '{print $4 " free (" $5 " used)"}')"
fi
