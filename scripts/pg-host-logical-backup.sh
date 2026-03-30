#!/usr/bin/env bash
# Create compressed logical dumps for small business-critical schemas on host PostgreSQL.

set -euo pipefail

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${PG_LOGICAL_BACKUP_ROOT:-/mnt/md0/postgres-backups/logical}"
PG_URL="${PG_SUPERUSER_URL:-postgresql://smudoshi@localhost:5432/parthenon}"
SCHEMAS="${PG_LOGICAL_SCHEMAS:-app}"
KEEP_COUNT="${PG_LOGICAL_KEEP_COUNT:-14}"

mkdir -p "$BACKUP_ROOT"

echo "==> Host PostgreSQL logical backup"
echo "    Schemas: $SCHEMAS"

IFS=',' read -r -a schema_list <<< "$SCHEMAS"

for schema in "${schema_list[@]}"; do
  schema="$(echo "$schema" | xargs)"
  [ -n "$schema" ] || continue

  out_file="$BACKUP_ROOT/${schema}-${TIMESTAMP}.sql.gz"
  pg_dump \
    -d "$PG_URL" \
    --schema="$schema" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    | gzip -9 > "$out_file"

  ln -sfn "$out_file" "$BACKUP_ROOT/latest-${schema}.sql.gz"
  echo "    Wrote $out_file"
done

pruned=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  pruned=$((pruned + 1))
done < <(ls -1t "$BACKUP_ROOT"/*.sql.gz 2>/dev/null | grep -v '/latest-' | tail -n +$((KEEP_COUNT + 1)))

[ "$pruned" -gt 0 ] && echo "    Pruned $pruned old logical backup(s)"

echo "==> Logical backup complete"
