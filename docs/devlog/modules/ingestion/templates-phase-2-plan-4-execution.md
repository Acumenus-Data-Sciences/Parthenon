# Phase 2 Plan 4 — MIMIC-IV ETL Execution Devlog

**Branch:** `feature/phase-2-plan-4-impl-mimic`
**Plan:** `docs/superpowers/plans/2026-05-05-parthenon-ingestion-templates-phase-2-plan-4-mimic-iv.md`
**Started:** 2026-05-05

## Task progress (16/16)

- [x] Task 1: mimic_iv_source schema + 11 fmt_* tables
- [x] Task 2: CSV → fmt_* COPY loader
- [x] Task 3: Vocabulary lookup tables (ICD9/10, LOINC, RxNorm, NDC)
- [x] Task 4: mimic_iv CDM schema (13 OMOP v5.4 tables)
- [x] Task 5: PERSON + DEATH mapper
- [x] Task 6: LOCATION + CARE_SITE + PROVIDER mapper
- [x] Task 7: VISIT_OCCURRENCE + VISIT_DETAIL mapper
- [x] Task 8: CONDITION_OCCURRENCE + unmapped_concepts_queue
- [x] Task 9: PROCEDURE_OCCURRENCE mapper
- [x] Task 10: MEASUREMENT mapper (labevents)
- [x] Task 11: DRUG_EXPOSURE mapper (prescriptions, NDC + RxNorm)
- [x] Task 12: OBSERVATION mapper (chartevents allowlist)
- [x] Task 13: NOTE mapper (noteevents)
- [x] Task 14: SUMMARIZE SQL + post_conditions YAML
- [x] Task 15: Synthetic 10-patient fixture + E2E shape
- [x] Task 16: ADR 0010 — MIMIC-IV ETL strategy

## Notes

- **Full testcontainers E2E gated**: the manifest's stages reference
  `sql_file: file://sql/*.sql` parameters. Phase 0's `sql_node` only
  accepts inline `statements` today. The full E2E test stays SKIPPED
  until the file:// reader lands as a small Phase 0 enhancement.
  Structural unit tests (66 total) cover the SQL contents.
- **Synthetic fixture**: 10 patients, 34 admissions, 139 diagnoses,
  97 prescriptions, 53 noteevents — deterministic via RNG seed 42.
- **Vocabulary requirements**: 10 vocabularies — Phase 0's Athena
  load covers all of them.
- **ADR 0010**: documents port-not-wrap rationale + open follow-up
  for the Phase 0 `sql_node` `sql_file://` reader.
