#!/usr/bin/env bash
#
# qdrant-warm-cache.sh — keep the Qdrant `meddra` vector collection resident in
# the OS page cache so Hecate semantic search stays fast.
#
# WHY: The meddra collection (~6.8 GB, 1.97M × 768-dim) is stored as mmap-backed
# segments (InRamChunkedMmap). Under host memory pressure the kernel evicts those
# pages from the page cache. The next "cold" HNSW traversal then faults vector
# pages back from disk, taking 4–12 s. Hecate's Qdrant gRPC client has a hardcoded
# ~10 s deadline, so cold searches return HTTP 500 ("Timeout expired") while warm
# searches return in ~3 ms. The Docker healthcheck (q=health) only checks HTTP-up,
# so the container reports "healthy" the whole time — the outage is invisible.
#
# SENSOR  : (implicit) page-cache residency of the segment files
# ACTUATOR: sequentially read every segment file into the page cache (read-only;
#           the WAL is skipped — it is not on the search hot path). When the data
#           is already resident this is a cheap page-cache read; when evicted it
#           re-faults it from disk. Idempotent and non-destructive — it only reads.
#
# After warming it runs one timed probe search and logs the latency so the timer
# journal shows whether search is healthy.
#
# Install as a systemd timer (mirrors alfresco-transform-monitor):
#   sudo cp scripts/systemd/qdrant-warm-cache.{service,timer} /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now qdrant-warm-cache.timer
#
set -euo pipefail

CONTAINER="${QDRANT_CONTAINER:-parthenon-qdrant}"
COLLECTION="${QDRANT_COLLECTION:-meddra}"
STORAGE_ROOT="/qdrant/storage/collections/${COLLECTION}"
REST_PORT="${QDRANT_REST_PORT:-6333}"

log() { echo "[qdrant-warm $(date -u +%H:%M:%S)] $*"; }

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" >/dev/null 2>&1; then
    log "container $CONTAINER not running — nothing to warm"
    exit 0
fi

# Fault every segment file (vectors + HNSW + payload) into the page cache.
# Skip the write-ahead log: it is not read during search.
docker exec "$CONTAINER" sh -c '
    cd '"$STORAGE_ROOT"' 2>/dev/null || exit 0
    find . -type f ! -path "*/wal/*" -exec cat {} + > /dev/null 2>&1 || true
' || { log "warm pass failed (exec error) — will retry next tick"; exit 0; }

# Probe: a fixed constant vector exercises an HNSW traversal. We only care about
# latency, not relevance, so a constant query vector is fine. Run curl from the
# host (the qdrant image ships no curl) against the mapped REST port.
PROBE="[$(python3 -c 'print(",".join(["0.04"]*768))')]"
# Note: curl -w emits no trailing newline, so parse with parameter expansion
# rather than `read` (which would return non-zero under `set -e`).
OUT=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' -m 15 \
    "http://localhost:${REST_PORT}/collections/${COLLECTION}/points/search" \
    -H 'Content-Type: application/json' \
    -d "{\"vector\": ${PROBE}, \"limit\": 1}" 2>/dev/null) || OUT="000 0"

log "warmed ${COLLECTION}; probe HTTP=${OUT%% *} time=${OUT##* }s"
