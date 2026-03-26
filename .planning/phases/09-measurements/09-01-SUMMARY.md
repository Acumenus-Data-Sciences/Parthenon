---
phase: 09-measurements
plan: 01
subsystem: etl
tags: [measurement, omop, loinc, pandera, unpivot, growth]

# Dependency graph
requires:
  - phase: 04-person
    provides: person_id_map.csv for participant_id resolution
  - phase: 05-visits
    provides: visit_id_map.csv for visit_occurrence_id resolution
provides:
  - Pandera schema for OMOP measurement validation (measurement_schema)
  - Reusable unpivot_wide_to_long helper for all measurement sources
  - Growth measurement ETL producing 34,135 OMOP measurement rows
  - staging/measurement.csv with LOINC-mapped growth data
  - CLI measurements subcommand
affects: [09-02, 09-03, 11-data-loading, 12-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [wide-to-long unpivot with NULL filtering, nullable Int64 Pandera schema columns]

key-files:
  created:
    - scripts/irsf_etl/schemas/measurement.py
    - scripts/irsf_etl/measurement_etl.py
    - scripts/irsf_etl/tests/test_measurement_etl.py
  modified:
    - scripts/irsf_etl/__main__.py

key-decisions:
  - "Used pd.Int64Dtype() for nullable integer columns in Pandera schema (standard int fails on None coercion)"
  - "NaT string treated as invalid date in unpivot helper (strftime on NaT produces 'NaT' string)"
  - "HeightMeasurementPosition appended as parenthetical qualifier to measurement_source_value"

patterns-established:
  - "Wide-to-long unpivot: measure_specs tuple pattern (source_col, concept_id, unit_concept_id, unit_source) reusable for CSS/labs/SF-36"
  - "NULL value filtering during unpivot prevents row inflation (MEAS-06)"

requirements-completed: [MEAS-01, MEAS-06]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 9 Plan 1: Growth Measurement Unpivot Summary

**Wide-to-long unpivot of GROWTH_5201_5211.csv producing 34,135 OMOP measurement rows with LOINC mappings for height (3036277), weight (3025315), BMI (3038553), and head circumference (3036832)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T18:20:22Z
- **Completed:** 2026-03-26T18:26:06Z
- **Tasks:** 5
- **Files modified:** 4

## Accomplishments
- Pandera schema for OMOP CDM v5.4 measurement table with nullable Int64 support
- Reusable unpivot_wide_to_long helper filtering NULL values (MEAS-06 compliance)
- 34,135 growth measurement rows from 8,781 wide-format source records
- HeightMeasurementPosition qualifier preserved in measurement_source_value
- 12 passing tests covering NULL filtering, LOINC mapping, unit mapping, visit resolution, rejections, schema validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Pandera schema** - `ba7a5cda7` (feat)
2. **Task 2: Unpivot helper and growth ETL** - `374be6a5d` (feat) -- note: later amended with bug fixes in Task 4
3. **Task 3: CLI integration** - `29de0cfe0` (feat)
4. **Task 4: Tests** - `b1af75648` (test)
5. **Task 5: Real data validation** - no commit (output/ gitignored)

## Files Created/Modified
- `scripts/irsf_etl/schemas/measurement.py` - Pandera schema for OMOP measurement validation
- `scripts/irsf_etl/measurement_etl.py` - Growth ETL with reusable unpivot helper (325 lines)
- `scripts/irsf_etl/tests/test_measurement_etl.py` - 12 tests for measurement ETL
- `scripts/irsf_etl/__main__.py` - Added measurements CLI subcommand

## Decisions Made
- Used pd.Int64Dtype() for nullable integer columns in Pandera schema because standard `int` type cannot coerce Python `None` values
- Treated "NaT" string as invalid date in unpivot (pd.to_datetime with errors='coerce' produces NaT, strftime converts to "NaT" string)
- HeightMeasurementPosition appended as parenthetical to measurement_source_value (e.g., "HeightCm (standing)") rather than separate column

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pandera schema nullable int coercion failure**
- **Found during:** Task 4 (test execution)
- **Issue:** Pandera cannot coerce Python None to `int` type for nullable columns (value_as_concept_id, visit_occurrence_id, etc.)
- **Fix:** Changed nullable int columns to pd.Int64Dtype() which supports pd.NA
- **Files modified:** scripts/irsf_etl/schemas/measurement.py
- **Verification:** Schema validation test passes
- **Committed in:** b1af75648 (Task 4 commit)

**2. [Rule 1 - Bug] NaT string not caught by date validation**
- **Found during:** Task 4 (test execution)
- **Issue:** pd.to_datetime with errors='coerce' produces NaT, strftime converts to literal "NaT" string which passed the empty-string check
- **Fix:** Added explicit "NaT" string check in unpivot date validation
- **Files modified:** scripts/irsf_etl/measurement_etl.py
- **Verification:** Unparseable date rejection test passes
- **Committed in:** b1af75648 (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed bugs above.

## Real Data Validation Results
- **Row count:** 34,135 (expected ~34,139, within 33,000-35,000 range)
- **NULL filter proof:** 34,135 < 35,124 (4 * 8,781) confirms NULL values filtered
- **Concept distribution:** Height 8,600, Weight 8,646, BMI 8,492, FOC 8,397
- **Unit mapping:** Height/FOC -> 8582 (cm), Weight -> 9529 (kg), BMI -> 9531 (kg/m2)
- **Person coverage:** 1,817 unique patients with measurements
- **Rejections:** 1 (in growth rejection report)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- measurement_schema and unpivot_wide_to_long helper ready for Plans 09-02 (CSS) and 09-03 (labs/SF-36)
- staging/measurement.csv will be appended to by subsequent measurement plans
- transform_measurements orchestrator has placeholder for additional measurement sources

---
*Phase: 09-measurements*
*Completed: 2026-03-26*
