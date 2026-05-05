# nodes_test

Integration smoke test that exercises every node type in the Phase 0 SDK.

## What it does

Walks an 8-node DAG that touches each of the bootstrap node types
(`csv_reader`, `generic_file`, `sql`, `db_writer`, `db_reader`,
`py2table`, `python`, `r`) with a representative invocation. The
validation pack asserts every produced artifact is on disk and that the
round-tripped Postgres rows match the canonical CSV fixture.

## When to use it

- Runs in CI on every push that touches `templates/`. If any node breaks
  its contract, this template's run fails before any real ETL template
  is touched.
- Local dev sanity check after pulling a new SDK version.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `fixtures_dir` | string | _required_ | Absolute path to the validation pack fixtures directory. The E2E test substitutes this at runtime so the pack is portable across hosts. |
| `target_schema` | string | `nodes_test_demo` | Target Postgres schema for the round-trip table. Created if absent. Must match `^[a-z][a-z0-9_]*$`. |

## Prerequisites

- `parthenon-templates` runtime running.
- Postgres test database with DDL privileges (CREATE SCHEMA + CREATE
  TABLE on the `target_schema`).
- `Rscript` on `PATH` (CI installs `r-base-core`).
- The `polars` and `httpx` Python deps that ship with the templates
  package — already pinned in `pyproject.toml`.

## Examples

Run via UI: navigate to **Aqueduct → Templates** sub-tab, select
`nodes_test`, fill in `fixtures_dir`, click Run.

Run via CI: happens automatically; see `.github/workflows/templates.yml`.

Run locally:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_nodes_test.py -v
```

## Limitations

- Tests only the canonical happy path for each node. Variant params
  (alternative formats, large files, edge cases) are covered by node-
  level unit tests, not this template.
- Does not produce OMOP CDM data — `cdm_versions` is empty. No
  `IngestionJob` row is created.
- The `fixtures_dir` parameter is an absolute filesystem path, so the
  template is not directly runnable from a remote orchestrator that
  can't see the validation pack on disk; CI and local dev are the
  intended use cases.

## License / attribution

Sample data is synthetic, generated in `fixtures/build_fixtures.py`.
No real patient data is used.
