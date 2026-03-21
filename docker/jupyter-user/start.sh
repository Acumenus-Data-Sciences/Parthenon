#!/bin/bash
set -euo pipefail

# First-spawn initialization:
# Copy starter notebooks if not already present in private workspace
for nb in parthenon-research-workbench.ipynb \
          morpheus-inpatient-workbench.ipynb \
          finngen-evidence-workbench.ipynb \
          penux-pathogen-prediction.ipynb; do
    if [ ! -f "/home/jovyan/notebooks/${nb}" ]; then
        cp "/home/jovyan/parthenon/output/jupyter-notebook/${nb}" \
           /home/jovyan/notebooks/ 2>/dev/null || true
    fi
done

# Create user's shared subdirectory
if [ -n "${PARTHENON_USER_ID:-}" ]; then
    mkdir -p "/home/jovyan/shared/${PARTHENON_USER_ID}"
fi

# Hand off to jupyterhub-singleuser with any args passed by DockerSpawner
exec jupyterhub-singleuser "$@"
