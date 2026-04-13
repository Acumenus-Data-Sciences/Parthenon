# FinnGen SP1 — Task C1: `finngen_runs` + `finngen_analysis_modules` migrations

**Date:** 2026-04-13
**Branch:** `feature/finngen-sp1-runtime-foundation`
**Plan:** `docs/superpowers/plans/2026-04-12-finngen-runtime-foundation.md` — Part C / Task C1

## What

Created the Laravel schema for the SP1 FinnGen runtime foundation:

- `app.finngen_runs` — ULID PK, user-owned, run lifecycle state (status, params,
  artifacts, progress, error, Horizon/Darkstar job correlation), GC + reconciler
  support columns, partial indexes on active-status and GC candidates, two
  CHECK constraints (valid status enum + terminal-state requires `finished_at`).
- `app.finngen_analysis_modules` — module registry (key PK, label, Darkstar
  endpoint, RBAC `min_role`, SP3-populated schema/component columns).

## Migrations added

1. `2026_04_13_155948_drop_old_finngen_runs_table.php` — drops the superseded
   StudyAgent-era `app.finngen_runs` (bigserial, `service_name`, `source_id`,
   `investigation_id`, …) and removes its prior migration entries from
   `app.migrations` so the SP1 schema can own the name. This is the schema half
   of C14's StudyAgent removal; the old `FinnGenRun` model + service classes
   are deleted in C14 itself.
2. `2026_04_13_155949_create_finngen_runs_table.php`
3. `2026_04_13_155949_create_finngen_analysis_modules_table.php`

Both CREATE migrations `SET LOCAL ROLE parthenon_owner` before DDL so default
privileges auto-grant DML to `parthenon_app` (per 2026-04-12 PG role model).
Without the role switch, `parthenon_migrator` creates tables it owns
exclusively, leaving the runtime role with zero access — caught during
verification and corrected before commit.

## Verification

- Tables inspected with `\d app.finngen_runs` and
  `\d app.finngen_analysis_modules` via `claude_dev` on host PG17 — all
  columns, types, defaults, PK, FK (→ `app.users` ON DELETE CASCADE),
  4 indexes (including 2 partial), and 2 CHECK constraints match spec §4.3/§4.4.
- `php artisan migrate:status` shows all three new migrations as `Ran`.
- Grants confirmed: `parthenon_app` has SELECT/INSERT/UPDATE/DELETE on both
  tables (auto-granted via default privileges after ownership reassignment).

## Follow-ups (not in C1)

- C2 adds Eloquent models (`Run`, `AnalysisModule`).
- C3 seeds the module registry.
- C14 deletes `backend/app/Models/App/FinnGenRun.php` and the old StudyAgent
  service classes.
