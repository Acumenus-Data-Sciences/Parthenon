---
phase: 17-pgs-prs
plan: 05
subsystem: cohort-definitions/frontend
tags: [frontend, react, recharts, tanstack-query, ui, vitest]
requirements_addressed: [GENOMICS-08]
wave: 3
depends_on: [17-03]
dependency_graph:
  requires:
    - 17-03 (backend contract — API routes & response shapes)
  provides:
    - PrsDistributionPanel (cohort drawer histogram + quintile bands)
    - ComputePrsModal (empty-state PGS Catalog picker)
    - usePrsScores hook set (TanStack Query)
  affects:
    - frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx
tech-stack:
  added: []
  patterns:
    - Recharts BarChart + ReferenceArea quintile overlays
    - Recharts Tooltip formatter cast `as never` (CLAUDE.md rule #11)
    - TanStack Query hooks (30s + 5min staleTime tuning)
    - Vitest ResponsiveContainer mock via React.cloneElement
    - role="dialog" + aria-modal=true + aria-labelledby for modal
key-files:
  created:
    - frontend/src/features/cohort-definitions/api/prs.ts (109 lines)
    - frontend/src/features/cohort-definitions/hooks/usePrsScores.ts (39 lines)
    - frontend/src/features/cohort-definitions/components/PrsDistributionPanel.tsx (238 lines)
    - frontend/src/features/cohort-definitions/components/ComputePrsModal.tsx (154 lines)
    - frontend/src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx (163 lines)
    - frontend/src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx (162 lines)
  modified:
    - frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx (+30 lines: import, state, diagnostics-tab section, modal wiring)
decisions:
  - "Plain <select> picker (not autocomplete) per 17-CONTEXT.md Open Question #2"
  - "Diagnostics-tab inline section chosen over new dedicated tab to minimize navigation churn; matches CohortDiagnosticsPanel placement"
  - "endpointName passed as null from detail page in v1 — cohort-level endpoint_name field not yet in the model; modal renders the v1 limitation notice instead of crashing; generic cohort dispatch deferred to 17.1"
  - "ResponsiveContainer mocked via React.cloneElement (forces jsdom layout) — required to render Recharts subtree in Vitest"
metrics:
  started: 2026-04-19T00:30:00Z
  completed: 2026-04-19T00:41:00Z
  duration: ~11 min
  tasks: 3
  commits: 3
  files_created: 6
  files_modified: 1
  lines_added: 895
---

# Phase 17 Plan 05: Cohort Drawer PRS Distribution Panel Summary

One-liner: cohort detail drawer diagnostics tab renders PRS histogram + 5 quintile ReferenceArea overlays + summary stats + CSV download, with an empty-state Compute PRS modal whose PGS Catalog picker is fed by TanStack Query; 9/9 Vitest assertions green, tsc + vite build clean, zero `any` types.

## Scope Delivered (GENOMICS-08 UI half)

| Artifact | Purpose | Lines | Status |
|----------|---------|-------|--------|
| `api/prs.ts` | Typed Axios shims: `fetchCohortPrsScores`, `fetchPgsCatalogScores`, `dispatchComputePrs`, `buildPrsDownloadUrl` | 109 | committed |
| `hooks/usePrsScores.ts` | `useCohortPrsScores`, `usePgsCatalogScores`, `useComputePrsMutation` | 39 | committed |
| `components/PrsDistributionPanel.tsx` | Recharts BarChart + 5 ReferenceArea bands + score picker + summary stats + Download CSV link | 238 | committed |
| `components/ComputePrsModal.tsx` | Empty-state CTA + PGS Catalog picker + source-key input + submit → useComputePrsMutation | 154 | committed |
| `__tests__/PrsDistributionPanel.test.tsx` | 5 Vitest assertions (loading, empty+onCompute, 5 ReferenceArea overlays, score-selector switching, 3sf formatting) | 163 | green |
| `__tests__/ComputePrsModal.test.tsx` | 4 Vitest assertions (picker options, disabled-when-no-endpoint, mutation payload, onClose-after-success) | 162 | green |
| `pages/CohortDefinitionDetailPage.tsx` | Import panel + modal, add showComputePrsModal state, render panel under Diagnostics tab, render modal at page root | +30 | committed |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `2eb0d36d0` | feat(17-05): add PRS API shims + TanStack Query hooks |
| 2 | `4aa584b2d` | feat(17-05): PrsDistributionPanel + diagnostics-tab integration |
| 3 | `3346af486` | feat(17-05): ComputePrsModal empty-state CTA + detail-page wiring |

## Rendered States

**Loading** — `role="status" aria-live="polite"` announces "Loading PRS scores…" to assistive tech.

**Error** — `role="alert"` surfaces `(error as Error).message` in critical-color text.

**Empty** — "No polygenic risk scores computed for this cohort yet." + crimson `Compute PRS` button whose `onClick` calls the parent's `onCompute` (wired to `setShowComputePrsModal(true)`).

**Populated** — Score `<select>` (default = first score) + `Download CSV` anchor + Recharts `BarChart` with 5 symmetric quintile `ReferenceArea` overlays (opacities `[0.1, 0.2, 0.3, 0.2, 0.1]`, darkest at the median band, fill color `var(--color-crimson)`) + `<Bar>` in `var(--color-teal)` + 8-cell summary grid (Subjects / Mean / Median / SD / Min / Max / IQR Q1 / IQR Q3, each formatted to 3 significant figures via `toPrecision(3)`).

## Compliance

- **CLAUDE.md Recharts Tooltip rule #11:** formatter cast `as never` — 1 occurrence in PrsDistributionPanel.tsx.
- **CLAUDE.md no-`any` rule:** zero `: any` in any file shipped by this plan.
- **CLAUDE.md `npx vite build` stricter than tsc:** both `npx tsc --noEmit` and `npx vite build` clean on final task.
- **HIGHSEC §2.1 Route Protection (client-side posture):** no new routes; all 3 endpoints hit (GET /cohort-definitions/{id}/prs, GET /pgs-catalog/scores, POST /finngen/endpoints/{name}/prs) already carry `auth:sanctum` + `permission:` middleware on the server (Plan 17-03/17-04).
- **HIGHSEC §5 secrets:** no secrets / tokens / env leaks in client bundle; bearer token continues to flow through the existing `apiClient` interceptor.

## Tests

```
$ npx vitest run src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx \
                 src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx
 Test Files  2 passed (2)
      Tests  9 passed (9)
   Duration  1.15s
```

| File | Tests | Result |
|------|-------|--------|
| PrsDistributionPanel.test.tsx | 5 | pass |
| ComputePrsModal.test.tsx | 4 | pass |

Additional checks:
- `npx tsc --noEmit` → no errors
- `npx vite build` → `built in 832ms` (warnings on pre-existing chunk size; none from files touched by this plan)

## Decisions Made

1. **Picker is a plain `<select>`, not an autocomplete.** Matches 17-CONTEXT.md Open Question #2 resolution. PGS Catalog size (~4000 scores) is fine for a native scroll; autocomplete deferred to 17.1.
2. **Panel placement is the Diagnostics tab, not a new dedicated tab.** The detail page already has 5 tabs; adding a 6th raised navigation cost without a functional win. PRS is a diagnostic of the cohort, so it sits next to attrition + cohort diagnostics.
3. **`endpointName` currently passed as `null` from the detail page.** The v1 dispatch path requires a FinnGen endpoint name, which is not a field on `app.cohort_definitions`. The modal renders a user-visible v1 limitation notice and disables submit — never crashes. Generic cohort dispatch (direct cohort_definition_id, no endpoint) is tracked in 17-DEFERRED-ITEMS.md.
4. **`ResponsiveContainer` is mocked in Vitest via `React.cloneElement`.** jsdom has no layout engine, so the real ResponsiveContainer reports 0×0 and refuses to render children. The mock injects `width={800} height={280}` onto the cloned `BarChart` so the full SVG subtree mounts, letting us assert against `.recharts-reference-area` nodes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest needed a `ResponsiveContainer` mock to render Recharts in jsdom**
- **Found during:** Task 2 (first Vitest run failed with 0 ReferenceArea elements)
- **Issue:** jsdom has no layout; `ResponsiveContainer` reports `width: 0, height: 0`, so Recharts' `BarChart` refuses to render any of its children. The `.recharts-reference-area` assertion failed 5 → 0.
- **Fix:** `vi.mock('recharts', …)` that replaces `ResponsiveContainer` with a `React.cloneElement(children, { width: 800, height: 280 })` wrapper. Real production render continues to use the unmodified `ResponsiveContainer`.
- **Files modified:** `PrsDistributionPanel.test.tsx`
- **Commit:** `4aa584b2d`

**2. [Rule 3 — Blocking] Worktree lacked `node_modules`; Docker `node` service mounts a different repo path**
- **Found during:** Task 2 (first `docker compose exec node npx vitest` run hit "No test files found" because the container's `/app` mounts `/home/smudoshi/Github/Parthenon-i18n-unified/frontend`, not our worktree at `/home/smudoshi/Github/Parthenon/.claude/worktrees/agent-ae324354/frontend`)
- **Fix:** Symlinked the worktree's `frontend/node_modules` to the main frontend's `node_modules` directory, then ran `./node_modules/.bin/vitest` directly from the worktree. No changes to `docker-compose.yml`; the symlink is not committed (covered by `.gitignore`).
- **Files modified:** none tracked
- **Commit:** — (ephemeral tooling fix)

Both deviations are infrastructure-only; neither changes production behavior.

## v1 Limitation (documented for users)

The **Compute PRS** button in the empty state opens a modal that currently disables its Submit button with the notice:

> PRS compute is available only for FinnGen endpoint cohorts in v1. Materialize this cohort against a FinnGen endpoint first.

This is the same behavior the backend enforces at `POST /api/v1/finngen/endpoints/{name}/prs`, but because the cohort-drawer context doesn't surface which FinnGen endpoint (if any) a cohort was promoted from, the frontend passes `endpointName={null}`. Future work (Phase 17.1) either:
1. Adds a `app.cohort_definitions.finngen_endpoint_name` column populated when FinnGen promotes a cohort, OR
2. Adds a generic `POST /api/v1/cohort-definitions/{id}/prs` dispatch path that derives the endpoint from `cohort_definition_id` when it falls into the 100B-offset range.

Tracked in `.planning/phases/17-pgs-prs/17-DEFERRED-ITEMS.md`.

## Parallel-Execution Guardrails Honored

- No file owned by Plan 17-04 touched (CohortPrsController, PgsCatalogController, PrsAggregationService, DownloadPrsRequest, routes/api.php, CohortPrsEndpointsTest).
- No edits to `.planning/STATE.md` or `.planning/ROADMAP.md`.
- All 3 commits used `--no-verify` per parallel-execution note (pre-commit hook would demand the PHP-side checks that are owned by Plan 17-04's agent).

## Self-Check: PASSED

Created files (verified on disk):
- FOUND: frontend/src/features/cohort-definitions/api/prs.ts
- FOUND: frontend/src/features/cohort-definitions/hooks/usePrsScores.ts
- FOUND: frontend/src/features/cohort-definitions/components/PrsDistributionPanel.tsx
- FOUND: frontend/src/features/cohort-definitions/components/ComputePrsModal.tsx
- FOUND: frontend/src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx
- FOUND: frontend/src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx

Commits (verified in `git log`):
- FOUND: 2eb0d36d0 (Task 1)
- FOUND: 4aa584b2d (Task 2)
- FOUND: 3346af486 (Task 3)
