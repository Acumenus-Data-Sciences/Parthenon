#!/usr/bin/env bash
# db-backup.sh — Dump the PRODUCTION database (pgsql.acumenus.net / ohdsi)
#
# Backs up the app schema from the REAL production PostgreSQL 17 instance.
# NOT the Docker postgres container, which holds no production data.
#
# Usage:
#   ./scripts/db-backup.sh           # manual run
#   17 3 * * * /path/to/scripts/db-backup.sh   # cron (daily at 3:17am)
#
# Backups stored in backups/ with a latest.sql symlink.
# Keeps the last 30 daily backups.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="ohdsi-app-${TIMESTAMP}.sql"
KEEP_COUNT=30

# Production DB credentials from backend/.env
ENV_FILE="$PROJECT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: backend/.env not found"
  exit 1
fi

PG_HOST="$(     grep '^DB_HOST='     "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
PG_PORT="$(     grep '^DB_PORT='     "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
PG_DB="$(       grep '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
PG_USER="$(     grep '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
PG_PASSWORD="$( grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
PG_PORT="${PG_PORT:-5432}"

if [ -z "$PG_HOST" ] || [ -z "$PG_DB" ] || [ -z "$PG_USER" ] || [ -z "$PG_PASSWORD" ]; then
  echo "ERROR: Missing DB credentials in backend/.env (need DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD)"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> Parthenon Production DB Backup"
echo "    Host:   $PG_HOST:$PG_PORT / $PG_DB"
echo "    Schema: app (users, sources, cohorts, studies, roles, etc.)"
echo "    Target: $BACKUP_DIR/$BACKUP_FILE"

# Dump only the app schema — application state, not the massive clinical/vocab data
if PGPASSWORD="$PG_PASSWORD" pg_dump \
  -h "$PG_HOST" \
  -p "$PG_PORT" \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --schema=app \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  > "$BACKUP_DIR/$BACKUP_FILE"; then

  if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
  fi

  SIZE="$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)"
  USER_ROWS="$(PGPASSWORD="$PG_PASSWORD" psql \
    -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
    -tAc "SELECT COUNT(*) FROM app.users WHERE email NOT LIKE '%@example.%'" 2>/dev/null || echo "?")"

  echo "    Size: $SIZE  |  Real users in DB: $USER_ROWS"

  ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.sql"
  echo "    Symlink: backups/latest.sql -> $BACKUP_FILE"

  # Prune old backups
  PRUNED=0
  while IFS= read -r old; do
    rm -f "$old"; PRUNED=$((PRUNED + 1))
  done < <(ls -1t "$BACKUP_DIR"/ohdsi-app-*.sql 2>/dev/null | tail -n +$((KEEP_COUNT + 1)))
  [ "$PRUNED" -gt 0 ] && echo "    Pruned $PRUNED old backup(s) (keeping last $KEEP_COUNT)"

  echo "==> Backup complete."
else
  echo "ERROR: pg_dump failed — check credentials and connectivity to $PG_HOST"
  rm -f "$BACKUP_DIR/$BACKUP_FILE"
  exit 1
fi
