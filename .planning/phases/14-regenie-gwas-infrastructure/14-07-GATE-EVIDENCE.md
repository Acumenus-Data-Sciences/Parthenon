---
phase: 14
plan: 14-07
status: passed
signed_off_at: 2026-04-18
signed_off_by: smudoshi
---

# Phase 14 Wave 6 — Gate Evidence

## 1. Environment snapshot

- Host: beastmode (Ubuntu 24.04 LTS, PG17 on host)
- Git HEAD at sign-off: `b656944fa` (fix(14-07): unblock Checkpoint 3 smoke — PC merge, bulk load, psql binary)
- Darkstar image: `ghcr.io/sudoshi/parthenon-darkstar:latest` id `b17e27e4e529`
- regenie: v4.1.gz
- PLINK2: v2.0.0-a.6.33LM AVX2 Intel (28 Feb 2026)
- PostgreSQL client (host): 17.9; server: 17
- Database: `parthenon` (single-DB, schema-isolated)

## 2. Container verification (SC#1)

```
$ docker compose exec darkstar /opt/regenie/regenie --help
regenie v4.1.gz — banner printed, exit 0

$ docker compose exec darkstar /opt/regenie/plink2 --version
PLINK v2.0.0-a.6.33LM AVX2 Intel (28 Feb 2026)

$ docker compose exec -u ruser darkstar id
uid=101(ruser) gid=102(ruser)
```

Non-root execution verified per HIGHSEC §4.1.

## 3. Schema + grants (SC#3)

Per-source schema + three-tier grants verified on `pancreas_gwas_results.summary_stats`:

```
Column                 Type
chrom                  character varying(4)  not null
pos                    bigint                not null
ref                    text                  not null
alt                    text                  not null
snp_id                 text
af                     real
beta                   real
se                     real
p_value                double precision
case_n                 integer
control_n              integer
cohort_definition_id   bigint                not null
gwas_run_id            character varying(26) not null
```

Grants verified via `\dp`:
- `parthenon_app`: DELETE, INSERT, SELECT, UPDATE
- `parthenon_finngen_rw`: DELETE, INSERT, SELECT, UPDATE
- `parthenon_finngen_ro`: SELECT
- `parthenon_migrator`: full DDL+DML

Schema-level `USAGE ON SCHEMA app` granted to `parthenon_finngen_{rw,ro}` +
`parthenon_migrator` via migration `2026_04_20_000300_grant_usage_on_app_to_
finngen_roles.php` (Phase 13.2-06, committed in 5b88fd962).

## 4. Indexes (SC#4)

```
Indexes on pancreas_gwas_results.summary_stats:
  summary_stats_cohort_p_btree      btree (cohort_definition_id, p_value)
  summary_stats_run_chrom_pos_brin  brin  (gwas_run_id, chrom, pos)
```

### EXPLAIN ANALYZE canaries (post-smoke, 5000 rows × 22 chroms)

**Top-hits query** (BTREE path):
```
Limit  (rows=25)
  ->  Index Scan using summary_stats_cohort_p_btree
         Index Cond: (cohort_definition_id = 221)
Execution Time: 0.029 ms
```

**Manhattan range query**:
```
Seq Scan on summary_stats  (rows=158 after filter, 9842 removed)
Execution Time: 0.645 ms
```

Seq scan is expected at this fixture size — BRIN's advantage manifests at
tens-of-millions of rows (D-11 deviation documented in 14-07-WIP-HANDOFF.md).
Index is materialized and available to the planner at production scale.

## 5. End-to-end smoke (SC#1, SC#2)

```
$ php artisan finngen:gwas-smoke-test --source=PANCREAS --cohort-id=221 \
    --force-as-user=117 --timeout-minutes=10
Dispatching step-1 (source=PANCREAS cohort=221 covariate_set=1).
  step-1 status=queued      (run_id=01kpgn7atahx6c73n4vm4wc8qy)
  step-1 status=succeeded   (run_id=01kpgn7atahx6c73n4vm4wc8qy)
step-1 succeeded. Dispatching step-2.
  step-2 status=queued      (run_id=01kpgn7fqaw8anwpz9dd7rzqzc)
  step-2 status=succeeded   (run_id=01kpgn7fqaw8anwpz9dd7rzqzc)
{"status":"ok","source":"PANCREAS","cohort_id":221,"covariate_set_id":1,
 "summary_stats_rows":5000,"cache_hit_on_rerun":null}
```

Data landed:
```
SELECT COUNT(*) rows, COUNT(DISTINCT gwas_run_id) runs,
       MIN(p_value)::text, MAX(p_value)::text, COUNT(DISTINCT chrom) chroms
  FROM pancreas_gwas_results.summary_stats;
 rows | runs |         min_p         |       max_p        | chroms
------+------+-----------------------+--------------------+--------
 5000 |    1 | 1.3983632439902685e-06| 0.9996338017639604 |     22
```

## 6. Cache-hit rerun (SC#2)

```
$ php artisan finngen:gwas-smoke-test --source=PANCREAS --cohort-id=221 \
    --force-as-user=117 --assert-cache-hit-on-rerun --timeout-minutes=10
Dispatching step-1 … step-1 succeeded (run_id=01kpgn81zqng9aywh0x7tddpcg)
Dispatching step-2 … step-2 succeeded (run_id=01kpgn86wjp1kjnqvt4jetex31)
Re-dispatching step-1 to assert LOCO cache hit.
  step-1 rerun status=queued    (run_id=01kpgn8bs15z2hg5ys35n5secw)
  step-1 rerun status=succeeded (run_id=01kpgn8bs15z2hg5ys35n5secw)
{"status":"ok",...,"cache_hit_on_rerun":true}
```

GENOMICS-01 SC #2 satisfied: step-1 LOCO artifacts reused on second dispatch
with identical cohort/covariate inputs.

## 7. Bugs fixed en route (for the devlog)

All surfaced by Checkpoint 3 real-path execution, none by mocks:

1. **`permission denied for schema app`** — parthenon_finngen_{rw,ro} had
   table grants but no `USAGE ON SCHEMA app`. Fixed via Plan 13.2-06 Task 3
   migration (5b88fd962) — idempotent, re-applied this session against dev.

2. **PC merge silently lost PCs** — `.assemble_covar_tsv` used invalid
   `merge(..., by.x="FID", by.y=NULL, ...)` syntax. Covariate TSV had FID,
   IID, age, sex correct but every PC column NA, so regenie fit with
   n_cov=2 instead of 12. Fixed in `darkstar/api/finngen/gwas_regenie.R`
   (commit b656944fa) — strip integer key, join on `person_id`, restore
   FID/IID column order.

3. **Bulk COPY unavailable** — Darkstar image shipped without
   `postgresql-client`; `DatabaseConnector::checkBulkLoadCredentials` aborted
   because `POSTGRES_PATH` was unset. Fixed by adding `postgresql-client`
   as a LATE apt layer (beside pandoc) + `ENV POSTGRES_PATH=/usr/bin` +
   in-R `Sys.setenv` fallback because the s6-overlay plumber `run` script
   does not invoke `with-contenv` (known pre-existing gap — the in-code
   guard survives container restarts until s6 propagation is fixed).

4. **Case-only cohort invalidates null model** — cohort_definition_id=221
   included all 361 persons in pancreas.person, so `.assemble_pheno_tsv`
   produced 361 cases / 0 controls and regenie aborted with `sd=0`. Split
   the fixture 180/181 (`DELETE FROM pancreas_results.cohort WHERE
   cohort_definition_id=221 AND subject_id > 180`). This is a fixture
   action, not a code fix; the next session should either (a) bake the
   split into the PANCREAS synthetic generator, or (b) add a smoke-test
   cohort seeder that guarantees a case/control split.

5. **sample_map.tsv OLD_FID mismatch** — fixed in prior session (ad83bbfa6).
6. **R worker files 0660 on host; ruser can't read** — runtime fix (`chmod
   o+r /home/smudoshi/Github/Parthenon/darkstar/api/finngen/*.R`); needs
   permanent fix in Dockerfile cont-init or by committing mode 0664.
7. **pcs.tsv shipped as PLINK2 eigenvec format** — runtime awk transform
   landed in `/opt/finngen-artifacts/variants/pancreas/pcs.tsv`; permanent
   fix pending in `PrepareSourceVariantsCommand` non-dry-run path.

## 8. Outstanding work (not blocking Phase 14 gate)

- `PrepareSourceVariantsCommand` non-dry-run path never exercised end-to-end
  on this machine — the `app.finngen_source_variant_indexes` row was
  inserted manually; the real command should own this.
- Permanent fixes for items 3, 4, 6, 7 above (tracked for Phase 15 or a
  Phase 14-08 cleanup plan).
- s6-overlay plumber `run` script should use `with-contenv` so Dockerfile
  ENVs propagate to the R worker uniformly.

## 9. Sign-off

Phase 14 Success Criteria:

| SC | Description | Evidence section | Verdict |
|----|-------------|------------------|---------|
| 1  | Darkstar image ships regenie + PLINK2 binaries, non-root | §2, §5 | ✓ PASS |
| 2  | End-to-end GWAS produces summary_stats; step-1 cache reused on rerun | §5, §6 | ✓ PASS |
| 3  | Per-source schema + three-tier grants | §3 | ✓ PASS |
| 4  | summary_stats has (chrom, pos) BRIN + (cohort_definition_id, p_value) BTREE | §4 | ✓ PASS |

**Phase 14 gate: PASS.**

_Operator sign-off: Sanjay Udoshi (smudoshi), 2026-04-18._
