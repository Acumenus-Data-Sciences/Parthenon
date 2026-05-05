# load_synpuf Validation Pack

Proves the SynPUF 1K loader produces a working OMOP CDM dataset queryable
by ATLAS-equivalent tooling.

## What it proves

- The 7 SynPUF tables (PERSON, OBSERVATION_PERIOD, VISIT_OCCURRENCE,
  CONDITION_OCCURRENCE, DRUG_EXPOSURE, PROCEDURE_OCCURRENCE,
  MEASUREMENT) load into the target schema in dependency order.
- Person count is in the published OHDSI range (~1116 for 1K).
- The Achilles-style summary artifact (`achilles_summary.json`) is
  produced.
- DQD checks (`person_yob_in_range`, `person_id_unique`, FK integrity
  for visits/conditions/drugs) pass.

## What it does NOT prove

- The 100K slice. Validation runs against 1K only — extrapolation to
  100K is the responsibility of the engineer running the full release
  validation in staging.
- Full Achilles or DQD reports. Those run as separate jobs after the
  load completes.
- Vocabulary correctness. The vocabulary schema is a prerequisite, not
  validated by this pack.

## How to run

**User-initiated only. Not in CI** per devplan §8.

In staging, after `load_athena_vocabulary` has populated SNOMED, RxNorm,
and LOINC into the `vocab` schema:

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_synpuf/validation/inputs/parameters.json
```

Wait for the run to reach a terminal status (`SUCCEEDED` or `FAILED`),
then verify post-conditions against the staging database. The
`achilles_summary.json` artifact is fetched from
`<storage_root>/<run_id>/achilles_summary/achilles_summary.json`.

Expected runtime: ~15 minutes for 1K, ~3 hours for 100K.

## Pack layout

| File | Purpose |
|---|---|
| `inputs/parameters.json` | Parameters fed to the template's JSON Schema. |
| `expected/post_conditions.yaml` | Row-count and artifact assertions checked after the run. |
| `dqd_checks.yaml` | DQD-equivalent FK and uniqueness checks expected to pass. |
| `README.md` | This file. |

## Notes

- `target_schema` is intentionally distinct (`synpuf_validation`) from
  the production demo schemas (`synpuf`, `synpuf_demo`) so the
  validation pack never overwrites an active dataset.
- `force: true` mirrors the operator's intent to re-run the same
  bundle as part of release validation.
