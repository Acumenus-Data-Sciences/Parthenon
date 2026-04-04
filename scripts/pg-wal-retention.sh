#!/usr/bin/env bash
# pg-wal-retention.sh — Purge archived WAL segments older than the latest base backup.
#
# Finds the oldest WAL needed for PITR from the most recent pg_basebackup,
# then deletes all archived segments before that point.
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
DRY_RUN=true

if [ "${1:-}" = "--purge" ]; then
  DRY_RUN=false
fi

# Find the latest base backup directory
LATEST_LINK="$BACKUP_BASE/latest"
if [ ! -L "$LATEST_LINK" ] && [ ! -d "$LATEST_LINK" ]; then
  echo "$(date -Iseconds) ERROR: No latest base backup found at $LATEST_LINK" >&2
  exit 1
fi

LATEST_BACKUP="$(readlink -f "$LATEST_LINK")"
BACKUP_NAME="$(basename "$LATEST_BACKUP")"

# Extract timestamp from backup directory name (base-YYYYMMDD-HHMMSS)
BACKUP_TS="$(echo "$BACKUP_NAME" | sed -n 's/^base-\([0-9]\{8\}\)-\([0-9]\{6\}\)$/\1\2/p')"
if [ -z "$BACKUP_TS" ]; then
  echo "$(date -Iseconds) ERROR: Cannot parse timestamp from backup name: $BACKUP_NAME" >&2
  exit 1
fi

# Format for display
DISPLAY_TS="${BACKUP_TS:0:4}-${BACKUP_TS:4:2}-${BACKUP_TS:6:2} ${BACKUP_TS:8:2}:${BACKUP_TS:10:2}:${BACKUP_TS:12:2}"
echo "$(date -Iseconds) Latest base backup: $BACKUP_NAME ($DISPLAY_TS)"

# Create a reference timestamp file 1 hour before the backup started (safety margin)
REF_FILE=$(mktemp)
trap 'rm -f "$REF_FILE"' EXIT
# Set reference file to 1 hour before backup start
SAFE_DATE="${BACKUP_TS:0:4}-${BACKUP_TS:4:2}-${BACKUP_TS:6:2} ${BACKUP_TS:8:2}:${BACKUP_TS:10:2}:${BACKUP_TS:12:2} -1 hour"
touch -d "$SAFE_DATE" "$REF_FILE"

TOTAL_SEGMENTS=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' | wc -l)

if $DRY_RUN; then
  # Count files older than reference
  TO_DELETE=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" | wc -l)
  BYTES=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -printf '%s\n' | awk '{s+=$1}END{print s+0}')
  GB=$((BYTES / 1073741824))
  echo "$(date -Iseconds) DRY RUN: Would delete $TO_DELETE of $TOTAL_SEGMENTS segments (~${GB}GB)"
  echo "$(date -Iseconds) Run with --purge to execute"
else
  # Delete and count
  TO_DELETE=$(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -delete -printf '.' | wc -c)
  REMAINING=$((TOTAL_SEGMENTS - TO_DELETE))
  echo "$(date -Iseconds) Purged $TO_DELETE segments. Remaining: ~$REMAINING"
  echo "$(date -Iseconds) Disk: $(df -h "$ARCHIVE_DIR" | tail -1 | awk '{print $4 " free (" $5 " used)"}')"
fi
