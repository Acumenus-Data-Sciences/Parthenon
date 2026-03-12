#!/bin/bash
set -euo pipefail

# Build the OHDSI PhenotypeLibrary index for StudyAgent
# Run once during setup; re-run to update the phenotype catalog.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR=$(mktemp -d)

echo "=== Building Phenotype Index ==="

# 1. Clone PhenotypeLibrary
echo "Cloning OHDSI/PhenotypeLibrary..."
git clone --depth 1 https://github.com/OHDSI/PhenotypeLibrary.git "$TEMP_DIR/PhenotypeLibrary"

# 2. Run the index builder inside the study-agent container
echo "Building index..."
docker compose -f "$REPO_ROOT/docker-compose.yml" run --rm \
    -v "$TEMP_DIR/PhenotypeLibrary:/tmp/PhenotypeLibrary:ro" \
    study-agent \
    python -m study_agent_mcp.retrieval.build_phenotype_index \
        --library-dir /tmp/PhenotypeLibrary \
        --output-dir "${PHENOTYPE_INDEX_DIR:-/data/phenotype-index}"

# 3. Cleanup
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo "=== Phenotype Index build complete ==="
