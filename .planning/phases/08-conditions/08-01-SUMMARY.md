---
phase: 08-conditions
plan: 01
subsystem: etl
tags: [omop, condition_occurrence, snomed, pandera, pandas, irsf]

# Dependency graph
requires:
  - phase: 04-person
    provides: person_id_map.csv for participant ID resolution
  - phase: 05-visits
    provides: visit_id_map.csv for visit_occurrence_id resolution
  - phase: 02-shared-lib
    provides: date_assembler, csv_utils, id_registry, rejection_log
provides:
  - condition_occurrence.py extraction script for 4 IRSF source tables
  - Pandera schema for condition_occurrence output validation
  - Comprehensive test suite at 87% coverage
affects: [08-02-conditions-validation, 11-data-loading]

# Tech tracking
tech-stack:
  added: []
  patterns: [table-specific-extractor-pattern, snomed-regex-parser, hardcoded-concept-mapping]

key-files:
  created:
    - scripts/irsf_etl/condition_occurrence.py
    - scripts/irsf_etl/schemas/condition_occurrence.py
    - scripts/irsf_etl/tests/test_condition_occurrence.py
  modified: []

key-decisions:
  - "condition_type_concept_id = 32879 (Registry) for all records -- reflects IRSF-NHS data provenance"
  - "parse_snomed_output regex extracts code from formatted string -- handles confidence scores and domain tags"
  - "int(float(str())) conversion for participant_id to handle CSV string/float/int variants"

patterns-established:
  - "Table-specific extractor pattern: each source table gets its own extract_* function producing a common intermediate DataFrame"
  - "Hardcoded SNOMED mapping dicts for tables without pre-mapped codes (seizures, fractures)"
  - "Date fallback chain: split date columns -> visit_date as proxy"

requirements-completed: [COND-01, COND-02]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 8 Plan 1: Condition Extraction Summary

**Four-table condition extractor with SNOMED parsing, hardcoded seizure/fracture mappings, date fallback, and 87% test coverage**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T18:20:06Z
- **Completed:** 2026-03-26T18:27:00Z
- **Tasks:** 11
- **Files modified:** 3

## Accomplishments
- Pandera schema validating condition_occurrence output against OMOP CDM v5.4
- SNOMED regex parser extracting codes from "Name (domain) code:NNNNNNN confidence [SNOMED CT]" formatted strings
- Four table-specific extractors: chronic diagnoses (SNOWMEDOutput), seizures (hardcoded map), bone fractures (location map), infections (InfectionSNOMEDOutput)
- Main orchestrator with dedup, deterministic ID assignment, schema validation, rejection reporting
- 30 tests at 87% coverage covering all extractors, edge cases, and integration scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Pandera schema** - `cd259d0d5` (feat)
2. **Tasks 2-9: All extractors and orchestrator** - `b21f656da` (feat)
3. **Tasks 10-11: Tests and verification** - `c16b53aed` (test)

## Files Created/Modified
- `scripts/irsf_etl/schemas/condition_occurrence.py` - Pandera schema for OMOP CDM v5.4 condition_occurrence
- `scripts/irsf_etl/condition_occurrence.py` - Four extractors + orchestrator (525 lines)
- `scripts/irsf_etl/tests/test_condition_occurrence.py` - 30 tests at 87% coverage

## Decisions Made
- condition_type_concept_id = 32879 (Registry) for all records, matching IRSF-NHS data provenance
- SNOMED regex `code:(\d+)\s+[\d.]+\s+\[SNOMED CT\]` handles all observed format variations
- int(float(str())) conversion chain for participant_id handles CSV reading variants (str, float, int)
- "Not a seizure" (390 rows) excluded entirely; "Rett spell" emitted with concept_id=0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed participant_id type coercion for registry lookup**
- **Found during:** Task 10 (test execution)
- **Issue:** CSV reads participant_id as string; PersonIdRegistry.resolve() expects int
- **Fix:** Added int(float(str())) conversion with error handling in _resolve_person_id()
- **Files modified:** scripts/irsf_etl/condition_occurrence.py
- **Verification:** All 30 tests pass
- **Committed in:** c16b53aed (Task 10-11 commit)

**2. [Rule 1 - Bug] Fixed test CSV field count mismatches**
- **Found during:** Task 11 (test verification)
- **Issue:** Test CSV data lines had extra commas creating field count > header count
- **Fix:** Corrected comma counts in seizure, fracture, and chronic diagnosis test data
- **Files modified:** scripts/irsf_etl/tests/test_condition_occurrence.py
- **Verification:** All 30 tests pass
- **Committed in:** c16b53aed (Task 10-11 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct test execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- condition_occurrence.py ready for Plan 08-02 (SNOMED validation via VocabularyValidator)
- Staging CSV production depends on real source data files being present
- All four extractors follow the same intermediate DataFrame pattern for easy extension

---
*Phase: 08-conditions*
*Completed: 2026-03-26*
