#!/bin/sh
set -eu

JUPYTER_PORT="${JUPYTER_PORT:-8888}"
JUPYTER_TOKEN="${JUPYTER_TOKEN:-parthenon-local-jupyter}"
JUPYTER_BASE_URL="${JUPYTER_BASE_URL:-/jupyter}"
JUPYTER_ROOT_DIR="${JUPYTER_ROOT_DIR:-/workspace/notebooks}"

mkdir -p "${JUPYTER_ROOT_DIR}"

exec jupyter lab \
  --ip=0.0.0.0 \
  --port="${JUPYTER_PORT}" \
  --no-browser \
  --allow-root \
  --ServerApp.allow_remote_access=True \
  --ServerApp.base_url="${JUPYTER_BASE_URL}" \
  --ServerApp.root_dir="${JUPYTER_ROOT_DIR}" \
  --ServerApp.token="${JUPYTER_TOKEN}" \
  --IdentityProvider.token="${JUPYTER_TOKEN}"
