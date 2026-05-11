# Idempotent Fresh-Install Migrations

**Date:** 2026-04-16
**Scope:** Backend migrations that hard-fail on a fresh `migrate --force`

## Problem

`php artisan migrate --force` against an empty database (the path the new
`install.py --community` flow takes on first launch) crashed at five
migrations:

| Migration | Failure |
|-----------|---------|
| `2026_03_15_230000_create_finngen_runs_table` | `relation "finngen_runs" already exists` once `2026_04_13_155949_create_finngen_runs_table` runs first on the dev box but not on a fresh box |
| `2026_04_13_014502_create_finngen_db_roles` | `RuntimeException: FINNGEN_PG_RO_PASSWORD and FINNGEN_PG_RW_PASSWORD must be set` |
| `2026_04_15_000005_add_verification_to_study_design_assets_table` | `column "verification_status" already exists` — the create-table sibling (000004) was edited to include the column |
| `2026_04_15_000007_add_ranking_to_study_design_assets_table` | `column "rank_score" already exists` — same pattern |
| `2026_04_15_000008_add_materialization_to_study_design_assets_table` | `column "materialized_at" already exists` — same pattern |

These all worked on the dev machine because each migration ran when it
was first authored — its target wasn't in the create table yet — and was
recorded in `app.migrations`. Newcomers never see that history; on a
fresh box every migration runs in one batch, and the
create-table-plus-add-column pairs collide.

## Fix

Add `Schema::hasTable()` / `Schema::hasColumn()` guards that early-return
when the target already exists, and have the FinnGen roles migration
return early instead of throwing when its env vars are absent. CE/local
installs no longer need FinnGen, so the roles can be (re-)created later
by re-running the migration with the env vars set.

## Why not delete the duplicate migrations?

Both create-then-alter chains are recorded as run on existing dev
deployments. Deleting the historical migrations would make those
deployments think their schema is out of sync with the migration set.
Idempotent guards keep the migrations replay-safe for fresh installs
while leaving the recorded history intact for existing ones.
