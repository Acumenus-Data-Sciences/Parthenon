---
doc_type: runbook
status: active
date: 2026-06-21
owner: acumenus
module: infrastructure
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/app/Console/Commands/SidecarReadinessCommand.php
  - backend/app/Http/Controllers/Api/V1/HealthController.php
  - deploy.sh
  - docs/lineage/operations/2026-06-21-test-skip-inventory.md
---

# Environment Readiness Matrix & Promotion Gates

Closes the Phase 0 item "Record the runtime readiness matrix" and the Phase 8 item
"Define environment promotion gates for local, staging, and production." It builds
on `php artisan sidecars:readiness` (runtime sidecar probe) and the
[test skip inventory](2026-06-21-test-skip-inventory.md) (which modules are
hosted-only).

## Part A — Service readiness matrix

| Service | Readiness check | Local Docker | Hosted staging | Production |
|---|---|---|---|---|
| Backend API | `GET /api/health` (canonical; `HealthController`) | required | required | required |
| Frontend assets | `frontend/dist/` built + served by nginx/Apache | `deploy.sh --frontend` | required | required (Apache) |
| Postgres | connection + migrations current | required | required | required |
| Redis / queues | `sidecars:readiness` (redis PING) + Horizon up | required | required | required |
| darkstar (R/HADES) | `sidecars:readiness` (`/health`, required) | optional | required | required |
| python-ai | `sidecars:readiness` (`/health`, required) | optional | required | required |
| Solr | `/solr/<core>/admin/ping` | optional | required | required |
| Orthanc / PACS | `sidecars:readiness` (reachability) | optional | hosted smoke | hosted smoke |
| hecate / fhir-to-cdm / templates | `sidecars:readiness` (reachability) | optional | required | required |
| anonymizer / SciSpaCy / Llettuce | (no app-side probe; ingestion-template stack) | optional | hosted smoke | hosted smoke |
| Representative CDM data | row-count probes (see skip inventory) | optional | hosted smoke | required for clinical flows |

"hosted smoke" = validated by a hosted smoke test rather than a local gate; see the
env-required clusters in the skip inventory.

## Part B — Promotion gates

A build promotes from one tier to the next only when **all** gates for the target
tier pass. Each gate has a concrete, reproducible check.

| Gate | Check (command / signal) | local→staging | staging→prod |
|---|---|---|---|
| Backend health | `curl -fsS $BASE/api/health` → 200 (deploy.sh already smoke-checks this) | required | required |
| Frontend asset deployment | `deploy.sh --frontend` builds `dist/`; `dist/index.html` present and served (never `npm run build` as the release path) | required | required |
| Queue workers | Horizon running; `php artisan horizon:status` healthy; `queue:restart` signaled on deploy | required | required |
| Database migrations | `php artisan migrate --pretend` clean (no pending) after `deploy.sh --db` | required | required |
| AI / analysis sidecars | `php artisan sidecars:readiness` exits 0 (darkstar + python-ai + redis ready) | required | required |
| Representative CDM data | CDM row-count probe non-zero for the flows the tier serves | optional | required for clinical flows |
| PACS / DICOMweb | Orthanc reachable + a hosted PACS smoke (credentials, stats, study browser) | hosted smoke | hosted smoke |
| Ingestion template smoke | `cd templates && uv run pytest -q` green (env-bound skips documented) | required | required |
| Bounded test lanes | `cd backend && composer test` green | required | required |

### Running the gate

```bash
# Runtime sidecar gate (non-zero exit blocks promotion)
docker compose exec -T php php artisan sidecars:readiness --json

# Bounded test gate
cd backend && composer test            # unit → integration → feature lanes
cd templates && uv run pytest -q       # ingestion templates

# Backend health smoke (deploy.sh performs this automatically)
curl -fsS https://<host>/api/health
```

## Notes

- The `sidecars:readiness` command treats darkstar, python-ai, and redis as
  **required** (non-zero exit) and the rest as reachability-only, so it is safe to
  wire directly into a CI/promotion step.
- anonymizer / SciSpaCy / Llettuce have no app-side readiness probe today (they
  live in the ingestion-template stack); their promotion signal is the templates
  pytest smoke plus the hosted-only clusters noted in the skip inventory.
- Production frontend is served by Apache from `frontend/dist/`; a promotion that
  changes the frontend must run `deploy.sh --frontend`, not the Vite dev server.
