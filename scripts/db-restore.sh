#!/usr/bin/env bash
# db-restore.sh — Restore the Docker Postgres (parthenon) database from a backup
#
# Usage:
#   ./scripts/db-restore.sh                        # restore from backups/latest.sql
#   ./scripts/db-restore.sh backups/parthenon-20260313-020000.sql   # restore specific file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"

# Determine backup file
BACKUP_FILE="${1:-$BACKUP_DIR/latest.sql}"

# Resolve relative paths
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$PROJECT_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  echo ""
  echo "Available backups:"
  ls -1t "$BACKUP_DIR"/parthenon-*.sql 2>/dev/null | head -10 || echo "  (none)"
  exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "==> Parthenon DB Restore"
echo "    File: $BACKUP_FILE"
echo "    Size: $SIZE"
echo ""
echo "WARNING: This will DROP and recreate all tables in the 'parthenon' database."
echo "         All current data (users, roles, sources, cohort definitions) will be replaced."
echo ""
read -rp "Continue? (y/N) " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Load DB password from backend/.env
DB_PASSWORD=""
if [ -f "$PROJECT_DIR/backend/.env" ]; then
  DB_PASSWORD="$(grep '^DB_PASSWORD=' "$PROJECT_DIR/backend/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: Could not read DB_PASSWORD from backend/.env"
  exit 1
fi

# Verify postgres container is running
if ! docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --status running --format '{{.Name}}' 2>/dev/null | grep -q postgres; then
  echo "ERROR: Postgres container is not running. Start it with: docker compose up -d postgres"
  exit 1
fi

echo ""
echo "Restoring..."

if docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
  psql -U parthenon -d parthenon --quiet --set ON_ERROR_STOP=1 \
  < "$BACKUP_FILE" 2>&1; then
  echo ""
  echo "==> Restore complete."
else
  echo ""
  echo "ERROR: Restore failed. The database may be in a partial state."
  echo "       You can retry or run: docker compose exec php php artisan migrate --force"
  exit 1
fi
