# FinnGen C1 migrations — portable grants fix (2026-04-13)

## Problem

The two C1 FinnGen create-table migrations (from commit `87a6a3a4d`) called
`DB::statement('SET LOCAL ROLE parthenon_owner')` before `CREATE TABLE`, so
default privileges of `parthenon_owner` would auto-grant DML to `parthenon_app`.
This worked on the dev `parthenon` DB but broke elsewhere:

- **CI** (`.github/workflows/ci.yml`) — creates `parthenon_testing` owned by
  the `parthenon` role with no `parthenon_owner` / `parthenon_app` roles
  provisioned. `SET ROLE` fails outright.
- **Local `parthenon_testing`** — `parthenon_owner` exists but has no
  privileges on the `app` schema (owned by `smudoshi`/`claude_dev`). The
  `SET ROLE` succeeds but `CREATE TABLE` fails.

Downstream effect: 23 existing Pest tests couldn't run migrations against
the test DB.

## Fix

Removed `SET LOCAL ROLE parthenon_owner` from both create migrations. Tables
are now created by whoever runs the migration (`parthenon_migrator` in prod,
`smudoshi` or `parthenon` in test/CI). Ownership no longer matters because
each migration now emits explicit, conditional grants at the end of `up()`:

```sql
DO $grants$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON app.<table> TO parthenon_app;
    END IF;
    -- finngen_runs also grants SELECT to parthenon_finngen_ro/_rw when present
END
$grants$
```

The `pg_roles` guard makes the GRANT a no-op in environments that don't
provision the runtime roles (CI).

## Affected files

- `backend/database/migrations/2026_04_13_155949_create_finngen_runs_table.php`
- `backend/database/migrations/2026_04_13_155949_create_finngen_analysis_modules_table.php`

The `drop_old_finngen_runs_table.php` migration was untouched (no SET ROLE
in it).

## Verification

- Dev DB: drop + re-run → all 3 migrations clean; `parthenon_app` has
  SELECT/INSERT/UPDATE/DELETE; `parthenon_finngen_ro|rw` have SELECT on
  `finngen_runs`.
- Test DB (`parthenon_testing` as `smudoshi`): drop + re-run clean.
- 330 unit tests pass.
- C4 `FinnGenSourceContextBuilderTest` still 8/8 passing AFTER revoking the
  out-of-band `GRANT CREATE, USAGE ON SCHEMA app TO parthenon_owner` hot-patch
  that had been applied to the test DB to make C4 work.
- Pint + PHPStan level 8 clean on both migrations.
