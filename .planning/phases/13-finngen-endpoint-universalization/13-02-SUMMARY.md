---
phase: 13-finngen-endpoint-universalization
plan: 02
subsystem: database
tags: [laravel, migrations, postgres, finngen, highsec, coverage_profile, rollback_snapshot]

# Dependency graph
requires:
  - phase: 13
    provides: "13-01 wave-0 red tests reference app.cohort_definitions.coverage_profile + app.finngen_endpoint_expressions_pre_phase13 as expected schema targets"
provides:
  - "app.cohort_definitions.coverage_profile VARCHAR(16) column (NULL-able) + btree index"
  - "app.finngen_endpoint_expressions_pre_phase13 rollback snapshot table (cohort_definition_id PK, jsonb expression_json, snapshotted_at default NOW())"
  - "HIGHSEC §4.1 explicit GRANTs to parthenon_app on both new objects, guarded by pg_roles existence check"
affects:
  - "13-03 resolver upgrade (will UPDATE coverage_profile via importer pipeline)"
  - "13-04 seed migration — lands AFTER these two (timestamp 2026_04_18_000300)"
  - "13-05 CoverageProfile enum + classifier (writes the VARCHAR values universal|partial|finland_only)"
  - "13-06 importer --overwrite path (INSERT INTO finngen_endpoint_expressions_pre_phase13 SELECT FROM cohort_definitions, then UPDATE expression_json + coverage_profile)"
  - "13-07 frontend coverage-profile pill (SELECTs the column via new read API)"
  - "13-08 live re-import cutover (relies on snapshot table as rollback path)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema-qualified migration targets (Schema::table('app.cohort_definitions', ...))"
    - "HIGHSEC DO $grants$ guard pattern carried forward from 2026_04_16 + 2026_04_17 FinnGen migrations"
    - "Rollback snapshot table keyed by source PK (one row per affected entity, idempotent overwrite)"

key-files:
  created:
    - "backend/database/migrations/2026_04_18_000100_add_coverage_profile_to_cohort_definitions.php"
    - "backend/database/migrations/2026_04_18_000200_create_finngen_endpoint_expressions_pre_phase13_table.php"
  modified: []

key-decisions:
  - "VARCHAR(16) chosen for coverage_profile — 12 chars needed for 'finland_only' plus 4 char headroom; fits a btree page efficiently"
  - "Coverage_profile left NULL-able with no DB CHECK constraint — legal values (universal|partial|finland_only) enforced at app layer via Enums\\CoverageProfile per ADR-002, so the rolling re-import window doesn't break on partially-populated rows"
  - "Snapshot table primary key is cohort_definition_id (not a synthetic id) — the importer --overwrite path is idempotent: second run replaces the row rather than stacking duplicates"
  - "expression_json typed as jsonb (matches source column) so a single UPDATE FROM recovery statement works without casts"
  - "snapshotted_at uses useCurrent() (DEFAULT NOW()) so the Plan 06 INSERT can omit the column — reduces importer coupling to the snapshot schema"

patterns-established:
  - "Phase-scoped rollback snapshot tables named {feature}_pre_phase{N} — explicit milestone scoping so the snapshot is not confused with a permanent history table"
  - "Every new app.* table/column receives an explicit GRANT to parthenon_app inside a pg_roles DO-block guard — works on Docker Compose dev (no parthenon_app role) AND on prod (parthenon_migrator owns, parthenon_app runs) without branching"

requirements-completed:
  - GENOMICS-12a

# Metrics
duration: ~10 min
completed: 2026-04-17
---

# Phase 13 Plan 02: Schema migrations for coverage_profile + rollback snapshot — Summary

**Two idempotent Laravel migrations land the schema-side prerequisites for Phase 13: a typed `coverage_profile` column on `app.cohort_definitions` and the `app.finngen_endpoint_expressions_pre_phase13` rollback snapshot table, both owned by `parthenon_migrator` with explicit HIGHSEC §4.1 grants to `parthenon_app`.**

## Performance

- **Duration:** ~10 minutes
- **Started:** 2026-04-17T18:53Z
- **Completed:** 2026-04-17T18:54Z
- **Tasks:** 2 / 2
- **Files modified:** 0
- **Files created:** 2

## Accomplishments

- **Task 1 — `coverage_profile` column added.** `app.cohort_definitions` gains a `VARCHAR(16) NULL` column after `quality_tier`, mirroring the existing `quality_tier` pattern. A btree index (`cohort_definitions_coverage_profile_index`) is created so Plan 07's browser-side WHERE filter stays fast at 5,161 rows. A re-granted `SELECT, INSERT, UPDATE, DELETE` on `app.cohort_definitions` to `parthenon_app` is emitted inside the HIGHSEC `DO $grants$` guard so the ALTER does not disturb runtime permissions.
- **Task 2 — Rollback snapshot table created.** `app.finngen_endpoint_expressions_pre_phase13` now exists with six columns (`cohort_definition_id BIGINT PK`, `name VARCHAR(255)`, `expression_json JSONB`, `coverage_bucket VARCHAR(32)`, `created_at TIMESTAMP`, `snapshotted_at TIMESTAMP DEFAULT NOW()`) and a btree index on `name`. The migration docblock carries the single-statement recovery SQL so operators don't have to rediscover it during an incident.
- **HIGHSEC §4.1 compliance verified on both migrations.** Both files emit the `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app')` guard before granting — matches the canonical pattern from `2026_04_13_014502_create_finngen_db_roles.php` and `2026_04_17_000500_create_finngen_endpoint_generations_table.php`.
- **Pint-clean.** Both files pass `vendor/bin/pint --test` (verified via the main-worktree php container — see Self-Check section).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor protocol; main-branch pre-commit hooks run at orchestrator merge):

1. **Task 1: Migration — add `coverage_profile` column to `app.cohort_definitions`** — `3b314de98` (feat)
2. **Task 2: Migration — create `app.finngen_endpoint_expressions_pre_phase13` rollback snapshot table** — `c830ae465` (feat)

_Note: Migrations are **not executed** in this worktree per the orchestrator directive — Wave 5 owns the live cutover (`deploy.sh --db`). The files land here; schema state on dev PG is unchanged._

## Files Created

- `backend/database/migrations/2026_04_18_000100_add_coverage_profile_to_cohort_definitions.php` — 55 lines; `Schema::table('app.cohort_definitions', ...)` adds column + index, DO-block re-grants table-level DML to `parthenon_app`; `down()` drops index then column (correct order).
- `backend/database/migrations/2026_04_18_000200_create_finngen_endpoint_expressions_pre_phase13_table.php` — 54 lines; `Schema::create('app.finngen_endpoint_expressions_pre_phase13', ...)` builds the 6-column table with `snapshotted_at`'s `useCurrent()` default; DO-block grants DML to `parthenon_app`; `down()` issues `Schema::dropIfExists`.

## Migration Shapes

### Task 1 — `app.cohort_definitions.coverage_profile`

```
Column added via Schema::table:
  $table->string('coverage_profile', 16)->nullable()->after('quality_tier')
  $table->index('coverage_profile', 'cohort_definitions_coverage_profile_index')

Equivalent DDL (Laravel will emit):
  ALTER TABLE app.cohort_definitions
    ADD COLUMN coverage_profile VARCHAR(16) NULL AFTER quality_tier;
  CREATE INDEX cohort_definitions_coverage_profile_index
    ON app.cohort_definitions (coverage_profile);

HIGHSEC grant (idempotent):
  GRANT SELECT, INSERT, UPDATE, DELETE ON app.cohort_definitions TO parthenon_app;
```

Post-apply, existing 5,161 `domain = 'finngen-endpoint'` rows will have `coverage_profile IS NULL` until Plan 06 importer's `--overwrite` run writes them.

### Task 2 — `app.finngen_endpoint_expressions_pre_phase13`

```
Schema::create columns:
  cohort_definition_id BIGINT PRIMARY KEY       -- idempotent overwrite key
  name                 VARCHAR(255) NOT NULL
  expression_json      JSONB                    -- matches source column type
  coverage_bucket      VARCHAR(32)              -- existing per-source metric
  created_at           TIMESTAMP                -- original row birth
  snapshotted_at       TIMESTAMP DEFAULT NOW()  -- snapshot epoch

Index:
  finngen_endpoint_expressions_pre_phase13_name_index (btree on name)

HIGHSEC grant (guarded):
  GRANT SELECT, INSERT, UPDATE, DELETE ON app.finngen_endpoint_expressions_pre_phase13 TO parthenon_app;
```

Recovery SQL (documented in migration docblock):

```sql
UPDATE app.cohort_definitions cd
   SET expression_json = s.expression_json
  FROM app.finngen_endpoint_expressions_pre_phase13 s
 WHERE cd.id = s.cohort_definition_id;
```

## Deviations from Plan

**One deviation:** the plan's `<action>` block and `<verify><automated>` step include `php artisan migrate --force --path=...` and a `psql` follow-up to confirm the column/table exist on the live dev DB. The orchestrator directive in this agent's prompt explicitly overrides that ("Migrations do NOT run during execution — per plan — land only; orchestrator runs at cutover in Wave 5"). I followed the orchestrator directive and did **not** run the migrations here. Offline verification replaces the live-DB check:

- `php -l` syntax check on both files (passed)
- Content grep for required signatures (column name, index name, grant statement, schema qualifier, DO-block) — all passed
- Pint `--test` via `docker cp` into the main-worktree `parthenon-php` container (passed, no diff)

Rationale: this worktree has no running Docker services; running artisan migrate here would only update `php.migrations` on the host PG17 dev DB, which Wave 5 re-applies anyway. Deferring avoids double-apply risk and keeps the worktree a pure schema **drop** (files only) per the orchestrator's contract. This is a scope-boundary deviation (lands files, defers execution) — no CLAUDE.md or HIGHSEC rule violated.

## HIGHSEC §4.1 Verification (static)

Both migrations contain the canonical guard:

```php
DB::statement("
    DO \$grants\$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON <target> TO parthenon_app;
        END IF;
    END
    \$grants\$
");
```

Targets:
- Task 1: `app.cohort_definitions` (re-grant after ALTER — safe & idempotent)
- Task 2: `app.finngen_endpoint_expressions_pre_phase13` (first-time grant)

No sequences are created by either migration (column add + table with BIGINT PK, not BIGSERIAL), so no `GRANT USAGE, SELECT ON SEQUENCE` stanza is needed.

## Threat Flags

None. The plan's `<threat_model>` items (T-13-W1-01..04) are all addressed by existing structure:
- T-13-W1-01 (missing grants) → DO-block guards present in both files
- T-13-W1-02 (snapshot tampering) → snapshot table writes belong to Plan 06 importer only; row count verification happens in Wave 5
- T-13-W1-03 (info disclosure) → accepted per plan (no PHI in expressions)
- T-13-W1-04 (DoS during index build) → accepted per plan (5,161 rows, < 1 sec)

No new trust boundaries introduced beyond those enumerated in the plan's threat model.

## Known Stubs

None. Both files are complete production migrations; no placeholder TODOs or empty helpers.

## Self-Check: PASSED

**Files exist:**
- `backend/database/migrations/2026_04_18_000100_add_coverage_profile_to_cohort_definitions.php` — FOUND (55 lines)
- `backend/database/migrations/2026_04_18_000200_create_finngen_endpoint_expressions_pre_phase13_table.php` — FOUND (54 lines)

**Commits exist:**
- `3b314de98` — FOUND (`feat(13-02): add coverage_profile column...`)
- `c830ae465` — FOUND (`feat(13-02): create finngen_endpoint_expressions_pre_phase13 snapshot table`)

**Toolchain:**
- `php -l` on both files: no syntax errors
- `vendor/bin/pint --test` on both files (via main-worktree `parthenon-php` container): PASS, no diff

**Content assertions (per plan acceptance_criteria):**
- Schema-qualified migration targets — PASS
- `$table->string('coverage_profile', 16)->nullable()->after('quality_tier')` — PASS
- `cohort_definitions_coverage_profile_index` — PASS
- Snapshot table columns + PK + name index + default-NOW snapshotted_at — PASS
- HIGHSEC DO-block guard with `pg_roles` existence check on both migrations — PASS
- `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO parthenon_app` on both — PASS
- `down()` drops index before column (Task 1), `dropIfExists` (Task 2) — PASS

All acceptance criteria that do not require live-DB apply are satisfied. Live-DB verification is deferred to Wave 5 (`deploy.sh --db`) per orchestrator directive.
