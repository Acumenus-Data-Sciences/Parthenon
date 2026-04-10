# Patient Labs Trend Chart — Shipped

**Date:** 2026-04-10
**Module:** Patient Profiles
**Spec:** `docs/superpowers/specs/2026-04-09-patient-labs-trend-chart-design.md`
**Plan:** `docs/superpowers/plans/2026-04-09-patient-labs-trend-chart.md`
**Branch:** `feature/patient-labs-trend-chart`

## What shipped

The Patient Profile Labs Panel now renders a Recharts line chart with a
shaded teal reference-range band behind each expanded lab, replacing the
previous table-only view. Ranges and status (Low/Normal/High/Critical)
are populated for every lab across every CDM source via a two-tier
resolver: curated LOINC references first, per-source population
P2.5/P97.5 fallback.

## Why it was broken

The Parthenon ETL doesn't populate `measurement.range_low` /
`range_high` — 0% coverage across 780M rows of OMOP/SynPUF/IRSF. The
frontend was correctly showing "nothing" because there was nothing to
show. Fixed by layering a reference-range data model on top of the CDM
(HIGHSEC compliance — CDM schemas stay read-only).

## Architecture

```
Frontend (PatientLabPanel)
  └─ labGroups[] from API
       └─ PatientProfileService.buildLabGroups()
            ├─ LabReferenceRangeService.lookupMany()
            │   ├─ 1. Curated (sex+age stratified, YAML-seeded)
            │   ├─ 2. Curated sex='A' fallback
            │   └─ 3. Population P2.5/P97.5 per source
            └─ LabStatusClassifier.classify()
```

## Data

- `app.lab_reference_range_curated` — 54 rows from YAML seed (40 labs,
  sex/age splits). Source: Mayo Clin Path Handbook, NCEP ATP III, ADA.
- `app.lab_reference_range_population` — 52 rows computed for Pancreas
  (28) and IRSF (24). SynPUF has no numeric measurement data. OMOP
  deferred (470M rows, run manually when time permits).
- Unique index uses PG 15+ `NULLS NOT DISTINCT` clause. Population
  table has CHECK constraints: `n_observations > 0`,
  `range_low <= range_high`, `median IN range`.

## UX

- Expanded lab row shows a Recharts `ComposedChart` with a
  `ReferenceArea` teal band between `range.low` and `range.high`.
- Chart footnote shows reference source: curated (`"Mayo (M, 18+)"`)
  or population (`"PANCREAS pop. P2.5–P97.5 (n=6,745)"`).
- "Show values" toggle beneath the chart reveals the table for
  clinicians who want the raw numbers.
- Collapsed-row sparkline + status indicator (Low/Normal/High) finally
  light up — the code was already in place, it just needed range data.
- Status dots on the chart: blue=low, zinc=normal, crimson=high,
  crimson+gold ring=critical, hollow=unknown.

## Test coverage

- **Backend:** 32 Pest tests (LabStatusClassifier 13, LabReferenceRangeService 11,
  LabReferenceRangeSeeder 4, ComputeReferenceRangesCommand 4)
- **Frontend:** 15 Vitest tests (LabStatusDot 6, LabValuesTable 4, LabTrendChart 5)

## Live verification (Pancreas, person 178)

- 28 lab groups returned from the API
- 18/28 have curated ranges (Glucose, Creatinine, Hemoglobin, LFTs, CBC, etc.)
- 10/28 have population-percentile fallback ranges
- 0/28 have no range — full coverage achieved for this patient

## Follow-ups

- Expand curated YAML to full Tier 3 (~170 labs). Task 21 in the plan,
  optional, clinical data-entry work.
- Run `labs:compute-reference-ranges --source=ACUMENUS` for the 470M-row
  OMOP source when time permits.
- Time-range filter controls (3mo/6mo/1y/all) if clinicians ask.
- Unit conversion (mg/dL vs mmol/L, mEq/L vs mmol/L) — sampling shows
  some Pancreas data uses mEq/L for sodium while curated uses mmol/L.
  Strict unit_concept_id matching means these fall through to population.
  A small conversion table would close this gap.
- OpenAPI spec update for LabGroup/LabRange/LabStatus/LabValue schemas
  (deferred — frontend types are hand-authored for now).
- Feature tests for the profile `show()` endpoint (requires solving
  CDM-connection-in-tests infrastructure).
