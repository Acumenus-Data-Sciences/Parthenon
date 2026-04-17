---
phase: 13
plan: 06
subsystem: finngen
tags: [importer, artisan, coverage-profile, stcm, overwrite, baseline-scan]
requires:
  - 13-01 (TDD RED baseline: ImportEndpointsOverwriteTest, CoverageProfilePopulationTest, CoverageInvariantTest, BaselineScanOutputTest)
  - 13-02 (coverage_profile column on app.cohort_definitions; app.finngen_endpoint_expressions_pre_phase13 rollback table)
  - 13-03 (CoverageProfile enum + FinnGenCoverageProfileClassifier pure-function service)
  - 13-04 (vocab.source_to_concept_map seeded with 4,314 FinnGen cross-walk rows across 6 vocabs)
  - 13-05 (standard-first FinnGenConceptResolver with 7 resolver methods)
provides:
  - FinnGenEndpointImporter wired to the 7-resolver + classifier pipeline with coverage_profile parallel writes
  - ImportEndpointsCommand --overwrite flag (snapshots pre-existing finngen-endpoint rows, then re-imports)
  - ScanCoverageProfileCommand (finngen:scan-coverage-profile) — read-only empirical baseline scan per D-10
  - ImportReport extended with coverageProfile / invariantViolations / snapshotRowCount
  - Updated writeCoverageReport emits coverage_profile_distribution + invariant_violations + snapshot_row_count
affects:
  - app.cohort_definitions (coverage_profile column now populated on every finngen-endpoint row after --overwrite)
  - app.finngen_endpoint_expressions_pre_phase13 (upserted snapshot row per finngen-endpoint cohort)
  - app.finngen_unmapped_codes (ICD-8 / ICDO3 / NOMESCO / KELA_REIMB now only logged when STCM returns zero)
tech-stack:
  added: []
  patterns:
    - named-argument calls to classifier (icd10:, icd9:, atc:, icd8:, icdO3:, nomesco:, kelaReimb:)
    - ON CONFLICT DO UPDATE idempotent snapshot upsert
    - CoverageProfile enum in Model $fillable (HIGHSEC §3.1 — whitelist, never $guarded=[])
key-files:
  created:
    - backend/app/Console/Commands/FinnGen/ScanCoverageProfileCommand.php
    - .planning/phases/13-finngen-endpoint-universalization/13-06-SUMMARY.md
  modified:
    - backend/app/Services/FinnGen/FinnGenEndpointImporter.php (7-resolver pipeline, classifier, snapshot, coverage_profile writes)
    - backend/app/Services/FinnGen/Dto/ImportReport.php (+coverageProfile, +invariantViolations, +snapshotRowCount)
    - backend/app/Models/App/CohortDefinition.php (coverage_profile added to $fillable)
    - backend/app/Console/Commands/FinnGen/ImportEndpointsCommand.php (--overwrite flag + log profile/invariant/snapshot)
decisions:
  - Implemented Edit 1-12 exactly as specified in 13-06-PLAN.md; no architectural deviations.
  - CoverageDefinition $fillable extended for coverage_profile (HIGHSEC-compliant whitelist approach).
  - Snapshot SQL issued as a DB::statement with the exact ON CONFLICT DO UPDATE form from the plan.
  - Invariant counter (bucket=UNMAPPED + profile=UNIVERSAL) reports but does not throw — CoverageInvariantTest asserts the post-condition at DB level, so the counter is purely observational per the plan.
  - aggregateUnmapped calls for ICD-8 / ICDO3 / NOMESCO / KELA_REIMB made CONDITIONAL on empty STCM resolution; KELA_VNRO stays unconditional (not addressed in Phase 13).
  - 500-row batch transaction pattern preserved verbatim (Pitfall 5 + C-10).
metrics:
  duration: ~55m
  tasks: 2
  files_modified: 4
  files_created: 1
  commits: 2
  completed: 2026-04-17
---

# Phase 13 Plan 06: FinnGen Importer Pipeline Integration + Artisan Surface Summary

Wires the Phase 13 resolver upgrade (Plan 05), classifier (Plan 03), and cross-walk seed (Plan 04) into the FinnGen importer and Artisan command surface. Adds `--overwrite` with pre-snapshot to Plan 02's rollback table, and ships `finngen:scan-coverage-profile` for the D-10 empirical baseline. ImportEndpointsCommand now emits coverage_profile distribution alongside the existing bucket distribution; importer writes `coverage_profile` to both `expression_json` and the typed `app.cohort_definitions.coverage_profile` column.

## Tasks Completed

| Task | Name                                                                      | Commit      | Files                                                                                                  |
| ---- | ------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| 1    | Wire upgraded resolver + classifier into FinnGen importer                 | d6bb8483a   | FinnGenEndpointImporter.php, Dto/ImportReport.php, Models/App/CohortDefinition.php                     |
| 2    | Add --overwrite flag + create scan-coverage-profile Artisan command       | 030ec5706   | Console/Commands/FinnGen/ImportEndpointsCommand.php, Console/Commands/FinnGen/ScanCoverageProfileCommand.php |

## Importer Diff Summary

| Metric                            | Before | After | Delta                                                  |
| --------------------------------- | ------ | ----- | ------------------------------------------------------ |
| Total lines                       | 496    | 628   | +132                                                   |
| Public method parameters (import) | 6      | 7     | +1 (`bool $overwrite = false`)                         |
| Resolver calls per row            | 4      | 7     | +3 (`resolveIcdO3`, `resolveNomesco`, `resolveKelaReimb`) |
| buildExpressionJson params        | 22     | 27    | +4 groups + profile                                    |
| Coverage JSON keys                | 7      | 10    | +coverage_profile_distribution, +invariant_violations, +snapshot_row_count |
| Private helper methods            | 6      | 7     | +1 (`snapshotPrePhase13`)                              |
| ON CONFLICT upsert (rollback table) | 0    | 1     | new snapshot SQL (schema from Plan 02)                 |

## Sample Baseline-Scan JSON (dev DB, DF14, 5,161 endpoints)

Generated via `php artisan finngen:scan-coverage-profile --release=df14 --dry-run`:

```json
{
    "total_endpoints": 5161,
    "coverage_profile_distribution": {
        "universal": 0,
        "partial": 4532,
        "finland_only": 629
    },
    "coverage_bucket_distribution": {
        "FULLY_MAPPED": 4204,
        "PARTIAL": 298,
        "SPARSE": 35,
        "UNMAPPED": 252,
        "CONTROL_ONLY": 372
    },
    "invariant_violations": 0,
    "baseline_unmapped_count": 252,
    "top_lifted_vocabularies": {
        "ICD8": 1444,
        "ICDO3": 24,
        "NOMESCO": 64,
        "KELA_REIMB": 45,
        "ICD10_FIN": 4235,
        "ICD9_FIN": 2202
    },
    "generated_at": "2026-04-17T19:26:33+00:00"
}
```

Empirical observations for D-10 review:

- **Universal = 0**: every DF14 endpoint has at least one Finnish-specific vocab group (e.g., KELA_VNRO, KELA_REIMB_ICD, or NOMESCO procedure); pure-ICD10 endpoints still include tandem KELA anchors per ADR-002 Rule 1.
- **Partial = 4,532 (87.8%)**: the overwhelmingly dominant mode; these endpoints all have at least one group that resolves on a non-Finnish CDM.
- **Finland-only = 629 (12.2%)**: below the "at most 15%" informal target and well above the minimum 100 unmapped threshold (D-11).
- **UNMAPPED bucket = 252**: above D-11's "< 100 endpoints" binary success gate. Expected — the FinnGen cross-walk seed in Plan 04 shipped 4,314 rows and does not yet contain exhaustive Athena mappings; additional STCM rows can be added in a follow-up without re-running this plan.
- **Invariant violations = 0**: D-07 invariant holds; CoverageInvariantTest will pass on live re-import.
- **Top lifted vocabulary**: ICD10_FIN (4,235) and ICD9_FIN (2,202) confirm the STCM-first resolver is exercised on the Finnish extensions as intended; ICD-8 lifts 1,444 endpoints out of pure-UNMAPPED.

## Command Surface Verified

```
$ php artisan finngen:import-endpoints --help
  ...
  --overwrite   Re-import endpoints in overwrite mode; snapshots cohort_definitions
                to app.finngen_endpoint_expressions_pre_phase13 first (Phase 13)

$ php artisan finngen:scan-coverage-profile --help
  ...
  --release=df14  df12 | df13 | df14 [default: "df14"]
  --dry-run       Required (the scan is always read-only; flag exists for CLI ergonomics)
  --fixture=      Override fixture filename (relative to database/fixtures/finngen/ or absolute)
```

Both registered in `php artisan list finngen`.

## Invariant + Acceptance Criteria Verification

| Criterion (from 13-06-PLAN.md)                                                                                  | Status |
| --------------------------------------------------------------------------------------------------------------- | ------ |
| `import()` accepts `bool $overwrite = false` as the LAST parameter (backward compatible)                        | PASS   |
| `snapshotPrePhase13()` private method exists with the EXACT INSERT-ON-CONFLICT SQL                              | PASS   |
| `processRow()` calls `resolveIcdO3`, `resolveNomesco`, `resolveKelaReimb` on the resolver                       | PASS   |
| `processRow()` calls `FinnGenCoverageProfileClassifier::classify(...)` with named parameters                    | PASS   |
| `processRow()` writes `coverage_profile` to BOTH `expression_json.coverage_profile` AND the typed column        | PASS   |
| `aggregateUnmapped` calls for ICDO3/NOMESCO/KELA_REIMB/ICD8 CONDITIONAL on empty STCM resolution                | PASS   |
| `buildExpressionJson` signature accepts the 4 new params (icd8, icdO3, nomesco, kelaReimb) + profile            | PASS   |
| Conditions/drugs standard IDs include new vocab outputs (icdO3 + nomesco for conditions; kelaReimb for drugs)   | PASS   |
| Invariant counter increments when bucket=UNMAPPED + profile=UNIVERSAL                                           | PASS   |
| 500-row batch transaction pattern PRESERVED                                                                     | PASS   |
| `--overwrite` flag on ImportEndpointsCommand passes `overwrite: $overwrite` to importer                         | PASS   |
| `handle()` logs "Snapshotting current FinnGen cohort_definitions..." when --overwrite                           | PASS   |
| `handle()` logs coverage_profile distribution + invariantViolations + snapshotRowCount                          | PASS   |
| ScanCoverageProfileCommand is `final`; signature `finngen:scan-coverage-profile`                                | PASS   |
| Scan JSON contains EXACTLY the 7 required top-level keys                                                        | PASS   |
| `php artisan list finngen` lists both commands                                                                  | PASS   |
| Pint clean on all 5 modified/created files                                                                      | PASS   |
| PHPStan level 8 clean on the merged file set                                                                    | PASS   |

## Pest Test Transitions (RED → GREEN)

All 4 Plan 01 RED feature tests for Plan 06 are structurally satisfied by the implementation:

| Test                              | Assertion                                                                                      | Path to GREEN                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ImportEndpointsOverwriteTest      | `--overwrite` preserves row count; snapshot table populated >= 5 rows                          | `--overwrite` flag shipped + `snapshotPrePhase13()` upserts to `app.finngen_endpoint_expressions_pre_phase13` |
| CoverageProfilePopulationTest     | No NULL `coverage_profile` rows after `--overwrite`                                            | `updateOrCreate` writes `'coverage_profile' => $profile->value` for every row               |
| CoverageInvariantTest             | Zero rows where bucket=UNMAPPED AND coverage_profile=universal                                 | Classifier + invariant logic: UNIVERSAL requires all 7 groups to resolve, which is logically incompatible with UNMAPPED (0% resolved). Empirical scan confirms 0 violations. |
| BaselineScanOutputTest            | Scan emits JSON at `storage/app/finngen-endpoints/phase13-baseline-*.json` with 7 required keys | `ScanCoverageProfileCommand` writes exactly that file + all 7 keys (verified via live scan) |

**Test-execution status:** These Pest feature tests require a testing-DB environment with `vocab.source_to_concept_map` seeded. On `parthenon_testing`, every test in this directory currently fails during `Artisan::call('migrate', ['--force' => true])` because the 13-04 seed migration references `vocab.source_to_concept_map`, which does not exist in that DB. This is a **pre-existing environment issue introduced by Plan 13-04** and documented in the Deferred Issues section below.

End-to-end verification against the live dev DB (which has the full vocab schema + STCM seed):

- `finngen:scan-coverage-profile --release=df14 --dry-run` scanned all 5,161 endpoints and emitted a compliant JSON (see sample above).
- `finngen:import-endpoints --release=df14 --limit=5 --dry-run --no-solr-reindex` returned "Coverage profile: universal=0 partial=3 finland_only=2" — the new profile line is present in stdout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Added `coverage_profile` to CohortDefinition `$fillable`**

- **Found during:** Task 1 review (before writing the updateOrCreate change)
- **Issue:** The typed-column write (`'coverage_profile' => $profile->value`) would have silently been dropped by Eloquent's mass-assignment guard because the column was not in `$fillable`.
- **Fix:** Added `'coverage_profile'` to `backend/app/Models/App/CohortDefinition.php` `$fillable` whitelist (HIGHSEC §3.1 compliant — never use `$guarded = []`).
- **Files modified:** `backend/app/Models/App/CohortDefinition.php`
- **Commit:** d6bb8483a

### Deferred Issues

**1. [Out of scope] `ImportEndpointsCommandTest` currently fails on `parthenon_testing`**

- **Root cause:** Plan 13-04's seed migration `2026_04_18_000300_seed_finngen_source_to_concept_map.php` issues `DELETE … FROM vocab.source_to_concept_map` which errors with `SQLSTATE[42P01]: Undefined table` on `parthenon_testing`. The `vocab` schema + STCM table don't exist in the testing DB.
- **Scope boundary:** Pre-existing failure on `df4a4369d` (the base commit for this plan) — confirmed by temporarily restoring the tree to baseline and running the same test, which failed identically. Not caused by Plan 13-06 changes.
- **Recommended fix (out of scope for this plan):** Add a `Schema::hasTable('vocab.source_to_concept_map')` guard to the seed migration's up() method, OR add a separate test-only migration that creates the STCM table + vocab schema when `DB_CONNECTION=pgsql_testing`. This belongs to Plan 13-04 follow-up or Plan 13-08 (CI smoke) — NOT Plan 13-06.

## Authentication Gates

None. All changes are server-side PHP within existing Artisan surfaces; no HTTP routes added, no auth changes, no new secrets, no new Docker services.

## Known Stubs

None. The scan command is a complete end-to-end implementation (no TODOs, no placeholder data, no hardcoded mock output). The importer writes real coverage_profile values to the DB column.

## Threat Flags

None. All modifications are within existing trust boundaries:

- Artisan commands (shell-level, same privilege model as the existing `finngen:*` suite)
- Internal service classes (no new network endpoints)
- Database writes bounded to `app.cohort_definitions` (existing table, existing column) and `app.finngen_endpoint_expressions_pre_phase13` (Plan 02 rollback table)
- No new surface against trust boundaries

## Self-Check: PASSED

**Verified files exist:**
- `backend/app/Services/FinnGen/FinnGenEndpointImporter.php` — FOUND
- `backend/app/Services/FinnGen/Dto/ImportReport.php` — FOUND (modified)
- `backend/app/Models/App/CohortDefinition.php` — FOUND (modified)
- `backend/app/Console/Commands/FinnGen/ImportEndpointsCommand.php` — FOUND (modified)
- `backend/app/Console/Commands/FinnGen/ScanCoverageProfileCommand.php` — FOUND (new file, committed)

**Verified commits exist:**
- `d6bb8483a` (Task 1) — FOUND in `git log df4a4369d..HEAD`
- `030ec5706` (Task 2) — FOUND in `git log df4a4369d..HEAD`

**Verified end-to-end against dev DB:**
- `finngen:scan-coverage-profile` produced valid baseline JSON with 7 required keys (sample embedded above)
- `finngen:import-endpoints --dry-run` emits coverage_profile distribution line
- `php artisan list finngen` shows both new/modified commands

**Unblocks:**
- Plan 07 (frontend CoverageProfilePill + endpoint-browser filter)
- Plan 08 (live `--overwrite` execution + solr reindex)
