---
phase: 15
plan: 09
subsystem: finngen-endpoint-browser
tags: [finngen, gwas, smoke-test, via-http, uat-debt, phase-15]
requirements: [GENOMICS-03, GENOMICS-05, GENOMICS-14]
status: complete-with-uat-debt
tasks_complete: 1
tasks_deferred: 1
commits: [4d4496508]
completed: 2026-04-19
dependency_graph:
  requires:
    - "15-01 (migration + EndpointGwasRun + exceptions)"
    - "15-02 (GwasRunService::dispatchFullGwas)"
    - "15-03 (FinnGenGwasRunObserver + registration)"
    - "15-04 (FormRequest + controller + routes)"
    - "15-05 (api.ts types + TanStack Query hooks)"
    - "15-06 (GenerationHistorySection + GwasRunsSection + RunGwasPanel)"
    - "15-07 (drawer wiring + Phase 16 stub route)"
    - "15-08 (6 Pest feature + 1 Pest unit + 5 Vitest tests)"
  provides:
    - "GwasSmokeTestCommand --via-http mode: token mint, HTTP dispatch, polling loop, summary_stats count check, best-effort cleanup"
  affects:
    - "15-HUMAN-UAT.md (SC-4 evidence entry — created by orchestrator)"
tech_stack:
  added: []
  patterns:
    - "Sanctum token mint + best-effort delete in artisan smoke command (HIGHSEC §1.2 compliant)"
    - "--via-http flag gates new behavior; existing Phase 14 direct-service path is fully preserved"
key_files:
  modified:
    - "backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php"
decisions:
  - "SC-4 real E2E smoke deferred to 15-HUMAN-UAT.md at researcher's explicit approval — Phase 14 infra not convenient to exercise at phase-close time; treated as UAT debt not failure"
  - "nyquist_compliant stays false until SC-4 evidence is captured and verified"
metrics:
  duration_min: ~15
  tasks_completed: 1
  tasks_deferred: 1
  files_touched: 1
---

# Phase 15 Plan 15-09: GwasSmokeTestCommand --via-http Extension Summary

**SC-4 real E2E smoke deferred** to `15-HUMAN-UAT.md` — see entry for command + evidence checklist.

Plan 09 Task 1 shipped the `--via-http` extension to `finngen:gwas-smoke-test`. Task 2 (real E2E run against PANCREAS cohort 221 producing summary_stats rows within 30 min) was explicitly deferred at the researcher's approval — Phase 14 infrastructure was not convenient to exercise at phase-close time. This is UAT debt, not a failure.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend GwasSmokeTestCommand with --via-http mode | Complete | `4d4496508` |
| 2 | Real E2E smoke against PANCREAS cohort 221 (SC-4 gate) | Deferred — tracked in 15-HUMAN-UAT.md | — |

## Key Files

- `backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php` — --via-http branch: token mint via `User::createToken`, Guzzle HTTP POST to live `/api/v1/finngen/endpoints/{name}/gwas`, 30-second poll loop via `EndpointGwasRun::find()->fresh()`, summary_stats COUNT check, best-effort token cleanup in `finally` block

## Verification (Task 1)

- Pint clean; PHPStan level 8 clean
- `php artisan finngen:gwas-smoke-test --help` lists all new options: `--via-http`, `--endpoint`, `--source`, `--control-cohort`, `--base-url`, `--timeout-minutes`, `--user-email`
- All acceptance grep counts satisfied:
  - `grep -c "via-http"` returns >= 2 (signature + handler branch)
  - `grep -c "handleViaHttp"` returns >= 2 (declaration + invocation)
  - `grep -c "Http::withToken"` returns >= 1
  - `grep -c "EndpointGwasRun::find"` returns >= 1
  - `grep -c "createToken"` returns >= 1
  - `grep -c "summary_stats"` returns >= 2
  - `grep -c "timeout-minutes\|deadline"` returns >= 2
- Phase 14 existing non-`--via-http` behavior preserved

## SC-4 Deferral (Task 2)

The authoritative SC-4 end-to-end proof (real regenie run against PANCREAS cohort 221 producing summary_stats rows within 30 min) was deferred at the researcher's explicit approval. Reason: Phase 14 infra not convenient to exercise at phase-close time.

**Smoke command (verbatim, for when the human is ready):**

```
docker compose exec -T php php artisan finngen:gwas-smoke-test \
  --via-http --endpoint=E4_DM2 --source=PANCREAS \
  --control-cohort=221 --timeout-minutes=30 \
  --user-email=admin@acumenus.net \
  2>&1 | tee .planning/phases/15-gwas-dispatch-run-tracking-and-generation-history/15-smoke-transcript.txt
```

**Evidence to capture in 15-GATE-EVIDENCE.md (7 items):**
1. Command invocation (full CLI verbatim)
2. 202 dispatch response JSON (from the transcript)
3. Tracking row terminal state — `SELECT id, endpoint_name, source_key, control_cohort_id, status, case_n, control_n, top_hit_p_value, created_at, finished_at FROM finngen.endpoint_gwas_runs WHERE endpoint_name='E4_DM2' AND source_key='PANCREAS' ORDER BY id DESC LIMIT 1`
4. `pancreas_gwas_results.summary_stats COUNT(*) WHERE gwas_run_id = '<ulid>'`
5. Elapsed minutes (must be <= 30)
6. Drawer screenshot at `http://localhost:5175/workbench/finngen-endpoints` — click E4_DM2, confirm new row in "GWAS runs" section with status=succeeded
7. Rate-limit observation: burst 15 POSTs, record first 429

**Debt tracking:** See 15-HUMAN-UAT.md (created by orchestrator during phase verification).

## HIGHSEC Posture

- T-15-28: Token is never echoed in transcript — only "token minted" and "token cleanup" messages; raw token string not printed
- T-15-31: `finally { $tokenRecord->accessToken?->delete(); }` ensures best-effort cleanup; Sanctum 8h expiration (HIGHSEC §1.2) is fallback
- T-15-29: summary_stats rows are aggregate variant-level stats — no PHI
- T-15-30: Smoke runs 1 dispatch; rate-limit observation is deliberate burst-test per Manual-Only Verifications checklist

## Requirements

GENOMICS-03, GENOMICS-05, GENOMICS-14 — implementation complete; SC-4 gate evidence pending capture in 15-HUMAN-UAT.md.

## Deviations from Plan

None — Task 1 executed exactly as planned. Task 2 deferral was authorized by researcher (Option 3: UAT debt, not failure).

## Self-Check: PASSED

- `backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php` — FOUND (commit 4d4496508)
- Commit `4d4496508` (Task 1) — FOUND via `git log`
