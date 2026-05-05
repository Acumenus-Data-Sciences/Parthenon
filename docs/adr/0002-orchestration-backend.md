# ADR 0002: Orchestration Backend

## Status

Accepted — 2026-05-02.

## Context

Templates declare a DAG of nodes; something must execute that DAG with retry,
logging, and artifact handling. The candidate engines:

| Engine   | Pros                                                | Cons                                            |
|----------|-----------------------------------------------------|-------------------------------------------------|
| Prefect 3| Pythonic, ephemeral mode, in-process server         | API churn between minor versions                |
| Temporal | Strong durability, long-running workflows           | Heavier ops, separate Temporal server cluster   |
| Dagster  | Asset-oriented, good UI                             | Larger surface area, asset model is opinionated |
| Airflow  | Ubiquitous in healthcare data orgs                  | DAG-Python coupling, scheduler ops              |

Phase 0 needs one engine that runs in a single container with no external
state, plus a hard interface so we can swap later.

## Decision

* Define `OrchestrationBackend` ABC in `runtime/orchestration/interface.py`
  with `submit / get_status / get_logs / cancel / list_artifacts`.
* `FlowSpec` (`flow_id`, `nodes: list[FlowNode]`, `parameters`) is the
  serializable graph passed to `submit`. `FlowSpec.validate()` rejects
  cycles and unknown dependencies.
* Default backend: `PrefectBackend` (Prefect 3.x), each `FlowNode` becomes
  one `@task`, dependencies wired via `wait_for=`. The Phase 0 implementation
  runs flows in a background thread on the Prefect ephemeral API — no external
  Prefect server is required at submit time.
* Three stubs (`TemporalBackend`, `DagsterBackend`, `AirflowBackend`) raise
  `NotImplementedError` to prove the interface seam.
* Selection by env var `PARTHENON_ORCHESTRATION_BACKEND` with
  default `prefect` (factory in `runtime/orchestration/factory.py`).
* Storage adapter `LocalFilesystemStorage` writes artifacts under
  `{PARTHENON_STORAGE_ROOT}/{run_id}/{node_id}/{artifact_name}`. S3/GCS
  adapter deferred to Phase 1.

## Consequences

* Tests can use the real `PrefectBackend` end-to-end without a Prefect server.
* Replacing Prefect (e.g., when Temporal becomes the platform standard) means
  implementing one new `OrchestrationBackend` subclass — no changes to nodes,
  manifests, or the API layer.
* Prefect version churn is contained inside one file.
* Run state is in-memory in the Phase 0 backend. Process restart loses runs;
  acceptable because Laravel persists run metadata in `app.template_runs`
  (Plan 2). The migration path to a durable Prefect server is documented in
  this ADR's Phase 1 follow-up.

## Alternatives considered (declined)

* Roll-our-own scheduler with `asyncio` only — too much surface area.
* Prefect Cloud (SaaS) — declined for Phase 0 because PHI-bearing deployments
  need full on-prem control.
* Sidecar Prefect server container — deferred until scaling justifies the
  resource budget.

## References

* Spec §4 (Implementation choices folded in).
* Devplan T-002.
* ADR 0001 (Node SDK).
