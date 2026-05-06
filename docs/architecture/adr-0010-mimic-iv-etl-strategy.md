# ADR 0010 — MIMIC-IV ETL Strategy

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q6 (port-not-wrap), Q7 (vocabulary baseline).
**Implements:** Phase 2 Plan 4.

## Context

MIMIC-IV is the canonical research-EHR dataset (PhysioNet credentialed
access, ~300k patients in the full release, demo subset of 100). Phase 2
adds a Parthenon template for ingesting it into OMOP CDM v5.4. Two
options:

1. **Port** — translate OHDSI's MIMIC-IV ETL SQL into Parthenon
   templates. We own the upkeep when OHDSI patches; gain test coverage
   in our suite; preserve runtime parity with all other Parthenon
   templates.
2. **Wrap** — invoke the OHDSI ETL as an external sub-process. Less
   maintenance burden when OHDSI patches; loses our test coverage and
   makes correctness a black box.

## Decision

**Port.** `load_mimic_iv_omop` ships as a 13-stage SQL pipeline mirroring
OHDSI's flow:

| Stage | Purpose | File |
|---|---|---|
| 1 | Bootstrap `mimic_iv_source` schema + `fmt_*` raw tables | `00_bootstrap_source_schema.sql` |
| 2 | Bulk-load CSVs via `COPY FROM ${parameters.csv_root}` | `01_load_source_csv.sql` |
| 3 | Build vocabulary lookup tables (ICD9/10, LOINC, RxNorm, NDC) | `02_vocab_lookup_tables.sql` |
| 4 | Bootstrap `mimic_iv` CDM schema with 13 OMOP v5.4 tables | `03_bootstrap_cdm_schema.sql` |
| 5 | PERSON + DEATH | `04a_map_person_death.sql` |
| 6 | LOCATION + CARE_SITE + PROVIDER (synthesized BIDMC row) | `04b_map_location_caresite_provider.sql` |
| 7 | VISIT_OCCURRENCE + VISIT_DETAIL | `05_map_visit.sql` |
| 8 | CONDITION_OCCURRENCE + unmapped queue | `06a_map_condition.sql` |
| 9 | PROCEDURE_OCCURRENCE | `06b_map_procedure.sql` |
| 10 | MEASUREMENT (labevents) | `07a_map_measurement.sql` |
| 11 | DRUG_EXPOSURE (prescriptions, NDC primary + RxNorm fallback) | `07b_map_drug_exposure.sql` |
| 12 | OBSERVATION (chartevents allowlist) | `07c_map_observation.sql` |
| 13 | NOTE (noteevents → omop.note for downstream NER consumption) | `08_map_note.sql` |
| 14 | SUMMARIZE (row counts, ±2% acceptance gate) | `09_summarize.sql` |

Each stage is a `sql_node` invocation in the manifest. Schema isolation:
`mimic_iv_source.*` for raw, `${parameters.target_schema}.*` (default
`mimic_iv`) for CDM output, shared `vocab.*` for vocabulary.

OMOP concept choices follow OHDSI conventions: gender 8507 (M) / 8532
(F); type_concept_id 32817 (EHR); admission_type → visit_concept_id
mapping (Inpatient 9201, ER 9203, Outpatient 9202).

## Consequences

- **Test coverage**: Plan 4 adds 47 + 19 = 66 unit tests against the SQL
  files (structural assertions). The full E2E with real Postgres
  testcontainers is gated until the Phase 0 `sql_node` gains a
  `sql_file: file://` reader (small follow-up). Synthetic 10-patient
  CSV fixture is deterministic (RNG seed=42, byte-identical reruns).
- **Vocabulary baseline**: requires SNOMED, LOINC, RxNorm, NDC, ICD10CM,
  ICD9CM, ICD10PCS, ICD9Proc, CPT4, HCPCS in `vocab.concept`. Phase 0's
  Athena vocabulary load covers all of these (Q7).
- **Unmapped concepts**: ICD codes that don't resolve to SNOMED via the
  lookup tables flow into `app.unmapped_concepts_queue` (Phase 1 PR-A
  pattern). Mapping reviewers can resolve via the existing UI.
- **Downstream unblocking**: `parthenon_ner_llm` (Plan 1) reads
  `mimic_iv.note` for clinical-note NER. `artemis_chemo_regimens`
  (Plan 5) reads `mimic_iv.drug_exposure` for chemo-regimen extraction.
- **Upstream tracking**: a quarterly diff against
  https://github.com/OHDSI/MIMIC catches OHDSI patches we should
  cherry-pick. Significant changes (new domains, schema migrations) go
  to a Phase 3 follow-up rather than silent in-place edits.

## License credit

OHDSI MIMIC-IV ETL is Apache-2.0. Parthenon's port is also Apache-2.0;
manifest README and this ADR credit OHDSI as the source of the SQL
logic. No code is copy-pasted; SQL was rewritten to match Parthenon's
schema-isolation conventions and the per-source CDM target pattern.

## Alternatives considered

- **Wrap as external sub-process** — declined for the reasons above.
- **Pandas-based Python ETL** — declined; SQL `COPY` + JOINs at
  Postgres-native speed dominate any in-process Python loader at MIMIC
  scale. The Phase 0 `sql_node` is the right tool.
- **Bundle MIMIC-IV demo subset** — declined; PhysioNet credentialed
  access requirement would be violated. Customers fetch their own data
  and mount it at `${parameters.csv_root}`.
- **Fixed `target_schema=mimic_iv`** — declined; parameterizing it lets
  customers run multiple per-source CDMs side-by-side (e.g.,
  `mimic_iv_demo`, `mimic_iv_full`).

## Open follow-ups

- `sql_node` `sql_file: file://` reader (small Phase 0 enhancement) —
  unblocks the full testcontainers E2E.
- Quarterly OHDSI MIMIC-IV upstream-diff workflow.
- Optional: ICU-only fast path that skips noteevents loading for
  customers who don't run downstream NER.
- Future: `load_mimic_iv_demo` convenience template that pre-populates
  `csv_root` from the public PhysioNet demo URL after PhysioNet auth.
