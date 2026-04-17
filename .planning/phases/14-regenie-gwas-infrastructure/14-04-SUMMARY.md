---
phase: 14-regenie-gwas-infrastructure
plan: 04
subsystem: finngen.gwas
tags: [gwas, regenie, artisan, plink2, highsec, prepare-source-variants]
requires:
  - 14-01 (Pest skeletons + synthetic PANCREAS PGEN generator)
  - 14-02 (app.finngen_source_variant_indexes + app.finngen_gwas_covariate_sets migrations)
  - 14-03 (GwasSchemaProvisioner service + SourceVariantIndex Eloquent model)
provides:
  - `php artisan finngen:prepare-source-variants` admin command (D-05)
  - --dry-run path validated by 5 Pest tests (the contract Phase 15 depends on)
  - Super-admin gate pattern reusable by the forthcoming GwasSmokeTestCommand
    and GwasCachePruneCommand
affects:
  - Phase 15 GENOMICS-03 dispatch API (unblocked — can now assert 422 when
    app.finngen_source_variant_indexes row is missing per D-08)
  - Wave 6 smoke test (real --force execution deferred to that gate)
tech-stack:
  added:
    - Symfony\Component\Process\Process for plink2 / python3 subprocess
      invocation (HIGHSEC §10 argv-vector posture)
  patterns:
    - Structured JSON summary on stdout (Wave 5/6 smoke test parses this)
    - Three-tier auth gate (APP_ENV, --force-as-user, session user)
    - Idempotent updateOrCreate on unique source_key
key-files:
  created:
    - backend/app/Console/Commands/FinnGen/PrepareSourceVariantsCommand.php
  modified:
    - backend/tests/Feature/FinnGen/PrepareSourceVariantsCommandTest.php
    - .env.example
decisions:
  - D-05 command signature ships with all flags from CONTEXT.md plus
    --force-as-user (HIGHSEC §1.1 gate bypass for operators)
  - D-12 schema creation happens inside the command's DB::transaction, so a
    failure rolls back BOTH the provisioner's DDL and the tracking row —
    no half-built state where a schema exists but no tracking row does
  - D-20 pcs.tsv header is `subject_id\tPC1..PC20` (plan specified this
    as "Claude's discretion" item; chose `subject_id` over `IID` to
    signal the semantic — Wave 4 R worker joins to pancreas.person by
    person_id-slice on this column)
  - RefreshDatabase replaced with manual schema cleanup in the Pest file
    because Wave 2's 13.1 migration (`2026_04_19_000100_isolate_finngen_schema`)
    uses `ALTER TABLE ... SET SCHEMA` which collides on migrate:fresh
    replay. Mirrors the Wave 2 tests' pattern.
metrics:
  duration_minutes: 32
  completed_at: 2026-04-17
  tasks_completed: 1
  files_created: 1
  files_modified: 2
  tests_now_passing: 5
  lines_of_code: ~520 (command)
---

# Phase 14 Plan 04: PrepareSourceVariantsCommand Summary

Shipped the admin artisan that converts a CDM source's aligned VCF into a
PGEN + top-20 PC TSV, bootstraps the per-source `{source}_gwas_results`
schema via the Wave 2 `GwasSchemaProvisioner`, and upserts the
`app.finngen_source_variant_indexes` tracking row. Phase 15's GWAS
dispatch reads that table at request time (D-08) and returns 422 when a
source lacks a row — so this command is the one-way gate between "source
exists in CDM" and "source is GWAS-capable."

## Command Surface

```
$ php artisan finngen:prepare-source-variants --help

Options:
  --source[=SOURCE]           CDM source key (PANCREAS, SYNPUF, etc.) — required
  --vcf-path[=VCF-PATH]       Path to source VCF file or directory of per-chrom VCFs
  --variants[=VARIANTS]       Synthetic variant count when no --vcf-path [default: "10000"]
  --seed[=SEED]               Synthetic generator seed [default: "42"]
  --dry-run                   Validate + report plan; no filesystem mutations
                              (DB row still upserted per test contract)
  --force                     Rebuild even when a SourceVariantIndex row exists
  --plink2[=PLINK2]           plink2 binary path [default: "/opt/plink2/plink2"]
  --force-as-user[=USER-ID]   Run as super-admin user id X (test bypass)
```

## Task 1 — PrepareSourceVariantsCommand

Structure (~520 LOC):

| Stage | Method | Notes |
|-------|--------|-------|
| Auth gate | `authorizedToRun()` | APP_ENV=local\|testing OR --force-as-user resolves to super-admin OR session user has super-admin role |
| Source validation | inline | `preg_match('/^[a-z][a-z0-9_]*$/', strtolower(...))` allow-list + `Source::where('source_key', strtoupper(...))->exists()` |
| Disk headroom | `checkDiskHeadroom()` | `disk_free_space()` ≥ 20 GB on FINNGEN_ARTIFACTS_PATH (skipped on --dry-run) |
| Dry-run | `runDryRun()` | DB::transaction: provisioner->provision() + SourceVariantIndex::updateOrCreate. No subprocess. |
| Synthetic fallback | `runSyntheticGenerator()` | Symfony Process invoking `scripts/gwas/generate_synthetic_pancreas_pgen.py` when --vcf-path omitted AND source=='pancreas' |
| VCF → PGEN | `runPlinkVcfToPgen()` | Symfony Process argv with Pitfall 1 QC flags: --maf 0.01 --mac 100 --geno 0.1 --hwe 1e-15 |
| Sample-ID map | `writeSampleMap()` | Pitfall 3 mitigation: queries `pancreas.person` via `pancreas` connection, writes `OLD_FID\tOLD_IID\tperson_{id}\tperson_{id}` rows for `--update-ids` |
| PCA | `runPlinkPca()` | Symfony Process: `--pca 20 approx` (D-20) |
| Eigenvec → pcs.tsv | `convertEigenvecToPcTsv()` | Rewrites plink2's EIGENVEC to canonical `subject_id\tPC1..PC20` |
| Commit | DB::transaction | Provisioner + updateOrCreate in one atomic block |
| Summary | `printSummary()` | Single-line JSON on stdout |

HIGHSEC posture:

- **§1.1 (least privilege)** — non-local env + no --force-as-user + no super-admin session = refuse.
- **§3.2 (CDM read-only)** — reads `pancreas.person` only; all writes go to `app.finngen_source_variant_indexes` and `{source}_gwas_results.summary_stats`.
- **§10 (malicious code)** — zero `shell_exec`/`passthru`/`exec()` callsites. Every subprocess uses `Symfony\Component\Process\Process` with argv vectors (no shell interpolation). The string `shell_exec / passthru / exec` in the source appears only in the docblock explaining this posture.

RESEARCH pitfall mitigations wired:

- **Pitfall 1 low-variance SNP** — QC flags on VCF→PGEN step.
- **Pitfall 3 subject-ID mismatch** — `writeSampleMap()` produces `person_{id}` .psam IIDs so Wave 4's phenotype TSV matches row-for-row.
- **Pitfall 5 sample-count drift** — `sample_count` recorded on the tracking row; Wave 4 step-1 cross-checks.

## Test Results

Pest (Docker PHP container against `parthenon_testing`):

```
   PASS  Tests\Feature\FinnGen\PrepareSourceVariantsCommandTest
  ✓ it creates a source_variant_indexes row on happy path                0.13s
  ✓ it is idempotent on re-run (updates existing row, no duplicate)      0.06s
  ✓ it returns non-zero exit for unknown source                          0.05s
  ✓ it creates per-source gwas_results schema + summary_stats table      0.04s
  ✓ it refuses to run without super-admin gate when APP_ENV is production 0.05s

  Tests:    5 passed (6 assertions)
  Duration: 0.37s
```

Pint + PHPStan:

```
docker compose exec -T php sh -c "cd /var/www/html && \
  vendor/bin/pint --test app/Console/Commands/FinnGen/PrepareSourceVariantsCommand.php \
                         tests/Feature/FinnGen/PrepareSourceVariantsCommandTest.php"
→ PASS — 2 files
→ [OK] No errors (PHPStan)
```

Command registration sanity:

```
$ php artisan finngen:prepare-source-variants --help
Description:
  Convert source VCF to PGEN + compute top-20 PCs + bootstrap {source}_gwas_results schema (D-05)
# (all 8 flags listed)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] PHPStan `function.alreadyNarrowedType` on `method_exists($user, 'hasRole')`**
- **Found during:** PHPStan level 8 analysis
- **Issue:** `App\Models\User` always uses the Spatie `HasRoles` trait, so `method_exists($user, 'hasRole')` always evaluates to `true`. PHPStan's type narrowing flagged this as dead code.
- **Fix:** Removed the `method_exists()` guard; call `$user->hasRole('super-admin')` directly.
- **Files modified:** `backend/app/Console/Commands/FinnGen/PrepareSourceVariantsCommand.php`
- **Commit:** `688d8d151`

**2. [Rule 3 — Blocking] Pint `class_attributes_separation` on multiple `private const`**
- **Found during:** Pint `--test` check
- **Issue:** Three adjacent `private const` declarations must be separated by blank lines per Pint's `class_attributes_separation` rule.
- **Fix:** Ran `vendor/bin/pint` (no `--test`) to auto-insert separators. One line adjusted.
- **Commit:** `688d8d151`

**3. [Rule 1 — Bug] `RefreshDatabase` collides with Phase 13.1 finngen schema migration**
- **Found during:** Initial Pest run (all 5 tests failed with `SQLSTATE[42P07]: relation "finngen_analysis_modules_pkey" already exists`)
- **Issue:** `RefreshDatabase` runs `migrate:fresh` on each test boot, which re-executes the `2026_04_19_000100_isolate_finngen_schema` migration's `ALTER TABLE app.finngen_analysis_modules SET SCHEMA finngen`. Since the schema already hosts the moved table from a prior run, the replay fails.
- **Fix:** Replaced `uses(RefreshDatabase::class)` with a manual `beforeEach()` that drops `pancreas_gwas_results`, clears `SourceVariantIndex` rows, and re-upserts the PANCREAS source row. Mirrors the pattern Wave 2's Gwas* tests use for the same reason.
- **Commit:** `688d8d151`

### Auto-approved Deviation (from plan)

**Auth gate shape** — the plan pseudo-code suggested a mini-registry of
valid states; shipped as a three-predicate gate instead (APP_ENV in
local\|testing, `--force-as-user` resolves to super-admin, session user
is super-admin). Same contract, tighter implementation. Documented in
the command's class-level docblock.

### Environmental blockers

The Docker PHP container is bind-mounted from `/home/smudoshi/Github/Parthenon/backend`
(main repo, not this worktree). All Pint/PHPStan/Pest verification
happened against a copy at the bind-mount source; the committed files in
the worktree are byte-identical to the verified copy (confirmed via
`diff`).

## Acceptance Criteria — Checklist

- [x] `php -l` exits 0 on both files
- [x] Pint exits 0 on both files (post auto-fix)
- [x] `docker compose exec -T php php artisan finngen:prepare-source-variants --help` lists all 8 flags
- [x] Pest: 5 passed, 0 failed (4 Wave 0 skeletons un-skipped + 1 new super-admin gate test)
- [x] `grep -c "skip" ...CommandTest.php` → 0
- [x] No `shell_exec|passthru|exec(` callsites (docblock mention only)
- [x] `.env.example` documents both `REGENIE_MEM_LIMIT` and `REGENIE_CPU_LIMIT`
- [x] Command is super-admin gated (HIGHSEC §1.1 compliant)
- [x] Uses Symfony Process (not shell_exec/passthru/exec) per HIGHSEC §10
- [x] --dry-run path writes the tracking row + provisions schema without subprocess invocation
- [x] --force path uses Symfony Process to invoke plink2 (deferred execution OK for Wave 6)
- [x] Integrates with GwasSchemaProvisioner (Wave 2) and SourceVariantIndex model (Wave 2)
- [x] Reads `FINNGEN_ARTIFACTS_PATH` from env (never hardcodes `/opt/finngen-artifacts`)

## Handoff to Wave 4 & Phase 15

**Wave 4 (`gwas_regenie.R`)** consumes this command's output:
- Reads `app.finngen_source_variant_indexes` row → `pgen_path` + `pc_tsv_path`
- Joins `pcs.tsv` on `subject_id` column to `pancreas.person.person_id`
- Phenotype TSV uses `person_{id}` FID/IID to match the .psam this command writes

**Phase 15 (GENOMICS-03 dispatch API)** checks precondition at dispatch time:
```php
if (! SourceVariantIndex::where('source_key', strtolower($source))->exists()) {
    return response()->json([
        'error' => sprintf(
            "Source '%s' has no prepared variants. Run: php artisan finngen:prepare-source-variants --source=%s",
            strtoupper($source),
            strtoupper($source)
        ),
    ], 422);
}
```

The structured JSON emitted on stdout (`status`, `source`, `pgen_path`,
`pc_tsv_path`, `variant_count`, `sample_count`, `schema_created`) is the
parse target for Wave 5/6's smoke test wrapper.

## Commits

| Task | Commit | Scope |
|------|--------|-------|
| 1 | `688d8d151` | `feat(14-04): add PrepareSourceVariantsCommand (--dry-run + --force) (D-05)` |

## Self-Check: PASSED

- Command file exists: `backend/app/Console/Commands/FinnGen/PrepareSourceVariantsCommand.php` — FOUND (20,967 bytes)
- Test file exists + no skip: `backend/tests/Feature/FinnGen/PrepareSourceVariantsCommandTest.php` — FOUND
- .env.example contains REGENIE_MEM_LIMIT + REGENIE_CPU_LIMIT — FOUND (2 matches)
- Commit `688d8d151` — FOUND on `worktree-agent-a0b4ce6a`
- Pest: 5 passed (verified above)
- Pint + PHPStan: green (verified above)
