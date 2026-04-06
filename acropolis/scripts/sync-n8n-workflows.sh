#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW_DIR="$ROOT_DIR/acropolis/config/n8n/workflows"
CONTAINER="${N8N_CONTAINER:-acropolis-n8n}"
MOUNTED_WORKFLOW_DIR="${N8N_MOUNTED_WORKFLOW_DIR:-/home/node/workflows}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "container '$CONTAINER' is not running" >&2
  exit 1
fi

mapfile -t workflow_files < <(find "$WORKFLOW_DIR" -maxdepth 1 -type f -name '*.json' | sort)

if [ "${#workflow_files[@]}" -eq 0 ]; then
  echo "no workflow JSON files found under $WORKFLOW_DIR" >&2
  exit 1
fi

echo "Importing ${#workflow_files[@]} workflow definition(s) into $CONTAINER..."

for workflow_file in "${workflow_files[@]}"; do
  workflow_name="$(basename "$workflow_file")"
  echo "  - import $workflow_name"
  docker exec "$CONTAINER" n8n import:workflow --input="$MOUNTED_WORKFLOW_DIR/$workflow_name" >/dev/null
done

python3 - "$WORKFLOW_DIR" <<'PY' | while IFS='|' read -r workflow_id active; do
import json
import pathlib
import sys

workflow_dir = pathlib.Path(sys.argv[1])

for path in sorted(workflow_dir.glob("*.json")):
    with path.open() as handle:
        payload = json.load(handle)
    workflow_id = payload.get("id")
    if not workflow_id:
        continue
    active = bool(payload.get("active"))
    print(f"{workflow_id}|{'true' if active else 'false'}")
PY
  if [ "$active" = "true" ]; then
    echo "  - publish $workflow_id"
    docker exec "$CONTAINER" n8n publish:workflow --id="$workflow_id" >/dev/null
  else
    echo "  - unpublish $workflow_id"
    docker exec "$CONTAINER" n8n unpublish:workflow --id="$workflow_id" >/dev/null
  fi
done

echo "Restarting $CONTAINER to re-register cron triggers..."
docker restart "$CONTAINER" >/dev/null

echo "Active workflows after sync:"
docker exec "$CONTAINER" n8n list:workflow
