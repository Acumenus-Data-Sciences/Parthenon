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

# ── Pull pre-built images from GHCR ───────────────────────────────────────────
# Images are built in CI (GitHub Actions) and pushed to ghcr.io/sudoshi/parthenon-*.
# Pulling here avoids local rebuilds and speeds up deploys significantly.
# If GHCR is unreachable or images don't exist yet, fall back to local images.
# Skip for targeted deploys (--frontend, --db, --docs, --openapi) where no image changes are expected.
if $FRONTEND_ONLY || $DB_ONLY || $DOCS_ONLY || $OPENAPI_ONLY; then
  echo ""
  echo "── Skipping image pull (targeted deploy) ──"
else
  echo ""
  echo "── Pulling pre-built images from GHCR ──"
  if docker compose pull --ignore-pull-failures 2>&1 | tail -5 | sed 's/^/   /'; then
    ok "Image pull complete (using cached images for any failures)"
  else
    warn "Image pull had errors — will use locally cached images"
  fi
fi

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

if docker compose config --services 2>/dev/null | grep -q "^finngen-runner$"; then
  if is_running finngen-runner; then
    ok "FINNGEN runner is running"
  else
    warn "FINNGEN runner is not running — attempting to build and start it"
    if docker compose up -d --build finngen-runner 2>&1 | sed 's/^/   /'; then
      sleep 5
      if is_running finngen-runner; then
        ok "FINNGEN runner started successfully"
      else
        warn "FINNGEN runner did not stay up"
        ERRORS=$((ERRORS + 1))
      fi
    else
      warn "FINNGEN runner build/start failed"
      ERRORS=$((ERRORS + 1))
    fi
  fi
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
  echo "── DB: exporting design fixtures to git ──"
  if docker compose exec -T php php artisan parthenon:export-designs; then
    # Commit on the host — PHP container cannot see .git
    git add backend/database/fixtures/designs/
    if ! git diff --cached --quiet; then
      git commit -m "chore: auto-export design fixtures [skip ci]"
      ok "Design fixtures committed"
    else
      ok "No fixture changes to commit"
    fi
  else
    warn "Design fixture export failed (continuing anyway)"
  fi

  # ── TRIPWIRE: verify real users exist before touching the DB ──────────────
  # If user count drops to 0, something catastrophic has already happened.
  # Abort immediately rather than making it worse.
  echo ""
  echo "── DB: tripwire — verifying production users ──"
  ENV_FILE="$( cd "$(dirname "${BASH_SOURCE[0]}")" && pwd )/backend/.env"
  if [ -f "$ENV_FILE" ]; then
    PG_HOST="$(  grep '^DB_HOST='     "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
    PG_PORT="$(  grep '^DB_PORT='     "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
    PG_DB="$(    grep '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
    PG_USER="$(  grep '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
    PG_PASS="$(  grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
    PG_PORT="${PG_PORT:-5432}"
    REAL_USERS="$(PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
      -tAc "SELECT COUNT(*) FROM app.users WHERE email NOT LIKE '%@example.%' AND email NOT LIKE 'test-%'" 2>/dev/null || echo "ERROR")"
    if [ "$REAL_USERS" = "ERROR" ] || [ -z "$REAL_USERS" ]; then
      warn "Could not query user count — proceeding with caution"
    elif [ "$REAL_USERS" -eq 0 ]; then
      fail "TRIPWIRE: 0 real users found in production DB — this is wrong."
      fail "Database may have been wiped. ABORTING migrations."
      fail "Run: psql -h $PG_HOST -U $PG_USER -d $PG_DB -c 'SELECT COUNT(*) FROM app.users'"
      fail "If truly fresh install, seed manually: php artisan admin:seed"
      exit 1
    else
      ok "Tripwire passed — ${REAL_USERS} real user(s) in production DB"
    fi
  fi

  echo ""
  echo "── DB: running migrations ──"
  if docker compose exec php php artisan migrate --force; then
    ok "Migrations applied"
  else
    fail "Migration failed"
    ERRORS=$((ERRORS + 1))
  fi

  # SEEDERS INTENTIONALLY REMOVED FROM DEPLOY — 2026-03-15
  # db:seed wiped 16 real production users TWICE because deploy.sh
  # ran on every push. Seeders must NEVER run automatically in deploy.
  # To seed infrastructure (roles, providers) on a fresh install only:
  #   php artisan db:seed --class=RolePermissionSeeder
  #   php artisan db:seed --class=AiProviderSeeder
  #   php artisan db:seed --class=AuthProviderSeeder
  #   php artisan admin:seed
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
    mkdir -p docs/site/build
    if docker compose --profile docs run --rm docs-build 2>&1 | sed 's/^/   /'; then
      ok "Docs built → docs/site/build"
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

# ── Fix file ownership ────────────────────────────────────────────────────────
# Docker containers may create files as root or www-data (UID 33).
# Reclaim ownership so git and host tooling work without permission errors.
echo ""
echo "── Fixing file ownership ──"
HOST_UID=$(id -u)
HOST_GID=$(id -g)
NEEDS_FIX=$(find backend/storage backend/bootstrap/cache frontend/dist docs/site/build -not -user "$HOST_UID" -type f 2>/dev/null | head -1)
if [ -n "$NEEDS_FIX" ]; then
  docker run --rm \
    -v "$(pwd)/backend/storage:/fix/storage" \
    -v "$(pwd)/backend/bootstrap/cache:/fix/cache" \
    -v "$(pwd)/frontend/dist:/fix/frontend-dist" \
    -v "$(pwd)/docs/site/build:/fix/docs-dist" \
    alpine chown -R "$HOST_UID:$HOST_GID" /fix 2>/dev/null
  ok "File ownership reclaimed (UID $HOST_UID)"
else
  ok "File ownership OK"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "==> ${GREEN}Deploy complete.${NC}"
else
  echo -e "==> ${YELLOW}Deploy finished with ${ERRORS} warning(s).${NC}"
fi
