# Installer Task 2 Fixes — 2026-04-23

## Summary

Bug fixes for `omop:register-source` artisan command and its test suite.

## Changes

### Migration idempotency fix (`isolate_finngen_schema`)

The `2026_04_19_000100_isolate_finngen_schema.php` migration's Block 1b
idempotency guard was incomplete. It dropped post-rename `finngen.*` table
names but not the pre-rename `finngen.finngen_*` names that survive a partial
migration run (SET SCHEMA completed, RENAME did not). On `migrate:fresh`
re-entry this caused `SQLSTATE[42P07]: relation "finngen_runs" already exists
in schema "finngen"`. Extended the guard to drop both name forms.

### Test isolation (`RegisterSourceCommandTest`)

Switched from `DatabaseTransactions` to `RefreshDatabase` to match the
codebase standard for `app.*` table tests. Needed the migration fix above to
pass.

### Input validation (`RegisterSourceCommand`)

Added explicit guards for `--host` and `--database` options — both are
required to build a usable connection string. Returns `FAILURE` (exit 1) when
either is missing.

### Code quality

- Added `declare(strict_types=1)` to both the command and test files.
- Added a test case covering the new host/database guard.
