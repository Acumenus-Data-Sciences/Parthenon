# Parthenon Ingestion Templates — Phase 0 Design

**Date:** 2026-05-02
**Status:** Draft — pending user review
**Scope:** Phase 0 of `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` (devplan T-001 through T-009)
**Owners:** Platform engineer + 1 ETL engineer (per devplan §4)

---

## 1. Context

The devplan calls for D2E-style ingestion templates: 14 parity templates plus 4 Parthenon-only differentiators, on top of three new platform abstractions (node SDK, orchestration adapter, template registry). This spec covers **Phase 0 only** — the foundation work and the four trivial templates (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`) — and how it integrates with Parthenon's existing Data Ingestion page.

Parthenon's existing ingestion is Laravel-native: `App\Services\Ingestion\*` (CSV profiler, FHIR parser, staging, CDM writer, post-load validation, AI-driven concept mapping) driven by Horizon jobs. The Data Ingestion page (`frontend/src/features/ingestion/pages/DataIngestionPage.tsx`) has 5 tabs: Upload, Profiler, **Aqueduct**, Poseidon, Vulcan/FHIR. Aqueduct is currently a visual mapping canvas (`AqueductCanvas.tsx` / `EtlProject` / `EtlTableMapping`).

## 2. Decision summary

Phase 0 ships **strangler-fig integration with templates hosted inside Aqueduct**:

1. Aqueduct expands from a visual-canvas surface to "the home for ETL pipelines" — both pre-baked templates and custom canvas mappings.
2. A new `parthenon-templates` Docker service (Python + FastAPI + Prefect-in-container) runs the node SDK + orchestration adapter + manifest registry.
3. Phase 0 is purely additive — zero changes to existing Laravel ingestion code, services, or jobs. The migration intent for Phase 1+ (Laravel CSV/FHIR ingestion eventually runs on the node SDK) is recorded in this spec, not implemented.
4. New `app.template_runs` table is the catalog of record. CDM-touching templates also emit an `app.ingestion_jobs` row so the unified Upload-tab dashboard shows everything.
5. New top-level `templates/` directory holds runtime code, manifests, and tests in one place.
6. New API endpoints under `/api/v1/ingestion/templates/*`, reusing existing `permission:ingestion.{view,run,delete}` middleware.

## 3. Decisions log (Q1–Q7, with declined options)

| # | Question | Chosen | Declined |
|---|---|---|---|
| 1 | Scope of this spec | Phase 0 only (T-001 → T-009) | All four phases (too large for one spec); integration shape only (under-scoped) |
| 2 | Phase 0's relationship to existing Laravel ingestion | Additive + migration-intent recorded in spec | Purely additive with no recorded intent; start the migration in Phase 0 |
| 3 | Where templates live in the Data Ingestion page | Inside Aqueduct (sub-tabs: Mappings / Templates / Runs) | New 6th top-level tab; under Upload; new top-level nav item |
| 4 | Backend runtime placement | New Docker service `parthenon-templates` | Extend `python-ai`; Prefect Cloud SaaS; Acropolis-resident |
| 5 | Data model for "a run" | New `app.template_runs` table + opt-in `app.ingestion_jobs` row when CDM is touched | `EtlProject` subtype; `IngestionJob` subtype with no separate table; mandatory parallel rows in both tables |
| 6 | Repo layout | Single new top-level `templates/` directory | Devplan three-package split (`packages/`); under `ai/`; split `services/templates/` + `templates/` |
| 7 | Auth and permissions | Reuse existing `ingestion.*` permissions; URL prefix `/api/v1/ingestion/templates/*` | New `templates.*` permission domain; hybrid (`ingestion.view` + `templates.run`) |

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend — Aqueduct tab (frontend/src/features/etl/)           │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │ AqueductCanvas      │  │ AqueductTemplates  (NEW)         │  │
│  │ (existing visual    │  │ - Catalog list                   │  │
│  │  mapping canvas)    │  │ - Parameter form (rjsf)          │  │
│  └─────────────────────┘  │ - Run inspector (DAG + logs)     │  │
│                           └──────────────────────────────────┘  │
│  Sub-tab toggle: "Mappings" | "Templates" | "Runs"              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ existing TanStack Query hooks
┌──────────────────────▼──────────────────────────────────────────┐
│  Laravel API (backend/) — proxy + catalog                       │
│  - TemplatesController @ /api/v1/ingestion/templates/*          │
│  - Sanctum auth, permission:ingestion.{view,run,delete}         │
│  - Persists template_runs row (and IngestionJob row if CDM)     │
│  - Forwards run submit/status to Python via internal HTTP        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP over docker network
┌──────────────────────▼──────────────────────────────────────────┐
│  parthenon-templates service (NEW Docker container)             │
│  templates/                                                     │
│  ├── runtime/        — FastAPI + Prefect server (in-process)    │
│  │   ├── api.py      — submit, status, logs, artifacts          │
│  │   ├── nodes/      — Node SDK (T-001): R/Python/Sql/Csv/Db…   │
│  │   ├── orchestration/  — Prefect adapter (T-002)              │
│  │   └── registry/   — manifest loader + materializer (T-003)   │
│  ├── manifests/      — YAML manifests, one dir per template     │
│  │   ├── _shared/                                                │
│  │   ├── hello_cdm/                                              │
│  │   ├── nodes_test/                                             │
│  │   ├── load_athena_vocabulary/                                 │
│  │   └── load_synpuf/                                            │
│  ├── tests/          — unit + integration + e2e                 │
│  └── Dockerfile                                                  │
└─────────────────────────────────────────────────────────────────┘
                       │ pg connection
┌──────────────────────▼──────────────────────────────────────────┐
│  PostgreSQL (existing parthenon DB)                             │
│  - app.template_runs            (NEW)                           │
│  - app.ingestion_jobs           (existing — opt-in row + 2 cols)│
│  - vocab.* / omop.* / synpuf.*  (templates write here)          │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation choices folded in

- **Prefect server lives inside the same container** as the FastAPI app in Phase 0 (process supervisor: `tini` + `honcho`). Sidecar split deferred to Phase 1 when scaling justifies it.
- **Python tooling: `uv`** — faster than poetry, single lockfile, fewer corner cases for a brand-new package.
- **Storage: Laravel `storage/app/templates/{run_id}/*`** in Phase 0. The S3/GCS adapter is deferred to Phase 1; the Python container writes via a mounted volume that the Laravel container also reads.
- **Network:** Python service is **not** exposed via Nginx — only Laravel can reach it. The container binds to the internal docker network only.
- **Frontend lazy-loads** the new `AqueductTemplates` component, matching the existing `DataIngestionPage.tsx` pattern.

## 5. Components

### Frontend — `frontend/src/features/etl/`

| Component | Purpose | Notes |
|---|---|---|
| `EtlToolsPage.tsx` *(existing)* | Aqueduct tab shell | Refactor to host a sub-tab strip: `Mappings \| Templates \| Runs` |
| `components/aqueduct/AqueductCanvas.tsx` *(existing)* | Visual mapping canvas | Untouched in Phase 0 |
| `pages/AqueductTemplatesPage.tsx` *(new)* | Template catalog + parameter form + submit | Lazy-loaded; uses TanStack Query |
| `pages/AqueductRunsPage.tsx` *(new)* | Unified run history (templates first; canvas runs added later) | Lazy-loaded |
| `components/aqueduct/templates/TemplateCard.tsx` *(new)* | Catalog tile | Crimson `#9B1B30` accent |
| `components/aqueduct/templates/ParameterForm.tsx` *(new)* | JSON Schema → form | Use `@rjsf/core` |
| `components/aqueduct/templates/RunInspector.tsx` *(new)* | DAG, per-node logs, artifact list, status badge | Reuses `PipelineStepper`, `ConfidenceBadge`, `ValidationReport` from `features/ingestion/components/` |
| `api/templates.ts` *(new)* | TanStack Query hooks | `useTemplates()`, `useTemplate(id)`, `useSubmitTemplateRun()`, `useTemplateRun(id)`, `useTemplateRunLogs(id)` |
| `types/templates.ts` *(new)* | TS types | Generated from OpenAPI via existing `deploy.sh --openapi` |

### Backend — `backend/app/`

| Component | Purpose | Notes |
|---|---|---|
| `Http/Controllers/Api/V1/TemplatesController.php` *(new)* | Proxy + catalog endpoints | All 6 endpoints (list, show, submit run, get run, get logs, get artifacts) |
| `Services/Templates/TemplateRegistryClient.php` *(new)* | HTTP client for the Python service | Guzzle, internal-only base URL from `config/services.php` |
| `Services/Templates/TemplateRunService.php` *(new)* | Orchestrates: persist `template_runs`, opt-in `IngestionJob`, call Python, update on poll | |
| `Models/App/TemplateRun.php` *(new)* | Eloquent model | `$fillable` (HIGHSEC §3.1) |
| `Http/Requests/SubmitTemplateRunRequest.php` *(new)* | Form Request validation | Validates `template_id`, `version`, `parameters` against the manifest's JSON Schema (fetched server-side) |
| `Jobs/Templates/PollTemplateRunJob.php` *(new)* | Polls Python for run status, writes back to DB | Horizon queue; idempotent; backoff; auto-stops on terminal state |
| `Console/Commands/Templates/SyncCatalogCommand.php` *(new)* | Pulls manifest catalog from Python on deploy | `php artisan templates:sync` — runs in `deploy.sh` |

### Python service — `templates/`

| Path | Purpose |
|---|---|
| `runtime/api.py` | FastAPI app: `GET /templates`, `GET /templates/{id}`, `POST /runs`, `GET /runs/{id}`, `GET /runs/{id}/logs`, `GET /runs/{id}/artifacts` |
| `runtime/nodes/base.py` | `Node` ABC + `NodeContext` (logger, secrets, db, artifact writer) — devplan T-001 |
| `runtime/nodes/{r_node,python_node,sql_node,csv_reader,db_reader,db_writer,py2table,generic_file}.py` | 8 bootstrap nodes — devplan T-001 |
| `runtime/orchestration/interface.py` | `OrchestrationBackend` ABC — devplan T-002 |
| `runtime/orchestration/prefect_backend.py` | Prefect 3.x adapter (default) |
| `runtime/orchestration/{temporal,dagster,airflow}_backend.py` | Stub (NotImplementedError) — proves interface |
| `runtime/registry/manifest.py` | Pydantic model + JSON Schema + loader — devplan T-003 |
| `runtime/registry/materializer.py` | manifest + params → `FlowSpec` |
| `runtime/cdm/` | Wrapper around `pyomop` for v5.3/v5.4 bootstrap — devplan T-005 |
| `manifests/_shared/` | Reusable sub-graphs |
| `manifests/{hello_cdm,nodes_test,load_athena_vocabulary,load_synpuf}/manifest.yaml` | Phase 0 templates |
| `manifests/{…}/validation/` | Validation pack per template (devplan §6.4) |
| `manifests/{…}/README.md` | Per-template docs (devplan §7) |
| `tests/{unit,integration,e2e}/` | Test pyramid |
| `pyproject.toml` | `uv` workspace config |
| `Dockerfile` | Non-root user (HIGHSEC §4.1) |

### Database — `database/migrations/`

| Migration | Purpose |
|---|---|
| `YYYY_MM_DD_create_template_runs_table.php` *(new)* | New `app.template_runs` table |
| `YYYY_MM_DD_add_template_run_id_to_ingestion_jobs.php` *(new)* | Nullable FK + `kind` column on `app.ingestion_jobs` |

### Docker — `docker-compose.yml` + `docker/templates/`

| Path | Purpose |
|---|---|
| `docker-compose.yml` *(edit)* | Add `parthenon-templates` service; bind storage volume; internal-network only |
| `docker/templates/Dockerfile` *(new)* | Python 3.12, `uv`, non-root user, `tini` + `honcho` for FastAPI + Prefect server |
| `docker/templates/honcho.cfg` *(new)* | `web: uvicorn …` + `prefect: prefect server start` |

**Total:** 7 frontend additions, 7 backend additions, 1 Python service tree, 2 migrations, 1 compose edit, 2 Docker files. **No edits to existing ingestion code, `AqueductCanvas`, or any existing model.**

## 6. Data flow

### Happy path: user runs `load_synpuf`

```
1. CATALOG LOAD (on app boot or refresh)
   Browser → GET /api/v1/ingestion/templates
   Laravel TemplatesController → TemplateRegistryClient
                              → GET parthenon-templates:8000/templates
   Python returns: [{id, name, version, category, tags, cdm_versions}, …]
   Laravel returns same payload to browser. Cached 60s in TanStack Query.

2. PARAMETER FORM
   User clicks "load_synpuf" tile.
   Browser → GET /api/v1/ingestion/templates/load_synpuf
   Laravel → Python: GET /templates/load_synpuf
   Python returns: full manifest including JSON Schema for parameters.
   Browser renders @rjsf/core form: target_schema (default "synpuf"), patient_count (1k|100k).

3. SUBMIT
   User fills form, clicks Run.
   Browser → POST /api/v1/ingestion/templates/load_synpuf/runs
            body: { version: "0.1.0", parameters: { target_schema: "synpuf", patient_count: "1k" } }

   Laravel TemplatesController:
     a. SubmitTemplateRunRequest validates JSON shape.
     b. permission:ingestion.run middleware checks RBAC.
     c. TemplateRunService:
        - SELECT … FOR UPDATE on existing non-terminal runs of same template/version
          (singleton enforcement at app layer for templates that declare singleton: true)
        - inserts app.template_runs row (status: pending)
        - inserts app.ingestion_jobs row (kind: template, status: pending,
          template_run_id: <fk>) — because load_synpuf touches CDM
        - calls Python: POST /runs { template_id, version, parameters,
                                     correlation_id: template_run_id }
        - Python validates parameters against manifest JSON Schema (layer 2)
        - Python creates Prefect deployment + run, returns prefect_run_id
        - Laravel writes prefect_run_id back to template_runs row, status: queued
        - Laravel dispatches PollTemplateRunJob to Horizon (delay: 2s)
     d. Returns 201 with template_run_id and ingestion_job_id.

4. EXECUTION (in parthenon-templates container)
   Prefect orchestrator:
     - Resolves manifest's nodes into Prefect tasks
     - For load_synpuf: GenericFileNode (fetch SynPUF .csv) → DbWriterNode
       (load to synpuf schema) → SqlNode (Achilles summary)
     - Each node logs to structured JSON (structlog), emits OTel spans
     - Artifacts written to /var/parthenon/storage/templates/{run_id}/*
       (volume shared with Laravel container, read-only on Laravel side)
     - Post-conditions run: row_count(person) >= 1000, dqd_check(yob_range)

5. POLLING (every 2s, exponential backoff to 30s)
   PollTemplateRunJob → GET parthenon-templates:8000/runs/{prefect_run_id}
   Python returns: { status: "running"|"completed"|"failed", current_node,
                     progress: 0.0–1.0, post_conditions: [...], error?: "..." }
   Laravel updates template_runs.status, .progress, .current_node.
   If status terminal (completed/failed/cancelled):
     - Laravel updates ingestion_jobs.status to match
     - Job exits (no re-dispatch)
   Otherwise re-dispatches itself with backoff.

6. UI POLLING
   RunInspector mounts → useTemplateRun(id) polls /runs/{id} every 2s
   while !terminal. On terminal, query stops; logs+artifacts loaded once.
   Logs: GET /api/v1/ingestion/templates/runs/{id}/logs — Laravel proxies
         GET parthenon-templates:8000/runs/{prefect_run_id}/logs.
   Artifacts: same pattern; URLs returned are signed URLs into Laravel's
              storage/ (existing artifact-serving middleware).

7. DASHBOARD VISIBILITY
   IngestionDashboardPage (Upload tab) shows the ingestion_jobs row with
   kind="template" and a link "View template run →" that deep-links into
   Aqueduct's Runs sub-tab + RunInspector for that template_run_id.
```

### Authentication chain

- **Browser → Laravel:** Sanctum bearer token (existing).
- **Laravel → Python:** internal docker network only. Laravel adds an `X-Parthenon-Internal-Token` header (shared secret in env var, rotatable). Python middleware rejects requests missing/invalid token. mTLS deferred to Phase 1.
- **Python → Postgres:** runtime `parthenon_app` role (existing). Templates that need DDL (e.g., `hello_cdm` bootstrap) call out via the `parthenon_migrator` role, credential pulled from secrets at run start, scope-limited to that run. Per `project_parthenon_pg_roles.md`: app role has no DDL.
- **Python → external (Athena, OHDSI FTP):** outbound only.

### Failure paths

| Failure | Detection | Recovery |
|---|---|---|
| Python service down at submit time | Laravel HTTP timeout (5s) | Roll back the `template_runs` insert (single transaction); 503 to user |
| Python crashes mid-run | Poll returns 502, or run stays in `running` past `max_runtime_minutes` | Mark `failed`, capture last logs; manual retry only |
| Postgres failure mid-run | Prefect node fails | Whole run marked failed; SynPUF/Athena loads are idempotent re-runnable |
| Browser disconnect | None — runs continue server-side | User refreshes RunInspector, polling resumes |
| Concurrent runs of same template | Allowed unless manifest declares `singleton: true` | App-layer `SELECT … FOR UPDATE` on submit |
| User cancels | DELETE /api/v1/ingestion/templates/runs/{id} | Laravel calls Python `cancel(run_id)`; Prefect interrupts; status → `cancelled` |

### Observability

- Every Laravel call emits a structured log line with `template_run_id` correlation.
- Python service emits OTel spans (devplan §5.2) — exporter target is Loki/Grafana in Acropolis if available, else stderr in Phase 0.
- `template_runs` table is the catalog-of-record.

## 7. Database schema

### `app.template_runs` (new)

```sql
CREATE TABLE app.template_runs (
    id              BIGSERIAL PRIMARY KEY,
    template_id     VARCHAR(128) NOT NULL,        -- manifest metadata.id
    template_version VARCHAR(32) NOT NULL,        -- semver from manifest metadata.version
    parameters      JSONB NOT NULL,               -- exact submitted params, post-validation, secret keys redacted
    status          VARCHAR(32) NOT NULL
                    CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
    progress        REAL NOT NULL DEFAULT 0.0
                    CHECK (progress >= 0 AND progress <= 1),
    current_node    VARCHAR(128),
    prefect_run_id  UUID,
    error_message   TEXT,
    post_conditions JSONB,                        -- [{kind, status, detail}, …]
    artifacts_path  TEXT,                         -- relative to storage/app/templates/
    submitted_by    BIGINT NOT NULL REFERENCES app.users(id),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    correlation_id  UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_runs_template_id   ON app.template_runs (template_id);
CREATE INDEX idx_template_runs_status        ON app.template_runs (status);
CREATE INDEX idx_template_runs_submitted_by  ON app.template_runs (submitted_by);
CREATE INDEX idx_template_runs_submitted_at  ON app.template_runs (submitted_at DESC);
```

**Singleton enforcement** is handled at the application layer in `TemplateRunService::submit()` via `SELECT … FOR UPDATE` on non-terminal runs of the same `(template_id, template_version)` when the manifest declares `singleton: true`. No partial unique index — rejected to avoid the version-suffix workaround.

**Secret redaction** is enforced at the Python registry layer before insert. Manifests must declare per-parameter `secret: true` for sensitive fields; CI lint fails if a manifest declares a parameter named `*_key`/`*_token`/`*_password` without marking it `secret: true`.

### `app.ingestion_jobs` (existing — additions)

```sql
ALTER TABLE app.ingestion_jobs
    ADD COLUMN template_run_id BIGINT NULL
        REFERENCES app.template_runs(id) ON DELETE SET NULL,
    ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'upload'
        CHECK (kind IN ('upload','fhir','template'));

CREATE INDEX idx_ingestion_jobs_kind            ON app.ingestion_jobs (kind);
CREATE INDEX idx_ingestion_jobs_template_run_id ON app.ingestion_jobs (template_run_id);
```

`kind` defaults to `upload`; existing rows get the right value automatically.

### Migrations

Both migrations land in `database/migrations/` and run via `./deploy.sh --db`. Per `feedback_never_migrate_force.md`: never `migrate --force`. Per `feedback_deploy_migration_guard.md`: full `deploy.sh` skips migrations, must use `--db` explicitly.

### Schema isolation

`parthenon-templates` connects via `parthenon_app` role with `search_path` initially `app, public`. Templates that need to write to `vocab`, `omop`, `synpuf`, etc. set `search_path` per-node. The new tables live in `app.` — application-state, not OMOP data.

## 8. Testing strategy

### Test pyramid

| Layer | What we test | Where it lives | Runs in CI |
|---|---|---|---|
| Unit (Python) | Each Node ABC method, 8 bootstrap nodes, schema validation, materializer, registry | `templates/tests/unit/` | Yes — every push |
| Unit (PHP) | `TemplateRunService` (mocked client), `TemplateRegistryClient` (mocked Guzzle), `SubmitTemplateRunRequest`, `PollTemplateRunJob`, `$fillable` enforcement | `backend/tests/Unit/Templates/` | Yes |
| Unit (TS) | `ParameterForm` per JSON Schema type, `RunInspector` status logic, `useTemplateRun` polling | `frontend/src/features/etl/__tests__/` | Yes (Vitest) |
| Integration (Python) | Node + Prefect (real, in-process), manifest + materializer + Prefect, registry + filesystem | `templates/tests/integration/` | Yes |
| Integration (PHP) | TemplatesController against fake Python HTTP server, TemplateRunService against real Postgres | `backend/tests/Feature/Templates/` (Pest) | Yes |
| E2E (full stack) | `hello_cdm` and `nodes_test` end-to-end against clean Postgres, post-conditions assert correctness, ingestion_jobs row appears | `templates/tests/e2e/` | **Per-push only** (`hello_cdm` + `nodes_test`) |
| E2E (UI) | Playwright happy path: Aqueduct → Templates → submit → watch terminal state | `e2e/templates/` | Yes (per-push, headless) |

`load_athena_vocabulary` and `load_synpuf` are **user-initiated**, not run in CI. They are exercised manually in staging as part of release validation, with the validation pack as the pass/fail oracle. The validation packs themselves live in the repo.

### Coverage targets

- Python: >90% line on `templates/runtime/nodes/`, >85% elsewhere in `runtime/`.
- PHP: >80% on `app/Services/Templates/` and `app/Http/Controllers/Api/V1/TemplatesController.php`.
- TypeScript: >80% on `features/etl/components/aqueduct/templates/` and the new `pages/`.

### Fixtures

- `templates/tests/fixtures/manifests_invalid/` — rejected by schema validator (missing required, invalid node type, circular dependency).
- Synthetic SynPUF/Athena fixtures only as needed for unit/integration tests; full bundles never enter CI (see release-validation note above).

### CI matrix

- **Per-push:** Python 3.12 × PG 16 × Ubuntu 22.04. Full unit + integration + Playwright + `hello_cdm`/`nodes_test` E2E. Target <8 minutes.
- **No nightly Phase-0-specific job** beyond what Parthenon CI already runs. (Heavy templates are user-initiated.)

### Pre-commit hook extensions

The existing `scripts/githooks/pre-commit` adds:

- `ruff check templates/`
- `mypy --strict templates/runtime/` (staged Python files only)
- `parthenon-templates validate-manifests` CLI
- `parthenon-templates lint-secret-keys` CLI (CI lint for secret-shaped param names)

### TDD order

For every Phase 0 task: failing test → implementation → refactor → integration test → E2E. For each template: validation pack first, then manifest, then make the E2E green.

## 9. Rollout

### Milestone shape (~10 weeks)

| Week | Work | Deliverable |
|---|---|---|
| 1–2 | Compose service skeleton, FastAPI + Prefect-in-container, internal-token auth, healthcheck | `parthenon-templates` container running, `GET /health` returns 200 |
| 2–4 | Node SDK (T-001): ABC + 8 bootstrap nodes + dev-runner CLI + tests + ADR-0001 | `parthenon-nodes` import-able, `nodes_test` manifest can run all 8 |
| 3–5 | Orchestration adapter (T-002): Prefect default + 3 stubs + ADR-0002 | 3-node hello flow runs end-to-end, artifacts land in storage |
| 4–6 | Manifest registry (T-003): schema + Pydantic + materializer + ADR-0003 + CI manifest validation | All 4 manifests validate, materialize cleanly with valid params, reject invalid |
| 5–7 | Laravel side: TemplatesController + TemplateRunService + migrations + PollTemplateRunJob + tests | `/api/v1/ingestion/templates/*` returns real data; submitting a run creates rows and dispatches polling |
| 6–8 | Frontend: Aqueduct sub-tabs (Mappings/Templates/Runs), TemplateCard, ParameterForm, RunInspector + tests | UI lets a user run `hello_cdm` end-to-end |
| 7–8 | `parthenon-cdm` package (T-005) + `hello_cdm` + `nodes_test` templates with validation packs | Both Phase 0 trivial templates green per DoD |
| 8–9 | `load_athena_vocabulary` + `load_synpuf` templates (T-008, T-009) with validation packs | Both runnable end-to-end against a clean Postgres in staging |
| 9–10 | Documentation, ADRs final, devlog, deploy.sh integration, security review | Phase 0 ready to ship |

Critical-path parallelization: T-001/T-005 in parallel; T-002 after T-001; T-003 after T-002; T-006/T-007 after T-003; T-008/T-009 after T-006. Frontend (T-004) parallelizes with the registry from week 5.

### Feature flag

The new Aqueduct sub-tabs gate behind `ingestion.templates_enabled` in `app.app_settings` (boolean, false by default; reuses the existing `AppSettingsController` pattern). Toggle is super-admin-only; off → sub-tabs hidden, `/api/v1/ingestion/templates/*` returns 404.

### Definition of Done for Phase 0

The milestone is DONE when **all** of the following are true:

- [ ] All 4 templates appear in the catalog and run end-to-end.
- [ ] Each template has a validation pack and the pack runs green.
- [ ] Each template has a `README.md` covering: what it does, when to use it, parameters, prerequisites, examples, limitations, license notes.
- [ ] All 8 bootstrap nodes have unit tests with >90% line coverage and pass `mypy --strict`.
- [ ] Three ADRs committed: `0001-node-sdk-design.md`, `0002-orchestration-backend.md`, `0003-template-manifest-format.md`.
- [ ] Pre-commit hook validates manifests; CI fails on a broken manifest.
- [ ] Aqueduct shows the new sub-tabs behind the feature flag; with flag on, the full happy path works in Playwright.
- [ ] Submitting a CDM-touching template creates an `app.ingestion_jobs` row visible on the Upload-tab dashboard with a deep-link to the RunInspector.
- [ ] Security review passes (HIGHSEC §8): three-layer route protection, container runs non-root, internal-token rotates, secrets never logged, parameters JSONB redacts secret-shaped fields.
- [ ] Performance: `hello_cdm` runs in <30s on a Postgres 16 dev instance.
- [ ] `deploy.sh` knows about the new container and runs the manifest catalog sync (`php artisan templates:sync`).
- [ ] Devlog written under `docs/devlog/modules/ingestion/templates-phase-0.md`.
- [ ] Reviewed by ≥1 platform engineer + ≥1 ETL engineer.

### Phase 0 non-goals (explicit)

- No FHIR/DICOM/SDTM/claims templates.
- No AI-assisted concept mapping integration into templates (existing `MappingReviewController` flow stays as-is).
- No S3/GCS/Azure storage adapter — local Laravel `storage/` only.
- No mTLS between Laravel and Python — shared internal token.
- No webhooks — polling only.
- No template versioning UI — users see the latest version of each template; pinning is via API but not exposed in UI.
- No third-party manifest signing.
- No `templates.*` permissions — reuses `ingestion.*`.
- No ingestion-ui standalone app — lives inside the existing web app.
- No Aqueduct canvas changes.
- No Laravel ingestion code touched.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| Prefect 3.x has API churn | Pin exact version; ADR-0002 documents migration policy; stubs for Temporal/Dagster/Airflow prove we can swap |
| `parthenon_app` role lacks DDL → templates that bootstrap CDM block | Migrator credential pulled per-run from secrets; scope-limited to that run |
| Storage volume between Laravel and Python container drifts | Single source of truth: `parthenon-templates` writes, Laravel reads via existing artifact-serving middleware |
| Phase 0 scope creep into Phase 1 templates | Feature flag + explicit non-goals list above |
| Worktree-based mechanical sweeps clobber the new code | Per `feedback_worktree_sweep_regressions.md`: rebase any sweep onto main before merge; new code in new directories lowers risk |
| `python-ai` and `parthenon-templates` get conflated by future contributors | Different ports, different compose labels, separate `CODEOWNERS`; ADR-0001 documents the boundary |

## 10. Migration intent (Phase 1+)

Recorded here so Phase 1 doesn't get caught by surprise. **Not in scope for this spec.**

In Phase 1 (devplan T-010 through T-015), Laravel's CSV/FHIR ingestion is expected to migrate onto the node SDK. The migration plan, when written, should:

- Refactor the existing `App\Services\Ingestion\CsvProfilerService` and `FhirParserService` behind a stable interface.
- Replace the implementation with calls into `parthenon-templates` (a `csv_profile` and `fhir_to_omop` template).
- Preserve the existing Upload-tab UX — users see no change.
- Migrate `IngestionJob` data shape to align with `template_runs` (whether to merge the tables is a Phase 1 design decision, not pre-decided here).

Phase 1 **must** revisit:

- Whether the Aqueduct canvas (existing `EtlProject`/`EtlTableMapping`) eventually becomes a "custom template" — building visual mappings that emit a YAML manifest underneath.
- mTLS for Laravel↔Python.
- S3/GCS storage adapter (devplan §5.3).
- Whether `python-ai` and `parthenon-templates` merge or stay separate.

## 11. Deferred decisions / V2 candidates

Captured here so future iteration can pick them up. Each was actively considered and ruled out for Phase 0.

### Architecture

- **Big-bang replacement of Laravel ingestion** (Q2 alternative). Revisit if Phase 1+ proves the strangler-fig path is too slow.
- **Parallel-forever coexistence** of Laravel and Python ingestion paths (Q2 alternative). Revisit if migration intent (§10) is later abandoned for explicit reasons.
- **Templates as a top-level Data Ingestion tab** (Q3, option a) or under Upload (Q3, option c) or top-level nav peer (Q3, option d). Revisit if Aqueduct's mental model breaks down at scale.
- **Extending `python-ai` to host templates** (Q4, option b). Revisit only if container sprawl becomes unmanageable.
- **Prefect Cloud SaaS backend** (Q4, option c). Revisit for non-PHI deployments where customers want managed orchestration.
- **Acropolis-resident Prefect** (Q4, option d). Revisit when Acropolis becomes the canonical platform plane.
- **Sidecar Prefect server container** (Section 4 alternative). Revisit when scaling justifies independent Prefect resource budgets.
- **mTLS between Laravel and Python** (Section 6 alternative). Revisit in Phase 1.
- **Webhooks instead of polling** (Section 5 alternative). Revisit if poll volume becomes a CPU/network concern.

### Data model

- **`EtlProject` subtype for templates** (Q5, option b). Revisit if Aqueduct unifies canvas + template into a single first-class entity.
- **`IngestionJob` subtype with no separate table** (Q5, option c). Revisit only if `template_runs` proves redundant.
- **Mandatory parallel rows in both `template_runs` and `IngestionJob`** (Q5, option d). Already partially adopted (opt-in); revisit if the catalog needs every run visible by default.
- **`uniq_template_runs_singleton` partial unique index** (Section 7 alternative). Replaced with app-layer `SELECT … FOR UPDATE`; revisit if app-layer enforcement proves racy.

### Repo layout

- **Devplan three-package split** (`packages/parthenon-nodes`, `packages/parthenon-orchestration`, `packages/parthenon-templates`) (Q6, option b). Revisit when extracting `parthenon-nodes` as a redistributable package becomes valuable.
- **Templates under `ai/`** (Q6, option c). Revisit only if `ai/` and templates merge.
- **Split `services/templates/` + root `templates/`** (Q6, option d). Revisit if the "executable vs declarative" boundary becomes important.

### Auth / permissions

- **New `templates.*` permission domain** (Q7, option b). Revisit when a customer asks to grant template runs without granting CSV uploads.
- **Hybrid `ingestion.view` + `templates.run`** (Q7, option c). Same trigger.

### CI / testing

- **`load_athena_vocabulary` and `load_synpuf` in nightly CI**. Replaced with user-initiated release validation. Revisit if release cadence makes manual runs untenable.
- **Athena bundle subset as a checked-in fixture**. Replaced by synthetic fixtures + user-initiated full validation. Revisit when license clearance is obtained.

### Storage / observability

- **S3/GCS/Azure storage adapter** (devplan §5.3). Revisit in Phase 1.
- **Third-party manifest signing** (devplan §1.4 / Phase 0 Q15). Revisit when external template authors emerge.
- **OTel exporter to Loki/Grafana** beyond stderr. Revisit when Acropolis observability stack is the assumed default.

## 12. Open questions for human review

Parthenon-specific. The devplan §9 list also applies; these are the additional questions raised in this spec.

1. **Aqueduct sub-tab naming.** "Mappings | Templates | Runs" — confirm or counter-propose.
2. **Where does the template-run dashboard live for non-CDM templates** like `nodes_test`? Right now they're invisible from the Upload tab (no `IngestionJob` row); they only show in Aqueduct's Runs sub-tab. Acceptable, or do we want a "kind=diagnostic" `IngestionJob` row for visibility?
3. **`uv` vs `poetry`.** Spec defaults to `uv`. Does any existing Parthenon Python service (e.g., `ai/`) use poetry? If so, do we match for consistency, or accept divergence for the new package?
4. **Internal-token rotation cadence.** Phase 0 uses a shared secret in env. Manual rotation only? Quarterly? Tied to deploy.sh?
5. **Volume mount between Laravel and Python container.** Named volume vs bind mount? Bind mount is simpler in dev; named volume is more portable across environments. Recommend named volume.
6. **Singleton enforcement with app-layer locking.** `SELECT … FOR UPDATE` on `app.template_runs` is the right primitive. Confirm Postgres advisory locks are not preferred.
7. **`ingestion.templates_enabled` default in production.** Off in production until DoD complete is the spec's recommendation. Confirm.
8. **PR shape.** Devplan suggests one-task-one-PR. Phase 0 is ~9 task IDs. PR-per-task or grouped (foundation PR, frontend PR, templates PR)? My recommendation: one-PR-per-task for T-001/T-002/T-003/T-005, then a single "Phase 0 wiring" PR that lands the Laravel side, frontend, and the 4 templates together.

## 13. References

- Source devplan: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md`
- D2E benchmark: https://github.com/OHDSI/Data2Evidence
- Existing ingestion code: `backend/app/Services/Ingestion/`, `backend/app/Jobs/Ingestion/`, `backend/app/Http/Controllers/Api/V1/IngestionController.php`
- Existing Aqueduct surface: `frontend/src/features/etl/`, `backend/app/Models/App/EtlProject.php`
- HIGHSEC: `.claude/rules/HIGHSEC.spec.md`
- PG role model: `~/.claude/memory/project_parthenon_pg_roles.md`
- Worktree sweep regressions: `~/.claude/memory/feedback_worktree_sweep_regressions.md`
- Migration safety: `~/.claude/memory/feedback_never_migrate_force.md`, `~/.claude/memory/feedback_deploy_migration_guard.md`
