#!/usr/bin/env bash
# Entry script for parthenon-templates.
# Validates required env vars then exec's into honcho.
set -euo pipefail

if [[ -z "${PARTHENON_INTERNAL_TOKEN:-}" ]]; then
    echo "FATAL: PARTHENON_INTERNAL_TOKEN must be set." >&2
    exit 1
fi

mkdir -p "${PARTHENON_STORAGE_ROOT}"
mkdir -p "${PREFECT_HOME}"

cd /app/templates
exec "$@"
