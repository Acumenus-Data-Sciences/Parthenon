# Parthenon Python Installer — Devlog

**Date:** 2026-03-03
**Scope:** Cross-platform one-command installer with Rich TUI

---

## What Was Built

A fully self-contained Python installer (`python install.py`) that takes a
user from zero to a running Parthenon instance in one command. No manual
`.env` editing, no copy-pasting artisan commands, no Docker knowledge required.

### File inventory

| File | Purpose |
|------|---------|
| `install.py` | Entry point — bootstraps `rich` + `questionary` via pip before importing them |
| `installer/cli.py` | Orchestrates all 8 phases; state persisted to `.install-state.json` |
| `installer/preflight.py` | 10 system checks in a Rich table (Python, Docker, ports, disk, existing install) |
| `installer/config.py` | Interactive questionary wizard → writes `.env` + `backend/.env` + `.install-credentials` |
| `installer/docker_ops.py` | `pull` → `build` → `up -d` → live health table with per-service timeout polling |
| `installer/bootstrap.py` | `key:generate`, `migrate`, `db:seed`, `admin:create` (non-interactive) |
| `installer/eunomia.py` | `pg_restore` eunomia.pgdump into Docker postgres → `eunomia:seed-source` |
| `installer/utils.py` | OS detection, subprocess helpers, port/disk/docker/container utilities |
| `backend/app/Console/Commands/CreateAdminCommand.php` | `php artisan admin:create --email --name --password --force` |
| `backend/app/Console/Commands/SeedEunomiaSourceCommand.php` | `php artisan eunomia:seed-source` (idempotent) |

### Modified files

- `docker/postgres/init.sql` — Added `eunomia` schema + GRANT
- `docker-compose.yml` — Added `./docker/fixtures:/fixtures:ro` volume to postgres
- `.gitignore` — Added `.install-credentials`, `.install-state.json`, `installer/__pycache__/`

### New directories / fixtures

- `docker/fixtures/` — Mount point for `eunomia.pgdump` (committed as `.gitkeep`)

---

## 8-Phase Flow

1. **Preflight** — Python ≥ 3.9, Docker ≥ 24, Compose v2, daemon running, ports free, disk ≥ 5 GB, no existing install
2. **Config** — questionary prompts with sensible defaults; auto-generates DB and admin passwords; writes both `.env` files; saves credentials to `.install-credentials`
3. **Docker** — pull → build → `up -d` → polls per-service health with a live Rich table
4. **Laravel bootstrap** — `key:generate --force`, `migrate --force`, `db:seed --force`
5. **Eunomia** — `pg_restore` into eunomia schema (skips gracefully if fixture absent), then `eunomia:seed-source`
6. **Frontend** — `docker compose run --rm --no-deps -T node sh -c "npm ci && vite build"`
7. **Admin** — `php artisan admin:create --email --name --password --force`
8. **Complete** — Rich Panel summary with URL, credentials note, and next steps

---

## Key Design Decisions

### Resume-on-failure
`.install-state.json` tracks completed phase names. On re-run, user is prompted to resume from where they left off or start over. Every artisan command uses `--force` for idempotency.

### Dependency bootstrapping
`install.py` imports only stdlib, then calls `pip install rich questionary` before importing them. No `requirements.txt` needed — `python install.py` just works.

### Non-interactive artisan commands
The existing `admin:seed` command is interactive (asks for email/password via prompts), so a new `admin:create` command was added with `--email`, `--name`, `--password`, `--force` options. The existing command is untouched.

### Config derives multiple values automatically
- `SESSION_DOMAIN` — extracted from APP_URL (empty for localhost)
- `SANCTUM_STATEFUL_DOMAINS` — APP_URL host + all localhost variants
- `APP_DEBUG` / `LOG_LEVEL` — flip based on local vs production env selection
- `DB_HOST=postgres`, `REDIS_HOST=redis` — Docker internal names always

---

## Learnings & Gotchas

### 1. Node container has `profiles: [dev]`
The `node` service in `docker-compose.yml` has `profiles: [dev]`, so `docker compose up -d` doesn't start it. `docker compose exec -T node ...` would fail with "no container" on **all platforms**.

**Fix:** Use `docker compose run --rm --no-deps -T node sh -c "..."` instead of `exec`. The `--no-deps` flag prevents it from trying to start linked services again; `--rm` cleans up the one-shot container afterward.

### 2. `cmd.split()` is fragile for args with spaces
`utils.exec_php("php artisan admin:create --name=Admin User")` would silently break because `.split()` doesn't handle quoted substrings. Safe only for fixed commands with no whitespace in values.

**Pattern used:** For commands where argument values could contain spaces (e.g., admin name), build the list explicitly in the caller (`bootstrap.py`), bypassing `exec_php`'s internal split.

### 3. `chmod(0o600)` is a no-op on Windows
`Path.chmod()` doesn't restrict access on Windows (no Unix permission model). Not worth working around in an installer context — the file still gets created and is functionally usable. Just a note for security-conscious users.

### 4. `shutil.which('docker')` finds `docker.exe` on Windows
Python's `shutil.which` automatically respects `PATHEXT` on Windows, so it finds `docker.exe` without any special handling. No need for a `docker_binary()` helper that appends `.exe`.

### 5. `import grp` (Linux docker-group check)
`grp` is a Unix-only stdlib module. Import is deferred inside the `user_in_docker_group()` function body, which is guarded by an early `return True` on macOS and Windows, so it never executes on those platforms.

### 6. `pg_restore` exit code 1 ≠ failure
`pg_restore` exits 1 when there are non-fatal warnings (e.g., roles already exist). The eunomia loader checks `stderr` for the word "error" before treating a non-zero exit as a real failure, matching how the tool behaves in practice.

### 7. Eunomia fixture is not committed
`docker/fixtures/eunomia.pgdump` must be generated separately (from OHDSI Eunomia R package or CDMConnector releases). The installer handles missing fixture gracefully: prints generation instructions, skips the phase, and continues. This avoids blocking the installer on a large binary.

---

## Cross-Platform Status

| Platform | Status |
|----------|--------|
| macOS (Docker Desktop) | ✓ Should work — Docker Desktop provides `host.docker.internal` natively |
| Linux (Docker Engine) | ✓ Should work — `extra_hosts: host-gateway` already in compose |
| Windows (Docker Desktop + Python 3.11) | ✓ Should work — use `python install.py` (not `python3`) |

---

---

## VM Test Session — 2026-03-04

### Environment
- **Host:** acumenus-test / `192.168.1.33`, Ubuntu 24.04, 15 GB RAM, 48 GB disk
- **Docker:** Native Docker Engine 29.2.1, Compose v5.1.0 (not Docker Desktop)
- **Python:** 3.12.7

### What happened
Session crashed immediately after preflight completed (`.install-state.json` contained `{"completed_phases": ["preflight"], "config": {}}`). No `.env` files were written, no containers were ever started. On reconnect, disk showed 94% full (2.8 GB free) but recovered to 78% (11 GB free) — likely a Docker build cache prune occurred between checks.

All 4 Parthenon Docker images were already cached from the previous session (`parthenon-php:latest`, `parthenon-node:latest`, `parthenon-python-ai:latest`, `parthenon-r-runtime:latest`). Repo was pulled to `c22bc40b`.

### Critical bug discovered: nginx not configured to serve the React SPA

**Problem:** In the existing nginx config, `root /var/www/html/public` (Laravel backend) was the only root. There was no volume mount or location block to serve `frontend/dist/` — the React SPA build output. The `location /` fell through to `index.php`, which serves the default Laravel welcome page, NOT the Parthenon React app.

This worked at `parthenon.acumenus.net` because Apache sits in front and serves `frontend/dist` directly, proxying only `/api/` to Docker nginx. But for a **standalone Docker install** (the installer's use case), nginx must serve the React SPA itself.

**Fix:**
1. Updated `docker/nginx/default.conf` — changed all PHP-served routes (`/api`, `/sanctum`, `/horizon`, `/docs/api`) to forward directly to php-fpm with hardcoded `SCRIPT_FILENAME /var/www/html/public/index.php` (no root dependency). Changed `location /` to `root /var/www/frontend; try_files $uri $uri/ /index.html` for SPA routing.
2. Added `./frontend/dist:/var/www/frontend:ro` to nginx volumes in `docker-compose.yml`.
3. Added `frontend/dist/.gitkeep` (with `!frontend/dist/.gitkeep` in `.gitignore`) so the directory exists on fresh clone before the first Vite build.

**Key lesson:** The production Apache setup masks a missing Docker-native frontend serving configuration. Any fresh Docker-only deploy would have shown the Laravel default welcome page instead of the Parthenon login screen.

### Manual bootstrap (config phase was not completed by installer)

Because the session crashed before config was answered, the env files were written manually for the VM:

- `APP_URL=http://192.168.1.33:8082`
- `SANCTUM_STATEFUL_DOMAINS=192.168.1.33,192.168.1.33:8082,localhost,localhost:8082`
- `DB_HOST=postgres`, `DB_DATABASE=parthenon`, `DB_USERNAME=parthenon`
- `SESSION_DOMAIN=null` (cookie set to request domain)

Bootstrap sequence executed manually via SSH:
```bash
docker compose up -d
# wait for services healthy (~60s)
docker compose exec -T php composer install --no-dev --optimize-autoloader
docker compose exec -T php php artisan key:generate --force
docker compose exec -T php php artisan migrate --force
# CRITICAL: Must recreate php container after key:generate so env_file reloads APP_KEY
# docker compose restart does NOT reload env_file — only docker compose up -d (recreate) does
docker compose up -d php
docker compose exec -T php php artisan db:seed --class=DatabaseSeeder --force
docker compose run --rm --no-deps -T node sh -c "cd /app && npm ci --legacy-peer-deps && npx vite build --mode production"
docker compose exec -T php php artisan admin:create --email=admin@parthenon.local --name=Admin --password=ParthenomTest2026 --force
# Fix storage permissions if needed (fresh clone may have wrong ownership)
docker compose exec -T php chown -R www-data:www-data storage bootstrap/cache
```

Login screen verified at `http://192.168.1.33:8082` — React SPA title `<title>Parthenon</title>` confirmed.
API working: `GET /api/v1/sources` returns `{"message":"Unauthenticated."}` (correct — auth guard active).

### Critical Gotcha: `docker compose restart` vs `up -d` for env_file reload

`docker compose restart` does **not** reload `env_file` entries into the container process environment. The env vars are set at **container creation time** (`docker compose up`). After running `php artisan key:generate --force` (which writes APP_KEY to `backend/.env`), the running PHP container still has the old empty APP_KEY in its process env.

**Symptom:** `php artisan db:seed` throws `No application encryption key has been specified` even though `backend/.env` shows `APP_KEY=base64:...`.

**Fix:** `docker compose up -d php` (recreates the container, re-reading env_file from disk). Then wait for healthy and run the seeder.

---

## TODOs / Future Work

- **Git LFS tracking** for `docker/fixtures/eunomia.pgdump` once file is generated (`git lfs track "*.pgdump"`)
- **`--non-interactive` flag** on `install.py` for CI/CD or scripted installs (pass config via env vars)
- **Uninstall mode** — `python install.py --uninstall` to stop containers and optionally wipe volumes
- **Upgrade mode** — detect existing install, run only `migrate` + `db:seed` + frontend rebuild

---

## Installer Hardening Pass — 2026-03-04

Three show-stopping bugs were identified from the VM test session above. The installer completed all 8 phases without visible error messages but left the system non-functional. All three have been fixed.

### Bug 1 — Missing `composer install` (Bootstrap fails silently on fresh clone)

**Root cause:** The PHP Dockerfile installs `vendor/` inside the image at build time. However `docker-compose.yml` bind-mounts `./backend:/var/www/html` at runtime, which **shadows** the image's `vendor/` with the host directory. On a fresh clone, `backend/vendor/` does not exist on the host, so the container sees no `vendor/autoload.php`. Every artisan command fails immediately with a Composer autoload error.

**Symptom:** `php artisan key:generate` fails in the first line of bootstrap — but the installer was catching the error without surfacing it clearly, so all 8 phases showed green.

**Fix:** Step 1 of the new 6-step bootstrap sequence runs `composer install --no-dev --optimize-autoloader --no-interaction` inside the running php container before any artisan commands. Added to `installer/bootstrap.py::run_laravel_bootstrap()`.

**Preflight addition:** `installer/preflight.py` now has an informational (non-blocking) check for `backend/vendor/`. If absent, it prints "Not found — will run composer install automatically in Phase 4 (normal on fresh clone)" rather than failing.

### Bug 2 — APP_KEY not reloaded into running container after `key:generate`

**Root cause:** `docker compose env_file` is processed at **container creation time** (`docker compose up`). After `php artisan key:generate --force` writes `APP_KEY=base64:...` to `backend/.env`, the already-running PHP container's process environment still contains the old empty `APP_KEY`. `docker compose restart` reuses the same container and does **not** re-read env_file.

**Symptom:** `php artisan db:seed` throws `No application encryption key has been specified` because models with `encrypted:array` casts try to decrypt before INSERT.

**Fix:** After `key:generate`, the bootstrap now runs `docker compose up -d php` (container recreation, not restart) to force env_file reload, then calls `utils.wait_healthy("parthenon-php", timeout_s=90)` before continuing. Also runs `php artisan config:clear` to purge any stale cached empty APP_KEY.

**New utility:** `installer/utils.py` now exports `wait_healthy(container_name, timeout_s, *, console)` — polls `container_health()` every 3 seconds until `healthy/running` or timeout. Returns bool.

### Bug 3 — Storage directory permissions (HTTP 500 on all API calls)

**Root cause:** On a fresh install, `backend/storage/` and `backend/bootstrap/cache/` may be owned by the host user or root (from Docker build layers). PHP-FPM runs as `www-data` and cannot write view cache, session files, or logs.

**Symptom:** Every API endpoint returns HTTP 500 even though all containers appear healthy. `docker compose logs php` shows `Permission denied` on `storage/framework/views/`.

**Fix:** Step 6 of the bootstrap sequence runs `chown -R www-data:www-data storage bootstrap/cache` and `chmod -R 775 storage bootstrap/cache` inside the php container. These are non-fatal (errors are captured and printed as warnings, not hard failures).

### Summary: `run_laravel_bootstrap()` before → after

| Before (3 steps) | After (6 steps) |
|-----------------|-----------------|
| 1. `key:generate` | 1. `composer install` |
| 2. `migrate` | 2. `key:generate` |
| 3. `db:seed` | 3. `docker compose up -d php` + `wait_healthy` + `config:clear` |
| | 4. `migrate` |
| | 5. `db:seed` |
| | 6. `chown/chmod storage` |

### Demo credentials button fix

**Problem:** The login page had a "Fill demo credentials" button hardcoded to `admin@parthenon.local` / `superuser`. In a fresh installer run the admin email and password are chosen interactively by the user.

**Fix:** `installer/config.py::write()` now creates `frontend/.env.local` with:
```
VITE_DEMO_EMAIL=<admin_email>
VITE_DEMO_PASSWORD=<admin_password>
```
`frontend/.gitignore` already has `*.local` so this file is never committed. The frontend Vite build bakes the values into the JS bundle. `LoginPage.tsx` now reads `import.meta.env.VITE_DEMO_EMAIL` and `import.meta.env.VITE_DEMO_PASSWORD`, and only renders the "Fill demo credentials" button when both vars are set (empty in dev clones or production deployments without the installer).

### `must_change_password` set for installer-created admin

The `run_create_admin()` function now runs a psql UPDATE after `admin:create` to set `must_change_password = true` for the new admin user. This ensures the Setup Wizard's "Security" (Change Password) step fires on first login, prompting the installer-created admin to replace the auto-generated password with a permanent one.
