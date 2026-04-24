# Phase 14 carryover — notes for a future 14-08 cleanup

**Date:** 2026-04-18
**Status:** tracked, not scheduled

Addresses the four items flagged in `.planning/phases/14-regenie-gwas-infrastructure/14-07-GATE-EVIDENCE.md §8` and follows up on them after the Phase 14 gate passed.

## What's resolved

### Item 3 — s6 env propagation
Fixed in `darkstar/s6/plumber/run`: added `with-contenv` before `s6-setuidgid` so Dockerfile ENVs (including the new `POSTGRES_PATH=/usr/bin` required by DatabaseConnector's bulk COPY path) propagate into the R plumber process. The in-code `Sys.setenv(POSTGRES_PATH,...)` workaround added during 14-07 gate work is now removed.

### Item 4 — `/app` readability defense
Defensive cont-init oneshot `darkstar/s6/app-readable-init/` now runs `chmod o+r` recursively on `/app` at container init, so a host umask or editor drift can't break ruser's ability to source the R files. Git already tracks these at `0644` so this is belt-and-suspenders, but it closes the specific failure mode that paused Checkpoint 3 originally.

### Item 2 — cohort fixture
`GwasSmokeTestCommand` now has a precondition check that counts cases and controls on the case cohort before dispatching step-1. If either is zero, the command fails fast with a helpful error; with `--seed-cohort-split` it auto-materializes a 50/50 halving so the next session doesn't need the manual `DELETE FROM pancreas_results.cohort WHERE subject_id > 180` from the 14-07 handoff. Idempotent; no-op when already split.

## What's NOT resolved — flagged for a future 14-08 plan

### Item 1 — `PrepareSourceVariantsCommand` non-dry-run path

**The problem.** The command's non-dry-run path invokes two subprocesses:

- `python3 scripts/gwas/generate_synthetic_pancreas_pgen.py …` (synthetic-fallback branch, PANCREAS-only today)
- `/opt/plink2/plink2 --vcf … --make-pgen …` and `--pca …` (real VCF branch + PCA step)

Both run inside the `php` container (this is an artisan command). `php` ships neither binary:

```
$ docker compose exec -T php sh -c 'which python3; ls /opt/plink2/plink2'
(nothing)
ls: /opt/plink2/plink2: No such file or directory
```

`darkstar` has both, but darkstar has no Laravel runtime and no access to the repo's `scripts/` directory (only `./darkstar` is bind-mounted).

So the non-dry-run path is architecturally incomplete. For Phase 14's smoke test we worked around this by:

1. Running `scripts/gwas/generate_synthetic_pancreas_pgen.py` **directly on the host** (which has python + local plink2) to create the PGEN files.
2. Running PCA **manually on the host**, then hand-reshaping `pcs.eigenvec` into the `subject_id\tPC1..PC20` format expected by the R worker (the `convertEigenvecToPcTsv` PHP helper never ran because the command's non-dry-run path never ran).
3. Running the command in `--dry-run` to get Laravel to own the `app.finngen_source_variant_indexes` row (and provision the `*_gwas_results` schema).

This is fragile: step 1+2 are invisible to a future operator who reads only the Laravel command. The filesystem artifacts drift from Laravel's bookkeeping.

**Options for the fix (pick one in a 14-08 plan).**

| Option | Cost | Preserves | Breaks |
|---|---|---|---|
| A. Install `python3` + `/opt/plink2/plink2` in the `php` Dockerfile | Bigger php image (~150MB), extra apt layer | Single-actor command flow | Nothing |
| B. Add a `/scripts` bind-mount to `darkstar` and call `generate_synthetic_pancreas_pgen.py` from the R worker | Smallest image delta; keeps heavy binaries in the right container | Lean php container | Requires a new Plumber endpoint + PHP → darkstar HTTP hop |
| C. Move the whole command to darkstar (have php POST a `prepare-source-variants` request to `http://darkstar:8787/…`) | Cleanest separation | HIGHSEC §4.3 (no docker.sock) | Duplicates auth logic or needs a shared signing secret |
| D. Accept the gap; document that `prepare-source-variants` is a dev-only artifact and production preparation happens via `scripts/gwas/*.py` directly | Zero | The command stays unused | Bookkeeping drift |

**Recommendation for 14-08:** Option B. The R worker already owns all the other GWAS subprocess orchestration (regenie step-1/step-2); extending it to own VCF→PGEN and PCA is a natural fit, and it keeps the php container lean. A new Plumber route `/finngen/prepare/source-variants` that returns a Run-row-compatible envelope fits the existing mirai dispatcher pattern.

## Remaining items the gate-evidence doc flagged

- **Variant-index row keeps disappearing between sessions.** I inserted it twice manually in this session and both times it was gone before the next smoke attempt. Something (parallel autonomous job? test DB reset?) is wiping `app.finngen_source_variant_indexes`. The dry-run re-upsert above makes the row stable at session end, but the root cause deserves investigation — a watchdog truncating the table will also zero Wave 6 GATE evidence on subsequent sessions. This is independent of item 1.

## Gate-evidence update

`.planning/phases/14-regenie-gwas-infrastructure/14-07-GATE-EVIDENCE.md` §8 is still accurate. This devlog is the follow-up reference.
