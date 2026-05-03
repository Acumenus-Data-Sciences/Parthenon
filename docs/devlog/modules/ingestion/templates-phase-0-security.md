# Phase 0 Security Review — Ingestion Templates

**Reviewer:** _(fill in name + date at sign-off)_
**Status:** Draft
**Scope:** All Phase 0 components introduced by Plans 1–4 of the
parthenon-ingestion-templates milestone (specs:
`docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`).

This review walks the HIGHSEC §1–§7 axes against the shipped implementation
and lists the targeted penetration-style tests that already exist in the test
suite.

## HIGHSEC §1 — Principle of Least Privilege

| Check | Verified by |
|---|---|
| New users still receive `viewer` role only — auth surface unchanged in Phase 0 | `backend/app/Http/Controllers/Api/V1/AuthController.php` (no edit in any Phase 0 plan) |
| Sanctum tokens still expire after 480 min — auth surface unchanged in Phase 0 | `backend/config/sanctum.php` (no edit in any Phase 0 plan) |
| Templates service runs as non-root `templates` user | `templates/Dockerfile` (Plan 1); container starts via `USER templates` |
| Internal token comparison uses `hmac.compare_digest` (constant-time) | `templates/runtime/middleware/internal_token.py` lines 47–51; tests in `templates/tests/test_internal_token.py` |
| `parthenon-templates` only mounts the manifests root (RO) and the storage root (RW) | `docker-compose.yml` `parthenon-templates` service definition (Plan 1) |
| Templates service does NOT mount the docker socket, host root, or any privileged volume | `docker-compose.yml` (no `privileged: true`, no `/var/run/docker.sock`, no `/:/rootfs`) |

> Phase 0 deliberately did not add a Postgres `parthenon_migrator` per-run
> credential pull. `hello_cdm` bootstraps a CDM via SQLAlchemy DDL using the
> single `DATABASE_URL` threaded into `NodeContext.db_dsn` by the factory
> (commit `b6d60c274`). The role split (runtime vs migrator) lives outside
> Phase 0 and is tracked under Plan 1 follow-ups (deferred — see Open Issues
> in `templates-phase-0.md`).

## HIGHSEC §2 — Three-Layer Route Protection

Every route added by Plan 2 sits under `auth:sanctum`, carries a `permission:`
middleware on the existing `ingestion.*` domain, and runs through service-layer
ownership checks where ownership matters:

| Route | Auth | Permission | Service-layer guard |
|---|---|---|---|
| `GET /api/v1/ingestion/templates` | `auth:sanctum` | `permission:ingestion.view` | n/a (catalog is public to ingestion-view users) |
| `GET /api/v1/ingestion/templates/{id}` | `auth:sanctum` | `permission:ingestion.view` | n/a |
| `POST /api/v1/ingestion/templates/{id}/runs` | `auth:sanctum` | `permission:ingestion.run` | Singleton check via `TemplateRunService::submit` (commit `c736e591a`) |
| `GET /api/v1/ingestion/templates/runs/{run}` | `auth:sanctum` | `permission:ingestion.view` | Returns only `template_run_id`-scoped fields |
| `GET /api/v1/ingestion/templates/runs/{run}/logs` | `auth:sanctum` | `permission:ingestion.view` | Streams scoped per `template_run_id` |
| `GET /api/v1/ingestion/templates/runs/{run}/artifacts` | `auth:sanctum` | `permission:ingestion.view` | Returns only artifacts under the run's storage root |
| `DELETE /api/v1/ingestion/templates/runs/{run}` | `auth:sanctum` | `permission:ingestion.delete` | Cancels via `TemplateRunService::cancel` (commit `eeac15a80`) |

Verified by Pest feature tests under `backend/tests/Feature/Templates/`
(commits `aa6cbee23`, `4ee68b5ca`, `eeac15a80`, `8de5808a8`). Permission
existence asserted by `dad1d7b2e` (`ingestion.{view,run,delete}` exist; no new
permissions added).

## HIGHSEC §3 — Model Security

| Check | Verified by |
|---|---|
| `TemplateRun` model uses `$fillable` whitelist, never `$guarded = []` | `backend/app/Models/App/TemplateRun.php` (commit `3c20106d4`) |
| `parameters` JSONB column uses `array` cast (NOT `encrypted:array`); secrets are pre-redacted by the Python service before write | Migration `2026_05_02_100000_create_template_runs_table.php` (commit `f0f33bbba`); model casts in `3c20106d4` |
| `IngestionJob.template_run_id` is a nullable FK; not mass-assignable from API | Migration `16cc8356a`; field omitted from any controller-bound request |

## HIGHSEC §4 — Container Security

| Check | Verified by |
|---|---|
| `parthenon-templates` Dockerfile has non-root `USER templates` | `templates/Dockerfile` (Plan 1) |
| `parthenon-templates` is on the internal compose network, NOT exposed via Nginx | `docker-compose.yml` (Plan 1); only `php`/`horizon` reach it via service DNS |
| Healthcheck wired and exposed on `/health` | `templates/runtime/api.py`; healthcheck declared in compose service block |
| Volume mounts: `templates/manifests:/app/manifests:ro` and `${STORAGE_ROOT}/templates:/app/storage:rw` only | `docker-compose.yml` parthenon-templates `volumes:` block |
| No `privileged: true`, no docker socket, no host root mount | `docker-compose.yml` |

## HIGHSEC §5 — Secrets Management

| Secret | Source | Logged? | Persisted? |
|---|---|---|---|
| `PARTHENON_INTERNAL_TOKEN` | env var (root `.env`, mode 600), required at compose-up via `:?` | Never — middleware does not log header values; tests assert no token-shaped string appears in any captured log | Never |
| `UMLS_API_KEY` (CPT4 in `load_athena_vocabulary`) | env var on the templates container; documented in runbook | Never — `RNode` test asserts no UMLS key string appears in stdout/stderr capture | Never |
| `DATABASE_URL` (templates → Postgres) | env var; threaded into `NodeContext.db_dsn` only | Never — DSN string is never logged at INFO level | Never |
| `template_runs.parameters` JSONB | persisted, but secret-shaped parameters redacted at registry layer before insert | Redacted at submit time | Stored as `***REDACTED***` |

Manifest CI lint enforces: any parameter named `*_key` / `*_token` /
`*_password` / `*_secret` MUST be marked `secret: true` (or its name must
already match the secret-shape regex, in which case redaction kicks in
implicitly). The CLI subcommand `parthenon-templates lint-secret-keys`
implements this check; it currently reports `lint-secret-keys: clean` against
all 4 shipped manifests.

Redaction is implemented in `templates/runtime/registry/materializer.py`
(`redact_secrets`, lines 51–66) and runs **before** the FlowSpec.parameters
echo flows back to Laravel. Pattern: `(_key|_token|_password|_secret)$` (case
insensitive). Empty strings and `None` are passed through unchanged so that
"unset" is distinguishable from "redacted".

## HIGHSEC §6 — RBAC

No new permissions added. Reuses existing `ingestion.{view,run,delete}` from
the `RolePermissionSeeder`. Verified by the Pest test added in commit
`dad1d7b2e` (asserts the three permissions exist on the `viewer` /
`data-steward` / `admin` roles per the existing seeder definitions and that
NO new permission with prefix `templates.*` was introduced).

## HIGHSEC §7 — PHI Protection

| Concern | Mitigation |
|---|---|
| Patient profiles never exposed via templates routes | Routes return only `app.template_runs` columns (id, template_id, status, parameters, progress, error, timestamps). No PERSON-shaped data flows back through the controllers. |
| Logs scrubbed of secrets | `materializer.redact_secrets` runs at submit; structured logging in the templates service uses keys whose values for secret parameters are pre-redacted. |
| Error messages do not leak schema names or query plans | Plan 2 controllers wrap registry exceptions in `TemplateRegistryException` (commit `0417baa67`) with user-safe `message` and a separate `details` envelope; the controller serialises only the user-safe message. |
| The 4 shipped templates do not touch PHI | `hello_cdm` and `nodes_test` are smoke tests on isolated demo schemas. `load_athena_vocabulary` ingests Athena reference vocabulary (no PHI). `load_synpuf` ingests CMS Synthetic Public Use Files — synthetic by construction, never PHI. |

## Penetration Tests Simulated

The test suite already includes targeted negative tests covering each surface:

1. **Missing internal token** — Python service returns 401, never invokes the
   handler. Verified by `templates/tests/test_internal_token.py::test_missing_token_rejected`.
2. **Wrong internal token** — constant-time compare returns 401 (no early-exit
   timing leak). Verified by `test_wrong_token_rejected` (same file).
3. **Path-traversal in manifest paths** — JSON Schema rejects manifests whose
   schema/table identifiers do not match `^[a-z][a-z0-9_]*$`. Verified by
   `templates/tests/unit/test_manifest_schema.py` and by the `validate-manifests`
   CLI run on every commit (pre-commit hook + CI).
4. **PHI-shaped parameter value (e.g. `umls_api_key=...`)** — Materializer
   redacts at submit before the FlowSpec.parameters dict is returned to
   Laravel. Verified by `templates/tests/unit/test_materializer.py` (multiple
   cases including custom-named secret params with `secret: true` and pattern-
   matched secret names).
5. **Concurrent submission of a singleton template (`load_athena_vocabulary`)**
   — App-layer guard in `TemplateRunService::submit` rejects the second
   submission with `409 Conflict`. Verified by Pest test in commit
   `c736e591a`.
6. **Forged Sanctum token on any templates route** — standard Sanctum
   middleware rejects; verified by existing Sanctum-stack tests (no
   templates-specific override needed).
7. **Manifest with unknown node `type`** — `template.v1.json` enum rejects at
   schema-validation time; the registry never instantiates the FlowSpec. The
   `validate-manifests` CLI exits non-zero, so CI fails the merge.

## Sign-off

- [ ] Platform engineer: _____________ date: _______
- [ ] ETL engineer: _____________ date: _______
- [ ] Security review (if required for Production): _____________ date: _______

Once all required boxes are signed, this document is committed to git as the
security gate for Phase 0 release.
