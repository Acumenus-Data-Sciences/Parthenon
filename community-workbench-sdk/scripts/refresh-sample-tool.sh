#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

"${SDK_DIR}/scripts/new-workbench-tool.sh" \
  --tool-id community_variant_browser \
  --display-name "Community Variant Browser" \
  --description "Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK." \
  --domain genomics \
  --mode external-adapter \
  --route-slug community-variant-browser \
  --env-prefix COMMUNITY_VARIANT_BROWSER \
  --output-dir "${SDK_DIR}/generated-samples"

echo "Refreshed generated sample at ${SDK_DIR}/generated-samples/community_variant_browser"
