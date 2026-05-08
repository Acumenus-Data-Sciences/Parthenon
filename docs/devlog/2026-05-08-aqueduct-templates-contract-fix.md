# Aqueduct Ingestion Templates — Contract End-to-End Fix

**Date:** 2026-05-08
**Scope:** Data Ingestion → Aqueduct → Templates / Runs

## Symptom

Aqueduct showed only the legacy "Mappings" sub-tab. Even after enabling the
templates flag, the Templates sub-tab failed with "Failed to Load Templates",
and the Runs history endpoint returned 500. Submitting a run threw 502
("Template registry returned empty prefect_run_id").

## Root causes (16 distinct bugs)

1. `ingestion.templates_enabled` flag was never emitted by `AppSettingsController` — frontend gate always closed.
2. `php` and `horizon` containers had no `TEMPLATES_INTERNAL_TOKEN` env, so `TemplateRegistryClient` resolution threw `RuntimeException` at the container level.
3. `templates/Dockerfile` did not COPY `templates/manifests/` — registry started up with zero templates.
4. Frontend `useTemplates` and friends read `data.data` envelope; backend returned bare arrays/objects → React Query queryFn returned `undefined` and surfaced as a fetch error.
5. Upstream registry returns Kubernetes-style `{apiVersion, kind, metadata, spec}`; SPA `TemplateManifest` is flat. No adapter existed.
6. `submitRun` returned `template_run_id` but SPA reads `id`; envelope mismatch.
7. `showRun` returned `{template_run, ingestion_jobs}`; SPA reads flat run.
8. `runLogs`/`runArtifacts` upstream fields (`ts`, `size`) didn't match SPA fields (`timestamp`, `size_bytes`).
9. `cancelRun` returned `{template_run_id, status}` but SPA expects `{ok}`.
10. `GET /ingestion/templates/runs` history endpoint did not exist; frontend silently 404'd.
11. Wildcard route `/{id}` was registered before `/runs*`, so `/runs` was treated as a template id and proxied to the registry as "unknown template 'runs'".
12. Frontend navigated to `/data-ingestion` after submit — that route does not exist; should be `/ingestion`.
13. `TemplateCategory` union was too narrow (`bootstrap|diagnostic|...`); upstream emits `ingestion`, `transform`, etc. and would fail strict type checks.
14. `TemplateRunService::submit` extracted a non-existent `manifest` key, so `singleton`/`requires.cdm_initialized` checks were always false.
15. `TemplateRunService::submit` looked for `prefect_run_id` in upstream `RunSubmitResponse`, which actually returns `run_id` → 502 on every submit.
16. `app.template_runs` migration was unrun, and the original CREATE migration did not GRANT runtime DML to `parthenon_app`.

## Fix summary

- New `App\Services\Templates\TemplatePresenter` (single source of truth that flattens upstream payloads).
- `TemplatesController` rewritten to use the presenter; `submitRun` emits both `id` and legacy `template_run_id`; new `listRuns` controller method with status-array filter and pagination envelope `{data, meta:{total,page,per_page}}`.
- Routes for `/runs*` registered before `/{id}` to avoid the wildcard collision.
- `TemplateRunService::submit` now reads `metadata.singleton` and `spec.requires.cdm_initialized`; accepts upstream `run_id` (preferred) or legacy `prefect_run_id`.
- New migration `2026_05_08_200500_grant_template_runs_to_parthenon_app` grants `SELECT,INSERT,UPDATE,DELETE` on `app.template_runs` (+ sequence USAGE) to the runtime role.
- Templates Dockerfile now bakes manifests into the image.
- docker-compose wires `TEMPLATES_SERVICE_URL` + `TEMPLATES_INTERNAL_TOKEN` into `php` and `horizon` from the existing `PARTHENON_INTERNAL_TOKEN` host secret.
- `AppSettingsController::index()` probes `${TEMPLATES_SERVICE_URL}/health` (1s/2s timeouts, 30s cache) and emits `ingestion.templates_enabled` accordingly — flag now reflects real availability.
- Frontend `templates.ts` hooks read bare shapes; new `RunLogsResponse`/`RunArtifactsResponse`/`CancelRunResponse` types match the normalized envelopes.
- `AqueductTemplatesPage` post-submit navigation corrected to `/ingestion`.
- `TemplateCategory` widened so new upstream categories don't break strict types.
- Backend feature tests (ListShow / Submit / RunRead / Cancel) rewritten against the new flat contract; new pagination test for `listRuns`.

## Verified live

| Endpoint | Result |
| --- | --- |
| `GET /api/v1/app-settings` | `templates_enabled: true` |
| `GET /api/v1/ingestion/templates` | 16 cards (flat) |
| `GET /api/v1/ingestion/templates/hello_cdm` | flat manifest, 3 nodes, `parameters_schema.required: ['target_schema','cdm_version']` |
| `GET /api/v1/ingestion/templates/runs?per_page=5` | `{data, meta:{total,page,per_page}}` |
| `POST /api/v1/ingestion/templates/hello_cdm/runs` | 201, `{id, template_run_id, ingestion_job_id, status}` |
| `GET /api/v1/ingestion/templates/runs/2` | flat TemplateRun |
| `DELETE /api/v1/ingestion/templates/runs/2` | `{ok: true, id, status}` |
| `GET /api/v1/ingestion/templates/runs/2/logs` | normalized `{lines:[…]}` |
| `GET /api/v1/ingestion/templates/runs/2/artifacts` | normalized `{artifacts:[…]}` |

## Out of scope (pre-existing, not addressed)

- `phpunit.xml` DB env vars lack `force="true"`, so backend/.env overrides them and Pest cannot connect to the test DB. Separately, the testing DB is missing the `vocab` schema. Templates feature suite was therefore verified by live API rather than `pest tests/Feature/Templates/`.
- Run #2 submitted via the live system completed the contract test but the upstream Prefect flow itself failed. That is a runtime/orchestration concern (template execution), not a contract concern.
