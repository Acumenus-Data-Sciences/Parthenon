# GIS Data Loading to Local PostgreSQL 17

**Date:** 2026-03-11
**Branch:** feature/chromadb-abby-brain

## What Was Built

### GIS Boundary Data Pipeline
- Loaded 51,140 administrative boundaries from GADM v4.1 into local PG 17 (`ohdsi.app.gis_admin_boundaries`):
  - ADM0: 263 countries
  - ADM1: 3,661 provinces/states
  - ADM2: 47,216 districts/counties
- Host-side Python loader script (`scripts/load-gis-boundaries.py`) using SQL-filtered geopandas reads (~7s per level vs loading entire 2.7GB file)

### Architecture Decisions
- **Data loading runs on the host, not in Docker.** The Python AI service was crashing with OOM trying to load GADM data. The host has direct access to local PG 17 via Unix socket peer auth and sufficient memory for geopandas.
- **Python AI service handles spatial queries only** — reads from local PG 17 via `GIS_DATABASE_URL` env var (`host.docker.internal:5432/ohdsi`).
- **Browser-triggered loads** create a `gis_datasets` record in Docker PG and return a CLI command for the user to run on the host. The script supports `--dataset-id` for progress tracking visible in the frontend.

### Frontend & Backend Changes
- `JobProgressModal` — reusable modal component for any browser-launched job (dark theme, gold progress bar, live timer, auto-scrolling log)
- `GisDataPanel` — admin panel showing boundary stats, load controls, and CLI command modal with copy-to-clipboard
- `GisController::loadDataset()` — creates dataset record, returns CLI command instead of dispatching Docker job
- Dedicated `gis` Horizon queue supervisor (timeout 1800s, 512MB memory, 1 process)
- Migration adding `progress_percentage`, `log_output`, `user_id`, `levels_requested` to `gis_datasets`
- Dataset status polling endpoint (`GET /gis/datasets/{id}`) with 2s refetch interval

### Documentation & Installer
- Docusaurus chapter: Part XIII — GIS Explorer (`docs/site/docs/part13-gis/31-gis-explorer.mdx`)
- Abby help sidebar: 8 GIS tips (`backend/resources/help/gis.json`)
- Installer: PostGIS verification step, GIS summary line, next-step instructions

## Gotchas
- PostGIS extension installed in `app` schema — scripts need `search_path=app,public` to find spatial functions
- asyncpg doesn't support `options` query parameter — use `connect_args={"server_settings": {"search_path": "..."}}` instead
- Local PG 17 uses peer auth on Unix sockets but scram-sha-256 for TCP — set password for Docker container access
- Docker PG port is 5480 (mapped from 5432 inside container)

## Files Changed
- `scripts/load-gis-boundaries.py` (new) — host-side GADM/geoBoundaries loader
- `ai/app/services/gis_spatial_query.py` — uses `GIS_DATABASE_URL` for local PG reads
- `ai/app/services/gis_boundary_loader.py` — same `GIS_DATABASE_URL` change
- `docker-compose.yml` — added `GIS_DATABASE_URL` to python-ai service
- `backend/app/Jobs/Gis/LoadGisBoundariesJob.php` (new) — queue job with Process shell-out
- `backend/app/Http/Controllers/Api/V1/GisController.php` — CLI command approach
- `backend/config/horizon.php` — dedicated gis queue supervisor
- `frontend/src/components/ui/JobProgressModal.tsx` (new) — reusable progress modal
- `frontend/src/features/administration/components/GisDataPanel.tsx` (new) — admin panel
- Plus migration, types, API, hooks, docs, help, installer updates
