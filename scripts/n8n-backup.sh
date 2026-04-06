#!/usr/bin/env bash
# n8n-backup.sh — Back up n8n state from the host bind mount.
#
# Creates a compressed archive containing:
#   - a consistent SQLite backup of database.sqlite
#   - config
#   - nodes
#   - storage
#
# Usage:
#   ./scripts/n8n-backup.sh
#   5 3 * * * /path/to/scripts/n8n-backup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACROPOLIS_DIR="$PROJECT_DIR/acropolis"
ENV_FILE="$ACROPOLIS_DIR/.env"
BACKUP_DIR="${N8N_BACKUP_DIR:-$PROJECT_DIR/backups/n8n}"
KEEP_COUNT="${N8N_BACKUP_KEEP:-30}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="n8n-state-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"

N8N_DATA_DIR="${N8N_DATA_DIR:-}"
if [ -z "$N8N_DATA_DIR" ] && [ -f "$ENV_FILE" ]; then
  N8N_DATA_DIR="$(grep '^N8N_DATA_DIR=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" | tail -1)"
fi
N8N_DATA_DIR="${N8N_DATA_DIR:-/home/smudoshi/acropolis-n8n-data}"

if [ ! -d "$N8N_DATA_DIR" ]; then
  echo "ERROR: n8n data dir not found: $N8N_DATA_DIR"
  exit 1
fi

if [ ! -f "$N8N_DATA_DIR/database.sqlite" ]; then
  echo "ERROR: n8n database not found: $N8N_DATA_DIR/database.sqlite"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TMP_DIR="$(mktemp -d "$BACKUP_DIR/.n8n-backup-${TIMESTAMP}-XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> n8n backup"
echo "    Source: $N8N_DATA_DIR"
echo "    Target: $ARCHIVE_PATH"

python3 - "$N8N_DATA_DIR/database.sqlite" "$TMP_DIR/database.sqlite" <<'PY'
import sqlite3
import sys

source_path, target_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True, timeout=30)
target = sqlite3.connect(target_path, timeout=30)
try:
    source.backup(target)
finally:
    target.close()
    source.close()
PY

for entry in config nodes storage; do
  if [ -e "$N8N_DATA_DIR/$entry" ]; then
    cp -a "$N8N_DATA_DIR/$entry" "$TMP_DIR/$entry"
  fi
done

tar -C "$TMP_DIR" -czf "$ARCHIVE_PATH" .
chmod 600 "$ARCHIVE_PATH"

SIZE="$(du -h "$ARCHIVE_PATH" | cut -f1)"
COUNTS="$(python3 - "$TMP_DIR/database.sqlite" <<'PY'
import sqlite3
import sys

db = sqlite3.connect(sys.argv[1])
cur = db.cursor()
workflow_count = cur.execute("SELECT COUNT(*) FROM workflow_entity").fetchone()[0]
execution_count = cur.execute("SELECT COUNT(*) FROM execution_entity").fetchone()[0]
print(f'{{"workflows":{workflow_count},"executions":{execution_count}}}')
db.close()
PY
)"

ln -sfn "$ARCHIVE_NAME" "$BACKUP_DIR/latest.tar.gz"

PRUNED=0
while IFS= read -r old; do
  rm -f "$old"
  PRUNED=$((PRUNED + 1))
done < <(ls -1t "$BACKUP_DIR"/n8n-state-*.tar.gz 2>/dev/null | tail -n +$((KEEP_COUNT + 1)))

echo "    Size:   $SIZE"
echo "    Counts: $COUNTS"
echo "    Symlink: $BACKUP_DIR/latest.tar.gz -> $ARCHIVE_NAME"
[ "$PRUNED" -gt 0 ] && echo "    Pruned: $PRUNED old backup(s)"
echo "==> Backup complete."
