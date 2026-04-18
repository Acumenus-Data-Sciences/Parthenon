# Phase 15-01 — GWAS tracking table + generation-history index

**Date:** 2026-04-18
**Plan:** [15-01-PLAN.md](../../../../.planning/phases/15-gwas-dispatch-run-tracking-and-generation-history/15-01-PLAN.md)
**Builds on:** Phase 14 (regenie infrastructure), Phase 13.1 (finngen schema isolation)

## What this ships

Wave 0 foundation for Phase 15 (GWAS dispatch, run tracking, and
generation history). Three deliverables on disk:

1. `finngen.endpoint_gwas_runs` — one row per GWAS dispatch. Phase 15's
   `POST /api/v1/finngen/endpoints/{name}/gwas` auto-chains step-1 +
   step-2 behind one tracking row so the PheWeb-lite deep-link and the
   drawer's "GWAS runs" section have a single polling target.
2. `finngen_runs_endpoint_name_idx` — partial expression index on
   `finngen.runs` supporting the D-18 filtered generation-history query
   that surfaces every endpoint-generation run in the drawer (not just
   the latest).
3. HIGHSEC §4.1 grants — `parthenon_app` / `parthenon_finngen_rw` get
   full DML; `parthenon_finngen_ro` gets SELECT. All guarded by
   `pg_roles` existence checks so the migration stays portable across
   dev / CI / prod.

## Surface — `finngen.endpoint_gwas_runs`

```sql
CREATE TABLE finngen.endpoint_gwas_runs (
    id                        BIGSERIAL    PRIMARY KEY,
    endpoint_name             TEXT         NOT NULL,
    source_key                TEXT         NOT NULL,
    control_cohort_id         BIGINT       NOT NULL,
    covariate_set_id          BIGINT       NOT NULL,
    run_id                    VARCHAR(26)  NOT NULL,              -- step-2 ULID → finngen.runs.id
    step1_run_id              VARCHAR(26)  NULL,                  -- null when step-1 cache hit
    case_n                    INTEGER      NULL,                  -- observer-backfilled
    control_n                 INTEGER      NULL,
    top_hit_p_value           DOUBLE PRECISION NULL,
    status                    TEXT         NOT NULL DEFAULT 'queued',
    superseded_by_tracking_id BIGINT       NULL
        REFERENCES finngen.endpoint_gwas_runs(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finished_at               TIMESTAMPTZ  NULL,
    CONSTRAINT finngen_endpoint_gwas_runs_status_chk
        CHECK (status IN ('queued','running','succeeded','failed','canceled','superseded'))
);
```

### Indexes (5)

- `finngen_endpoint_gwas_runs_unique_idx` — UNIQUE
  `(endpoint_name, source_key, control_cohort_id, covariate_set_id, run_id)`.
  Allows superseded rows to coexist with the replacement.
- `finngen_endpoint_gwas_runs_endpoint_source_idx` — drawer lookup.
- `finngen_endpoint_gwas_runs_run_id_idx` — reverse lookup from a
  `finngen.runs` row (observer path).
- `finngen_endpoint_gwas_runs_step1_run_id_idx` — partial, used by the
  observer when a step-1 run status changes.
- `finngen_endpoint_gwas_runs_control_cohort_idx` — for future
  cohort-detail views.

### FK posture

- **No FK** on `run_id` → `finngen.runs.id` per D-13 (ULID mismatch risk
  during concurrent load). The observer enforces linkage at runtime.
- Self-referencing FK on `superseded_by_tracking_id` with
  `ON DELETE SET NULL` supports the overwrite=true supersede chain.

## Surface — `finngen_runs_endpoint_name_idx`

```sql
CREATE INDEX finngen_runs_endpoint_name_idx
    ON finngen.runs ((params->>'endpoint_name'), analysis_type, source_key, created_at DESC)
 WHERE analysis_type IN ('endpoint.generate','gwas.regenie.step1','gwas.regenie.step2');
```

Partial + expression index on the JSONB path. Keeps the drawer's
generation-history query fast on a growing `finngen.runs` without
indexing every row (partial filter limits rows to the three relevant
analysis types).

## HIGHSEC grants

Three-tier, guarded by `pg_roles` existence:

- `parthenon_app` — SELECT/INSERT/UPDATE/DELETE on table +
  USAGE/SELECT on sequence.
- `parthenon_finngen_rw` — same as `parthenon_app`.
- `parthenon_finngen_ro` — SELECT only.

Verified on host PG17:

```
SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
  FROM information_schema.role_table_grants
 WHERE grantee='parthenon_app' AND table_schema='finngen'
   AND table_name='endpoint_gwas_runs';
-- DELETE,INSERT,SELECT,UPDATE
```

## What's next (Wave 1)

- `EndpointGwasRun` Eloquent model on the `finngen` connection (this
  plan — Task 2).
- 8 typed exception classes for the precondition ladder + ownership
  guard (this plan — Task 3).
- Wave 1 plans (02/03/04) ship `GwasRunService::dispatchFullGwas()`, the
  observer backfill, and the `EndpointBrowserController::gwas()` route.
