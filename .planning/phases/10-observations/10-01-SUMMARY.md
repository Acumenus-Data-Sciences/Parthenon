---
phase: 10-observations
plan: 01
subsystem: etl
tags: [omop, observation, mba, pandera, pandas-melt, irsf-nhs]

# Dependency graph
requires:
  - phase: 04-demographics
    provides: person_id_map.csv for participant_id resolution
  - phase: 05-visits
    provides: visit_id_map.csv for visit_occurrence_id resolution
  - phase: 06-vocabulary
    provides: IrsfVocabulary.mba_concepts() for concept_id mapping
provides:
  - Pandera observation schema (shared by all Phase 10 plans)
  - MBA observation transformer (wide-to-long unpivot)
  - observation_mba.csv staging output (342,355 rows)
  - observation-mba CLI subcommand
affects: [10-02-observations-css, 10-03-observations-clinical, 12-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [pandas-melt-unpivot, nullable-int64-pandera-schema]

key-files:
  created:
    - scripts/irsf_etl/schemas/observation.py
    - scripts/irsf_etl/observation_mba.py
    - scripts/irsf_etl/tests/test_observation_mba.py
  modified:
    - scripts/irsf_etl/__main__.py

key-decisions:
  - "Used pd.Int64Dtype() for nullable integer columns in pandera schema (value_as_concept_id, visit_occurrence_id) to support pd.NA coercion"
  - "40/41 MBA score columns mapped -- Scoliosis_MBA not in source CSV (source uses shared Scoliosis column across CSS and MBA)"
  - "pandas melt for wide-to-long unpivot then dropna -- efficient for 8,782 rows x 40 columns"

patterns-established:
  - "Observation transform pattern: load source -> resolve person_id -> parse dates -> melt scores -> filter NaN -> map concepts -> resolve visits -> validate schema -> write CSV"
  - "Pandera nullable integer: use pd.Int64Dtype() not int for columns that may contain pd.NA"

requirements-completed: [OBS-01, OBS-04]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 10 Plan 01: MBA Observations Summary

**MBA wide-to-long unpivot producing 342,355 OMOP observation rows from 41 custom IRSF concepts across 1,822 patients with 85% test coverage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T18:21:10Z
- **Completed:** 2026-03-26T18:25:30Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Created shared pandera observation schema for OMOP CDM v5.4 (12 columns, reusable by plans 10-02 and 10-03)
- Built MBA transformer that unpivots 40 score columns from 8,782 source rows into 342,355 observation rows
- 19 tests at 85% coverage validating unpivot, NULL filtering, concept mapping, visit resolution, and schema conformance
- 64.1% visit resolution rate, 0.05% rejection rate (4 unresolvable participant_ids)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pandera observation schema** - `374be6a5d` (feat)
2. **Task 2: Create MBA observation transformer** - `eb88be6b2` (feat)
3. **Task 3: Create tests for MBA observations** - `a47ca61fc` (test)
4. **Task 4: Run transformer and validate output** - no code changes (validation only)

## Files Created/Modified
- `scripts/irsf_etl/schemas/observation.py` - Pandera schema for OMOP observation table with nullable Int64 support
- `scripts/irsf_etl/observation_mba.py` - MBA wide-to-long transformer (melt + concept mapping + visit resolution)
- `scripts/irsf_etl/tests/test_observation_mba.py` - 19 tests covering all plan requirements
- `scripts/irsf_etl/__main__.py` - Added observation-mba CLI subcommand

## Decisions Made
- Used `pd.Int64Dtype()` for nullable integer pandera columns -- standard `int` cannot coerce `pd.NA` values
- 40/41 MBA score columns mapped; `Scoliosis_MBA` concept exists in vocabulary but source CSV only has `Scoliosis` (shared with CSS domain) -- logged as warning, no data loss
- Pandas melt approach chosen over row iteration for efficiency on 8,782 x 40 matrix

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pandera schema nullable integer coercion**
- **Found during:** Task 3 (test execution)
- **Issue:** `value_as_concept_id` and `visit_occurrence_id` declared as `int` with `nullable=True` but pandera cannot coerce `pd.NA` to int64
- **Fix:** Changed both columns to `pd.Int64Dtype()` (pandas nullable integer)
- **Files modified:** `scripts/irsf_etl/schemas/observation.py`
- **Verification:** All 19 tests pass, schema validation succeeds
- **Committed in:** `a47ca61fc` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for schema validation. No scope creep.

## Issues Encountered
None beyond the pandera coercion fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Observation schema ready for reuse by 10-02 (CSS observations) and 10-03 (clinical observations)
- observation_mba.csv staging output at `scripts/irsf_etl/output/staging/observation_mba.csv` (342,355 rows)
- Transform pattern established for other observation sources

---
*Phase: 10-observations*
*Completed: 2026-03-26*
