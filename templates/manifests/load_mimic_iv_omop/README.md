# load_mimic_iv_omop

Port of the [OHDSI MIMIC-IV ETL](https://github.com/OHDSI/MIMIC) into the
Parthenon template runtime, per Phase 2 spec decision **Q6** (port-not-wrap).

## When to use

You have MIMIC-IV access (PhysioNet credentialing) and want the corpus in
OMOP CDM v5.4 — for cohort building, federated research, or as the input
to downstream Phase 2 templates (`parthenon_ner_llm` reads
`mimic_iv.note`; `artemis_chemo_regimens` reads `mimic_iv.drug_exposure`).

## What it does

13-stage SQL pipeline. Stage 1 bootstraps `mimic_iv_source.fmt_*` raw
tables and bulk-loads CSVs. Stage 2 builds vocabulary lookup tables.
Stage 3 bootstraps the per-source CDM schema (default `mimic_iv`).
Stages 4-7 map the source tables into OMOP per the canonical OHDSI
MIMIC-IV mappings. Stage 8 emits row counts; the validation pack at
`validation/expected/post_conditions.yaml` carries the ±2% acceptance
threshold (Phase 2 spec §6).

## Vocabulary requirements

`metadata.required_vocabularies`: SNOMED, LOINC, RxNorm, NDC, ICD10CM,
ICD9CM, ICD10PCS, ICD9Proc, CPT4, HCPCS. The Phase 0 Athena vocabulary
load covers all of these.

## Schema isolation

- Raw MIMIC-IV CSVs land in `mimic_iv_source.*` (per-source, isolated).
- CDM output goes to `${parameters.target_schema}.*` (default `mimic_iv`).
- Vocabulary lives in the shared `vocab` schema (Phase 0 conventions).

## Operations

```bash
# Customer mounts the MIMIC-IV directory at /data/mimic-iv with hosp/, icu/,
# note/ subdirectories.
curl -X POST http://parthenon-templates:8001/runs \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": "load_mimic_iv_omop",
    "parameters": {
      "csv_root": "/data/mimic-iv",
      "target_schema": "mimic_iv"
    }
  }'
```

## Synthetic fixture

A 10-patient synthetic MIMIC-shaped fixture lives at
`fixtures/synthetic/csv/`. Built via:

```bash
uv run python templates/manifests/load_mimic_iv_omop/fixtures/synthetic/build_fixtures.py
```

The E2E test (`tests/e2e/test_load_mimic_iv_omop.py`) drives the full
pipeline against this fixture using testcontainers Postgres.

## Upstream credit

OHDSI MIMIC-IV ETL (Apache-2.0). The SQL stages here mirror OHDSI's
canonical mappings; concept choices (visit_concept_id by admission_type,
gender 8507/8532, type_concept_id 32817 for "EHR") follow OHDSI
conventions exactly. ADR 0010 documents the port strategy.

## Unmapped concepts

ICD codes that don't resolve to SNOMED via the lookup tables flow into
`app.unmapped_concepts_queue` (the Phase 1 PR-A pattern). The Laravel
mapping-review UI surfaces these to a human reviewer.
