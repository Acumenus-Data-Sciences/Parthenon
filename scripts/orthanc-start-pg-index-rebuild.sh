#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${key:-}" || "$key" == \#* ]] && continue
    case "$key" in
      ORTHANC_*|DB_PASSWORD)
        export "$key=$value"
        ;;
    esac
  done < .env
fi

STAMP="${ORTHANC_PG_REBUILD_STAMP:-$(date +%Y%m%d-%H%M%S)}"
CONTAINER_NAME="${ORTHANC_PG_REBUILD_CONTAINER:-parthenon-orthanc-pg-rebuild}"
PORT="${ORTHANC_PG_REBUILD_PORT:-8045}"
SOURCE_PATH="${ORTHANC_PG_REBUILD_SOURCE:-${ORTHANC_DATA_PATH:-/mnt/md0/orthanc-data-clean-native-20260420-012411}}"
STORAGE_PATH="${ORTHANC_PG_REBUILD_STORAGE:-/mnt/md0/orthanc-data-pg-indexed-$STAMP}"
DB_NAME="${ORTHANC_PG_REBUILD_DATABASE:-orthanc_clean_index_${STAMP//-/_}}"
MEMORY_LIMIT="${ORTHANC_PG_REBUILD_MEMORY:-16g}"
IMPORT_WORKERS="${ORTHANC_PG_REBUILD_IMPORT_WORKERS:-8}"

ORTHANC_USER="${ORTHANC_USER:-parthenon}"
ORTHANC_PASSWORD="${ORTHANC_PASSWORD:?ORTHANC_PASSWORD must be set in .env or the environment}"
ORTHANC_DB_HOST="${ORTHANC_DB_HOST:-postgres}"
ORTHANC_DB_PORT="${ORTHANC_DB_PORT:-5432}"
ORTHANC_DB_USERNAME="${ORTHANC_DB_USERNAME:-parthenon}"
ORTHANC_DB_PASSWORD="${ORTHANC_DB_PASSWORD:-${DB_PASSWORD:-}}"
ORTHANC_HTTP_THREADS_COUNT="${ORTHANC_HTTP_THREADS_COUNT:-200}"
ORTHANC_STORAGE_CACHE_MB="${ORTHANC_STORAGE_CACHE_MB:-2048}"
ORTHANC_DICOM_WEB_WADO_RS_LOADER_THREADS_COUNT="${ORTHANC_DICOM_WEB_WADO_RS_LOADER_THREADS_COUNT:-16}"
ORTHANC_DICOM_WEB_METADATA_WORKER_THREADS_COUNT="${ORTHANC_DICOM_WEB_METADATA_WORKER_THREADS_COUNT:-16}"
ORTHANC_CONCURRENT_JOBS="${ORTHANC_CONCURRENT_JOBS:-8}"
ORTHANC_GDCM_THROTTLING="${ORTHANC_GDCM_THROTTLING:-8}"
ORTHANC_POSTGRESQL_INDEX_CONNECTIONS_COUNT="${ORTHANC_POSTGRESQL_INDEX_CONNECTIONS_COUNT:-10}"

if [[ ! -d "$SOURCE_PATH" ]]; then
  echo "Source Orthanc storage does not exist: $SOURCE_PATH" >&2
  exit 2
fi

if [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Unsafe PostgreSQL database name: $DB_NAME" >&2
  exit 2
fi

mkdir -p "$STORAGE_PATH" /mnt/md0/orthanc-rebuild

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Removing existing sidecar container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

if ! docker exec -i parthenon-postgres psql -U parthenon -d postgres -Atc \
  "select 1 from pg_database where datname = '$DB_NAME'" | grep -qx 1; then
  echo "Creating PostgreSQL database: $DB_NAME"
  docker exec -i parthenon-postgres createdb -U parthenon -O parthenon "$DB_NAME"
fi

echo "Starting PG-indexed Orthanc sidecar on http://127.0.0.1:$PORT"
docker run -d \
  --name "$CONTAINER_NAME" \
  --network parthenon \
  --memory "$MEMORY_LIMIT" \
  -p "127.0.0.1:$PORT:8042" \
  -v "$STORAGE_PATH:/var/lib/orthanc/db" \
  -v "$SOURCE_PATH:/source-data:ro" \
  -e ORTHANC__NAME="Parthenon Orthanc PG Rebuild" \
  -e ORTHANC__REMOTE_ACCESS_ALLOWED=true \
  -e ORTHANC__AUTHENTICATION_ENABLED=true \
  -e "ORTHANC__REGISTERED_USERS={\"$ORTHANC_USER\":\"$ORTHANC_PASSWORD\"}" \
  -e "ORTHANC_USER=$ORTHANC_USER" \
  -e "ORTHANC_PASSWORD=$ORTHANC_PASSWORD" \
  -e DICOM_WEB_PLUGIN_ENABLED=true \
  -e ORTHANC__DICOM_WEB__ENABLE=true \
  -e ORTHANC__DICOM_WEB__ROOT=/dicom-web/ \
  -e ORTHANC__DICOM_WEB__ENABLE_WADO=true \
  -e ORTHANC__DICOM_WEB__WADO_ROOT=/wado \
  -e ORTHANC__DICOM_WEB__STUDIES_METADATA=MainDicomTags \
  -e ORTHANC__DICOM_WEB__ENABLE_METADATA_CACHE=true \
  -e "ORTHANC__DICOM_WEB__WADO_RS_LOADER_THREADS_COUNT=$ORTHANC_DICOM_WEB_WADO_RS_LOADER_THREADS_COUNT" \
  -e "ORTHANC__DICOM_WEB__METADATA_WORKER_THREADS_COUNT=$ORTHANC_DICOM_WEB_METADATA_WORKER_THREADS_COUNT" \
  -e ORTHANC__DICOM_WEB__ENABLE_PERFORMANCE_LOGS=true \
  -e ORTHANC__BUILTIN_DECODER_TRANSCODER_ORDER=After \
  -e "ORTHANC__GDCM__THROTTLING=$ORTHANC_GDCM_THROTTLING" \
  -e "ORTHANC__HTTP_THREADS_COUNT=$ORTHANC_HTTP_THREADS_COUNT" \
  -e "ORTHANC__MAXIMUM_STORAGE_CACHE_SIZE=$ORTHANC_STORAGE_CACHE_MB" \
  -e ORTHANC__LIMIT_FIND_RESULTS=100 \
  -e ORTHANC__LIMIT_FIND_INSTANCES=50 \
  -e "ORTHANC__CONCURRENT_JOBS=$ORTHANC_CONCURRENT_JOBS" \
  -e ORTHANC__POSTGRESQL__ENABLE_INDEX=true \
  -e ORTHANC__POSTGRESQL__ENABLE_STORAGE=false \
  -e "ORTHANC__POSTGRESQL__HOST=$ORTHANC_DB_HOST" \
  -e "ORTHANC__POSTGRESQL__PORT=$ORTHANC_DB_PORT" \
  -e "ORTHANC__POSTGRESQL__DATABASE=$DB_NAME" \
  -e "ORTHANC__POSTGRESQL__USERNAME=$ORTHANC_DB_USERNAME" \
  -e "ORTHANC__POSTGRESQL__PASSWORD=$ORTHANC_DB_PASSWORD" \
  -e "ORTHANC__POSTGRESQL__INDEX_CONNECTIONS_COUNT=$ORTHANC_POSTGRESQL_INDEX_CONNECTIONS_COUNT" \
  -e ORTHANC__POSTGRESQL__PREPARE_INDEX=true \
  orthancteam/orthanc:latest >/dev/null

echo "Waiting for sidecar health..."
healthy=false
for _ in {1..60}; do
  if python3 - "$PORT" "$ORTHANC_USER" "$ORTHANC_PASSWORD" >/dev/null 2>&1 <<'PY'
import base64
import sys
import urllib.request

port, user, password = sys.argv[1:4]
token = base64.b64encode(f"{user}:{password}".encode()).decode()
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/system",
    headers={"Authorization": f"Basic {token}"},
)
with urllib.request.urlopen(request, timeout=2) as response:
    response.read()
PY
  then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  echo "Sidecar did not become healthy within 120 seconds" >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -n 80 >&2 || true
  exit 1
fi

echo
echo "Sidecar:      $CONTAINER_NAME"
echo "Endpoint:     http://127.0.0.1:$PORT"
echo "Source:       $SOURCE_PATH"
echo "Storage:      $STORAGE_PATH"
echo "PG database:  $DB_NAME"
echo "Memory limit: $MEMORY_LIMIT"
echo "Import state: /mnt/md0/orthanc-rebuild/import-state-pg-indexed-$STAMP.sqlite"
echo
echo "Run the import with:"
echo "  python3 scripts/orthanc-clean-rebuild-import.py --source \"$SOURCE_PATH\" --target \"http://127.0.0.1:$PORT\" --state \"/mnt/md0/orthanc-rebuild/import-state-pg-indexed-$STAMP.sqlite\" --workers $IMPORT_WORKERS"
