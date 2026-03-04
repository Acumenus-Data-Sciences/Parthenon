# Phase 15 — Eunomia Dataset, Multi-Source Achilles & Dashboard CDM Summary

**Date:** 2026-03-03
**Branch:** master

---

## Summary

Added the OHDSI Eunomia GiBleed synthetic dataset as a second data source alongside the existing OHDSI Acumenus (1M patients). Built multi-source Achilles support via dynamic PostgreSQL schema switching. Added a CDM characterization summary section to the main Dashboard with a source selector dropdown.

---

## What Was Built

### 1. Eunomia Dataset Loader (`parthenon:load-eunomia`)

**New file:** `backend/app/Console/Commands/LoadEunomiaCommand.php`

An artisan command that:
1. Downloads `GiBleed_5.3.zip` from the OHDSI EunomiaDatasets GitHub repo (or accepts `--path` for local zip)
2. Creates `eunomia` schema and loads 20 CDM tables (343,279 rows total) from CSV files
3. Creates `eunomia_results` schema with Achilles result tables
4. Runs **mini-Achilles SQL** — 20+ analysis groups computed via direct PostgreSQL queries (no R dependency):
   - Demographics: analyses 0, 2, 3, 4, 5, 10
   - Observation periods: analyses 101, 103, 105, 108, 109, 111, 113
   - Domain record counts: analyses 200, 400, 600, 700, 800, 1800
   - Monthly trends, type distributions, gender distributions per domain
5. Seeds "Eunomia (Demo)" source with 3 daimons: CDM→eunomia, Vocab→omop (shared), Results→eunomia_results

**Result:** 2,694 patients, 64,476 Achilles result rows, 2 distribution rows.

### 2. Multi-Source Achilles Support

**Modified:** `backend/app/Services/Achilles/AchillesResultReaderService.php`

Added `setSchemaForSource(Source $source)` method that dynamically sets `search_path` on the `results` DB connection based on the source's results daimon `table_qualifier`:

```php
private function setSchemaForSource(Source $source): void
{
    $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
    $schema = $daimon?->table_qualifier ?? 'achilles_results';
    DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
}
```

Called at the start of every public method. Three methods that previously lacked a `$source` parameter (`getDistribution`, `getAvailableAnalyses`, `getPerformanceReport`) were updated.

**Modified:** `backend/app/Http/Controllers/Api/V1/AchillesController.php` — passes `$source` to the updated methods.

### 3. Dashboard CDM Characterization Summary

**Modified:** `frontend/src/features/dashboard/pages/DashboardPage.tsx`

New section between the metric row and two-column panels:
- **Source selector dropdown** — reuses existing `SourceSelector` component
- **4 CDM metric cards** — Persons (with sparkline), Median Obs Duration, Total Events, Data Completeness
- **Gender proportional bar** — reuses `ProportionalBar` chart
- **Age pyramid** — compact height (220px), reuses `DemographicsPyramid`
- **"View Full Characterization →"** link to Data Explorer
- **Auto-selects first source** — beginners see CDM data immediately

**Modified:** `frontend/src/features/data-explorer/components/charts/DemographicsPyramid.tsx` — added optional `height` prop (default 320).

### 4. Docker Build Fix

**Modified:** `docker/node/Dockerfile` — added `--legacy-peer-deps` to `npm ci` and `npm install` for react-joyride React 19 compatibility.

---

## Key Technical Decisions

### CSV-to-PostgreSQL Text Format Preprocessing
Eunomia CSVs use comma-delimited format with quoted empty strings for nullable fields. PostgreSQL's `pgsqlCopyFromFile` uses text format (tab-delimited). Solution: preprocess with `fgetcsv()` to parse CSV properly, convert empty fields to `__EUNOMIA_NULL__` unique marker, output tab-delimited text.

### Mini-Achilles via SQL (No R Dependency)
Instead of requiring R/HADES to run full Achilles, the loader computes the ~20 key analyses needed for the dashboard directly via PostgreSQL SQL. This keeps the installation beginner-friendly.

### Shared Vocabulary
Eunomia's bundled vocabulary CSVs (tiny subset) are skipped. The source's vocab daimon points to the existing `omop` schema with the full 7.2M concept vocabulary.

### Schema Switching (Not Model Switching)
Rather than creating separate model classes per source, we use `SET search_path` on the existing `results` connection. This is stateless per-request and requires no Eloquent changes.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/app/Console/Commands/LoadEunomiaCommand.php` | **New** — Eunomia loader command |
| `backend/app/Services/Achilles/AchillesResultReaderService.php` | Added schema switching, `Source` param to 3 methods |
| `backend/app/Http/Controllers/Api/V1/AchillesController.php` | Pass `$source` to updated methods |
| `frontend/src/features/dashboard/pages/DashboardPage.tsx` | Added CDM characterization section |
| `frontend/src/features/data-explorer/components/charts/DemographicsPyramid.tsx` | Added `height` prop |
| `docker/node/Dockerfile` | `--legacy-peer-deps` for React 19 compat |

---

## Verification

- Eunomia source: `curl /api/v1/sources` returns both "OHDSI Acumenus" (id=6) and "Eunomia (Demo)" (id=7)
- Multi-source: Acumenus returns 1,005,787 persons; Eunomia returns 2,694 persons
- TypeScript: `npx tsc --noEmit` → 0 errors
- Vite build (local): success (2.52s)
- Docker node build: success with `--legacy-peer-deps`
- Docker Vite build: success (3.07s)

---

## Data Summary

| Source | Persons | Achilles Rows | Distribution Rows |
|--------|---------|---------------|-------------------|
| OHDSI Acumenus | 1,005,787 | 1.8M | Many |
| Eunomia (Demo) | 2,694 | 64,476 | 2 |
