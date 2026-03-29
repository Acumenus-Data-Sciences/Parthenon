#!/bin/bash
set -e

export DAGSTER_HOME="${DAGSTER_HOME:-/app/storage}"
export HOME="/app/storage"
export POSEIDON_DAGSTER_SCHEMA="${POSEIDON_DAGSTER_SCHEMA:-poseidon_dagster}"
export POSEIDON_PG_HOST="${POSEIDON_PG_HOST:-host.docker.internal}"
export POSEIDON_PG_PORT="${POSEIDON_PG_PORT:-5432}"
export POSEIDON_PG_DATABASE="${POSEIDON_PG_DATABASE:-parthenon}"
export POSEIDON_PG_USER="${POSEIDON_PG_USER:-claude_dev}"

mkdir -p "$DAGSTER_HOME" "$HOME"

echo "[poseidon] Building database URL..."
export POSEIDON_DATABASE_URL="$(
python3 <<'PY'
import os
from urllib.parse import quote, urlencode

schema = os.environ.get("POSEIDON_DAGSTER_SCHEMA", "poseidon_dagster")
host = os.environ["POSEIDON_PG_HOST"]
port = os.environ["POSEIDON_PG_PORT"]
database = os.environ["POSEIDON_PG_DATABASE"]
user = quote(os.environ["POSEIDON_PG_USER"], safe="")
password = quote(os.environ["POSEIDON_PG_PASSWORD"], safe="")
query = urlencode({"options": f"-csearch_path={schema},public"})

print(f"postgresql://{user}:{password}@{host}:{port}/{database}?{query}")
PY
)"

echo "[poseidon] Creating Dagster schema..."
python3 <<'PY'
import os

import psycopg2

schema = os.environ["POSEIDON_DAGSTER_SCHEMA"]
database_url = os.environ["POSEIDON_DATABASE_URL"]

conn = psycopg2.connect(database_url)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
conn.close()
PY

# Copy dbt project to writable storage. The source mount (./poseidon:/app/poseidon)
# is owned by the host user (UID 1000) and not writable by the poseidon container
# user (UID 100). dbt deps/parse need to write dbt_packages/ and target/ dirs.
export POSEIDON_DBT_PROJECT_DIR="$DAGSTER_HOME/dbt_work"
echo "[poseidon] Syncing dbt project to $POSEIDON_DBT_PROJECT_DIR..."
mkdir -p "$POSEIDON_DBT_PROJECT_DIR"
cp -r /app/poseidon/dbt/* "$POSEIDON_DBT_PROJECT_DIR/"

cd "$POSEIDON_DBT_PROJECT_DIR"
echo "[poseidon] Installing dbt packages..."
dbt deps --profiles-dir "$POSEIDON_DBT_PROJECT_DIR"
echo "[poseidon] Parsing dbt project..."
dbt parse --profiles-dir "$POSEIDON_DBT_PROJECT_DIR"
cd /app

# Export for Dagster definitions.py and dbt_assets.py
export DBT_PROFILES_DIR="$POSEIDON_DBT_PROJECT_DIR"

# Generate dagster.yaml with PostgreSQL run/event/schedule storage.
# Always regenerate to pick up POSEIDON_DATABASE_URL changes.
mkdir -p "$DAGSTER_HOME"
echo "[poseidon] Writing dagster.yaml..."
cat > "$DAGSTER_HOME/dagster.yaml" << 'EOF'
run_storage:
  module: dagster_postgres.run_storage
  class: PostgresRunStorage
  config:
    postgres_url:
      env: POSEIDON_DATABASE_URL

event_log_storage:
  module: dagster_postgres.event_log
  class: PostgresEventLogStorage
  config:
    postgres_url:
      env: POSEIDON_DATABASE_URL

schedule_storage:
  module: dagster_postgres.schedule_storage
  class: PostgresScheduleStorage
  config:
    postgres_url:
      env: POSEIDON_DATABASE_URL
EOF

echo "[poseidon] Entrypoint complete. Launching: $*"
exec "$@"
