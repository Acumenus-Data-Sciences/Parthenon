# Care Bundles Workbench — Migration & Permission Fixes

**Date:** 2026-04-24

## What happened

The `feat(care-bundles)` commit (2eeaf9d) was made with `--no-verify`, leaving 6 migrations pending. This caused all CareBundles workbench action buttons to fail silently.

## Root causes fixed

1. **Migrations never ran** — Tables and permissions didn't exist.
2. **Wrong table ownership** — New tables created by `parthenon_migrator` instead of `parthenon_owner`; default privileges didn't fire so `parthenon_app` had no DML access. Fixed: manual GRANTs on prod + `SET ROLE parthenon_owner` added to each DDL migration `up()`.
3. **Coverage query** — `coverageMatrix()` joined from `care_bundle_qualifications` (empty for zero-patient runs), so zero-count cells never appeared. Fixed: drive query from `care_bundle_current_runs → care_bundle_runs` using the stored `qualified_person_count`.
4. **Soft-delete validation** — `exists:sources,id` allowed soft-deleted sources; `findOrFail()` then threw 404. Fixed: `exists:sources,id,deleted_at,NULL` in `MaterializeBundleRequest`, `IntersectionRequest`, and the controller inline rule.
