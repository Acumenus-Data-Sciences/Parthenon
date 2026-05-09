# Aqueduct Ingestion Templates — End-to-End Debug & Hardening Session

**Date:** 2026-05-08 → 2026-05-09 (crossed midnight)
**Scope:** Data Ingestion → Aqueduct → Templates / Runs subtree
**Status:** Shipped to production at https://parthenon.acumenus.net
**Commits:** 10 on `main`, plus 1 PR merge (#311)

This is the comprehensive narrative. The companion runbook for ops staff
is at [`2026-05-08-templates-troubleshooting.md`](./2026-05-08-templates-troubleshooting.md);
that one is the symptom→fix matrix to keep on the wall. This one is the
"how did we get here" log.

---

## 1. The presenting symptom

The session opened with a single sentence: *"The Harmonia UI is not
visible in the Data Ingestion page. Please investigate why."*

That turned out to be a misdirection. Harmonia (concept-mapping reviewer)
lives at `/mapping-review`, not under Data Ingestion at all. The user
realized this immediately. The actual concern, restated:

> What about the selection of the new ingestion routes in Aqueduct?
> Where did all of those novel methods of ingestion land in the UI?

That reframe pointed at a real problem: the SPA's **Aqueduct** tab
showed only the legacy "Mappings" sub-tab. Two further sub-tabs
(**Templates** and **Runs**) were defined in the source but hidden by a
feature flag the SPA reads from `/api/v1/app-settings` —
`ingestion.templates_enabled`. The flag was always false.

The next several hours were spent unwinding **sixteen distinct bugs**
that all needed to be fixed before a clinician could click "Templates",
pick `hello_cdm`, hit Run, and watch a real Prefect flow execute against
their CDM with progress bar and DAG view updating live.

---

## 2. Bug inventory

Numbered in the order they were found, not severity.

### 2.1 — `templates_enabled` flag never emitted

**Where:** `backend/app/Http/Controllers/Api/V1/Admin/AppSettingsController::index()`

`AppSettingsController::index()` returned only `default_sql_dialect`,
`available_dialects`, `updated_at`. The frontend hook
`useTemplatesEnabled()` reads `data.ingestion.templates_enabled`. The
contract had been *specified* (the SPA had mocks for it under
`__tests__/useAppSettings.test.tsx`) but never *implemented* on the
backend. So the flag was always `false`, and the gate at
`EtlToolsPage.tsx:254-260` filtered the sub-tab list down to just
`mappings`.

**Fix (in commit 8ec586ef2):** added a live `/health` probe of the
templates service with 1s connect / 2s read timeouts and a 30s cache,
emitted under `data.ingestion.templates_enabled`. The flag now reflects
real availability.

### 2.2 — PHP container missing `TEMPLATES_INTERNAL_TOKEN`

**Where:** `docker-compose.yml` (`php` service), `backend/app/Providers/TemplatesServiceProvider.php`

The Laravel `TemplateRegistryClient` is provided via DI and its provider
throws `RuntimeException("TEMPLATES_INTERNAL_TOKEN is required")` when
the env var is missing. `php` and `horizon` containers had neither
`TEMPLATES_INTERNAL_TOKEN` nor `TEMPLATES_SERVICE_URL` set. Every call
through any controller that depended on the registry returned 500 at
container resolution time, before any code in the controller ran.

**Fix (commit 8ec586ef2):** docker-compose interpolates the existing
`PARTHENON_INTERNAL_TOKEN` from the host `.env` (which the templates
service already uses) into both `php` and `horizon`'s env block as
`TEMPLATES_INTERNAL_TOKEN` — no new secrets, just propagation.

### 2.3 — Templates Docker image had zero manifests

**Where:** `templates/Dockerfile`

The Dockerfile copied `templates/runtime/` and `templates/pyproject.toml`
into the image but **not** `templates/manifests/`. The registry started
up with an empty filesystem catalog. The service was healthy; it just
had nothing to serve.

**Fix (8ec586ef2):** added `COPY --chown=templates:templates templates/manifests /app/templates/manifests`
to the Dockerfile + rebuilt. Sixteen manifest YAMLs now bake into the
image at build time.

### 2.4 — Frontend reads non-existent `data.data` envelope

**Where:** `frontend/src/features/etl/api/templates.ts` (every hook)

Every hook in this file did:

```ts
const { data } = await apiClient.get<ApiEnvelope<Template[]>>(BASE);
return data.data;
```

The backend (`TemplatesController::index()`) returned a bare array, not
an envelope. So `data.data` was `undefined`, and TanStack Query's
`queryFn` returning `undefined` is treated as a fetch error. That's
where the user's "Failed to Load Templates" error originated.

**Fix (8ec586ef2):** all hooks switched to bare-shape consumption. New
typed responses for `RunLogsResponse`, `RunArtifactsResponse`, and
`CancelRunResponse`. Frontend types `Template`, `TemplateManifest`
remain — only the envelope read changed.

### 2.5 — Upstream registry uses Kubernetes-style payload; SPA expects flat

**Where:** `templates/runtime/api.py`, `templates/manifests/*/manifest.yaml`, frontend types

`GET /templates/{id}` from the Python templates service returns
`{apiVersion, kind, metadata, spec}` — a Kubernetes-flavored manifest.
The SPA's `TemplateManifest` type is flat: `{id, name, version,
description, category, tags, cdm_versions, parameters_schema, nodes,
post_conditions}`. There was no adapter; the SPA was effectively
designed against a never-implemented contract.

**Fix (8ec586ef2):** new `App\Services\Templates\TemplatePresenter`
service. It is a static class with five methods:
`summary()`, `manifest()`, `run()`, `logLines()`, `artifacts()`.
Each accepts an upstream payload (Kubernetes-style or otherwise) and
returns the flat shape the SPA expects. Single source of truth for the
public contract, so the registry can evolve internally without breaking
the SPA.

Specific normalizations:
- `metadata.{id, name, version, ...}` → top-level fields
- `spec.parameters` → `parameters_schema`
- `spec.nodes` (with `node_id`/`type`) → `nodes` (with `id`/`kind`)
- `spec.post_conditions` → `post_conditions`
- log line `ts` → `timestamp`
- artifact `size` → `size_bytes`, `url` → `signed_url`, default
  `content_type` to `application/octet-stream`

### 2.6 — `submitRun` returned `template_run_id` but SPA reads `id`

**Where:** `backend/app/Http/Controllers/Api/V1/TemplatesController::submitRun()`

The submit response had `{template_run_id, ingestion_job_id, status}`.
The SPA's `useSubmitTemplateRun` mutation read `data.data.id` — both the
wrong field name and the wrong envelope shape.

**Fix (8ec586ef2):** the controller now emits both `id` (for the SPA)
and `template_run_id` (for backwards compatibility with any existing
external callers). Frontend reads `id`.

### 2.7 — `showRun` wrapped run in `{template_run, ingestion_jobs}`

**Where:** `TemplatesController::showRun()`

The controller returned `{template_run: {...}, ingestion_jobs: [...]}`.
The SPA reads `data.data` (or now `data`) and expects a flat
`TemplateRun` directly.

**Fix (8ec586ef2):** flattened to `TemplatePresenter::run($run)` which
returns the bare run payload.

### 2.8 — `runLogs` / `runArtifacts` field-name mismatches

**Where:** `TemplatesController::runLogs()`, `runArtifacts()`,
`TemplatePresenter`

Upstream emits `{lines: [{ts, level, message}]}` and `{artifacts:
[{name, size}]}`. SPA expects `lines` lines to have `timestamp` (not
`ts`) and artifacts to have `size_bytes` (not `size`).

**Fix (8ec586ef2):** `TemplatePresenter::logLines()` and
`TemplatePresenter::artifacts()` normalize each entry. Old field names
remain accepted as fallbacks so legacy mock contracts keep working.

### 2.9 — `cancelRun` emitted `{template_run_id, status}` but SPA reads `{ok}`

**Where:** `TemplatesController::cancelRun()`

**Fix (8ec586ef2):** controller now returns `{ok: true, id,
template_run_id, status}`. Both styles satisfied; SPA reads `ok`.

### 2.10 — `GET /ingestion/templates/runs` history endpoint did not exist

**Where:** `backend/routes/api.php`

`AqueductRunsPage.tsx` called this endpoint via `useTemplateRunHistory`
expecting a paginated `{data, meta:{total,page,per_page}}` envelope.
There was no matching route. The frontend's TanStack Query saw a 404
and the runs table just rendered empty forever.

**Fix (8ec586ef2):** new `TemplatesController::listRuns()` method with a
`status[]=` filter and pagination via Laravel's paginator, registered
as `Route::get('/runs', [TemplatesController::class, 'listRuns'])`.

### 2.11 — Wildcard route `/{id}` swallowed `/runs`

**Where:** `backend/routes/api.php`

The route group had `/{id}` registered before `/runs/*`. Laravel matches
in registration order, so `GET /ingestion/templates/runs` was treated
as a template id lookup, the registry was queried for template
`'runs'`, and the upstream returned 404 → Laravel raised a
`TemplateRegistryException`. Even if `/runs` had existed, it would
never have been reachable.

**Fix (8ec586ef2):** reordered the route group so all `/runs*` routes
are declared before `/{id}` and `/{id}/runs`. The wildcard route still
has a regex constraint (`->where('id', '[A-Za-z0-9_\-]+')`) but
ordering is the safer guard.

### 2.12 — Frontend navigated to `/data-ingestion` after submit

**Where:** `frontend/src/features/etl/pages/AqueductTemplatesPage.tsx`

After a successful submit the page did `navigate(`/data-ingestion?tab=...`)`.
The actual route (per `frontend/src/app/router.tsx:79`) is `/ingestion`.
The redirect 404'd silently and the user was dropped to a blank page.

**Fix (8ec586ef2):** corrected to `/ingestion`.

### 2.13 — `TemplateCategory` union too narrow

**Where:** `frontend/src/features/etl/types/templates.ts`

The type listed `bootstrap | diagnostic | vocabulary | demo_data | etl
| validation`. Upstream actually emits `ingestion`, `transform`, etc.
The union was so narrow it would have failed strict typecheck on real
data — except no data ever reached the SPA before this round of fixes,
so the issue was latent.

**Fix (8ec586ef2):** widened with `(string & {})` to keep autocomplete
on the known values while accepting any string. Listed the new known
values explicitly.

### 2.14 — `TemplateRunService::submit` extracted non-existent `manifest` key

**Where:** `backend/app/Services/Templates/TemplateRunService::submit()`

The service did:

```php
$manifestBody = $this->extractManifestBody($manifest);
$singleton = (bool) ($manifestBody['singleton'] ?? false);
$emitsCdm = (bool) (data_get($manifestBody, 'meta.emits_cdm') ?? false);
$requiresCdm = (bool) (data_get($manifestBody, 'requires.cdm_initialized') ?? false);
```

`extractManifestBody()` looked for a top-level `manifest` key, falling
through to the raw payload otherwise. Live upstream returns
`{apiVersion, kind, metadata, spec}` — no `manifest` key. So all three
flags were always `false`. Singleton templates would have allowed
concurrent runs; CDM-requiring templates wouldn't have been gated by
CDM-initialization checks.

**Fix (commit c7dadfa8e):** the service now reads `metadata.singleton`,
`spec.requires.cdm_initialized`, etc. — the actual fields the upstream
emits — with fallbacks to the old `manifest.*` paths and bare top-level
paths so the existing mocked tests still pass.

### 2.15 — `prefect_run_id` vs `run_id` field name drift

**Where:** `TemplateRunService::submit()`, `runtime/api.py`

The service expected `$response['prefect_run_id']` from
`registry->submitRun(...)`. The upstream `RunSubmitResponse` model
defines `run_id, backend_id, status, sanitized_parameters` — no
`prefect_run_id`. Every submit failed with 502 ("Template registry
returned empty prefect_run_id") even though the upstream Prefect run
had been submitted successfully.

**Fix (c7dadfa8e):** the service now accepts either `prefect_run_id` or
`run_id`. The local `TemplateRun.prefect_run_id` column keeps its name
(it stores whatever the upstream calls a run id), but the lookup is
field-name-tolerant.

### 2.16 — `app.template_runs` migration unrun + missing GRANT

**Where:** `backend/database/migrations/2026_05_02_100000_create_template_runs_table.php`

The migration that creates the runs table had been *written* but never
run. After running it, `parthenon_app` (the runtime role on host PG17,
per `project_parthenon_pg_roles.md`) had no DML privileges on
`app.template_runs`. Production calls to `GET /ingestion/templates/runs`
returned `permission denied for table template_runs`.

**Fix (c7dadfa8e + production migrate run):** new follow-up migration
`2026_05_08_200500_grant_template_runs_to_parthenon_app.php` that does
`GRANT SELECT, INSERT, UPDATE, DELETE ON app.template_runs TO
parthenon_app` plus `GRANT USAGE, SELECT, UPDATE ON SEQUENCE
app.template_runs_id_seq TO parthenon_app`, both wrapped in `IF EXISTS
(SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app')` so the
migration is no-op-safe in dev environments where the role doesn't
exist.

---

## 3. Run polling: dropped fields and broken DAG view (#9 / #16)

After the contract fixes were live, runs of `hello_cdm` completed
successfully — but the SPA's progress bar stayed at 0% and the DAG view
never highlighted the running node. Investigation:

`TemplateRunService::pollAndUpdate()` reads `progress`,
`current_node`, `started_at`, `finished_at`, `post_conditions`, `error`
from the upstream `getRun` response. The upstream `RunStatusResponse`
emitted only `{run_id, status}`. So Laravel's poll loop was correctly
shaped but had nothing to write — every progress field stayed at the
initial values forever.

The SPA's `RunInspector.tsx` reads `run.current_node` and passes it to
`RunDagView`, which highlights that node. With `current_node: null`, no
node ever lit up. Same for the implicit progress.

**Fix (commit 34e978101):**

1. New `RunDetails` dataclass on `OrchestrationBackend` (in
   `templates/runtime/orchestration/interface.py`) with
   `status, progress, current_node, started_at, finished_at,
   error_message`. Default implementation returns just `status` for
   backends that don't track richer state. Backends that *can* override.
2. `PrefectBackend` now tracks `total_nodes`, `completed_nodes` (a set),
   `current_node`, and `error_message` in its `_RunRecord`.
   `_append_log` updates `current_node` and `completed_nodes` as a
   side effect of the structured log appends — by parsing the
   conventional `"start <type>"` and `"end status=<value>"` messages
   that `_run_prefect_flow` already emits.
3. New `_iso_or_none(epoch_float)` helper converts the
   `_RunRecord.started_at` / `finished_at` floats (0.0 = unset) to
   ISO-8601 UTC strings.
4. `RunStatusResponse` API model gains `progress` (default 0.0),
   `current_node`, `started_at`, `finished_at`, `error_message` (all
   optional with safe defaults). The `run_status` endpoint dispatches
   through `backend.get_run_details(handle)` and copies the fields.
5. Laravel's `pollAndUpdate` now also accepts `error_message` (the
   actual upstream field) in addition to the legacy `error`.

Verified by running `hello_cdm` post-fix: `progress: 1.0` reported on
completion, both `started_at` and `finished_at` ISO-stamped, no error
message. The SPA's DAG view will highlight nodes correctly mid-run
(can't easily verify live since `hello_cdm` completes in <1s, but
longer flows will show it).

---

## 4. Cancel reconciliation (#12)

Original cancel flow:

```php
public function cancel(TemplateRun $run): void
{
    if ($run->isTerminal()) return;
    if ($run->prefect_run_id !== null) {
        $this->registry->cancelRun((string) $run->prefect_run_id);
    }
    $run->update([
        'status' => TemplateRun::STATUS_CANCELLED,
        'finished_at' => now(),
    ]);
}
```

Two issues:

1. If the upstream cancel call threw (network blip, run already gone),
   the exception bubbled and the user-facing cancel button reported
   error — even though the local row could safely be marked cancelled
   anyway.
2. If the upstream Prefect run had completed between the SPA's last
   status fetch and the user clicking cancel, we'd flip the local row
   to `cancelled` even though upstream's truth was `completed` or
   `failed`. The SPA would then render a misleading status.

**Fix (commit 6b05423f7):** two-phase cancel.

- Phase 1: ask upstream to cancel; swallow `TemplateRegistryException`
  and proceed.
- Phase 2: re-fetch upstream status. If upstream now reports a terminal
  status that isn't `cancelled` (i.e., the run finished before our
  cancel arrived), reflect that. Otherwise default to optimistic
  `cancelled`.

Backend test updated to mock both `cancelRun` and the post-cancel
`getRun` call.

---

## 5. Type tightening (#13)

The `Template` summary type had `description` and `parameters_schema`
required, but the list endpoint never returns those fields (only the
manifest endpoint does). The frontend worked because:
- `TemplateCard` rendered `description` undefined as empty
- `AqueductTemplatesPage` synthesized a fallback manifest from the
  cached summary

But the types were lying.

**Fix (6b05423f7):**
- `Template`: `description?` and `parameters_schema?` (optional)
- `TemplateManifest extends Template`: re-promotes both to required
  (the manifest endpoint always returns them)

This passed `tsc --noEmit` locally but **failed** the stricter `npm run
build` in CI's `build (nginx)` job and `Frontend (React)` job. The
synthesized fallback in `AqueductTemplatesPage.tsx:46` produced an
object whose type was the optional-fields summary spread plus
`{nodes:[], post_conditions:[]}`, not assignable to the
required-fields `TemplateManifest`.

**Subsequent fix (commit ca304d80c):** the synthesized fallback now
explicitly fills `description` (default `""`) and `parameters_schema`
(default `{type: "object", properties: {}}`), making the synthesized
object satisfy `TemplateManifest` directly. Belt and suspenders for the
two TS configs that disagree on strictness.

---

## 6. Test infrastructure: the deeper rabbit hole (#11)

### 6.1 First attempt — schema bootstrap + `force="true"`

Backend `vendor/bin/pest tests/Feature/Templates/...` failed with
*"Invalid schema name: app"*. The `pgsql_testing` connection's
`search_path` is `app,php,public` — but the `parthenon_testing` DB had
no `app` schema, only `public`.

Initial fix: new `tests/Concerns/BootsTestSchemas` trait that runs
`CREATE SCHEMA IF NOT EXISTS` for the schemas referenced across all
runtime connection definitions (`app, php, vocab, omop, results, gis,
finngen, inpatient, inpatient_ext, eunomia, pancreas, temp_abby`).
Idempotent. Added `force="true"` to every `DB_*` env entry in
`phpunit.xml` to lock out backend/.env overrides.

### 6.2 Why `force="true"` didn't actually work

Tests still failed with *"connection refused"* — the trait was running,
schemas were being requested at the right time, but the `pgsql_testing`
connection still tried to reach `host.docker.internal:5432` as user
`smudoshi` (the OS user). Investigating:

- `getenv('DB_TEST_USERNAME')` → `parthenon` (PHPUnit's `force="true"`
  worked at the `putenv()` level)
- `$_ENV['DB_TEST_USERNAME']` → `parthenon` (also fine)
- `$_SERVER['DB_TEST_USERNAME']` → `smudoshi` (THIS is what `env()` reads
  first, and it had been set at PHP container start from `backend/.env`
  load)

Laravel's `env()` helper uses `Illuminate\Support\Env::get()`, which
walks `getenv() → $_SERVER → $_ENV` in that order — but for a value
that's truthy in `$_SERVER`, that wins. PHPUnit's `force="true"`
overwrites `putenv()`, `$_ENV`, and `$_SERVER` — but if the runner
sees a `$_SERVER` value already populated by PHP's `variables_order`
ingest of the container env, the override apparently doesn't take
universally. **The exact mechanism remains unconfirmed**, but the
empirical observation was clear: `force="true"` did *not* prevent
backend/.env's container-baked values from leaking into `env()`.

### 6.3 The fix: bypass `env()` entirely

Updated `BootsTestSchemas::forceTestConnectionConfig()` to override
`config('database.connections.*_testing')` at runtime via `Config::set`,
then `DB::purge()` to drop cached connection objects. This sidesteps
`env()` completely.

The first version was too aggressive — it always forced
`postgres:5432` (the docker service hostname), which broke GitHub
Actions where the postgres service is at `127.0.0.1:5432` (the workflow
sets `DB_HOST=127.0.0.1 DB_PORT=5432` via job env). Fixed in commit
`50f297d8f` by making the override surgical: only patch when the config
value matches a known broken pattern (host = `host.docker.internal`,
username in `{smudoshi, '', DB_USERNAME_NOT_SET}`, empty database).
Otherwise leave config alone so CI workflow env wins.

`phpunit.xml` reverted to no `force="true"` on the DB entries — those
defaults are only used in local-dev contexts where there's no other
source.

### 6.4 The order-of-operations bug

The trait was called from `setUpTraits()` *after*
`rebindTestConnectionPdos()` had already opened the master PDO with
the (broken) original config. The override applied to a connection
that was already cached and bound. Fixed by moving the
`bootTestSchemas()` call to *before* `rebindTestConnectionPdos()` —
now the master PDO is opened against the corrected config from the
start.

### 6.5 Result

Full backend Pest suite: **1,548 passed, 28 skipped, 0 failed**
(11,565 assertions). This had been impossible to run locally for
months due to the test infra issue; the templates work just made it
visible enough to fix.

---

## 7. The `deploy.sh --db` silent-skip footgun (#15)

While trying to apply the new `grant_template_runs_to_parthenon_app`
migration, `deploy.sh --db` showed:

```
   Pending migrations:
   Migrating as: parthenon_migrator (runtime app continues as DB_USERNAME from .env)
   INFO  Running migrations.
```

… and exited successfully. But `migrate:status` still said the migration
was Pending. The pending list under the header was *empty*.

Tracing it down: `deploy.sh:547` captured pending migrations via:

```bash
PENDING=$(docker compose exec -T php php artisan migrate:status --pending 2>/dev/null \
  | grep -oP '(?<=\s)\d{4}_\d{2}_\d{2}_\d+_\S+(?=\s)' || true)
```

That regex worked when tested in isolation. So that wasn't the bug.
The actual loop was:

```bash
while IFS= read -r mig; do
  echo "   → ${mig}"
  if ! "${MIGRATE_EXEC[@]}" migrate --path="database/migrations/${mig}.php" --force 2>&1; then
    fail "Migration failed: ${mig}"
  fi
done <<< "$PENDING"
```

`MIGRATE_EXEC` is `docker compose exec -T -e DB_USERNAME=... -e
DB_PASSWORD=... php php artisan`. The `docker compose exec -T` retains
stdin (the `-T` disables the pseudo-TTY but doesn't close stdin); the
inner `migrate --force` call on artisan reads stdin too. With no
`</dev/null`, the inner command **swallows the rest of the loop's
heredoc input**. So after the first iteration, `read -r mig` has
nothing left to read and exits. Every migration after the first is
silently skipped. The loop exits with success.

This is a classic Bash gotcha. It had been silently swallowing
migrations for who knows how long.

**Fix (commit c7dadfa8e):**
1. Replaced the brittle PCRE lookbehind/lookahead with `awk` over
   column 1 — more robust to artisan's terminal-width-aware output
   formatting.
2. Added `</dev/null` to the inner `migrate` call so artisan can't eat
   the loop's stdin.
3. Surface artisan errors instead of swallowing them: if
   `migrate:status` output looks like an error (vs empty), `fail` it
   and increment ERRORS rather than proceeding silently.
4. Print the pending count and each migration name as it runs so the
   operator can see progress.

Verified by running `deploy.sh --db` against three pending migrations
that had accumulated; all three landed on the same invocation.

---

## 8. The PR #311 odyssey

Mid-session the user asked about PR #311 — *"chore: rename
sudoshi/Parthenon → Acumenus-Data-Sciences/Parthenon"*. It had been
sitting open with a failing `Backend (Laravel)` CI check.

The PR branch had forked from main *before* the templates contract
fixes landed. The CI failure was `TemplateRunEndToEndTest` asserting on
the old `template_run.status` envelope shape. The rename PR was
unrelated to templates work but had to ship the test contract update
along with it.

**Six iterations of `gh api -X PUT .../update-branch` and CI re-runs
later:**

1. First merge brought in templates contract fixes; `TemplateRunEndToEndTest`
   assertion updated to flat shape.
2. Cancel test mock didn't include `getRun` — added.
3. `BootsTestSchemas` always overrode config; broke GH Actions where
   the workflow env was correct. Made surgical.
4. Frontend `TemplateCategory` widening + `parameters_schema` optional
   broke `npm run build` in `Frontend (React)` and `build (nginx)`
   jobs. Synthesized fallback explicitly fills both fields.
5. `build (darkstar)` failed with `fs` package compile error
   (`uv.h: No such file`). Added `libuv1-dev` to apt block and
   pre-installed `fs`.
6. `build (darkstar)` then hit `timeout-minutes: 60` mid-build. Bumped
   to 120.

PR #311 merged as commit `99f2050d6`. Total iterations: 6 round-trips
through GitHub Actions, each taking 30-90 minutes for `darkstar`
specifically.

The user's parallel HADES-parity work (in their working tree
throughout) was preserved via `git stash` whenever I needed to commit
on a clean main. That work also landed during the session as
`6ed9bd811` and `1830986fb`.

---

## 9. Architecture decisions & rationale

A few decisions were made that future engineers might want to revisit
or understand:

### 9.1 — Single source of truth for shape: presenter in PHP

We could have written the adapter in TypeScript on the frontend, or
made the upstream Python service emit the SPA's flat shape. Reasons we
chose Laravel:

- **The contract is Laravel's API surface.** The upstream Python
  service is internal-only; it should be free to change its shape (it
  already has Kubernetes-style manifests, Pydantic models, etc.). The
  SPA shouldn't care what the upstream does.
- **Fewer test files to keep aligned.** Putting the adapter in PHP
  means we only have to test the contract once (in `TemplatePresenterTest`)
  rather than testing it in both Python and TypeScript.
- **PHP is where existing API conventions live.** Other Laravel
  presenters/transformers already exist in the codebase.

### 9.2 — `templates_enabled` driven by live health probe, not env flag

The naive implementation would add an `INGESTION_TEMPLATES_ENABLED=true`
env flag to backend/.env and read it in the controller. That would
work but lies: if the templates service is down, the flag stays true
and the SPA shows broken cards.

A live health probe with 30s server-side cache catches the realistic
failure modes:
- Service container stopped → flag false within 30s
- Network partition → flag false
- Token mismatch → flag false (probe is unauth, but
  `TemplateRegistryClient` uses the token; if both are wrong we'd see
  it)

The cost is one HTTP request per 30s per `app-settings` request,
which is negligible.

### 9.3 — Env-based DATABASE_URL construction in templates entrypoint

Two paths to give the templates service its DB credentials:
- Hard-code in docker-compose: `DATABASE_URL=postgresql+psycopg://parthenon_app:${DB_PASSWORD}@host.docker.internal:5432/parthenon`
- Have the entrypoint construct from individual `DB_*` env vars

We chose the entrypoint path:
- Single source of truth: `backend/.env` already has the runtime DB
  credentials. `env_file: ./backend/.env` passes them through to the
  templates container.
- URL-encoding of the password is handled by `urllib.parse.quote()` in
  the entrypoint — special characters in the password don't break the
  URL.
- Operator can still override with a hand-rolled `TEMPLATES_DATABASE_URL`
  in the host `.env` if needed.

### 9.4 — Surgical patch in test trait, not blanket override

The first `BootsTestSchemas` impl overrode every test connection
unconditionally. That worked for local docker but broke GH Actions.
The surgical version only patches when it sees a known broken value
(`host.docker.internal`, OS-user `smudoshi`, empty database). The
trait is a no-op in healthy environments.

### 9.5 — Two-phase cancel

We didn't go all the way to "verify the Prefect job is genuinely dead
before flipping local state" because that creates UX latency (the user
clicks cancel and waits for the upstream cancel to propagate). We do
re-poll *once* to catch the race where the run finished
in-between, and we're optimistic about the cancel taking effect
eventually.

---

## 10. Verification matrix

End-to-end live verification against `https://parthenon.acumenus.net`,
admin token:

| Endpoint | Result |
| --- | --- |
| `GET /api/v1/app-settings` | `ingestion.templates_enabled: true` |
| `GET /api/v1/ingestion/templates` | 16 cards, flat shape |
| `GET /api/v1/ingestion/templates/hello_cdm` | flat manifest, 3 nodes, `parameters_schema.required: ['target_schema','cdm_version']` |
| `GET /api/v1/ingestion/templates/runs?per_page=5` | `{data, meta:{total,page,per_page}}` |
| `POST /api/v1/ingestion/templates/hello_cdm/runs` | 201 with `{id, template_run_id, ingestion_job_id, status}` |
| `GET /api/v1/ingestion/templates/runs/{id}` | flat TemplateRun, `progress: 1.0` on completion, `started_at` and `finished_at` populated |
| `DELETE /api/v1/ingestion/templates/runs/{id}` | `{ok: true, id, status}` |
| `GET /api/v1/ingestion/templates/runs/{id}/logs` | normalized `{lines: [...]}` with `timestamp` field (not `ts`) |
| `GET /api/v1/ingestion/templates/runs/{id}/artifacts` | normalized `{artifacts: [...]}` with `size_bytes` (not `size`) |

End-to-end confirmation that the actual flow executes: ran `hello_cdm`
with `target_schema=hello_cdm_demo`, `cdm_version=5.4`. Bootstrap
created `hello_cdm_demo.person`, `insert_person` added the demo PERSON
row, `query_person` retrieved it. Final state in the database:

```
postgres=# SELECT person_id, gender_concept_id, year_of_birth FROM hello_cdm_demo.person LIMIT 3;
 person_id | gender_concept_id | year_of_birth
-----------+-------------------+---------------
         1 |              8507 |          1970
```

Test gates:
- Backend Pest: 1,548 passed / 28 skipped / 0 failed
- Backend Pint: clean
- Backend PHPStan: clean on changed files (pre-existing Mockery
  noise on unrelated unit tests left alone)
- Frontend tsc: clean
- Frontend vite build: clean
- Frontend Vitest (templates suites): 21+ tests pass
- Templates unit + integration: 11 passed
- Backend new presenter test suite: 5 passed (47 assertions)
- All deploy.sh smoke checks: 200/204/404 as expected
- HADES required packages: all 23 present, 40 of 40 installed

---

## 11. The 11-commit chain on `main`

In landed order:

| Commit | Description |
|---|---|
| `8ec586ef2` | Aqueduct templates 16-bug contract alignment |
| `c7dadfa8e` | DB credential wiring + reliable migrations |
| `34e978101` | Run polling progress / current_node / timestamps / error_message |
| `6b05423f7` | Cancel reconciliation, type tightening, tests, runbook |
| `b9fa2d269` | Pest test infra unblocked + faster app-settings refresh |
| `7356ab17c` | Test infra: respect CI env when resolving test DB host |
| `50f297d8f` | Surgical patch-only-when-broken refinement |
| `ca304d80c` | Synthesize parameters_schema fallback for AqueductTemplatesPage |
| `ac0345797` | `libuv1-dev` for R `fs` package |
| `05e8fe835` | Bump docker-build timeout 60 → 120 min for darkstar |
| `99f2050d6` | PR #311 merge: rename sudoshi/Parthenon → Acumenus-Data-Sciences/Parthenon |

Plus the user's parallel HADES-parity work (`6ed9bd811`, `1830986fb`)
and CE/EE Plan 02 (`a3c008aef`) that landed during the session.

---

## 12. What's left (intentional)

Nothing actionable from the templates work. The remaining items
considered but deferred:

- **Cancel propagation hardening** to verify the Prefect job is
  genuinely dead before flipping local state — UX vs correctness
  tradeoff. Current "optimistic with reconciliation poll" is good
  enough.
- **Strategus / managed Shiny artifact wiring** — landed separately
  by the user during the session as `6ed9bd811` / `1830986fb`.
- **Run history retention policy** — `app.template_runs` will grow
  indefinitely. Future work.
- **Authorization on individual templates** — currently all templates
  are visible to anyone with `ingestion.view`. Per-template ACLs
  would be a future feature.

---

## 13. Operator runbook

Symptom→fix matrix is at
[`2026-05-08-templates-troubleshooting.md`](./2026-05-08-templates-troubleshooting.md).
Key files index, health probes, and the expected upstream
`RunStatusResponse` shape are all there. Use it as the on-call
diagnosis path; this devlog as the historical narrative.
