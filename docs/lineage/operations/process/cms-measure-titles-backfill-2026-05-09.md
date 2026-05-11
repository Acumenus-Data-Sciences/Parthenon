---
doc_type: lineage
status: historical
date: 2026-05-09
owner: acumenus
module: care-bundles
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# CMS eCQM Measure Titles Backfill

**Date:** 2026-05-09
**Scope:** Care Bundles → CMS Measures page data quality fix
**Severity:** Low (cosmetic — page loaded, but title column showed `—` for all 72 rows)

## Problem

`/workbench/care-bundles/measures` rendered every row's Measure column as `—`. Users saw 72 entries identifiable only by CMS ID (e.g., "CMS122v14") with no human-readable name.

## Root Cause

`scripts/importers/ingest_vsac.py` line 155 hardcoded `"title": None` when populating `app.vsac_measures`:

```python
measure_row = {
    "cms_id": cms_id,
    "cbe_number": get(row, "cbe_number"),
    "program_candidate": get(row, "program_candidate"),
    "title": None,  # ← every row, every import
    "expansion_version": get(row, "expansion_version"),
}
```

The CMS-published VSAC value-set spreadsheets (`dqm_vs_*.xlsx`, `ec_hospip_*.xlsx`) do not carry the eCQM measure title alongside the value-set rows — they only have CMS ID, CBE number, program candidate, and the value-set OIDs/codes. The importer had no source for titles and stored `NULL`.

The frontend (`CareBundleVsacMeasuresPage.tsx`) correctly rendered `—` for missing titles. Bug was in the data layer, not the UI.

## Fix Strategy

Backfill from authoritative public CMS data sources, separate from the value-set import pipeline:

| Source | Coverage | Notes |
|---|---|---|
| `CMSgov/qpp-measures-data` (2025) | 47/72 | Eligible-clinician eCQMs in the QPP catalog |
| `cqframework/dqm-content-qicore-2025` | +21/72 | Hospital + dQM FHIR Measure resources |
| `cqframework/ecqm-content-qicore-2025` | (overlap) | Same titles, FHIR-flavored |
| `cqframework/ecqm-content-cms-2025` | (overlap) | CMS-flavored FHIR exports |
| `cqframework/ecqm-content-qicore-2023` + `2024-subset` | +2/72 | CMS529 (Hybrid HWR), CMS844 (Hybrid HWM) |
| **Total** | **72/72** | No gaps |

cqframework FHIR Measure resources append `FHIR` to titles (e.g., `Diabetes: Glycemic Status Assessment Greater Than 9%FHIR`). Stripped during normalization.

## Implementation

**1. Curated JSON map** — `backend/database/data/vsac_measure_titles.json`

Single source of truth, sorted by CMS ID, easy to update manually if CMS publishes new versions:

```json
{
  "CMS122v14": "Diabetes: Glycemic Status Assessment Greater Than 9%",
  "CMS124v14": "Cervical Cancer Screening",
  "CMS125v14": "Breast Cancer Screening",
  ...
}
```

**2. Idempotent Artisan command** — `backend/app/Console/Commands/VsacBackfillMeasureTitles.php`

```bash
php artisan vsac:backfill-measure-titles            # default: skip rows with non-empty titles
php artisan vsac:backfill-measure-titles --overwrite # force-update all
php artisan vsac:backfill-measure-titles --dry-run   # preview only
php artisan vsac:backfill-measure-titles --file=... # alternate JSON path
```

Reports: `updated`, `skipped_existing`, `not_in_db`, `unmapped_in_db_still_blank`. Lists DB CMS IDs missing from the map so future VSAC ingestions surface gaps automatically.

**3. Importer comment** — `scripts/importers/ingest_vsac.py`

Added a comment block explaining why `title=None` is intentional and where titles actually come from. The existing upsert query was already title-safe:

```sql
ON CONFLICT (cms_id) DO UPDATE SET
    cbe_number = COALESCE(EXCLUDED.cbe_number, app.vsac_measures.cbe_number),
    program_candidate = COALESCE(EXCLUDED.program_candidate, ...),
    expansion_version = COALESCE(EXCLUDED.expansion_version, ...),
    ingested_at = NOW()
    -- title intentionally NOT in update list → backfilled values survive re-imports
```

## Result

```
$ php artisan vsac:backfill-measure-titles
OK: updated=72 skipped_existing=0 not_in_db=0 unmapped_in_db_still_blank=0
```

DB verification:
```sql
SELECT count(*) FILTER (WHERE title IS NULL OR title = '') AS missing,
       count(*) AS total
FROM app.vsac_measures;
-- missing: 0  | total: 72
```

Page now displays full titles like "Diabetes: Glycemic Status Assessment Greater Than 9%", "Controlling High Blood Pressure", "Hospital Harm – Falls with Injury", etc.

## Files Changed

- `backend/database/data/vsac_measure_titles.json` (new) — 72 curated titles
- `backend/app/Console/Commands/VsacBackfillMeasureTitles.php` (new) — artisan command
- `scripts/importers/ingest_vsac.py` — clarifying comment on `title=None`

## Lessons

1. **When the source data lacks a field, fail loudly.** The original `"title": None` masked a missing import responsibility. A `raise NotImplementedError` or even a logged warning would have surfaced this immediately. Silent NULLs become permanent gaps.
2. **Curated reference JSON in `database/data/` is the right pattern** for fixed lists from external authorities (CMS catalogs, ICD-10 chapter names, vocabulary version manifests). Beats hardcoding in PHP, beats migrations.
3. **Keep upserts column-aware:** the existing importer's `ON CONFLICT DO UPDATE` correctly omitted `title`, so no risk of the fix being overwritten by re-imports. Worth verifying for any column that has multiple write sources.

## Related

- 2026-05-09: `composer-vendor-worktree-poisoning-2026-05-09.md` — earlier today's prod outage that initially looked like this same UI bug
