# Care Bundles Workbench — Migration & Permission Fixes

**Date:** 2026-04-24

## What happened

The `feat(care-bundles)` commit (2eeaf9d) was made with `--no-verify`, leaving 6 migrations pending. This caused all CareBundles workbench action buttons to fail silently.

## Root causes fixed

1. **Migrations never ran** — Tables and permissions didn't exist.
2. **Wrong table ownership** — New tables created by `parthenon_migrator` instead of `parthenon_owner`; default privileges didn't fire so `parthenon_app` had no DML access. Fixed: manual GRANTs on prod + `SET ROLE parthenon_owner` added to each DDL migration `up()`.
3. **Coverage query** — `coverageMatrix()` joined from `care_bundle_qualifications` (empty for zero-patient runs), so zero-count cells never appeared. Fixed: drive query from `care_bundle_current_runs → care_bundle_runs` using the stored `qualified_person_count`.
4. **Soft-delete validation** — `exists:sources,id` allowed soft-deleted sources; `findOrFail()` then threw 404. Fixed: `exists:sources,id,deleted_at,NULL` in `MaterializeBundleRequest`, `IntersectionRequest`, and the controller inline rule.

## CI fix (2026-04-24, session 2)

- `RESET ROLE` added after each `Schema::create()` in migrations 100-400 so
  Laravel's migration recorder `INSERT INTO migrations` runs as the session
  user, not `parthenon_owner` (was causing `SQLSTATE[42501]` locally and
  aborting all subsequent migration steps in CI).
- Conditional `DO $$ ... IF EXISTS (SELECT 1 FROM pg_roles ...) SET ROLE $$`
  pattern ensures CI (no `parthenon_owner` role) skips the role switch silently.
- `GRANT REFERENCES` on each referenced table added before FK creation to
  satisfy PostgreSQL constraint when running as `parthenon_owner`.
- `LoadVocabularyCommand::handle()` returns `self::SUCCESS` (0) when
  prerequisites are validated — was returning `self::INVALID` (2), breaking
  two `LoadVocabularyCommandTest` assertions.

## CI fix (2026-04-24, session 3)

- Replaced bare `try { GRANT } catch {}` blocks with SAVEPOINT/ROLLBACK TO
  SAVEPOINT pattern in all four care-bundle migrations. A failed GRANT (when
  `parthenon_owner` does not exist in CI) poisoned the PostgreSQL transaction
  even though PHP caught the exception — subsequent `SQLSTATE[25P02]` aborted
  the entire migration. SAVEPOINTs isolate each GRANT failure to its own
  mini-rollback, leaving the outer transaction intact.
