# Solr Integration — Phase 9: Installer Updates

**Date:** 2026-03-06
**Scope:** Update the Parthenon installer (`install.py` + `installer/` package) to provision and populate Solr on new deployments

## What Was Built

### 9.1 — Configuration Wizard (`installer/config.py`)

- Added "Enable Apache Solr for high-performance search?" prompt (default: Yes)
- Added `SOLR_PORT` and `SOLR_JAVA_MEM` to advanced port settings (only shown when Solr enabled)
- Added `enable_solr`, `solr_port`, `solr_java_mem` to the config dict
- `build_root_env()` now includes `SOLR_PORT` and `SOLR_JAVA_MEM` when Solr is enabled
- `build_backend_env()` now includes all `SOLR_*` Laravel config values:
  - `SOLR_ENABLED`, `SOLR_HOST`, `SOLR_PORT`, `SOLR_TIMEOUT`
  - `SOLR_CORE_VOCABULARY`, `SOLR_CORE_COHORTS`, `SOLR_CORE_ANALYSES`, `SOLR_CORE_MAPPINGS`, `SOLR_CORE_CLINICAL`

### 9.2 — Docker Health Polling (`installer/docker_ops.py`)

- Extracted `BASE_SERVICES` and `SOLR_SERVICE` constants
- Added `_get_services(cfg)` helper that conditionally includes Solr in health polling
- `wait_for_services()` and `run()` now accept an optional `cfg` parameter
- When Solr is enabled, the installer waits for `parthenon-solr` to become healthy before proceeding

### 9.3 — Solr Indexing Phase (`installer/cli.py`)

Inserted a new Phase 7 between Frontend (Phase 6) and Admin Account (now Phase 8):

- **Always indexes:** `vocabulary` core (highest-impact, 7M+ concepts)
- **Conditionally indexes:** `cohorts` and `analyses` cores (only when Eunomia demo data was loaded)
- **Non-fatal:** Indexing failures warn but don't abort the install — users can re-index via Admin → System Health → Solr
- **Skippable:** When `enable_solr=false`, the phase prints "Skipped" and moves on

### 9.4 — Phase Renumbering

| Old Phase | New Phase | Description |
|-----------|-----------|-------------|
| Phase 1 | Phase 1 | Preflight |
| Phase 2 | Phase 2 | Configuration (+ Solr prompts) |
| Phase 3 | Phase 3 | Docker (+ Solr health polling) |
| Phase 4 | Phase 4 | Laravel Bootstrap |
| Phase 5 | Phase 5 | Eunomia Demo Data |
| Phase 6 | Phase 6 | Frontend Build |
| *(new)* | **Phase 7** | **Solr Indexing** |
| Phase 7 | Phase 8 | Admin Account |
| Phase 8 | Phase 9 | Complete |

### 9.5 — Summary Banner Updates

When Solr is enabled, the completion banner now shows:
- `Solr: http://localhost:8983/solr/` in the status section
- "Re-index Solr cores: Admin → System Health → Solr → Manage Solr Cores" in next steps

### 9.6 — Preflight Port Check

Added port 8983 to `REQUIRED_PORTS` in `preflight.py` so the installer warns if Solr's port is already in use.

### 9.7 — Resume Compatibility

The `.install-state.json` state file tracks completed phases by name (e.g., `"solr"`). Adding a new phase is backward-compatible — previous installs without `"solr"` in their completed list will run it on resume.

## Files Modified
- `installer/config.py` — Solr prompt, env vars in both `.env` files
- `installer/docker_ops.py` — Solr health polling, `_get_services()` helper
- `installer/cli.py` — Solr indexing phase, renumbered to 9 phases, summary banner
- `installer/bootstrap.py` — Phase label updated from 7 to 8
- `installer/preflight.py` — Port 8983 added to checks

## Verification
- All 5 installer modules import cleanly (`python3 -c "import installer.cli"`)
- All 5 modules compile without errors (`py_compile`)
- Phase state names are unique and backward-compatible
- Solr indexing is non-fatal (failures warn, don't abort)
- Config defaults match existing `config/solr.php` and `docker-compose.yml`

## Solr Implementation Plan — All 9 Phases Complete

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Infrastructure Setup | Done |
| 2 | Vocabulary Search Core | Done |
| 3 | Cohort & Study Discovery | Done |
| 4 | Analysis Results & Data Explorer | Done |
| 5 | Concept Mapping & Ingestion | Done |
| 6 | Clinical Data Search | Done |
| 7 | Global Search / Cmd+K | Done |
| 8 | Documentation, Help, Admin + System Health Drilldown | Done |
| 9 | Installer Updates | Done |
