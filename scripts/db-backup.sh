#!/usr/bin/env bash
# db-backup.sh — Dump the Docker Postgres (parthenon) database to a timestamped file
#
# Usage:
#   ./scripts/db-backup.sh           # manual run
#   0 2 * * * /path/to/scripts/db-backup.sh   # cron (daily at 2am)
#
# Backups are stored in backups/ with a latest.sql symlink.
# Keeps the last 30 daily backups; older ones are auto-deleted.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="parthenon-${TIMESTAMP}.sql"
KEEP_COUNT=30

# Load DB password from backend/.env
DB_PASSWORD=""
if [ -f "$PROJECT_DIR/backend/.env" ]; then
  DB_PASSWORD="$(grep '^DB_PASSWORD=' "$PROJECT_DIR/backend/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: Could not read DB_PASSWORD from backend/.env"
  exit 1
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "==> Parthenon DB Backup"
echo "    Target: $BACKUP_DIR/$BACKUP_FILE"

# Verify postgres container is running
if ! docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --status running --format '{{.Name}}' 2>/dev/null | grep -q postgres; then
  echo "ERROR: Postgres container is not running. Start it with: docker compose up -d postgres"
  exit 1
fi

# Run pg_dump inside the container
if docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U parthenon -d parthenon --clean --if-exists \
  > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then

  # Verify the dump is not empty
  if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty — dump may have failed"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
  fi

  SIZE="$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)"
  echo "    Size: $SIZE"

  # Update latest symlink
  ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.sql"
  echo "    Symlink: backups/latest.sql -> $BACKUP_FILE"

  # Prune old backups (keep most recent $KEEP_COUNT)
  PRUNED=0
  while IFS= read -r old_backup; do
    rm -f "$old_backup"
    PRUNED=$((PRUNED + 1))
  done < <(ls -1t "$BACKUP_DIR"/parthenon-*.sql 2>/dev/null | tail -n +$((KEEP_COUNT + 1)))

  if [ "$PRUNED" -gt 0 ]; then
    echo "    Pruned $PRUNED old backup(s) (keeping last $KEEP_COUNT)"
  fi

  echo "==> Backup complete."
else
  echo "ERROR: pg_dump failed"
  rm -f "$BACKUP_DIR/$BACKUP_FILE"
  exit 1
fi
