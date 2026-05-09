#!/usr/bin/env bash
# Entry script for parthenon-templates.
# Validates required env vars then exec's into honcho.
set -euo pipefail

if [[ -z "${PARTHENON_INTERNAL_TOKEN:-}" ]]; then
    echo "FATAL: PARTHENON_INTERNAL_TOKEN must be set." >&2
    exit 1
fi

# Construct DATABASE_URL from individual DB_* env vars if not set explicitly.
# This lets the compose entry inherit DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD
# from backend/.env (same source of truth as Laravel) instead of duplicating
# the password in host .env. (2026-05-08: hello_cdm flow failed with
# "no password supplied" because the default DATABASE_URL omitted the
# parthenon_app password.)
if [[ -z "${DATABASE_URL:-}" ]] && [[ -n "${DB_USERNAME:-}" ]] && [[ -n "${DB_PASSWORD:-}" ]]; then
    DB_HOST="${DB_HOST:-host.docker.internal}"
    DB_PORT="${DB_PORT:-5432}"
    DB_DATABASE="${DB_DATABASE:-parthenon}"
    # URL-encode the password to handle special characters safely.
    ENCODED_PW=$(python3 -c "import urllib.parse,os;print(urllib.parse.quote(os.environ['DB_PASSWORD'],safe=''))")
    export DATABASE_URL="postgresql+psycopg://${DB_USERNAME}:${ENCODED_PW}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "FATAL: DATABASE_URL is unset and DB_USERNAME/DB_PASSWORD were not provided to derive it." >&2
    exit 1
fi

mkdir -p "${PARTHENON_STORAGE_ROOT}"
mkdir -p "${PREFECT_HOME}"

cd /app/templates
exec "$@"
