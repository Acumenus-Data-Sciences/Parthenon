---
phase: 11-data-loading-and-observation-periods
plan: "02"
subsystem: database
tags: [omop, observation-period, cdm-source, data-source, postgresql]

requires:
  - phase: 11-01
    provides: All clinical tables loaded into omop schema (974,526 rows)
provides:
  - 1,858 observation periods covering true event date ranges per person
  - CDM_SOURCE populated with IRSF-NHS metadata (CDM v5.4)
  - IRSF-NHS registered as Parthenon data source with CDM/Vocabulary/Results daimons
  - --post-load-only flag for running post-load phases independently
affects: [12-validation, achilles, dqd, cohort-builder]

tech-stack:
  added: []
  patterns: [ObservationPeriodCalculator person-filtered INNER JOIN, post-load-only CLI flag]

key-files:
  modified:
    - backend/app/Console/Commands/LoadIrsfCommand.php
    - backend/app/Services/Ingestion/ObservationPeriodCalculator.php

key-decisions:
  - "ObservationPeriodCalculator filters to person table via INNER JOIN to avoid computing periods for orphan person_ids in shared event tables"
  - "Added --post-load-only flag to LoadIrsfCommand for running post-load phases when staging CSVs are not mounted in container"
  - "CDM_SOURCE uses delete+insert instead of updateOrInsert (cdm_source table has no PK)"
  - "Vocabulary version detected from vocabulary table (v5.0 30-AUG-24)"

patterns-established:
  - "Post-load phases pattern: observation periods, CDM_SOURCE, data source registration as separate private methods"
  - "ObservationPeriodCalculator always JOINs person table for FK integrity"

requirements-completed: [LOAD-02, LOAD-03, LOAD-04]

duration: 10min
completed: 2026-03-26
---

# Phase 11 Plan 02: Observation Period Computation and CDM_SOURCE Population Summary

**1,858 observation periods computed via ObservationPeriodCalculator with 100% person coverage, CDM_SOURCE populated with IRSF-NHS metadata, and data source registered with 3 daimons**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-26T19:13:59Z
- **Completed:** 2026-03-26T19:24:00Z
- **Tasks:** 1 (all steps in single atomic commit)
- **Files modified:** 2

## Accomplishments

- Computed 1,858 observation periods covering true event date ranges per person (earliest to latest across visit, drug, measurement, observation tables)
- Verified 100% person coverage: 1,858 persons = 1,858 observation periods (0 missing)
- Populated CDM_SOURCE with IRSF-NHS metadata: CDM v5.4, vocabulary v5.0 30-AUG-24
- Registered IRSF-NHS as Parthenon data source (id=57) with CDM, Vocabulary, Results daimons
- Added --post-load-only flag for independent post-load execution

## Task Commits

1. **Steps 1-6: Observation periods, CDM_SOURCE, data source, Pint** - `2c825f940` (feat)

## Files Created/Modified

- `backend/app/Console/Commands/LoadIrsfCommand.php` - Added Phase 2-4 post-load methods, --post-load-only flag, final summary output
- `backend/app/Services/Ingestion/ObservationPeriodCalculator.php` - Fixed missing table handling (try-catch), added INNER JOIN person filter

## Decisions Made

- **ObservationPeriodCalculator person filter:** The omop schema contains a `procedure_occurrence` table with 110M rows from other datasets (Synthea). The calculator's UNION ALL was producing 1,004,034 observation periods instead of 1,858. Added INNER JOIN to person table to ensure only persons in the person table get observation periods. This is always correct per OMOP CDM FK semantics.
- **--post-load-only flag:** The scripts/irsf_etl/output/staging directory is not mounted in the PHP Docker container. Added a flag to skip CSV loading and run only post-load phases.
- **CDM_SOURCE delete+insert:** Used delete+insert instead of updateOrInsert because cdm_source has no primary key column in the OMOP spec. The updateOrInsert would need a unique key to match on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ObservationPeriodCalculator missing table handling**
- **Found during:** Step 1 (observation period computation)
- **Issue:** `$cdm->table($table)->exists()` throws QueryException when table doesn't exist (e.g., condition_occurrence was skipped in Plan 11-01)
- **Fix:** Wrapped in try-catch to gracefully skip missing tables
- **Files modified:** backend/app/Services/Ingestion/ObservationPeriodCalculator.php
- **Verification:** Calculator skips condition_occurrence and procedure_occurrence gracefully
- **Committed in:** 2c825f940

**2. [Rule 1 - Bug] ObservationPeriodCalculator computing periods for orphan person_ids**
- **Found during:** Step 1 (observation period computation)
- **Issue:** procedure_occurrence has 110M rows with 1,004,029 distinct person_ids from other datasets. Calculator was creating observation periods for all of them, not just IRSF persons in the person table.
- **Fix:** Added `INNER JOIN person p ON p.person_id = ae.person_id` to the INSERT...SELECT query
- **Files modified:** backend/app/Services/Ingestion/ObservationPeriodCalculator.php
- **Verification:** 1,858 observation periods (matches person count exactly)
- **Committed in:** 2c825f940

**3. [Rule 3 - Blocking] Infrastructure tables not created in post-load-only mode**
- **Found during:** Step 1
- **Issue:** --post-load-only flag skipped createInfrastructureTables(), but omop.observation_period and omop.cdm_source tables didn't exist
- **Fix:** Called createInfrastructureTables() in the post-load-only code path too
- **Files modified:** backend/app/Console/Commands/LoadIrsfCommand.php
- **Committed in:** 2c825f940

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. The ObservationPeriodCalculator person filter is an improvement that benefits all users, not just IRSF loading.

## Issues Encountered

- The omop.observation_period table had not been created during Plan 11-01 execution (the CREATE TABLE IF NOT EXISTS via PHP connection silently failed or created in wrong schema). Resolved by creating directly via psql and ensuring createInfrastructureTables() runs in post-load-only mode.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All IRSF-NHS data is loaded and verified: 1,858 persons, 9,003 visits, 41,866 drug exposures, 370,581 measurements, 550,893 observations, 86 deaths, 1,858 observation periods
- CDM_SOURCE populated, data source registered with daimons
- Ready for Phase 12: DQD checks, Achilles characterization, temporal integrity, Rett-specific plausibility, and cohort buildability verification

---
*Phase: 11-data-loading-and-observation-periods*
*Completed: 2026-03-26*
