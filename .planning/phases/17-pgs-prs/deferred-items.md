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

---

## From Plan 17-07 (2026-04-19 DEV cutover)

### 4. `finngen:prepare-source-variants --register-only` flag

**Discovered:** Plan 17-07 Task 4 — PANCREAS had no row in `app.finngen_source_variant_indexes`; the existing command tried to re-run plink2 from inside the `php` container, where `plink2` is not installed (lives in `darkstar` at `/opt/regenie/plink2`).

**Workaround applied during cutover:** Direct superuser INSERT into `app.finngen_source_variant_indexes` citing the pre-built `/opt/finngen-artifacts/variants/pancreas/*` artifacts.

**Resolution:** Add `--register-only` (or rename `--artifacts-only`) that skips VCF→PGEN + PC computation and registers the DB row from a pre-built prefix. Alternative: move the command into the `darkstar` container and expose it via a plumber endpoint.

**Owner:** Plan 17.1 (or Phase 14 cleanup sprint).

**Priority:** Medium — blocks any source onboarding where the operator pre-builds PGEN out-of-band.

---

### 5. `source_variant_indexes.source_key` case normalization

**Discovered:** Plan 17-07 Task 4 — `PrsDispatchService::dispatch` queries via `where('source_key', strtolower($sourceKey))` but `finngen:prepare-source-variants` stores whatever case the CLI caller provides. Inserted `'PANCREAS'` uppercase → lookup found 0 rows → 422 error misleadingly claimed no variant_index existed.

**Resolution:** Either (a) add `CHECK (source_key = lower(source_key))` to the table, or (b) normalize at write-time in `PrepareSourceVariantsCommand`, or (c) make the dispatch lookup case-insensitive (`whereRaw('lower(source_key) = ?', [strtolower(…)])`).

**Owner:** Plan 17.1.

**Priority:** Low — diagnostic confusion only, easy operator workaround.

---

### 6. `CohortPrsController::index` generic-cohort lookup

**Discovered:** Plan 17-07 Task 5 — histogram endpoint uses `CohortDefinition::findOrFail($id)`; the FinnGen smoke-gen cohort `100000000001` is an offset-keyed endpoint generation explicitly absent from `app.cohort_definitions` (per T-13.2-S3). Forced a mirror to user cohort 249 for populated-state evidence.

**Resolution:** Accept FinnGen offset-keyed cohort_ids by checking `id > 100000000000 ⇒ look up FinnGenEndpointGeneration` path, OR ship a dedicated `/finngen/endpoints/{name}/prs?cohort_id=…/histogram` read endpoint that resolves via `FinnGenEndpointGeneration`.

**Owner:** Plan 17.1.

**Priority:** Medium — affects every FinnGen-cohort user who wants to see PRS after dispatch.

---

### 7. PANCREAS genotype overlap with real PGS Catalog rsIDs

**Discovered:** Plan 17-07 Task 4 — PGS000001's 77 real rsIDs (`rs78540526`, `rs75915166`, …) do not exist in PANCREAS's synthetic PGEN whose rsIDs are `rs_synth_{chrom}_{pos}`. plink2 `--score` rejected all 77 variants as "missing". Unblocked SC-2 via PGS999999 overlay.

**Resolution options:**

1. **Regenerate PANCREAS from 1000G-based reference** — gives real rsIDs but changes Phase 14's synthetic-data posture (may conflict with the "pancreas is demo data" model).
2. **Ship `parthenon:pgs-catalog-lift-over`** — rsid-agnostic joiner on `(chrom, pos_grch38, effect_allele)` that rewrites weights.tsv to use the PANCREAS `rs_synth_*` IDs when they match chr:pos:alt.
3. **Accept as PANCREAS-only limitation** — real CDM sources (SYNPUF, Acumenus CDM) should have real genotypes whose rsIDs intersect PGS Catalog. Add a pre-dispatch variant-overlap check that 422s early rather than waiting for plink2 exit 13.

**Owner:** Phase 19 candidate, or Plan 17.1 if option (3) is chosen.

**Priority:** Medium for PANCREAS specifically; does not block production sources.

---

### 8. `deploy.sh` Darkstar restart guard false-positive

**Discovered:** Plan 17-07 Task 2 — `clear_runtime_caches` skipped the Darkstar restart because `curl /jobs/list` returned HTTP 500. The route's 500 response meant "jobs endpoint unhealthy", not "jobs exist", but the guard interpreted it conservatively. Required manual `docker compose restart darkstar` to pick up the new `/finngen/prs/compute` route.

**Resolution:** Treat HTTP 500 on `/jobs/list` as "assume no active jobs, proceed with restart after 5s grace" — the current posture (skip-on-uncertainty) protects long-running analyses but blocks every Phase 17-style route deploy.

**Owner:** Plan 17.1 or an `infra` maintenance PR.

**Priority:** Low — manual workaround is documented.
