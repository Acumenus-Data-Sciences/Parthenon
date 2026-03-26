---
phase: 12-validation-and-cohort-verification
plan: 02
subsystem: validation
tags: [achilles, temporal-integrity, omop-cdm, data-quality, psycopg2]

requires:
  - phase: 11-data-loading-and-observation-periods
    provides: IRSF-NHS data loaded into omop schema, results schema tables created
provides:
  - Achilles characterization dispatch and verification script
  - Temporal integrity zero-violation validation script
  - Combined validation runner with unified report output
affects: [12-03-rett-plausibility-cohorts]

tech-stack:
  added: [requests]
  patterns: [api-dispatch-poll-verify, sql-assertion-validation]

key-files:
  created:
    - scripts/irsf_etl/validate_achilles.py
    - scripts/irsf_etl/validate_temporal.py
    - scripts/irsf_etl/validate_achilles_temporal.py
  modified: []

key-decisions:
  - "Achilles dispatch via API with configurable timeout (default 15min) and --skip-dispatch fallback for post-hoc verification"
  - "Temporal checks use year_of_birth comparison (not full date) for before-birth since OMOP person may only have year"
  - "Combined runner produces unified achilles_temporal_report.json for single-file validation evidence"

patterns-established:
  - "API dispatch-poll-verify pattern: POST to start, GET progress loop, then DB verification"
  - "SQL assertion pattern: COUNT(*) violations query with hard zero-assertion for data integrity"

requirements-completed: [VAL-02, VAL-03]

duration: 3min
completed: 2026-03-26
---

# Phase 12 Plan 02: Achilles Characterization and Temporal Integrity Summary

**Achilles API dispatch/verify script and temporal zero-violation SQL checks across 5 OMOP event tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T19:27:06Z
- **Completed:** 2026-03-26T19:30:13Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Achilles validation script dispatches run via API, polls progress, verifies results in results schema
- Temporal integrity script checks zero events before birth and after death across condition_occurrence, drug_exposure, measurement, observation, visit_occurrence
- Combined runner produces unified achilles_temporal_report.json with pass/fail summary

## Task Commits

Each task was committed atomically:

1. **Task 1: Achilles dispatch and verification** - `09ef90d87` (feat)
2. **Task 2: Temporal integrity validation** - `2dbcaabf8` (feat)
3. **Task 3: Combined validation runner** - `7a9298005` (feat)

## Files Created/Modified
- `scripts/irsf_etl/validate_achilles.py` - Achilles run dispatch, progress polling, results verification, API endpoint checks
- `scripts/irsf_etl/validate_temporal.py` - SQL queries for zero events before birth/after death across 5 event tables
- `scripts/irsf_etl/validate_achilles_temporal.py` - Combined orchestrator producing unified report

## Decisions Made
- Used API dispatch with configurable timeout rather than direct DB execution (Achilles engine is PHP-native)
- Added --skip-dispatch flag for re-running verification after manual/prior Achilles completion
- Year-of-birth comparison for before-birth checks (OMOP person may only have year_of_birth)
- Immutable dataclasses (frozen=True) for all result types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Scripts use existing ETLConfig database connection and Parthenon API.

## Next Phase Readiness
- Achilles and temporal validation scripts ready for execution against live IRSF-NHS data
- Plan 12-03 (Rett-specific plausibility and cohort buildability) can proceed independently

---
*Phase: 12-validation-and-cohort-verification*
*Completed: 2026-03-26*
