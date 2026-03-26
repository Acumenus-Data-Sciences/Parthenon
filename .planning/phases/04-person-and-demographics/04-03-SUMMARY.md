---
phase: 04-person-and-demographics
plan: 03
subsystem: etl
tags: [python, pandas, omop, death-table, deduplication, tdd]

requires:
  - phase: 04-01
    provides: PersonIdRegistry for person_id resolution
  - phase: 02-01
    provides: date_assembler for split-column date assembly

provides:
  - build_death_records() function for OMOP death staging
  - Death record deduplication by person_id
  - SNOMED cause-of-death code parsing

affects: [05-visit, 12-validation]

tech-stack:
  added: []
  patterns: [death-record-deduplication, snomed-code-parsing]

key-files:
  created:
    - scripts/irsf_etl/lib/death_builder.py
    - scripts/irsf_etl/tests/test_death_builder.py
  modified: []

key-decisions:
  - "Load only DeathRecord_5211 (strict superset of 5201, 92 vs 71 rows)"
  - "Deduplication keeps first valid record per person_id (not most recent)"
  - "cause_concept_id set to 0 placeholder (validation deferred to Phase 12)"

patterns-established:
  - "Death builder follows same pattern as person_builder: iterrows + rejection_log + immutable output"
  - "SNOMED code parsing with _parse_snomed_code: int if numeric, 0 otherwise"

requirements-completed: [PERS-06]

duration: 3min
completed: 2026-03-26
---

# Phase 04 Plan 03: Death Record Builder Summary

**OMOP death record builder extracting ~89 unique deaths from DeathRecord_5211 with person_id deduplication and SNOMED cause-of-death parsing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T12:48:11Z
- **Completed:** 2026-03-26T12:51:08Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Death record builder producing 7-column OMOP death staging DataFrame
- Deduplication by person_id (first valid record kept, duplicates logged as warnings)
- death_date assembly from split DeathDateMonth/Day/Year via date_assembler
- death_type_concept_id = 32879 (Registry) for all records
- cause_source_value preserves CauseofDeathImmediateCauseDesc text
- cause_source_concept_id parses SNOMED codes from CauseofDeathImmediateCauseSNOM
- 26 tests passing with 89% coverage on death_builder.py

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests for death builder** - `8f84460cc` (test)
2. **Task 1 GREEN: Death record builder implementation** - `35d267043` (feat)

## Files Created/Modified
- `scripts/irsf_etl/lib/death_builder.py` - OMOP death record builder with deduplication, date assembly, SNOMED parsing
- `scripts/irsf_etl/tests/test_death_builder.py` - 26 tests across 6 test classes covering output structure, date assembly, cause fields, deduplication, error handling, immutability, edge cases

## Decisions Made
- Load only DeathRecord_5211 (strict superset of 5201 per research)
- Deduplication keeps first valid record per person_id (chronological order from source file)
- cause_concept_id set to 0 as placeholder (concept mapping deferred)
- Invalid SNOMED strings silently default to 0 (not logged as errors -- these are source data quality issues handled downstream)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Death builder ready for integration into main ETL pipeline
- Depends on PersonIdRegistry (04-01) being loaded from crosswalk CSV
- cause_concept_id validation deferred to Phase 12 (Validation)

---
*Phase: 04-person-and-demographics*
*Completed: 2026-03-26*
