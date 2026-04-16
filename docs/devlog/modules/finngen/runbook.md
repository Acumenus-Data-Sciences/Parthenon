# FinnGen SP1 — Ops Runbook

Operational playbook for the FinnGen Runtime Foundation. Covers deployment, health checks, diagnostics, rollback, and routine maintenance.

**Spec:** `docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md`
**Devlog:** `sp1-runtime-foundation.md`

## Quick diagnostics

```bash
# 1. Is Darkstar reachable + FinnGen packages loaded?
curl -s http://localhost:8787/health | jq '.finngen'
# Expected: { "packages_loaded": ["ROMOPAPI","HadesExtras","CO2AnalysisModules"], "load_errors": [] }

# 2. Laravel-side smoke test
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:smoke-test'
# Exits 0 with "✓ FinnGen runtime healthy" on success

# 3. Route manifest sanity check
docker compose exec php sh -c 'cd /var/www/html && php artisan route:list --path=finngen'
# Expected: ~14 routes under /api/v1/finngen/ with correct middleware stack

# 4. Horizon queue status
# Browse to https://parthenon.acumenus.net/horizon (super-admin only)
# Look for `finngen` supervisor; supervised queue should be responsive

# 5. Artifact volume status (darkstar side)
docker compose exec darkstar sh -c 'stat -c "%U:%G %a %n" /opt/finngen-artifacts && du -sh /opt/finngen-artifacts/runs 2>/dev/null'
# Expected: ruser:ruser 2775 and a size reported
```

## Artisan commands (SP1 ships 6)

| Command | Cadence | Purpose |
|---|---|---|
| `finngen:smoke-test` | on demand | Verify Darkstar reachable + 3 packages loaded |
| `finngen:prune-runs [--dry-run]` | nightly 03:45 | 90-day GC on unpinned finished runs |
| `finngen:sweep-artifacts [--dry-run]` | weekly Sun 04:00 | Reconcile artifact volume against runs table |
| `finngen:reconcile-orphans [--dry-run] [--mode=periodic|boot]` | every 15 min + boot | Fix orphaned runs whose polling died |
| `finngen:pause-dispatch [--clear|--status]` | on demand | Emergency rollback lever — 503 new runs |
| `finngen:snapshot-openapi` | CI | Write route manifest JSON for drift detection |

All commands support `--dry-run` for verification before mutating.

## Deployment (spec §7.2)

**Pre-merge checklist:**
- [ ] All tests green (backend 100/100, frontend foundation 13/13)
- [ ] Pint + PHPStan clean on FinnGen files
- [ ] `docker compose config --quiet` passes
- [ ] Branch rebased on latest main
- [ ] Devlog summarizes deviations from spec
- [ ] HIGHSEC §2.3 route-addition checklist ticked in PR description

**Deploy order:**

```bash
# 1. Pre-deploy verification
git status  # clean + on feature branch
./scripts/db-backup.sh  # confirm backup ran

# 2. DB migrations — A2 role creation needs claude_dev; subsequent runs under parthenon_migrator
# The A2 role-creation migration is gated by CREATEROLE which only claude_dev has.
PGPASSWORD=$(pass claude_dev_pg) psql -h localhost -U claude_dev -d parthenon -f /dev/stdin << 'SQL'
\i /dev/stdin
SQL
# OR run from within the php container with DB_USERNAME overridden:
docker compose exec -T -e DB_USERNAME=claude_dev -e DB_PASSWORD="$CLAUDE_DEV_PW" \
    php sh -c 'cd /var/www/html && php artisan migrate --path=database/migrations/2026_04_13_014502_create_finngen_db_roles.php --force'

# Subsequent FinnGen migrations (C1) use parthenon_migrator normally:
./deploy.sh --db

# 3. Docker image rebuild
# Darkstar rebuilds to install 3 FinnGen R packages + s6 init (~25 min first time; subsequent builds cache)
docker compose build darkstar

# Nginx picks up the new default.conf.template automatically on next compose up

# 4. Volume creation (idempotent via compose)
docker compose up -d

# 5. Service restart order
# Darkstar first — must be up before php starts polling
docker compose up -d darkstar
sleep 45  # s6 boot + R package precompile
curl -s http://localhost:8787/health | jq '.finngen.load_errors'
# Expected: []

# Then php + horizon + nginx
docker compose up -d php horizon nginx

# 6. Caches
docker compose exec php sh -c 'cd /var/www/html && php artisan config:clear && php artisan cache:clear && php artisan route:clear'

# 7. Frontend rebuild (picks up new /finngen/* types from regenerated api.generated.ts)
./deploy.sh --frontend

# 8. Post-deploy verification
curl -s https://parthenon.acumenus.net/api/v1/health | jq '.finngen'
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:smoke-test'
# Expected: both pass

# Check Horizon registered the new finngen supervisor
docker compose exec php sh -c 'cd /var/www/html && php artisan horizon:list'
# Expected: a `finngen` supervisor listed alongside existing ones
```

## Rollback (spec §7.3)

**Preferred path — git revert the merge commit:**

```bash
git revert <sp1-merge-sha> && ./deploy.sh
```

**Caveats:**

- **DB migrations are additive.** The new tables (`app.finngen_runs`, `app.finngen_analysis_modules`) don't affect existing flows if unused. Revert leaves empty tables — acceptable. DO NOT run `migrate:rollback` — project rule forbids destructive migrations without explicit authorization.
- **PG roles stay.** `parthenon_finngen_ro`/`_rw` have no ownership; safe to leave.
- **R packages stay installed** on Darkstar. They don't interfere with existing HADES packages. Monthly HADES audit will list them.
- **Artifact volume** stays empty/small on rollback. Safe.

**Pause-dispatch (emergency rollback lever):**

If Darkstar is broken but php deployed, new runs will accumulate in `failed` state (transport errors). Use:

```bash
# Block new POST /api/v1/finngen/runs (returns 503)
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:pause-dispatch'

# When ready to resume:
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:pause-dispatch --clear'

# Check current state:
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:pause-dispatch --status'
```

The pause flag is stored in Laravel Cache (Redis). Setting/clearing takes effect on the next request; no restart required.

## Common failure scenarios

### Darkstar package load errors

Symptom: `curl /health | jq '.finngen.load_errors'` is not empty.

Diagnosis:
```bash
# Read the container logs for the s6 boot sequence
docker compose logs darkstar --tail 200 | grep -E "S6|error|ROMOPAPI|HadesExtras|CO2AnalysisModules"

# Re-check package availability
docker compose exec darkstar Rscript -e \
    'library(ROMOPAPI); library(HadesExtras); loadNamespace("CO2AnalysisModules"); cat("ok\n")'
```

If a package failed to install: rebuild Darkstar (`docker compose build darkstar`) with fresh remote refs.

### Orphaned runs

Symptom: `finngen_runs.status` = `running` but Horizon worker has exited.

Diagnosis + fix:
```bash
# Dry-run to see what would be reconciled
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:reconcile-orphans --dry-run'

# Actually reconcile (periodic mode — > 2 min stale)
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:reconcile-orphans'

# Boot mode — fresh orphans from worker-pool startup
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:reconcile-orphans --mode=boot'
```

### Artifact volume full

Symptom: `DARKSTAR_R_DISK_FULL` errors in Loki; `finngen.disk.full` telemetry.

Diagnosis + fix:
```bash
# Check usage
docker compose exec darkstar sh -c 'du -sh /opt/finngen-artifacts/runs && df -h /opt/finngen-artifacts'

# Prune older than 90 days, unpinned
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:prune-runs --dry-run'
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:prune-runs'

# Weekly sweeper catches orphaned directories
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:sweep-artifacts --dry-run'
docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:sweep-artifacts'
```

If still tight, lower `FINNGEN_GC_RETENTION_DAYS` in `backend/.env` + restart.

### Idempotency Redis outage

Symptom: `finngen.idempotency.redis_down` telemetry; double-submits go through.

Diagnosis:
```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan tinker --execute="echo Illuminate\Support\Facades\Redis::connection()->ping() . PHP_EOL;"'
```

The middleware degrades OPEN on Redis outage (accepts requests without dedupe). This is intentional: availability > dedupe. Fix the Redis outage; no FinnGen-specific action needed.

### Inspect a failed run

```bash
# Get run details (as admin or owner)
curl -sH "Authorization: Bearer $TOKEN" https://parthenon.acumenus.net/api/v1/finngen/runs/{id} | jq '{status, error, darkstar_job_id, reconciled_count}'

# If R-side error: look up the category
# DARKSTAR_R_DB_CONNECTION_FAILED → verify source_key + PG roles
# DARKSTAR_R_DB_SCHEMA_MISMATCH   → vocab/cdm tables missing (unseeded source)
# DARKSTAR_R_OUT_OF_MEMORY        → JVM heap; check darkstar container memory
# DARKSTAR_R_ANALYSIS_EXCEPTION   → read error.message + stack
# DARKSTAR_R_MIRAI_TASK_CRASHED   → callr process died (check darkstar logs)
# DARKSTAR_R_TIMEOUT              → analysis exceeded wall-clock; bump Horizon timeout if needed
# DARKSTAR_R_DISK_FULL            → see above

# Look up the artifact directory (may have partial outputs + progress.json)
docker compose exec darkstar ls -la /opt/finngen-artifacts/runs/{run_id}/
docker compose exec darkstar cat /opt/finngen-artifacts/runs/{run_id}/result.json
docker compose exec darkstar tail /opt/finngen-artifacts/runs/{run_id}/progress.json
```

### Clear idempotency cache entries

Occasionally you may want to force a re-submit (e.g., a stuck idempotency entry pointed at a failed response):

```bash
docker compose exec redis sh -c 'redis-cli --scan --pattern "finngen:idem:*" | xargs -r redis-cli del'
```

## Monthly HADES audit extension

Parthenon's `scripts/darkstar-version-check.sh` audits HADES package versions. SP1 adds the 3 FinnGen packages to the audit list. Run monthly:

```bash
./scripts/darkstar-version-check.sh
# Expected output includes:
#   ROMOPAPI: 0.1.2  (or whatever pinned commit reports)
#   HadesExtras: 2.1.0
#   CO2AnalysisModules: 1.x
```

If a package version drifts from the committed Dockerfile pin, investigate + bump deliberately.

## Horizon observations

The `finngen` supervisor (added by C13) has `timeout=7200` (2h), `max_processes=2` on production, `max_processes=1` on local. CodeWAS on SynPUF-scale data can take 15-60 min; the 2h ceiling has healthy headroom.

In Horizon UI (`/horizon`):
- "Queues" should list `finngen` alongside `default`, `cohort`, `analytics`
- `finngen` job failure rate should track telemetry: transient 4xx/5xx from Darkstar → retried; R-classified errors → fail fast

## Telemetry

FinnGen emits structured events to Loki (via Laravel's default log channel):

```
finngen.run.created
finngen.run.started
finngen.run.progressed     (throttled to 1/min)
finngen.run.succeeded
finngen.run.failed         (fields: wrapper_code, darkstar_code, r_class, forced_cancel)
finngen.run.canceled
finngen.idempotency.missing     (audit warning — client didn't send key)
finngen.idempotency.redis_down  (Redis outage — see above)
finngen.gc.pruned               (nightly — count + bytes_freed)
finngen.sweep.completed         (weekly — runs_marked_pruned + zombie_dirs_removed + bytes_freed)
finngen.orphan.reconciled       (15-min — mode + count + total_stale)
finngen.cancel.forced           (60s ceiling — for future mirai-based endpoints)
finngen.disk.full               (alert — artifact volume full)
finngen.artifact.missing        (404 on artifact endpoint — indicates DB/FS drift)
```

Grafana dashboard for these is NOT built in SP1 — noted as follow-up. Loki queries work now.

## Where FinnGen artifacts live

```
/opt/finngen-artifacts/          # volume mount
└── runs/
    └── {run_id}/                # ULID — app.finngen_runs.id
        ├── params.json          # request body echoed back (reproducer)
        ├── progress.json        # newline-delimited JSON, rotating buffer (cap 500 lines)
        ├── result.json          # run_with_classification output (ok=true|false)
        ├── summary.json         # per-analysis summary (row counts, cohort ids, etc.)
        ├── log.txt              # stdout/stderr capture
        └── results.duckdb       # DuckDB artifact for CodeWAS/overlaps etc.
```

Owner: `ruser:ruser` (Darkstar's non-root user). Mode: directories `2775` (setgid), files `664`. PHP reads world-readable; signed-URL controller gates access.

## Deferred to SP2-4 (for reference)

- SP2: ROMOPAPI React Code Explorer UI
- SP3: Analysis Module Gallery UI + DuckDB-wasm results
- SP4: Cohort Workbench (drag-and-drop + matching + Atlas import)

See `docs/superpowers/specs/2026-04-12-finngen-workbench-subprojects-handoff.md` for the full handoff.

## Links

- **Spec:** `docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-12-finngen-runtime-foundation.md`
- **Sub-project handoff:** `docs/superpowers/specs/2026-04-12-finngen-workbench-subprojects-handoff.md`
- **SP1 devlog:** `docs/devlog/modules/finngen/sp1-runtime-foundation.md`
- **HIGHSEC rules:** `.claude/rules/HIGHSEC.spec.md`
- **PG role model:** `~/.claude/memory/project_parthenon_pg_roles.md`
- **Darkstar infra:** `~/.claude/memory/reference_parthenon_infra.md`

---

## SP2 — Code Explorer source initialization

Before `/api/v1/finngen/code-explorer/counts` returns data for a source, the
source must have `stratified_code_counts` materialized via ROMOPAPI. This is
a one-time-per-source admin action:

```bash
# PANCREAS (Pancreatic Cancer Corpus) — default researcher-facing source
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan finngen:setup-source PANCREAS'
```

The command:
- Dispatches a `romopapi.setup` async run via `FinnGenRunService::create`
- Polls for terminal state (press Ctrl+C to detach; the run continues in background)
- Prints progress step + percentage + message as they land

Alternative admin-UI path: go to any Investigation → left rail → "Code Explorer" → pick source → click "Initialize source" banner button. Requires `finngen.code-explorer.setup` permission (admin or super-admin role).

**Duration estimates** (measured on beastmode, 2026-04-15):
- PANCREAS (361 persons): ~67s → 2,439 rows in stratified_code_counts, 62 distinct concepts
- Eunomia (GiBleed demo): ~30s-2min
- SynPUF (2.3M persons): ~30-90min
- Acumenus (1M persons): ~20-60min

**Idempotent:** ROMOPAPI uses `CREATE TABLE IF NOT EXISTS` under the hood, so repeat runs are safe.

**GRANTs:** The setup worker now issues `GRANT SELECT ON ALL TABLES IN SCHEMA <results> TO parthenon_finngen_ro, parthenon_app` + `ALTER DEFAULT PRIVILEGES` after materialization. Before 2026-04-15 these had to be applied manually via psql after setup.

**Rollback:** To drop the table manually: `DROP TABLE {results_schema}.stratified_code_counts` — next `/counts` call returns `FINNGEN_SOURCE_NOT_INITIALIZED` until re-initialized.

**Why PANCREAS, not EUNOMIA:** EUNOMIA is a demo (GiBleed, ~100 patients, no genomics). PANCREAS has 361 patients with the OMOP Oncology extension + genomics, so it's the canonical source for FinnGen researcher flows. EUNOMIA remains useful for fast unit-test setup.
