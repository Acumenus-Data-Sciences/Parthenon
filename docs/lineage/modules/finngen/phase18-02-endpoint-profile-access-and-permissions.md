# Phase 18 Plan 02 — endpoint_profile_access table + Spatie permissions

**Date:** 2026-04-19
**Requirements:** GENOMICS-09, GENOMICS-10, GENOMICS-11
**Phase:** 18 — Risteys-style endpoint dashboard
**Wave:** 1

## What shipped

A single idempotent migration (`2026_04_22_000100_create_endpoint_profile_access_and_permissions.php`)
that lays the foundation for the endpoint-profile drawer:

1. **`finngen.endpoint_profile_access`** — lightweight access log with composite
   PK on `(endpoint_name, source_key)`, a descending index on
   `last_accessed_at`, and `TIMESTAMPTZ` timestamps. Upserted by the
   `TrackEndpointProfileAccess` middleware (Plan 18-04) on every drawer open;
   read by `WarmEndpointProfilesCommand` (Plan 18-07) to pick stale
   (endpoint × source) pairs for the nightly warm at 02:00.

2. **HIGHSEC §4.1 three-tier grants** — applied inside a role-existence-guarded
   `DO $grants$` block so the migration stays portable across dev, CI, and
   production:
   - `parthenon_app` → DML + USAGE on schema
   - `parthenon_finngen_rw` → DML
   - `parthenon_finngen_ro` → SELECT

3. **Spatie permissions + role assignments:**
   - `finngen.endpoint_profile.view` → researcher, data-steward, admin,
     super-admin, **viewer**. Viewer is included per Phase 18 D-08/D-09
     because cached profile data is aggregate (no PHI).
   - `finngen.endpoint_profile.compute` → researcher, data-steward, admin,
     super-admin (viewer excluded — mirrors the `finngen.prs.compute`
     precedent from Phase 17).

Everything commits inside a single `DB::transaction` per Phase 13.1 D-01
single-transaction invariant. `RoleDoesNotExist` is caught so the migration
applies cleanly on fresh CI bootstraps where `RolePermissionSeeder` has not
yet run — Spatie's `givePermissionTo` is idempotent, so the seeder picking up
the assignments on first run afterward is safe.

## Model + seeder updates (Plan 18-02 Task 2)

- `App\Models\FinnGen\EndpointProfileAccess` — new Eloquent model on the
  `finngen` connection with `$fillable` whitelist (HIGHSEC §3.1, T-18-02
  mitigation). Composite PK declared via `$primaryKey = ['endpoint_name',
  'source_key']` with `$incrementing = false`.
- `RolePermissionSeeder::PERMISSIONS` gains `'finngen.endpoint_profile' =>
  ['view', 'compute']`. The `admin`, `researcher`, `data-steward`, and
  `viewer` role lists are extended so a fresh bootstrap reproduces the
  same matrix the migration applies.

## Threat coverage

- **T-18-01** (EoP — missing permission gate): seeds the two permissions
  that Plan 18-04 attaches via `permission:…` route middleware.
- **T-18-02** (Tampering — mass assignment on new Eloquent model): the
  `EndpointProfileAccess` model uses `$fillable`; no `$guarded = []`.
- **T-18-05** (DoS — access-log writes): composite PK makes the upsert
  cheap; Plan 18-04 wraps the middleware insert in try-catch per CLAUDE.md
  Gotcha #12 to avoid poisoning the request transaction.

## Verification

- `php artisan migrate --env=testing --path=database/migrations/2026_04_22_000100_*`
  applies cleanly (~15ms).
- `SELECT 1 FROM finngen.endpoint_profile_access LIMIT 1` succeeds after migrate.
- `SELECT name FROM app.permissions WHERE name LIKE 'finngen.endpoint_profile.%'`
  returns both rows.
- Pint + PHPStan level 8 green on the migration, model, and seeder.

## Next

Plan 18-03 provisions the per-source `{source}_co2_results` schema +
`EndpointExpressionHasher` + 4 additional Eloquent models; Plan 18-04 wires
the dispatch + middleware using the permissions seeded here.
