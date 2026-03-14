#!/usr/bin/env bash
# backup-app-db.sh — Backup the app schema from the host PostgreSQL
#
# Backs up the 'app' schema from the ohdsi database on the host PostgreSQL.
# This is the source of truth for studies, cohorts, concept sets, analyses,
# users, and all application data.
#
# Usage:
#   ./scripts/backup-app-db.sh               # Backup to backups/
#   ./scripts/backup-app-db.sh /path/to/dir  # Custom backup directory
#
# Intended to run via cron:
#   0 */6 * * * /home/smudoshi/Github/Parthenon/scripts/backup-app-db.sh

set -euo pipefail

BACKUP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/app-schema-${TIMESTAMP}.sql.gz"

# Database connection — use local socket (no password needed)
DB_NAME="${DB_NAME:-ohdsi}"
DB_USER="${DB_USER:-smudoshi}"

# Keep last N backups
KEEP_COUNT=20

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting app schema backup..."

# Dump only the app schema (studies, cohorts, concept sets, analyses, users, etc.)
pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=app \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup saved: ${BACKUP_FILE} (${SIZE})"

# Prune old backups, keep last N
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/app-schema-*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$KEEP_COUNT" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - KEEP_COUNT))
  ls -1t "${BACKUP_DIR}"/app-schema-*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
  echo "[$(date)] Pruned ${REMOVE_COUNT} old backups (keeping ${KEEP_COUNT})"
fi

echo "[$(date)] Done."
