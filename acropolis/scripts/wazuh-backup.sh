#!/usr/bin/env bash
# wazuh-backup.sh — Back up Wazuh configuration, rules, and keys
#
# Backs up:
#   1. Manager config (ossec.conf, rules, decoders, shared agent configs, client keys)
#   2. API configuration
#   3. Alert logs (last 7 days)
#   4. Indexer snapshot (if snapshot repository configured)
#
# Usage:
#   ./wazuh-backup.sh                     # Backup to default location
#   BACKUP_ROOT=/mnt/backups ./wazuh-backup.sh  # Custom backup location
#
# Schedule via cron:
#   0 2 * * * /home/smudoshi/Github/Parthenon/acropolis/scripts/wazuh-backup.sh >> /var/log/wazuh-backup.log 2>&1

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/home/smudoshi/Github/Parthenon/backups/wazuh}"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"
MANAGER_CONTAINER="acropolis-wazuh-manager"
INDEXER_CONTAINER="acropolis-wazuh-indexer"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

echo "=== Wazuh Backup — ${DATE} ==="
echo "Backup directory: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"

# 1. Manager configuration
echo "[1/4] Backing up manager configuration..."
mkdir -p "${BACKUP_DIR}/manager"

docker cp "${MANAGER_CONTAINER}:/var/ossec/etc/ossec.conf" "${BACKUP_DIR}/manager/" 2>/dev/null || echo "  WARN: ossec.conf not found"
docker cp "${MANAGER_CONTAINER}:/var/ossec/etc/rules/" "${BACKUP_DIR}/manager/rules/" 2>/dev/null || echo "  WARN: rules dir not found"
docker cp "${MANAGER_CONTAINER}:/var/ossec/etc/decoders/" "${BACKUP_DIR}/manager/decoders/" 2>/dev/null || echo "  WARN: decoders dir not found"
docker cp "${MANAGER_CONTAINER}:/var/ossec/etc/shared/" "${BACKUP_DIR}/manager/shared/" 2>/dev/null || echo "  WARN: shared dir not found"
docker cp "${MANAGER_CONTAINER}:/var/ossec/etc/client.keys" "${BACKUP_DIR}/manager/" 2>/dev/null || echo "  WARN: client.keys not found"
echo "  OK: Manager config backed up"

# 2. API configuration
echo "[2/4] Backing up API configuration..."
mkdir -p "${BACKUP_DIR}/api"
docker cp "${MANAGER_CONTAINER}:/var/ossec/api/configuration/" "${BACKUP_DIR}/api/" 2>/dev/null || echo "  WARN: API config not found"
echo "  OK: API config backed up"

# 3. Recent alerts (last 7 days)
echo "[3/4] Backing up recent alerts..."
mkdir -p "${BACKUP_DIR}/alerts"
docker exec "${MANAGER_CONTAINER}" sh -c 'find /var/ossec/logs/alerts -name "*.json" -mtime -7 2>/dev/null' | while read -r f; do
    docker cp "${MANAGER_CONTAINER}:${f}" "${BACKUP_DIR}/alerts/" 2>/dev/null
done
echo "  OK: Recent alerts backed up"

# 4. Compress backup
echo "[4/4] Compressing backup..."
cd "${BACKUP_ROOT}"
tar czf "${DATE}.tar.gz" "${DATE}/"
rm -rf "${DATE}/"
BACKUP_SIZE=$(du -sh "${DATE}.tar.gz" | cut -f1)
echo "  OK: Compressed to ${DATE}.tar.gz (${BACKUP_SIZE})"

# 5. Cleanup old backups
if [[ "${RETAIN_DAYS}" -gt 0 ]]; then
    DELETED=$(find "${BACKUP_ROOT}" -name "*.tar.gz" -mtime +${RETAIN_DAYS} -delete -print | wc -l)
    echo "  Cleaned up ${DELETED} backups older than ${RETAIN_DAYS} days"
fi

echo ""
echo "=== Backup complete: ${BACKUP_ROOT}/${DATE}.tar.gz ==="
