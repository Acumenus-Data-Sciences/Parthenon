#!/bin/bash
# Ingest DICOM files into Orthanc via REST API
# Usage: ./ingest_dicom.sh <directory> [--dry-run]
#
# Pushes all .dcm files found recursively in the given directory.
# Uses Orthanc's /instances endpoint (binary upload, one file at a time).

set -euo pipefail

ORTHANC_URL="http://localhost:8042"
ORTHANC_USER="parthenon"
ORTHANC_PASSWORD="GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih"

DIR="${1:?Usage: $0 <dicom-directory> [--dry-run]}"
DRY_RUN="${2:-}"

if [ ! -d "$DIR" ]; then
    echo "ERROR: Directory not found: $DIR"
    exit 1
fi

echo "Scanning for DICOM files in: $DIR"
TOTAL=$(find "$DIR" -name "*.dcm" -type f | wc -l)
echo "Found $TOTAL .dcm files"

if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "Dry run — not uploading."
    exit 0
fi

COUNT=0
ERRORS=0
START_TIME=$(date +%s)

find "$DIR" -name "*.dcm" -type f | while read -r dcm_file; do
    COUNT=$((COUNT + 1))

    # Upload via Orthanc REST API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "${ORTHANC_USER}:${ORTHANC_PASSWORD}" \
        -X POST "${ORTHANC_URL}/instances" \
        -H "Content-Type: application/dicom" \
        --data-binary "@${dcm_file}" \
        --max-time 120)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "409" ]; then
        # 200 = new instance, 409 = already exists
        if [ $((COUNT % 50)) -eq 0 ] || [ $COUNT -eq 1 ]; then
            ELAPSED=$(($(date +%s) - START_TIME))
            RATE=$(echo "scale=1; $COUNT / ($ELAPSED + 1)" | bc 2>/dev/null || echo "?")
            echo "  [$COUNT/$TOTAL] ${RATE}/s — $(basename "$dcm_file") ($HTTP_CODE)"
        fi
    else
        ERRORS=$((ERRORS + 1))
        echo "  ERROR [$COUNT/$TOTAL] HTTP $HTTP_CODE — $dcm_file"
    fi
done

ELAPSED=$(($(date +%s) - START_TIME))
echo ""
echo "Complete: $TOTAL files in ${ELAPSED}s ($ERRORS errors)"
