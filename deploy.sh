#!/usr/bin/env bash
# deploy.sh — Apply code changes to the running Parthenon stack
#
# Run this after any code change to ensure:
#   - PHP changes are visible in the container (opcache + bind-mount sync)
#   - Frontend changes are built into the production dist served by Apache
#   - DB migrations are applied
#   - Runtime caches are cleared across the stack
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

export HOST_UID="${HOST_UID:-$(id -u)}"
export HOST_GID="${HOST_GID:-$(id -g)}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

ERRORS=0

# ── Git hooks: ensure core.hooksPath points at tracked scripts/githooks ──
# Idempotent. Runs once per clone. Keeps the pre-commit hook in lockstep with
# the tracked source so a fix doesn't rot to one machine. See scripts/githooks/.
if [ "$(git config --get core.hooksPath 2>/dev/null)" != "scripts/githooks" ]; then
  git config core.hooksPath scripts/githooks
  ok "git core.hooksPath → scripts/githooks (first-time bootstrap)"
fi

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

DEFAULT_APP_URL="https://parthenon.acumenus.net"
ENV_FILE="$( cd "$(dirname "${BASH_SOURCE[0]}")" && pwd )/backend/.env"
SMOKE_BASE_URL="${DEPLOY_SMOKE_BASE_URL:-}"
if [ -z "$SMOKE_BASE_URL" ] && [ -f "$ENV_FILE" ]; then
  SMOKE_BASE_URL="$(grep '^APP_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" | tail -1)"
fi
SMOKE_BASE_URL="${SMOKE_BASE_URL:-$DEFAULT_APP_URL}"
SMOKE_BASE_URL="${SMOKE_BASE_URL%/}"
SMOKE_TIMEOUT="${DEPLOY_SMOKE_TIMEOUT:-15}"
DEPLOY_SKIP_SMOKE="${DEPLOY_SKIP_SMOKE:-false}"

smoke_check() {
  local label="$1"
  local path="$2"
  local expected_status="$3"
  local url="${SMOKE_BASE_URL}${path}"
  local status

  if status="$(curl -L -sS -o /dev/null -w '%{http_code}' --max-time "$SMOKE_TIMEOUT" "$url" 2>/dev/null)"; then
    :
  else
    status="CURL_FAILED"
  fi
  if [ "$status" = "$expected_status" ]; then
    ok "Smoke: ${label} -> ${status}"
  else
    fail "Smoke: ${label} -> expected ${expected_status}, got ${status} (${url})"
    ERRORS=$((ERRORS + 1))
  fi
}

service_exists() {
  docker compose config --services 2>/dev/null | grep -qx "$1"
}

restart_running_service() {
  local service="$1"
  local label="$2"

  if ! service_exists "$service"; then
    return 0
  fi

  if ! is_running "$service"; then
    warn "${service} is not running — skipped ${label}"
    return 0
  fi

  if docker compose restart "$service" >/dev/null 2>&1; then
    ok "$label"
  else
    fail "$label failed"
    ERRORS=$((ERRORS + 1))
  fi
}

clear_scribe_cache() {
  if is_running php; then
    docker compose exec -T php sh -lc 'rm -rf /var/www/html/.scribe/endpoints.cache' >/dev/null 2>&1 || true
  else
    rm -rf backend/.scribe/endpoints.cache
  fi
}

clear_runtime_caches() {
  echo ""
  echo "── Runtime cache reset (all deploy modes) ──"

  if is_running php; then
    echo "── PHP/Laravel runtime caches ──"
    if docker compose exec -T php php artisan optimize:clear && \
       docker compose exec -T php php artisan queue:restart; then
      ok "Laravel optimize caches cleared and queue restart signaled"
    else
      fail "Laravel runtime cache reset failed"
      ERRORS=$((ERRORS + 1))
    fi

    if service_exists horizon && is_running horizon; then
      if docker compose exec -T php php artisan horizon:terminate >/dev/null 2>&1; then
        ok "Horizon terminate signal sent"
      else
        warn "Could not send Horizon terminate signal"
      fi
    fi

    # Only reload php-fpm when PHP code or DB changed. Frontend-only deploys
    # don't need it, and a USR2 reload mid-request kills long-running jobs
    # (2026-04-12: killed an in-flight propensity-match at 82s → user saw 502).
    if $DO_PHP || $DO_DB || $DO_OPENAPI; then
      if docker compose exec -T php kill -USR2 1 2>/dev/null; then
        ok "php-fpm reloaded (USR2)"
      else
        warn "USR2 signal failed — restarting PHP container"
        if docker compose restart php >/dev/null 2>&1; then
          ok "PHP container restarted"
        else
          fail "PHP container failed to restart"
          ERRORS=$((ERRORS + 1))
        fi
      fi
    else
      ok "php-fpm reload skipped (frontend-only deploy)"
    fi
  fi

  if is_running nginx; then
    echo "── Nginx proxy cache ──"
    if docker compose exec -T nginx sh -lc 'rm -rf /tmp/nginx-dicom-cache/*' >/dev/null 2>&1; then
      ok "Nginx DICOM proxy cache cleared"
    else
      fail "Failed to clear Nginx DICOM proxy cache"
      ERRORS=$((ERRORS + 1))
    fi

    if docker compose exec -T nginx nginx -s reload >/dev/null 2>&1; then
      ok "Nginx reloaded"
    else
      warn "Nginx reload failed — restarting container"
      if docker compose restart nginx >/dev/null 2>&1; then
        ok "Nginx container restarted"
      else
        fail "Nginx container failed to restart"
        ERRORS=$((ERRORS + 1))
      fi
    fi
  fi

  restart_running_service reverb "Reverb runtime state reset"
  restart_running_service python-ai "AI runtime caches reset"
  restart_running_service blackrabbit "BlackRabbit scan cache reset"
  restart_running_service study-agent "Study Agent in-process caches reset"
  restart_running_service hecate "Hecate runtime caches reset"
  restart_running_service fhir-to-cdm "FHIR-to-CDM temp/runtime cache reset"
  restart_running_service orthanc "Orthanc metadata cache reset"
  restart_running_service solr "Solr query caches reset"
  restart_running_service chromadb "ChromaDB process caches reset"
  restart_running_service qdrant "Qdrant process caches reset"

  if service_exists darkstar && is_running darkstar; then
    local darkstar_url="http://127.0.0.1:${R_PORT:-8787}"
    curl -fsS --max-time 10 "${darkstar_url}/health" >/dev/null 2>&1 || true

    local darkstar_jobs=""
    if darkstar_jobs="$(curl -fsS --max-time 10 "${darkstar_url}/jobs/list" 2>/dev/null)" && \
       echo "$darkstar_jobs" | grep -Eq '"jobs"[[:space:]]*:[[:space:]]*\[[[:space:]]*\]'; then
      if docker compose restart darkstar >/dev/null 2>&1; then
        ok "Darkstar runtime caches reset"
      else
        fail "Darkstar runtime cache reset failed"
        ERRORS=$((ERRORS + 1))
      fi
    else
      warn "Darkstar has active jobs or jobs API is unavailable — skipped restart to avoid interrupting analyses"
    fi
  fi
}

echo "==> Parthenon deploy"

# ── Pull pre-built images from GHCR ───────────────────────────────────────────
# Images are built in CI (GitHub Actions) and pushed to ghcr.io/sudoshi/parthenon-*.
# Pulling here avoids local rebuilds and speeds up deploys significantly.
# If GHCR is unreachable or images don't exist yet, fall back to local images.
# Skip for targeted deploys (--php, --frontend, --db, --docs, --openapi)
# where no image changes are expected.
if $PHP_ONLY || $FRONTEND_ONLY || $DB_ONLY || $DOCS_ONLY || $OPENAPI_ONLY; then
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
  local container_id
  container_id="$(docker compose ps -q "$1" 2>/dev/null | head -n 1)"
  [ -n "$container_id" ] && [ "$(docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null)" = "true" ]
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
  echo "── PHP: runtime caches will be reset in the unified cache step ──"

  echo "── Laravel: creating storage symlink ──"
  if docker compose exec php php artisan storage:link 2>/dev/null || true; then
    ok "Storage symlink created"
  fi

  echo "── Generating API documentation ──"
  clear_scribe_cache
  if docker compose exec php php artisan scribe:generate --no-interaction 2>/dev/null; then
    ok "API docs generated → public/docs/"
  else
    warn "API docs generation failed (non-critical)"
  fi
fi

# ── Database migrations ───────────────────────────────────────────────────────
if $DO_DB; then
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
  # Show pending migrations so the operator knows what will run
  echo "   Pending migrations:"
  docker compose exec php php artisan migrate:status 2>/dev/null | grep -E '^\s*No\b' | sed 's/^/     /'

  # ── Schema-ownership preflight ────────────────────────────────────────────
  # Laravel migrations run as the connection's PG role. If that role does not
  # own the target tables (e.g., Docker PG `parthenon` role vs host-PG owner
  # `smudoshi`), ALTER TABLE fails with SQLSTATE 42501. The column may still
  # land later when someone re-runs as the correct owner, producing a
  # half-applied / silently-diverged schema.
  #
  # Refuse to migrate unless the connected role owns every schema the
  # migrations table records (`app`, `php`). Bypass with MIGRATE_SKIP_OWNER=1.
  if $DB_ONLY && [ "${MIGRATE_SKIP_OWNER:-0}" != "1" ]; then
    MIGRATE_USER=$(docker compose exec -T php sh -c \
      "cd /var/www/html && php artisan tinker --execute='echo DB::getConfig(\"username\");'" 2>/dev/null | tr -d '\r\n ')
    if [ -n "$MIGRATE_USER" ]; then
      # Check ownership of app.users and app.migrations — the two tables the
      # migrator needs ALTER / INSERT on.
      BAD_OWNERS=$(docker compose exec -T postgres psql -U "$MIGRATE_USER" -d parthenon -tAc \
        "SELECT schemaname||'.'||tablename||' owned by '||tableowner
         FROM pg_tables
         WHERE schemaname='app' AND tablename IN ('users','migrations')
           AND tableowner <> '$MIGRATE_USER';" 2>/dev/null)
      if [ -n "$BAD_OWNERS" ]; then
        fail "Schema ownership mismatch — migrator role '$MIGRATE_USER' does not own:"
        echo "$BAD_OWNERS" | sed 's/^/     /'
        echo "     Fix: ALTER TABLE <table> OWNER TO $MIGRATE_USER;  (as superuser)"
        echo "     Bypass: MIGRATE_SKIP_OWNER=1 ./deploy.sh --db"
        ERRORS=$((ERRORS + 1))
        OWNERSHIP_BLOCKED=1
      fi
    fi
  fi

  # --force is required in production (APP_ENV=production) to bypass the
  # interactive confirmation prompt, but we guard against destructive
  # migrations by requiring an explicit --db flag and the tripwire above.
  # To run migrations: ./deploy.sh --db  (never automatic in full deploy)
  #
  # Separation of duties: migrations run as parthenon_migrator (member of
  # parthenon_owner → can ALTER/DROP app+results tables). Runtime continues
  # to use parthenon_app (DML only, no DDL). If DB_MIGRATION_USERNAME is
  # unset, fall back to DB_USERNAME so legacy setups still work.
  MIG_USER=$(grep '^DB_MIGRATION_USERNAME=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tail -1)
  MIG_PW=$(grep   '^DB_MIGRATION_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tail -1)
  if $DB_ONLY && [ "${OWNERSHIP_BLOCKED:-0}" != "1" ]; then
    if [ -n "$MIG_USER" ] && [ -n "$MIG_PW" ]; then
      echo "   Migrating as: ${MIG_USER} (runtime app continues as DB_USERNAME from .env)"
      MIGRATE_CMD=(docker compose exec -T -e "DB_USERNAME=${MIG_USER}" -e "DB_PASSWORD=${MIG_PW}" php php artisan migrate --force)
    else
      warn "DB_MIGRATION_USERNAME/PASSWORD not set in backend/.env — migrating as runtime user (NOT RECOMMENDED)"
      MIGRATE_CMD=(docker compose exec php php artisan migrate --force)
    fi
    if "${MIGRATE_CMD[@]}"; then
      ok "Migrations applied"
    else
      fail "Migration failed"
      ERRORS=$((ERRORS + 1))
    fi
  elif ! $DB_ONLY; then
    warn "Migrations skipped — use ./deploy.sh --db to run explicitly"
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
  echo "── Frontend: clearing build cache ──"
  rm -rf frontend/dist
  rm -f frontend/node_modules/.tmp/tsconfig.app.tsbuildinfo frontend/node_modules/.tmp/tsconfig.node.tsbuildinfo
  ok "Frontend build cache cleared"

  echo "── Frontend: building production dist ──"

  # Strategy: try node container first (consistent env), then one-shot build
  # container for installer/fresh clones, then fall back to local npm.
  if is_running node; then
    if docker compose exec node sh -c "cd /app && npx vite build --mode production"; then
      ok "Frontend built (Docker node container)"
    else
      fail "Docker node build failed"
      ERRORS=$((ERRORS + 1))
    fi
  elif service_exists node; then
    warn "Node dev container not running — using one-shot Docker build"
    if docker compose run --rm --no-deps -T node sh -c "cd /app && npm ci --legacy-peer-deps && npx vite build --mode production"; then
      ok "Frontend built (one-shot Docker node container)"
    else
      fail "One-shot Docker node build failed"
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

  echo "── Frontend: fixing dist permissions for Apache ──"
  if [ -d frontend/dist ]; then
    if find frontend/dist -type d -exec chmod 755 {} + && \
       find frontend/dist -type f -exec chmod 644 {} +; then
      ok "Frontend dist permissions normalized"
    else
      fail "Failed to normalize frontend dist permissions"
      ERRORS=$((ERRORS + 1))
    fi
  else
    fail "frontend/dist not found after build"
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── Documentation build ───────────────────────────────────────────────────────
if $DO_DOCS; then
  echo ""
  echo "── Docs: regenerating OpenAPI spec before build ──"
  if is_running php; then
    clear_scribe_cache
    if docker compose exec php php artisan scribe:generate --no-interaction 2>/dev/null; then
      ok "OpenAPI spec regenerated"
    else
      warn "OpenAPI spec generation failed (using existing spec)"
    fi
  fi
  echo ""
  echo "── Docs: clearing build cache ──"
  # Preserve docs/site/build/ directory inode so nginx bind mount stays valid
  find docs/site/build -mindepth 1 -delete 2>/dev/null || true
  rm -rf docs/site/.docusaurus docs/site/node_modules/.cache
  ok "Docs build cache cleared"

  echo "── Docs: building Docusaurus site ──"
  if [ -f docs/site/package.json ]; then
    mkdir -p docs/site/build
    if docker compose --profile docs run --rm docs-build 2>&1 | sed 's/^/   /'; then
      # Nginx in Docker runs as UID 101 — build output must be world-readable
      chmod -R o+rX docs/site/build/
      ok "Docs built → docs/site/build"
    else
      fail "Docs build failed"
      ERRORS=$((ERRORS + 1))
    fi
  else
    warn "docs/site/package.json not found — skipping docs build"
  fi
fi

# ── OpenAPI spec export + TypeScript type generation ─────────────────────────
if $DO_OPENAPI; then
  echo ""
  echo "── OpenAPI: generating API docs and regenerating TypeScript types ──"
  echo "── Generating API documentation ──"
  clear_scribe_cache
  if docker compose exec php php artisan scribe:generate --no-interaction 2>/dev/null; then
    ok "API docs + OpenAPI spec generated → public/docs/"
  else
    warn "API docs generation failed (non-critical)"
  fi

  # Convert OpenAPI YAML to JSON for TypeScript type generator
  if [ -f backend/public/docs/openapi.yaml ]; then
    if python3 -c "import yaml, json, sys; print(json.dumps(yaml.safe_load(open(sys.argv[1])), indent=2))" backend/public/docs/openapi.yaml > backend/api.json 2>/dev/null; then
      ok "Spec exported → backend/api.json"
    else
      warn "YAML-to-JSON conversion failed (non-critical)"
    fi
  fi

  if is_running node; then
    if docker compose exec -T node sh -c "cat > /tmp/api.json && cd /app && OPENAPI_INPUT=/tmp/api.json npm run generate:api-types" < backend/api.json 2>/dev/null; then
      ok "Types generated → frontend/src/types/api.generated.ts"
    else
      warn "Type generation failed (non-critical)"
    fi
  else
    warn "Node container not running — skipping type generation"
  fi
fi

# ── Runtime cache reset (always) ────────────────────────────────────────────
clear_runtime_caches

# ── Guard: rebuild docs if build dir is empty ────────────────────────────────
# The docs/site/build/ directory is gitignored and can get wiped by git
# worktree operations or clean commands. Detect and rebuild automatically.
if ! $DO_DOCS && [ -f docs/site/package.json ]; then
  if [ ! -f docs/site/build/index.html ]; then
    echo ""
    echo "── Docs: build dir empty — rebuilding Docusaurus site ──"
    mkdir -p docs/site/build
    if docker compose --profile docs run --rm docs-build 2>&1 | sed 's/^/   /'; then
      chmod -R o+rX docs/site/build/
      ok "Docs rebuilt → docs/site/build"
    else
      fail "Docs rebuild failed"
      ERRORS=$((ERRORS + 1))
    fi
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

# ── Post-deploy smoke checks ─────────────────────────────────────────────────
if [ "$DEPLOY_SKIP_SMOKE" = "true" ]; then
  echo ""
  echo "── Smoke checks skipped (DEPLOY_SKIP_SMOKE=true) ──"
else
  echo ""
  echo "── Post-deploy smoke checks (${SMOKE_BASE_URL}) ──"

  if ! command -v curl >/dev/null 2>&1; then
    fail "curl is required for smoke checks"
    ERRORS=$((ERRORS + 1))
  else
    if $DO_FRONTEND || $DO_PHP || $DO_DB || $DO_OPENAPI; then
      smoke_check "frontend /" "/" "200"
      smoke_check "frontend /login" "/login" "200"
      smoke_check "frontend /jobs" "/jobs" "200"
    fi

    if $DO_PHP || $DO_DB || $DO_OPENAPI; then
      smoke_check "api /sanctum/csrf-cookie" "/sanctum/csrf-cookie" "204"
      smoke_check "api /api/v1/nonexistent-endpoint" "/api/v1/nonexistent-endpoint" "404"
    fi

    if $DO_DOCS; then
      smoke_check "docs /docs/" "/docs/" "200"
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "==> ${GREEN}Deploy complete.${NC}"
  exit 0
else
  echo -e "==> ${RED}Deploy failed with ${ERRORS} error(s).${NC}"
  exit 1
fi
