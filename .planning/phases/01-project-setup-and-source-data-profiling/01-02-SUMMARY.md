---
phase: 01-project-setup-and-source-data-profiling
plan: 02
subsystem: etl
tags: [csv-profiling, pandas, date-detection, data-quality, irsf]

requires:
  - phase: 01-01
    provides: "ETL scaffold with config, csv_utils, date_utils, CLI entry point"
provides:
  - "profile_sources.py with profile_one_csv, profile_all, write_report, detect_date_format"
  - "profile_report.json with 121 CSV profiles across 5 source groups"
  - "CLI profile subcommand: python -m scripts.irsf_etl profile"
affects: [02-shared-library, 03-vocabulary-crosswalk, 07-medications, 08-conditions]

tech-stack:
  added: []
  patterns: ["keep_default_na=False for empty string vs null distinction", "StringDtype handling for pandas 3.x"]

key-files:
  created:
    - scripts/irsf_etl/profile_sources.py
    - scripts/irsf_etl/tests/test_profiler.py
  modified:
    - scripts/irsf_etl/__main__.py
    - scripts/irsf_etl/config.py

key-decisions:
  - "Used keep_default_na=False with explicit na_values list to preserve empty strings for separate counting"
  - "Fixed source directory paths to match actual structure (5211_Custom_Extracts, csv/ subdirectories)"
  - "Used _is_string_dtype helper for pandas 3.x StringDtype compatibility"

patterns-established:
  - "Profiler reads raw CSV without empty-string replacement to distinguish empties from true nulls"
  - "Source directories defined in _SOURCE_DIRS list with path parts relative to source_root"

requirements-completed: [FOUND-05]

duration: 5min
completed: 2026-03-26
---

# Phase 1 Plan 2: Source Data Profiling Summary

**CSV profiler reading 121 files across 5 IRSF source groups with date format detection, empty string vs null separation, and low-cardinality value distributions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T11:47:31Z
- **Completed:** 2026-03-26T11:53:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- profile_one_csv produces structured dict with row/column counts, null rates, empty string rates, date detection, split-date detection, and value distributions
- detect_date_format identifies MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD, and month-text abbreviation formats via regex sampling
- profile_all scans 5 source directories (5201, 5211, Custom Extracts, DDLs Lab_Log, Notes) with rich progress bar
- Full profiling run: 121 CSVs, 447,920 total rows, 115 files with date columns, 0 errors
- Key files profiled: Person_Characteristics (1,858 rows, 67 cols), Medications (41,866 rows, 100 cols), GROWTH (8,781 rows), CSS (8,782 rows), MBA (8,782 rows, 152 cols)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement profiling script with date detection and value distributions** - `cf269f796` (feat)
2. **Task 2: Wire profile command into CLI and run against all source CSVs** - `d0145251a` (feat)

## Files Created/Modified
- `scripts/irsf_etl/profile_sources.py` - Core profiling module with detect_date_format, profile_one_csv, profile_all, write_report
- `scripts/irsf_etl/tests/test_profiler.py` - 13 tests covering structure, dates, empty strings, cardinality, errors, profile_all, write_report
- `scripts/irsf_etl/__main__.py` - Wired profile subcommand with --output-dir and --json-only flags
- `scripts/irsf_etl/config.py` - Fixed source_custom_extracts path to actual 5211_Custom_Extracts directory

## Decisions Made
- Used `keep_default_na=False` with explicit `na_values` list in pd.read_csv to preserve empty strings as "" for separate counting from true nulls. This is necessary because pandas 3.x with default NA handling converts all empty CSV cells to NaN.
- Added `_is_string_dtype()` helper because pandas 3.x uses `StringDtype` instead of `object` dtype for string columns, causing `is_object_dtype()` to return False.
- Fixed source directory paths: Custom Extracts is at `5211_Custom_Extracts` (not `Custom Extracts`), and CSVs are inside `csv/` subdirectories for studies 5201, 5211, and Custom Extracts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pandas 3.x StringDtype incompatibility**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** pandas 3.x returns `StringDtype` for text columns instead of `object`, causing `is_object_dtype()` to return False and skipping date detection and distribution computation
- **Fix:** Created `_is_string_dtype()` helper that checks both `is_object_dtype` and `is_string_dtype`
- **Files modified:** scripts/irsf_etl/profile_sources.py
- **Verification:** All 13 tests pass including date detection

**2. [Rule 1 - Bug] Empty string detection broken in pandas 3.x**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Pandas 3.x auto-converts empty CSV cells to NaN during read, making it impossible to distinguish empty strings from nulls
- **Fix:** Used `keep_default_na=False` with explicit `na_values` list to preserve empty cells as ""
- **Files modified:** scripts/irsf_etl/profile_sources.py
- **Verification:** Empty string test passes, rates computed correctly

**3. [Rule 3 - Blocking] Source directory paths did not match actual data layout**
- **Found during:** Task 2 (running against real data)
- **Issue:** Config pointed to `Custom Extracts` but actual directory is `5211_Custom_Extracts`; CSVs are inside `csv/` subdirectories, not at directory root
- **Fix:** Updated config.py and profile_sources.py _SOURCE_DIRS to match actual directory structure
- **Files modified:** scripts/irsf_etl/config.py, scripts/irsf_etl/profile_sources.py, scripts/irsf_etl/tests/test_profiler.py
- **Verification:** 121 CSVs found and profiled successfully across all 5 groups

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness with pandas 3.x and actual source data layout. No scope creep.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Profile report at `scripts/irsf_etl/output/profiles/profile_report.json` available for all subsequent phases
- Phase 1 complete: scaffold + profiling both done
- Ready for Phase 2 (shared library) and Phase 3 (vocabulary crosswalk)
- Profile data reveals: 115 of 121 files have date columns to handle, Person_Characteristics has 67 columns and 1,858 patients, Medications has 41,866 records

---
*Phase: 01-project-setup-and-source-data-profiling*
*Completed: 2026-03-26*
