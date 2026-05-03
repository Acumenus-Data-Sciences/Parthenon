# Templates Laravel Integration — 2026-05-02

Phase 0, Plan 2 of the Parthenon ingestion-templates initiative. Wires the Laravel
backend to the standalone `parthenon-templates` Python service shipped in Plan 1
(branch `feature/phase-0-templates-foundations`, 33 commits).

## Scope

Laravel-side persistence, controllers, services, jobs, and migrations so that
`/api/v1/ingestion/templates/*` endpoints work end-to-end against the Python
service. Tests run via Pest with mocked Python.

## Migrations

- `2026_05_02_100000_create_template_runs_table.php` — adds `app.template_runs`
  with check constraints for `status` (`pending|queued|running|completed|failed|cancelled`)
  and `progress` (0–1). Indexes on `template_id`, `status`, `submitted_by`,
  `submitted_at` (DESC).
- `2026_05_02_100100_add_template_run_id_to_ingestion_jobs.php` — adds
  `template_run_id` (nullable FK) and `kind` columns to `app.ingestion_jobs`,
  letting an ingestion job optionally point at the template run that produced it.

Both migrations are forward-only; `down()` drops in reverse.

## New types

- `App\Models\App\TemplateRun` — Eloquent model on the `pgsql` connection (default).
- `App\Exceptions\Templates\TemplateRegistryException` — wraps Python-service
  errors with structured context (status code, response body, correlation id).

## Config

- `config/services.php` gains a `templates` block with `base_url`, `internal_token`,
  `connect_timeout`, `request_timeout`, and `polling.{initial,max,growth}` keys.
- `.env.example` gains `TEMPLATES_BASE_URL`, `TEMPLATES_INTERNAL_TOKEN`, etc.

## Operational notes

- The compose service `parthenon-templates` (Plan 1) requires
  `PARTHENON_INTERNAL_TOKEN` in repo root `.env` — Plan 1 declared the variable
  with `:?` so docker compose fails fast if missing. Set this once when you
  bring up the stack on a fresh machine.
- Pre-commit hook (`scripts/githooks/pre-commit`) requires a paired devlog or
  CHANGELOG entry alongside any `backend/database/migrations/*` change. This
  file is that pairing for both Plan 2 migrations.

## Related plans

- Plan 1 (Foundations) — branch `feature/phase-0-templates-foundations`
- Plan 3 (Frontend) — depends on this plan
- Plan 4 (Real templates) — depends on this plan

## Branch

`feature/phase-0-templates-laravel`, branched off Plan 1.
