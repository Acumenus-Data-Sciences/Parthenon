# ADR 0001: Node SDK Design

## Status

Accepted — 2026-05-02. Supersedes none.

## Context

Phase 0 of the Parthenon ingestion-templates milestone (devplan T-001) needs a
small, opinionated SDK so that template authors can compose ETL pipelines from
reusable building blocks. We must:

* Run trivially in tests (no Prefect required for unit tests).
* Permit mixed runtimes: native Python, SQL via SQLAlchemy, R via Rscript shell-out.
* Support both inline-code nodes (`python`, `py2table`) and declarative nodes
  (`csv_reader`, `db_reader`, `db_writer`, `generic_file`, `sql`).
* Provide a stable interface that the orchestration adapter (T-002) can target
  without leaking Prefect-specific concepts upstream.

The MADR options considered:

1. **Direct Prefect tasks.** Authors write `@task`-decorated functions and we
   load them via Prefect's deployment API. Rejected: couples authors to Prefect
   and makes Temporal/Dagster/Airflow swaps invasive.
2. **Custom DSL.** Define a YAML-only language with built-in operators.
   Rejected: every new node type requires a parser change; debugging is hard.
3. **ABC-based SDK with a small set of bootstrap nodes.** Chosen.

## Decision

Define a `Node` ABC in `runtime/nodes/base.py` with one abstract method:

```python
class Node(ABC):
    type_name: str  # class attribute referenced from manifests

    @abstractmethod
    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult: ...
```

A `NodeContext` provides:

* `run_id`, `node_id` for correlation,
* a `logger`,
* a `secrets` dict (`get_secret(key)` raises `KeyError` on miss),
* an `artifact_dir` with a path-traversal-guarded `write_artifact` helper,
* an optional SQLAlchemy `db_dsn`.

A `NodeResult` is a frozen dataclass: `status` (`NodeStatus` enum), `outputs`
(dict), `artifacts` (list of `NodeArtifact`), and an optional `error_message`.

Eight bootstrap node types ship with Phase 0:

| `type_name`     | Class             | Purpose                                  |
|-----------------|-------------------|------------------------------------------|
| `python`        | `PythonNode`      | Inline `main(context, params) -> dict`   |
| `sql`           | `SqlNode`         | Multi-statement SQL via SQLAlchemy       |
| `csv_reader`    | `CsvReaderNode`   | CSV → Polars → Parquet artifact          |
| `db_reader`     | `DbReaderNode`    | SELECT → Polars → Parquet artifact       |
| `db_writer`     | `DbWriterNode`    | Parquet → SQL with `append`/`truncate`   |
| `py2table`      | `Py2TableNode`    | Inline Python that returns a DataFrame   |
| `generic_file`  | `GenericFileNode` | http/https/file:// fetch with sha256     |
| `r`             | `RNode`           | Rscript shell-out, captures stdout/stderr|

Schema validation lives in `runtime/schemas.py`:

* `define_dataframe_model(...)` returns a Pandera (Polars dialect) schema.
* `validate_frame(frame, schema)` raises `SchemaValidationError`.
* `ParameterModel` is the Pydantic base for node-parameter models
  (`extra="forbid"` to surface typos).

A `parthenon-nodes` Typer CLI in `runtime/runner.py` runs a single node locally
for dev/debug parity. Its result is JSON on stdout.

## Consequences

* Authors learn one ABC and one parameter contract per node.
* Tests target the SDK directly without booting Prefect — fast, deterministic.
* The orchestration adapter (ADR 0002) wraps `Node.run` in a single Prefect
  task; swapping engines amounts to writing a new adapter.
* Inline-code nodes (`python`, `py2table`) carry the usual `exec()` risk; we
  mitigate by running templates only as the `templates` non-root container user
  and by manifest review (CI lint) — see ADR 0003.
* `RNode` requires `Rscript` on PATH; tests skip when absent. We do **not**
  bundle R into the Python container in Phase 0 — a sidecar pattern is left to
  Phase 1.

## Alternatives considered (declined)

* Direct Prefect tasks — see Context.
* Custom DSL — see Context.
* Single mega-node with parameter dispatch — rejected because it muddies typing
  and forces every node's parameters into one Pydantic union.

## References

* Spec §5 (Components — Python service rows).
* Devplan T-001.
