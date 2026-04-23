# Installer v2 Engine — Design Spec

**Date:** 2026-04-23
**Sub-project:** B of 3 (Installer milestone)
**Status:** Approved, pending implementation plan

---

## Goal

Replace the flat 9-phase Python CLI with a clean engine module that delivers:
- Full step-level idempotency and checkpointing (every sub-step is resumable)
- OS keychain-backed secret storage (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Docker native secrets injection (no plaintext `.env` files after install)
- Structured JSON progress events for the Tauri GUI
- Backward-compatible `--defaults-file` interface for Acropolis

---

## Current State

- `installer/cli.py` orchestrates 9 sequential phases via a flat list in `.install-state.json`
- Resume only works at phase boundaries — a failed phase restarts from the top of that phase
- All secrets (DB passwords, API keys, admin password) are written to plaintext `.env` files
- Tauri GUI streams raw subprocess stdout; no structured event format
- No rollback; partial installs require manual cleanup

---

## Approach: New Engine Module Alongside Existing CLI

`installer/engine/` is a new Python package. The existing `installer/cli.py` becomes a thin shim calling the engine. Nothing is deleted. Acropolis and any other callers of the existing interface are unaffected.

---

## Section 1: Engine Module Structure

```
installer/engine/
├── __init__.py
├── registry.py      # PhaseRegistry — ordered map of phase name → Phase(steps=[...])
├── runner.py        # StepRunner — executes steps, emits events, updates checkpoint
├── checkpoint.py    # CheckpointStore — reads/writes .install-state.json at step granularity
├── secrets.py       # SecretManager — OS keychain adapter + Docker secret writer
├── events.py        # ProgressEvent dataclass, JSON serializer for Tauri
└── phases/          # One file per phase; each registers its steps with PhaseRegistry
    ├── preflight.py
    ├── config.py
    ├── hecate.py
    ├── docker.py
    ├── bootstrap.py
    ├── datasets.py
    ├── frontend.py
    ├── solr.py
    └── admin.py
```

The `Context` object passed to every step carries: resolved config, `SecretManager` instance, subprocess runner, and progress event emitter. No globals.

---

## Section 2: Phase & Step Registry

### Step dataclass

```python
@dataclass
class Step:
    id: str                          # e.g. "docker.pull_images"
    name: str                        # e.g. "Pull Docker images"
    run: Callable[[Context], None]   # raises StepError on failure
    check: Callable[[Context], bool] # returns True if already done (safe to skip)
```

The `check` function is the idempotency guard. Examples:

| Step ID | check() logic |
|---|---|
| `docker.pull_images` | `docker image inspect postgres:16` exits 0 |
| `bootstrap.run_migrations` | `artisan migrate:status` shows all ran |
| `solr.index_vocabulary` | Solr `numDocs > 0` for vocabulary core |
| `admin.create_account` | `artisan tinker` confirms admin user exists |

Steps are registered at module import time. Adding a new phase means adding a new file to `phases/` — no changes to `runner.py` or `registry.py`.

### Phase ordering

The 9 phases and their step counts are fixed at registration time. `PhaseRegistry.all_step_ids()` returns the fully ordered flat list used to initialize the checkpoint store.

---

## Section 3: Checkpoint Store

### Schema (v2)

`.install-state.json` is upgraded from a flat list of completed phase names to a step-level map:

```json
{
  "schema_version": 2,
  "started_at": "2026-04-23T19:00:00Z",
  "steps": {
    "preflight.check_docker_version": "done",
    "preflight.check_ports": "done",
    "docker.pull_images": "done",
    "docker.start_containers": "failed",
    "docker.wait_healthy": "pending"
  },
  "last_error": {
    "step": "docker.start_containers",
    "message": "port 5432 already in use",
    "timestamp": "2026-04-23T19:04:12Z"
  }
}
```

### Step statuses

`pending` → `running` → `done` | `failed` | `skipped`

- `skipped`: `check()` returned True — step was already complete
- `running`: written before `run()` is called; a crash during `run()` leaves the step in `running`, treated as `failed` on resume

### Resume logic

`StepRunner` skips steps in `done` or `skipped` status. For `failed` or `running` steps, it calls `check()` first — if True, marks `skipped` and moves on; if False, re-runs `run()`. Steps in `pending` status run normally.

### Persistence

The file is written to disk after every step transition (not buffered in memory). `chmod 600`. Deleted on successful completion.

### Schema migration

On load, if `schema_version` is 1 (old format), `CheckpointStore` migrates: completed phases become all their steps marked `done`; the current phase's steps become `pending`.

---

## Section 4: Secret Manager

### Keychain backend

Uses the `keyring` Python library (cross-platform):
- macOS: Keychain
- Windows: Windows Credential Manager
- Linux: `libsecret` / `SecretService` (falls back to encrypted file if no keyring daemon)

Service name: `parthenon-installer`. Key names match env var names (`DB_PASSWORD`, `REDIS_PASSWORD`, `APP_KEY`, etc.).

### During config phase

Every generated secret is written to the keychain:

```python
secrets.set("DB_PASSWORD", generate_password(24))
secrets.set("REDIS_PASSWORD", generate_password(24))
secrets.set("APP_KEY", generate_app_key())
```

No secret touches a `.env` file during install.

### Docker secrets injection (no Swarm required)

`SecretManager.write_docker_secrets()` runs before `docker compose up`:

1. Reads each secret from keychain
2. Creates a tmpfs directory at `/run/parthenon-secrets/` (`mount -t tmpfs tmpfs /run/parthenon-secrets/ -o size=1m,mode=0700`; falls back to `tempfile.mkdtemp()` on platforms without tmpfs)
3. Writes one file per secret, `chmod 600`
4. Passes the secrets directory path to `docker compose up` via a generated override file `docker-compose.secrets.yml` (gitignored) that bind-mounts each file into the container at `/run/secrets/<name>`

`docker-compose.secrets.yml` is written fresh before every `docker compose up` and deleted after containers are healthy. The bind-mounted files persist as long as the containers run; the tmpfs directory is unmounted after a successful install.

A `docker/secrets-entrypoint.sh` script is committed to the repo and used as the entrypoint for all services:

```bash
#!/bin/sh
for f in /run/secrets/*; do
  [ -f "$f" ] && export "$(basename "$f")"="$(cat "$f")"
done
exec "$@"
```

This sources secrets into the process environment before the main process starts. No Swarm mode. No `docker secret create`.

### Acropolis credentials handoff

`SecretManager.export_credentials_file(path)` reads from keychain and writes `.install-credentials` (`chmod 600`) on demand. Acropolis reads the file, then calls `SecretManager.delete_credentials_file(path)` to remove it. Credentials never live on disk longer than the handoff window.

### Fallback

On headless systems with no keyring daemon (CI runners, minimal Linux), `SecretManager` falls back to an AES-256-GCM encrypted file at `~/.parthenon-secrets` with the encryption key derived from a machine-unique identifier (hostname + MAC address hash). This is weaker than a real keychain but stronger than plaintext `.env`.

---

## Section 5: JSON Progress Events

Every step transition emits a `ProgressEvent` as a single JSON line to stdout.

### ProgressEvent schema

```python
@dataclass
class ProgressEvent:
    type: str        # "step_start" | "step_done" | "step_skip" | "step_fail"
                     # | "phase_start" | "phase_done"
                     # | "install_done" | "install_fail" | "log"
    phase: str       # e.g. "docker"
    step: str | None # e.g. "docker.pull_images" (None for phase/install events)
    phase_index: int # 1-9
    phase_total: int # 9
    step_index: int  # within phase (0 for phase events)
    step_total: int  # within phase
    message: str     # human-readable label or log line
    elapsed_s: float # seconds since install started
```

### Example sequence

```json
{"type":"phase_start","phase":"docker","phase_index":4,"phase_total":9,"step_index":0,"step_total":5,"message":"Starting Docker phase","elapsed_s":12.3}
{"type":"step_start","phase":"docker","step":"docker.pull_images","phase_index":4,"phase_total":9,"step_index":1,"step_total":5,"message":"Pulling Docker images","elapsed_s":12.4}
{"type":"log","phase":"docker","step":"docker.pull_images","phase_index":4,"phase_total":9,"step_index":1,"step_total":5,"message":"Pulling postgres:16...","elapsed_s":14.1}
{"type":"step_skip","phase":"docker","step":"docker.pull_images","phase_index":4,"phase_total":9,"step_index":1,"step_total":5,"message":"Already pulled — skipping","elapsed_s":14.2}
{"type":"step_fail","phase":"docker","step":"docker.start_containers","phase_index":4,"phase_total":9,"step_index":2,"step_total":5,"message":"port 5432 already in use","elapsed_s":45.7}
{"type":"install_fail","phase":"docker","step":"docker.start_containers","phase_index":4,"phase_total":9,"step_index":2,"step_total":5,"message":"Installation failed. Run with --resume to continue.","elapsed_s":45.8}
```

### Tauri frontend rendering

- **Top bar**: 9-segment phase progress bar; completed phases filled, active phase pulsing
- **Below bar**: current phase name + current step name + elapsed time
- **Log panel**: scrollable, shows all `log` type events for the active step
- **On `step_fail`**: inline error card with message + Retry button (re-invokes subprocess with `--resume`)
- **On `step_skip`**: step shown with a ✓ icon and "skipped" label in muted color

---

## Section 6: Testing Strategy

### Unit tests (`installer/tests/test_engine_*.py`) — no Docker required

| File | Coverage |
|---|---|
| `test_engine_checkpoint.py` | Write/read/resume logic; schema v1→v2 migration; crash-recovery (step left in `running`) |
| `test_engine_registry.py` | All steps have unique IDs; `check()` signatures match |
| `test_engine_events.py` | ProgressEvent serialization; event ordering invariants; `phase_index`/`step_index` monotonicity |
| `test_engine_secrets.py` | SecretManager with mock keyring backend; set/get/export round-trips; fallback encrypted file |

### Integration tests (`installer/tests/test_engine_integration.py`) — require Docker, run in CI on Linux job

- Spin up postgres + redis only (minimal subset)
- Run `preflight`, `config`, and `docker` phases against the real Docker daemon
- Assert containers are healthy, secrets injected via `/run/secrets/`
- Assert re-running all phases marks every step `skipped`

### Contract tests (`installer/tests/test_engine_contract.py`) — validate Tauri interface

- Feed `--defaults-file` JSON through engine with mock executor
- Assert every emitted event is valid JSON matching `ProgressEvent` schema
- Assert `phase_index`/`step_index` counters are monotonically increasing
- Assert `install_done` is the final event on success

### Existing tests

`test_preflight.py`, `test_contract.py`, `test_webapp.py` are preserved and updated to call the new engine where they previously called the old CLI directly.

---

## Backward Compatibility

| Surface | Preserved |
|---|---|
| `--defaults-file <json>` CLI flag | Yes — shim passes to engine |
| `--non-interactive` flag | Yes |
| `--resume` flag | Yes — shim calls `CheckpointStore.load()` then `StepRunner.run(resume=True)` |
| `.install-credentials` file | Yes — `SecretManager.export_credentials_file()` writes on demand |
| `contract.py` JSON contract | Yes — unchanged |
| Old `.install-state.json` v1 format | Yes — `CheckpointStore` migrates on load |

---

## Out of Scope

- Installer v2 GUI redesign beyond the structured JSON event format (belongs in a future UI sub-project)
- Uninstall / removal workflow
- Multi-tenant install (multiple Parthenon instances on one machine)
- Existing OMOP CDM connection support — Sub-project C
