# Source Profiler Enhancement — Implementation Devlog

**Date:** 2026-03-25
**Module:** Source Profiler (ETL)
**Status:** Complete — all 3 phases shipped

## Summary

Transformed the Source Profiler from a transient WhiteRabbit scanning tool into the definitive source intelligence page. Three phases delivered in a single session:

- **Phase 1:** Server-side persistence, Achilles CDM context panel, phased scan progress, RBAC
- **Phase 2:** PII detection with advisory warnings, scan comparison with summary cards + drill-down diff
- **Phase 3:** FK relationship visualization with OMOP CDM-aware radial graph

## What Was Built

### Phase 1: Persistence + CDM Context + RBAC

**Backend:**
- 2 migrations repurposing `source_profiles` and `field_profiles` tables (relaxed NOT NULL constraints, added 9 new columns)
- `SourceProfilerService` — orchestrates WhiteRabbit scanning, normalizes response format, persists results with quality grading
- `SourceProfilerController` — 5 endpoints (index, show, scan, compare, destroy) with RBAC middleware
- `RunScanRequest` Form Request with validation
- RBAC: `profiler.view`, `profiler.scan`, `profiler.delete` permissions
- Rate limiting: `throttle:3,10` on scan endpoint

**Frontend:**
- `CdmContextPanel` — Achilles metrics overlay (person count, domain coverage, latest run)
- `ScanProgressIndicator` — phased progress with elapsed timer and cancel
- TanStack Query hooks for all profiler endpoints
- `SourceProfilerPage` switched from localStorage to server-side persistence
- `ScanHistorySidebar` switched to server-side data

**Issues discovered during verification:**
- WhiteRabbit expects flat payload (no `connection` wrapper) — fixed
- WhiteRabbit response uses `name` not `table_name` — normalized in service
- Route collision with patient profiles at `/sources/{source}/profiles/{personId}` — renamed to `/scan-profiles`

### Phase 2: PII Detection + Comparison

**Backend:**
- `PiiDetectionService` — two-pass detection (8 column name patterns + 4 sample value patterns)
- OMOP CDM allowlist: `_source_value` columns excluded from PII flagging
- PII sample values redacted before persistence (HIGHSEC compliance)
- `ScanComparisonService` — computes regressions (null% +5pp), improvements (null% -5pp), schema changes, with summary and detail arrays

**Frontend:**
- `PiiBadge` — red shield icon badge with PII type
- `ComparisonSummary` — 4 clickable filter cards (grade change, regressions, improvements, schema changes)
- `ComparisonDiff` — filterable detail table with color-coded rows
- `DataQualityScorecard` — PII column count metric added
- `ScanHistorySidebar` — compare checkboxes + "Compare Selected" button
- Comparison view mode integrated into main page

### Phase 3: FK Visualization

**Frontend:**
- `FkRelationshipGraph` — self-contained SVG radial graph (no D3 dependency)
- Infers FK relationships from `_id` column naming against 20 OMOP CDM tables
- Deduplicates `*_concept_id` variants to one edge per source table
- Layered layout: person at center, clinical events in rings, reference tables as satellites
- Domain-colored nodes, clickable to filter table list
- Collapsible section, only shown when >= 3 edges found

## Files Created

| File | Purpose |
|------|---------|
| `backend/database/migrations/2026_03_25_200000_*` | Schema changes for WhiteRabbit persistence |
| `backend/database/migrations/2026_03_25_200001_*` | Field profile table/row_count columns |
| `backend/app/Services/Profiler/SourceProfilerService.php` | Scan orchestration + persistence |
| `backend/app/Services/Profiler/PiiDetectionService.php` | Two-pass PII detection |
| `backend/app/Services/Profiler/ScanComparisonService.php` | Scan diff computation |
| `backend/app/Http/Controllers/Api/V1/SourceProfilerController.php` | API endpoints |
| `backend/app/Http/Requests/RunScanRequest.php` | Form request validation |
| `frontend/src/features/etl/components/CdmContextPanel.tsx` | Achilles metrics overlay |
| `frontend/src/features/etl/components/ScanProgressIndicator.tsx` | Phased progress UX |
| `frontend/src/features/etl/components/PiiBadge.tsx` | PII warning badge |
| `frontend/src/features/etl/components/ComparisonSummary.tsx` | Comparison summary cards |
| `frontend/src/features/etl/components/ComparisonDiff.tsx` | Comparison detail table |
| `frontend/src/features/etl/components/FkRelationshipGraph.tsx` | CDM relationship graph |
| `frontend/src/features/etl/hooks/useProfilerData.ts` | TanStack Query hooks |

## Files Modified

| File | Change |
|------|--------|
| `backend/app/Models/App/SourceProfile.php` | Added fillable, casts, source() relationship |
| `backend/app/Models/App/FieldProfile.php` | Added table_name, row_count to fillable |
| `backend/app/Models/App/Source.php` | Added sourceProfiles() relationship |
| `backend/routes/api.php` | Added scan-profiles route group + permission on /etl/scan |
| `backend/database/seeders/RolePermissionSeeder.php` | Added profiler permission domain |
| `frontend/src/features/etl/api.ts` | Added types + API functions for profiler + comparison |
| `frontend/src/features/etl/pages/SourceProfilerPage.tsx` | Server-side persistence, CDM panel, comparison, FK graph |
| `frontend/src/features/etl/components/ScanHistorySidebar.tsx` | Server-side history, compare checkboxes |
| `frontend/src/features/etl/components/DataQualityScorecard.tsx` | PII count metric |
| `frontend/src/features/etl/components/TableAccordion.tsx` | PII badge rendering |

## API Endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/sources/{source}/scan-profiles` | profiler.view | Scan history |
| GET | `/sources/{source}/scan-profiles/{profile}` | profiler.view | Scan detail |
| POST | `/sources/{source}/scan-profiles/scan` | profiler.scan | Run scan |
| GET | `/sources/{source}/scan-profiles/compare` | profiler.view | Compare scans |
| DELETE | `/sources/{source}/scan-profiles/{profile}` | profiler.delete | Delete scan |
