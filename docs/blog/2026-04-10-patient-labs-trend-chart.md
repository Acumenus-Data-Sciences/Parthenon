---
slug: patient-labs-trend-chart
title: "Patient Labs Trend Chart: From Empty Columns to Clinical Intelligence"
authors: [mudoshi, claude]
tags: [development, frontend, backend, database, clinical, patient-profiles, recharts, ohdsi]
date: 2026-04-10
---

The Patient Profile's Labs Panel has been one of Parthenon's persistent frustrations: a table with Ranges and Status columns that were perpetually empty, and a display format that forced clinicians to mentally reconstruct a lab value's trajectory from a column of numbers. Today we shipped the fix — a Recharts line chart with a shaded reference-range band, status-colored measurement dots, and a hybrid data layer that finally makes lab reference ranges work across every CDM source.

<!-- truncate -->

## The Problem Was Never the UI

When we first looked at the Labs Panel, the obvious symptoms were cosmetic: empty Range and Status columns. But the root cause was architectural. The OMOP CDM `measurement` table has `range_low` and `range_high` columns, and our UI code was already wired to display them. The problem: **zero percent of our data had them populated.**

| Source | Measurements | range_low populated |
|---|---:|---:|
| Acumenus (OMOP) | 710,965,770 | 0% |
| SynPUF | 69,816,562 | 0% |
| IRSF Natural History Study | 370,581 | 0% |
| Pancreatic Cancer Corpus | 185,455 | 99.2% |

780 million measurement rows across three of four CDM sources had no reference ranges. The frontend was faithfully rendering "nothing" because there was nothing to render. This isn't a Parthenon bug — it's an ETL reality. Most clinical data pipelines don't carry reference ranges from the source system into the CDM, because the OMOP specification treats `range_low`/`range_high` as optional enrichment fields.

Fixing the UI without fixing the data would have been pointless. We needed an entirely new data layer.

## Architecture: The Hybrid Reference Range Resolver

We built a two-tier system that layers reference ranges *on top* of the CDM without mutating it (HIGHSEC compliance — CDM schemas are read-only in Parthenon):

```
Frontend (PatientLabPanel)
  └── labGroups[] from API
       └── PatientProfileService.buildLabGroups()
            ├── LabReferenceRangeService.lookupMany()
            │    ├── Tier 1: Curated LOINC ranges (sex + age stratified)
            │    ├── Tier 2: Curated sex='Any' fallback
            │    └── Tier 3: Population P2.5/P97.5 per source
            └── LabStatusClassifier.classify()
                 └── Low / Normal / High / Critical / Unknown
```

**Tier 1 — Curated Clinical References.** A YAML-driven seed file of 40 lab tests (54 rows with sex/age splits) sourced from the Mayo Clinical Laboratory Test Catalog, NCEP ATP III guidelines, and ADA standards. The seeder resolves LOINC codes and UCUM unit codes to OMOP concept_ids at load time via `vocab.concept`, so the YAML stays human-readable and survives vocabulary refreshes. Sex-stratified where clinically meaningful: Hemoglobin (M: 13.5–17.5, F: 12.0–15.5 g/dL), Creatinine (M: 0.74–1.35, F: 0.59–1.04 mg/dL), and others. Age-stratified for pediatric ranges (WBC, Hemoglobin, ALP) and elderly adjustments (NT-proBNP: under 125 pg/mL for ages 18–74, under 450 for 75+).

**Tier 2 — Population Percentiles.** For labs not in the curated set, an Artisan command (`php artisan labs:compute-reference-ranges`) computes P2.5/P50/P97.5 from actual measurement values per source using PostgreSQL's `percentile_cont` aggregate. Per-source scoping is deliberate — SynPUF's elderly Medicare cohort should have different "expected" ranges than IRSF's rare-disease population. Mixing them would bias every lab toward whichever source has the most rows.

**Tier 3 — Graceful Degradation.** Labs with no curated match and no population data get `range: null`, `status: 'unknown'`. The chart renders the line without a band. The clinician sees the trajectory without a misleading reference frame.

### The Lookup Order

The `LabReferenceRangeService` resolves ranges with a strict precedence:

1. **Sex-specific curated** — matches the patient's `gender_concept_id` (8507=M, 8532=F) against curated rows with matching sex. If multiple age bands match, the *narrowest* wins (e.g., a row for ages 18–49 beats one for ages 18+).
2. **Sex='Any' curated** — falls through when sex is unknown or no sex-specific row matches.
3. **Population per source** — uses the specific source's computed percentiles. The label explicitly shows provenance: "PANCREAS pop. P2.5–P97.5 (n=6,745)".
4. **Null** — no range available.

This lookup runs once per profile load via `lookupMany()`, which batches all of a patient's distinct (concept_id, unit_concept_id) pairs into a single resolution pass with per-request memoization.

## Database Design

Two new tables in the Laravel-owned `app` schema (CDM schemas stay read-only):

### `lab_reference_range_curated`

| Column | Type | Notes |
|---|---|---|
| measurement_concept_id | int | OMOP concept FK |
| unit_concept_id | int | UCUM unit FK |
| sex | char(1) | M, F, or A (any) |
| age_low / age_high | smallint nullable | Age band; NULL = unbounded |
| range_low / range_high | decimal(12,4) | Reference range bounds |
| source_ref | varchar(64) | "Mayo", "ADA", "NCEP ATP III" |

The unique index uses PostgreSQL 15+'s `NULLS NOT DISTINCT` clause — a detail that survived two review iterations. The original implementation used `COALESCE(age_low, 0)` sentinels, which our code reviewer correctly caught would collapse NULL (no lower bound) and 0 (neonate) into the same unique-index slot. The fix is cleaner and more correct: `NULLS NOT DISTINCT` treats NULL values as equal for uniqueness purposes, native to the database engine, no sentinel hacks.

### `lab_reference_range_population`

| Column | Type | Notes |
|---|---|---|
| source_id | bigint FK | Per-source isolation |
| measurement_concept_id | int | OMOP concept FK |
| unit_concept_id | int | UCUM unit FK |
| range_low / range_high | decimal(12,4) | P2.5 / P97.5 |
| median | decimal(12,4) nullable | P50 |
| n_observations | bigint | Sample size |

Three CHECK constraints guard data integrity: `n_observations > 0`, `range_low <= range_high`, and `median IS NULL OR median BETWEEN range_low AND range_high`. These were added after code review caught that a mis-fired compute job could insert an inverted range and silently break chart rendering.

## The Classification Heuristic

`LabStatusClassifier` maps each numeric value to one of five categories:

- **Normal**: value within [low, high] (inclusive of both bounds)
- **Low**: value < low (but not critical)
- **High**: value > high (but not critical)
- **Critical**: value more than 2x the band width outside the range — a rough panic-flag heuristic. For fasting glucose (range 70–99, band width 29): critical threshold is above 157 or below 12.
- **Unknown**: no range available

This heuristic is intentionally simple and tunable. In production against a Pancreatic Cancer Corpus patient (person 178), it produced: 395 Normal, 74 High, 30 Low, 1 Critical (Glucose 158 mg/dL — just above the 157 threshold), 0 Unknown. The single Critical flag is clinically plausible for a cancer patient with stress hyperglycemia.

## Frontend: Recharts Line Chart with Reference Band

The old Labs Panel was a 423-line React component that did client-side measurement grouping (filtering events, building groups by concept_id, computing trends) and rendered an expanded table. The new version is 280 lines and delegates all data processing to the backend.

### New Components

**LabTrendChart** — A Recharts `ComposedChart` with three stacked layers:

1. `CartesianGrid` with dark zinc gridlines
2. `ReferenceArea` in teal (#2DD4BF) at 12% opacity for the reference range band, with a dashed stroke at 35% opacity for the band edges
3. `Line` with status-colored `LabStatusDot` at each measurement point

The chart also renders a footnote showing the range provenance: "Reference: 12.0–15.5 g/dL" on the left, "Mayo (F, 18+)" on the right.

**LabStatusDot** — A custom Recharts dot component that colors each measurement point by its classified status:
- Blue (#3B82F6) for Low, radius 4
- Zinc (#A1A1AA) for Normal, radius 3
- Crimson (#9B1B30) for High, radius 4
- Crimson fill with gold ring (#C9A227) for Critical, radius 5
- Hollow zinc ring for Unknown, radius 3

**LabTrendTooltip** — A dark-themed tooltip showing date, value+unit, and status label with direction arrow.

**LabValuesTable** — The old expanded table, extracted into its own component, now accessible via a "Show values" toggle beneath the chart. Clinicians who prefer the raw numbers can still see them.

### The Integration

`PatientLabPanel` switched from `events: ClinicalEvent[]` (filtering all events to measurements and grouping client-side) to `labGroups: LabGroup[]` (receiving pre-grouped, range-resolved, status-classified data from the API). The collapsed row's sparkline and status indicator — which existed in the original component but showed nothing because range data was empty — now light up with the resolved reference ranges.

## What This Looks Like for a Clinician

When a clinician opens a patient profile and clicks the Labs tab:

1. **Collapsed row**: Test name, count (x18), inline sparkline with a green reference band, latest value with unit, trend arrow, and a Low/Normal/High status indicator.
2. **Click to expand**: A full-width Recharts line chart appears with the teal reference band shaded behind the measurement trajectory. Each dot is colored by status. A footnote tells them whether the range is "Mayo (M, 18+)" (curated clinical reference) or "PANCREAS pop. P2.5–P97.5 (n=6,745)" (statistical inference from the source population).
3. **"Show values" toggle**: Reveals the traditional table with Date, Value, Range, and Status columns for anyone who needs the precise numbers.

This design respects that clinicians think in trajectories, not point values. A hemoglobin of 12.7 is meaningless without context — but 12.7 on a downward trend, crossing below the 13.5 g/dL lower bound after three months of decline, tells a story.

## Testing

47 automated tests across the feature:

**Backend (32 Pest tests):**
- LabStatusClassifier: 13 parametrized tests covering boundary cases (inclusive bounds, critical thresholds in both directions, negative ranges, null range → unknown)
- LabReferenceRangeService: 11 tests covering the full lookup precedence (narrowest band, sex specificity, age-out-of-band fallthrough, population fallback, null unit/sex/age edge cases, memoization query-count assertion)
- LabReferenceRangeSeeder: 4 tests (YAML load, idempotency, bad LOINC fail-loud, bad UCUM fail-loud)
- ComputeReferenceRangesCommand: 4 tests (percentile computation, min-n filtering, dry-run, re-run overwrites)

**Frontend (15 Vitest tests):**
- LabStatusDot: 6 tests (one per status + null cx/cy)
- LabValuesTable: 4 tests (headers, rows, status text, range display)
- LabTrendChart: 5 tests (reference area rendering, footnote, null range, source label, empty state)

## Edge Cases Verified Against Live Data

| Scenario | Result |
|---|---|
| Patient with no measurements | `labGroups: []`, no crash |
| Patient with all-population ranges (IRSF) | 19 groups, all population-sourced |
| Source with `unit_concept_id=0` | Falls through to population correctly |
| SynPUF (no numeric values) | Compute command returns 0 rows |
| NULL `value_as_number` | Status → unknown, value → null in chart |
| Pancreas patient 178 (28 lab groups) | 18 curated + 10 population = 100% coverage |
| Sex-stratified range for male | Hemoglobin → "Mayo (M, 18+)" with 13.5–17.5 |
| Cross-check labGroups vs flat measurements | Both arrays have 500 entries, all enriched |

## What's Next

- **Expand curated coverage to Tier 3 (~170 labs)**: The current 40-lab YAML covers CBC, BMP/CMP, lipids, thyroid, coags, cardiac markers, iron studies, and diabetes. The spec identifies 16 panels totaling ~170 labs with sex/age stratification. This is clinical data-entry work, not engineering.
- **Compute OMOP population ranges**: The Acumenus 1M CDM has 470M qualifying measurements. Running `labs:compute-reference-ranges --source=ACUMENUS` will populate population-percentile fallback ranges for all CDM sources.
- **Unit conversion**: Some sources use mEq/L for sodium while our curated YAML uses mmol/L (numerically equivalent for monovalent ions). A small conversion table would close this gap.
- **Time-range filter controls**: 3mo/6mo/1y/all buttons on the chart for clinicians who want to zoom into recent trends.

## The Meta-Story

This feature started as a UI complaint — "the Ranges and Status columns are empty." It ended as a 6-phase, 20-task engineering project that touched the database schema, application services, API contract, and frontend rendering. The lesson: sometimes the "broken UI" is the symptom of a missing data layer, and the fix requires building that layer from scratch.

The code review loop caught two real correctness issues that would have shipped as bugs: the COALESCE sentinel collision on the unique index, and the missing CHECK constraints on population ranges. Both were fixed before any code reached production. The subagent-driven development workflow — where each task gets a fresh implementer with precise context, followed by independent spec compliance and code quality reviews — is proving its value on integration-heavy features like this one.
