#!/usr/bin/env bash
# migrate-orthanc-to-pg.sh — Migrate Orthanc index from SQLite to PostgreSQL
#
# How it works:
#   1. Starts a temporary Orthanc instance using the OLD SQLite index (read-only)
#   2. Configures it to peer with the production PG-indexed Orthanc
#   3. Pushes all studies from SQLite-Orthanc → PG-Orthanc
#   4. Cleans up the temp container
#
# Prerequisites:
#   - Production Orthanc (parthenon-orthanc) must be running with PG index
#   - The old SQLite index must exist at the Orthanc data volume
#
# Usage:
#   ./scripts/migrate-orthanc-to-pg.sh
#   ./scripts/migrate-orthanc-to-pg.sh --dry-run   # Show study count without migrating

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ORTHANC_USER="${ORTHANC_USER:-parthenon}"
ORTHANC_PASS="${ORTHANC_PASSWORD:?Set ORTHANC_PASSWORD env var}"
PROD_URL="http://parthenon-orthanc:8042"
TEMP_CONTAINER="orthanc-sqlite-migrator"
TEMP_PORT=8043
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
fi

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Orthanc SQLite → PostgreSQL Index Migration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Verify production Orthanc is running with PG ──────────────
info "Checking production Orthanc..."
PROD_STATS=$(curl -sf -u "$ORTHANC_USER:$ORTHANC_PASS" http://localhost:8042/statistics 2>/dev/null) || fail "Production Orthanc not reachable at :8042"
PROD_COUNT=$(echo "$PROD_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountInstances'])")
ok "Production Orthanc (PG-indexed): $PROD_COUNT instances"

# ── Step 2: Resolve the Orthanc data volume path ─────────────────────
ORTHANC_DATA_PATH="${ORTHANC_DATA_PATH:-}"
if [[ -z "$ORTHANC_DATA_PATH" ]]; then
    # Try to read from docker-compose volume mount
    ORTHANC_DATA_PATH=$(docker inspect parthenon-orthanc --format '{{range .Mounts}}{{if eq .Destination "/var/lib/orthanc/db"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)
fi
[[ -z "$ORTHANC_DATA_PATH" ]] && fail "Cannot determine Orthanc data path. Set ORTHANC_DATA_PATH."

# Check for SQLite index
if [[ ! -f "$ORTHANC_DATA_PATH/index" ]]; then
    fail "SQLite index not found at $ORTHANC_DATA_PATH/index"
fi
SQLITE_SIZE=$(du -h "$ORTHANC_DATA_PATH/index" | cut -f1)
ok "SQLite index found: $ORTHANC_DATA_PATH/index ($SQLITE_SIZE)"

# ── Step 3: Start temporary SQLite-indexed Orthanc ───────────────────
info "Starting temporary SQLite-indexed Orthanc on port $TEMP_PORT..."

# Clean up any leftover container
docker rm -f "$TEMP_CONTAINER" 2>/dev/null || true

docker run -d \
    --name "$TEMP_CONTAINER" \
    --network parthenon_parthenon \
    -p "$TEMP_PORT:8042" \
    -v "$ORTHANC_DATA_PATH:/var/lib/orthanc/db" \
    -e ORTHANC__NAME="SQLite Migrator (temp)" \
    -e ORTHANC__REMOTE_ACCESS_ALLOWED=true \
    -e ORTHANC__AUTHENTICATION_ENABLED=true \
    -e "ORTHANC__REGISTERED_USERS={\"$ORTHANC_USER\": \"$ORTHANC_PASS\"}" \
    -e ORTHANC__CONCURRENT_JOBS=4 \
    -e DICOM_WEB_PLUGIN_ENABLED=false \
    -e "ORTHANC__ORTHANC_PEERS={\"pg-orthanc\": [\"$PROD_URL\", \"$ORTHANC_USER\", \"$ORTHANC_PASS\"]}" \
    orthancteam/orthanc:latest \
    > /dev/null

# Wait for it to start
info "Waiting for temp Orthanc to start..."
for i in $(seq 1 30); do
    if curl -sf -u "$ORTHANC_USER:$ORTHANC_PASS" "http://localhost:$TEMP_PORT/system" > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

TEMP_STATS=$(curl -sf -u "$ORTHANC_USER:$ORTHANC_PASS" "http://localhost:$TEMP_PORT/statistics" 2>/dev/null) || fail "Temp Orthanc failed to start"
SQLITE_INSTANCES=$(echo "$TEMP_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountInstances'])")
SQLITE_STUDIES=$(echo "$TEMP_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountStudies'])")
SQLITE_PATIENTS=$(echo "$TEMP_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountPatients'])")
ok "Temp Orthanc (SQLite): $SQLITE_INSTANCES instances, $SQLITE_STUDIES studies, $SQLITE_PATIENTS patients"

if [[ "$DRY_RUN" == "true" ]]; then
    info "Dry run — cleaning up temp container"
    docker rm -f "$TEMP_CONTAINER" > /dev/null 2>&1
    echo ""
    echo -e "${GREEN}Would migrate: $SQLITE_INSTANCES instances ($SQLITE_STUDIES studies, $SQLITE_PATIENTS patients)${NC}"
    exit 0
fi

# ── Step 4: Push all studies from SQLite → PG via peer transfer ──────
echo ""
info "Migrating $SQLITE_STUDIES studies to PG-indexed Orthanc..."
info "This will take a while for $SQLITE_INSTANCES instances..."
echo ""

# Get all study IDs from SQLite Orthanc
STUDY_IDS=$(curl -sf -u "$ORTHANC_USER:$ORTHANC_PASS" "http://localhost:$TEMP_PORT/studies" 2>/dev/null)
TOTAL=$(echo "$STUDY_IDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

MIGRATED=0
FAILED=0
START_TIME=$(date +%s)

echo "$STUDY_IDS" | python3 -c "import sys,json; [print(s) for s in json.load(sys.stdin)]" | while read -r STUDY_ID; do
    MIGRATED=$((MIGRATED + 1))

    # Send study to PG peer
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
        -u "$ORTHANC_USER:$ORTHANC_PASS" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"Peer\": \"pg-orthanc\"}" \
        "http://localhost:$TEMP_PORT/studies/$STUDY_ID/store-peer" 2>/dev/null || echo "000")

    if [[ "$HTTP_CODE" == "200" ]]; then
        # Progress every 50 studies
        if (( MIGRATED % 50 == 0 )); then
            NOW=$(date +%s)
            ELAPSED=$((NOW - START_TIME))
            RATE=$(python3 -c "print(f'{$MIGRATED/$ELAPSED:.1f}')" 2>/dev/null || echo "?")
            ETA=$(python3 -c "
remaining = $TOTAL - $MIGRATED
rate = $MIGRATED / max($ELAPSED, 1)
eta_s = remaining / max(rate, 0.01)
h, rem = divmod(int(eta_s), 3600)
m, s = divmod(rem, 60)
print(f'{h}h{m:02d}m' if h else f'{m}m{s:02d}s')
" 2>/dev/null || echo "?")
            echo -e "  ${GREEN}→${NC} $MIGRATED / $TOTAL studies ($RATE/sec, ETA: $ETA)"
        fi
    else
        FAILED=$((FAILED + 1))
        warn "Failed to migrate study $STUDY_ID (HTTP $HTTP_CODE)"
    fi
done

# ── Step 5: Verify ───────────────────────────────────────────────────
echo ""
info "Verifying migration..."
FINAL_STATS=$(curl -sf -u "$ORTHANC_USER:$ORTHANC_PASS" http://localhost:8042/statistics 2>/dev/null)
FINAL_COUNT=$(echo "$FINAL_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountInstances'])")
FINAL_STUDIES=$(echo "$FINAL_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['CountStudies'])")

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Source (SQLite):  $SQLITE_INSTANCES instances / $SQLITE_STUDIES studies"
echo -e "  Target (PG):      $FINAL_COUNT instances / $FINAL_STUDIES studies"
if [[ "$FAILED" -gt 0 ]]; then
    echo -e "  ${YELLOW}Failed:             $FAILED studies${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 6: Cleanup ──────────────────────────────────────────────────
info "Stopping temp container..."
docker rm -f "$TEMP_CONTAINER" > /dev/null 2>&1
ok "Temp container removed"

if [[ "$FINAL_COUNT" -ge "$SQLITE_INSTANCES" ]]; then
    ok "Migration complete! You can safely delete the SQLite index:"
    echo -e "    rm $ORTHANC_DATA_PATH/index"
else
    warn "Migration incomplete — $((SQLITE_INSTANCES - FINAL_COUNT)) instances missing"
    warn "Re-run this script to retry. The SQLite index has been preserved."
fi
