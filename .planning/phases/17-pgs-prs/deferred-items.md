# Phase 17 — Deferred Items

Items discovered during plan execution but deemed OUT OF SCOPE for the current plan. Scheduled for Phase 17.1 cleanup or an adjacent phase.

---

## From Plan 17-03 (2026-04-19)

### 1. RolePermissionSeeder catalog update

**Discovered:** Plan 17-03 Task 2 Pest suite.

**Issue:** `Database\Seeders\RolePermissionSeeder::PERMISSIONS` + `ROLES` hardcode the permission list; `syncPermissions()` wipes+re-syncs, so permissions added via Spatie migration (like Plan 17-01's `finngen.prs.compute`) are dropped whenever the seeder runs in tests.

**Current workaround:** `PrsDispatchTest::beforeEach` re-attaches `finngen.prs.compute` to researcher + data-steward + admin + super-admin.

**Resolution:** Update `RolePermissionSeeder::PERMISSIONS` to include the `finngen` domain (`workbench.use`, `prs.compute`) and add `finngen.prs.compute` to the 4 authorized role arrays. Remove the test shim after.

**Owner:** Plan 17.1.

**Priority:** Low (test-only cosmetic; does not affect production runtime).

---

### 2. `EndpointGenerateCohortIdTest` fixture collision

**Discovered:** Plan 17-03 regression sweep.

**Issue:** `tests/Feature/FinnGen/EndpointGenerateCohortIdTest.php` fails with `SQLSTATE[23505] duplicate key on endpoint_definitions_pkey TEST_ENDPOINT` when run repeatedly in the shared `parthenon_testing` DB without a reset.

**Cause:** The test inserts `TEST_ENDPOINT` in `beforeEach` without cleaning up a prior row. `RefreshDatabase` usage is disabled by Phase 13.1's isolate_finngen_schema migration compatibility.

**Resolution:** Add an explicit `EndpointDefinition::query()->where('name', 'TEST_ENDPOINT')->delete()` at the top of `beforeEach` (or use `updateOrCreate` instead of `create`).

**Owner:** Plan 17.1 (or adjacent cleanup sprint).

**Priority:** Low (test-only; isolated to 3 tests; does not affect CI on fresh DBs).

---

### 3. R testthat suite for `prs_compute.R`

**Discovered:** Plan 17-03 Task 1 completion.

**Issue:** No R-side unit tests for `finngen_prs_compute_execute` (plink2 argv construction, SQL escaping, .sscore parsing).

**Resolution per RESEARCH §Open Question 6:** Plan 07 smoke-gen is the E2E test for the worker; separate testthat is out of scope for Phase 17.

**Owner:** Deferred indefinitely unless a Plan 07 smoke-gen failure isolates a worker defect that a unit test would have caught.

**Priority:** None (accepted architectural trade-off).
