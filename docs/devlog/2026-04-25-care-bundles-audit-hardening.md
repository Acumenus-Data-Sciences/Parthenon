# 2026-04-25 — CareBundles workbench audit + backend/frontend hardening

## Summary

End-to-end audit of the CareBundles workbench (15 backend services, 21 frontend
files, ~30 migrations, full route map). Surfaced and fixed real deficiencies
across security, correctness, accessibility, and React anti-patterns.
Documented remaining HIGH/MEDIUM findings deferred for dedicated work.

## Test suite blocker (root-caused + fixed)

**Symptom:** `vendor/bin/pest --filter=CareBundle` → 15 / 15 failures with
`SQLSTATE[42501]: permission denied for schema vocab` while creating
`app.vsac_value_set_omop_concepts WITH DATA`.

**Root cause:** Migration `2026_04_24_000500_create_vsac_omop_crosswalk_view.php`
runs `SET ROLE parthenon_owner` before `CREATE MATERIALIZED VIEW … JOIN
vocab.concept …`. On `parthenon_testing` (and any fresh dev DB rebuilt by
`RefreshDatabase`), `parthenon_owner` has zero privileges on the `vocab`
schema. Production has the grants (presumably pre-applied by DBA), so the bug
is silent until the test suite fans out.

**Fix:** New migration
`backend/database/migrations/2026_04_24_000050_grant_vocab_select_to_owner.php`
grants `USAGE` on schema `vocab` and `SELECT` on all tables (plus
`ALTER DEFAULT PRIVILEGES` for future tables) to `parthenon_owner`, mirroring
the try-grant → verify → throw-with-operator-runbook pattern already used in
`2026_04_25_000050_grant_vocab_create_to_migrator.php`.

## Backend hardening

| Severity | File | Fix |
|----------|------|-----|
| CRITICAL-1 | `Services/CareBundles/Evaluators/CohortBasedMeasureEvaluator.php` | Replace `INTERVAL '{$lookback} days'` literal with `(? * INTERVAL '1 day')` parameterized binding (numerator + each exclusion leg). Defense-in-depth against future widening of the `(int)` cast. |
| HIGH-1 | `Http/Requests/CareBundles/IntersectionToCohortRequest.php` | Add `,deleted_at,NULL` to the `exists:sources,id` rule for parity with the rest of the module — prior pass-then-`findOrFail`-404 confused callers. |
| HIGH-2/3 | `Http/Controllers/Api/V1/CareBundleController.php` | `runs()` accepts optional `source_id`; both `runs()` and `run()` strip `fail_message` for callers without `care-bundles.materialize` (HIGHSEC §7 — query text and schema names previously enumerable by run id). |
| LOW-3 | `routes/api.php` | Add `permission:care-bundles.view` to `overlapRules` and `populationSummary` (HIGHSEC §2.2). |

## Frontend hardening

| Severity | File | Fix |
|----------|------|-----|
| F-CRITICAL | `pages/CareBundleVsacValueSetDetailPage.tsx` | Wrap clipboard `writeText` in try/catch + render error banner. Prior unhandled rejection silently swallowed permission failures. |
| F-CRITICAL | `pages/CareBundleIntersectionPage.tsx`, `components/IntersectionCohortDialog.tsx` | Defensive optional chaining on `(error as Error).message` casts so error rendering doesn't crash on non-Error payloads. |
| F-CRITICAL | `hooks.ts` | `useExportRosterToCohort` invalidation: `onSuccess` → `onSettled` so failed retries don't replay against stale cohort lists. |
| F-MEDIUM | `pages/CareBundleDetailPage.tsx`, `pages/CareBundleIntersectionPage.tsx` | Eliminate render-time `setSourceId` anti-pattern by passing the memoized `effectiveSourceId` directly to downstream queries (no useEffect-with-setState dance). |
| F-MEDIUM | `components/MeasureRosterModal.tsx`, `components/MeasureMethodologyModal.tsx`, `components/IntersectionCohortDialog.tsx` | Modal a11y: Escape-key handler, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; close-button `aria-label` on the intersection dialog. |

## Live verification

| Endpoint | Result |
|----------|--------|
| `POST /care-bundles/3/materialize` (CAD on Acumenus) | Run #184 completed in ~25s, 75,555 qualified persons (parameterized INTERVAL works). |
| `GET /care-bundles/3/measures/354/strata?source_id=47` | 7 measures × (4 age bands + 3 sex strata) = 49 strata rows with Wilson CIs. |
| `GET /care-bundles/3/runs?source_id=47` | Filter applied — only run #184 returned. |
| `GET /care-bundles/3/measures/354/roster?source_id=47&bucket=non_compliant` | 72,002 patients (paginated, demographics-only — no PHI). |
| `POST /care-bundles/intersections` (HTN ∩ CAD on Acumenus) | 48,621 patients, 20-id sample, UpSet cells. |
| `GET /care-bundles/3/fhir/measure` | FHIR R4 Measure resource, `application/fhir+json`. |

## Verification gates

- `vendor/bin/pest --filter=CareBundle` — **15/15 ✓** (was 15/15 ✗)
- `vendor/bin/pint --test` — **PASS** on all 1,915 files
- `vendor/bin/phpstan analyse` (CareBundles backend) — **0 errors**
- `npx tsc --noEmit` — **0 errors**
- `npx eslint src/features/carebundles-workbench/` — **0 warnings**
- `npx vite build` — **✓ built**
- `./deploy.sh --frontend` — **✓ deployed** (smoke checks 3/3 ✓)

## Deferred (documented, not fixed — significant scope)

- **HIGH-4** Split-transaction non-idempotency in `MeasureCohortExportService`
  and `IntersectionCohortService` — needs results-connection transaction
  around delete + chunk inserts, or an idempotency key.
- **HIGH-5** `promoteToCurrent` runs inside the materialization transaction
  while `run.update(status='completed')` runs after — crash window leaves
  `care_bundle_current_runs` pointing at a never-completed run.
- **HIGH-6** `MeasureRosterService::allPersonIds()` materializes the full
  non-compliant set in PHP heap before chunking — replace with
  `INSERT … SELECT` driven from `care_bundle_measure_person_status`.
- **MEDIUM** DQ checker doesn't pre-flight denominator concept presence;
  `min_population` gate is advisory on single-bundle materialize;
  `personCount` silently degrades when default `pgsql` user lacks SELECT on
  a CDM schema.
- **LOW** FHIR exporter hardcodes `http://parthenon.local/measure-code` for
  one coding (LOW-1) and emits `experimental: false` unconditionally
  (LOW-2); Recharts/UpSet/Venn lack accessible descriptions.

## Operator note

Bundle runs with IDs ≤ 180 predate the 2026-04-24 strata feature. The Strata
accordion shows nothing for those stale runs until the bundle is
re-materialized. To backfill, run `php artisan care-bundles:materialize-all`
or trigger from the UI per bundle.
