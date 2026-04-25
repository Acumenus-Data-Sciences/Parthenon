# 2026-04-25 — CareBundles deferred audit findings — followup

## Summary

Closed all HIGH/MEDIUM/LOW findings deferred from the
[2026-04-25 CareBundles audit](./2026-04-25-care-bundles-audit-hardening.md).
The audit's first commit landed as `a97160f74`, the frontend a11y/error
followup as `cbf0c9dfc`; this followup closes the remaining items.

## Backend

| Severity | Finding | Fix |
|----------|---------|-----|
| HIGH-4 | Cohort export delete + chunk insert was non-transactional; a crash partway through left the cohort with old rows deleted and new rows partially inserted. | `MeasureCohortExportService::writeMembers` and `IntersectionCohortService::writeToResultsCohort` now wrap delete + INSERT…SELECT in a results-connection transaction. Crash-safe: either fully replaced or fully preserved. |
| HIGH-5 | `CareBundleMaterializationService::promoteToCurrent` ran inside the materialization transaction while `run.update(status='completed')` ran after — crash window left `care_bundle_current_runs` pointing at a `running` run. | Promotion moved AFTER status=completed. Worst-case is now a stale pointer to the previous completed run — no `running`-status visibility leaks. |
| HIGH-6 | `MeasureRosterService::allPersonIds()` materialized the full bucket into PHP heap before chunk-inserting; on a 2M-patient CDM with a wide non-compliant bucket this could be hundreds of thousands of integers. `IntersectionCohortService` had the same issue via `qualifications->intersection()->all()`. | Both services now stream members via cross-schema INSERT…SELECT directly from `app.care_bundle_measure_person_status` / `app.care_bundle_qualifications` to `<resultsSchema>.cohort`. Zero PHP-heap roundtrip. `allPersonIds()` removed; `CareBundleQualificationService::intersectionQueryForExport()` added for the intersection path. |
| MEDIUM | DQ checker only verified numerator concept presence; denominator concepts were never checked, so a measure pinned to LOINC codes missing from a claims-only CDM produced 0% with no early flag. | `MeasureDataQualityChecker::checkDomainCoverage` adds a symmetric `denominator_concepts_unused` critical flag when the denominator's domain table has zero rows matching the configured concept set (with descendants). |
| MEDIUM | Single-bundle `materialize` accepted any source, regardless of population — the min_population gate was only enforced in the materialize-all fan-out. | `CareBundleController::materialize` now logs a warning for sub-threshold runs and surfaces `below_population_threshold: true` in the 202 response with a clarifying message. Permissive for data stewards but visible to ops. |
| MEDIUM | `CareBundleSourceService::personCount` silently downgraded to a `warning` log on permission denied / missing-table failures — easy to miss in monitoring. | Bumped to `error` level so missing CDM SELECT grants for the default `pgsql` connection user surface in alerts. |
| LOW-1 | `FhirMeasureExporter::renderGroup` hardcoded `http://parthenon.local/measure-code` for the group `code.coding.system`, inconsistent with every other URI which uses the configurable `$baseUrl`. | Now uses `{$baseUrl}/measure-code` for FHIR validator consistency. |
| LOW-2 | `experimental: false` was emitted unconditionally regardless of `is_active`. | Inactive bundles + measures are now `experimental: true` in addition to `status: retired`. |

## Frontend

| Severity | Finding | Fix |
|----------|---------|-----|
| MEDIUM | `MeasureTrendChart`, `UpSetPlot`, `VennDiagram` rendered visualizations with no accessible descriptions for screen-reader users. | All three render with `role="img"` and a programmatic `aria-label` summarizing the data: trend gives latest/min/max rates across N runs; UpSet gives the top three intersection cells by cardinality; Venn (2-set or 3-set) enumerates each region's count. The chart loading state on `MeasureTrendChart` adds `role="status"` + `aria-live="polite"`. |
| LOW | Cohort name input had no client-side max-length, so users pasting names >255 chars got a 422 from the API instead of immediate feedback. | `MeasureRosterModal` and `IntersectionCohortDialog` now enforce `maxLength={255}`, show a remaining-chars warning at ≥240, and disable the submit button when over the limit. |

## Verification

| Gate | Status |
|------|--------|
| `vendor/bin/pest --filter=CareBundle` | 15/15 ✓ |
| `vendor/bin/pint --test` | PASS |
| `vendor/bin/phpstan analyse` (CareBundles backend) | 0 errors |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint src/features/carebundles-workbench/` | 0 warnings |
| `npx vite build` | ✓ built |

## Live verification

| Endpoint | Result |
|----------|--------|
| Materialize CAD on Acumenus (run #185) | 75,555 qualified persons; promote-AFTER-completed ordering verified — no transient `running` pointer. |
| Materialize CAD on Pancreas (sub-threshold) | 202 with `below_population_threshold: true` and operator-friendly message; warning log emitted. |
| Roster→cohort (CAD-01 non-compliant) | 72,002 members written via INSERT…SELECT, generation completed cleanly. Verified zero PHP-heap involvement. |
| Intersection→cohort (HTN ∩ CAD on Acumenus) | 48,621 members written via INSERT…SELECT, generation completed cleanly. |

## Implementation notes

- Both export INSERT…SELECTs run on the **default `pgsql` connection**
  (search_path = `app,php`) rather than the source's `omop` connection. The
  source query references `app.care_bundle_qualifications` /
  `app.care_bundle_measure_person_status`; the `omop` connection's
  search_path doesn't include `app`, and the schema-qualified-table workaround
  fights Laravel's query builder. Single-database-multiple-schemas means the
  default connection can write to `<resultsSchema>.cohort` directly. The
  source-specific connection name is still threaded through (commented
  `unset($connectionName)` in `IntersectionCohortService`) for future
  multi-database isolation, but isn't used today.
- `MeasureRosterService::allPersonIds()` is removed entirely — its only
  caller was `MeasureCohortExportService::export`, which now drives the
  bucket query directly.
- `CareBundleQualificationService::intersectionQueryForExport()` is the
  public-facing variant of the existing private `intersectionQuery()` —
  normalizes inputs and projects only `cbq.person_id`, suitable for splicing
  into the cross-schema INSERT…SELECT.
