---
phase: 05-visit-derivation
plan: 01
subsystem: etl
tags: [omop, visit_occurrence, pandas, pandera, registry-data]

requires:
  - phase: 04-person-demographics
    provides: person_id_map.csv with 1,858 entries for participant_id resolution
  - phase: 02-shared-library
    provides: date_assembler, csv_utils, rejection_log, id_registry
provides:
  - staging/visit_occurrence.csv (9,003 OMOP CDM v5.4 visit records)
  - staging/visit_id_map.csv (downstream lookup map for clinical event scripts)
  - visit_derivation.py module with 4 exported functions
  - Pandera schema for visit_occurrence output validation
affects: [07-medications, 08-conditions, 09-measurements, 10-observations]

tech-stack:
  added: []
  patterns: [two-source visit strategy, split-date assembly for hospitalizations, dedup on composite key]

key-files:
  created:
    - scripts/irsf_etl/visit_derivation.py
    - scripts/irsf_etl/schemas/visit_occurrence.py
    - scripts/irsf_etl/tests/test_visit_derivation.py
  modified:
    - scripts/irsf_etl/__main__.py
    - scripts/irsf_etl/tests/conftest.py

key-decisions:
  - "LogMasterForm_5211.csv as authoritative 5211 visit source (not scanning all 60+ clinical tables)"
  - "5201-only patients (822) identified via registry and scanned from ClinicalAssessment + Measurements"
  - "PRN visits from 5201 filtered when they duplicate existing dates for same person"
  - "Dedup on (person_id, visit_date, visit_concept_id) -- same date different type creates separate records"
  - "max_year=2026 for hospitalization date assembly (source data includes recent hospitalizations)"

patterns-established:
  - "ETLConfig override pattern: construct with source_root/output_dir for test isolation"
  - "Two-source visit strategy: LogMasterForm for 5211 + clinical table scan for 5201-only"

requirements-completed: [VISIT-01, VISIT-02]

duration: 6min
completed: 2026-03-26
---

# Phase 5 Plan 1: Visit Derivation Summary

**Derived 9,003 visit_occurrence records from IRSF registry (6,210 outpatient, 1,652 inpatient, 1,141 ER) covering 1,826 patients with Pandera-validated OMOP CDM v5.4 output**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T12:54:50Z
- **Completed:** 2026-03-26T13:01:23Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments
- Visit derivation from 3 sources: LogMasterForm_5211 (2,267 visits), 5201 clinical tables (7,711 visits for 822 5201-only patients), Hospitalizations_5211 (2,874 visits)
- Deduplication reduced 12,852 raw visits to 9,003 unique records
- Pandera schema validation ensures OMOP CDM v5.4 compliance
- 170 hospitalizations rejected due to unassemblable dates (all logged to rejection report)
- 12 tests at 80% coverage on visit_derivation.py; 364 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Pandera schema for visit_occurrence** - `04e284b1b` (feat)
2. **Task 2: Visit derivation module** - `a22575151` (feat)
3. **Task 3: CLI integration** - `a6c701691` (feat)
4. **Task 4: Tests** - `d705c53bc` (test)
5. **Task 5: Run and validate** - (validation only, no new files)

## Files Created/Modified
- `scripts/irsf_etl/schemas/visit_occurrence.py` - Pandera schema for OMOP visit_occurrence output
- `scripts/irsf_etl/visit_derivation.py` - Main derivation module (4 exported functions, 289 lines)
- `scripts/irsf_etl/__main__.py` - Added visit-derivation CLI subcommand
- `scripts/irsf_etl/tests/test_visit_derivation.py` - 12 tests covering all functions
- `scripts/irsf_etl/tests/conftest.py` - Added 3 new fixtures for visit derivation tests

## Decisions Made
- Used LogMasterForm_5211.csv as single authoritative source for 5211 study visits rather than scanning all 60+ clinical tables (avoids massive duplication)
- Identified 822 5201-only patients (not 187 as estimated in research) and scanned ClinicalAssessment + Measurements for their visit dates
- Set max_year=2026 for hospitalization date assembly since data includes hospitalizations up to recent years
- PRN visits from 5201 tables filtered when they duplicate existing dates (prevents inflated visit counts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- ETLConfig uses Pydantic computed properties (@property) which cannot be overridden via `object.__setattr__`. Tests were rewritten to construct ETLConfig with source_root/output_dir parameters and matching directory structures instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- visit_occurrence.csv and visit_id_map.csv ready for downstream Phases 7-10 (medications, conditions, measurements, observations)
- VisitResolver (Phase 5 Plan 2) will build the lookup utility for clinical event scripts to resolve visit_occurrence_id from (person_id, date) tuples

---
*Phase: 05-visit-derivation*
*Completed: 2026-03-26*
