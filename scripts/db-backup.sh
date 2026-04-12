#!/usr/bin/env bash
# db-backup.sh — Dump the parthenon database
#
# Backs up ALL critical schemas from the parthenon database.
#
# Schemas backed up:
#   app          — Application state (users, sources, cohorts, studies, analyses, executions, etc.)
#   irsf         — IRSF Natural History Study CDM data
#   irsf_results — IRSF Achilles/DQD characterization results
#   vocab        — Shared OHDSI vocabulary (standard + IRSF-NHS custom)
#   results      — Achilles results (future sources)
#   omop         — OMOP CDM (future Acumenus re-ETL)
#   public       — Orthanc DICOM index (resources, attachedfiles, maindicomtags)
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
BACKUP_FILE="parthenon-full-${TIMESTAMP}.sql"
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

# backend/.env uses container-side hostnames (host.docker.internal) so PHP can reach
# the host Postgres from inside Docker. When this backup script runs on the HOST shell
# those names don't resolve — rewrite to localhost. Allow override via BACKUP_PG_HOST.
if [ -n "${BACKUP_PG_HOST:-}" ]; then
  PG_HOST="$BACKUP_PG_HOST"
elif ! getent hosts "$PG_HOST" >/dev/null 2>&1; then
  case "$PG_HOST" in
    host.docker.internal|postgres|parthenon-postgres)
      echo "    Note: rewriting DB_HOST '$PG_HOST' -> 'localhost' (host-shell execution)"
      PG_HOST="localhost"
      ;;
  esac
fi

# The application role (parthenon_app) may lack SELECT on every schema we dump
# (e.g. app.enterprise_licenses granted only to smudoshi/claude_dev). Prefer a
# broader role for the backup. Order of preference:
#   1. BACKUP_PG_USER / BACKUP_PG_PASSWORD env overrides
#   2. claude_dev via ~/.pgpass (if present)
#   3. DB_USERNAME from backend/.env (original behavior)
if [ -n "${BACKUP_PG_USER:-}" ]; then
  PG_USER="$BACKUP_PG_USER"
  PG_PASSWORD="${BACKUP_PG_PASSWORD:-$PG_PASSWORD}"
  echo "    Note: using backup role '$PG_USER' (from BACKUP_PG_USER)"
elif [ -f "$HOME/.pgpass" ] && grep -qE "^[^#]*:[^:]*:[^:]*:claude_dev:" "$HOME/.pgpass" 2>/dev/null; then
  PG_USER="claude_dev"
  PG_PASSWORD=""   # libpq will pick it up from ~/.pgpass
  echo "    Note: using backup role 'claude_dev' (via ~/.pgpass) for full-schema read access"
fi

mkdir -p "$BACKUP_DIR"

echo "==> Parthenon DB Backup"
echo "    Host:    $PG_HOST:$PG_PORT / $PG_DB"
echo "    Schemas: app, irsf, irsf_results, vocab, results, omop, public (Orthanc)"
echo "    Target:  $BACKUP_DIR/$BACKUP_FILE"

# Dump critical schemas: app state + analysis results
if PGPASSWORD="$PG_PASSWORD" pg_dump \
  -h "$PG_HOST" \
  -p "$PG_PORT" \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --schema=app \
  --schema=irsf \
  --schema=irsf_results \
  --schema=vocab \
  --schema=results \
  --schema=omop \
  --schema=public \
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

  # Quick integrity counts
  COUNTS="$(PGPASSWORD="$PG_PASSWORD" psql \
    -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "
    SELECT json_build_object(
      'users', (SELECT COUNT(*) FROM app.users),
      'sources', (SELECT COUNT(*) FROM app.sources),
      'cohorts', (SELECT COUNT(*) FROM app.cohort_definitions),
      'characterizations', (SELECT COUNT(*) FROM app.characterizations),
      'executions', (SELECT COUNT(*) FROM app.analysis_executions),
      'irsf_persons', (SELECT COUNT(*) FROM irsf.person),
      'vocab_concepts', (SELECT COUNT(*) FROM vocab.concept),
      'cohort_records', (SELECT COUNT(*) FROM results.cohort)
    );
  " 2>/dev/null || echo '{"error":"query failed"}')"

  echo "    Size: $SIZE"
  echo "    Counts: $COUNTS"

  ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.sql"
  echo "    Symlink: backups/latest.sql -> $BACKUP_FILE"

  # Prune old backups (both old naming conventions)
  PRUNED=0
  while IFS= read -r old; do
    rm -f "$old"; PRUNED=$((PRUNED + 1))
  done < <(ls -1t "$BACKUP_DIR"/parthenon-full-*.sql "$BACKUP_DIR"/ohdsi-*.sql 2>/dev/null | grep -v latest | tail -n +$((KEEP_COUNT + 1)))
  [ "$PRUNED" -gt 0 ] && echo "    Pruned $PRUNED old backup(s) (keeping last $KEEP_COUNT)"

  echo "==> Backup complete."
else
  echo "ERROR: pg_dump failed — check credentials and connectivity to $PG_HOST"
  rm -f "$BACKUP_DIR/$BACKUP_FILE"
  exit 1
fi
