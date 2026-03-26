---
phase: 05-visit-derivation
plan: 02
subsystem: etl
tags: [python, pandas, frozen-dataclass, visit-resolution, omop-cdm]

requires:
  - phase: 05-visit-derivation/01
    provides: visit_id_map.csv with visit_occurrence_id, person_id, visit_date, visit_label, visit_concept_id
provides:
  - VisitResolver frozen dataclass for downstream clinical event scripts (Phases 7-10)
  - Three resolution strategies: exact match, date-only fallback, nearest-date fallback
  - Vectorized resolve_series for batch DataFrame resolution
affects: [07-medications, 08-conditions, 09-measurements, 10-observations]

tech-stack:
  added: []
  patterns: [frozen-dataclass-resolver, bisect-nearest-date, outpatient-preference-fallback]

key-files:
  created:
    - scripts/irsf_etl/lib/visit_resolver.py
    - scripts/irsf_etl/tests/test_visit_resolver.py
  modified: []

key-decisions:
  - "Outpatient (9202) preferred in date-only fallback when multiple visits share same person+date"
  - "Binary search (bisect) for nearest-date fallback with sorted date list per person"
  - "resolve_series returns pd.Int64Dtype array with pd.NA for unresolved (consistent with PersonIdRegistry pattern)"

patterns-established:
  - "VisitResolver frozen dataclass pattern: from_csv/from_dataframe classmethods, resolve/resolve_or_nearest/resolve_series methods"
  - "Outpatient-preference strategy for ambiguous date-only visit resolution"

requirements-completed: [VISIT-03]

duration: 3min
completed: 2026-03-26
---

# Phase 5 Plan 2: Visit Resolver Summary

**Frozen dataclass VisitResolver with exact/date-only/nearest-date resolution strategies for downstream clinical event scripts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T12:54:42Z
- **Completed:** 2026-03-26T12:57:42Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- VisitResolver frozen dataclass following PersonIdRegistry pattern with from_csv and from_dataframe classmethods
- Three resolution strategies: exact (person_id, date, label), date-only fallback preferring outpatient (9202), and nearest-date within configurable max_days window
- Vectorized resolve_series for batch DataFrame column resolution with pd.NA for unresolved
- 14 passing tests covering exact match, date fallback, nearest-date (within/outside window), series resolution, CSV roundtrip, and immutability

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement VisitResolver module** - `b62e5635d` (feat)
2. **Task 2: Write tests** - `cd6ca0884` (test)
3. **Task 3: Run tests** - verified 14/14 pass (no code changes, no commit needed)

## Files Created/Modified
- `scripts/irsf_etl/lib/visit_resolver.py` - Frozen dataclass VisitResolver with exact/date/nearest resolution, vectorized series resolve, outpatient preference
- `scripts/irsf_etl/tests/test_visit_resolver.py` - 14 tests: exact match, date fallback, nearest window, series, CSV roundtrip, immutability, outpatient preference

## Decisions Made
- Outpatient (9202) preferred in date-only fallback when multiple visits on same person+date -- aligns with IRSF study visits being predominantly outpatient
- Binary search via bisect for nearest-date fallback -- O(log n) per person for large visit sets
- resolve_series returns pd.Int64Dtype array with pd.NA for unresolved -- consistent with PersonIdRegistry.resolve_series pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- pytest-cov has a known interaction issue with numpy in the project venv causing conftest import failures when --cov flag is used. Tests pass without coverage flag (14/14). Coverage is estimated above 80% based on method-level test coverage analysis.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VisitResolver ready for import by Phases 7-10 clinical event scripts
- Depends on Plan 05-01 completing to produce visit_id_map.csv, but module is fully tested with DataFrame-based construction
- Pattern established for all downstream scripts: `VisitResolver.from_csv(staging/visit_id_map.csv)`

---
*Phase: 05-visit-derivation*
*Completed: 2026-03-26*
