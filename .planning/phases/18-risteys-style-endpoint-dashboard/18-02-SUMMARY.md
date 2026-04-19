---
phase: 18-risteys-style-endpoint-dashboard
plan: 02
subsystem: database
tags: [laravel, postgres, spatie-rbac, eloquent, migration, finngen, endpoint-profile, highsec]

# Dependency graph
requires:
  - phase: 13.1-finngen-schema-isolation
    provides: finngen.* schema + parthenon_app / parthenon_finngen_rw / parthenon_finngen_ro PG roles
  - phase: 17-pgs-prs
    provides: finngen.prs.compute permission-seed migration pattern (role matrix + RoleDoesNotExist guard)
  - phase: 18-risteys-style-endpoint-dashboard
    provides: Plan 18-01 Wave 0 RED Pest stubs referencing EndpointProfileAccess middleware + the two new permissions
provides:
  - finngen.endpoint_profile_access access-log table (composite PK, last_accessed_at DESC index) for the D-11 warmer
  - HIGHSEC §4.1 three-tier grants (parthenon_app DML, parthenon_finngen_rw DML, parthenon_finngen_ro SELECT) on the new table
  - Spatie permission finngen.endpoint_profile.view assigned to viewer + 4 privileged roles
  - Spatie permission finngen.endpoint_profile.compute assigned to 4 privileged roles (viewer excluded, matching finngen.prs.compute)
  - App\Models\FinnGen\EndpointProfileAccess Eloquent model on the finngen connection with $fillable whitelist
  - RolePermissionSeeder PERMISSIONS + role-list extensions so fresh CI bootstraps reproduce the matrix
affects: [18-03, 18-04, 18-07]

# Tech tracking
tech-stack:
  added: []  # no new composer / npm deps — seeder extension + migration only
  patterns:
    - "Single DB::transaction per Phase 13.1 D-01 invariant — table DDL + HIGHSEC grants + Spatie permission seeding commit atomically"
    - "Fresh-bootstrap-safe Spatie seeding — try / catch RoleDoesNotExist so migration runs clean on CI where RolePermissionSeeder has not yet run; seeder picks assignments up later (givePermissionTo is idempotent)"
    - "HIGHSEC §4.1 three-tier DO $grants$ block with role-existence guards — portable across dev / CI / prod"
    - "New App\\Models\\FinnGen\\ namespace — clean separation from legacy App\\Models\\App\\FinnGen\\* family for Phase 18 additions"

key-files:
  created:
    - backend/database/migrations/2026_04_22_000100_create_endpoint_profile_access_and_permissions.php
    - backend/app/Models/FinnGen/EndpointProfileAccess.php
    - docs/devlog/modules/finngen/phase18-02-endpoint-profile-access-and-permissions.md
  modified:
    - backend/database/seeders/RolePermissionSeeder.php  # + finngen.endpoint_profile permissions and role-list entries for admin/researcher/data-steward/viewer

key-decisions:
  - "Primary-key representation on EndpointProfileAccess: scalar 'endpoint_name' (not list<string>) — PHPStan level-8 covariance with Model::\$primaryKey; DB enforces the real composite PK via the migration's PRIMARY KEY (endpoint_name, source_key) constraint. Upserts pass both columns as match criteria in Plan 18-04's middleware."
  - "Viewer role GETS finngen.endpoint_profile.view — aggregate cached profile data is non-PHI per 18-CONTEXT.md D-08/D-09. Viewer does NOT get compute, matching the finngen.prs.compute precedent from Phase 17."
  - "New App\\Models\\FinnGen\\ namespace instead of extending existing App\\Models\\App\\FinnGen\\* — plan prescribed the path; Phase 18 additions stay cohesive in one directory without mixing with the legacy endpoint-definition / workbench-session family."

patterns-established:
  - "Phase 18 access-log convention: composite natural key (entity_name, source_key) + TIMESTAMPTZ last_accessed_at + access_count INT + descending index on last_accessed_at. Reusable for any future per-source access log."
  - "Permission + access-log combo migration — single file seeds the RBAC gate AND creates the audit/warm-signal table in one transaction so downstream controllers never see a half-migrated state."

requirements-completed: [GENOMICS-09, GENOMICS-10, GENOMICS-11]  # Plan 18-02 provides the RBAC + access-log foundation; behavioral requirements complete when plans 18-03..07 land

# Metrics
duration: 10min
completed: 2026-04-19
---

# Phase 18 Plan 02: endpoint_profile_access table + Spatie permissions Summary

**Atomic migration creates finngen.endpoint_profile_access + seeds finngen.endpoint_profile.{view,compute} permissions across the 5-role matrix; EndpointProfileAccess Eloquent model and RolePermissionSeeder extension land alongside so Plan 18-03/04/07 can consume them.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-19T18:11:35Z
- **Completed:** 2026-04-19T18:21:50Z
- **Tasks:** 2
- **Files created:** 3 (migration, model, devlog)
- **Files modified:** 1 (seeder)

## Accomplishments
- `finngen.endpoint_profile_access` table shipped with composite PK `(endpoint_name, source_key)` and descending index on `last_accessed_at`, ready for the Plan 18-04 middleware upsert and the Plan 18-07 nightly warmer.
- HIGHSEC §4.1 three-tier grants applied on the new table via role-existence-guarded `DO $grants$` block — portable across dev / CI / production where `parthenon_app` / `parthenon_finngen_rw` / `parthenon_finngen_ro` may or may not exist yet.
- Spatie permissions `finngen.endpoint_profile.view` (5 roles incl. viewer — aggregate data is non-PHI) and `finngen.endpoint_profile.compute` (4 roles, viewer excluded) seeded by the migration AND codified in `RolePermissionSeeder` so fresh CI bootstraps reproduce the same matrix.
- `App\Models\FinnGen\EndpointProfileAccess` Eloquent model lives on the `finngen` connection with `$fillable` whitelist (HIGHSEC §3.1 / T-18-02). DB composite PK is enforced by the table constraint; model exposes `endpoint_name` as scalar `$primaryKey` to stay covariant with `Model::$primaryKey` for PHPStan level 8.
- Phase 18 devlog entry created under `docs/devlog/modules/finngen/` so the pre-commit migration-gate is satisfied and the audit trail is discoverable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration (table + grants + permissions) in single txn** — `654f533aa` (feat)
2. **Task 2: EndpointProfileAccess model + RolePermissionSeeder extension** — `64c463548` (feat)

_Plan metadata commit will follow this SUMMARY write alongside STATE.md + ROADMAP.md updates._

## Files Created/Modified

- `backend/database/migrations/2026_04_22_000100_create_endpoint_profile_access_and_permissions.php` — Idempotent single-transaction migration. Creates `finngen.endpoint_profile_access`, applies HIGHSEC §4.1 grants, and seeds the two Spatie permissions + role assignments. `down()` reverses cleanly (delete permissions, `DROP TABLE IF EXISTS`).
- `backend/app/Models/FinnGen/EndpointProfileAccess.php` — Eloquent model on the `finngen` connection. `$fillable = ['endpoint_name', 'source_key', 'last_accessed_at', 'access_count']`; `$casts` for `datetime` + `integer`; `$incrementing = false`; scalar `$primaryKey = 'endpoint_name'` with doc explaining the true composite PK is DB-enforced.
- `backend/database/seeders/RolePermissionSeeder.php` — PERMISSIONS map gains `'finngen.endpoint_profile' => ['view', 'compute']`. admin / researcher / data-steward role lists each gain both permissions (on split lines so grep-based acceptance checks pass). viewer list gains `finngen.endpoint_profile.view` only. super-admin stays on the wildcard.
- `docs/devlog/modules/finngen/phase18-02-endpoint-profile-access-and-permissions.md` — Devlog capturing the migration contract, role matrix, and threat-model coverage; satisfies the pre-commit hook's migration-pairs-devlog gate.

## Decisions Made

- **Primary-key strategy on the Eloquent side:** expose `endpoint_name` as scalar `$primaryKey` (not `list<string>`) so the model stays covariant with `Illuminate\Database\Eloquent\Model::$primaryKey` under PHPStan level 8. The real composite PK `(endpoint_name, source_key)` is enforced by PostgreSQL via the migration's `PRIMARY KEY` constraint; Plan 18-04's middleware will upsert by passing both columns as match criteria (`updateOrCreate([endpoint_name => ..., source_key => ...], ...)` or `DB::table(...)->upsert(..., ['endpoint_name', 'source_key'])`). No need to fight Eloquent's non-native composite-key support.
- **Viewer role gets `.view` but not `.compute`:** matches the Phase 17 `finngen.prs.compute` precedent and 18-CONTEXT.md D-08/D-09 — cached profile payloads are aggregate (KM step points, comorbidity ranks, ATC3 subject counts) with no per-subject identifiers, so viewers can read them, but compute dispatch remains gated to the 4 privileged roles.
- **New `App\Models\FinnGen\` namespace** (not `App\Models\App\FinnGen\`): plan prescribed the path; downstream Plan 18-03 introduces 4 more profile-related models and grouping them under a fresh namespace keeps Phase 18 additions cohesive without mixing with the legacy `EndpointDefinition` / `EndpointGwasRun` family in `App\Models\App\FinnGen\*`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug / level-8 type covariance] Relaxed `$primaryKey` from `list<string>` to scalar `'endpoint_name'`**
- **Found during:** Task 2 (PHPStan verification of `EndpointProfileAccess`)
- **Issue:** Plan's action spec set `protected $primaryKey = ['endpoint_name', 'source_key']` with `@var list<string>`, but `Illuminate\Database\Eloquent\Model::$primaryKey` is typed as `string` at parent level. PHPStan level 8 rejected this with `property.phpDocType` (not covariant).
- **Fix:** Set `protected $primaryKey = 'endpoint_name'` and documented the true composite PK in PHPDoc as DB-enforced. Upserts in Plan 18-04 will pass both columns as match criteria, which is the standard Laravel pattern for composite-keyed tables.
- **Files modified:** `backend/app/Models/FinnGen/EndpointProfileAccess.php`
- **Verification:** PHPStan level 8 reports `[OK] No errors`; Pint clean; model still resolves to the correct DB table with the DB-level composite PK intact.
- **Committed in:** `64c463548` (Task 2 commit)

**2. [Rule 3 — Blocking / pre-commit hook] Created Phase 18 devlog entry alongside migration**
- **Found during:** Task 1 (first `git commit` attempt)
- **Issue:** Pre-commit hook `scripts/githooks/pre-commit` rejects migration commits without a paired `docs/devlog/` or `CHANGELOG` entry. The hook is newer than the Phase 17 migrations in history (which committed without devlog entries), so the plan did not anticipate it.
- **Fix:** Created `docs/devlog/modules/finngen/phase18-02-endpoint-profile-access-and-permissions.md` documenting the migration contract, role matrix, and threat coverage. Staged alongside the migration.
- **Files created:** `docs/devlog/modules/finngen/phase18-02-endpoint-profile-access-and-permissions.md`
- **Verification:** `git commit` succeeded with `Pre-commit: all checks passed.` banner.
- **Committed in:** `654f533aa` (Task 1 commit)

**3. [Rule 1 — Bug / acceptance-check false positive] Rewrote PHPDoc wording to avoid `$guarded = []` literal inside a comment**
- **Found during:** Task 2 (acceptance-criteria grep `! grep -q 'guarded = \[\]' ...`)
- **Issue:** Initial PHPDoc contained the cautionary phrase `"never $guarded = []"`. The literal substring matched the grep-based acceptance check, producing a false-positive failure even though the actual code path uses `$fillable`.
- **Fix:** Reworded to `"the anti-pattern of wide-open guarded arrays is forbidden by HIGHSEC §3.1"` — preserves the security note without embedding the forbidden literal.
- **Files modified:** `backend/app/Models/FinnGen/EndpointProfileAccess.php`
- **Verification:** `! grep -q 'guarded = \[\]' backend/app/Models/FinnGen/EndpointProfileAccess.php` now exits 0.
- **Committed in:** `64c463548` (Task 2 commit)

**4. [Rule 1 — Bug / acceptance-check line granularity] Split role-list permissions onto separate lines**
- **Found during:** Task 2 (acceptance criterion: researcher role grep for `finngen.endpoint_profile` must return ≥2 counted lines)
- **Issue:** Initial edit put both permissions on one line (`'finngen.endpoint_profile.view', 'finngen.endpoint_profile.compute',`), which satisfies runtime semantics but returns only `1` from `grep -c` (line-based counting).
- **Fix:** Split the two permissions onto separate lines across the admin / researcher / data-steward role lists. (Viewer already had only `.view` on one line.)
- **Files modified:** `backend/database/seeders/RolePermissionSeeder.php`
- **Verification:** `grep -A 25 "'researcher' =>" ... | grep -c 'finngen.endpoint_profile'` returns 2; seeder still runs clean on `parthenon_testing`; matrix is unchanged at the Spatie level.
- **Committed in:** `64c463548` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 PHPStan covariance, 1 pre-commit hook satisfaction, 2 acceptance-check literal fixes)
**Impact on plan:** All four are minor robustness tweaks — the migration + model + seeder behave exactly as the plan specified. No scope creep, no architectural shift.

## Issues Encountered
- `php artisan migrate --pretend --env=testing ...` throws `PostgresProcessor: Undefined array key 0` when the migration wraps a closure doing `Permission::firstOrCreate` inside `DB::transaction`. Worked around by running the actual migrate (not --pretend) against `parthenon_testing`; the table + permissions were verified directly via `psql`. Not a bug in the migration — `--pretend` cannot capture the SELECT `Permission::firstOrCreate` issues inside a closure. Noted for future migrations using this pattern.

## User Setup Required
None — no external services. Infrastructure roles (`parthenon_app`, `parthenon_finngen_rw`, `parthenon_finngen_ro`) already exist from Phase 13.1 + Phase 14 migrations; grants are applied automatically by this migration.

## Next Phase Readiness
- **Plan 18-03** can now import `App\Models\FinnGen\EndpointProfileAccess` alongside its new 4 Eloquent models (Summary / KmPoint / Comorbidity / DrugClass) and build the `Co2SchemaProvisioner` + `EndpointExpressionHasher`.
- **Plan 18-04** has both permissions available for `permission:finngen.endpoint_profile.view` / `.compute` middleware on the new routes, and the access-log table ready for `TrackEndpointProfileAccess` middleware upserts (with try-catch per CLAUDE.md Gotcha #12 to avoid PG transaction poisoning).
- **Plan 18-07** `WarmEndpointProfilesCommand` can query `finngen.endpoint_profile_access WHERE last_accessed_at > NOW() - INTERVAL '14 days'` to pick pairs for nightly warm.
- **No blockers**; Wave 1 foundation is complete.

## Self-Check: PASSED

All five expected files present on disk; both task commit hashes (`654f533aa`, `64c463548`) present in git history.

---
*Phase: 18-risteys-style-endpoint-dashboard*
*Completed: 2026-04-19*
