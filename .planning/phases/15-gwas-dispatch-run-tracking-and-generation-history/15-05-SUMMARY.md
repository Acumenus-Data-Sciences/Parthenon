---
phase: 15
plan: 05
subsystem: finngen-endpoint-browser
tags: [frontend, tanstack-query, typescript, gwas, wave-3-foundation]
requirements: [GENOMICS-03, GENOMICS-05, GENOMICS-14]
status: complete
completed: 2026-04-18
dependency_graph:
  requires:
    - "15-04 (HTTP contract + exception→HTTP map)"
    - "15-UI-SPEC.md §TypeScript interfaces (lines 293-396)"
    - "frontend/src/lib/api-client.ts (apiClient singleton)"
  provides:
    - "Typed HTTP client extensions (dispatchGwas, fetchEligibleControls, fetchCovariateSets)"
    - "Three TanStack Query v5 hooks (useDispatchGwas, useEligibleControlCohorts, useCovariateSets)"
    - "7 new Phase 15 TypeScript types exported from feature api.ts"
  affects:
    - "Plan 06 (RunGwasPanel + drawer history components) consumes these hooks"
    - "Plan 07 (EndpointDetailDrawer wiring) consumes the invalidation keys"
tech_stack:
  added: []
  patterns:
    - "TanStack Query v5 useMutation with onSuccess → multi-key invalidation"
    - "Axios 4xx unwrap → typed refusal rethrow (mirrors Phase 13 generateEndpoint)"
    - "404 graceful fallback for optional catalog endpoints (UI-SPEC Assumption 10)"
key_files:
  created:
    - "frontend/src/features/finngen-endpoint-browser/hooks/useDispatchGwas.ts"
    - "frontend/src/features/finngen-endpoint-browser/hooks/useEligibleControlCohorts.ts"
    - "frontend/src/features/finngen-endpoint-browser/hooks/useCovariateSets.ts"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/api.phase15.test.ts"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/hooks.phase15.test.tsx"
  modified:
    - "frontend/src/features/finngen-endpoint-browser/api.ts"
decisions:
  - "Hand-authored TypeScript types (not OpenAPI re-exports) — 15-04 deferred ./deploy.sh --openapi"
  - "Exported EndpointDetailWithPhase15 as a wrapper instead of mutating EndpointDetail in-place (backward-compat for other consumers)"
  - "Used top-level api.ts appends instead of a new phase15.ts file (matches existing Phase 13 generateEndpoint pattern)"
metrics:
  duration_min: 15
  tasks_completed: 2
  files_touched: 6
  tests_added: 16
---

# Phase 15 Plan 05: Frontend Data Layer — api.ts + TanStack Query Hooks Summary

Wave 3 foundation: typed HTTP client extensions and three TanStack Query hooks wrapping the dispatch / eligible-controls / covariate-sets endpoints introduced in Plan 15-04.

## Outcome

Plan 06 (components) and Plan 07 (drawer wiring) can now `import { useDispatchGwas, useEligibleControlCohorts, useCovariateSets, type EndpointGwasRun, type EndpointGenerationRun, type EligibleControlCohort, type CovariateSetSummary, type DispatchGwasPayload, type DispatchGwasResponse, type GwasDispatchRefusal } from '@/features/finngen-endpoint-browser/api'` (types) and `from '@/features/finngen-endpoint-browser/hooks/...'` (hooks). All query keys and staleTimes match UI-SPEC §Component Contract.

## Tasks

| # | Task | Status | Commits |
|---|------|--------|---------|
| 1 | Extend api.ts with 7 Phase 15 types + 3 HTTP functions | ✓ | `370bfc0bd` (RED) + `28ca99917` (GREEN) |
| 2 | Three hook files (useDispatchGwas/useEligibleControlCohorts/useCovariateSets) | ✓ | `1038b1d10` (RED+GREEN combined — see "Concurrent worktree collision" below) |

## Implementation Detail

### api.ts additions (Task 1)

**Types (7):**
- `EndpointRunStatus` — union including "superseded"
- `EndpointGenerationRun`, `EndpointGwasRun`
- `EligibleControlCohort`, `CovariateSetSummary`
- `DispatchGwasPayload`, `DispatchGwasResponse`
- `GwasDispatchRefusal` + `GwasDispatchRefusalErrorCode` (10 codes matching the 15-04 controller exception map)
- `EndpointDetailWithPhase15` wrapper exposing `generation_runs`/`gwas_runs`/`gwas_ready_sources`

**Functions (3):**
- `dispatchGwas(name, payload)` — POSTs to `/finngen/endpoints/{name}/gwas`; on 422/409/403/404 throws the typed `GwasDispatchRefusal` body (callers `switch (refusal.error_code)`).
- `fetchEligibleControls(name, sourceKey)` — GETs the eligible-controls route with `source_key` as axios params; unwraps `.data.data`.
- `fetchCovariateSets()` — GETs `/finngen/gwas-covariate-sets`; on 404, returns the hard-coded `[{id:0, name:"Default: age + sex + 10 PCs", is_default:true, description:null}]` fallback per UI-SPEC Assumption 10.

**Hand-authored vs OpenAPI regen:** Plan 15-04 explicitly deferred `./deploy.sh --openapi`. Types live in `api.ts` with a comment pointing at 15-UI-SPEC.md lines 293-396 as the authoritative source. When a future pass regenerates `api.generated.ts`, swap these declarations for re-exports.

### hooks (Task 2)

| Hook | Shape | Key |
|------|-------|-----|
| `useDispatchGwas(endpointName)` | `useMutation<DispatchGwasResponse, GwasDispatchRefusal\|Error, DispatchGwasPayload>` | n/a (mutation) |
| `useEligibleControlCohorts({endpointName, sourceKey})` | `useQuery<EligibleControlCohort[]>` | `['finngen-endpoints', endpointName, 'eligible-controls', sourceKey]` |
| `useCovariateSets()` | `useQuery<CovariateSetSummary[]>` | `['finngen', 'covariate-sets']` |

**Invalidation contract (critical for Plan 06/07):**
On `useDispatchGwas` success, both keys below are invalidated:
1. `['finngen-endpoints', 'detail', endpointName]` — refreshes the drawer's `gwas_runs` history table without a manual refetch.
2. `['finngen-endpoints', endpointName, 'eligible-controls', variables.source_key]` — picker may re-rank after dispatch (cohort consumed / ranked up).

**staleTimes:**
- Eligible controls: 30 s (picker freshness — new cohorts can appear mid-session).
- Covariate sets: 5 min (admin-maintained; rarely changes).

## Tests Added

16 new test cases across 2 files — all pass.

| File | Cases | Coverage |
|------|-------|----------|
| `__tests__/api.phase15.test.ts` | 11 | `dispatchGwas` URL + encoding + 4xx refusal unwrap + 5xx passthrough; `fetchEligibleControls` URL + params; `fetchCovariateSets` 404 fallback + non-404 passthrough |
| `__tests__/hooks.phase15.test.tsx` | 5 | `useDispatchGwas` dual-key invalidation on success; `useEligibleControlCohorts` queryKey shape + enabled-gating (empty endpointName / empty sourceKey); `useCovariateSets` queryKey |

## Verification

| Gate | Status | Evidence |
|------|--------|----------|
| `docker run ... npx tsc --noEmit` | ✓ | `TSC_EXIT=0` |
| `docker run ... npx vite build` | ✓ | "built in 1.25s" |
| `docker run ... npx eslint <touched>` | ✓ | `ESLINT_EXIT=0` |
| `npx vitest run src/features/finngen-endpoint-browser` | ✓ | `20 tests passed` (4 files) |
| `npx vitest run` (full suite) | 1 unrelated failure | 707/710; only `src/i18n/__tests__/localeParity.test.ts` failed (pre-existing; not touched by this plan — logged to `deferred-items.md`) |

## Threat Model Mitigations Applied

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-15-17 (XSS on refusal copy) | Types require components to render `{refusal.message}` / `{refusal.hint}` as React text nodes; no HTML branch exists in this plan's code | `GwasDispatchRefusal` is a plain object type — no `dangerouslySetInnerHTML` introduced |
| T-15-18 (query cache residual) | Accepted; in-memory TanStack cache clears on logout via existing `authStore` plumbing | No long-lived persistence added |
| T-15-19 (URL injection) | `encodeURIComponent(name)` in both `dispatchGwas` and `fetchEligibleControls`; `source_key` passed via axios `params` (URL-encoded automatically) | `grep -c 'encodeURIComponent(name)' api.ts` = 4 (both new functions + both existing) |

## Deviations from Plan

**None.** Plan executed exactly as written. One additive decision (`EndpointDetailWithPhase15` as a separate export rather than mutating `EndpointDetail` in place) matches the plan's "if EndpointDetail comes from api.generated.ts, define a wrapper" branch — adopted here preventively since other consumers import `EndpointDetail` and we want zero blast radius for this append.

## Concurrent worktree collision (operational note, not a deviation)

Mid-execution a parallel worktree agent (Plan 17-01 PGS/PRS foundation) merged into main and the merge rewound my staged-but-unwritten RED commit for Task 2. Re-wrote the test file verbatim and proceeded with the combined RED→GREEN commit (`1038b1d10`). Evidence of the RED state is preserved in the pre-commit hook output from the aborted run and this summary. No code loss; the only artifact is that Task 2's test commit and implementation commit were folded into one.

**Also:** `git config core.hooksPath` reverted from `scripts/githooks` → `.git/hooks` during the concurrent merge. Restored before final verification. Followups may want to pin hooksPath via a repo-level config convention (or rely on `./deploy.sh` setting it each run).

## Handoff to Plan 06 + Plan 07

**Query key shapes — memorize these exactly:**

```
useEndpointDetail(name)           → ['finngen-endpoints', 'detail', name]
useEligibleControlCohorts(name,s) → ['finngen-endpoints', name, 'eligible-controls', s]
useCovariateSets()                → ['finngen', 'covariate-sets']
useEndpointList(params)           → ['finngen-endpoints', 'list', params]
useEndpointStats()                → ['finngen-endpoints', 'stats']
```

**Plan 06 (components):** `RunGwasPanel` should `catch (err)` from `.mutateAsync()` and treat anything with an `error_code` field as a `GwasDispatchRefusal`. Render `refusal.message` (always) and `refusal.hint` (if present) as text nodes. For `run_in_flight` / `duplicate_run`, surface `existing_run_id` as a "View existing run" link.

**Plan 07 (drawer wiring):** After `useDispatchGwas` success, the drawer's `gwas_runs` array will auto-refresh. No manual `refetch()` call needed.

## Deferred Issues

- `src/i18n/__tests__/localeParity.test.ts` failing on main (unrelated to this plan). Logged to `deferred-items.md`.

## Self-Check: PASSED

- `frontend/src/features/finngen-endpoint-browser/api.ts` — FOUND, has 173-line Phase 15 append.
- `frontend/src/features/finngen-endpoint-browser/hooks/useDispatchGwas.ts` — FOUND.
- `frontend/src/features/finngen-endpoint-browser/hooks/useEligibleControlCohorts.ts` — FOUND.
- `frontend/src/features/finngen-endpoint-browser/hooks/useCovariateSets.ts` — FOUND.
- `frontend/src/features/finngen-endpoint-browser/__tests__/api.phase15.test.ts` — FOUND.
- `frontend/src/features/finngen-endpoint-browser/__tests__/hooks.phase15.test.tsx` — FOUND.
- Commit `370bfc0bd` — FOUND (`git log`).
- Commit `28ca99917` — FOUND (`git log`).
- Commit `1038b1d10` — FOUND (`git log`).
