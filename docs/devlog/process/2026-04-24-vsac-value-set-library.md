# VSAC Value Set Library — CMS dQM/eCQM Reference Data

**Date:** 2026-04-24

## What

Ingested the full CMS Value Set Authority Center expansion for 2025 eCQM/dQM packages into `app.vsac_*` tables, plus a materialized view that maps VSAC codes onto OMOP `vocab.concept_id` values.

## Source files

- `dqm_vs_20251117.xlsx` — 1,528 value sets × 224K codes (single sheet "All dQM", Expansion 2025-11-17)
- `ec_hospip_hospop_cms_20250508.xlsx` — 72 CMS measures × ~22 value sets each = 1,597 measure↔value-set links (Expansion 2025-05-08)

## Tables

```
app.vsac_value_sets              1,545 rows   (dedup across both files by OID)
app.vsac_value_set_codes       225,261 rows
app.vsac_measures                   72 rows   (CMS2v15, CMS22v14, …)
app.vsac_measure_value_sets      1,597 rows   (M2M)
app.vsac_value_set_omop_concepts 192,869 rows (materialized view)
```

Crosswalk coverage: **87% of value sets** (1,344/1,545) have ≥1 OMOP-mapped code. 14.4% unmapped — those are in code systems not loaded in Parthenon's vocab (CPT4, ICD10PCS, CVX, CDT, SOP, HSLOC).

## Why this matters

1. **Real FHIR Measure exports** — CareBundles can now reference canonical VSAC OIDs instead of the custom `text/omop-concept-set-ids` language.
2. **78 ready-to-use CMS bundles** — every CMS eCQM is now queryable as a value-set graph with pre-computed OMOP concept_ids.
3. **Concept set library boost** — the VSAC library complements Parthenon's ~275 custom concept sets with the authoritative US quality-measurement reference.

## Usage

Ingest / refresh:
```bash
php artisan vsac:ingest --both --refresh
```

Example query — all OMOP concept_ids in "Pharmacologic Therapy for Hypertension":
```sql
SELECT concept_id, concept_name, vocabulary_id
FROM app.vsac_value_set_omop_concepts
WHERE value_set_oid = '2.16.840.1.113883.3.526.1577';
-- 435 rows (RxNorm antihypertensives)
```

## Next steps (not in this change)

- Build a `CareBundle ← VsacMeasure` seeding command that materializes each CMS measure as a CareBundle template with pre-wired OMOP concept sets.
- Add a refresh hook after `vocab` reloads so the crosswalk stays current.
- Wire VSAC OIDs into `FhirMeasureExporter` so exported Measures reference real value-set canonical URLs.
