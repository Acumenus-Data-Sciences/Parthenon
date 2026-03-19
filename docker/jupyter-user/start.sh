#!/bin/bash
set -euo pipefail

# Launched by JupyterHub's DockerSpawner — environment variables are injected:
#   JUPYTERHUB_API_TOKEN, JUPYTERHUB_BASE_URL, JUPYTERHUB_SERVICE_PREFIX, etc.
#   PARTHENON_DB_HOST, PARTHENON_DB_USER, PARTHENON_DB_PASSWORD, etc.
#   PARTHENON_USER_ID — used for shared folder subdirectory

# Copy starter notebook on first spawn (empty private workspace)
if [ ! -f /home/jovyan/notebooks/parthenon-research-workbench.ipynb ]; then
    cp /home/jovyan/parthenon/output/jupyter-notebook/parthenon-research-workbench.ipynb \
       /home/jovyan/notebooks/ 2>/dev/null || true
fi

# Create user's shared subdirectory
if [ -n "${PARTHENON_USER_ID:-}" ]; then
    mkdir -p "/home/jovyan/shared/${PARTHENON_USER_ID}"
fi

exec jupyterhub-singleuser \
    --ip=0.0.0.0 \
    --port=8888 \
    --no-browser \
    --ServerApp.allow_remote_access=True \
    --ServerApp.root_dir=/home/jovyan/notebooks
