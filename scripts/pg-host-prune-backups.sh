#!/usr/bin/env bash
# Prune host PostgreSQL base backups and WAL archives.
#
# Safety: Only prunes base backups when at least BASE_KEEP_COUNT+1 exist,
# ensuring there is always a valid backup for WAL retention to reference.
#
# WAL cleanup: Deletes archived segments whose mtime is older than the
# oldest *retained* base backup (with a 1-hour safety margin), so PITR
# is always possible back to the oldest kept backup.

set -euo pipefail

BASE_ROOT="${PG_BASEBACKUP_ROOT:-/mnt/md0/postgres-backups/base}"
WAL_ROOT="${PG_WAL_ARCHIVE_DIR:-/mnt/md0/postgres-backups/wal}"
BASE_KEEP_COUNT="${PG_BASEBACKUP_KEEP_COUNT:-2}"

echo "$(date -Iseconds) ==> Pruning host PostgreSQL backups"

# ── Base backup pruning ──────────────────────────────────────────────
# List base backup dirs sorted newest-first
mapfile -t ALL_BASES < <(
  find "$BASE_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'base-*' \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}'
)

TOTAL_BASES=${#ALL_BASES[@]}

if [ "$TOTAL_BASES" -le "$BASE_KEEP_COUNT" ]; then
  echo "$(date -Iseconds)     Only $TOTAL_BASES base backup(s) exist (keep=$BASE_KEEP_COUNT) — skipping prune"
else
  base_pruned=0
  for (( i=BASE_KEEP_COUNT; i<TOTAL_BASES; i++ )); do
    echo "$(date -Iseconds)     Removing: ${ALL_BASES[$i]}"
    rm -rf "${ALL_BASES[$i]}"
    base_pruned=$((base_pruned + 1))
  done
  echo "$(date -Iseconds)     Base backups pruned: $base_pruned (kept $BASE_KEEP_COUNT of $TOTAL_BASES)"
fi

# ── WAL pruning ──────────────────────────────────────────────────────
# Find the oldest retained base backup to determine WAL cutoff
OLDEST_KEPT=""
for (( i=0; i<TOTAL_BASES && i<BASE_KEEP_COUNT; i++ )); do
  OLDEST_KEPT="${ALL_BASES[$i]}"
done

if [ -z "$OLDEST_KEPT" ]; then
  echo "$(date -Iseconds)     No base backups exist — skipping WAL prune (unsafe without reference)"
  exit 0
fi

# Use the oldest kept backup's mtime as the WAL cutoff (with 1h safety margin)
REF_FILE=$(mktemp)
trap 'rm -f "$REF_FILE"' EXIT

BACKUP_MTIME=$(stat -c '%Y' "$OLDEST_KEPT")
SAFE_EPOCH=$((BACKUP_MTIME - 3600))
touch -d "@$SAFE_EPOCH" "$REF_FILE"

WAL_TOTAL=$(find "$WAL_ROOT" -maxdepth 1 -type f -name '0000*' 2>/dev/null | wc -l)
WAL_TO_DELETE=$(find "$WAL_ROOT" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" 2>/dev/null | wc -l)

if [ "$WAL_TO_DELETE" -eq 0 ]; then
  echo "$(date -Iseconds)     WAL: $WAL_TOTAL segments, none older than cutoff — nothing to prune"
else
  BYTES=$(find "$WAL_ROOT" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -printf '%s\n' 2>/dev/null | awk '{s+=$1}END{print s+0}')
  GB=$((BYTES / 1073741824))
  find "$WAL_ROOT" -maxdepth 1 -type f -name '0000*' ! -newer "$REF_FILE" -delete
  echo "$(date -Iseconds)     WAL pruned: $WAL_TO_DELETE of $WAL_TOTAL segments (~${GB}GB)"
fi

echo "$(date -Iseconds)     Disk: $(df -h "$WAL_ROOT" | tail -1 | awk '{print $4 " free (" $5 " used)"}')"
echo "$(date -Iseconds) ==> Prune complete"
