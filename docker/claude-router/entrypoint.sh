#!/bin/sh
# Render the claude-code-router config from env, then run the router in the
# foreground. The Claude CLI (driven by python-ai's agent service) connects with
# ANTHROPIC_AUTH_TOKEN == ROUTER_API_KEY and all routes map to the local Ollama
# model. Ollama must already have $LOCAL_MODEL pulled.
set -e

ROUTER_PORT="${ROUTER_PORT:-8787}"
ROUTER_API_KEY="${ROUTER_API_KEY:-local}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"
LOCAL_MODEL="${LOCAL_MODEL:-qwen2.5-coder:32b}"

CONFIG_DIR="${HOME}/.claude-code-router"
mkdir -p "${CONFIG_DIR}"

cat > "${CONFIG_DIR}/config.json" <<EOF
{
  "HOST": "0.0.0.0",
  "PORT": ${ROUTER_PORT},
  "APIKEY": "${ROUTER_API_KEY}",
  "Providers": [
    {
      "name": "ollama",
      "api_base_url": "${OLLAMA_BASE_URL}/v1/chat/completions",
      "api_key": "ollama",
      "models": ["${LOCAL_MODEL}"]
    }
  ],
  "Router": {
    "default": "ollama,${LOCAL_MODEL}",
    "background": "ollama,${LOCAL_MODEL}",
    "think": "ollama,${LOCAL_MODEL}",
    "longContext": "ollama,${LOCAL_MODEL}"
  }
}
EOF

echo "[claude-router] config rendered: port=${ROUTER_PORT} model=${LOCAL_MODEL} backend=${OLLAMA_BASE_URL}"
exec ccr start
