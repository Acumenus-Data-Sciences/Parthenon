---
phase: 14
plan: 14-07
status: passed
paused_at: 2026-04-18 (initial)
resumed_and_closed: 2026-04-18
resolution: Checkpoint 3 + 4 green; see 14-07-GATE-EVIDENCE.md for the acceptance record. Fix commit: b656944fa.
---

# Phase 14 Wave 6 — WIP Handoff

## Current state

- Main HEAD: `ad83bbfa6` (fix(14-07): sample_map.tsv OLD_FID must be 0 for VCF-loaded plink2)
- 6 of 7 plans complete: 14-01 through 14-06
- All unit + integration tests green (63 Pest + 12 testthat)
- Wave 6 phase gate partially verified: Checkpoints 1 + 2 ✓, Checkpoint 3 ✗, Checkpoint 4 not attempted

## Checkpoint 1: regenie + PLINK2 + non-root ✓

- **Command**: `docker compose build darkstar && docker compose up -d --no-deps darkstar`
- **Verified**:
  - `docker compose exec darkstar /opt/regenie/regenie --help` → regenie v4.1 banner
  - `docker compose exec darkstar /opt/regenie/plink2 --version` → PLINK v2.0.0-a.6.33LM AVX2 Intel (28 Feb 2026)
  - `docker compose exec -u ruser darkstar id` → uid=101(ruser) gid=102(ruser)

### Fix landed during this checkpoint

- Commit `6b7d16c77 fix(14-05): wire COPY --from=regenie-builder/plink2-builder into runtime stage (Task 1 completion)` — the original Task 1 commit (`69c83f382`) defined the builder stages but omitted the COPY lines in the runtime stage, so the built image shipped without `/opt/regenie/regenie`. Added three missing directives (COPY regenie, COPY plink2, chown+chmod for ruser).

## Checkpoint 2: per-source schema + BRIN/BTREE indexes + three-tier grants ✓

- **Command**: `php artisan finngen:prepare-source-variants --source=PANCREAS --dry-run --force-as-user=117` (DB_USERNAME=parthenon_migrator)
- **Verified via** `psql -c "\d+ pancreas_gwas_results.summary_stats"`:
  - 13 columns match D-09 contract (chrom/pos/ref/alt/snp_id/af/beta/se/p_value/case_n/control_n/cohort_definition_id/gwas_run_id)
  - BTREE on `(cohort_definition_id, p_value)` ✓
  - BRIN on `(gwas_run_id, chrom, pos)` ✓ (per D-11 deviation)
  - Three-tier grants:
    - `parthenon_app`: DELETE, INSERT, SELECT, UPDATE
    - `parthenon_finngen_rw`: DELETE, INSERT, SELECT, UPDATE
    - `parthenon_finngen_ro`: SELECT
    - `parthenon_migrator`: full DDL+DML

## Checkpoint 3: real end-to-end smoke ✗ (BLOCKED)

Attempted `php artisan finngen:gwas-smoke-test --source=PANCREAS --cohort-id=221 --force-as-user=117` three times.

### 4 real-path bugs surfaced

**1. sample_map.tsv OLD_FID mismatch** (Wave 0 generator bug) — **FIXED** in commit `ad83bbfa6`.

**2. R worker files 0660 on host; ruser can't read** (Wave 4 file permissions) — **RUNTIME-FIXED** via `chmod o+r /home/smudoshi/Github/Parthenon/darkstar/api/finngen/*.R`.
- **Permanent fix needed**: Either set a umask in the Dockerfile, add explicit `chmod` on the bind-mounted directory at s6-overlay cont-init time, or commit the permissions. The underlying issue is that the `ruser` user inside the container was allocated uid=101 post-rebuild (previously was 1000 matching host `smudoshi`), so bind-mounted files with group-only read permissions now block ruser.

**3. pcs.tsv shipped as PLINK2 eigenvec format** (Wave 1/4 integration gap) — **RUNTIME-FIXED** via:
  ```sh
  cd /opt/finngen-artifacts/variants/pancreas && \
    awk 'BEGIN{OFS="\t"} NR==1{printf "subject_id"; for(i=3;i<=NF;i++) printf "\tPC"(i-2); print ""; next} {out=$2; for(i=3;i<=NF;i++) out=out"\t"$i; print out}' \
    pcs.eigenvec > pcs.tsv
  ```
- **Permanent fix needed**: Either update `PrepareSourceVariantsCommand.php`'s non-dry-run path to emit `subject_id\tPC1..PC20` format (not PLINK2's `#FID\tIID\tPC1..PC20`), OR update `.assemble_covar_tsv` in `gwas_regenie.R` to read PLINK2 eigenvec format directly.

**4. `.assemble_covar_tsv` crashes with mirai IPC marshaling failure** (Wave 4 R worker bug) — **OPEN**.
- Symptom: step-1 dispatches, progress reaches `assemble_pheno_covar` at 5%, `phenotype.tsv` (8459 bytes) writes successfully, then the run fails with:
  ```json
  {"code":"DARKSTAR_R_ANALYSIS_EXCEPTION",
   "message":"cannot open the connection",
   "call":"writeChar(report, fileConn, eos = NULL)",
   "stack":"No traceback available"}
  ```
- `covariates.tsv` is never written to the cache directory.
- `writeChar(report, fileConn, eos=NULL)` doesn't appear anywhere in the Parthenon codebase — it's the mirai dispatcher attempting to marshal the real R exception back to the main Plumber process, and that IPC itself is failing, so the original exception is swallowed.
- Candidate causes inside `.assemble_covar_tsv` (not yet instrumented):
  - `jsonlite::fromJSON(covariate_columns_json, simplifyVector=FALSE)` — if `covariate_columns` row has a shape mismatch
  - `merge(out, pcs[...], by.x="FID", by.y=NULL, ...)` — `by.y=NULL` is an unusual R pattern that may not work as intended
  - Reading the PLINK2-format pcs.tsv (if the awk transform above didn't fully land inside the container's bind mount)
  - DB connection envelope mismatch between step-1 dispatch and the R worker's `DatabaseConnector::querySql()` call

### Next steps for debugging

1. Add `tryCatch(..., error = function(e) { message("ERR: ", conditionMessage(e)); traceback(); stop(e) })` around the body of `.assemble_covar_tsv` to bypass the mirai IPC swallow.
2. Run `.assemble_covar_tsv` directly inside the r-runtime container:
   ```sh
   docker compose exec -u ruser darkstar Rscript -e '
     source("/app/api/finngen/common.R")
     source("/app/api/finngen/gwas_regenie.R")
     source_envelope <- list(
       source_key = "PANCREAS",
       schemas = list(cdm = "pancreas", cohort = "pancreas_results"),
       connection = list(server = "host.docker.internal/parthenon", port = 5432,
                         user = "parthenon_finngen_rw",
                         password = Sys.getenv("PARTHENON_FINNGEN_RW_PASSWORD"))
     )
     out <- .assemble_covar_tsv(source_envelope, 221, 1, "pancreas", "/tmp/debug-covar")
     message("SUCCESS: ", out)
   '
   ```
3. Fix the root cause, commit as `fix(14-07): <summary>`, re-run smoke.

## Preconditions established for next session

All prerequisite DB + filesystem state is in place for Checkpoint 3 to complete once the `.assemble_covar_tsv` bug is fixed:

- `app.finngen_source_variant_indexes` row for `pancreas` (id=81) — paths point at real files
- `app.finngen_gwas_covariate_sets` default row (id=1) with `covariate_columns` JSONB for age + sex + PC1..PC10
- `/opt/finngen-artifacts/variants/pancreas/genotypes.{pgen,pvar,psam}` — 361 subjects × 5000 variants (synthetic)
- `/opt/finngen-artifacts/variants/pancreas/pcs.tsv` — 362 lines (header + 361 subjects) with `subject_id PC1..PC20` header
- `pancreas_gwas_results.summary_stats` — table + indexes + grants (0 rows awaiting first write)
- `pancreas_results.cohort` with cohort_definition_id=221 populated (361 PDAC subjects as cases)
- Darkstar r-runtime container: healthy, regenie + PLINK2 binaries live, port 8787 listening, routes.R dispatches `finngen.gwas.regenie.step1/.step2`
- R worker files readable by ruser (chmod o+r applied; NOT committed — re-apply after any `git checkout` or pull)

## Phase 14 status summary

| Plan | Status | Notes |
|------|--------|-------|
| 14-01 | ✓ complete | Dockerfile + test skeletons + synthetic PGEN generator |
| 14-02 | ✓ complete | Migrations + default covariate set seeded |
| 14-03 | ✓ complete | GwasCacheKeyHasher + GwasSchemaProvisioner + models + observer |
| 14-04 | ✓ complete | PrepareSourceVariantsCommand (dry-run tested; --force untested against real regenie image) |
| 14-05 | ✓ complete | Dockerfile COPY fix (6b7d16c77) + gwas_regenie.R + routes + GwasRunService + seeder |
| 14-06 | ✓ complete | GwasSmokeTestCommand + GwasCachePruneCommand |
| 14-07 | ⚠ partial  | Checkpoint 1 + 2 ✓; Checkpoint 3 blocked on `.assemble_covar_tsv`; Checkpoint 4 not attempted |

**Don't mark Phase 14 complete until Checkpoint 3 + 4 pass.** The infrastructure ships and builds; the end-to-end GWAS path is unverified against real data.
