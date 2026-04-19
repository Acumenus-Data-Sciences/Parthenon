# FinnGen CI Stabilization

## Summary

Stabilized the FinnGen and installer CI path after the FinnGen development merge.

## Changes

- Moved vocabulary table migrations onto the `vocab` connection so OMOP clinical and vocabulary schemas stay isolated during fresh CI migrations.
- Hardened the Phase 13.1 FinnGen schema isolation migration for full migrate, rollback, and re-migrate cycles.
- Guarded archived legacy FinnGen run migrations so mid-suite `migrate` calls cannot recreate superseded `finngen_runs` tables after the current `finngen.runs` schema exists.
- Updated FinnGen tests for the isolated `finngen` schema, shared test PDO behavior, and current endpoint/profile contracts.
- Fixed frontend FinnGen endpoint browser tests and Recharts tooltip type errors that blocked CI typechecking.
- Expanded the FinnGen GitHub Actions database bootstrap to create every schema used by the migration stack.

## Validation

- Fresh local test database migration completed successfully.
- Targeted FinnGen/backend Pest subset passed: 58 tests, 363 assertions.
- Focused RegionalView Vitest passed: 6 tests.
- Frontend TypeScript check passed with `npx tsc --noEmit`.
