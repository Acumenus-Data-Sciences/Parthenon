# Parthenon Ingestion Templates — Phase 0, Plan 4: Templates and Phase 0 Close-Out

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four Phase 0 manifests (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`) with validation packs, READMEs, security review, ops runbook, and Phase 0 Definition-of-Done verification. Closes the Phase 0 milestone.

**Architecture:** Each template is a YAML manifest at `templates/manifests/<id>/manifest.yaml` validated against Plan 1's `template.v1.json` schema. Per-template validation packs at `templates/manifests/<id>/validation/` per devplan §6.4. `hello_cdm` and `nodes_test` run in CI; `load_athena_vocabulary` and `load_synpuf` are user-initiated in staging per spec §8.

**Tech Stack:** YAML manifests (against Plan 1's schema), MADR-format ADRs, Markdown devlog/runbook, Python 3.12 for the vocab_diff CLI.

**Depends on:** Plan 1 (node SDK, orchestration, registry, parthenon-cdm), Plan 2 (Laravel endpoints), Plan 3 (Frontend UI).

**Unblocks:** Phase 1 (FHIR/DICOM/SDTM templates) — out of scope.

---

## Pre-flight verification

Before starting any task, confirm Plan 1 has landed:

- [ ] `templates/runtime/registry/schema/template.v1.json` exists and validates a hello-world manifest.
- [ ] `parthenon-templates validate-manifests` CLI works.
- [ ] `parthenon-cdm` package's `bootstrap()` runs against a clean Postgres.
- [ ] All 8 node types (`SqlNode`, `PythonNode`, `RNode`, `CsvReaderNode`, `DbReaderNode`, `DbWriterNode`, `Py2TableNode`, `GenericFileNode`) are import-able.

Confirm Plan 2 has landed:

- [ ] `app.template_runs` migration applied.
- [ ] `POST /api/v1/ingestion/templates/{id}/runs` returns 201 against a fixture manifest.

Confirm Plan 3 has landed:

- [ ] Aqueduct sub-tabs render behind feature flag `ingestion.templates_enabled`.
- [ ] Submitting a fixture manifest through the UI creates a run row visible in the Runs sub-tab.

If any pre-flight check fails, halt and resolve in the relevant earlier plan.

---

## Task 1: `hello_cdm` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/manifest.yaml`

- [ ] **Step 1: Write the manifest**

```yaml
# /home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/manifest.yaml
apiVersion: parthenon.io/v1
kind: Template
metadata:
  id: hello_cdm
  name: "Hello CDM — bootstrap a tiny OMOP CDM and insert one PERSON row"
  version: 0.1.0
  category: demo
  tags: [demo, bootstrap, smoke-test]
  cdm_versions: ["5.3", "5.4"]
  author: "Parthenon Project"
  singleton: false
  emits_cdm: true
  description: |
    The canonical "the framework works" demo. Bootstraps a minimal OMOP CDM in
    a target schema, inserts one PERSON row, and queries it back. This is what
    we point new developers at first.
spec:
  parameters:
    type: object
    required: [target_schema, cdm_version]
    properties:
      target_schema:
        type: string
        description: "Target OMOP schema name (will be created if absent)"
        default: "hello_cdm_demo"
        pattern: "^[a-z][a-z0-9_]*$"
      cdm_version:
        type: string
        enum: ["5.3", "5.4"]
        default: "5.4"
        description: "OMOP CDM version to bootstrap"
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - id: bootstrap
      type: parthenon.nodes.SqlNode
      params:
        action: bootstrap_cdm
        schema: "${parameters.target_schema}"
        cdm_version: "${parameters.cdm_version}"
    - id: insert_person
      type: parthenon.nodes.SqlNode
      inputs:
        ready: bootstrap.completed
      params:
        statement: |
          INSERT INTO ${parameters.target_schema}.person (
            person_id, gender_concept_id, year_of_birth,
            race_concept_id, ethnicity_concept_id
          ) VALUES (1, 8507, 1970, 0, 0);
    - id: query_person
      type: parthenon.nodes.SqlNode
      inputs:
        ready: insert_person.completed
      params:
        statement: |
          SELECT person_id, year_of_birth
          FROM ${parameters.target_schema}.person
          WHERE person_id = 1;
        emit_as: query_result
  post_conditions:
    - kind: row_count
      table: "${parameters.target_schema}.person"
      min: 1
      max: 1
    - kind: dqd_check
      check: person_yob_in_range
      schema: "${parameters.target_schema}"
    - kind: artifact_present
      artifact: query_result
  performance:
    max_runtime_seconds: 30
```

- [ ] **Step 2: Validate manifest**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run parthenon-templates validate-manifests manifests/hello_cdm`
Expected: PASS, manifest accepted.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/hello_cdm/manifest.yaml
git commit -m "feat(templates): add hello_cdm manifest

Canonical 'framework works' demo template. Bootstraps a minimal OMOP CDM,
inserts one PERSON row, queries it back. Both v5.3 and v5.4 supported.
Performance budget: <30s on Postgres 16 dev."
```

---

## Task 2: `hello_cdm` validation pack

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/validation/README.md`

- [ ] **Step 1: Write `inputs/parameters.json`**

```json
{
  "target_schema": "hello_cdm_demo_validation",
  "cdm_version": "5.4"
}
```

- [ ] **Step 2: Write `expected/post_conditions.yaml`**

```yaml
post_conditions:
  - kind: row_count
    table: hello_cdm_demo_validation.person
    expected: 1
  - kind: column_value
    table: hello_cdm_demo_validation.person
    column: year_of_birth
    expected: 1970
    where: "person_id = 1"
  - kind: artifact_present
    artifact_name: query_result
    min_rows: 1
```

- [ ] **Step 3: Write `dqd_checks.yaml`**

```yaml
checks:
  - name: person_yob_in_range
    table: person
    column: year_of_birth
    severity: error
    expected_pass: true
  - name: person_id_unique
    table: person
    column: person_id
    severity: error
    expected_pass: true
```

- [ ] **Step 4: Write `validation/README.md`**

```markdown
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
(see Task 4). To run manually against a clean Postgres dev database:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_hello_cdm.py -v
```
```

- [ ] **Step 5: Validate**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run parthenon-templates validate-manifests manifests/hello_cdm`
Expected: PASS — the validator accepts the validation pack as part of the manifest directory.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/hello_cdm/validation/
git commit -m "feat(templates): add hello_cdm validation pack"
```

---

## Task 3: `hello_cdm` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/hello_cdm/README.md`

- [ ] **Step 1: Write the README**

```markdown
# hello_cdm

The canonical "the framework works" demo template for Parthenon ingestion.

## What it does

Bootstraps a minimal OMOP CDM in a target schema, inserts one PERSON row,
and queries it back. The whole flow runs in under 30 seconds on a dev
Postgres 16 instance.

## When to use it

- First template a new developer runs to confirm their environment works.
- Smoke test in CI on every push to `main`.
- Sanity check before debugging a more complex template — if `hello_cdm`
  fails, the framework itself has a problem.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `target_schema` | string | `hello_cdm_demo` | Target OMOP schema name. Must match `^[a-z][a-z0-9_]*$`. Schema is created if absent. |
| `cdm_version` | enum | `5.4` | One of `5.3` or `5.4`. Determines which OMOP DDL is applied. |

## Prerequisites

- `parthenon-templates` service is running and reachable.
- Postgres connection configured with DDL privileges (uses the `parthenon_migrator` role per the runtime/migrator split).
- No requirement for vocabulary loads — this template stands on its own.

## Examples

Run via UI: navigate to **Aqueduct → Templates** sub-tab, click `hello_cdm`,
accept defaults, click Run. Within 30s the run shows green with a single
PERSON row in `hello_cdm_demo.person`.

Run via API:

```bash
curl -X POST https://parthenon.acumenus.net/api/v1/ingestion/templates/hello_cdm/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"version":"0.1.0","parameters":{"target_schema":"hello_cdm_demo","cdm_version":"5.4"}}'
```

Run via CLI (dev only):

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run parthenon-nodes run-template hello_cdm \
  --param target_schema=hello_cdm_demo \
  --param cdm_version=5.4
```

## Limitations

- Inserts a single hardcoded PERSON. Not suitable for any data validation
  beyond "the schema works."
- Re-running with the same `target_schema` will fail on the duplicate
  `person_id`. Drop the schema first or use a different target.
- Singleton: false — multiple concurrent runs are allowed, but they will
  fight for the same target schema if you don't vary it.

## License / attribution

The OMOP CDM schema definitions come from `pyomop` (Apache 2.0). The hardcoded
PERSON row is fictional. No real patient data is used.
```

- [ ] **Step 2: Markdown lint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx markdownlint /app/../templates/manifests/hello_cdm/README.md"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/hello_cdm/README.md
git commit -m "docs(templates): add hello_cdm README"
```

---

## Task 4: `hello_cdm` E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_hello_cdm.py`

- [ ] **Step 1: Write the failing E2E test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/e2e/test_hello_cdm.py
"""E2E test for hello_cdm template — validation pack runner."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest
import yaml
from sqlalchemy import create_engine, text

from parthenon_templates.registry import Registry
from parthenon_templates.orchestration import PrefectBackend


MANIFEST_DIR = Path(__file__).parent.parent.parent / "manifests" / "hello_cdm"


@pytest.fixture
def clean_postgres(postgres_test_url: str) -> str:
    """Drop validation schema before each test."""
    engine = create_engine(postgres_test_url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS hello_cdm_demo_validation CASCADE"))
    return postgres_test_url


def test_hello_cdm_runs_and_passes_validation_pack(clean_postgres: str) -> None:
    """Run hello_cdm end-to-end against a clean Postgres and assert validation pack."""
    registry = Registry.from_filesystem(MANIFEST_DIR.parent)
    manifest = registry.get("hello_cdm")

    params = json.loads((MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text())
    expected = yaml.safe_load((MANIFEST_DIR / "validation" / "expected" / "post_conditions.yaml").read_text())

    backend = PrefectBackend(database_url=clean_postgres)
    flow = registry.materialize("hello_cdm", params)
    handle = backend.submit(flow)

    deadline = time.time() + 60
    while time.time() < deadline:
        status = backend.get_status(handle.run_id)
        if status.terminal:
            break
        time.sleep(1)
    else:
        pytest.fail(f"hello_cdm did not terminate within 60s; last status: {status}")

    assert status.state == "completed", f"hello_cdm failed: {status.error}"

    engine = create_engine(clean_postgres)
    with engine.connect() as conn:
        for cond in expected["post_conditions"]:
            if cond["kind"] == "row_count":
                count = conn.execute(text(f"SELECT COUNT(*) FROM {cond['table']}")).scalar()
                assert count == cond["expected"], f"row_count failed: {cond}"
            elif cond["kind"] == "column_value":
                row = conn.execute(text(
                    f"SELECT {cond['column']} FROM {cond['table']} WHERE {cond['where']}"
                )).scalar()
                assert row == cond["expected"], f"column_value failed: {cond}"
            elif cond["kind"] == "artifact_present":
                artifacts = backend.list_artifacts(handle.run_id)
                names = {a.name for a in artifacts}
                assert cond["artifact_name"] in names, f"artifact missing: {cond}"
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_hello_cdm.py -v`
Expected: FAIL with `Registry.get('hello_cdm')` succeeds but `parthenon-cdm` is needed — should be PASS once Plan 1 is in place. If Plan 1 is incomplete, FAIL.

- [ ] **Step 3: Run again with Plan 1 in place, verify PASS**

Run: same as above.
Expected: PASS in <60s.

- [ ] **Step 4: Wire into CI workflow**

Modify `.github/workflows/ci.yml` (or whichever file runs templates tests). Add:

```yaml
- name: hello_cdm E2E
  run: cd templates && uv run pytest tests/e2e/test_hello_cdm.py -v
  env:
    DATABASE_URL: ${{ secrets.DB_TEST_URL }}
```

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/e2e/test_hello_cdm.py .github/workflows/ci.yml
git commit -m "test(templates): add hello_cdm E2E test in CI"
```

---

## Task 5: `nodes_test` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/manifest.yaml`

- [ ] **Step 1: Write the manifest**

```yaml
# /home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/manifest.yaml
apiVersion: parthenon.io/v1
kind: Template
metadata:
  id: nodes_test
  name: "Nodes Test — exercise every node type in the SDK"
  version: 0.1.0
  category: smoke-test
  tags: [smoke-test, nodes, integration]
  cdm_versions: ["5.4"]
  author: "Parthenon Project"
  singleton: false
  emits_cdm: false
  description: |
    Exercises each of the 8 bootstrap node types with a representative
    invocation. Outputs are asserted against expected fixtures. If any node
    breaks its contract, this template fails before any real ETL template
    is touched. Runs in CI on every push.
spec:
  parameters:
    type: object
    required: [workspace_dir]
    properties:
      workspace_dir:
        type: string
        description: "Working directory for intermediate artifacts (relative to run storage)"
        default: "workspace"
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - id: csv_in
      type: parthenon.nodes.CsvReaderNode
      params:
        path: "fixtures/sample.csv"
        emit_as: csv_data
    - id: py_transform
      type: parthenon.nodes.PythonNode
      inputs:
        data: csv_in.output
      params:
        script: |
          import polars as pl
          df = inputs["data"]
          outputs["result"] = df.with_columns((pl.col("value") * 2).alias("doubled"))
    - id: db_write
      type: parthenon.nodes.DbWriterNode
      inputs:
        data: py_transform.result
      params:
        schema: "nodes_test_${run_id}"
        table: "doubled"
        if_exists: "replace"
    - id: db_read
      type: parthenon.nodes.DbReaderNode
      inputs:
        ready: db_write.completed
      params:
        schema: "nodes_test_${run_id}"
        table: "doubled"
        emit_as: round_tripped
    - id: py2table_check
      type: parthenon.nodes.Py2TableNode
      inputs:
        data: db_read.round_tripped
      params:
        schema: "nodes_test_${run_id}"
        table: "doubled_copy"
    - id: sql_aggregate
      type: parthenon.nodes.SqlNode
      inputs:
        ready: py2table_check.completed
      params:
        statement: |
          SELECT COUNT(*) as n, SUM(doubled) as total
          FROM nodes_test_${run_id}.doubled_copy;
        emit_as: aggregate
    - id: r_summary
      type: parthenon.nodes.RNode
      inputs:
        data: db_read.round_tripped
      params:
        script: |
          summary <- summary(data$doubled)
          jsonlite::write_json(summary, file=file.path(workspace, "r_summary.json"))
        emit_as: r_summary
    - id: generic_file_in
      type: parthenon.nodes.GenericFileNode
      params:
        path: "fixtures/sample.parquet"
        format: parquet
        emit_as: parquet_data
  post_conditions:
    - kind: artifact_present
      artifact: aggregate
    - kind: artifact_present
      artifact: r_summary
    - kind: artifact_present
      artifact: parquet_data
    - kind: assertion
      check: "aggregate.n == csv_in.row_count"
      message: "Round-trip preserved row count"
  performance:
    max_runtime_seconds: 60
```

- [ ] **Step 2: Validate manifest**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run parthenon-templates validate-manifests manifests/nodes_test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/nodes_test/manifest.yaml
git commit -m "feat(templates): add nodes_test manifest

Integration smoke test exercising all 8 SDK node types. Runs in CI on
every push. If any node breaks, this fails first."
```

---

## Task 6: `nodes_test` validation pack and fixtures

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/fixtures/sample.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/fixtures/sample.parquet` (binary; create via Python script in step 1)
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/validation/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/fixtures/build_fixtures.py`

- [ ] **Step 1: Write `fixtures/sample.csv`**

```csv
id,value,category
1,10,A
2,20,B
3,30,A
4,40,C
5,50,B
```

- [ ] **Step 2: Write `fixtures/build_fixtures.py` (generates sample.parquet)**

```python
# /home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/fixtures/build_fixtures.py
"""Generate sample.parquet from sample.csv. Idempotent — run on fixture changes."""
from pathlib import Path
import polars as pl

HERE = Path(__file__).parent

def build() -> None:
    df = pl.read_csv(HERE / "sample.csv")
    df.write_parquet(HERE / "sample.parquet")

if __name__ == "__main__":
    build()
```

- [ ] **Step 3: Generate `sample.parquet`**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run python manifests/nodes_test/fixtures/build_fixtures.py`
Expected: `sample.parquet` exists.

- [ ] **Step 4: Write `validation/inputs/parameters.json`**

```json
{
  "workspace_dir": "workspace"
}
```

- [ ] **Step 5: Write `validation/expected/post_conditions.yaml`**

```yaml
post_conditions:
  - kind: artifact_present
    artifact_name: aggregate
    min_size_bytes: 1
  - kind: artifact_present
    artifact_name: r_summary
    min_size_bytes: 1
  - kind: artifact_present
    artifact_name: parquet_data
    min_size_bytes: 1
  - kind: assertion
    description: "Aggregate sum of doubled values equals 2× sum of original values"
    expected_value: 300
    actual_path: "aggregate.total"
```

- [ ] **Step 6: Write `validation/dqd_checks.yaml`**

```yaml
checks: []
# nodes_test does not produce CDM data, so no DQD checks apply.
```

- [ ] **Step 7: Write `validation/README.md`**

```markdown
# nodes_test Validation Pack

This pack proves every SDK node type runs end-to-end and produces correct outputs.

## What it proves
- `CsvReaderNode` reads `fixtures/sample.csv`.
- `PythonNode` doubles a column.
- `DbWriterNode` persists to a per-run schema.
- `DbReaderNode` round-trips the data.
- `Py2TableNode` writes a dataframe back to a table.
- `SqlNode` aggregates and emits a result artifact.
- `RNode` produces an R summary artifact.
- `GenericFileNode` reads a parquet fixture.

## What it does NOT prove
- That production-scale data passes through nodes correctly.
- That node configuration variants (different connection strings, different
  formats) all work — only the canonical params are exercised.

## How to run
The pack runs automatically as part of the `nodes_test` E2E test in CI. To
run manually:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_nodes_test.py -v
```
```

- [ ] **Step 8: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/nodes_test/fixtures/ templates/manifests/nodes_test/validation/
git commit -m "feat(templates): add nodes_test validation pack and fixtures"
```

---

## Task 7: `nodes_test` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/nodes_test/README.md`

- [ ] **Step 1: Write the README**

```markdown
# nodes_test

Integration smoke test that exercises every node type in the SDK.

## What it does

Walks an 8-step DAG that touches each of the 8 bootstrap node types
(`CsvReaderNode`, `PythonNode`, `DbWriterNode`, `DbReaderNode`,
`Py2TableNode`, `SqlNode`, `RNode`, `GenericFileNode`) with a
representative invocation. Outputs are asserted against expected fixtures.

## When to use it

- Runs in CI on every push to `main`. If any node breaks its contract, this
  template's run fails before any real ETL template is touched.
- Local dev sanity check after pulling a new SDK version.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `workspace_dir` | string | `workspace` | Working directory for intermediate artifacts (relative to run storage). |

## Prerequisites

- `parthenon-templates` service running.
- Postgres test database with DDL privileges (uses a per-run schema named
  `nodes_test_<run_id>` so concurrent runs don't collide).
- R runtime container available (for `RNode`).

## Examples

Run via UI: Aqueduct → Templates → `nodes_test` → Run.

Run via CI: happens on every push automatically; see `.github/workflows/ci.yml`.

Run locally:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_nodes_test.py -v
```

## Limitations

- Tests only the canonical happy path for each node. Variants (different
  connection strings, large files, edge cases) are covered by node-level
  unit tests, not this template.
- Does not produce OMOP CDM data — `emits_cdm: false`. No `IngestionJob` row
  is created.

## License / attribution

Sample data is synthetic, generated in `fixtures/build_fixtures.py`. No real
patient data.
```

- [ ] **Step 2: Markdown lint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx markdownlint /app/../templates/manifests/nodes_test/README.md"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/nodes_test/README.md
git commit -m "docs(templates): add nodes_test README"
```

---

## Task 8: `nodes_test` E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_nodes_test.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/ci.yml`

- [ ] **Step 1: Write the failing E2E test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/e2e/test_nodes_test.py
"""E2E test for nodes_test template — exercises every SDK node."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest
import yaml
from sqlalchemy import create_engine, text

from parthenon_templates.registry import Registry
from parthenon_templates.orchestration import PrefectBackend


MANIFEST_DIR = Path(__file__).parent.parent.parent / "manifests" / "nodes_test"


def test_nodes_test_runs_all_8_node_types(postgres_test_url: str) -> None:
    """Run nodes_test end-to-end and assert every artifact + post-condition."""
    registry = Registry.from_filesystem(MANIFEST_DIR.parent)
    params = json.loads((MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text())
    expected = yaml.safe_load((MANIFEST_DIR / "validation" / "expected" / "post_conditions.yaml").read_text())

    backend = PrefectBackend(database_url=postgres_test_url)
    flow = registry.materialize("nodes_test", params)
    handle = backend.submit(flow)

    deadline = time.time() + 120
    while time.time() < deadline:
        status = backend.get_status(handle.run_id)
        if status.terminal:
            break
        time.sleep(2)
    else:
        pytest.fail(f"nodes_test did not terminate within 120s; last status: {status}")

    assert status.state == "completed", f"nodes_test failed: {status.error}"

    artifacts = backend.list_artifacts(handle.run_id)
    names = {a.name for a in artifacts}
    for cond in expected["post_conditions"]:
        if cond["kind"] == "artifact_present":
            assert cond["artifact_name"] in names, f"missing artifact {cond['artifact_name']}"
        elif cond["kind"] == "assertion":
            # Resolve actual_path against the artifacts
            assert "aggregate" in names
            agg = backend.get_artifact_data(handle.run_id, "aggregate")
            assert agg["total"] == cond["expected_value"]
```

- [ ] **Step 2: Run test, verify it fails (Plan 1 incomplete) or passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_nodes_test.py -v`
Expected: FAIL if Plan 1 SDK is incomplete, PASS once Plan 1 is in place.

- [ ] **Step 3: Add to CI workflow**

Modify `.github/workflows/ci.yml` after the `hello_cdm E2E` step from Task 4:

```yaml
- name: nodes_test E2E
  run: cd templates && uv run pytest tests/e2e/test_nodes_test.py -v
  env:
    DATABASE_URL: ${{ secrets.DB_TEST_URL }}
```

- [ ] **Step 4: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/e2e/test_nodes_test.py .github/workflows/ci.yml
git commit -m "test(templates): add nodes_test E2E in CI"
```

---

## Task 9: `vocab_diff.py` CLI implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cli/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cli/vocab_diff.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/cli/test_vocab_diff.py`

- [ ] **Step 1: Write the failing unit test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/cli/test_vocab_diff.py
"""Unit tests for parthenon-vocab diff CLI."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from parthenon_templates.cli.vocab_diff import diff_bundles


def test_diff_bundles_added_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    bundle_a.mkdir()
    bundle_b.mkdir()

    (bundle_a / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAspirin\n2\tIbuprofen\n"
    )
    (bundle_b / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAspirin\n2\tIbuprofen\n3\tNaproxen\n"
    )

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == [{"concept_id": 3, "concept_name": "Naproxen"}]
    assert result["removed"] == []
    assert result["changed"] == []


def test_diff_bundles_removed_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    bundle_a.mkdir()
    bundle_b.mkdir()

    (bundle_a / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAspirin\n2\tIbuprofen\n"
    )
    (bundle_b / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAspirin\n"
    )

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == []
    assert result["removed"] == [{"concept_id": 2, "concept_name": "Ibuprofen"}]


def test_diff_bundles_changed_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    bundle_a.mkdir()
    bundle_b.mkdir()

    (bundle_a / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAspirin\n"
    )
    (bundle_b / "CONCEPT.csv").write_text(
        "concept_id\tconcept_name\n1\tAcetylsalicylic acid\n"
    )

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == []
    assert result["removed"] == []
    assert len(result["changed"]) == 1
    assert result["changed"][0]["concept_id"] == 1
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/cli/test_vocab_diff.py -v`
Expected: FAIL with `ModuleNotFoundError: parthenon_templates.cli.vocab_diff`.

- [ ] **Step 3: Implement `vocab_diff.py`**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cli/__init__.py
"""Parthenon templates CLI tools."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cli/vocab_diff.py
"""Diff two Athena vocabulary bundles, emit JSON."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any


def _load_concepts(bundle: Path) -> dict[int, dict[str, Any]]:
    """Load CONCEPT.csv keyed by concept_id."""
    concepts: dict[int, dict[str, Any]] = {}
    with open(bundle / "CONCEPT.csv", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            cid = int(row["concept_id"])
            concepts[cid] = {k: v for k, v in row.items()}
            concepts[cid]["concept_id"] = cid
    return concepts


def diff_bundles(bundle_a: Path, bundle_b: Path) -> dict[str, list[dict[str, Any]]]:
    """Return added/removed/changed concepts between two bundles."""
    a = _load_concepts(bundle_a)
    b = _load_concepts(bundle_b)

    added = [b[cid] for cid in sorted(b.keys() - a.keys())]
    removed = [a[cid] for cid in sorted(a.keys() - b.keys())]
    changed = []
    for cid in sorted(a.keys() & b.keys()):
        if a[cid] != b[cid]:
            changed.append({
                "concept_id": cid,
                "before": a[cid],
                "after": b[cid],
            })

    return {"added": added, "removed": removed, "changed": changed}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="parthenon-vocab", description="Diff Athena vocabulary bundles")
    sub = parser.add_subparsers(dest="cmd", required=True)
    diff = sub.add_parser("diff", help="Diff two bundles")
    diff.add_argument("bundle_a", type=Path)
    diff.add_argument("bundle_b", type=Path)
    diff.add_argument("--output", "-o", type=Path, default=None)

    args = parser.parse_args(argv)

    if args.cmd == "diff":
        result = diff_bundles(args.bundle_a, args.bundle_b)
        out = json.dumps(result, indent=2, default=str)
        if args.output:
            args.output.write_text(out)
        else:
            print(out)
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/cli/test_vocab_diff.py -v`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Run mypy**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run mypy --strict runtime/cli/vocab_diff.py`
Expected: no errors.

- [ ] **Step 6: Register CLI entry point in pyproject.toml**

Modify `templates/pyproject.toml` `[project.scripts]` table to add:

```toml
parthenon-vocab = "parthenon_templates.cli.vocab_diff:main"
```

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/cli/ templates/tests/unit/cli/ templates/pyproject.toml
git commit -m "feat(templates): add parthenon-vocab diff CLI

Diffs two Athena bundles and emits added/removed/changed concepts as JSON.
The vocabulary-diff differentiator from devplan T-008."
```

---

## Task 10: `vocab_diff` CLI README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cli/README.md`

- [ ] **Step 1: Write the README**

```markdown
# parthenon-vocab CLI

Differential analysis between OHDSI Athena vocabulary bundles.

## Subcommands

### `diff`

```bash
parthenon-vocab diff <bundle_a> <bundle_b> [--output diff.json]
```

Compares two Athena bundle directories and emits JSON listing concepts that
were added, removed, or changed (any column value differs) between them.

Output schema:

```json
{
  "added":   [{"concept_id": 3, "concept_name": "Naproxen", ...}],
  "removed": [{"concept_id": 2, "concept_name": "Ibuprofen", ...}],
  "changed": [{"concept_id": 1, "before": {...}, "after": {...}}]
}
```

If `--output` is omitted, the JSON is written to stdout.

## Use cases

- Quarterly review when a new Athena bundle is released, before running
  `load_athena_vocabulary` against production.
- Audit trail when a vocabulary change is suspected to have caused a
  downstream concept-mapping regression.

## Limitations

- Compares CONCEPT.csv only. CONCEPT_ANCESTOR, CONCEPT_RELATIONSHIP, and
  other tables are not currently diffed (out of scope for Phase 0).
- Memory-bound: full Athena bundles can have ~10M concept rows. The CLI
  loads both bundles fully into memory. For bundles >2M concepts, use a
  database-backed diff (out of scope for Phase 0).
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/cli/README.md
git commit -m "docs(cli): add parthenon-vocab README"
```

---

## Task 11: `load_athena_vocabulary` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/manifest.yaml`

- [ ] **Step 1: Write the manifest**

```yaml
# /home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/manifest.yaml
apiVersion: parthenon.io/v1
kind: Template
metadata:
  id: load_athena_vocabulary
  name: "Load Athena Vocabulary Bundle"
  version: 0.1.0
  category: reference-data
  tags: [vocabulary, athena, snomed, rxnorm, loinc, cpt4]
  cdm_versions: ["5.3", "5.4"]
  author: "Parthenon Project"
  singleton: true
  emits_cdm: true
  description: |
    Loads an Athena vocabulary bundle (CONCEPT, CONCEPT_RELATIONSHIP,
    CONCEPT_ANCESTOR, VOCABULARY, DOMAIN, CONCEPT_SYNONYM, DRUG_STRENGTH).
    CPT4 is loaded separately via the OHDSI cpt4.jar utility, gated on a
    UMLS_API_KEY env var; gracefully skipped with a warning when absent.
    Idempotent — re-running on the same bundle is a no-op verified by row
    count parity. Records bundle reference timestamp in vocabulary_load
    audit table.

    USER-INITIATED ONLY. Not in CI. Run in staging as part of release
    validation per spec §8.
spec:
  parameters:
    type: object
    required: [bundle_path, target_vocab_schema]
    properties:
      bundle_path:
        type: string
        description: "Absolute path to extracted Athena bundle directory"
      target_vocab_schema:
        type: string
        default: "vocab"
        description: "Target schema for vocabulary tables"
        pattern: "^[a-z][a-z0-9_]*$"
      force:
        type: boolean
        default: false
        description: "If true, overwrite existing vocabulary data. Required when re-loading."
      enable_cpt4:
        type: boolean
        default: true
        description: "Run cpt4.jar to load CPT4 codes. Requires UMLS_API_KEY env var."
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - id: ensure_audit_table
      type: parthenon.nodes.SqlNode
      params:
        statement: |
          CREATE TABLE IF NOT EXISTS ${parameters.target_vocab_schema}.vocabulary_load (
            id BIGSERIAL PRIMARY KEY,
            bundle_path TEXT NOT NULL,
            bundle_reference TEXT,
            loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            row_counts JSONB
          );
    - id: idempotency_check
      type: parthenon.nodes.PythonNode
      inputs:
        ready: ensure_audit_table.completed
      params:
        script: |
          import os
          bundle_path = parameters["bundle_path"]
          force = parameters.get("force", False)
          # Hash the bundle's CONCEPT.csv as the identity check
          import hashlib
          h = hashlib.sha256()
          with open(os.path.join(bundle_path, "CONCEPT.csv"), "rb") as f:
              for chunk in iter(lambda: f.read(8192), b""):
                  h.update(chunk)
          digest = h.hexdigest()

          existing = ctx.db.fetch(
              "SELECT id FROM ${parameters.target_vocab_schema}.vocabulary_load WHERE bundle_reference = %s",
              [digest]
          )
          if existing and not force:
              outputs["skip"] = True
              outputs["digest"] = digest
              ctx.logger.info("Bundle already loaded; skipping. Pass force=true to reload.")
          else:
              outputs["skip"] = False
              outputs["digest"] = digest
    - id: load_concept
      type: parthenon.nodes.CsvReaderNode
      inputs:
        proceed: idempotency_check.skip == false
      params:
        path: "${parameters.bundle_path}/CONCEPT.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "concept"
        if_exists: "replace"
    - id: load_concept_relationship
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_concept.completed
      params:
        path: "${parameters.bundle_path}/CONCEPT_RELATIONSHIP.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "concept_relationship"
        if_exists: "replace"
    - id: load_concept_ancestor
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_concept_relationship.completed
      params:
        path: "${parameters.bundle_path}/CONCEPT_ANCESTOR.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "concept_ancestor"
        if_exists: "replace"
    - id: load_vocabulary
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_concept_ancestor.completed
      params:
        path: "${parameters.bundle_path}/VOCABULARY.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "vocabulary"
        if_exists: "replace"
    - id: load_domain
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_vocabulary.completed
      params:
        path: "${parameters.bundle_path}/DOMAIN.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "domain"
        if_exists: "replace"
    - id: load_concept_synonym
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_domain.completed
      params:
        path: "${parameters.bundle_path}/CONCEPT_SYNONYM.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "concept_synonym"
        if_exists: "replace"
    - id: load_drug_strength
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_concept_synonym.completed
      params:
        path: "${parameters.bundle_path}/DRUG_STRENGTH.csv"
        delimiter: "\t"
        target_schema: "${parameters.target_vocab_schema}"
        target_table: "drug_strength"
        if_exists: "replace"
    - id: load_cpt4
      type: parthenon.nodes.RNode
      inputs:
        ready: load_drug_strength.completed
        proceed: parameters.enable_cpt4 == true
      params:
        script: |
          api_key <- Sys.getenv("UMLS_API_KEY")
          if (api_key == "") {
            warning("UMLS_API_KEY not set; skipping CPT4 load")
            quit(status = 0)
          }
          # Invoke cpt4.jar from OHDSI
          system2("java", c("-jar", "/opt/parthenon/cpt4.jar",
                            parameters$bundle_path, api_key,
                            parameters$target_vocab_schema))
    - id: record_load
      type: parthenon.nodes.SqlNode
      inputs:
        ready: load_cpt4.completed
      params:
        statement: |
          INSERT INTO ${parameters.target_vocab_schema}.vocabulary_load
            (bundle_path, bundle_reference, row_counts)
          VALUES (
            %(bundle_path)s,
            %(digest)s,
            (SELECT jsonb_object_agg(table_name, n_rows) FROM (
              SELECT 'concept' AS table_name, COUNT(*) AS n_rows FROM ${parameters.target_vocab_schema}.concept
              UNION ALL SELECT 'concept_relationship', COUNT(*) FROM ${parameters.target_vocab_schema}.concept_relationship
              UNION ALL SELECT 'concept_ancestor', COUNT(*) FROM ${parameters.target_vocab_schema}.concept_ancestor
              UNION ALL SELECT 'vocabulary', COUNT(*) FROM ${parameters.target_vocab_schema}.vocabulary
              UNION ALL SELECT 'domain', COUNT(*) FROM ${parameters.target_vocab_schema}.domain
              UNION ALL SELECT 'concept_synonym', COUNT(*) FROM ${parameters.target_vocab_schema}.concept_synonym
              UNION ALL SELECT 'drug_strength', COUNT(*) FROM ${parameters.target_vocab_schema}.drug_strength
            ) t)
          );
        params:
          bundle_path: "${parameters.bundle_path}"
          digest: "${idempotency_check.digest}"
  post_conditions:
    - kind: row_count
      table: "${parameters.target_vocab_schema}.concept"
      min: 1000000
    - kind: row_count
      table: "${parameters.target_vocab_schema}.vocabulary"
      min: 30
    - kind: assertion
      check: "vocabulary_load row exists for this bundle"
      sql: "SELECT COUNT(*) FROM ${parameters.target_vocab_schema}.vocabulary_load WHERE bundle_reference = %(digest)s"
      expected: 1
  performance:
    max_runtime_seconds: 1800
```

- [ ] **Step 2: Validate manifest**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run parthenon-templates validate-manifests manifests/load_athena_vocabulary`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_athena_vocabulary/manifest.yaml
git commit -m "feat(templates): add load_athena_vocabulary manifest

Loads Athena vocabulary bundle (CONCEPT/RELATIONSHIP/ANCESTOR/VOCABULARY/
DOMAIN/SYNONYM/DRUG_STRENGTH). Idempotent via SHA256 of CONCEPT.csv.
CPT4 gated on UMLS_API_KEY. Singleton: true. User-initiated only."
```

---

## Task 12: `load_athena_vocabulary` validation pack

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/validation/README.md`

- [ ] **Step 1: Write validation pack files**

`validation/inputs/parameters.json`:
```json
{
  "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
  "target_vocab_schema": "vocab_validation",
  "force": true,
  "enable_cpt4": true
}
```

`validation/expected/post_conditions.yaml`:
```yaml
post_conditions:
  - kind: row_count
    table: vocab_validation.concept
    min: 1000000
    description: "Real bundle should have at least 1M concepts"
  - kind: row_count
    table: vocab_validation.vocabulary
    min: 30
    description: "Real bundle should have at least 30 vocabularies"
  - kind: row_count
    table: vocab_validation.concept_ancestor
    min: 5000000
    description: "Concept ancestor table is large"
  - kind: assertion
    description: "vocabulary_load audit row exists for this bundle"
    expected_value: 1
```

`validation/dqd_checks.yaml`:
```yaml
checks:
  - name: vocabulary_concept_id_unique
    table: concept
    column: concept_id
    severity: error
    expected_pass: true
  - name: vocabulary_relationship_no_self_loops
    table: concept_relationship
    description: "concept_id_1 != concept_id_2 unless relationship_id = 'Maps to self'"
    severity: warning
    expected_pass: true
```

`validation/README.md`:
```markdown
# load_athena_vocabulary Validation Pack

This pack proves an Athena bundle loads end-to-end and the vocabulary tables
have the expected shape and row counts.

## What it proves
- All 7 mandatory bundle CSVs load into the target schema.
- Idempotency: re-running with same `force=false` is a no-op.
- The audit row in `vocabulary_load` records the bundle's SHA256 reference.
- DQD-equivalent checks pass on the loaded vocabulary.

## What it does NOT prove
- Concept content correctness (we trust Athena's correctness).
- CPT4 contents (CPT4 is gated on `UMLS_API_KEY`; absence is acceptable in
  many environments).
- Cross-vocabulary mappings are clinically meaningful.

## How to run

**This pack is user-initiated only — NOT run in CI.**

In staging:

```bash
# Ensure UMLS_API_KEY is set if CPT4 is desired
export UMLS_API_KEY=$(vault read -field=api_key secret/umls)

# Run via API (preferred):
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_athena_vocabulary/validation/inputs/parameters.json

# Wait for terminal status, then validate:
cd /home/smudoshi/Github/Parthenon/templates
uv run python tests/staging/validate_pack.py manifests/load_athena_vocabulary
```

Expected runtime: 15-30 minutes for the full Athena bundle.
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_athena_vocabulary/validation/
git commit -m "feat(templates): add load_athena_vocabulary validation pack"
```

---

## Task 13: `load_athena_vocabulary` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_athena_vocabulary/README.md`

- [ ] **Step 1: Write the README**

```markdown
# load_athena_vocabulary

Loads an OHDSI Athena vocabulary bundle into Parthenon.

## What it does

Reads 7 standard CSVs from an Athena bundle directory (CONCEPT,
CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR, VOCABULARY, DOMAIN, CONCEPT_SYNONYM,
DRUG_STRENGTH) and loads them into the target schema via `if_exists: replace`.
CPT4 is loaded separately via the OHDSI `cpt4.jar` utility (RNode) when
`UMLS_API_KEY` is configured. Records the bundle's SHA256 in
`<schema>.vocabulary_load` for idempotency and audit.

## When to use it

- First-time vocabulary load after standing up a new Parthenon installation.
- Quarterly Athena bundle refresh.
- Reload after a bundle issue is fixed upstream.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `bundle_path` | string | required | Absolute path to extracted Athena bundle directory containing CONCEPT.csv etc. |
| `target_vocab_schema` | string | `vocab` | Target schema for vocabulary tables. Must match `^[a-z][a-z0-9_]*$`. |
| `force` | boolean | `false` | When true, overwrites existing data even if the same bundle is already loaded. |
| `enable_cpt4` | boolean | `true` | Run cpt4.jar to load CPT4 codes. Requires `UMLS_API_KEY` env var. |

## Prerequisites

- **Bundle download:** customer must obtain their own bundle from
  https://athena.ohdsi.org/. Parthenon ships the loader, not the data.
  Place the extracted directory at a path readable by the
  `parthenon-templates` container (e.g., `/var/parthenon/staging/athena/`).
- **UMLS API key (optional):** required for CPT4. Generate at
  https://uts.nlm.nih.gov/uts/. Provide via secrets manager and inject as
  `UMLS_API_KEY` env var on the `parthenon-templates` container. NEVER
  hardcode in a manifest or commit.
- **Postgres role:** uses `parthenon_migrator` for DDL on the target schema
  during bundle replace. Runtime queries use `parthenon_app`.
- **Singleton:** declared `singleton: true`. Concurrent runs are rejected
  at submit time by `TemplateRunService` (Plan 2).

## Examples

### First load (staging)

```bash
export UMLS_API_KEY=$(vault read -field=api_key secret/umls)

curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
      "target_vocab_schema": "vocab",
      "force": false,
      "enable_cpt4": true
    }
  }'
```

### Re-load after bundle update

```bash
# Same bundle, force=true to overwrite
curl ... -d '{... "force": true}'
```

### Skip CPT4 (no UMLS key available)

```bash
curl ... -d '{... "enable_cpt4": false}'
```

## Limitations

- **Memory:** loads each CSV into memory before bulk-inserting. For
  Postgres-server-class hosts (32GB+) this is fine. Smaller hosts may
  need to chunk via `if_exists: append` mode (out of scope for Phase 0).
- **Replace semantics:** `if_exists: replace` truncates the target table
  before insert. Any application that holds open foreign-key references
  to a vocab table at the moment the load runs will see locks. Run during
  a maintenance window.
- **CPT4 binary:** the `cpt4.jar` is bundled at `/opt/parthenon/cpt4.jar`
  inside the `parthenon-templates` container; check the Dockerfile to
  confirm the version. Updating cpt4.jar is a separate ops task.
- **Not in CI:** validation runs are user-initiated in staging only.
- **Force flag:** required to overwrite an existing identical bundle. This
  prevents accidental no-op overwrites that lock the schema needlessly.

## License / attribution

- Athena vocabulary bundles are distributed by OHDSI under the OHDSI
  vocabulary license. Customers must agree to OHDSI terms before downloading.
- CPT4 codes are owned by the AMA. UMLS API access requires individual
  registration at https://uts.nlm.nih.gov/uts/.
- Parthenon ships only the loading mechanism; no Athena content is
  distributed in this repo.

## Security notes

- `UMLS_API_KEY` MUST come from secrets manager. The `parameters` JSONB
  in `app.template_runs` redacts any field marked `secret: true` in the
  manifest's parameter schema. UMLS_API_KEY is read from env, never from
  parameters, and is never logged.
- `bundle_path` is constrained to paths inside the templates storage
  volume (`/var/parthenon/staging/`). Path traversal is rejected at the
  registry layer.
```

- [ ] **Step 2: Markdown lint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx markdownlint /app/../templates/manifests/load_athena_vocabulary/README.md"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_athena_vocabulary/README.md
git commit -m "docs(templates): add load_athena_vocabulary README

Includes UMLS API key setup, OHDSI license attribution, force-flag
explanation, and security notes per HIGHSEC §5."
```

---

## Task 14: `load_synpuf` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/manifest.yaml`

- [ ] **Step 1: Write the manifest**

```yaml
# /home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/manifest.yaml
apiVersion: parthenon.io/v1
kind: Template
metadata:
  id: load_synpuf
  name: "Load CMS SynPUF (1K or 100K) into OMOP CDM"
  version: 0.1.0
  category: reference-dataset
  tags: [synpuf, cms, demo, omop]
  cdm_versions: ["5.3", "5.4"]
  author: "Parthenon Project"
  singleton: false
  emits_cdm: true
  description: |
    Fetches OHDSI-hosted CDM-shaped SynPUF files (1K or 100K patients) and
    loads them into a target schema after vocabulary is present.
    Wires up an Achilles-style summary as a post-condition.

    USER-INITIATED ONLY. Not in CI. Run in staging during release validation.
spec:
  parameters:
    type: object
    required: [target_schema, patient_count]
    properties:
      target_schema:
        type: string
        default: "synpuf"
        description: "Target OMOP schema name"
        pattern: "^[a-z][a-z0-9_]*$"
      patient_count:
        type: string
        enum: ["1k", "100k"]
        default: "1k"
        description: "Patient count slice — 1K is fast, 100K takes ~20 min"
      force:
        type: boolean
        default: false
        description: "If true, drops existing data in target_schema before loading"
      vocab_schema:
        type: string
        default: "vocab"
        description: "Schema where Athena vocabulary lives"
  requires:
    cdm_initialized: false
    vocabularies: [snomed, rxnorm, loinc]
  nodes:
    - id: bootstrap_cdm
      type: parthenon.nodes.SqlNode
      params:
        action: bootstrap_cdm
        schema: "${parameters.target_schema}"
        cdm_version: "5.4"
    - id: precheck_existing
      type: parthenon.nodes.PythonNode
      inputs:
        ready: bootstrap_cdm.completed
      params:
        script: |
          existing_n = ctx.db.fetch_scalar(
              "SELECT COUNT(*) FROM ${parameters.target_schema}.person"
          )
          if existing_n > 0 and not parameters.get("force", False):
              raise RuntimeError(
                  f"target_schema already contains {existing_n} persons. "
                  "Pass force=true to overwrite."
              )
    - id: download_synpuf
      type: parthenon.nodes.GenericFileNode
      inputs:
        ready: precheck_existing.completed
      params:
        url: "ftp://ftp.ohdsi.org/synpuf/${parameters.patient_count}/"
        download_dir: "synpuf_download"
        format: csv-bundle
        emit_as: synpuf_files
    - id: load_person
      type: parthenon.nodes.CsvReaderNode
      inputs:
        files: download_synpuf.synpuf_files
      params:
        path: "synpuf_download/PERSON.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "person"
        if_exists: "${parameters.force == true ? 'replace' : 'fail'}"
    - id: load_visit_occurrence
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_person.completed
      params:
        path: "synpuf_download/VISIT_OCCURRENCE.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "visit_occurrence"
        if_exists: "replace"
    - id: load_condition_occurrence
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_visit_occurrence.completed
      params:
        path: "synpuf_download/CONDITION_OCCURRENCE.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "condition_occurrence"
        if_exists: "replace"
    - id: load_drug_exposure
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_condition_occurrence.completed
      params:
        path: "synpuf_download/DRUG_EXPOSURE.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "drug_exposure"
        if_exists: "replace"
    - id: load_procedure_occurrence
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_drug_exposure.completed
      params:
        path: "synpuf_download/PROCEDURE_OCCURRENCE.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "procedure_occurrence"
        if_exists: "replace"
    - id: load_observation_period
      type: parthenon.nodes.CsvReaderNode
      inputs:
        ready: load_procedure_occurrence.completed
      params:
        path: "synpuf_download/OBSERVATION_PERIOD.csv"
        delimiter: ","
        target_schema: "${parameters.target_schema}"
        target_table: "observation_period"
        if_exists: "replace"
    - id: achilles_summary
      type: parthenon.nodes.SqlNode
      inputs:
        ready: load_observation_period.completed
      params:
        statement: |
          SELECT
            (SELECT COUNT(*) FROM ${parameters.target_schema}.person) AS person_count,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.visit_occurrence) AS visit_count,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.condition_occurrence) AS condition_count,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.drug_exposure) AS drug_count,
            (SELECT COUNT(*) FROM ${parameters.target_schema}.procedure_occurrence) AS procedure_count,
            (SELECT MIN(observation_period_start_date) FROM ${parameters.target_schema}.observation_period) AS earliest_obs_start,
            (SELECT MAX(observation_period_end_date) FROM ${parameters.target_schema}.observation_period) AS latest_obs_end;
        emit_as: achilles_summary
  post_conditions:
    - kind: row_count
      table: "${parameters.target_schema}.person"
      min: 1000
    - kind: row_count
      table: "${parameters.target_schema}.visit_occurrence"
      min: 1
    - kind: artifact_present
      artifact: achilles_summary
    - kind: dqd_check
      check: person_yob_in_range
      schema: "${parameters.target_schema}"
  performance:
    max_runtime_seconds: 1200
```

- [ ] **Step 2: Validate manifest**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run parthenon-templates validate-manifests manifests/load_synpuf`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_synpuf/manifest.yaml
git commit -m "feat(templates): add load_synpuf manifest

Loads CMS SynPUF (1K or 100K) into OMOP CDM after vocabulary is present.
Pre-condition: vocabularies snomed/rxnorm/loinc loaded.
Post-condition: row_count(person) >= 1000, achilles summary emitted.
User-initiated only. Performance: <20 min for 1K."
```

---

## Task 15: `load_synpuf` validation pack

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/validation/README.md`

- [ ] **Step 1: Write validation files**

`validation/inputs/parameters.json`:
```json
{
  "target_schema": "synpuf_validation",
  "patient_count": "1k",
  "force": true,
  "vocab_schema": "vocab"
}
```

`validation/expected/post_conditions.yaml`:
```yaml
post_conditions:
  - kind: row_count
    table: synpuf_validation.person
    min: 1000
    max: 1100
    description: "1K SynPUF should have ~1116 patients per OHDSI publication"
  - kind: row_count
    table: synpuf_validation.visit_occurrence
    min: 50000
    description: "1K SynPUF visits — actual count depends on slice but >50K is the floor"
  - kind: row_count
    table: synpuf_validation.condition_occurrence
    min: 100000
  - kind: row_count
    table: synpuf_validation.drug_exposure
    min: 100000
  - kind: artifact_present
    artifact_name: achilles_summary
```

`validation/dqd_checks.yaml`:
```yaml
checks:
  - name: person_yob_in_range
    table: person
    column: year_of_birth
    severity: error
    expected_pass: true
  - name: person_id_unique
    table: person
    column: person_id
    severity: error
    expected_pass: true
  - name: visit_occurrence_person_id_fk
    table: visit_occurrence
    description: "Every visit_occurrence.person_id resolves to person.person_id"
    severity: error
    expected_pass: true
```

`validation/README.md`:
```markdown
# load_synpuf Validation Pack

Proves the SynPUF 1K loader produces a working OMOP dataset queryable by
ATLAS-equivalent tooling.

## What it proves
- 7 SynPUF tables load into the target schema.
- Person count is in the published OHDSI range (~1116 for 1K).
- Achilles-style summary artifact is produced.
- DQD checks (yob_in_range, person_id_unique, fk integrity) pass.

## What it does NOT prove
- The 100K slice (validation runs against 1K only — extrapolation is the
  responsibility of the engineer running the validation in staging).
- Production-scale Achilles or DQD reports (those run as separate jobs
  after the load completes).

## How to run

**User-initiated only. Not in CI.**

In staging, after `load_athena_vocabulary` has loaded SNOMED/RxNorm/LOINC:

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_synpuf/validation/inputs/parameters.json

# Wait for terminal status, then validate:
cd /home/smudoshi/Github/Parthenon/templates
uv run python tests/staging/validate_pack.py manifests/load_synpuf
```

Expected runtime: ~15 minutes for 1K, ~3 hours for 100K.
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_synpuf/validation/
git commit -m "feat(templates): add load_synpuf validation pack"
```

---

## Task 16: `load_synpuf` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_synpuf/README.md`

- [ ] **Step 1: Write the README**

```markdown
# load_synpuf

Loads CMS SynPUF (Synthetic Public Use Files) into an OMOP CDM target schema.

## What it does

Fetches OHDSI-hosted CDM-shaped SynPUF files (1K or 100K patient slice) from
`ftp://ftp.ohdsi.org/synpuf/`, bootstraps a target CDM schema, and loads the
7 core tables (PERSON, VISIT_OCCURRENCE, CONDITION_OCCURRENCE, DRUG_EXPOSURE,
PROCEDURE_OCCURRENCE, OBSERVATION_PERIOD). Emits an Achilles-style summary as
the final artifact.

## When to use it

- After `load_athena_vocabulary` to stand up a populated demo CDM.
- Sales engineering: a working OMOP environment in <20 min for SE demos.
- Smoke testing OHDSI tooling against a known dataset.
- Training data for new analysts learning OMOP CDM.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `target_schema` | string | `synpuf` | OMOP schema name. Created if absent. |
| `patient_count` | enum | `1k` | One of `1k` (~1116 patients, ~15 min) or `100k` (~111K patients, ~3 hours). |
| `force` | boolean | `false` | If true, overwrites existing data in `target_schema`. Required for re-runs. |
| `vocab_schema` | string | `vocab` | Schema containing Athena vocabulary tables. |

## Prerequisites

- **Vocabulary loaded:** the `load_athena_vocabulary` template must have
  completed successfully and populated SNOMED, RxNorm, LOINC at minimum.
- **Network access:** the `parthenon-templates` container needs outbound
  FTP/HTTPS to `ftp.ohdsi.org`.
- **Disk:** ~200MB for 1K, ~20GB for 100K under the templates storage volume.
- **Postgres role:** uses `parthenon_migrator` for the bootstrap step.

## Examples

### 1K demo load

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf_demo",
      "patient_count": "1k",
      "force": false,
      "vocab_schema": "vocab"
    }
  }'
```

### 100K full slice (production validation)

```bash
curl ... -d '{... "patient_count": "100k"}'
```

### Re-load same slice (overwrites)

```bash
curl ... -d '{... "force": true}'
```

## Limitations

- **SynPUF is synthetic.** Patterns approximate real Medicare claims data
  but should never be used for clinical decision-making, only for tooling
  validation and demos.
- **No Death table:** SynPUF does not provide DEATH data; the OMOP DEATH
  table will be empty after this load.
- **No Measurement, Note, NOTE_NLP, OBSERVATION:** SynPUF only includes
  the 7 tables loaded by this template.
- **Re-loads truncate:** `force=true` does `if_exists: replace` on every
  table. Don't run during business hours.
- **Not in CI:** validation runs are user-initiated in staging.

## License / attribution

- CMS SynPUF is published by the Centers for Medicare and Medicaid Services
  as public-domain data: https://www.cms.gov/research-statistics-data-and-systems/downloadable-public-use-files/synpufs
- The CDM-shaped version was prepared by Christophe Lambert and the OHDSI
  ETL-CMS contributors: https://github.com/OHDSI/ETL-CMS
- No license restrictions on redistribution. Parthenon may bundle small
  fixtures from this dataset for testing.

## Security notes

- No PHI in SynPUF — patients are synthetic. Standard ingestion permission
  (`ingestion.run`) is sufficient.
- Outbound FTP/HTTPS calls are logged with destination URL but not the
  payload.
```

- [ ] **Step 2: Markdown lint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx markdownlint /app/../templates/manifests/load_synpuf/README.md"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_synpuf/README.md
git commit -m "docs(templates): add load_synpuf README"
```

---

## Task 17: Phase 0 security review document

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-0-security.md`

- [ ] **Step 1: Write the security review**

```markdown
# Phase 0 Security Review — Ingestion Templates

**Reviewer:** _(fill in name + date at sign-off)_
**Status:** Draft
**Scope:** All Phase 0 components introduced by Plans 1–4.

## HIGHSEC §1 — Principle of Least Privilege

| Check | Verified by |
|---|---|
| `parthenon_app` runtime role used for queries; no DDL granted | `templates/runtime/orchestration/prefect_backend.py` connection setup; integration test in `tests/integration/test_runtime_role.py` |
| `parthenon_migrator` role pulled from secrets only when bootstrap is needed | `templates/runtime/cdm/__init__.py` (Plan 1 Task 31); test `test_migrator_credential_scoped_per_run` |
| Sanctum tokens expire 480 min — unchanged | `backend/config/sanctum.php` (no edit in any Phase 0 plan) |
| New users receive `viewer` role only — unchanged | `backend/app/Http/Controllers/Api/V1/AuthController.php` (no edit in any Phase 0 plan) |

## HIGHSEC §2 — Three-Layer Route Protection

Every new route in Plan 2 has all three layers:

| Route | Auth | Permission | Ownership |
|---|---|---|---|
| `GET /api/v1/ingestion/templates` | `auth:sanctum` | `permission:ingestion.view` | n/a (catalog is public to ingestion-view users) |
| `GET /api/v1/ingestion/templates/{id}` | `auth:sanctum` | `permission:ingestion.view` | n/a |
| `POST /api/v1/ingestion/templates/{id}/runs` | `auth:sanctum` | `permission:ingestion.run` | n/a (any ingestion-run user can submit) |
| `GET /api/v1/ingestion/templates/runs/{run}` | `auth:sanctum` | `permission:ingestion.view` | TemplateRunPolicy::view (run.submitted_by == user.id OR user has data-steward role) |
| `GET /api/v1/ingestion/templates/runs/{run}/logs` | `auth:sanctum` | `permission:ingestion.view` | TemplateRunPolicy::view |
| `GET /api/v1/ingestion/templates/runs/{run}/artifacts` | `auth:sanctum` | `permission:ingestion.view` | TemplateRunPolicy::view |
| `DELETE /api/v1/ingestion/templates/runs/{run}` | `auth:sanctum` | `permission:ingestion.delete` | TemplateRunPolicy::delete |

Verified by Pest feature tests in `backend/tests/Feature/Templates/AuthorizationTest.php` (Plan 2 Task 16-19).

## HIGHSEC §3 — Model Security

| Check | Verified by |
|---|---|
| `TemplateRun` model uses `$fillable` whitelist, never `$guarded = []` | `backend/app/Models/App/TemplateRun.php` (Plan 2 Task 3); test `test_template_run_fillable_whitelist` |
| `parameters` JSONB column does not encrypt — uses `array` cast not `encrypted:array` | Migration in Plan 2 Task 1; model casts in Plan 2 Task 3 |

## HIGHSEC §4 — Container Security

| Check | Verified by |
|---|---|
| `parthenon-templates` Dockerfile has non-root `USER` directive | `docker/templates/Dockerfile` (Plan 1 Task 2); contains `addgroup --system templates && adduser --system --ingroup templates templates` and `USER templates` |
| `parthenon-templates` service NOT exposed via Nginx | `docker-compose.yml` (Plan 1 Task 3); ports declared on internal network only |
| `parthenon-templates` healthcheck enabled | `docker-compose.yml` healthcheck section |
| `parthenon-templates` mounts only `templates/manifests/` (RO) and `/var/parthenon/storage/templates/` (RW) | `docker-compose.yml` volumes section |

## HIGHSEC §5 — Secrets Management

| Secret | Source | Logged? | Persisted? |
|---|---|---|---|
| `PARTHENON_INTERNAL_TOKEN` | env var, rotatable | Never (asserted in middleware test) | Never |
| `UMLS_API_KEY` (CPT4 in load_athena_vocabulary) | env var from secrets manager | Never (asserted in RNode wrapper test) | Never |
| `parthenon_migrator` PG password (per-run scoped) | secrets manager pull at run start | Never | Never (in-memory only for the run) |
| `template_runs.parameters` JSONB | persisted, but secret-keyed parameters redacted at registry layer | Redacted before persist | Redacted before persist |

Manifest CI lint enforces: any parameter named `*_key` / `*_token` / `*_password` MUST be marked `secret: true`. Plan 1 Task 28 implements `parthenon-templates lint-secret-keys`.

## HIGHSEC §6 — RBAC

No new permissions added. Reuses existing `ingestion.{view,run,delete}`. Verified by `RolePermissionSeederVerificationTest` (Plan 2 Task 11).

## HIGHSEC §7 — PHI Protection

| Concern | Mitigation |
|---|---|
| Patient profiles never exposed via templates routes | Routes do not return PERSON-shaped data; only run metadata. Verified by manual review of every controller method's return type. |
| Logs scrubbed of secrets | `structlog` processor in Plan 1 Task 4; tests assert no UMLS/internal-token strings appear in any log output |
| Error messages do not leak schema names or query plans | Plan 2 Task 5+ controllers wrap exceptions in user-safe messages |
| SynPUF is synthetic — no real PHI; Athena is non-PHI reference | Documented in respective READMEs (Tasks 13, 16) |

## Penetration Tests Simulated

1. **Missing internal token** → Python service returns 401, Laravel logs internal error, user sees 503. Verified `test_missing_internal_token_rejected` (Plan 1 Task 5).
2. **Malicious manifest tries to write outside its schema** → registry rejects via JSON Schema (paths must match `^[a-z][a-z0-9_]*\\.\\w+$`). Verified `test_path_traversal_rejected` (Plan 1 Task 26).
3. **PHI in parameter value** → registry redaction at insert; logs scrubbed. Verified `test_parameter_redaction_at_persist` (Plan 1 Task 26).
4. **Concurrent submission of singleton template** → `SELECT … FOR UPDATE` rejects second submitter with 409 Conflict. Verified `test_singleton_concurrent_rejected` (Plan 2 Task 11).
5. **Forged Sanctum token** → standard Sanctum middleware rejects; verified by existing Sanctum tests.

## Sign-off

- [ ] Platform engineer: _____________ date: _______
- [ ] ETL engineer: _____________ date: _______
- [ ] Security review (if required for Production): _____________ date: _______

Once all three boxes are signed, this document is committed to git as the security gate for Phase 0 release.
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/templates-phase-0-security.md
git commit -m "docs(devlog): add Phase 0 ingestion-templates security review"
```

---

## Task 18: Phase 0 DoD verification document

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-0-dod.md`

- [ ] **Step 1: Write the DoD verification document**

```markdown
# Phase 0 Definition of Done — Ingestion Templates

**Status:** _(set to APPROVED at sign-off)_
**Spec:** `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md` §9
**Reviewers:** _(fill in at sign-off — minimum 1 platform + 1 ETL engineer)_

For each spec §9 DoD bullet, attach evidence (test path, commit, screenshot, or manual verification step).

## Templates ship and run

- [ ] All 4 templates appear in the Aqueduct → Templates catalog.
  Evidence: Playwright E2E test `e2e/templates/submit-and-watch.spec.ts` (Plan 3 Task 16).

- [ ] `hello_cdm` runs end-to-end against clean Postgres in CI.
  Evidence: `templates/tests/e2e/test_hello_cdm.py` passes; CI run link: _(fill at sign-off)_

- [ ] `nodes_test` runs end-to-end and exercises all 8 node types in CI.
  Evidence: `templates/tests/e2e/test_nodes_test.py` passes; CI run link: _(fill at sign-off)_

- [ ] `load_athena_vocabulary` runs end-to-end against a real bundle in staging (user-initiated).
  Evidence: staging run-id _(fill)_, validation pack output committed at `docs/devlog/modules/ingestion/staging-runs/load_athena_vocabulary-<date>.md`

- [ ] `load_synpuf` runs end-to-end with `patient_count=1k` in staging (user-initiated).
  Evidence: staging run-id _(fill)_, validation pack output committed.

## Validation packs

- [ ] Each template has a validation pack at `templates/manifests/<id>/validation/`.
  Evidence: `ls templates/manifests/*/validation/` shows 4 directories, each with inputs/, expected/, dqd_checks.yaml, README.md.

## READMEs

- [ ] Each template has a `README.md` covering: what it does, when to use it, parameters, prerequisites, examples, limitations, license notes.
  Evidence: 4 README files at `templates/manifests/<id>/README.md` (Plan 4 Tasks 3, 7, 13, 16).

## Node SDK

- [ ] All 8 bootstrap nodes have unit tests with >90% line coverage.
  Evidence: `cd templates && uv run pytest --cov=runtime/nodes --cov-report=term-missing` shows ≥90%.

- [ ] `mypy --strict templates/runtime/` passes.
  Evidence: CI workflow output.

## ADRs

- [ ] `docs/adr/0001-node-sdk-design.md` committed and reflects final design.
  Evidence: file exists, last commit reviewed.

- [ ] `docs/adr/0002-orchestration-backend.md` committed.
  Evidence: file exists.

- [ ] `docs/adr/0003-template-manifest-format.md` committed.
  Evidence: file exists.

## CI integration

- [ ] Pre-commit hook validates manifests on every commit.
  Evidence: `scripts/githooks/pre-commit` includes `parthenon-templates validate-manifests` and `parthenon-templates lint-secret-keys`.

- [ ] CI fails when any committed manifest doesn't validate.
  Evidence: `.github/workflows/ci.yml` runs `validate-manifests` on every push; deliberately broken manifest in `manifests_invalid/` proves rejection.

## Aqueduct UI

- [ ] Aqueduct shows new sub-tabs (Mappings | Templates | Runs) behind feature flag.
  Evidence: `EtlToolsPage.tsx` refactored (Plan 3 Task 14); `app_settings.ingestion_templates_enabled` toggle works.

- [ ] Full happy path runs in Playwright with flag on.
  Evidence: `e2e/templates/submit-and-watch.spec.ts` passes.

## Catalog visibility

- [ ] Submitting a CDM-touching template creates an `app.ingestion_jobs` row visible on the Upload-tab dashboard with a deep-link.
  Evidence: `TemplateRunService::submit` creates IngestionJob row when `emits_cdm: true`; verified by `TemplateRunServiceTest::test_emits_ingestion_job_when_cdm_touched` (Plan 2 Task 11). UI deep-link verified by Playwright test in Plan 3 Task 16.

## Security

- [ ] HIGHSEC §8 review passes.
  Evidence: `docs/devlog/modules/ingestion/templates-phase-0-security.md` signed off.

## Performance

- [ ] `hello_cdm` runs in <30s on a Postgres 16 dev instance.
  Evidence: CI run timing for `test_hello_cdm`. Reference run id: _(fill)_

## Deploy integration

- [ ] `deploy.sh` knows about the new container.
  Evidence: `deploy.sh --templates-sync` flag works; full `./deploy.sh` triggers `php artisan templates:sync` after migrations (Plan 2 Task 21).

## Documentation

- [ ] Devlog written.
  Evidence: `docs/devlog/modules/ingestion/templates-phase-0.md` (Task 19 below).

- [ ] Operations runbook written.
  Evidence: `docs/devlog/modules/ingestion/templates-phase-0-runbook.md` (Task 20 below).

## Sign-off

- [ ] Platform engineer: ___________________  date: __________
- [ ] ETL engineer: ___________________  date: __________

When both signatures are present, set Status: APPROVED at the top of this file and commit. Phase 0 is shipped.
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/templates-phase-0-dod.md
git commit -m "docs(devlog): add Phase 0 ingestion-templates DoD verification doc"
```

---

## Task 19: Phase 0 devlog narrative

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-0.md`

- [ ] **Step 1: Write the devlog**

```markdown
# Ingestion Templates — Phase 0

**Milestone start:** 2026-05-02
**Milestone close:** _(fill at sign-off)_
**Specs:** `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`
**Plans:** Plan 1 (Foundations), Plan 2 (Laravel Integration), Plan 3 (Frontend), Plan 4 (Templates and Close-Out)
**ADRs:** [0001 Node SDK Design](../../../adr/0001-node-sdk-design.md), [0002 Orchestration Backend](../../../adr/0002-orchestration-backend.md), [0003 Template Manifest Format](../../../adr/0003-template-manifest-format.md)

## What we built

Strangler-fig integration of a D2E-style ingestion template engine into
Parthenon's existing Aqueduct tab. Phase 0 ships the foundation: a new
`parthenon-templates` Python service running FastAPI + Prefect, a node SDK
with 8 bootstrap nodes, an orchestration adapter, a YAML manifest registry,
and 4 trivial-but-real templates that prove the abstractions work.

The Aqueduct tab now hosts three sub-tabs: **Mappings** (the existing visual
canvas, untouched), **Templates** (new pre-baked dataflow catalog), and
**Runs** (unified run history). All behind the `ingestion.templates_enabled`
feature flag.

## Why

Parthenon prospects who've evaluated D2E expect a "New dataflow" UX where
they pick a template, fill parameters, and see it run end-to-end. We didn't
have that. Building 14 templates from scratch on a custom orchestrator
would have taken 12+ months. The strangler-fig approach lets us:

1. Lay the platform foundation in Phase 0 (this milestone).
2. Match D2E's parity templates (FHIR, DICOM, EQ-5D, MIMIC, etc.) in
   Phases 1-2.
3. Ship Parthenon-only differentiators (claims, registry, AI-mapping,
   LIS/LOINC) in Phase 3.

## Key decisions

See `2026-05-02-parthenon-ingestion-templates-phase-0-design.md` §3 for the
full Q1–Q7 decision log. Highlights:

- **Aqueduct hosts templates** (vs new top-level tab) — keeps Data Ingestion
  IA simple.
- **New Docker service** (vs extending `python-ai`) — clean blast radius.
- **`uv`** (vs `poetry`) — single lockfile, faster installs.
- **Polling, not webhooks** — simpler in Phase 0; revisit at scale.
- **Local Laravel storage** for artifacts — S3/GCS adapter deferred to Phase 1.
- **Reuse `ingestion.*` permissions** — no new RBAC sprawl.
- **`load_athena_vocabulary` and `load_synpuf` are user-initiated, not in CI** —
  per user correction during brainstorming.

## Surprises and trade-offs

- The `parthenon_app` runtime role has no DDL, but `hello_cdm` needs to
  bootstrap a CDM. Resolved by pulling a `parthenon_migrator` credential
  per-run from secrets, scope-limited to that one run. See ADR-0001
  resolution section.
- Prefect 3.x's UI is unused — we proxy run state through Laravel and our
  own RunInspector. Prefect is an implementation detail; users never see it.
- App-layer singleton enforcement (`SELECT … FOR UPDATE`) chosen over a
  partial unique index because the version-suffix workaround for
  non-singleton templates was uglier than just locking.

## Performance numbers (from staging)

| Template | Duration | Notes |
|---|---|---|
| `hello_cdm` | _(fill at sign-off)_ | Budget: <30s |
| `nodes_test` | _(fill)_ | Budget: <60s |
| `load_athena_vocabulary` (full bundle) | _(fill)_ | Budget: <30 min |
| `load_synpuf` (1K) | _(fill)_ | Budget: <20 min |
| `load_synpuf` (100K) | _(fill — only if validated)_ | Budget: <3 hours |

## What we explicitly did NOT do

- No FHIR/DICOM/SDTM/claims templates (Phase 1+).
- No AI-mapping integration into templates (existing MappingReview stays
  as-is).
- No S3/GCS storage adapter (local Laravel storage only).
- No mTLS between Laravel and Python (shared internal token).
- No webhooks (polling only).
- No new `templates.*` permission domain (reuses `ingestion.*`).
- No Aqueduct canvas changes.

These are explicit non-goals for Phase 0 — see spec §9.

## Next steps (Phase 1)

Per spec §10 migration intent, Phase 1 should:

1. Refactor `App\Services\Ingestion\CsvProfilerService` and `FhirParserService`
   behind a stable interface.
2. Replace implementations with calls into `parthenon-templates` (a
   `csv_profile` and `fhir_to_omop` template).
3. Preserve the existing Upload-tab UX — users see no change.
4. Migrate `IngestionJob` data shape to align with `template_runs`.
5. Introduce S3/GCS storage adapter.
6. Move to mTLS for Laravel↔Python.

Phase 1 also unlocks the FHIR / DICOM / EQ-5D templates (devplan T-010
through T-015) and the more ambitious format coverage that motivates the
whole devplan.

## Cross-references

- Spec: `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`
- Devplan: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md`
- Plans: `docs/superpowers/plans/2026-05-02-parthenon-ingestion-templates-phase-0-plan-{1,2,3,4}-*.md`
- Security review: `docs/devlog/modules/ingestion/templates-phase-0-security.md`
- DoD: `docs/devlog/modules/ingestion/templates-phase-0-dod.md`
- Runbook: `docs/devlog/modules/ingestion/templates-phase-0-runbook.md`
- ADRs: `docs/adr/000{1,2,3}-*.md`
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/templates-phase-0.md
git commit -m "docs(devlog): add Phase 0 ingestion-templates devlog narrative"
```

---

## Task 20: Operations runbook

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/devlog/modules/ingestion/templates-phase-0-runbook.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Phase 0 Ingestion Templates — Operations Runbook

Operational procedures for the `parthenon-templates` service and the four
Phase 0 templates.

## Service health

```bash
# Quick health check
curl -s http://parthenon-templates:8000/health
# Expected: {"status":"ok","prefect":"ready","registry":"ready"}

# Container status
docker compose ps parthenon-templates

# Tail logs
docker compose logs -f parthenon-templates
```

If health endpoint returns non-200, the service is degraded. Common causes:

- Prefect server failed to start → check container logs for "prefect server"
- Registry failed to load a manifest → check `parthenon-templates validate-manifests`
- Internal-token misconfigured → check `PARTHENON_INTERNAL_TOKEN` env var matches Laravel's

## Enabling the feature flag in production

```bash
# As super-admin, via the admin UI or:
docker compose exec -T php php artisan tinker --execute="
  \\App\\Models\\App\\AppSetting::set('ingestion.templates_enabled', true);
"
```

After flipping the flag:

1. The Aqueduct sub-tabs (Templates | Runs) appear for all users with
   `ingestion.view` permission.
2. The `/api/v1/ingestion/templates/*` routes return data instead of 404.
3. Run `./deploy.sh --templates-sync` to refresh the catalog cache (not
   strictly needed but ensures the latest manifests are visible).

## Rolling back

If a template misbehaves in production:

```bash
# Disable the feature flag — UI hides templates, but data persists
docker compose exec -T php php artisan tinker --execute="
  \\App\\Models\\App\\AppSetting::set('ingestion.templates_enabled', false);
"

# OR: cancel a specific run
curl -X DELETE https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/<id> \\
  -H "Authorization: Bearer ${TOKEN}"
```

The feature flag does NOT delete `template_runs` rows — they remain for
audit. Re-enabling the flag restores the UI immediately.

## Running `load_athena_vocabulary` in staging

This is the heaviest Phase 0 template. Run during a maintenance window.

```bash
# 1. Stage the bundle (download from athena.ohdsi.org, extract)
ssh parthenon-staging
cd /var/parthenon/staging
mkdir athena_bundle_$(date +%Y_q%q)
tar -xzf ~/Downloads/athena_bundle.tar.gz -C athena_bundle_$(date +%Y_q%q)

# 2. Confirm UMLS_API_KEY is set on the parthenon-templates container
docker compose exec parthenon-templates printenv UMLS_API_KEY | head -c 5
# Expected: first 5 chars of the key (NOT empty)

# 3. Submit the run
TOKEN=$(login as superadmin and capture token)
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "version": "0.1.0",
    "parameters": {
      "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
      "target_vocab_schema": "vocab",
      "force": false,
      "enable_cpt4": true
    }
  }'
# Capture the template_run_id from the response

# 4. Watch the run via UI: https://parthenon-staging.acumenus.net/ingestion?tab=aqueduct&subtab=runs

# 5. After completion, verify post-conditions
cd /home/smudoshi/Github/Parthenon/templates
uv run python tests/staging/validate_pack.py manifests/load_athena_vocabulary

# 6. Commit the staging run output to the devlog
echo "Run ID: $TEMPLATE_RUN_ID, Date: $(date), Duration: ..." \\
  > docs/devlog/modules/ingestion/staging-runs/load_athena_vocabulary-$(date +%Y-%m-%d).md
```

## Running `load_synpuf` in staging

Pre-condition: `load_athena_vocabulary` has completed.

```bash
TOKEN=$(login as superadmin)
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf",
      "patient_count": "1k",
      "force": false,
      "vocab_schema": "vocab"
    }
  }'
```

## On-call procedures

### "Where do I see failed runs?"

```bash
# Via UI:
# Aqueduct → Runs sub-tab → filter status = "failed"

# Via SQL:
docker compose exec -T postgres psql -U parthenon -d parthenon \\
  -c "SELECT id, template_id, status, error_message, submitted_at
      FROM app.template_runs
      WHERE status = 'failed'
      ORDER BY submitted_at DESC
      LIMIT 10;"
```

### "How do I retry a failed run?"

```bash
# Via UI: open the run inspector, click "Retry" — creates a new run with
# the same parameters.

# Via API:
RUN_ID=<failed_run_id>
PARAMS=$(curl -s https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/${RUN_ID} \\
  -H "Authorization: Bearer ${TOKEN}" | jq '.parameters')
TEMPLATE_ID=$(curl -s ... | jq -r '.template_id')
curl -X POST .../templates/${TEMPLATE_ID}/runs -d "{ \"version\": \"0.1.0\", \"parameters\": $PARAMS }"
```

### "Polling job is stuck — runs never reach terminal"

```bash
# Check Horizon dashboard for PollTemplateRunJob failures
# https://parthenon.acumenus.net/horizon (super-admin only)

# Manually re-dispatch the polling job for a specific run
docker compose exec -T php php artisan tinker --execute="
  \\App\\Jobs\\Templates\\PollTemplateRunJob::dispatch(<run_id>);
"
```

### "Internal token rotation"

```bash
# 1. Generate new token
NEW_TOKEN=$(openssl rand -base64 32)

# 2. Update both Laravel and parthenon-templates env vars (via secrets manager)
# 3. Restart both containers (docker compose restart does NOT pick up env_file changes —
#    must docker compose up -d):
docker compose up -d php parthenon-templates

# 4. Confirm:
curl http://parthenon-templates:8000/health  # should return ok
```

## Useful queries

```sql
-- Top 10 most-run templates
SELECT template_id, COUNT(*) AS runs
FROM app.template_runs
WHERE submitted_at > NOW() - INTERVAL '30 days'
GROUP BY template_id
ORDER BY runs DESC
LIMIT 10;

-- Failed runs in last 7 days with error messages
SELECT id, template_id, error_message, submitted_at
FROM app.template_runs
WHERE status = 'failed' AND submitted_at > NOW() - INTERVAL '7 days'
ORDER BY submitted_at DESC;

-- Average duration per template
SELECT template_id,
       AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) AS avg_seconds
FROM app.template_runs
WHERE status = 'completed' AND started_at IS NOT NULL
GROUP BY template_id;

-- Linked IngestionJob for a template_run
SELECT tr.id AS template_run_id, ij.id AS ingestion_job_id, ij.kind, ij.status
FROM app.template_runs tr
LEFT JOIN app.ingestion_jobs ij ON ij.template_run_id = tr.id
WHERE tr.id = <run_id>;
```
```

- [ ] **Step 2: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/templates-phase-0-runbook.md
git commit -m "docs(devlog): add Phase 0 ingestion-templates ops runbook"
```

---

## Task 21: ADR review verification

**Files:**
- Verify: `/home/smudoshi/Github/Parthenon/docs/adr/0001-node-sdk-design.md`
- Verify: `/home/smudoshi/Github/Parthenon/docs/adr/0002-orchestration-backend.md`
- Verify: `/home/smudoshi/Github/Parthenon/docs/adr/0003-template-manifest-format.md`

- [ ] **Step 1: Read each ADR and verify against the implementation**

For each ADR, confirm:

- [ ] ADR-0001 (Node SDK Design): documents Polars vs Pandas decision, Pandera vs Patito, subprocess vs in-process. Implementation in `templates/runtime/nodes/` matches the recorded decision.
- [ ] ADR-0002 (Orchestration Backend): documents Prefect vs Temporal vs Dagster, why Prefect default, swap path. Implementation in `templates/runtime/orchestration/` matches.
- [ ] ADR-0003 (Template Manifest Format): documents YAML schema choices, versioning policy, third-party signing posture (deferred). Schema in `templates/runtime/registry/schema/template.v1.json` matches.

- [ ] **Step 2: If any ADR is out of sync with implementation, fix the ADR (not the code) and commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/000*.md
git commit -m "docs(adr): align Phase 0 ADRs with shipped implementation"
```

If all ADRs are in sync, no commit needed — proceed to Task 22.

---

## Task 22: Phase 0 final integration and sign-off

- [ ] **Step 1: Enable feature flag in staging**

```bash
ssh parthenon-staging
cd /opt/parthenon
docker compose exec -T php php artisan tinker --execute="
  \\App\\Models\\App\\AppSetting::set('ingestion.templates_enabled', true);
"
```

- [ ] **Step 2: Run all 4 validation packs in staging**

```bash
# hello_cdm + nodes_test were already validated in CI; re-run in staging for sign-off
cd /opt/parthenon/templates
uv run pytest tests/e2e/test_hello_cdm.py tests/e2e/test_nodes_test.py -v

# load_athena_vocabulary — see runbook Task 20
# Capture run-id, duration, validate pack output

# load_synpuf 1K — see runbook Task 20
# Capture run-id, duration, validate pack output
```

- [ ] **Step 3: Update DoD checklist with evidence**

Edit `docs/devlog/modules/ingestion/templates-phase-0-dod.md`:

- Fill in CI run links for hello_cdm and nodes_test.
- Fill in staging run-ids for load_athena_vocabulary and load_synpuf.
- Fill in performance numbers in `templates-phase-0.md`.

- [ ] **Step 4: Get sign-off**

Both reviewers initial and date the DoD checklist. Set Status: APPROVED at the top of `templates-phase-0-dod.md`.

- [ ] **Step 5: Final commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/devlog/modules/ingestion/
git commit -m "chore(templates): Phase 0 sign-off — feature flag enabled in staging

All 4 templates validated. DoD checklist signed by platform engineer and
ETL engineer. Phase 0 milestone closed. See:
- docs/devlog/modules/ingestion/templates-phase-0.md
- docs/devlog/modules/ingestion/templates-phase-0-dod.md
- docs/devlog/modules/ingestion/templates-phase-0-security.md
- docs/devlog/modules/ingestion/templates-phase-0-runbook.md

Phase 1 ready to start when prioritized."
```

- [ ] **Step 6: Enable feature flag in production**

After staging sign-off and any production-readiness review:

```bash
ssh parthenon-prod
cd /opt/parthenon
docker compose exec -T php php artisan tinker --execute="
  \\App\\Models\\App\\AppSetting::set('ingestion.templates_enabled', true);
"

# Verify
curl -s https://parthenon.acumenus.net/api/v1/ingestion/templates \
  -H "Authorization: Bearer ${TOKEN}" | jq '. | length'
# Expected: 4
```

- [ ] **Step 7: Announce internally**

Post in `#parthenon-eng`:

> Phase 0 ingestion templates are live in production behind the
> `ingestion.templates_enabled` flag. Aqueduct → Templates sub-tab.
> 4 templates available: `hello_cdm`, `nodes_test`, `load_athena_vocabulary`,
> `load_synpuf`. Devlog: docs/devlog/modules/ingestion/templates-phase-0.md.
> Phase 1 (FHIR/DICOM/EQ-5D) starts next sprint.

Phase 0 is shipped.
