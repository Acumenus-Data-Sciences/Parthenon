# load_athena_vocabulary Validation Pack

This pack proves an OHDSI Athena vocabulary bundle loads end-to-end and
the resulting tables have the expected shape and row counts.

## What it proves

- All 7 mandatory bundle CSVs (CONCEPT, CONCEPT_RELATIONSHIP,
  CONCEPT_ANCESTOR, VOCABULARY, DOMAIN, CONCEPT_SYNONYM, DRUG_STRENGTH)
  load into the target schema via PostgreSQL `COPY FROM STDIN`.
- Idempotency: re-running with the same bundle and `force=false` is a
  no-op gated by the SHA256 of `CONCEPT.csv`.
- The audit row in `<schema>.vocabulary_load` records the bundle's
  SHA256 reference and per-table row counts.
- DQD-equivalent checks on uniqueness and not-null constraints pass.

## What it does NOT prove

- Concept content correctness — we trust Athena's authoritative content.
- CPT4 contents — CPT4 is gated on `UMLS_API_KEY`; absence is a
  graceful skip, so this pack tolerates either branch.
- Cross-vocabulary mapping clinical correctness.

## How to run

**This pack is user-initiated only — NOT run in CI.**

In staging, after extracting the Athena bundle to a path readable by the
`parthenon-templates` container:

```bash
# Optional: enable CPT4 enrichment (requires UMLS API key)
export UMLS_API_KEY=$(vault read -field=api_key secret/umls)

curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_athena_vocabulary/validation/inputs/parameters.json
```

Wait for the run to reach a terminal status (`SUCCEEDED` or `FAILED`),
then verify post-conditions against the staging database. The run row
in `app.template_runs` records the digest; cross-check with the
`vocabulary_load` audit table.

Expected runtime: 15-30 minutes for the full Athena bundle on a
PostgreSQL 16 host with default `maintenance_work_mem`.

## Pack layout

| File | Purpose |
|---|---|
| `inputs/parameters.json` | Parameters fed to the template's JSON Schema. |
| `expected/post_conditions.yaml` | Row-count and audit-row assertions checked after the run. |
| `dqd_checks.yaml` | Uniqueness/not-null/no-self-loop checks expected to pass. |
| `README.md` | This file. |

## Notes

- `target_vocab_schema` is intentionally distinct (`vocab_validation`)
  from the production `vocab` schema — running the validation pack must
  never overwrite production vocabulary.
- `force: true` in the validation pack mirrors the operator's intent to
  re-run the same bundle as part of release validation.
