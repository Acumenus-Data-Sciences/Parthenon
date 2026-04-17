---
phase: 13
plan: 01
subsystem: finngen-endpoint-universalization
tags: [wave-0, adr, tdd-red, pest, vitest, finngen]
dependency_graph:
  requires: []
  provides:
    - "ADR-001 schema target lock (vocab.source_to_concept_map)"
    - "ADR-002 classification edge-case rules"
    - "TDD RED baseline for Plans 02-08"
  affects:
    - "All subsequent Phase 13 plans (02-08) gate on these ADRs + test skeletons"
tech_stack:
  added: []
  patterns:
    - "Pest 3.x TDD skeleton (RED-first)"
    - "Vitest + @testing-library/react failing-import pattern"
    - "ADR schema: Status / Context / Decision / Consequences / References"
key_files:
  created:
    - ".planning/phases/13-finngen-endpoint-universalization/13-ADR-001-stcm-target-schema.md"
    - ".planning/phases/13-finngen-endpoint-universalization/13-ADR-002-classification-edge-cases.md"
    - "backend/tests/Unit/FinnGen/StandardFirstResolverTest.php"
    - "backend/tests/Unit/FinnGen/FinnGenCoverageProfileClassifierTest.php"
    - "backend/tests/Unit/FinnGen/FinnishVocabResolverTest.php"
    - "backend/tests/Feature/FinnGen/FinnGenSourceToConceptMapSeedTest.php"
    - "backend/tests/Feature/FinnGen/ImportEndpointsOverwriteTest.php"
    - "backend/tests/Feature/FinnGen/CoverageProfilePopulationTest.php"
    - "backend/tests/Feature/FinnGen/CoverageInvariantTest.php"
    - "backend/tests/Feature/FinnGen/BaselineScanOutputTest.php"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/CoverageProfileBadge.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/DisabledGenerateCTA.test.tsx"
  modified: []
decisions:
  - "ADR-001: STCM target is vocab.source_to_concept_map (schema-qualified, protects IRSF-NHS 121 rows, HIGHSEC §4.1 grants required)"
  - "ADR-002: Tandem KELA_REIMB + ICD-10 classifies as PARTIAL; truncated 500-cap counts as resolved; ICDO3 via authored STCM rows (no vocab.vocabulary insert)"
  - "ADR-002: D-07 invariant — zero rows with coverage_bucket='UNMAPPED' AND coverage_profile='universal'"
metrics:
  duration_minutes: 5
  completed_at: "2026-04-17"
  tasks_completed: 3
  files_created: 12
---

# Phase 13 Plan 01: Wave 0 Unblockers (ADR Locks + TDD RED Baseline) Summary

Two ADR files lock Phase 13 schema target + classification edge cases; ten failing test skeletons (8 Pest + 2 Vitest) establish the TDD RED baseline that Plans 02-08 will turn GREEN.

## What Shipped

**2 ADR files** (phase directory):
1. **13-ADR-001-stcm-target-schema.md** — locks `vocab.source_to_concept_map` as the Phase 13 target, preserves the 121 IRSF-NHS rows, mandates HIGHSEC §4.1 grants on the seed migration.
2. **13-ADR-002-classification-edge-cases.md** — binds three classifier edge cases (tandem KELA_REIMB → PARTIAL, truncated-counts-as-resolved, ICDO3 via Athena STCM rows) and the D-07 invariant SQL.

**8 backend Pest test skeletons** (Unit + Feature; all RED):
- `Unit/FinnGen/StandardFirstResolverTest.php` — STCM preference over LIKE-ANY (RED: `RuntimeException` — Laravel facade not bootstrapped; production resolver change in Plan 05 will bootstrap via Feature test equivalent or framework fixture)
- `Unit/FinnGen/FinnGenCoverageProfileClassifierTest.php` — 4 classifier branch tests (RED: `Class "App\Services\FinnGen\FinnGenCoverageProfileClassifier" not found`)
- `Unit/FinnGen/FinnishVocabResolverTest.php` — 3 new resolver-method shape tests (RED: `Error` — methods don't exist)
- `Feature/FinnGen/FinnGenSourceToConceptMapSeedTest.php` — seed count + grants + IRSF-NHS preservation (RED: count returns 0, fails `>= 4000`)
- `Feature/FinnGen/ImportEndpointsOverwriteTest.php` — `--overwrite` idempotency + pre-snapshot table (RED: `InvalidOptionException — The "--overwrite" option does not exist`)
- `Feature/FinnGen/CoverageProfilePopulationTest.php` — every row has `coverage_profile IS NOT NULL` (RED: column doesn't exist; `--overwrite` option missing)
- `Feature/FinnGen/CoverageInvariantTest.php` — D-07 zero-violation invariant (RED: `--overwrite` missing)
- `Feature/FinnGen/BaselineScanOutputTest.php` — `finngen:scan-coverage-profile --dry-run` JSON schema (RED: `CommandNotFoundException`)

**2 frontend Vitest test skeletons** (RED):
- `__tests__/CoverageProfileBadge.test.tsx` — badge renders "Requires Finnish CDM" / "Partial coverage" (RED: `Failed to resolve import "../components/CoverageProfileBadge"`)
- `__tests__/DisabledGenerateCTA.test.tsx` — Generate button disabled + tooltip for finland_only on PANCREAS (RED: page doesn't yet know about `coverage_profile`; element resolution error)

## Pest Filter Discovery (RED state confirmed)

```text
 FAIL  Tests\Unit\FinnGen\FinnGenCoverageProfileClassifierTest
  ⨯ it returns FINLAND_ONLY when no group resolves
  ⨯ it returns PARTIAL when at least one group resolves and at least one does not
  ⨯ it returns UNIVERSAL when every non-empty input group resolves
  ⨯ it treats truncated standard arrays as resolved for classification purposes
 FAIL  Tests\Unit\FinnGen\FinnishVocabResolverTest
  ⨯ it exposes resolveNomesco returning the standard resolver shape
  ⨯ it exposes resolveKelaReimb returning the standard resolver shape
  ⨯ it exposes resolveIcdO3 returning the standard resolver shape
 FAIL  Tests\Unit\FinnGen\StandardFirstResolverTest
  ⨯ it prefers STCM target_concept_id over LIKE-ANY for ICD10_FIN source codes
 FAIL  Tests\Feature\FinnGen\BaselineScanOutputTest
  ⨯ it finngen:scan-coverage-profile --dry-run emits a baseline JSON with the required keys
 FAIL  Tests\Feature\FinnGen\CoverageInvariantTest
  ⨯ it enforces D-07 invariant: zero rows with coverage_bucket=UNMAPPED AND coverage_profile=universal
 FAIL  Tests\Feature\FinnGen\CoverageProfilePopulationTest
  ⨯ it populates coverage_profile on every finngen-endpoint row after re-import
 FAIL  Tests\Feature\FinnGen\FinnGenSourceToConceptMapSeedTest
  ⨯ it seeds at least 4000 FinnGen cross-walk rows in vocab.source_to_concept_map
 FAIL  Tests\Feature\FinnGen\ImportEndpointsOverwriteTest
  ⨯ it preserves cohort_definitions row count when --overwrite is run twice
  ⨯ it populates app.finngen_endpoint_expressions_pre_phase13 with one row per endpoint before overwrite

Tests:    14 failed, 2 passed (4 assertions)
```

Failure types (all desired RED signals):
- `Class "App\Services\FinnGen\FinnGenCoverageProfileClassifier" not found` (4 tests) — Plan 03 target
- `Error` on `resolveNomesco/resolveKelaReimb/resolveIcdO3` (3 tests) — Plan 05 target
- `RuntimeException: A facade root has not been set.` (1 test) — Plan 05 wires Laravel bootstrap or uses Feature test
- `InvalidOptionException: The "--overwrite" option does not exist` (4 tests) — Plan 06 target
- `CommandNotFoundException` on `finngen:scan-coverage-profile` (1 test) — Plan 06 target
- `Failed asserting that 0 is equal to 4000 or is greater than 4000` (1 test) — Plan 04 target

## Vitest Discovery (RED state confirmed)

```text
 FAIL  src/features/finngen-endpoint-browser/__tests__/CoverageProfileBadge.test.tsx
  Error: Failed to resolve import "../components/CoverageProfileBadge"
  Does the file exist?

 FAIL  src/features/finngen-endpoint-browser/__tests__/DisabledGenerateCTA.test.tsx
   > FinnGenEndpointBrowserPage — Generate CTA disablement for finland_only
   > disables the Generate button for finland_only endpoints on a non-Finnish source (PANCREAS)
  Error: Element type is invalid: expected a string (for built-in components) or a class/function
  (for composite components) but got: undefined.

 Test Files  2 failed (2)
      Tests  1 failed (1)
```

Both failures are the expected pre-Plan-07 RED:
- Badge component `../components/CoverageProfileBadge` doesn't exist.
- Page doesn't yet export a named `FinnGenEndpointBrowserPage` + `coverage_profile` is unknown to the page today.

## Plans Unblocked (Wave 0 complete)

| Plan | Was blocked by | Now unblocked because |
|------|----------------|------------------------|
| 02 (schema migration) | STCM target ambiguity | ADR-001 locks `vocab.source_to_concept_map` |
| 03 (classifier) | Classification edge cases | ADR-002 locks tandem / truncated / ICDO3 rules |
| 04 (seed migration) | Missing seed RED test | `FinnGenSourceToConceptMapSeedTest.php` |
| 05 (resolver rewrite) | Missing resolver RED tests | `StandardFirstResolverTest` + `FinnishVocabResolverTest` |
| 06 (importer + scan) | Missing `--overwrite` + `scan-coverage-profile` RED tests | `ImportEndpointsOverwriteTest` / `BaselineScanOutputTest` / `CoverageProfilePopulationTest` / `CoverageInvariantTest` |
| 07 (browser UI) | Missing UX RED tests | `CoverageProfileBadge.test.tsx` + `DisabledGenerateCTA.test.tsx` |
| 08 (one-shot re-import) | Depends on 06 | Transitively unblocked |

## Deviations from Plan

**One minor deviation:** The plan `must_haves.artifacts` list enumerated 7 backend test files, but the plan's Task 2 `<files>` element and `<action>` block specified 8 (including `BaselineScanOutputTest.php`). Shipped all 8 backend + 2 frontend = 10 test files, matching the Task 2 spec (which is the authoritative task-level contract). Orchestrator success-criteria line "9 test files" undercounted; actual count is 10 which is what Task 2 demanded.

No other deviations. Plan executed exactly as written.

## Threat Flags

None. All changes are ADR markdown and failing test skeletons; no production code, routes, models, or infrastructure introduced in this plan.

## Quick-Run Gate (Wave 1+ use)

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter=FinnGen --parallel"
```

Expected today: 14 new failures + 2 auto-skipped/passing on the Seed test (role check + count=0 != 121). Expected at Phase 13 merge: all 14+ GREEN plus existing FinnGen suite GREEN.

## Self-Check: PASSED

Files verified present on disk:
- `.planning/phases/13-finngen-endpoint-universalization/13-ADR-001-stcm-target-schema.md` — FOUND
- `.planning/phases/13-finngen-endpoint-universalization/13-ADR-002-classification-edge-cases.md` — FOUND
- `backend/tests/Unit/FinnGen/StandardFirstResolverTest.php` — FOUND
- `backend/tests/Unit/FinnGen/FinnGenCoverageProfileClassifierTest.php` — FOUND
- `backend/tests/Unit/FinnGen/FinnishVocabResolverTest.php` — FOUND
- `backend/tests/Feature/FinnGen/FinnGenSourceToConceptMapSeedTest.php` — FOUND
- `backend/tests/Feature/FinnGen/ImportEndpointsOverwriteTest.php` — FOUND
- `backend/tests/Feature/FinnGen/CoverageProfilePopulationTest.php` — FOUND
- `backend/tests/Feature/FinnGen/CoverageInvariantTest.php` — FOUND
- `backend/tests/Feature/FinnGen/BaselineScanOutputTest.php` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/CoverageProfileBadge.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/DisabledGenerateCTA.test.tsx` — FOUND

Commits verified in `git log 7889a083f..HEAD`:
- `d8f2d0786` docs(13-01): lock ADR-001 + ADR-002 — FOUND
- `b84ed2e73` test(13-01): 8 failing Pest skeletons — FOUND
- `98df72982` test(13-01): 2 failing Vitest skeletons — FOUND

Pint: `{"result":"pass"}` against `backend/tests/Unit/FinnGen` + `backend/tests/Feature/FinnGen`.
Pest filter discovery: 14 RED in 0.42s (well under 30s Wave-0 gate).
Vitest discovery: 2 RED test files in 731ms.
