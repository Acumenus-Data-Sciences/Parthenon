#!/bin/bash
set -e

echo "=== StudyAgent Entrypoint ==="

# Install StudyAgent packages from mounted submodule if not already installed
if ! python -c "import study_agent_core" 2>/dev/null; then
    echo "Installing StudyAgent packages from submodule..."
    pip install --no-cache-dir \
        -e /opt/study-agent/core/ \
        -e /opt/study-agent/mcp_server/ \
        -e /opt/study-agent/acp_agent/ \
        2>/dev/null
fi

# Build phenotype index if it doesn't exist
PHENOTYPE_INDEX_FILE="${PHENOTYPE_INDEX_DIR:-/data/phenotype-index}/dense.index"
if [ ! -f "$PHENOTYPE_INDEX_FILE" ]; then
    echo "Building phenotype index (first run)..."
    cd /app/study-agent/mcp_server
    python -m study_agent_mcp.retrieval.build_phenotype_index 2>/dev/null || \
        echo "Warning: Phenotype index build skipped (embedding service may not be ready)"
fi

# Start MCP server in HTTP mode (background)
echo "Starting MCP server on port ${MCP_PORT:-3000}..."
MCP_TRANSPORT=http \
MCP_HOST=0.0.0.0 \
MCP_PORT=${MCP_PORT:-3000} \
study-agent-mcp &
MCP_PID=$!

# Poll until MCP server is ready (max 30 attempts, 1s apart)
echo "Waiting for MCP server to be ready..."
MCP_READY=0
for i in $(seq 1 30); do
    if python -c "
import urllib.request, sys
try:
    urllib.request.urlopen('http://127.0.0.1:${MCP_PORT:-3000}/mcp', timeout=1)
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; then
        echo "MCP server is ready (attempt $i)"
        MCP_READY=1
        break
    fi
    echo "MCP not ready yet, waiting... ($i/30)"
    sleep 1
done

if [ "$MCP_READY" -eq 0 ]; then
    echo "Warning: MCP server did not become ready within 30 seconds, continuing anyway..."
fi

# Start ACP server in foreground (as background process)
echo "Starting ACP server on port ${STUDY_AGENT_PORT:-8765}..."
STUDY_AGENT_HOST=0.0.0.0 \
STUDY_AGENT_PORT=${STUDY_AGENT_PORT:-8765} \
STUDY_AGENT_MCP_URL="http://127.0.0.1:${MCP_PORT:-3000}/mcp" \
study-agent-acp &
ACP_PID=$!

echo "StudyAgent services started (MCP PID=$MCP_PID, ACP PID=$ACP_PID)"

# Wait for either process to exit, then kill both and exit
wait -n $MCP_PID $ACP_PID
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE, shutting down..."
kill $MCP_PID $ACP_PID 2>/dev/null || true
exit $EXIT_CODE
