# Aqueduct Templates — Operator Runbook

This document is the on-call diagnosis path for the ingestion templates feature.
Use the symptom → check → fix flow below before paging engineering.

## Architecture (one paragraph)

The SPA's Data Ingestion → Aqueduct → Templates / Runs sub-tabs talk to Laravel
under `/api/v1/ingestion/templates`. Laravel uses
`App\Services\Templates\TemplateRegistryClient` (HTTP) to proxy a separate
internal Python service `parthenon-templates` (FastAPI + Prefect, port 8000,
NOT exposed via Nginx). The presenter at
`App\Services\Templates\TemplatePresenter` flattens the Python service's
Kubernetes-style payloads into the SPA's flat shape.

Run state lives in `app.template_runs` (Laravel Eloquent owns this) and is
polled by `App\Jobs\Templates\PollTemplateRunJob` against the Python
service's `GET /runs/{run_id}`. Logs and artifacts are proxied
on-demand.

```
SPA  →  Laravel /api/v1/ingestion/templates*  →  parthenon-templates:8000
                       │
                       └──→  app.template_runs  (state)
                       └──→  Horizon queue  (polling)
```

## Quick health probe

```bash
# 1. Templates feature flag — should be true
TOKEN=$(curl -sk -X POST https://parthenon.acumenus.net/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acumenus.net","password":"<pw>"}' | jq -r .token)
curl -sk -H "Authorization: Bearer $TOKEN" \
  https://parthenon.acumenus.net/api/v1/app-settings | jq .data.ingestion

# 2. Catalog count — should be ≥10
curl -sk -H "Authorization: Bearer $TOKEN" \
  https://parthenon.acumenus.net/api/v1/ingestion/templates | jq length

# 3. Templates service /health (from the PHP container)
docker compose exec parthenon-templates curl -sf http://127.0.0.1:8000/health
```

## Symptom → Check → Fix matrix

### "Templates tab missing in Aqueduct"

**Probable cause:** `ingestion.templates_enabled` flag is false.

**Check:**
```bash
curl -sk -H "Authorization: Bearer $TOKEN" \
  https://parthenon.acumenus.net/api/v1/app-settings | jq .data.ingestion.templates_enabled
```

The flag is computed by a live `/health` probe of `parthenon-templates`
(30s cache). If `false`:

```bash
docker compose ps parthenon-templates
# Should show "running (healthy)"
docker compose logs --tail=50 parthenon-templates
```

If the container isn't running, restart:
```bash
docker compose up -d parthenon-templates
```

If healthy but flag still false after >30s, restart Laravel cache:
```bash
docker compose exec php php artisan cache:clear
```

### "Failed to Load Templates" / cards empty

**Probable causes (most common first):**

1. **PHP container missing `TEMPLATES_INTERNAL_TOKEN`**
   ```bash
   docker compose exec php sh -c 'echo TOKEN_LEN=${#TEMPLATES_INTERNAL_TOKEN}'
   # 0 means missing
   ```
   Fix: confirm the host `.env` has `PARTHENON_INTERNAL_TOKEN` set (the
   `php` and `horizon` services interpolate it as `TEMPLATES_INTERNAL_TOKEN`
   in `docker-compose.yml`). Recreate:
   ```bash
   docker compose up -d php horizon
   ```

2. **Templates Docker image has no manifests** (rare — first-build issue)
   ```bash
   docker compose exec parthenon-templates ls /app/templates/manifests/
   ```
   Fix: `docker compose build parthenon-templates && docker compose up -d parthenon-templates`.

3. **SPA browser cache** (most common after a deploy)
   The SPA caches `/app-settings` for 60s in React Query and the browser
   disk-caches the bundle. After a deploy, ask the user to hard-refresh
   (Ctrl+Shift+R / Cmd+Shift+R).

4. **Frontend bundle outdated**
   ```bash
   md5sum frontend/dist/assets/templates-*.js
   # compare against the live one:
   curl -sk https://parthenon.acumenus.net/assets/templates-*.js | md5sum
   ```
   If different, run `./deploy.sh --frontend`.

### "500 on /api/v1/ingestion/templates/runs"

**Probable cause:** runtime DB role lacks DML on `app.template_runs`.

**Check:**
```bash
docker compose exec php php artisan tinker --execute='echo App\Models\App\TemplateRun::count();'
# Should print a number; if "permission denied for table template_runs", missing GRANT.
```

**Fix:** the `2026_05_08_200500_grant_template_runs_to_parthenon_app`
migration grants this. Apply pending migrations:
```bash
./deploy.sh --db
```

If `deploy.sh --db` reports "No pending migrations" but `migrate:status`
disagrees, see #15 below.

### "Submit returns 502: empty run_id"

**Probable cause:** template service contract drift — `TemplateRunService::submit`
expects `prefect_run_id` or `run_id` in the upstream submit response.

**Check the upstream `RunSubmitResponse` shape:**
```bash
docker compose exec parthenon-templates python -c \
  "from runtime.api import RunSubmitResponse; print(RunSubmitResponse.model_fields.keys())"
```

Expected: `run_id, backend_id, status, sanitized_parameters`. If the
field name changed, update the fallback chain in
`backend/app/Services/Templates/TemplateRunService.php` near the
`$prefectRunId = (string) ($response['prefect_run_id'] ?? $response['run_id'] ?? '')`
line.

### "Submit returns 201 but the run fails immediately with 'no password supplied'"

**Probable cause:** `parthenon-templates` is connecting to the wrong
Postgres or has no DB password.

**Check:**
```bash
docker compose exec parthenon-templates sh -c \
  'echo "DB_HOST=$DB_HOST DB_USERNAME=$DB_USERNAME DB_PASSWORD set? $([ -n "$DB_PASSWORD" ] && echo yes || echo no)"'
```

The container should inherit DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD from
`backend/.env` via `env_file:` in `docker-compose.yml`. The entrypoint
constructs `DATABASE_URL` if not set. If those vars are missing,
restore the `env_file: ./backend/.env` line in the templates service block.

### "Run shows progress=0 forever even though it completed"

**Probable cause:** templates service is on an old image that doesn't expose
`progress`/`current_node`/`started_at`/`finished_at` in `RunStatusResponse`.

**Check:**
```bash
docker compose exec parthenon-templates python -c \
  "from runtime.api import RunStatusResponse; print(list(RunStatusResponse.model_fields.keys()))"
```

Expected: includes `progress`, `current_node`, `started_at`, `finished_at`,
`error_message`. If only `run_id` and `status`, rebuild:
```bash
docker compose build parthenon-templates
docker compose up -d parthenon-templates
```

### "deploy.sh --db skips a migration silently"

**Probable cause:** old version of `deploy.sh` had a brittle PCRE capture
and used `migrate --force` which consumed the loop's stdin.

**Check:**
```bash
grep -n "</dev/null" deploy.sh
# Should appear inside the migrate loop.
```

If absent, pull latest. If it must be applied manually with the migrator
role:
```bash
MIG_USER=$(grep '^DB_MIGRATION_USERNAME=' backend/.env | cut -d= -f2-)
MIG_PW=$(grep '^DB_MIGRATION_PASSWORD=' backend/.env | cut -d= -f2-)
docker compose exec -T -e DB_USERNAME=$MIG_USER -e DB_PASSWORD=$MIG_PW php \
  php artisan migrate --path=database/migrations/<migration_file>.php --force
```

## Key files

| File | Purpose |
| --- | --- |
| `backend/app/Http/Controllers/Api/V1/TemplatesController.php` | All `/ingestion/templates*` endpoints |
| `backend/app/Services/Templates/TemplatePresenter.php` | Flattens upstream payloads to SPA shape |
| `backend/app/Services/Templates/TemplateRegistryClient.php` | HTTP client for the Python service |
| `backend/app/Services/Templates/TemplateRunService.php` | Submit/poll/cancel orchestration |
| `backend/app/Jobs/Templates/PollTemplateRunJob.php` | Background poll job (runs in Horizon) |
| `backend/app/Models/App/TemplateRun.php` | Eloquent model for `app.template_runs` |
| `backend/app/Http/Controllers/Api/V1/Admin/AppSettingsController.php` | `templates_enabled` health probe |
| `templates/runtime/api.py` | FastAPI endpoints (`/templates`, `/runs`) |
| `templates/runtime/orchestration/prefect_backend.py` | Run state + log/progress tracking |
| `templates/runtime/orchestration/interface.py` | Backend-agnostic `RunDetails` dataclass |
| `templates/Dockerfile` | Bakes manifests + entrypoint into the image |
| `docker/templates/entrypoint.sh` | Constructs `DATABASE_URL` from DB_* env vars |
| `docker-compose.yml` (`parthenon-templates` block) | Service wiring + env_file inheritance |
| `frontend/src/features/etl/api/templates.ts` | TanStack Query hooks |
| `frontend/src/features/etl/pages/AqueductTemplatesPage.tsx` | Catalog grid + parameter modal |
| `frontend/src/features/etl/pages/AqueductRunsPage.tsx` | Run history table |
| `frontend/src/features/etl/components/aqueduct/templates/RunInspector.tsx` | Run detail view |

## Tests

- Backend: `backend/tests/Feature/Templates/*.php`,
  `backend/tests/Unit/Templates/TemplatePresenterTest.php`.
- Frontend: `frontend/src/features/etl/__tests__/api-templates.test.tsx`,
  `AqueductTemplatesPage.test.tsx`, `AqueductRunsPage.test.tsx`,
  `RunInspector.test.tsx`.
- Templates service: `templates/tests/unit/test_orchestration_interface.py`,
  `templates/tests/integration/test_prefect_backend.py`.

## Related devlogs

- `2026-05-08-aqueduct-templates-contract-fix.md` — the original 16-bug
  contract alignment.
- This file — operator runbook (#17 from the punch list).
