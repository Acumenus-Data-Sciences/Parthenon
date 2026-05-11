# Docker Reliability Hardening

**Date:** 2026-03-04
**Branch:** main

---

## Summary

Comprehensive reliability audit and hardening of the Docker architecture. Addressed 20 identified fragility points including cascading failure chains, missing dependencies, worker exhaustion, unpinned packages, and silent build failures.

---

## Root Causes Fixed

### 1. PHP-FPM Worker Exhaustion (Critical)
**Before:** Default Alpine FPM config — 5 max_children, no max_requests, no slow log.
**After:** `www.conf` now configures:
- `pm.max_children = 20` (4× capacity)
- `pm.start_servers = 4`, `min_spare = 2`, `max_spare = 8`
- `pm.max_requests = 500` (recycles workers, prevents memory leaks)
- `request_slowlog_timeout = 10s` (logs slow requests to stderr for diagnostics)
- `request_terminate_timeout = 300s` (matches php.ini max_execution_time)

### 2. Redis Dependency Chain (Critical)
**Before:** PHP and Horizon started without waiting for Redis. Sessions, cache, and queues silently failed.
**After:** Both `php` and `horizon` services have `depends_on: redis: condition: service_healthy`. Redis must be healthy before anything that depends on it starts.

### 3. Horizon Healthcheck (Critical)
**Before:** No healthcheck on Horizon. Crash-looped silently.
**After:** `php artisan horizon:status | grep -q running` healthcheck every 15s.

### 4. Deploy Script Fragility (High)
**Before:** `set -e` + `docker compose exec` on potentially-stopped containers = abort on first failure. Node container in `dev` profile but `exec` assumed it was running.
**After:**
- Pre-flight checks verify containers are running before exec
- Attempts to auto-start core services if PHP is down
- Falls back to local `npx vite build` if node container unavailable
- Per-section error counting instead of global abort
- Colored output for visual clarity

### 5. Silent Build Failures (High)
**Before:** `composer install || true` and `composer dump-autoload || true` in PHP Dockerfile masked broken builds.
**After:** Removed `|| true` — build fails visibly if dependencies can't be installed.

### 6. Unpinned PHP-FPM Healthcheck (High)
**Before:** Downloaded from `master` branch of a third-party GitHub repo.
**After:** Pinned to `v0.5.0` release tag.

### 7. R Dockerfile Version Pinning (High)
**Before:** 15+ R packages installed from rolling-release r-universe with no version pins.
**After:** Every OHDSI package pinned via `remotes::install_version()`:
- DatabaseConnector 7.1.0, SqlRender 1.19.4, Andromeda 1.2.0
- Cyclops 3.6.0, FeatureExtraction 3.12.0, CohortMethod 6.0.0
- PatientLevelPrediction 6.5.1, SelfControlledCaseSeries 6.1.1
- EvidenceSynthesis 1.1.0, CohortGenerator 1.1.0, ParallelLogger 3.5.1
- ResultModelManager 0.6.2, EmpiricalCalibration 3.1.4
- Python: scikit-learn 1.6.1, numpy 2.2.3, xgboost 2.1.4, lightgbm 4.6.0

### 8. Memory Limits (Medium)
**Before:** No limits on any container. OOM killer could hit anything.
**After:**
- PHP: 1G, Postgres: 1G, Redis: 512M, Horizon: 512M
- Python AI: 4G, R runtime: 4G

### 9. Redis DB Collision (Medium)
**Before:** AI service and Laravel cache both on Redis DB 1.
**After:** AI service moved to DB 2. Laravel cache stays on DB 1, default on DB 0.

### 10. AI Service Network Round-Trip (Medium)
**Before:** `AI_SERVICE_URL=http://host.docker.internal:8002` — PHP exited Docker, hit host network, re-entered Docker.
**After:** `AI_SERVICE_URL=http://python-ai:8000` — direct Docker network communication.

### 11. R Runtime Port (Low)
**Before:** Hardcoded `8787:8787`.
**After:** Configurable via `${R_PORT:-8787}`.

---

## Files Modified

| File | Changes |
|------|---------|
| `docker/php/www.conf` | Complete rewrite — FPM worker tuning |
| `docker-compose.yml` | Redis depends_on, memory limits, Horizon healthcheck, R port var |
| `deploy.sh` | Complete rewrite — pre-flight checks, fallback logic, error recovery |
| `docker/php/Dockerfile` | Pin healthcheck v0.5.0, remove `\|\| true` |
| `docker/r/Dockerfile` | Pin all 14 OHDSI packages + 4 Python packages |
| `ai/app/config.py` | Redis DB 1 → DB 2 |
| `backend/.env` | AI service URL → Docker service name |

## Files Deleted

| File | Reason |
|------|--------|
| `docker/docs/Dockerfile` | Unused — docker-compose uses inline `node:22-alpine` |
| `docs/errors/` | Stale R build error log from original Dockerfile failure |

---

## Verification

- All 5 core services healthy: postgres, redis, php, nginx, horizon
- Dependency chain works: Redis → PHP → Horizon (verified via `docker compose up` logs)
- Login-to-dashboard: ~300ms (no regression)
- Health endpoint returns all green
- 8GB of stale Docker resources pruned
