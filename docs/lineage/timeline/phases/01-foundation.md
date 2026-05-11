# Phase 1: Foundation - Development Log

**Date:** 2026-03-01
**Branch:** `master` (legacy archived to `archive/legacy`)
**Files Changed:** ~180 new files (excluding vendor/node_modules)
**Status:** Complete, verified end-to-end

---

## Overview

Phase 1 establishes the complete development infrastructure for Parthenon, replacing the legacy OHDSI Atlas fork (Knockout.js + Java Spring Boot WebAPI) with a modern monorepo containing four services: Laravel 11 API, React 18 SPA, Python FastAPI AI service, and R Plumber analytics runtime. All eight Docker services build, start, and pass health checks.

---

## What Was Built

### Step 0: Legacy Code Archive

Archived 1,176 legacy files to the `archive/legacy` branch. The master branch was cleaned to contain only `.git/`, `LICENSE`, and `PLAN.md` before greenfield work began.

### Step 1: Monorepo Root Structure

Created the shared configuration layer:

- **`.gitignore`** - Comprehensive for all four service ecosystems (PHP vendor, node_modules, __pycache__, .env files, Docker data volumes, IDE files)
- **`.editorconfig`** - 4-space indent for PHP, 2-space for JS/TS/JSON/YAML, LF line endings, tabs for Makefile
- **`.dockerignore`** - Prevents .git, node_modules, vendor, __pycache__ from entering build context
- **`.env.example`** - Configurable host port mapping, DB password, Ollama settings
- **`Makefile`** - Convenience targets: `up`, `down`, `build`, `fresh`, `logs`, `shell-*`, `test`, `lint`
- **`README.md`** - Quickstart guide with prerequisites and architecture overview

### Step 2: Docker Infrastructure (12 files)

Eight-service Docker Compose orchestration:

| Service | Image | Internal Port | Host Port (default) |
|---------|-------|---------------|---------------------|
| nginx | nginx:1.27-alpine | 80 | 8082 |
| php | php:8.4-fpm-alpine (custom) | 9000 | - |
| node | node:22-alpine (custom) | 5173 | 5175 |
| postgres | pgvector/pgvector:pg16 | 5432 | 5480 |
| redis | redis:7-alpine | 6379 | 6381 |
| python-ai | python:3.12-slim (custom) | 8000 | 8002 |
| r-runtime | rocker/r-ver:4.4 (custom) | 8787 | 8787 |
| horizon | reuses php image | - | - |

**Key design decisions:**
- All host ports are configurable via environment variables (e.g., `NGINX_PORT`, `POSTGRES_PORT`) to avoid conflicts with local services
- Health checks on all stateful services with appropriate start periods
- Node service uses `profiles: [dev]` so it only starts explicitly
- Horizon reuses the PHP image with a different command (`php artisan horizon`)
- Python AI service gets `extra_hosts: ["host.docker.internal:host-gateway"]` for Ollama connectivity
- PostgreSQL init script creates four schemas: `app`, `vocab`, `cdm`, `results` and enables the `vector` extension

**Supporting Dockerfiles:**
- `docker/php/Dockerfile` - Two-stage layer caching: composer dependencies first, then application code
- `docker/node/Dockerfile` - npm ci with anonymous volume for node_modules isolation
- `docker/python/Dockerfile` - pip install from requirements.txt, uvicorn with --reload
- `docker/r/Dockerfile` - System deps (libpq, libsodium, zlib), R packages (plumber, jsonlite, DBI, RPostgres, httr2)
- `docker/nginx/default.conf` - Reverse proxy: `/api` + `/sanctum` + `/horizon` -> PHP-FPM, `/ai/` -> Python, `/r/` -> R, `/` -> Vite/SPA fallback

### Step 3: Backend - Laravel 11 (~90 files including framework)

**Packages installed:**
- Core: `sanctum`, `horizon`, `spatie/laravel-permission`, `doctrine/dbal`, `laravel/pennant`, `pgvector/pgvector`
- Dev: `pestphp/pest`, `pest-plugin-laravel`, `larastan/larastan`, `laravel/pint`

**Application structure:**
```
backend/app/
  Enums/DaimonType.php          - String-backed enum: cdm, vocabulary, results, temp
  Http/Controllers/Api/V1/
    HealthController.php         - Aggregated health: DB, Redis, AI service, R runtime
    AuthController.php           - Sanctum token auth: register, login, user, logout
    SourceController.php         - Full CRUD with nested daimon creation
  Http/Middleware/
    ForceJsonResponse.php        - Ensures all API responses are JSON
  Http/Requests/Api/
    LoginRequest.php             - Email + password validation
    StoreSourceRequest.php       - Source + daimons validation with conditional unique
  Models/App/
    Source.php                   - Soft deletes, encrypted password, daimons relationship,
                                   getTableQualifier() with vocabulary->CDM fallback
    SourceDaimon.php             - DaimonType enum cast, belongs to Source
  Models/Cdm/
    CdmModel.php                - Abstract read-only base (throws on create/update/delete)
  Models/Vocabulary/
    Concept.php                  - Stub for Phase 2 vocabulary search
  Services/
    AiService.php                - HTTP client to Python AI (encode, search, map concepts)
    RService.php                 - HTTP client to R runtime (estimation, prediction)
```

**Database configuration:**
- Three PostgreSQL connections: `pgsql` (app schema), `cdm`, `vocab`
- All connections configurable via environment variables with sensible defaults
- Redis for cache, queues, and sessions

**API routes (`/api`):**
- `GET /health` - Public health check with all service statuses
- `POST /v1/auth/register`, `POST /v1/auth/login` - Public auth endpoints
- `GET /v1/auth/user`, `POST /v1/auth/logout` - Protected (auth:sanctum)
- `apiResource /v1/sources` - Full CRUD, protected
- 501 stubs for `/v1/vocabulary/search`, `/v1/cohort-definitions`, `/v1/concept-sets`

**Migrations:**
- Extended `users` table: avatar, provider, provider_id, last_login_at
- `sources`: source_name, source_key (unique), source_dialect, source_connection, encrypted password, soft deletes
- `source_daimons`: FK to sources (cascade), daimon_type, table_qualifier, priority, unique(source_id, daimon_type)

**Tests (Pest):**
- `HealthCheckTest` - Health endpoint returns 200 with ok status
- `AuthTest` - Register, login, profile, logout, and unauthenticated access flows

**Static analysis:** PHPStan level 6 with Larastan, zero errors.

### Step 4: Frontend - React 18 + TypeScript (~30 files)

**Stack:** Vite 6, React 18, TypeScript, TailwindCSS v4, React Router v6, Zustand, TanStack Query, Axios

**Application structure:**
```
frontend/src/
  app/App.tsx                    - QueryClientProvider + RouterProvider
  app/router.tsx                 - Full navigation with 13 routes + PlaceholderPage
  lib/api-client.ts              - Axios with auth interceptor, 401 redirect
  lib/query-client.ts            - TanStack Query client configuration
  lib/utils.ts                   - cn() helper (clsx + tailwind-merge)
  stores/authStore.ts            - Zustand + persist: token, user, isAuthenticated
  stores/uiStore.ts              - Sidebar collapsed state, theme
  components/layout/
    MainLayout.tsx               - Sidebar + header + outlet
    Sidebar.tsx                  - Full nav with lucide-react icons, active highlighting
    Header.tsx                   - User menu, breadcrumbs placeholder
  features/auth/pages/LoginPage.tsx
  features/dashboard/pages/DashboardPage.tsx     - Stats cards
  features/data-sources/
    api/sourcesApi.ts            - TanStack Query hooks for sources CRUD
    pages/SourcesListPage.tsx    - Table with loading/empty states
  types/api.ts, models.ts       - TypeScript interfaces
```

**Router structure:**
`/login` | `/` (dashboard) | `/data-sources` | `/ingestion` | `/data-explorer` | `/vocabulary` | `/cohort-definitions` | `/concept-sets` | `/analyses` | `/studies` | `/profiles` | `/jobs` | `/admin`

**Vite configuration:**
- Path alias `@` -> `./src`
- Proxy `/api` and `/sanctum` to `http://nginx:80` (Docker internal)
- Vitest integration via `/// <reference types="vitest/config" />`

### Step 5: Python AI Service (~15 files)

**Stack:** FastAPI, Pydantic Settings, httpx, Ollama client

**Key decision:** User specified Ollama with MedGemma for the demo, not a generic LLM abstraction.

**Structure:**
```
ai/app/
  main.py                        - FastAPI with CORS, router mounts
  config.py                      - Pydantic Settings: ollama_base_url, ollama_model, timeouts
  routers/
    health.py                    - GET /health with Ollama status check
    embeddings.py                - POST /encode, /search (501 stubs for Phase 2)
    concept_mapping.py           - POST /map using Ollama/MedGemma
    clinical_nlp.py              - POST /extract (501 stub)
  services/
    ollama_client.py             - check_ollama_health(), generate_concept_mapping()
    sapbert.py, medcat.py, ensemble_ranker.py  - Stubs for Phase 2+
```

**Ollama integration:**
- Health endpoint checks `/api/tags` for model availability, reports model status
- Concept mapping sends structured prompts to `/api/generate` requesting JSON output
- Default model: `MedAIBase/MedGemma1.5:4b` (configurable via `OLLAMA_MODEL` env var)

### Step 6: R Plumber Runtime (4 files)

```
r-runtime/
  plumber_api.R     - Entry point: creates pr(), mounts routers, runs on 0.0.0.0:8787
  api/health.R      - GET /health with R version info
  api/stubs.R       - POST /estimation, /prediction, /feature-extraction, /self-controlled (501)
  R/db.R            - Database connection helper stub
```

### Step 7: CI/CD (`.github/workflows/ci.yml`)

Four parallel GitHub Actions jobs:
1. **backend** - PHP 8.4, Postgres 16 + Redis 7 services, composer install, Pint check, PHPStan, Pest
2. **frontend** - Node 22, npm ci, tsc --noEmit, lint, vitest, vite build
3. **ai** - Python 3.12, pip install, mypy, pytest
4. **docker** - Build all 4 Dockerfiles (no push), runs after other jobs pass

---

## Issues Encountered and Resolutions

### 1. Composer SQLite Error
**Problem:** `composer create-project` defaulted to SQLite, causing `SQLSTATE[HY000]: could not find driver` when running artisan commands.
**Fix:** Changed `DB_CONNECTION=pgsql` in `.env` before installing packages.
**Lesson:** Always set the database driver before running any artisan commands in a fresh Laravel project.

### 2. Pest Version Conflict
**Problem:** `pestphp/pest v4.x` required `phpunit ^12` but Laravel 11 shipped with `phpunit ^11`.
**Fix:** Used `composer require --dev -W` flag to allow dependency upgrades.
**Lesson:** The `-W` (with-all-dependencies) flag is essential when installing packages that need to upgrade transitive dependencies.

### 3. PHPStan Level 6 Errors (15 errors)
**Problem:** Missing generic type annotations on `HasFactory`, `HasMany`, `BelongsTo` traits; undefined property access on `Model`; missing array value type annotations.
**Fixes:**
- Added PHPDoc `@return HasMany<SourceDaimon, $this>` on relationship methods
- Added `/** @var SourceDaimon|null */` inline annotations for property access
- Added `@return array<string, mixed>` and `@param list<string>` on service methods
- Added baseline ignore for `HasFactory` generic type (Laravel framework limitation): `'#uses generic trait .+HasFactory but does not specify its types#'`
**Lesson:** PHPStan level 6 with Laravel requires explicit generic type annotations on all Eloquent relationships and inline type assertions for dynamic property access.

### 4. Vite/Vitest Config Type Error
**Problem:** `npm run build` failed because the `test` property in `vite.config.ts` was not recognized by Vite's type definitions.
**Fix:** Added `/// <reference types="vitest/config" />` at the top of `vite.config.ts`.
**Lesson:** Vitest's config type augmentation must be explicitly referenced when using a unified vite.config.ts.

### 5. Docker Port Conflicts
**Problem:** Host machine had services running on ports 80, 5432, 5433, 6379, 6380, 5173, and 8000.
**Fix:** Made all host ports configurable via environment variables with non-conflicting defaults (8082, 5480, 6381, 5175, 8002).
**Lesson:** Never hardcode host ports in docker-compose.yml. Always use `${VAR:-default}` syntax with high-numbered defaults to avoid conflicts.

### 6. PHP Version Mismatch in Docker
**Problem:** Composer dependencies were installed locally with PHP 8.4 but Docker image used PHP 8.3, causing `Your Composer dependencies require a PHP version ">= 8.4.0"`.
**Fix:** Upgraded Docker image from `php:8.3-fpm-alpine` to `php:8.4-fpm-alpine`.
**Lesson:** Docker PHP version must match (or exceed) the version used for `composer install`. Pin these to the same version.

### 7. R Plumber Installation Failure (zlib.h)
**Problem:** `httpuv` (a dependency of `plumber`) failed to compile because `zlib.h` was missing.
**Fix:** Added `zlib1g-dev` to the R Dockerfile's apt-get install line. Also added `libsodium-dev` for the `sodium` package.
**Lesson:** R packages with C/C++ compilation need system-level development libraries. The `plumber` dependency chain requires at minimum: `libcurl4-openssl-dev`, `libssl-dev`, `libxml2-dev`, `libsodium-dev`, `zlib1g-dev`. Also: never use `dependencies=TRUE` with `install.packages()` in Docker - it pulls in hundreds of optional packages. Use the default (`NA`) which installs only hard dependencies.

### 8. R Plumber Routing (404 on /health)
**Problem:** `plumb("api/health.R")` assigned to `pr` worked as the root router, but mounting at "/" lost the `/health` path.
**Fix:** Changed `plumber_api.R` to use `pr()` constructor for the root, then `pr$mount("/", plumb("api/health.R"))` for proper sub-router mounting.
**Lesson:** Plumber's `plumb()` returns a router object. When used as the root directly, sub-routes work. When mounting under a path, use `pr()` as the root and mount all route files explicitly.

### 9. Laravel Unique Validation with PostgreSQL
**Problem:** `'unique:sources,source_key,'.$sourceId` where `$sourceId` is `null` generated `unique:sources,source_key,` which PostgreSQL rejected as `invalid input syntax for type bigint: ""`.
**Fix:** Used `Rule::unique()` with conditional `->ignore()`:
```php
$uniqueKey = Rule::unique('sources', 'source_key');
if ($sourceId) {
    $uniqueKey = $uniqueKey->ignore($sourceId);
}
```
**Lesson:** Never concatenate null IDs into Laravel's string-based unique validation rule with PostgreSQL. The strict type system rejects empty strings as bigint. Always use `Rule::unique()` with conditional ignore.

### 10. DaimonType Enum Value Mismatch
**Problem:** API accepted integer daimon types (0, 1, 2, 3) but `DaimonType` was a string-backed enum (`'cdm'`, `'vocabulary'`, etc.), causing `"0" is not a valid backing value for enum`.
**Fix:** Updated validation to accept string values matching the enum: `'in:cdm,vocabulary,results,temp'`.
**Lesson:** Always align API validation rules with the model's enum backing type. If the enum is string-backed, the API must accept strings.

### 11. OPcache Serving Stale Code
**Problem:** After editing PHP files on the host (volume-mounted), the Docker PHP-FPM container continued serving cached bytecode.
**Fix:** Added `opcache.revalidate_freq = 0` to `php.ini` so opcache checks file modification times on every request in development.
**Lesson:** OPcache with `validate_timestamps=1` still caches for `revalidate_freq` seconds (default 2). Set to 0 for development with volume mounts.

### 12. Ollama Model Name Discovery
**Problem:** Default model name `medgemma` didn't match the actual Ollama model tag `MedAIBase/MedGemma1.5:4b`.
**Fix:** Updated defaults in `config.py`, `docker-compose.yml`, and `.env.example` to use the exact Ollama model tag.
**Lesson:** Ollama model tags include the namespace and version. Always verify with `ollama list` and use the exact tag string.

---

## Verification Results

All checks passing:

| Check | Result |
|-------|--------|
| `pint --test` | PASS |
| `phpstan analyse` (level 6) | PASS (0 errors) |
| `tsc --noEmit` | PASS |
| `vitest run` | PASS (1 test) |
| `vite build` | PASS (1.10s) |
| `docker compose config` | PASS |
| `docker compose build` (all 5 images) | PASS |
| `docker compose up` (all 8 services) | PASS (all healthy) |
| `php artisan migrate` | PASS (9 migrations) |
| `GET /api/health` | `{"status":"ok","services":{"database":"ok","redis":"ok","ai":"ok","darkstar":"ok"}}` |
| `GET :8002/health` | AI OK, MedGemma connected |
| `GET :8787/health` | Darkstar OK (4.4.3) |
| Auth flow (register/login/profile/logout) | PASS |
| Source CRUD with nested daimons | PASS |
| React SPA on Vite dev server | PASS |

---

## Architecture Notes for Phase 2

1. **Source/SourceDaimon pattern** mirrors the legacy Java WebAPI exactly. `getTableQualifier()` includes the vocabulary->CDM fallback behavior.
2. **CdmModel** is a read-only abstract base. Phase 2 will extend it for `Person`, `ConditionOccurrence`, etc.
3. **Concept.php** stub is ready for vocabulary search (Phase 2).
4. **AI service** has Ollama integration working. Phase 2 will add SapBERT embeddings and MedCAT NER pipelines.
5. **R runtime** stubs are ready for HADES package integration (CohortMethod, PatientLevelPrediction, FeatureExtraction).
6. **Frontend router** has all 13 navigation routes with PlaceholderPage components ready to be replaced.
7. **Horizon** is configured for three queue supervisors: `default`, `ai`, `long-running` - ready for async job processing.

---

## File Count Summary

| Directory | Files | Description |
|-----------|-------|-------------|
| Root | 8 | .gitignore, .editorconfig, .dockerignore, .env.example, Makefile, README.md, docker-compose.yml, PLAN.md |
| docker/ | 7 | Dockerfiles (4), nginx conf, php.ini, www.conf, init.sql |
| .github/ | 1 | CI/CD workflow |
| backend/ | ~90 | Laravel 11 application (including framework-generated files) |
| frontend/ | ~30 | React 18 SPA |
| ai/ | ~18 | FastAPI AI service |
| r-runtime/ | 4 | R Plumber runtime |
| docs/ | 1 | This devlog |
| **Total** | **~160** | (excluding vendor, node_modules, __pycache__, dist) |
