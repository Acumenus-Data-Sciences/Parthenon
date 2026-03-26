---
phase: 09-measurements
plan: 03
subsystem: etl
tags: [measurement, labs, sf-36, loinc, snomed, likert, omop-cdm]

requires:
  - phase: 09-measurements-01
    provides: measurement_etl.py with growth transform, unpivot helper, Pandera schema
  - phase: 09-measurements-02
    provides: CSS transform in measurement_etl.py
provides:
  - transform_labs with LOINC/SNOMED mapping for 5 lab types + Other
  - transform_sf36 with 7-scale Likert ordinal encoding for 36 response columns
  - Complete measurement.csv staging file with all four sources (370,581 rows)
  - Mapping coverage rate computation (99.9%) exceeding 95% target
  - Combined measurement rejection report
affects: [12-validation, 11-quality]

tech-stack:
  added: []
  patterns: [split-date assembly with fallback chain, SNOMED regex extraction, Likert ordinal encoding, keep_default_na=False for text-value-None columns]

key-files:
  created: []
  modified:
    - scripts/irsf_etl/measurement_etl.py
    - scripts/irsf_etl/tests/test_measurement_etl.py

key-decisions:
  - "Lab measurement_date uses DatePerformed (actual lab date), not visit_date; visit_occurrence_id resolved from visit_date"
  - "Other (SNOMED terms) labs use concept_id=0 as measurement_concept_id; SNOMED code goes in measurement_source_concept_id"
  - "SF-36 uses keep_default_na=False to preserve 'None' as literal text (pain scale value) instead of pandas NA"
  - "SF-36 individual items use measurement_concept_id=0 (no LOINC for individual SF-36 questions)"
  - "Coverage rate formula: (growth_mapped + labs_loinc + labs_snomed) / (growth_total + labs_total) = 99.9%"

patterns-established:
  - "SNOMED regex extraction: _SNOMED_CODE_RE = re.compile(r'code:(\\d+)') for parsing SNOWMEDOutput strings"
  - "Likert encoding: column-to-scale mapping dict for categorical-to-ordinal conversion"
  - "Split-date fallback chain: assemble_date() -> DatePerformed string -> visit_date"

requirements-completed: [MEAS-03, MEAS-04, MEAS-05]

duration: 7min
completed: 2026-03-26
---

# Phase 09 Plan 03: Labs and SF-36 Measurements Summary

**Lab results with LOINC/SNOMED mapping and SF-36 quality-of-life with 7-scale Likert encoding producing 370,581 total measurement rows at 99.9% mapping coverage**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T18:36:15Z
- **Completed:** 2026-03-26T18:43:15Z
- **Tasks:** 5
- **Files modified:** 2

## Accomplishments
- Lab results (2,951 rows) transformed with LOINC mapping for 5 known types and SNOMED extraction for 1,308 "Other" rows
- SF-36 quality-of-life (210,939 rows) transformed with Likert ordinal encoding across 7 distinct scales
- Complete measurement.csv with all four sources: growth (34,135) + CSS (122,556) + labs (2,951) + SF-36 (210,939) = 370,581 rows
- Mapping coverage rate 99.9% exceeding 95% target (MEAS-05)
- 35 tests passing including 15 new tests for labs, SF-36, coverage, and SNOMED regex

## Task Commits

Each task was committed atomically:

1. **Tasks 1-3: Labs transform, SF-36 transform, orchestrator update** - `f56ae7db7` (feat)
2. **Task 4: Tests for labs and SF-36** - `45a911c98` (test)
3. **Task 5: Validation against actual data** - (verified, no separate commit needed -- output files are gitignored)

## Files Created/Modified
- `scripts/irsf_etl/measurement_etl.py` - Added transform_labs, transform_sf36, _assemble_lab_date, _write_combined_rejections; updated orchestrator with coverage calculation
- `scripts/irsf_etl/tests/test_measurement_etl.py` - Added 15 tests: 8 labs, 5 SF-36, 2 coverage/regex

## Decisions Made
- Lab measurement_date uses DatePerformed (actual lab date), not visit_date; visit_occurrence_id resolved from visit_date (study visit context)
- "Other (SNOMED terms)" labs use concept_id=0 because SNOMED codes are procedures/findings, not OMOP measurement concepts; code stored in measurement_source_concept_id
- SF-36 requires keep_default_na=False because "None" is a valid text response on the pain scale that pandas would otherwise interpret as NA
- Individual SF-36 items use measurement_concept_id=0 (no standard LOINC codes for individual SF-36 questions; flagged for Phase 12 validation)
- Coverage formula counts SNOMED-extracted "Other" labs as mapped (1,308 of 1,346 have extractable codes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SF-36 "None" pain value swallowed by pandas default NA parsing**
- **Found during:** Task 2 (SF-36 transform)
- **Issue:** Pain scale literal "None" text was being converted to pandas NA by default NA parsing
- **Fix:** Added keep_default_na=False to read_csv_safe call for SF-36 CSV
- **Files modified:** scripts/irsf_etl/measurement_etl.py
- **Verification:** Pain scale values correctly include "None" -> Likert 6
- **Committed in:** f56ae7db7

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for data correctness. No scope creep.

## Issues Encountered
- SF-36 test fixture CSV initially used backslash-escaped commas instead of proper CSV quoting, causing parse errors. Fixed by using csv.writer for fixture generation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four measurement sources complete: growth, CSS, labs, SF-36
- Phase 09 (Measurements) is now fully complete (3/3 plans)
- Measurement.csv ready for Phase 12 validation (coverage, ID integrity, value ranges)
- SF-36 LOINC codes flagged for Phase 12 vocabulary validation

---
*Phase: 09-measurements*
*Completed: 2026-03-26*
