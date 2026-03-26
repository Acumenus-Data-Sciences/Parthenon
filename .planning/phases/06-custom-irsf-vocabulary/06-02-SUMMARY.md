---
phase: 06-custom-irsf-vocabulary
plan: 02
subsystem: database
tags: [omop, source_to_concept_map, vocabulary, psycopg2, etl]

# Dependency graph
requires:
  - phase: 06-custom-irsf-vocabulary-01
    provides: 117 custom concept definitions, vocabulary.csv, concept.csv
provides:
  - source_to_concept_map.csv staging file (121 rows) for ETL concept lookups
  - VocabularyLoader class for idempotent DB insertion of custom vocabulary
  - SNOMED dual mappings for 4 diagnostic categories
affects: [07-medications, 08-conditions, 09-measurements, 10-observations, 12-validation]

# Tech tracking
tech-stack:
  added: [psycopg2]
  patterns: [DELETE+INSERT idempotent loading, SNOMED dual-mapping, parameterized queries]

key-files:
  created:
    - scripts/irsf_etl/lib/vocab_loader.py
    - scripts/irsf_etl/tests/test_vocab_loader.py
  modified:
    - scripts/irsf_etl/lib/irsf_vocabulary.py
    - scripts/irsf_etl/tests/test_irsf_vocabulary.py
    - scripts/irsf_etl/lib/__init__.py

key-decisions:
  - "SNOMED dual mappings for 4 diagnoses: Classic Rett (4288480), Atypical Rett (37397680), MECP2 duplication (45765797), FOXG1 (45765499)"
  - "source_to_concept_map uses source_code=column_name for CSS/MBA/Mutation, source_code=source_value for Diagnosis"
  - "VocabularyLoader uses DELETE+INSERT in single transaction for idempotent re-runs"

patterns-established:
  - "SNOMED dual-mapping pattern: custom concept + standard SNOMED concept for diagnoses with known equivalents"
  - "DB loader pattern: parameterized queries, single transaction, DELETE before INSERT, summary dict return"

requirements-completed: [VOCAB-06]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 6 Plan 2: Source-to-Concept Map and DB Loader Summary

**121-row source_to_concept_map CSV with SNOMED dual mappings plus VocabularyLoader for idempotent PostgreSQL insertion via psycopg2**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T12:48:30Z
- **Completed:** 2026-03-26T12:52:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Generated source_to_concept_map.csv with 121 rows (117 primary + 4 SNOMED dual mappings)
- Created VocabularyLoader with idempotent DELETE+INSERT in single PostgreSQL transaction
- All SQL uses parameterized queries (no string interpolation)
- 32 new tests (17 source_to_concept_map + 15 vocab_loader), all passing with mocked DB

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate source_to_concept_map staging CSV** - `3d1083326` (feat)
2. **Task 2: Create VocabularyLoader for idempotent DB insertion** - `944b3a486` (feat)

_Both tasks used TDD: RED (failing tests) -> GREEN (implementation) -> verify._

## Files Created/Modified
- `scripts/irsf_etl/lib/irsf_vocabulary.py` - Added SNOMED_MAPPINGS dict and generate_source_to_concept_map_csv()
- `scripts/irsf_etl/tests/test_irsf_vocabulary.py` - 17 new tests for source_to_concept_map generation
- `scripts/irsf_etl/lib/vocab_loader.py` - VocabularyLoader class with idempotent DB insertion
- `scripts/irsf_etl/tests/test_vocab_loader.py` - 15 tests with mocked psycopg2
- `scripts/irsf_etl/lib/__init__.py` - Export vocab_loader module

## Decisions Made
- SNOMED dual mappings for 4 diagnoses with standard equivalents: Classic Rett (4288480), Atypical Rett (37397680), MECP2 duplication (45765797), FOXG1 syndrome (45765499)
- source_to_concept_map source_code uses column name for CSS/MBA/Mutation concepts, source_value string for Diagnosis concepts
- VocabularyLoader uses DELETE+INSERT within a single transaction (autocommit=False) for idempotent re-runs
- DELETE order: source_to_concept_map -> concept -> vocabulary (reverse dependency)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Coverage report fails due to numpy import conflict in conftest.py (pre-existing, not caused by this plan). All 76 tests pass without coverage flag.
- output/staging directory is gitignored so source_to_concept_map.csv artifact is not committed (generated on demand by the function)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Custom IRSF Vocabulary) is now complete
- source_to_concept_map.csv provides concept_id lookups for Phases 7-10 ETL scripts
- VocabularyLoader enables direct DB insertion for testing and deployment
- Ready for Phase 7 (Medications), Phase 8 (Conditions), Phase 9 (Measurements), Phase 10 (Observations)

---
*Phase: 06-custom-irsf-vocabulary*
*Completed: 2026-03-26*

## Self-Check: PASSED

- All 5 files verified present on disk
- Both task commits verified in git log (3d1083326, 944b3a486)
- 76 tests pass (61 irsf_vocabulary + 15 vocab_loader)
