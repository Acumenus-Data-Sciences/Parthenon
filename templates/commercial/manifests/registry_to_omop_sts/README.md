# `registry_to_omop_sts`

Phase 3 Plan 4B (T-022B). Commercial-tier template that ingests
**Society of Thoracic Surgeons (STS) National Database** CSV exports
and projects them to OMOP CDM v5.4 PROCEDURE_OCCURRENCE +
CONDITION_OCCURRENCE + EPISODE.

## License + access notes

STS data is gated behind an **STS Participant Agreement** between the
customer (a hospital, integrated delivery network, or CV registry
analyst) and the Society of Thoracic Surgeons. Parthenon does NOT
redistribute STS data, fixtures, or column-spec excerpts beyond what
the manifest test fixtures synthesize.

Customers who do not have STS Participant status cannot run this
template against real data. The synthetic fixture corpus
(`fixtures/synthetic/build_sts_corpus.py`) is the only data
Parthenon ships; it's deterministic and PHI-free.

## Spec version

This template targets **STS Adult Cardiac Surgery v4.20.2** column
shapes. Older versions (v2.81, v2.9) are out of v0.1 scope —
column-map deltas would be a Phase 4 follow-up if customer demand
exists.

## Vocabulary prerequisites

- `ICD10CM` (pre-op diagnoses)
- `CPT4` (procedure codes; primary + secondary)
- `HCPCS` (some STS procedures use HCPCS over CPT)
- `SNOMED` (target standard for both conditions and procedures via
  `concept_relationship 'Maps to'`)

The mapping pipeline tolerates unmapped codes — it emits
`procedure_concept_id = 0` (OMOP convention) and the source code is
preserved in `procedure_source_value` for downstream review.

## Person identity

v0.1 hashes `patient_id` via `abs(hashtext(...))` for deterministic
`person_id` allocation, matching Plans 4A / NCPDP / claims pipelines.
Proper Master Person Index integration is Phase 4 follow-up.

## Operator workflow

```bash
# 1. Customer obtains STS export (CSV, ~21 columns per spec)
# 2. Place at <storage>/sts_export.csv
# 3. Run the template:
parthenon-templates run registry_to_omop_sts \
  --param sts_csv=/storage/sts_export.csv \
  --param cdm_schema=sts_cdm
```

## Acceptance gates (validation E2E)

- 100% of CSV rows produce typed STSRecords (or fail-closed)
- procedure_occurrence row count = primary + secondary procedures
- condition_occurrence row count = primary dx + secondary dx + each
  TRUE postop complication
- One episode per surgery
- Reader is idempotent on replay

## See also

- ADR 0017 — `registry_to_omop` strategy (extend OHDSI for NAACCR;
  STS owns its column-map since no upstream ETL exists)
- `column_map.csv` — STS field → OMOP destination convention
- Phase 3 Plan 4A — NAACCR sub-template (sister T-022 sub-template)
