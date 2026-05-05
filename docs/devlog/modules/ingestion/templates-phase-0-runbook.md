# Phase 0 Ingestion Templates — Operations Runbook

Operational procedures for the `parthenon-templates` service and the four
Phase 0 templates. Audience: on-call platform engineers and ETL engineers.

## Service health

```bash
# Quick health check (from any container on the compose network)
curl -s http://parthenon-templates:8000/health
# Expected: {"status":"ok",...}

# Container status
docker compose ps parthenon-templates

# Tail logs
docker compose logs -f parthenon-templates
```

If the health endpoint returns non-200, the service is degraded. Common
causes:

- Prefect ephemeral server failed to start → check container logs for
  `prefect server` and `subprocess_server_logger`.
- Registry failed to load a manifest → run
  `docker compose exec parthenon-templates parthenon-templates validate-manifests --root /app/manifests`
  and inspect the failing manifest.
- Internal-token misconfigured → check `PARTHENON_INTERNAL_TOKEN` env var
  on both the templates container and the `php`/`horizon` containers.
  They MUST match. The compose file declares the variable with `:?`, so
  a missing token aborts `docker compose up` instead of silently leaving
  it unset.

## Required environment variables

The `parthenon-templates` service reads:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PARTHENON_INTERNAL_TOKEN` | yes | (none, `:?` aborts compose) | Shared with Laravel |
| `DATABASE_URL` | yes | (none) | SQLAlchemy URL; threaded to NodeContext.db_dsn |
| `PARTHENON_STORAGE_ROOT` | yes | `/app/storage` | RW volume mount |
| `PARTHENON_ORCHESTRATION_BACKEND` | no | `prefect` | One of: `prefect`, `temporal`, `dagster`, `airflow` |
| `UMLS_API_KEY` | no | (unset) | Only if `enable_cpt4=true` in `load_athena_vocabulary` |
| `LOG_LEVEL` | no | `info` | `debug` floods Prefect ephemeral server output |

Laravel reads (config/services.php → `templates`):

| Variable | Required | Default |
|---|---|---|
| `TEMPLATES_BASE_URL` | yes | `http://parthenon-templates:8000` |
| `TEMPLATES_INTERNAL_TOKEN` | yes | (none) |
| `TEMPLATES_CONNECT_TIMEOUT` | no | 5 |
| `TEMPLATES_REQUEST_TIMEOUT` | no | 30 |

## Enabling the feature flag in production

```bash
# As super-admin, via the admin UI or:
docker compose exec -T php php artisan tinker --execute="
  \\App\\Models\\App\\AppSetting::set('ingestion.templates_enabled', true);
"
```

After flipping the flag:

1. Aqueduct sub-tabs (Templates | Runs) appear for users with
   `ingestion.view`.
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
curl -X DELETE https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/<id> \
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

# 3. Submit the run (capture token first by logging in as superadmin)
TOKEN=...
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
# Capture the template_run_id from the response

# 4. Watch the run via UI:
# https://parthenon-staging.acumenus.net/ingestion?tab=aqueduct&subtab=runs

# 5. After completion, run the validation pack
cd /opt/parthenon/templates
uv run python tests/staging/validate_pack.py manifests/load_athena_vocabulary

# 6. Commit the staging run output
echo "Run ID: $TEMPLATE_RUN_ID, Date: $(date), Duration: ..." \
  > docs/devlog/modules/ingestion/staging-runs/load_athena_vocabulary-$(date +%Y-%m-%d).md
```

## Running `load_synpuf` in staging

Pre-condition: `load_athena_vocabulary` has completed.

```bash
TOKEN=...
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
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

## Inspecting the manifest catalog

```bash
# Inside the templates container
docker compose exec parthenon-templates parthenon-templates validate-manifests --root /app/manifests
# Expected: validated 4 manifest(s) — all OK

docker compose exec parthenon-templates parthenon-templates lint-secret-keys --root /app/manifests
# Expected: lint-secret-keys: clean

# From the host
ls templates/manifests/
# Expected: hello_cdm/  load_athena_vocabulary/  load_synpuf/  nodes_test/
```

## On-call procedures

### "Where do I see failed runs?"

```bash
# Via UI:
# Aqueduct → Runs sub-tab → filter status = "failed"

# Via SQL:
docker compose exec -T postgres psql -U parthenon -d parthenon \
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
PARAMS=$(curl -s https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/${RUN_ID} \
  -H "Authorization: Bearer ${TOKEN}" | jq '.parameters')
TEMPLATE_ID=$(curl -s https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/${RUN_ID} \
  -H "Authorization: Bearer ${TOKEN}" | jq -r '.template_id')
curl -X POST https://parthenon.acumenus.net/api/v1/ingestion/templates/${TEMPLATE_ID}/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"version\": \"0.1.0\", \"parameters\": $PARAMS }"
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

# 2. Update both Laravel (backend/.env) and parthenon-templates (root .env)
#    via the secrets manager. The two MUST match.

# 3. Restart both containers. NOTE: docker compose restart does NOT pick
#    up env_file changes — must use docker compose up -d.
docker compose up -d php parthenon-templates horizon

# 4. Confirm:
docker compose exec parthenon-templates curl -s -H "X-Parthenon-Internal-Token: ${NEW_TOKEN}" \
  http://localhost:8000/templates
# Should return JSON catalog (4 entries)
```

### "Debug a stuck run"

A run is "stuck" if it stays in `running` for longer than the template's
expected budget without progress changes. Steps:

1. Get the run row from Postgres:
   ```sql
   SELECT id, template_id, status, progress, error_message,
          started_at, finished_at
   FROM app.template_runs WHERE id = <id>;
   ```
2. Pull the run logs from the templates service:
   ```bash
   curl -s https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/<id>/logs \
     -H "Authorization: Bearer ${TOKEN}"
   ```
3. If logs show no progress, look at Prefect ephemeral state inside the
   templates container:
   ```bash
   docker compose logs --tail 200 parthenon-templates | grep "<run_id>"
   ```
4. If the run cannot be recovered, cancel it:
   ```bash
   curl -X DELETE https://parthenon.acumenus.net/api/v1/ingestion/templates/runs/<id> \
     -H "Authorization: Bearer ${TOKEN}"
   ```

## Useful queries

```sql
-- Top 10 most-run templates (last 30 days)
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
