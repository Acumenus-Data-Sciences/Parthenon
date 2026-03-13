# GIS Data Import v2 — Devlog

**Date:** 2026-03-12 / 2026-03-13
**Branch:** `feature/fhir-omop-ig-compliance`
**Commits:** 12 (from `2f0da70f` to `204d1d5e`)

---

## What Was Built

A flexible, AI-assisted GIS data import system replacing the existing boundary-only `gis_datasets` panel. Users can now import arbitrary geospatial data (CSV, Excel, Shapefile, GeoJSON, KML, GeoPackage) through a 6-step wizard with Abby providing AI-powered column mapping suggestions.

### Architecture

- **Dual-database design:** Import tracking (`gis_imports`) lives in Docker PG 16; GIS data tables live in local PG 17. Cross-DB FK is impossible — application-level referential integrity via `import_id` BIGINT columns.
- **Three import modes:** Tabular + geography code, tabular + coordinates, geospatial native formats.
- **Streaming pipeline:** Two-pass `iterateFile()` generator avoids OOM on large files — first pass collects geo codes, second pass aggregates values.
- **Rollback strategy:** Simple DELETE for point features/exposures/stubs; snapshot-based restore for `geography_summary` (composite PK, multiple imports can update same row).

### Components Built

| Layer | Files | Purpose |
|-------|-------|---------|
| Database | `alter_schema_v2.sql`, Laravel migration | Global geography support (international location types), `gis_imports` table, `gis_point_feature` table |
| Permissions | `RolePermissionSeeder` | `gis.import` (admin + researcher), `gis.import.manage` (admin only) |
| Backend Services | `GisImportService`, `AbbyGisService` | File parsing, streaming CSV, geo code detection, geography matching, stub creation, rollback |
| Horizon Job | `GisImportJob` | Async two-pass import with Redis progress tracking, 30-min timeout |
| Validation | 3 Form Request classes | Upload (50MB, MIME whitelist), mapping (purpose enum), config (layer settings) |
| Controller | `GisImportController` | 11 endpoints under `v1/gis/import/` with auth + permission + throttle middleware |
| AI Service | `gis_import.py`, `abby_gis_analyzer.py` | Ollama+ChromaDB column analysis, geo file conversion via geopandas |
| Frontend | 11 files | TypeScript types, API functions, TanStack Query hooks, 6-step ImportWizard |
| Integration | `GisDataPanel.tsx` | "Data Import" tab alongside existing "Boundaries" tab |

### Abby AI Integration

- **Column analysis:** Sends file preview (20 rows + stats) to Ollama for semantic analysis
- **ChromaDB curated learning:** Only user-confirmed mappings stored; upsert by column_name key
- **Confidence thresholds:** >90% auto-applied (green), 50-90% suggested (amber), <50% manual (red)
- **Graceful fallback:** Rule-based heuristics when AI service is unavailable
- **"Ask Abby" per-column:** Users can ask Abby about any column inline during mapping

### Import Wizard (6 Steps)

1. **Upload** — Drag-and-drop with 50MB browser limit, CLI fallback for larger files
2. **Analyze** — Abby analyzes columns with loading state and conversational summary
3. **Map Columns** — Two-column layout with confidence badges and Ask Abby button
4. **Configure** — Layer name, exposure type, geography level, value type, aggregation
5. **Validate** — Dry-run match stats, stub creation warning, back navigation
6. **Import** — Progress bar (2s polling), log output, completion with Abby learning prompt

## Key Decisions

1. **Streaming over batch loading:** `iterateFile()` generator yields rows lazily to handle files of any size without OOM risk.
2. **`validateImport()` not `validate()`:** Renamed to avoid shadowing Laravel's `ValidatesRequests` trait method.
3. **Route ordering:** Non-parameterized `/history` and `/upload` routes placed before `/{import}` wildcard to prevent matching conflicts.
4. **HTTP for geo conversion:** Geospatial files sent to FastAPI AI service via HTTP (geopandas/fiona) rather than spawning Python subprocesses from PHP container.
5. **Application-level FK:** `import_id` is a plain BIGINT, not a database FK, because `gis_imports` and GIS data live in separate PostgreSQL instances.

## Gotchas & Fixes

- **`.gitignore` blocking GIS services:** Root `GIS/` pattern matched `backend/app/Services/GIS/`. Fixed by anchoring to `/GIS/`.
- **OOM in GisImportJob:** Original plan called `previewFile($path, $format, PHP_INT_MAX)`. Fixed with streaming generator.
- **Missing rate limiting:** Added `throttle:5,60` to route group middleware per spec requirement.
- **Temp file cleanup:** Added `@unlink()` in both success and failure paths of GisImportJob.

## Testing

- `GisImportTest.php`: 5 unit tests (preview CSV, iterate file streaming, detect geo code type, column stats, Excel format error)
- TypeScript: `npx tsc --noEmit` passes clean
- All 11 Laravel routes verified via `artisan route:list`
- Frontend build succeeds (`vite build` in 9.5s)

## Files Changed

### Created (28 files)
- `scripts/gis/alter_schema_v2.sql`
- `backend/database/migrations/2026_03_12_000001_create_gis_imports_table.php`
- `backend/app/Models/App/GisImport.php`
- `backend/app/Services/GIS/GisImportService.php`
- `backend/app/Services/GIS/AbbyGisService.php`
- `backend/app/Jobs/GisImportJob.php`
- `backend/app/Http/Requests/GisImportUploadRequest.php`
- `backend/app/Http/Requests/GisImportMappingRequest.php`
- `backend/app/Http/Requests/GisImportConfigRequest.php`
- `backend/app/Http/Controllers/Api/V1/GisImportController.php`
- `backend/tests/Feature/GisImportTest.php`
- `ai/app/routers/gis_import.py`
- `ai/app/services/abby_gis_analyzer.py`
- `frontend/src/features/administration/types/gisImport.ts`
- `frontend/src/features/administration/api/gisImportApi.ts`
- `frontend/src/features/administration/hooks/useGisImport.ts`
- `frontend/src/features/administration/components/gis-import/ImportWizard.tsx`
- `frontend/src/features/administration/components/gis-import/UploadStep.tsx`
- `frontend/src/features/administration/components/gis-import/AnalyzeStep.tsx`
- `frontend/src/features/administration/components/gis-import/MappingStep.tsx`
- `frontend/src/features/administration/components/gis-import/ConfigureStep.tsx`
- `frontend/src/features/administration/components/gis-import/ValidateStep.tsx`
- `frontend/src/features/administration/components/gis-import/ImportStep.tsx`
- `docs/superpowers/specs/2026-03-12-gis-data-import-v2-design.md`
- `docs/superpowers/plans/2026-03-12-gis-data-import-v2.md`

### Modified (4 files)
- `backend/database/seeders/RolePermissionSeeder.php` — added GIS import permissions
- `backend/routes/api.php` — added 11 GIS import routes
- `ai/app/main.py` — registered gis_import router
- `frontend/src/features/administration/components/GisDataPanel.tsx` — added Data Import tab
