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

set -uo pipefail
# NOTE: not using set -e — we handle errors explicitly per section

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

ERRORS=0

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

# ── Pre-flight: verify critical containers are running ─────────────────────────
echo ""
echo "── Pre-flight checks ──"

is_running() {
  docker compose ps --status running --format '{{.Name}}' 2>/dev/null | grep -q "parthenon-$1"
}

if is_running php; then
  ok "PHP container is running"
else
  fail "PHP container is NOT running"
  echo "   Attempting to start core services..."
  docker compose up -d postgres redis php nginx horizon 2>&1 | sed 's/^/   /'
  sleep 5
  if is_running php; then
    ok "PHP container started successfully"
  else
    fail "Cannot start PHP container — aborting deploy"
    exit 1
  fi
fi

if is_running redis; then
  ok "Redis container is running"
else
  warn "Redis is not running — sessions/cache/queues will fail"
  ERRORS=$((ERRORS + 1))
fi

# ── PHP / Laravel ────────────────────────────────────────────────────────────
if $DO_PHP; then
  echo ""
  echo "── PHP: reloading php-fpm to clear opcache ──"
  if docker compose exec php kill -USR2 1 2>/dev/null; then
    ok "php-fpm reloaded (USR2)"
  else
    warn "USR2 signal failed — restarting PHP container"
    docker compose restart php 2>&1 | sed 's/^/   /'
    sleep 3
    if is_running php; then
      ok "PHP container restarted"
    else
      fail "PHP container failed to restart"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  echo "── Laravel: clearing caches ──"
  if docker compose exec php php artisan config:clear && \
     docker compose exec php php artisan cache:clear && \
     docker compose exec php php artisan route:clear && \
     docker compose exec php php artisan view:clear; then
    ok "Laravel caches cleared"
  else
    fail "Cache clear failed"
    ERRORS=$((ERRORS + 1))
  fi

  echo "── Laravel: creating storage symlink ──"
  if docker compose exec php php artisan storage:link 2>/dev/null || true; then
    ok "Storage symlink created"
  fi
fi

# ── Database migrations ───────────────────────────────────────────────────────
if $DO_DB; then
  echo ""
  echo "── DB: pre-migration backup ──"
  if bash "$( cd "$(dirname "${BASH_SOURCE[0]}")" && pwd )/scripts/db-backup.sh"; then
    ok "Pre-migration backup saved"
  else
    warn "Pre-migration backup failed (continuing anyway)"
  fi

  echo ""
  echo "── DB: running migrations ──"
  if docker compose exec php php artisan migrate --force; then
    ok "Migrations applied"
  else
    fail "Migration failed"
    ERRORS=$((ERRORS + 1))
  fi

  echo "── DB: running seeders (idempotent) ──"
  if docker compose exec php php artisan db:seed --force; then
    ok "Seeders completed"
  else
    fail "Seeders failed"
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── Frontend production build ─────────────────────────────────────────────────
if $DO_FRONTEND; then
  echo ""
  echo "── Frontend: building production dist ──"

  # Strategy: try node container first (consistent env), fall back to local npm
  if is_running node; then
    if docker compose exec node sh -c "cd /app && npx vite build --mode production"; then
      ok "Frontend built (Docker node container)"
    else
      fail "Docker node build failed"
      ERRORS=$((ERRORS + 1))
    fi
  elif command -v npx &>/dev/null; then
    warn "Node container not running — building locally"
    if (cd frontend && npx vite build --mode production); then
      ok "Frontend built (local npm)"
    else
      fail "Local frontend build failed"
      ERRORS=$((ERRORS + 1))
    fi
  else
    fail "No node container and npx not available — skipping frontend build"
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── Documentation build ───────────────────────────────────────────────────────
if $DO_DOCS; then
  echo ""
  echo "── Docs: building Docusaurus site ──"
  if [ -f docs/site/package.json ]; then
    mkdir -p docs/dist
    if docker compose --profile docs run --rm docs-build 2>&1 | sed 's/^/   /'; then
      ok "Docs built → docs/dist"
    else
      warn "Docs build failed (non-critical)"
    fi
  else
    warn "docs/site/package.json not found — skipping docs build"
  fi
fi

# ── OpenAPI spec export + TypeScript type generation ─────────────────────────
if $DO_OPENAPI; then
  echo ""
  echo "── OpenAPI: exporting spec and regenerating TypeScript types ──"
  if docker compose exec php php artisan scramble:export 2>/dev/null; then
    ok "Spec exported → backend/api.json"
  else
    warn "OpenAPI export failed (non-critical)"
  fi

  if is_running node; then
    if docker compose exec node sh -c "cd /app && npm run generate:api-types" 2>/dev/null; then
      ok "Types generated → frontend/src/types/api.generated.ts"
    else
      warn "Type generation failed (non-critical)"
    fi
  else
    warn "Node container not running — skipping type generation"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "==> ${GREEN}Deploy complete.${NC}"
else
  echo -e "==> ${YELLOW}Deploy finished with ${ERRORS} warning(s).${NC}"
fi
