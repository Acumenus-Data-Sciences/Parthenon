#!/usr/bin/env bash
# Restore the Ollama alias Hecate depends on for semantic search.
#
# Hecate's binary hardcodes `text-embedding-3-large` as the model name in
# embedding requests. The Qdrant `meddra` collection was populated using
# `embeddinggemma:300m` (768-dim). This script ensures the alias points at
# that model so query-time embeddings land in the same semantic space as
# the indexed vectors.
#
# Symptom when broken: /api/search returns results with scores ~0.13 for
# exact-match clinical terms (e.g. "Humerus" -> "Glucosamine products").
#
# Usage: ./scripts/restore-hecate-alias.sh

set -euo pipefail

SOURCE_MODEL="embeddinggemma:300m"
ALIAS="text-embedding-3-large:latest"

if ! command -v ollama >/dev/null 2>&1; then
  echo "ERROR: ollama CLI not found in PATH" >&2
  exit 1
fi

if ! ollama list | awk 'NR>1 {print $1}' | grep -qx "${SOURCE_MODEL}"; then
  echo "Source model ${SOURCE_MODEL} not found. Pulling..."
  ollama pull "${SOURCE_MODEL}"
fi

ollama rm "${ALIAS}" 2>/dev/null || true
ollama cp "${SOURCE_MODEL}" "${ALIAS}"

echo
echo "Alias restored. Verifying..."
curl -sf -X POST http://localhost:11434/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"text-embedding-3-large","input":"Humerus"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"  dim={len(d['data'][0]['embedding'])} ok\")"

echo
echo "To verify Hecate end-to-end (expect scores > 0.8):"
echo "  curl -s 'http://localhost:8088/api/search?q=Humerus&limit=3' | python3 -m json.tool"
