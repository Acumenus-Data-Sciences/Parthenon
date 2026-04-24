# CareBundles Workbench — Design Spec

**Status:** Draft
**Date:** 2026-04-23
**Author:** Sanjay Udoshi (with Claude)
**Module:** CareBundles Workbench (new toolset in Workbench)

---

## 1. Summary

A new Workbench toolset that turns Parthenon's existing `ConditionBundle` +
`QualityMeasure` infrastructure into an interactive eCQM (electronic Clinical
Quality Measures) workbench. Researchers select care bundles (HTN, T2DM,
Obesity, Cardio-renal, Oncology screening, Behavioral health), see how many
patients qualify across every connected CDM source, and explore cross-bundle
comorbidity intersections in real time — e.g. *"How many SynPUF patients
qualify for HTN ∩ T2DM ∩ Obesity?"*

Because CDMs are static, all qualification results are materialized once per
(bundle × source) and cached; all subsequent intersection queries run
sub-second against an indexed fact table.

## 2. Goals

1. Population-level qualification counts for every active CMS eCQM-derived
   `ConditionBundle` across every active CDM source.
2. Real-time N-way intersection analysis via UpSet plot and Venn diagram.
3. "Intersection → Cohort" conversion: any multi-bundle intersection becomes
   a first-class `CohortDefinition` usable in downstream Studies and Analyses.
4. Hybrid measure evaluator: cohort-definition path in MVP, pluggable CQL
   runtime in phase 3 without schema changes.
5. HIGHSEC-compliant: every route authenticated, permission-gated, no PHI on
   any public path.

## 3. Non-Goals (MVP)

- Full CQL 1.5 runtime execution (phase 3).
- Live VSAC value-set sync (phase 3).
- FHIR `Measure` resource export / eCQM certification claim (phase 3).
- Federated network analysis (separate initiative).
- Per-user custom bundle authoring with CQL editing (phase 3+).

## 4. Existing Infrastructure Reused

| Existing asset | Role in CareBundles Workbench |
|---|---|
| `backend/app/Models/App/ConditionBundle.php` | THE bundle model — unchanged |
| `backend/app/Models/App/QualityMeasure.php` | Per-bundle eCQM measure — unchanged |
| `bundle_measures` pivot | Bundle ↔ measure ordering — unchanged |
| `backend/app/Models/App/CohortDefinition.php` | Denominator/numerator cohort specs |
| `backend/app/Models/App/CohortGeneration.php` | Per-source generation status |
| `backend/app/Jobs/Cohort/GenerateCohortJob.php` | Cohort materialization engine |
| `backend/app/Services/Cohort/CohortGenerationService.php` | SQL generation + execution |
| `POST /cohort-definitions/from-bundle` | Already creates cohorts from a bundle |
| `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx` | Launcher — register new toolset here |
| `frontend/src/features/workbench/types.ts` `ToolsetDescriptor` | Registration shape |
| Horizon `cohort` queue | Dispatch target for materialization jobs |
| `scheduled-tasks` module | Nightly refresh cadence |
| `Study` model + relationships | Structural analogue for grouping heterogeneous artifacts |
| Solr `cohorts` configset | Reused for bundle search (add a `care_bundle` core in phase 2) |

## 5. Data Model

Four new tables in the `app` schema, plus one nullable FK on
`cohort_generations`. No mutation of existing tables.

### 5.1 `app.care_bundle_runs`

One row per (bundle × source) materialization run. Mirrors the shape of
`cohort_generations` but scoped to a whole bundle.

```sql
CREATE TABLE care_bundle_runs (
  id                    BIGSERIAL PRIMARY KEY,
  condition_bundle_id   BIGINT NOT NULL REFERENCES condition_bundles(id) ON DELETE CASCADE,
  source_id             BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- pending | running | completed | failed | stale
  started_at            TIMESTAMP NULL,
  completed_at          TIMESTAMP NULL,
  triggered_by          BIGINT NULL REFERENCES users(id),
    -- NULL = scheduled task; otherwise user who clicked Materialize
  trigger_kind          VARCHAR(16) NOT NULL DEFAULT 'manual',
    -- manual | scheduled | api
  qualified_person_count BIGINT NULL,
  measure_count         INT NULL,
  bundle_version        VARCHAR(32) NULL,
    -- snapshot of condition_bundle version at run time
  cdm_fingerprint       VARCHAR(64) NULL,
    -- hash of source CDM (data_version + row count) for cache invalidation
  fail_message          TEXT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cbr_bundle_source ON care_bundle_runs (condition_bundle_id, source_id);
CREATE INDEX idx_cbr_status ON care_bundle_runs (status);
```

### 5.2 `app.care_bundle_qualifications` — the fact table

One row per (patient × bundle × source × run). This is the single table that
makes every intersection query fast.

```sql
CREATE TABLE care_bundle_qualifications (
  id                    BIGSERIAL PRIMARY KEY,
  care_bundle_run_id    BIGINT NOT NULL REFERENCES care_bundle_runs(id) ON DELETE CASCADE,
  condition_bundle_id   BIGINT NOT NULL REFERENCES condition_bundles(id),
  source_id             BIGINT NOT NULL REFERENCES sources(id),
  person_id             BIGINT NOT NULL,
    -- CDM person_id, NOT app.users.id
  qualifies             BOOLEAN NOT NULL DEFAULT TRUE,
  measure_summary       JSONB NULL,
    -- { "<measure_id>": {"denom": true, "numer": false}, ... }
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (care_bundle_run_id, person_id)
);

CREATE INDEX idx_cbq_source_bundle ON care_bundle_qualifications (source_id, condition_bundle_id);
CREATE INDEX idx_cbq_person_source ON care_bundle_qualifications (person_id, source_id);
CREATE INDEX idx_cbq_run ON care_bundle_qualifications (care_bundle_run_id);
```

Sizing: SynPUF (~2.3M persons) × ~25 bundles × modest overlap ≈ 10–15M rows.
Fully within PostgreSQL sweet spot with these indexes.

### 5.3 `app.care_bundle_measure_results`

Denormalized per-measure numerator/denominator/rate for each run. Kept
separate from the JSONB `measure_summary` so dashboards can `GROUP BY measure`
without parsing JSON.

```sql
CREATE TABLE care_bundle_measure_results (
  id                    BIGSERIAL PRIMARY KEY,
  care_bundle_run_id    BIGINT NOT NULL REFERENCES care_bundle_runs(id) ON DELETE CASCADE,
  quality_measure_id    BIGINT NOT NULL REFERENCES quality_measures(id),
  denominator_count     BIGINT NOT NULL DEFAULT 0,
  numerator_count       BIGINT NOT NULL DEFAULT 0,
  exclusion_count       BIGINT NOT NULL DEFAULT 0,
  rate                  NUMERIC(6,4) NULL,
    -- numerator / denominator, NULL when denominator=0
  denominator_cohort_definition_id BIGINT NULL REFERENCES cohort_definitions(id),
  numerator_cohort_definition_id   BIGINT NULL REFERENCES cohort_definitions(id),
  computed_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (care_bundle_run_id, quality_measure_id)
);

CREATE INDEX idx_cbmr_run ON care_bundle_measure_results (care_bundle_run_id);
CREATE INDEX idx_cbmr_measure ON care_bundle_measure_results (quality_measure_id);
```

### 5.4 `app.care_bundle_current_runs` (table, not view)

Pointer table: for each (bundle × source), what is the latest successful run?
Populated at end of every successful `MaterializeCareBundleJob`.

```sql
CREATE TABLE care_bundle_current_runs (
  condition_bundle_id   BIGINT NOT NULL REFERENCES condition_bundles(id) ON DELETE CASCADE,
  source_id             BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  care_bundle_run_id    BIGINT NOT NULL REFERENCES care_bundle_runs(id),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (condition_bundle_id, source_id)
);
```

Using a table (not a view) lets intersection queries trivially filter to
"current" without a correlated subquery.

### 5.5 `cohort_generations` — one FK addition

```sql
ALTER TABLE cohort_generations
  ADD COLUMN care_bundle_run_id BIGINT NULL REFERENCES care_bundle_runs(id) ON DELETE SET NULL;

CREATE INDEX idx_cohort_generations_care_bundle_run
  ON cohort_generations (care_bundle_run_id);
```

Lets us trace which cohort generations were fired as part of which bundle
run, without polluting the main `cohort_generations` workflow for non-bundle
generations.

## 6. Query Patterns

Every dashboard and explorer view reduces to one of three shapes:

### 6.1 Per-source coverage matrix (home page)

```sql
SELECT cbq.condition_bundle_id,
       cbq.source_id,
       COUNT(DISTINCT cbq.person_id) AS qualified_patients
FROM care_bundle_qualifications cbq
JOIN care_bundle_current_runs cbcr
  ON cbcr.care_bundle_run_id = cbq.care_bundle_run_id
WHERE cbq.qualifies = TRUE
GROUP BY cbq.condition_bundle_id, cbq.source_id;
```

### 6.2 N-way intersection (the headline feature)

```sql
-- Patients in source X qualifying for ALL of bundles [A, B, C]
SELECT person_id
FROM care_bundle_qualifications cbq
JOIN care_bundle_current_runs cbcr USING (care_bundle_run_id)
WHERE cbq.source_id = :source_id
  AND cbq.condition_bundle_id IN (:a, :b, :c)
  AND cbq.qualifies = TRUE
GROUP BY person_id
HAVING COUNT(DISTINCT cbq.condition_bundle_id) = 3;
```

### 6.3 Full UpSet bit-vector (for rendering UpSet plot)

```sql
SELECT person_id,
       BIT_OR(1 << bundle_idx) AS membership_bits
FROM (
  SELECT cbq.person_id,
         ROW_NUMBER() OVER (PARTITION BY cbq.person_id
                            ORDER BY cbq.condition_bundle_id) - 1 AS bundle_idx
  FROM care_bundle_qualifications cbq
  JOIN care_bundle_current_runs cbcr USING (care_bundle_run_id)
  WHERE cbq.source_id = :source_id
    AND cbq.condition_bundle_id = ANY(:bundle_ids)
    AND cbq.qualifies = TRUE
) t
GROUP BY person_id;
```

(MVP can compute bit vectors in PHP from the raw rows; optimize later.)

## 7. Backend Additions

### 7.1 Services

```
backend/app/Services/CareBundles/
  CareBundleMaterializationService.php
    public function materialize(ConditionBundle, Source, ?User $triggeredBy, string $trigger): CareBundleRun
    private function runMeasures(CareBundleRun, iterable<QualityMeasure>): void
    private function persistQualifications(CareBundleRun, array $personIds): void
    private function persistMeasureResults(CareBundleRun, QualityMeasure, int $denom, int $numer): void
    private function promoteToCurrent(CareBundleRun): void

  CareBundleQualificationService.php
    public function coverageMatrix(): Collection   // bundle × source × count
    public function bundleSourceCount(ConditionBundle, Source): int
    public function intersection(Source, array $bundleIds, string $mode): Collection
      // $mode: 'all' (AND) | 'any' (OR) | 'exactly' (only these)
    public function upsetMatrix(Source, array $bundleIds): array
    public function patientsInIntersection(Source, array $bundleIds, string $mode): Collection
      // Returns person_ids — used by "intersection → cohort" conversion

  CareBundleMeasureEvaluator.php (INTERFACE)
    public function evaluate(QualityMeasure, Source): MeasureEvalResult
      // MeasureEvalResult { denominatorPersonIds, numeratorPersonIds, exclusionPersonIds }

  Evaluators/CohortBasedMeasureEvaluator.php (MVP default)
    // Dispatches denominator + numerator CohortDefinitions via existing
    // GenerateCohortJob path; waits for CohortGeneration completion;
    // reads person_ids from results schema.

  Evaluators/CqlMeasureEvaluator.php (PHASE 3 stub)
    // Placeholder implementing the same interface; phase 3 wires to cqf-ruler
    // or a Python-based CQL runtime. Swap without touching the fact table.
```

### 7.2 Jobs

```
backend/app/Jobs/CareBundles/
  MaterializeCareBundleJob.php
    // Queue: cohort   Timeout: 7200s   Tries: 1 (idempotent)
    // $bundle, $source, $triggeredBy, $trigger
    // Creates CareBundleRun(pending → running), invokes
    // CareBundleMaterializationService::materialize, sets status, fires
    // CareBundleMaterializedNotification on success.

  MaterializeAllCareBundlesJob.php
    // Queue: default (light)
    // Fans out one MaterializeCareBundleJob per (active ConditionBundle ×
    // active Source). Called by scheduled task nightly AND on manual
    // "Refresh all" click.
```

### 7.3 Controller

```
backend/app/Http/Controllers/Api/V1/CareBundleController.php

  index()              GET  /care-bundles                          permission:cohorts.view
  show($bundle)        GET  /care-bundles/{bundle}                 permission:cohorts.view
  qualifications($b)   GET  /care-bundles/{bundle}/qualifications  permission:cohorts.view
                                                ?source_id=X  →  count + rate per measure
  coverage()           GET  /care-bundles/coverage                 permission:cohorts.view
                                                → full bundle×source matrix for home page
  materialize($b)      POST /care-bundles/{bundle}/materialize     permission:cohorts.generate
                                                → dispatches MaterializeCareBundleJob; 202
  materializeAll()     POST /care-bundles/materialize-all          permission:cohorts.generate
  intersections()      POST /care-bundles/intersections            permission:cohorts.view
                                                body: {source_id, bundle_ids, mode}
                                                → {count, sample_person_ids, upset_cells}
  cohortFromIntersect  POST /care-bundles/intersections/to-cohort  permission:cohorts.create
                                                body: {source_id, bundle_ids, mode, name, description}
                                                → new CohortDefinition + cached CohortGeneration
  runs($bundle)        GET  /care-bundles/{bundle}/runs            permission:cohorts.view
  run($run)            GET  /care-bundles/runs/{run}               permission:cohorts.view
```

All routes inside `Route::middleware(['auth:sanctum'])->prefix('v1')->group`.
No unauthenticated routes. No PHI exposure — `sample_person_ids` is capped at
20 randomly sampled IDs with aggregate counts only.

### 7.4 Form Requests

```
backend/app/Http/Requests/CareBundles/
  IntersectionRequest.php    — validates source_id exists, bundle_ids non-empty,
                               mode in {all, any, exactly}
  IntersectionToCohortRequest.php — adds name/description validation
  MaterializeBundleRequest.php — validates optional source_ids override
```

### 7.5 Permissions (RolePermissionSeeder addition)

Add a dedicated `care-bundles` domain to keep RBAC boundaries clean:

```
care-bundles.view       — read bundles, qualifications, coverage
care-bundles.materialize — trigger MaterializeCareBundleJob
care-bundles.create-cohort — convert intersection → CohortDefinition
```

Map to roles:
- `viewer`: view only
- `researcher`: view + create-cohort
- `data-steward`: view + materialize
- `admin` / `super-admin`: all

MVP can piggyback on `cohorts.*` permissions to ship faster; seeder change is
a one-line diff in phase 2.

## 8. Frontend Additions

### 8.1 Toolset registration (3-line diff)

```ts
// frontend/src/features/workbench/registry.ts
import { careBundlesToolset } from '@/features/carebundles-workbench';

export const TOOLSET_REGISTRY: ToolsetDescriptor[] = [
  // ... existing
  careBundlesToolset,
];
```

### 8.2 New feature module

```
frontend/src/features/carebundles-workbench/
  index.ts                                    — exports ToolsetDescriptor
  routes.tsx                                  — React Router route definitions
  pages/
    CareBundlesHomePage.tsx                   — /workbench/care-bundles
                                                  - Coverage matrix heatmap (bundles × sources)
                                                  - Freshness indicators (green/amber/grey dots)
                                                  - "Materialize all" + per-row refresh buttons
    CareBundleDetailPage.tsx                  — /workbench/care-bundles/:bundleId
                                                  - Measure grid with denom/numer/rate per source
                                                  - Run history sparkline
                                                  - "Materialize on source X" action
                                                  - Link to underlying denom/numer CohortDefinitions
    CareBundleIntersectionPage.tsx            — /workbench/care-bundles/intersect
                                                  - Multi-select bundles (2–10)
                                                  - Source picker
                                                  - Mode toggle: All (AND) / Any (OR) / Exactly
                                                  - UpSet plot (primary)
                                                  - Venn diagram (fallback ≤5 bundles)
                                                  - "Save intersection as cohort" CTA
  components/
    BundleCoverageMatrix.tsx                  — react-table + heatmap cells
    MeasureRateCard.tsx                       — denom/numer/rate, sparkline, freshness pill
    UpSetPlot.tsx                             — D3-based (following Recharts patterns where possible)
    VennDiagram.tsx                           — SVG 2/3/4/5 set Venn (hard-coded shapes)
    MaterializeRunStatus.tsx                  — TanStack Query-polled status pill
    IntersectionCohortDialog.tsx              — modal for "intersection → cohort" conversion
    BundleFreshnessDot.tsx                    — traffic-light component
  hooks/
    useCareBundles.ts                         — list
    useCareBundle.ts                          — detail
    useCareBundleCoverage.ts                  — coverage matrix
    useCareBundleIntersection.ts              — POST /intersections
    useMaterializeCareBundle.ts               — POST /materialize
    useCreateCohortFromIntersection.ts        — POST /intersections/to-cohort
    useCareBundleRun.ts                       — polling status hook
  api.ts                                      — axios client wrappers
  types.ts                                    — local domain types (augments api.generated.ts)
  stores/
    intersectionBuilderStore.ts               — Zustand store for intersection page state
                                                  (selected bundles, source, mode)
```

### 8.3 Brand styling

All components use Acumenus palette: base #0E0E11, crimson #9B1B30 accent,
gold #C9A227 highlights, teal #2DD4BF for success/freshness. Inline with
existing Workbench look-and-feel.

### 8.4 Type generation

After backend routes land, run `./deploy.sh --openapi` to regenerate
`frontend/src/types/api.generated.ts`. Do NOT hand-edit.

## 9. Scheduling

One new scheduled task via the `scheduled-tasks` module, created in seed:

```
Name: care-bundles-nightly-refresh
Cron: 0 3 * * *               # 03:00 UTC nightly
Command: MaterializeAllCareBundlesJob (dispatch only)
Behavior: re-materializes any (bundle × source) whose
          cdm_fingerprint differs from source's current data_version
          OR whose care_bundle_runs.completed_at is NULL/older than 7 days
          OR whose ConditionBundle.updated_at > run.completed_at
```

This plus the manual "Materialize" button covers the trigger model.
On-CDM-refresh auto-trigger is a phase 2 addition hooked to the ETL/ingest
pipeline via Laravel events.

## 10. HIGHSEC Compliance Check

| Requirement | Satisfied by |
|---|---|
| Every route auth:sanctum | All 10 new routes inside the `auth:sanctum` group |
| Permission middleware on every route | `cohorts.view` / `cohorts.generate` / `cohorts.create` (or `care-bundles.*` in phase 2) |
| No PHI on unauthenticated paths | Zero public routes added |
| Mass-assignment protection | All new models use `$fillable` |
| No `$guarded = []` | Enforced |
| Non-root Docker | No new containers |
| Sanctum token expiration | Unchanged (480min) |
| `APP_DEBUG` false in prod | Unchanged |
| Sample person IDs capped + read-only | `sample_person_ids` limited to 20 IDs, no notes/dates returned |
| Clinical data served only to authenticated users with permission | Yes |

## 11. Phasing

### Phase 1 — Ships first (~1 week focused work)

- Migrations for the 4 new tables + 1 FK
- `CareBundleMaterializationService` + `CohortBasedMeasureEvaluator`
- `MaterializeCareBundleJob` + `MaterializeAllCareBundlesJob`
- `CareBundleController` with `index`, `show`, `coverage`, `materialize`,
  `qualifications`, `runs`
- Workbench toolset registration
- `CareBundlesHomePage` (coverage matrix)
- `CareBundleDetailPage` (read-only measure grid)
- Pest + Vitest tests, PHPStan level 8 clean

### Phase 2 — Intersection explorer (~3–4 days)

- `intersections` + `intersections/to-cohort` endpoints
- `CareBundleIntersectionPage` with UpSet + Venn
- `IntersectionCohortDialog` writing a new `CohortDefinition` + cached
  `CohortGeneration` record populated from qualification rows
- Dedicated `care-bundles.*` permission domain
- Nightly scheduled task activation

### Phase 3 — CQL runtime + interop (future)

- `CqlMeasureEvaluator` implementation (cqf-ruler or Python CQL engine)
- VSAC value-set importer
- FHIR `Measure` resource import/export
- Federated execution (if the Network module is in flight)

## 12. Open Questions

1. **Permissions scope** — ship with piggybacked `cohorts.*` or introduce
   `care-bundles.*` on day one? Leaning piggyback for speed; migrate in P2.
2. **Source selection** — should a bundle be configurable to exclude certain
   sources (e.g., inpatient-only bundles skip outpatient CDMs)?
3. **Measure rate thresholds** — do we want to display target thresholds
   (e.g., CMS 15 meets threshold at 70%) on the detail page? Requires adding
   `target_rate` column to `quality_measures`.
4. **Caching strategy for intersection queries** — Redis cache keyed by
   `(source_id, sorted_bundle_ids, mode)` with TTL tied to
   `care_bundle_current_runs.updated_at`? Probably yes in P2.
5. **UpSet library** — build custom D3 component vs. wrap
   `@upsetjs/react`? Custom is more work but avoids an npm dep.

## 13. Success Criteria

- Coverage matrix renders in <500ms for 25 bundles × 5 sources.
- N-way intersection query returns in <1s for 5-bundle intersection on SynPUF.
- "Materialize all" completes for the 25-bundle × 5-source catalogue in <30min.
- `intersection → cohort` converts and is usable in a Study within one click.
- No HIGHSEC violations on `./scripts/security-review`.
- Demo-able end-to-end for Series A technical review.

---

## Appendix A — File Manifest

**Backend new files (13):**

```
backend/app/Models/App/CareBundleRun.php
backend/app/Models/App/CareBundleQualification.php
backend/app/Models/App/CareBundleMeasureResult.php
backend/app/Services/CareBundles/CareBundleMaterializationService.php
backend/app/Services/CareBundles/CareBundleQualificationService.php
backend/app/Services/CareBundles/CareBundleMeasureEvaluator.php            (interface)
backend/app/Services/CareBundles/Evaluators/CohortBasedMeasureEvaluator.php
backend/app/Jobs/CareBundles/MaterializeCareBundleJob.php
backend/app/Jobs/CareBundles/MaterializeAllCareBundlesJob.php
backend/app/Http/Controllers/Api/V1/CareBundleController.php
backend/app/Http/Requests/CareBundles/IntersectionRequest.php
backend/app/Http/Requests/CareBundles/IntersectionToCohortRequest.php
backend/app/Http/Requests/CareBundles/MaterializeBundleRequest.php
```

**Backend migrations (2):**

```
backend/database/migrations/2026_04_23_000001_create_care_bundle_runs_table.php
backend/database/migrations/2026_04_23_000002_create_care_bundle_qualifications_table.php
backend/database/migrations/2026_04_23_000003_create_care_bundle_measure_results_table.php
backend/database/migrations/2026_04_23_000004_create_care_bundle_current_runs_table.php
backend/database/migrations/2026_04_23_000005_add_care_bundle_run_id_to_cohort_generations.php
```

**Frontend new files (~18):** see §8.2.

**Tests:** Pest feature tests per controller action; Vitest for every hook
and the two non-trivial visualization components (UpSet, Venn).

## Appendix B — Why This Architecture Is Low Risk

1. **No changes to existing tables except one nullable FK.** Rollback is a
   single `ALTER TABLE DROP COLUMN`.
2. **No changes to existing services.** `CohortGenerationService`,
   `GenerateCohortJob`, `ConditionBundle`, `QualityMeasure` all untouched.
3. **No new queues.** Reuses existing `cohort` Horizon queue.
4. **No new Docker services.** Phase 3 CQL runtime will add one container;
   MVP adds none.
5. **Static CDMs make correctness verifiable.** Every materialized count is
   reproducible from the SQL; no timing or concurrency edge cases.
6. **Fact-table approach is boring SQL.** No exotic dependencies; any
   engineer who knows PostgreSQL can debug.
7. **Evaluator interface isolates CQL risk.** Phase 3 CQL work can fail
   without destabilizing Phase 1/2.
