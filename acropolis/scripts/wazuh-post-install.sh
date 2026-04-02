#!/usr/bin/env bash
# wazuh-post-install.sh — Run ONCE after initial Wazuh deployment
#
# Applies:
#   1. ISM retention policy (90-day hot, then delete) for wazuh-alerts-* and wazuh-archives-*
#   2. Single-node shard template (1 shard, 0 replicas) for all wazuh-* indices
#
# Re-run safely at any time to update the retention policy or shard template.
#
# Requirements:
#   - WAZUH_INDEXER_PASSWORD env var (or will prompt)
#   - curl installed
#   - Wazuh indexer accessible (default: https://localhost:9200)

set -euo pipefail

# Configuration
INDEXER_URL="${WAZUH_INDEXER_URL:-https://localhost:9200}"

# Get password from environment or prompt
if [[ -z "${WAZUH_INDEXER_PASSWORD:-}" ]]; then
    read -rsp "Enter Wazuh indexer admin password: " WAZUH_INDEXER_PASSWORD
    echo
fi

CURL_OPTS=(-sk -u "admin:${WAZUH_INDEXER_PASSWORD}" -H "Content-Type: application/json")

echo "=== Wazuh Post-Install Configuration ==="
echo "Indexer URL: ${INDEXER_URL}"
echo

# 1. ISM Retention Policy — 90 days hot, then delete
echo "[1/2] Applying ISM retention policy (90-day hot, then delete)..."
HTTP_CODE=$(curl "${CURL_OPTS[@]}" -w "%{http_code}" -o /tmp/wazuh-ism-response.json \
    -X PUT "${INDEXER_URL}/_plugins/_ism/policies/wazuh-retention" \
    -d '{
  "policy": {
    "description": "Wazuh index retention - 90 days hot then delete",
    "default_state": "hot",
    "states": [
      {
        "name": "hot",
        "actions": [],
        "transitions": [
          { "state_name": "delete", "conditions": { "min_index_age": "90d" } }
        ]
      },
      {
        "name": "delete",
        "actions": [{ "delete": {} }],
        "transitions": []
      }
    ],
    "ism_template": [
      { "index_patterns": ["wazuh-alerts-*"], "priority": 100 },
      { "index_patterns": ["wazuh-archives-*"], "priority": 100 }
    ]
  }
}')

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
    echo "  OK: ISM retention policy applied (HTTP ${HTTP_CODE})"
else
    echo "  WARNING: ISM retention policy returned HTTP ${HTTP_CODE}"
    cat /tmp/wazuh-ism-response.json 2>/dev/null
    echo
fi

# 2. Single-node shard template — 1 shard, 0 replicas
echo "[2/2] Applying single-node shard template..."
HTTP_CODE=$(curl "${CURL_OPTS[@]}" -w "%{http_code}" -o /tmp/wazuh-template-response.json \
    -X PUT "${INDEXER_URL}/_template/wazuh-single-node" \
    -d '{
  "index_patterns": ["wazuh-*"],
  "order": 1,
  "settings": {
    "index.number_of_shards": 1,
    "index.number_of_replicas": 0
  }
}')

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
    echo "  OK: Single-node shard template applied (HTTP ${HTTP_CODE})"
else
    echo "  WARNING: Shard template returned HTTP ${HTTP_CODE}"
    cat /tmp/wazuh-template-response.json 2>/dev/null
    echo
fi

# Cleanup
rm -f /tmp/wazuh-ism-response.json /tmp/wazuh-template-response.json

echo
echo "=== Post-install configuration complete ==="
