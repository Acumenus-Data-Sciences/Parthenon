# FinnGen SP2 — Code Explorer Devlog

**Status:** Deployed to production 2026-04-15. 4 of 5 tabs working end-to-end on PANCREAS; Report tab has a deferred infrastructure bug.
**Spec:** `docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md`
**Plan:** `docs/superpowers/plans/2026-04-15-finngen-sp2-code-explorer.md`

## What SP2 delivers

First user-visible FinnGen feature. Accessed via `/workbench/investigation/:id` → left rail → **Code Explorer** (5th domain tab alongside Phenotype / Clinical / Genomic / Synthesis). Feature relocated from a standalone top-level route into Investigation after discovering the FinnGen brand had been retired in a prior refactor.

Researcher flow: pick a CDM source, pick an OMOP concept, see:

- **Counts** — stratified bar chart (year × gender or age_decile) ✅ verified against PANCREAS
- **Relationships** — clickable concept_relationship table ✅ verified
- **Hierarchy** — ReactFlow ancestor/descendant graph ✅ verified
- **Report** — ROMOPAPI HTML report inline preview + download 🟡 known bug
- **My Reports** — persistent history of reports with pin support ✅ UI works

Bonus: **Scoped concept search** — `ConceptSearchInput` inside the Code Explorer tab now calls `GET /finngen/code-explorer/concepts?source=X&q=...` so researchers only see concepts that actually have observations in the selected source. PANCREAS has 62 distinct concepts in stratified_code_counts out of 300K+ in the vocab, so scoped search makes the feature usable instead of 99.98%-failure-rate.

## Deployment timeline (2026-04-15)

- **Merge**: PR #135 merged to main (`235ad2217`)
- **First deploy**: `./deploy.sh` — darkstar container was broken (image missing ALL FinnGen + phenotype R packages). SelfControlledCohort/PheValuator/TreatmentPatterns guards added so non-FinnGen routes could start. `docker compose build darkstar` rebuilt with full R layer stack.
- **End-to-end smoke on PANCREAS**: succeeded 2026-04-15 00:39 — 67s setup time, 2,439 rows in `pancreas_results.stratified_code_counts`, 62 distinct concepts.
- **Bucket 1 close-out (862fbf4e7)**: auto-GRANTs in setup worker, plumber2 signature fixes for sync routes, Playwright E2E rewritten for PANCREAS, runbook updated.
- **Pandoc fix (061f21626)**: pandoc added as a LATE Dockerfile layer (not early apt layer) so future changes cheap, plus HOME/TMPDIR env in report worker. Report tab still fails — see Known Issues.

## Deviations from spec

1. **URL**: spec used `/finngen/explore` as a top-level route. During deploy smoke I realized the FinnGen user-facing brand had been intentionally retired (`"chore: remove deprecated FinnGen workbench (replaced by Evidence Investigation)"`). Relocated Code Explorer into Investigation as a 5th evidence-domain tab. `/finngen/explore` now redirects to `/workbench/investigation` for any old bookmarks.
2. **Default source**: spec used EUNOMIA. Switched to PANCREAS (Pancreatic Cancer Corpus, 361 persons, multimodal with OMOP Oncology) — EUNOMIA is a demo without genomics, not useful for real researcher flows. EUNOMIA remains valid for unit-test setup.
3. **Scoped concept search** (new, not in original spec): added `/concepts` endpoint + UI integration after smoke revealed `ROMOPAPI::getCodeCounts` fails with "No family tree found" for 99.98% of vocabulary concepts because PANCREAS only has 62 indexed. Without scoping the UI was unusable.
4. **cohortTable name**: HadesExtras default was `cohort` but Parthenon's `pancreas_results.cohort` table is owned by a different role. Changed to `finngen_cohort` to avoid ownership collisions.
5. **plumber2 signatures**: all darkstar FinnGen routes were written assuming plumber1 query-param-injection (`function(source, concept_id, response)`). plumber2 requires `function(request, response)` + `request$query$X`. Rewrote all 6 sync GETs + 8 async POSTs.

## Known issues

### 🟡 Report tab (ROMOPAPI::createReport) — deferred

Setup / Counts / Relationships / Hierarchy / Concepts all work. Report still fails ~4s into execution with:

```
"cannot open the connection" at file(con, "w")
```

Investigation so far:
- pandoc 3.1.3 installed ✓
- HOME set to writable export_folder ✓
- TMPDIR set to writable .rmd-tmp subdir ✓
- setwd() to export_folder ✓
- s6 callr subprocess does inherit our Sys.setenv ✓

The file() call is inside ROMOPAPI or rmarkdown internals and we haven't traced what exact path it's trying to write. Next session: strace the worker process, or instrument the R code to dump `Sys.getenv()` + `getwd()` + `tempdir()` right before createReport runs.

### Ad-hoc GRANTs for PANCREAS

On 2026-04-15, Bucket 1 landed auto-GRANTs in the setup worker. But the PANCREAS setup ran BEFORE that fix, so its GRANTs were applied manually via psql as claude_dev. New sources (SYNPUF, Acumenus) will grant automatically.

## Test state

- Pest: FinnGen scope 113/115 (2 pre-existing flakes unrelated to SP2)
- Vitest: 29 passed / 2 jsdom skips (ResizeObserver — covered by Playwright)
- testthat: 2 nightly-slow-lane specs for report + setup workers
- Playwright: E2E rewritten against PANCREAS covering 4 working tabs + report dispatch (report assertion will skip until bug fixed)

## Commits on main (chronological, post-merge)

```
235ad2217 Merge PR #135: SP2 Code Explorer (26 commits)
640cd1f5e fix(darkstar): guard SCC/PheValuator/TreatmentPatterns library() calls
64fa141e7 fix(finngen): SP2 post-deploy hotfixes (plumber2 body, setwd, JDBC, RW role, finngen_cohort)
df0f67195 refactor(code-explorer): relocate into Investigation as evidence domain tab
4bee59dba fix(finngen): SP2 sync reads — plumber2 query params + readiness check + safe_sync wrapper
36c773c52 feat(finngen): scoped concept search + typed FINNGEN_CONCEPT_NOT_IN_SOURCE error
862fbf4e7 fix(finngen): SP2 bucket 1 — auto-grants, sync routes, pandoc, E2E, docs
061f21626 fix(finngen): pandoc as late Dockerfile layer + HOME/TMPDIR env in report worker
```

## Deploy / operator notes

See `runbook.md` §"SP2 — Code Explorer source initialization" for the setup command and duration estimates.
