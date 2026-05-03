# hello_cdm Validation Pack

This pack proves the `hello_cdm` template runs end-to-end and produces a
correct minimal OMOP CDM.

## What it proves

- `parthenon-cdm` bootstrap creates the schema and required tables for the
  selected CDM version.
- The PERSON insert succeeds.
- The PERSON query returns the expected row.
- DQD-equivalent checks pass on the resulting schema.

## What it does NOT prove

- That the full OMOP CDM v5.4 is correct (only the tables touched by this
  template are exercised).
- That vocabulary loads work (this template requires no vocabulary).
- That production-scale data behaves correctly.

## How to run

The pack runs automatically as part of the `hello_cdm` E2E test in CI
(see `templates/tests/e2e/test_hello_cdm.py`). To run manually against a
testcontainers-managed Postgres:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_hello_cdm.py -v
```

## Pack layout

| File | Purpose |
|---|---|
| `inputs/parameters.json` | Parameters fed to the template's JSON Schema. |
| `expected/post_conditions.yaml` | Row-count, column-value, and artifact assertions checked after the run. |
| `dqd_checks.yaml` | Data-quality checks expected to pass on the resulting schema. |
| `README.md` | This file. |
