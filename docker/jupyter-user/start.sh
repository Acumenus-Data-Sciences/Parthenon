#!/bin/bash
set -euo pipefail

# First-spawn initialization:
# Copy starter notebook if private workspace is empty
if [ ! -f /home/jovyan/notebooks/parthenon-research-workbench.ipynb ]; then
    cp /home/jovyan/parthenon/output/jupyter-notebook/parthenon-research-workbench.ipynb \
       /home/jovyan/notebooks/ 2>/dev/null || true
fi

# Create user's shared subdirectory
if [ -n "${PARTHENON_USER_ID:-}" ]; then
    mkdir -p "/home/jovyan/shared/${PARTHENON_USER_ID}"
fi

# Hand off to jupyterhub-singleuser with any args passed by DockerSpawner
exec jupyterhub-singleuser "$@"
