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

## TODOs / Future Work

- **Git LFS tracking** for `docker/fixtures/eunomia.pgdump` once file is generated (`git lfs track "*.pgdump"`)
- **`--non-interactive` flag** on `install.py` for CI/CD or scripted installs (pass config via env vars)
- **Uninstall mode** — `python install.py --uninstall` to stop containers and optionally wipe volumes
- **Upgrade mode** — detect existing install, run only `migrate` + `db:seed` + frontend rebuild
