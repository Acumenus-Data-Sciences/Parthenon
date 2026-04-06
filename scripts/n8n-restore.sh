#!/usr/bin/env bash
# n8n-restore.sh — Restore n8n state from a backup archive.
#
# Usage:
#   ./scripts/n8n-restore.sh
#   ./scripts/n8n-restore.sh backups/n8n/n8n-state-20260405-161630.tar.gz
#   ./scripts/n8n-restore.sh --yes backups/n8n/latest.tar.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACROPOLIS_DIR="$PROJECT_DIR/acropolis"
ENV_FILE="$ACROPOLIS_DIR/.env"
DEFAULT_BACKUP="$PROJECT_DIR/backups/n8n/latest.tar.gz"
COMPOSE_FILE="$ACROPOLIS_DIR/docker-compose.yml"
CONTAINER_NAME="${N8N_CONTAINER:-acropolis-n8n}"
ASSUME_YES=false
BACKUP_FILE=""

usage() {
  cat <<EOF
Usage:
  ./scripts/n8n-restore.sh [--yes] [backup-archive]

Defaults:
  backup-archive: $DEFAULT_BACKUP

Behavior:
  - Creates a pre-restore snapshot in backups/n8n/pre-restore/
  - Stops the n8n container
  - Replaces the host n8n data directory with the selected backup
  - Restarts n8n and verifies the SQLite database is readable
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes|-y)
      ASSUME_YES=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -n "$BACKUP_FILE" ]; then
        echo "ERROR: Unexpected extra argument: $1"
        usage
        exit 1
      fi
      BACKUP_FILE="$1"
      shift
      ;;
  esac
done

BACKUP_FILE="${BACKUP_FILE:-$DEFAULT_BACKUP}"
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$PROJECT_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  echo ""
  echo "Available backups:"
  ls -1t "$PROJECT_DIR"/backups/n8n/n8n-state-*.tar.gz 2>/dev/null | head -10 || echo "  (none)"
  exit 1
fi

N8N_DATA_DIR="${N8N_DATA_DIR:-}"
if [ -z "$N8N_DATA_DIR" ] && [ -f "$ENV_FILE" ]; then
  N8N_DATA_DIR="$(grep '^N8N_DATA_DIR=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" | tail -1)"
fi
N8N_DATA_DIR="${N8N_DATA_DIR:-/home/smudoshi/acropolis-n8n-data}"

if [ ! -d "$N8N_DATA_DIR" ]; then
  echo "ERROR: n8n data dir not found: $N8N_DATA_DIR"
  exit 1
fi

if ! tar -tzf "$BACKUP_FILE" ./database.sqlite >/dev/null 2>&1; then
  echo "ERROR: Backup archive does not contain ./database.sqlite"
  exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "==> n8n restore"
echo "    Backup: $BACKUP_FILE"
echo "    Size:   $SIZE"
echo "    Target: $N8N_DATA_DIR"
echo ""
echo "WARNING: This will replace the current n8n state on disk."
echo "         The current state will first be archived to backups/n8n/pre-restore/."
echo ""

if [ "$ASSUME_YES" != "true" ]; then
  read -r -p "Continue? (y/N) " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

mkdir -p "$PROJECT_DIR/backups/n8n/pre-restore"
echo "Creating pre-restore snapshot..."
N8N_BACKUP_DIR="$PROJECT_DIR/backups/n8n/pre-restore" "$PROJECT_DIR/scripts/n8n-backup.sh"

WAS_RUNNING=false
if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  WAS_RUNNING=true
  echo "Stopping $CONTAINER_NAME..."
  docker compose -f "$COMPOSE_FILE" stop n8n >/dev/null
fi

TMP_DIR="$(mktemp -d "$PROJECT_DIR/backups/n8n/.restore-XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Extracting backup..."
tar -C "$TMP_DIR" -xzf "$BACKUP_FILE"

if [ ! -f "$TMP_DIR/database.sqlite" ]; then
  echo "ERROR: Extracted backup is missing database.sqlite"
  exit 1
fi

echo "Replacing n8n state..."
rm -rf "$N8N_DATA_DIR"/*
rm -rf "$N8N_DATA_DIR"/.[!.]* "$N8N_DATA_DIR"/..?* 2>/dev/null || true
cp -a "$TMP_DIR"/. "$N8N_DATA_DIR"/
chown -R "$(id -u):$(id -g)" "$N8N_DATA_DIR"

echo "Verifying restored SQLite backup..."
python3 - "$N8N_DATA_DIR/database.sqlite" <<'PY'
import sqlite3
import sys

db = sqlite3.connect(sys.argv[1], timeout=30)
cur = db.cursor()
workflow_count = cur.execute("SELECT COUNT(*) FROM workflow_entity").fetchone()[0]
execution_count = cur.execute("SELECT COUNT(*) FROM execution_entity").fetchone()[0]
print(f"    Counts: workflows={workflow_count}, executions={execution_count}")
db.close()
PY

echo "Starting $CONTAINER_NAME..."
docker compose -f "$COMPOSE_FILE" up -d n8n >/dev/null

echo "Waiting for n8n to become healthy..."
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  if [[ "$status" == "running healthy" || "$status" == "running " ]]; then
    break
  fi
  sleep 2
done

FINAL_STATUS="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [[ "$FINAL_STATUS" != "running healthy" && "$FINAL_STATUS" != "running " ]]; then
  echo "ERROR: n8n did not return to a healthy running state."
  echo "       Container status: $FINAL_STATUS"
  exit 1
fi

echo "==> Restore complete."
