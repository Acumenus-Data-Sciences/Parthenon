#!/usr/bin/env bash
# deploy.sh — Apply code changes to the running Parthenon stack
#
# Run this after any code change to ensure:
#   - PHP changes are visible in the container (opcache + bind-mount sync)
#   - Frontend changes are built into the production dist served by Apache
#   - DB migrations are applied
#   - Laravel caches are cleared
#
# Usage:
#   ./deploy.sh             # full deploy (PHP + frontend + DB + docs)
#   ./deploy.sh --php       # PHP + caches only (skip frontend build)
#   ./deploy.sh --frontend  # frontend build only
#   ./deploy.sh --db        # migrations + cache clear only
#   ./deploy.sh --docs      # documentation build only
#   ./deploy.sh --openapi   # OpenAPI spec export + TypeScript type generation only

set -euo pipefail

PHP_ONLY=false
FRONTEND_ONLY=false
DB_ONLY=false
DOCS_ONLY=false
OPENAPI_ONLY=false

for arg in "$@"; do
  case $arg in
    --php)      PHP_ONLY=true ;;
    --frontend) FRONTEND_ONLY=true ;;
    --db)       DB_ONLY=true ;;
    --docs)     DOCS_ONLY=true ;;
    --openapi)  OPENAPI_ONLY=true ;;
  esac
done

DO_PHP=true
DO_FRONTEND=true
DO_DB=true
DO_DOCS=true
DO_OPENAPI=true

if $PHP_ONLY;      then DO_FRONTEND=false; DO_DB=false;      DO_DOCS=false; DO_OPENAPI=false; fi
if $FRONTEND_ONLY; then DO_PHP=false;      DO_DB=false;      DO_DOCS=false; DO_OPENAPI=false; fi
if $DB_ONLY;       then DO_PHP=false;      DO_FRONTEND=false; DO_DOCS=false; DO_OPENAPI=false; fi
if $DOCS_ONLY;     then DO_PHP=false;      DO_FRONTEND=false; DO_DB=false;  DO_OPENAPI=false;  fi
if $OPENAPI_ONLY;  then DO_PHP=false;      DO_FRONTEND=false; DO_DB=false;  DO_DOCS=false;     fi

echo "==> Parthenon deploy"

# ── PHP / Laravel ────────────────────────────────────────────────────────────
if $DO_PHP; then
  echo ""
  echo "── PHP: reloading php-fpm to clear opcache ──"
  # Sending USR2 to php-fpm master reloads workers + clears opcache
  docker compose exec php kill -USR2 1 2>/dev/null || docker compose restart php
  sleep 2

  echo "── Laravel: clearing caches ──"
  docker compose exec php php artisan config:clear
  docker compose exec php php artisan cache:clear
  docker compose exec php php artisan route:clear
  docker compose exec php php artisan view:clear
fi

# ── Database migrations ───────────────────────────────────────────────────────
if $DO_DB; then
  echo ""
  echo "── DB: running migrations ──"
  docker compose exec php php artisan migrate --force
fi

# ── Frontend production build ─────────────────────────────────────────────────
if $DO_FRONTEND; then
  echo ""
  echo "── Frontend: building production dist ──"
  # Build inside the node container (same Node/npm version as dev)
  docker compose exec node sh -c "cd /app && npx vite build --mode production"
  echo "   Built → frontend/dist  (served by Apache at parthenon.acumenus.net)"
fi

# ── Documentation build ───────────────────────────────────────────────────────
if $DO_DOCS; then
  echo ""
  echo "── Docs: building Docusaurus site ──"
  mkdir -p docs/dist
  docker compose --profile docs run --rm docs-build
  echo "   Built → docs/dist  (served by nginx at /docs/)"
fi

# ── OpenAPI spec export + TypeScript type generation ─────────────────────────
if $DO_OPENAPI; then
  echo ""
  echo "── OpenAPI: exporting spec and regenerating TypeScript types ──"
  docker compose exec php php artisan scramble:export
  echo "   Spec exported → backend/api.json"
  docker compose exec node sh -c "cd /app && npm run generate:api-types"
  echo "   Types generated → frontend/src/types/api.generated.ts"
fi

echo ""
echo "==> Deploy complete."
