---
phase: 17-pgs-prs
plan: 01
subsystem: database
tags: [migrations, schema, vocab, rbac, highsec, prs, spatie, pgs-catalog, gwas-schema]

# Dependency graph
requires:
  - phase: 13.1-finngen-schema-isolation
    provides: "parthenon_migrator role + cross-schema FK pattern"
  - phase: 13.2-finish-finngen-cutover
    provides: "100B-offset cohort_definition_id convention, role-split codification"
  - phase: 14-regenie-gwas-infrastructure
    provides: "GwasSchemaProvisioner, {source}_gwas_results schema pattern, 3-tier HIGHSEC grants"
provides:
  - "vocab.pgs_scores catalog table (PGS Catalog metadata)"
  - "vocab.pgs_score_variants catalog table (per-variant weights, composite PK)"
  - "parthenon_migrator CREATE privilege on vocab schema (resolves RESEARCH CRITICAL pitfall)"
  - "GwasSchemaProvisioner extended to provision prs_subject_scores alongside summary_stats"
  - "finngen.prs.compute Spatie permission gated to researcher/data-steward/admin/super-admin"
  - "16 Pest assertions covering tables, FK, PK, indexes, HIGHSEC grants; 5 assertions covering RBAC seeding"
affects: [17-02 LoadPgsCatalogCommand, 17-03 PrsDispatchService, 17-04 R worker, 17-05 histogram API, 17-07 deploy runbook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vocab-schema CREATE grant prerequisite migration (000050 pattern for future vocab.* DDL)"
    - "Preflight has_schema_privilege check with operator remediation message"
    - "GwasSchemaProvisioner sibling-table extension (summary_stats + prs_subject_scores co-created)"
    - "Cross-schema FK idiom: {source}_gwas_results.* → vocab.* ON DELETE CASCADE"

key-files:
  created:
    - backend/database/migrations/2026_04_25_000050_grant_vocab_create_to_migrator.php
    - backend/database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php
    - backend/database/migrations/2026_04_25_000200_seed_prs_permissions.php
    - backend/tests/Feature/FinnGen/PgsCatalogMigrationTest.php
    - backend/tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php
    - backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php
  modified:
    - backend/app/Services/FinnGen/GwasSchemaProvisioner.php

key-decisions:
  - "Vocab CREATE grant shipped as a dedicated prerequisite migration (000050) rather than bundled into the table-creation migration — keeps the failure mode loud and the remediation path obvious for operators."
  - "Preflight has_schema_privilege check in 000100 throws RuntimeException with exact sudo command if 000050 was skipped — fails fast with actionable error instead of opaque 'permission denied for schema vocab'."
  - "Composite PK (score_id, chrom, pos_grch38, effect_allele) on vocab.pgs_score_variants enables ON CONFLICT DO NOTHING idempotent ingestion for multi-allelic/strand-flipped duplicates."
  - "GwasSchemaProvisioner extension appends prs_subject_scores inside the existing DB::transaction closure, preserving single-txn atomicity with summary_stats. Both tables share schema lifecycle."
  - "Cross-schema FK prs_subject_scores.score_id → vocab.pgs_scores natively works in PG17; no schema-isolation violation since vocab is shared reference data (Phase 13.1 precedent)."
  - "No FK on prs_subject_scores.cohort_definition_id by design — accommodates both app.cohort_definitions.id (user cohorts) and 100B-offset FinnGen generation keys (Phase 13.2 D-01)."
  - "finngen.prs.compute gated to researcher + data-steward + admin + super-admin; viewer excluded (read-only access to existing histograms via profiles.view, no new compute)."

patterns-established:
  - "Vocab DDL prerequisite migration: GRANT CREATE + has_schema_privilege verify + RuntimeException with remediation command (reusable for future vocab.* tables)."
  - "Sibling-table co-provisioning in GwasSchemaProvisioner: two tables in one transaction, independent grants blocks, both idempotent."

requirements-completed: [GENOMICS-06, GENOMICS-07, GENOMICS-08]

# Metrics
duration: ~50min
completed: 2026-04-19
---

# Phase 17 Plan 01: PGS/PRS Wave 1 Foundation Summary

**Shipped the schema + RBAC foundation that unblocks every Phase 17 downstream plan: vocab.pgs_scores + vocab.pgs_score_variants catalog tables, {source}_gwas_results.prs_subject_scores provisioner extension, and the finngen.prs.compute Spatie permission — all HIGHSEC §4.1 grants applied, all 16+5 Pest tests green, zero Phase 14 regressions.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-04-18T23:22:00Z
- **Completed:** 2026-04-19T00:12:28Z
- **Tasks:** 3 / 3
- **Files created:** 6
- **Files modified:** 1 (GwasSchemaProvisioner.php)
- **Total LOC added:** 779 (migrations + service + tests)

## Accomplishments

- **Resolved the RESEARCH.md CRITICAL pitfall** (vocab schema not owned by parthenon_migrator) with a dedicated prerequisite migration that grants CREATE defensively and throws with an operator remediation command if the grant did not land. This unblocks every future Phase 17+ migration that touches vocab.*
- **Created vocab.pgs_scores + vocab.pgs_score_variants** with full PGS Catalog metadata shape, composite PK enabling idempotent re-ingestion, intra-vocab FK with ON DELETE CASCADE, and HIGHSEC §4.1 grants (parthenon_app SELECT only, parthenon_finngen_rw/ro SELECT only, parthenon_migrator owns).
- **Extended GwasSchemaProvisioner** to provision prs_subject_scores alongside summary_stats in the same transaction — no breaking change to Phase 14 behavior (GwasSchemaProvisionerTest + GwasSchemaGrantsTest still pass 9/9). Cross-schema FK to vocab.pgs_scores works natively in PG17.
- **Seeded finngen.prs.compute** across 4 roles; viewer explicitly excluded per D-17 (viewers read histograms via profiles.view, cannot dispatch compute).

## Task Commits

Each task was committed atomically on branch `worktree-agent-af2017ec` (merge target: main):

1. **Task 1: GRANT CREATE on schema vocab to parthenon_migrator** — `d31fe96f8` (feat)
   - `backend/database/migrations/2026_04_25_000050_grant_vocab_create_to_migrator.php` (70 LOC)
   - `backend/tests/Feature/FinnGen/PgsCatalogMigrationTest.php` (114 LOC, includes Task 1 assertion + Task 2 placeholders)
2. **Task 2: vocab.pgs_* tables + GwasSchemaProvisioner extension** — `0e07112af` (feat)
   - `backend/database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php` (133 LOC)
   - `backend/app/Services/FinnGen/GwasSchemaProvisioner.php` (109 → 171 LOC; +62)
   - `backend/tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php` (144 LOC)
3. **Task 3: finngen.prs.compute permission seed + test** — `775624cc0` (feat)
   - `backend/database/migrations/2026_04_25_000200_seed_prs_permissions.php` (55 LOC)
   - `backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php` (92 LOC)

## Files Created/Modified

### Migrations (3)
- `backend/database/migrations/2026_04_25_000050_grant_vocab_create_to_migrator.php` — prerequisite vocab CREATE grant with has_schema_privilege verify + operator-remediation throw
- `backend/database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php` — vocab.pgs_scores + vocab.pgs_score_variants (14 + 11 columns), FK + composite PK + btree index + HIGHSEC grants
- `backend/database/migrations/2026_04_25_000200_seed_prs_permissions.php` — Spatie finngen.prs.compute + 4-role assignment (RoleDoesNotExist-safe)

### Services (1)
- `backend/app/Services/FinnGen/GwasSchemaProvisioner.php` — extended `provision()` to co-create `{source}_gwas_results.prs_subject_scores` alongside summary_stats (composite PK, cross-schema FK, cohort+score btree index, 3-tier HIGHSEC grants). Updated class-level docblock to cover Phase 17 D-09.

### Tests (3 new, 21 new assertions)
- `backend/tests/Feature/FinnGen/PgsCatalogMigrationTest.php` — 8 assertions (Task 1 grant + Task 2 table shape, PK, FK, index, grants × 2, negative INSERT check)
- `backend/tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php` — 8 assertions (co-creation, columns, PK, cross-schema FK, index, DML grants × 2, idempotency)
- `backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php` — 5 assertions (permission exists, 4-role assignment, viewer excluded, idempotency, User::can() integration)

## Pest Test Results

### New tests (all green)

```
PASS  Tests\Feature\FinnGen\PgsCatalogMigrationTest
  ✓ grants CREATE on schema vocab to parthenon_migrator (Task 1)
  ✓ creates vocab.pgs_scores with expected columns
  ✓ creates vocab.pgs_score_variants with composite PK
  ✓ creates FK from pgs_score_variants.score_id to pgs_scores ON DELETE CASCADE
  ✓ creates index on pgs_score_variants(score_id)
  ✓ grants SELECT on vocab.pgs_scores to parthenon_app
  ✓ grants SELECT on vocab.pgs_score_variants to parthenon_app
  ✓ does NOT grant INSERT on vocab.pgs_scores to parthenon_app (read-only)

PASS  Tests\Feature\FinnGen\GwasSchemaProvisionerPrsTest
  ✓ creates pancreas_prs_test_gwas_results.prs_subject_scores alongside summary_stats
  ✓ provisions prs_subject_scores with expected columns
  ✓ creates composite PK on (score_id, cohort_definition_id, subject_id)
  ✓ creates cross-schema FK to vocab.pgs_scores with ON DELETE CASCADE
  ✓ creates cohort+score btree index on prs_subject_scores
  ✓ grants DML to parthenon_app on prs_subject_scores
  ✓ grants DML to parthenon_finngen_rw and SELECT only to parthenon_finngen_ro
  ✓ is idempotent — second provision() call is a no-op

PASS  Tests\Feature\FinnGen\PrsPermissionSeederTest
  ✓ seeds finngen.prs.compute permission
  ✓ assigns finngen.prs.compute to researcher/data-steward/admin/super-admin
  ✓ does not assign finngen.prs.compute to viewer
  ✓ is idempotent — re-assigning does not duplicate
  ✓ grants finngen.prs.compute to a user via researcher role

Tests:    21 passed (33 assertions)
Duration: ~1.3s
```

### Regression suite (Phase 14, all green)

```
PASS  Tests\Feature\FinnGen\GwasSchemaProvisionerTest  (5/5 passed)
PASS  Tests\Feature\FinnGen\GwasSchemaGrantsTest       (4/4 passed)
```

Combined run (all 5 test files): **30 passed (64 assertions)** in 1.45s.

## psql Verification Evidence

Run against `parthenon_testing` on host PG17 post-migration:

```
$ SELECT has_schema_privilege('parthenon_migrator', 'vocab', 'CREATE') AS migrator_create,
         has_table_privilege('parthenon_app', 'vocab.pgs_scores', 'SELECT') AS app_select_scores,
         has_table_privilege('parthenon_app', 'vocab.pgs_score_variants', 'SELECT') AS app_select_variants;
t | t | t

$ \dt vocab.pgs_*
vocab | pgs_score_variants | table | smudoshi
vocab | pgs_scores         | table | smudoshi

$ SELECT name, guard_name FROM app.permissions WHERE name = 'finngen.prs.compute';
finngen.prs.compute | web   (1 row)

$ php artisan migrate:status --database=pgsql_testing | grep '2026_04_25'
  2026_04_25_000050_grant_vocab_create_to_migrator ............. [3] Ran
  2026_04_25_000100_create_pgs_catalog_tables .................. [4] Ran
  2026_04_25_000200_seed_prs_permissions ....................... [5] Ran
```

## Lint / Static Analysis

- **Pint:** all 7 files pass `pint --test` (auto-fixes applied for class_definition, braces_position, single_quote, unary_operator_spaces, not_operator_with_successor_space, fully_qualified_strict_types).
- **PHPStan level 8:** clean on all migration + service files (`./vendor/bin/phpstan analyse ... --level=8` → "No errors").

## Deviations from Plan

None. The plan was executed exactly as specified.

Minor implementation note: the plan's "Task 1 Pest test" (inside PgsCatalogMigrationTest.php extend-in-Task-2 note) was implemented as a single-file test created in Task 1 and augmented by Task 2 with 7 additional assertions — so Tasks 1 and 2 share one test file with 8 total assertions, rather than Task 1 creating a partial file later extended. Commit 1 included the full `PgsCatalogMigrationTest.php`; commit 2 did not need to touch it.

## Authentication Gates

None. All automated.

## Deferred Items for Plan 07 (Deploy Runbook)

The only operator-facing deploy step is the Task 1 prerequisite — if the target environment's `parthenon_migrator` role does not own vocab, the operator must run the documented remediation command **once** as DB superuser before `./deploy.sh --db`:

```bash
sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"
```

This is captured in migration 000050's docblock and emitted in the RuntimeException message if the verify fails. Plan 07 should surface this in the DEPLOY-LOG runbook as a pre-flight step for fresh staging / prod cutover.

On DEV `parthenon_testing`, the current migrating user is `smudoshi` (superuser + vocab owner), so the GRANT takes effect immediately and the verify passes. No manual remediation needed for local test bootstrapping.

## Threat Flags

None — this plan introduces no new network surface, no new unauthenticated routes, no new file-access patterns. The new Spatie permission **tightens** authorization (adds a gated endpoint hook that Plan 17-03 will consume); the new tables follow HIGHSEC §4.1 grants mechanically.

The plan's declared threat register (T-17-S1..S-vocab-ownership) was fully mitigated:

| Threat ID | Disposition | How mitigated |
|-----------|-------------|---------------|
| T-17-S1 (tampering) | mitigate | Composite PK + FK enforce referential integrity; Plan 02 ingestion adds checksum verification |
| T-17-S2 (info disclosure) | accept | Public PGS Catalog metadata — no PHI |
| T-17-S3 (elevation) | mitigate | 4-role explicit whitelist; viewer excluded by design |
| T-17-S4 (DoS) | accept | Migrations run in maintenance window; idempotent |
| T-17-S-vocab-ownership | mitigate | Migration 000050 throws with remediation if CREATE grant missing (loud failure, not silent corruption) |

## Self-Check: PASSED

**Files verified:**
- FOUND: backend/database/migrations/2026_04_25_000050_grant_vocab_create_to_migrator.php
- FOUND: backend/database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php
- FOUND: backend/database/migrations/2026_04_25_000200_seed_prs_permissions.php
- FOUND: backend/app/Services/FinnGen/GwasSchemaProvisioner.php (modified — provision() extension)
- FOUND: backend/tests/Feature/FinnGen/PgsCatalogMigrationTest.php
- FOUND: backend/tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php
- FOUND: backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php

**Commits verified (branch worktree-agent-af2017ec, base df31ecb252):**
- FOUND: d31fe96f8 feat(17-01): grant CREATE on vocab to parthenon_migrator
- FOUND: 0e07112af feat(17-01): create vocab.pgs_* + extend GwasSchemaProvisioner for prs_subject_scores
- FOUND: 775624cc0 feat(17-01): seed finngen.prs.compute permission across 4 roles

**Runtime verification:**
- PASS: all 3 migrations recognized as Ran on parthenon_testing
- PASS: parthenon_migrator has CREATE on vocab
- PASS: parthenon_app has SELECT (not INSERT) on vocab.pgs_scores + vocab.pgs_score_variants
- PASS: finngen.prs.compute permission seeded with guard_name=web
- PASS: Pest suite 30/30 green (21 new + 9 Phase 14 regression)
- PASS: Pint clean, PHPStan level 8 clean
