---
phase: 260416-owf
plan: 01
subsystem: finngen-workbench
tags: [sp4, cohort-workbench, live-smoke, e2e, pancreas]
dependency_graph:
  requires:
    - PANCREAS source daimons (cdm, vocabulary, results)
    - pancreas_results.cohort populated with definitions 221/222/223
    - Horizon + Darkstar async workers
  provides:
    - Live pass/fail evidence matrix for all 4 SP4 Workbench backend workers
  affects:
    - None (read-mostly smoke; 1 overwrite materialize write into pancreas_results.cohort and 2 cohort_definitions INSERTs into app.cohort_definitions)
tech-stack:
  added: []
  patterns:
    - live dispatch + poll + DB verify
key-files:
  created:
    - .planning/quick/260416-owf-full-live-end-to-end-smoke-of-sp4-workbe/260416-owf-SUMMARY.md
  modified: []
decisions:
  - Used correct operation-tree shape `{kind, id, cohort_id}` (plan body used legacy `{op, cohort_id}`); backend contract is source of truth
  - Executed Worker 3 on BOTH fresh-create and overwrite paths to capture complementary evidence; both surfaced the same root cause (double-dispatch)
  - Worker 4 recorded as PASS-WITH-CAVEAT (503 guard path is the only branch available — zero rows in app.webapi_registries)
metrics:
  completed: 2026-04-16
---

# SP4 Workbench Full Live E2E Smoke — 260416-owf

**Source:** PANCREAS
**Date (UTC):** 2026-04-16T22:05:47+00:00
**Stack:** dev (http://localhost:8082), horizon running, darkstar container up
**Admin token:** regenerated fresh via `php artisan tinker` (token-id 1052, name `smoke-260416-owf`); not committed

## Pass/Fail Matrix

| # | Worker                | Endpoint                                      | HTTP | Run ID / Cohort Def                         | Observed                                                                 | Expected (baseline)                         | Status            |
|---|-----------------------|-----------------------------------------------|------|---------------------------------------------|--------------------------------------------------------------------------|---------------------------------------------|-------------------|
| 1 | preview-counts (sync) | POST /workbench/preview-counts                | 200  | n/a                                         | total=361, cohort_ids=[221], operation_string="221"                       | 361 (PANCREAS 221 All PDAC)                 | PASS              |
| 2 | cohort.match (async)  | POST /workbench/match → GET /runs/{id}        | 202  | run=01kpc508ngv9cj57g1afegq13c matched_cid=9000222 | primary=146, comparator=142, matched subjects=208, SMD rows=2              | matched ~211 (146 + controls greedy 1:1)    | PASS              |
| 3 | cohort.materialize    | POST /workbench/materialize → GET /runs/{id}  | 202  | fresh: run=01kpc53y4y4b0k7v2h1dzbwbpj cohort_def=248 overwrite: run=01kpc55y180w01hp54mdcbbszm cohort_def=247 | fresh-create: run status=failed (guard fired at 237 pre-existing rows); overwrite: run status=succeeded but subject_count=474 with only 237 distinct subjects (2× inflation) | 237 (222 ∪ 223)                             | FAIL              |
| 4 | atlas-import          | GET /workbench/atlas/cohorts                  | 503  | registry=none                               | message="No active WebAPI registry configured. Ask an admin to configure one under Admin → WebAPI Registries." | 200 with registry OR 503 guard              | PASS-WITH-CAVEAT  |

## Worker Detail

### 1. preview-counts (PANCREAS cohort 221)

- **Request:** `{"source_key":"PANCREAS","tree":{"kind":"cohort","id":"n1","cohort_id":221}}`
- **Response (HTTP 200):**
  ```json
  {"data":{"total":361,"cohort_ids":[221],"operation_string":"221"}}
  ```
- **DB confirmation:** `pancreas_results.cohort WHERE cohort_definition_id=221` → 361 distinct subjects. Cohort table lives under `pancreas_results` (source daimon `results` → `pancreas_results`; `source['schemas']['cohort']` aliases the results schema per `FinnGenSourceContextBuilder::build`).
- **Expected:** 361 (exact)
- **Status:** PASS — Darkstar `{ok, result}` envelope correctly unwrapped by the controller (commit 4f0e1a470 fix applied). The direct-total shape matched baseline exactly.

### 2. cohort.match (primary=222, comparator=[223], ratio=1, match_sex=true, match_birth_year=true)

- **Dispatch (HTTP 202):** `run_id=01kpc508ngv9cj57g1afegq13c`, status=queued
- **Final:** status=`succeeded` (Parthenon run model terminal status is `succeeded`, not `completed`)
- **summary.counts:**
  ```json
  [{"cohortId":9000222,"cohortName":"Matched from #222","cohortEntries":208,"cohortSubjects":208}]
  ```
- **Waterfall:** primary_input=146, comparator_input=142, matched_output=208 (ratio=1, cohort_id=9000222)
- **SMD rows:** 2 (covariates: age_years, pct_female). smd_pre=-0.0778 → smd_post=-0.0487 on age_years.
- **DB confirmation:** `pancreas_results.cohort WHERE cohort_definition_id=9000222` → 208 rows, 208 distinct subjects. Matches summary.counts exactly.
- **Darkstar side:** Two submissions observed in logs (`finngen.cohort.match_20260416220123.902480_94390` and `_20260416220123.935840_65528`), fired 33ms apart. Second run was idempotent — same matched pool, same rows — so no duplication leaked into the final row set.
- **Expected:** matched ~211 (baseline ±5%). Observed 208 is within ±1.4% — PASS.
- **Status:** PASS

### 3. cohort.materialize (UNION of 222 and 223)

Ran both code paths; both exposed the same root cause (see Follow-ups).

#### 3a. Fresh-create path (primary plan body)

- **Request:** UNION tree `{kind:"op",op:"UNION",children:[{kind:"cohort",cohort_id:222},{kind:"cohort",cohort_id:223}]}` with name "Smoke 260416-owf UNION", no overwrite_cohort_definition_id.
- **Dispatch (HTTP 202):** `run_id=01kpc53y4y4b0k7v2h1dzbwbpj`, `cohort_definition_id=248`, overwrite=false
- **Compiled SQL (from dispatch body):**
  ```sql
  (SELECT subject_id FROM pancreas_results.cohort WHERE cohort_definition_id = 222)
  UNION
  (SELECT subject_id FROM pancreas_results.cohort WHERE cohort_definition_id = 223)
  ```
- **Final:** status=`failed`, summary=null
- **Error:** `cohort.materialize: cohort_definition_id 248 already has 237 rows in pancreas_results.cohort — re-run with overwrite_existing=true` (DARKSTAR_R_ANALYSIS_EXCEPTION)
- **DB confirmation:** `pancreas_results.cohort WHERE cohort_definition_id=248` → 237 rows, 237 distinct subjects
- **Darkstar side:** Two submissions 36ms apart (`finngen.cohort.materialize_20260416220324.032336_57095` and `_20260416220324.067944_93844`). First submission INSERTed 237 rows into a freshly created cohort_definition_id 248; second submission correctly fired the idempotency guard (`already has 237 rows`) and returned an error.
- **Expected:** status=succeeded, subject_count=237. Observed: status=failed.
- **Status:** FAIL — the fresh-create branch cannot complete because `RunFinnGenAnalysisJob` double-dispatches to Darkstar, and the second dispatch lands on the rows just inserted by the first dispatch.

#### 3b. Overwrite path (orchestrator context override — cohort_definition_id=247 residue from prior smoke)

- **Request:** Same UNION tree, `overwrite_cohort_definition_id=247`, name "Smoke 260416-owf UNION (overwrite)".
- **Dispatch (HTTP 202):** `run_id=01kpc55y180w01hp54mdcbbszm`, `cohort_definition_id=247`, overwrite=true
- **Final:** status=`succeeded`
- **summary:** `{"subject_count":474,"cohort_definition_id":247}`
- **DB confirmation:** `pancreas_results.cohort WHERE cohort_definition_id=247` → **474 rows, 237 distinct subjects** (exactly 2× inflation of the row count against distinct subjects).
- **Expected:** subject_count=237, rows=237 (one row per subject).
- **Status:** FAIL — the overwrite path completed with `status=succeeded` but the underlying data is wrong. The R worker DELETEs the existing 237 rows, INSERTs 237 fresh rows, then the second (duplicate) Darkstar submission DELETEs again and re-INSERTs, but by the time both finish the count query sees 474 rows (237 × 2). The R worker returns this row count as `subject_count`, which is a misnomer — it is the row count, not the distinct subject count.

#### Root cause (both sub-workers)

Both sub-paths are broken by the **same defect**: `RunFinnGenAnalysisJob` dispatches each run to Darkstar twice. Match happens to be immune because its result is deterministic per input. Materialize is NOT immune because it writes to `pancreas_results.cohort`; the second write either trips the idempotency guard (fresh-create) or produces duplicate rows (overwrite).

Evidence:
```text
[ASYNC] Job finngen.cohort.match_20260416220123.902480_94390 submitted
[ASYNC] Job finngen.cohort.match_20260416220123.935840_65528 submitted           (dup — 33 ms later)
[ASYNC] Job finngen.cohort.materialize_20260416220324.032336_57095 submitted
[ASYNC] Job finngen.cohort.materialize_20260416220324.067944_93844 submitted    (dup — 36 ms later)
```

**Worker 3 overall status: FAIL.**

### 4. atlas-import

- **Registry state (`app.webapi_registries`):** 0 rows.
- **GET /workbench/atlas/cohorts:** HTTP 503, body `{"message":"No active WebAPI registry configured. Ask an admin to configure one under Admin → WebAPI Registries."}`. Message matches the exact string in `WorkbenchSessionController::listAtlasCohorts()` line 371.
- **POST /workbench/atlas/import:** skipped — the plan says to skip when the 503 branch is taken (no Atlas IDs to import against a nonexistent registry).
- **Expected:** either HTTP 200 with a populated registry OR HTTP 503 with the guard message.
- **Status:** PASS-WITH-CAVEAT — the 503 guard path is confirmed, but the HTTP 200 happy path was not exercised because no `app.webapi_registries` row exists with `is_active=true`. A live atlas-import smoke against real Atlas cohorts requires an admin to configure a WebApiRegistry row first.

## Raw Evidence Paths (ephemeral, `/tmp` only — not committed)

- `/tmp/smoke_260416_owf/preview.json` — Worker 1 response + HTTP_STATUS trailer
- `/tmp/smoke_260416_owf/match_dispatch.json` — Worker 2 POST response
- `/tmp/smoke_260416_owf/match_final.json` — Worker 2 GET /runs/{id} terminal body
- `/tmp/smoke_260416_owf/materialize_dispatch.json` — Worker 3a POST response (fresh-create)
- `/tmp/smoke_260416_owf/materialize_final.json` — Worker 3a terminal body (status=failed)
- `/tmp/smoke_260416_owf/materialize_overwrite_dispatch.json` — Worker 3b POST response (overwrite)
- `/tmp/smoke_260416_owf/materialize_overwrite_final.json` — Worker 3b terminal body (status=succeeded, subject_count=474)
- `/tmp/smoke_260416_owf/atlas_list.json` — Worker 4 response (HTTP 503)
- `/tmp/smoke_260416_owf/db_rowcounts.txt` — all psql observations (preflight + per-worker DB row counts + registry state)

## Overall Verdict

- Workers tested live: 4 / 4
- PASS: 2  |  PASS-WITH-CAVEAT: 1  |  FAIL: 1

**Result: FAIL.** Workers 1 and 2 work as designed; Worker 4 exercises the only available branch (503 guard) cleanly. Worker 3 (materialize) is broken on both code paths — a double-dispatch bug in the Laravel → Darkstar bridge causes the fresh-create path to end as `failed` (second dispatch hits the idempotency guard after the first inserted 237 rows) and corrupts the overwrite path into reporting a row count of 474 against only 237 distinct subjects.

Additional observations:
- The correct request-body tree shape for `/preview-counts` and `/materialize` is `{kind: "cohort"|"op", id: string, cohort_id|op, children}` — not the `{op, cohort_id}` form used in the plan body. The `PreviewWorkbenchCountsRequest` validator requires `tree.kind` and `tree.id`.
- `pancreas_results.cohort` is the cohort-storage table (not `pancreas.cohort`). The `source['schemas']['cohort']` alias resolves to the `results` daimon schema per `FinnGenSourceContextBuilder::build` line 64. The plan preflight query was against the wrong schema.
- Run terminal status in Parthenon is `succeeded` (not `completed`). The plan's poll assertion used `completed`; `succeeded` and `failed` are the actual terminal values the run state machine produces.

## Follow-ups

- **[CRITICAL] Fix double-dispatch in `RunFinnGenAnalysisJob`.** The Horizon-to-Darkstar bridge submits each run twice, 33–36 ms apart. Evidence is reproducible in the `docker compose logs darkstar` output for this smoke (see `_2026041622*` job IDs). Likely causes: `Bus::dispatch` being called from both the controller and a retry hook, Horizon retries firing while the first submission is in-flight, or the Darkstar client issuing a silent retry on the initial HTTP response. The fix must make the Darkstar submission idempotent OR ensure the run job produces exactly one Darkstar submission per run_id.
- **[HIGH] Fix the R worker's `subject_count` field.** The materialize summary reports the post-insert row count as `subject_count`, which is misleading when duplicates exist. Field should either be `COUNT(DISTINCT subject_id)` or renamed to `row_count`.
- **[MEDIUM] Correct the plan contract surface.** Update `260416-owf-PLAN.md` (and any other SP4 docs) to use the real tree shape (`{kind, id, cohort_id}`), the real terminal status (`succeeded`), and the real cohort schema (`pancreas_results`, not `pancreas`). Would have saved one iteration of the smoke.
- **[MEDIUM] Seed a fixture `app.webapi_registries` row.** Without one, Worker 4's happy path (200 + cohort import) is untestable. Either add a dev-only seeder or expose an admin UI/API that lets an admin register `https://atlas-demo.ohdsi.org/WebAPI` (or a mock) for CI/smoke coverage.
- **[LOW] Clean up smoke-generated residue after investigation.** cohort_definitions 247 and 248 and matched cohort 9000222 now hold test data (247 has 474 duplicated rows). Once the double-dispatch fix lands, drop the rows for 247/248 and re-run the smoke as a regression gate.

## Self-Check: PASSED

- `/tmp/smoke_260416_owf/preview.json` — FOUND
- `/tmp/smoke_260416_owf/match_dispatch.json` — FOUND
- `/tmp/smoke_260416_owf/match_final.json` — FOUND
- `/tmp/smoke_260416_owf/materialize_dispatch.json` — FOUND
- `/tmp/smoke_260416_owf/materialize_final.json` — FOUND
- `/tmp/smoke_260416_owf/materialize_overwrite_dispatch.json` — FOUND
- `/tmp/smoke_260416_owf/materialize_overwrite_final.json` — FOUND
- `/tmp/smoke_260416_owf/atlas_list.json` — FOUND
- `/tmp/smoke_260416_owf/db_rowcounts.txt` — FOUND
- `.planning/quick/260416-owf-full-live-end-to-end-smoke-of-sp4-workbe/260416-owf-SUMMARY.md` — FOUND (this file)

No tracked application code was modified by this smoke. Evidence artifacts live under `/tmp/smoke_260416_owf/` and are intentionally not committed.
