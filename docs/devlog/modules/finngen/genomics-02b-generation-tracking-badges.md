# Genomics #2.5 — Generation tracking + per-source badges + confidence

**Date:** 2026-04-16
**Builds on:** Genomics #1, #1.5, #2

## What this closes

Genomics #2 (commit `6a2cb4a78`) shipped end-to-end FinnGen endpoint
generation against any CDM, but the deferred-gaps list called out three
things:

1. No tracking — researchers couldn't see at a glance which
   (endpoint × source) pairs had been generated already
2. Success redirected away from the browser, with no return path
3. The `expected_concept_counts` returned by the API was unused on the
   frontend

This commit fills all three.

## Surface

### Migration — `app.finngen_endpoint_generations`

```sql
CREATE TABLE app.finngen_endpoint_generations (
  id                    BIGSERIAL    PRIMARY KEY,
  endpoint_name         VARCHAR(120) NOT NULL,
  source_key            VARCHAR(64)  NOT NULL,
  cohort_definition_id  BIGINT       NOT NULL,
  run_id                VARCHAR(26)  NOT NULL,
  last_subject_count    INTEGER      NULL,
  last_status           VARCHAR(24)  NOT NULL DEFAULT 'queued',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ... ON (endpoint_name, source_key);
```

Composite-unique on `(endpoint_name, source_key)`. Migrator owns the
table; explicit GRANT block to `parthenon_app` for SELECT/INSERT/
UPDATE/DELETE per the PG role-split protocol. The DO block guards
the GRANT statements behind a `parthenon_app` role check so dev
compose stacks (no role split) still apply cleanly.

### Backend

- `FinnGenEndpointGeneration` model — `belongsTo(Run)` relation,
  fillable whitelist (HIGHSEC §3.1), integer casts.
- `EndpointBrowserController::generate()` — upserts a tracking row at
  dispatch time. The composite-unique index ensures one row per
  (endpoint, source) pair; the `updateOrCreate` refreshes
  `cohort_definition_id`, `run_id`, and `last_status` on every new
  dispatch.
- `loadGenerationsFor($name)` — reads tracking rows for one endpoint,
  reconciles `last_status` + `last_subject_count` against the current
  `Run.status` + `Run.summary.subject_count` on every read, and
  persists drift back to the cache. No background sync job needed.
- `show()` returns the reconciled `generations[]` array.
- `index()` batch-loads tracking rows for the visible page (single
  `whereIn` query, no N+1) and attaches `generations[]` to each row.

### Frontend

- `EndpointGeneration` type added to `api.ts`; both `EndpointSummary`
  and `EndpointDetail` now expose `generations[]`.
- `EndpointRow` — per-source `GenerationBadge` pills appear under each
  row when generations exist:
  - **Teal** for `succeeded`
  - **Amber** for `running`
  - **Rose** for `failed` / `cancelled`
  - Slate for queued/unknown
  - Each pill shows `SOURCE_KEY 1234` (subject count formatted with
    locale separator); hover tooltip surfaces run id + status
- Detail drawer — new **Generation history** section above the
  GeneratePanel listing each source with status badge + subject count +
  finished-at timestamp.
- `GeneratePanel` — **confidence indicator** above the source picker:
  - "Strong match expected" (teal) for FULLY_MAPPED
  - "Partial match expected" (amber) for PARTIAL
  - "Sparse match — best-effort" (orange) for SPARSE
  - Detail line surfaces `expected_concept_counts` ("X conditions + Y
    drugs + Z source codes will be searched") so researchers know
    what the worker is actually about to do.

## Design decision: upsert-on-dispatch + reconcile-on-read

Considered but rejected: a background job that listens for `Run`
terminal-status transitions and writes back to the tracking table.

The simpler path used here:
- Dispatch writes a `queued` row pointing at the new `run_id`
- `show()` and `index()` reconcile against the live `Run.summary` on
  every read (cheap single join via Eloquent eager loading)
- If reconciliation finds drift (run finished, subject_count now
  available), persist back to the tracking table

Why this is better for genomics #2 scale:
- No duplicate state to drift
- No job lifecycle management (Horizon retries, queue stalls)
- Cohort generation is researcher-initiated and infrequent — the
  reconciliation read cost is negligible
- The tracking table acts as an index, not a source of truth — the
  truth lives in `Run.summary` and `{source_results}.cohort`

## Live verification

```
psql verify:
  app.finngen_endpoint_generations populated:
    E4_DM2 / PANCREAS / cdef=969 / run=01kpcdzv562fmf5efm4nkv4xfc /
    last_status=succeeded / last_subject_count=135

GET /api/v1/finngen/endpoints/E4_DM2:
  generations: [{
    source_key: "PANCREAS",
    run_id: "01kpcdzv562fmf5efm4nkv4xfc",
    status: "succeeded",
    subject_count: 135,
    finished_at: "2026-04-17T00:38:29-04:00"
  }]

GET /api/v1/finngen/endpoints?per_page=3:
  data[*].generations: [] for endpoints without history (correct shape)
```

## Honest residuals

- The badges only show the **most recent** run per (endpoint, source)
  pair. A full history view (multiple runs per source, with their
  outcomes) would require a separate `finngen_endpoint_generation_runs`
  table or a query against the existing `finngen_runs` table filtered
  by analysis_type + cohort_definition_id. Not needed today; cheap
  follow-up if researchers ask for it.
- The reconciliation path persists drift inside `show()`. If a research
  user pages through 100 endpoints and 50 of them have stale cached
  status, that's 50 writes during the page render. Not a concern at
  current scale; if it becomes one, the writes can be moved to a queue.
- The "Use in Workbench manually" link in the no-resolved-concepts
  guard still goes to `/workbench/cohorts` rather than pre-seeding the
  workbench with this endpoint's tags. Cheap follow-up.

## Commits

- This commit: tracking table, model, controller updates, frontend
  badges + history + confidence indicator
- Migration applied as `parthenon_migrator` via direct artisan
  invocation (deploy.sh's bare-migrate is correctly blocked by the
  AppServiceProvider guard)
- Backfilled E4_DM2/PANCREAS row from the earlier successful run
  (01kpcdzv562fmf5efm4nkv4xfc) to validate the read path

## References

- `docs/devlog/modules/finngen/genomics-02-endpoint-generation.md`
- `docs/devlog/modules/finngen/genomics-01b-resolver-fixes-and-browser.md`
- `docs/devlog/modules/finngen/genomics-01-endpoint-import.md`
