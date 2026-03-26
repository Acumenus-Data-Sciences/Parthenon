---
phase: 04-person-and-demographics
plan: 02
subsystem: etl
tags: [omop, race, ethnicity, person-builder, demographics, pandas]

# Dependency graph
requires:
  - phase: 04-01
    provides: person_builder.py with build_person_roster, resolve_gender, resolve_dob
provides:
  - resolve_race() mapping 9 boolean race columns to OMOP concept_ids
  - resolve_ethnicity() mapping ethnicity text to OMOP concept_ids
  - build_person_roster() now populates race/ethnicity fields from Demographics_5211
affects: [05-visit-occurrence, 07-medications, 12-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [boolean-column-to-concept mapping, multi-value comma-separated source_value]

key-files:
  created: []
  modified:
    - scripts/irsf_etl/lib/person_builder.py
    - scripts/irsf_etl/tests/test_person_builder.py

key-decisions:
  - "Multi-race patients get concept_id=0 with comma-separated source_value preserving all labels"
  - "Non-concept race columns (Other, Refused, Unknown, Unknown or not reported) map to concept_id=0 with label in source_value"
  - "5201-only patients (no Demographics_5211 match) default to race_concept_id=0 and ethnicity_concept_id=0"

patterns-established:
  - "Boolean-to-concept mapping: RACE_BOOLEAN_MAP dict of column->(concept_id, label) tuples"
  - "_is_set() helper for pd.NA/NaN/None-safe boolean column checking"

requirements-completed: [PERS-03, PERS-04]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 04 Plan 02: Race and Ethnicity Mapping Summary

**Race/ethnicity mapping from Demographics_5211 boolean columns and Ethnicity text to OMOP concept_ids with multi-race handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T12:47:59Z
- **Completed:** 2026-03-26T12:51:25Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments
- Added resolve_race() mapping 5 OMOP race concepts + 4 non-concept race columns from boolean flags
- Added resolve_ethnicity() mapping Hispanic/Non-Hispanic to OMOP concept_ids 38003563/38003564
- Updated build_person_roster() to populate race/ethnicity from Demographics_5211 join
- Multi-race patients correctly get concept_id=0 with comma-separated source_value
- 59 tests passing (26 new race/ethnicity tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Race and ethnicity mapping with multi-race handling** - `fd56be4d8` (feat, TDD)

## Files Created/Modified
- `scripts/irsf_etl/lib/person_builder.py` - Added RACE_BOOLEAN_MAP, NON_RACE_BOOLEAN_MAP, ETHNICITY_MAP constants; resolve_race(), resolve_ethnicity(), _is_set() functions; updated build_person_roster()
- `scripts/irsf_etl/tests/test_person_builder.py` - Added TestResolveRace (12 tests), TestResolveEthnicity (7 tests), 7 integration tests for race/ethnicity in build_person_roster

## Decisions Made
- Multi-race patients get concept_id=0 with comma-separated labels in race_source_value (OMOP CDM has no multi-race concept)
- Non-concept race columns (Other, Refused, Unknown, Unknown or not reported) map to concept_id=0 preserving original label
- 5201-only patients default to race_concept_id=0 and ethnicity_concept_id=0 (no Demographics_5211 data available)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Person roster now fully populated with gender, DOB, race, and ethnicity
- Ready for Phase 05 (visit occurrence) which will reference person_ids
- Race/ethnicity pattern (boolean-to-concept mapping) reusable for other boolean-encoded IRSF fields

---
*Phase: 04-person-and-demographics*
*Completed: 2026-03-26*
