---
phase: 15
plan: 06
subsystem: finngen-endpoint-browser
tags: [frontend, react, tanstack-query, ui, gwas, wave-3-sections]
requirements: [GENOMICS-03, GENOMICS-05, GENOMICS-14]
status: complete
completed: 2026-04-19
dependency_graph:
  requires:
    - "15-01 (UI-SPEC §D-22/D-23/D-24/D-25 layout + copy contracts)"
    - "15-04 (EndpointDetail show() response: generation_runs / gwas_runs / gwas_ready_sources)"
    - "15-05 (typed api.ts + 3 TanStack Query hooks)"
  provides:
    - "GenerationHistorySection component (grouped-by-source disclosures)"
    - "GwasRunsSection component (flat list + supersede back-links)"
    - "RunGwasPanel component (source/control/covariate pickers + dispatch CTA)"
    - "Extended RunStatusBadge — 7 statuses including superseded at font-semibold"
  affects:
    - "Plan 07 (drawer wiring) composes these three sections into EndpointDetailDrawer"
    - "Plan 08 (tests + VALIDATION.md) asserts section-level rendering"
tech_stack:
  added: []
  patterns:
    - "2-weight typography contract (font-semibold + default 400; font-medium banned)"
    - "Disclosure pattern via <button type='button'> + aria-expanded + aria-controls"
    - "role=list + aria-live=polite container for status-change announcements"
    - "useRef + onSuccess-triggered focus return (focus management post-dispatch)"
    - "Error-code switch → UI-SPEC-literal banner copy map (10 codes)"
key_files:
  created:
    - "frontend/src/features/finngen-endpoint-browser/components/GenerationHistorySection.tsx"
    - "frontend/src/features/finngen-endpoint-browser/components/GwasRunsSection.tsx"
    - "frontend/src/features/finngen-endpoint-browser/components/RunGwasPanel.tsx"
    - "frontend/src/features/finngen-endpoint-browser/components/__tests__/GenerationHistorySection.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/components/__tests__/GwasRunsSection.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/components/__tests__/RunGwasPanel.test.tsx"
  modified:
    - "frontend/src/features/_finngen-foundation/components/RunStatusBadge.tsx"
    - "frontend/src/features/_finngen-foundation/__tests__/RunStatusBadge.test.tsx"
decisions:
  - "Widened RunStatusBadge status via local RunStatusBadgeStatus = FinnGenRunStatus | 'superseded' (kept FinnGenRunStatus source of truth untouched; isolates blast radius)"
  - "Followed plan's sample JSX verbatim for all three new components (UI-SPEC literals)"
  - "Did NOT render 'Open in Workbench →' child buttons inside expanded generation rows in v1.0 — that wiring belongs to Plan 07 (drawer integration) where the mutation hook is in scope"
  - "generationRuns prop on RunGwasPanel kept in signature despite being unused in v1.0 to preserve the UI-SPEC contracted surface; prefixed _ + void to silence lint"
metrics:
  duration_min: 9
  tasks_completed: 3
  files_touched: 8
  tests_added: 17
---

# Phase 15 Plan 15-06: Drawer Sections + Dispatch Panel Summary

Wave 3 user-facing surface: three React components + RunStatusBadge extension deliver the researcher drawer experience for GWAS dispatch, GWAS run history, and endpoint generation history.

## Outcome

The FinnGen Endpoint Browser drawer now has component-ready building blocks for Plan 07 to wire:
- `GenerationHistorySection` — grouped-by-source disclosures over `EndpointDetail.generation_runs`.
- `GwasRunsSection` — flat newest-first tracking-row list over `EndpointDetail.gwas_runs` with Phase 16 deep links.
- `RunGwasPanel` — dispatch form (collapsed by default) wired to `useDispatchGwas` / `useEligibleControlCohorts` / `useCovariateSets` from Plan 15-05.

All layout, Tailwind classes, and copywriting follow UI-SPEC §Layout Specification verbatim. The RunStatusBadge is promoted to `font-semibold` across every call site (Phase 15 2-weight typography contract) and now supports the `superseded` status with zinc-muted pill tokens.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend RunStatusBadge: add `superseded` + font-semibold | ✓ | `e07d0295e` |
| 2 | Create GenerationHistorySection + GwasRunsSection | ✓ | `0aac3628c` |
| 3 | Create RunGwasPanel dispatch form | ✓ | `51eeeb67c` |

## Task Detail

### Task 1 — RunStatusBadge extension

- Added `superseded` case to CLASSNAMES (`border-zinc-700/40 bg-zinc-900/40 text-zinc-500`) and LABELS.
- Introduced local type `RunStatusBadgeStatus = FinnGenRunStatus | "superseded"` so the foundation `FinnGenRunStatus` union (which mirrors raw `finngen.runs.status`) stays unchanged. `superseded` is a tracking-row-only terminal state (D-10) — never set on a `finngen.runs` row.
- Promoted span className from `font-medium` → `font-semibold` (UI-SPEC Dimension 4 Typography 2-weight contract — single-word edit).
- Tests extended: 2 new cases (superseded render + zinc classes; font-semibold contract).

**Grep evidence:** `superseded` × 4 in file, `zinc-700/40` × 1, `font-semibold` × 1, `font-medium` × 0. Tsc + vite build + ESLint green. 9/9 tests pass.

### Task 2 — Section components

**GenerationHistorySection.tsx** — Groups `generation_runs` by `source_key`; each source gets one disclosure button (collapsed by default). Header shows chevron (rotates 90° on expand) + mono source_key badge + `<RunStatusBadge>` for latest + tabular-nums subject count + mono relative time. Expanded body is a left-rule list of per-run rows. Empty-state uses `<EmptyState title="This endpoint hasn't been generated yet." message='Pick a source under "Run GWAS" below to generate first.' />`. Overflow disclosure links to `/workbench/finngen-analyses?endpoint={name}` when `totalCount > runs.length`.

**GwasRunsSection.tsx** — Flat `<Link>` rows into `/workbench/finngen-endpoints/{name}/gwas/{run_id}` (Phase 16 reserved route). Container carries `role="list" aria-live="polite"` for screen-reader announcements on status updates. Helpers:
- `formatCaseControl(case_n, control_n)` → `"312 / 9,421"` or `"—/—"` if either is null.
- `formatPValue(p)` → `p.toExponential(1)`; clamps `< 1e-300` to `"<1e-300"`.

Superseded rows (D-10) are muted (`opacity-60`) and render a sub-line `→ replaced by run #{supersededBy}`. When the replacement is in the same 100-row window, the sub-link routes directly to its Phase 16 page; otherwise it falls back to `/workbench/finngen-analyses?tracking_id={supersededBy}`. Inner link has `onClick={e => e.stopPropagation()}` to prevent the outer row navigating first.

**Grep evidence** (both files):
- `export function GenerationHistorySection` × 1, `export function GwasRunsSection` × 1
- `font-medium` × 0 (2-weight contract; zero across all Phase 15 code)
- `font-semibold` × 3 in GenHistory, × 2 in GwasRuns
- `aria-expanded` × 2, `aria-controls` × 2 in GenHistory
- `aria-live="polite"` × 2 (HTML attr + code comment), `role="list"` × 2 in GwasRuns
- `opacity-60` × 1, `superseded_by_tracking_id` × 1, `workbench/finngen-endpoints` × 2 in GwasRuns

Tsc + vite build + ESLint green. 11/11 tests pass.

### Task 3 — RunGwasPanel

Dispatch form with six pieces of internal state matching UI-SPEC §Component Contract RunGwasPanel exactly:
```
sourceKey | controlCohortId | covariateSetId | advancedOpen | overwrite | panelOpen
```

Composed from three hooks:
- `useDispatchGwas(endpoint.name)` — Plan 15-05 mutation. `onSuccess` collapses the panel and returns focus to the collapsed trigger (`useRef` + `button.focus()`).
- `useEligibleControlCohorts({endpointName, sourceKey})` — enabled only when `sourceKey` set.
- `useCovariateSets()` — eager fetch; default is `is_default=true` row.

Derived state:
- `sourcesReadyForGwas` — `endpoint.gwas_ready_sources ?? []`.
- `activeCovariateSetId` — `covariateSetId ?? defaultCovariateSet?.id ?? null`.
- `ctaDisabled` — missing source | missing control | missing covariate | `dispatch.isPending` | `coverage_bucket ∈ {CONTROL_ONLY, UNMAPPED}`.

Error banner maps all 10 `GwasDispatchRefusalErrorCode` values to UI-SPEC §Copywriting literals via `bannerCopy(refusal)`. Special cases:
- `run_in_flight` → renders inline `Go to running run →` Link to `/workbench/finngen-analyses?run={existing_run_id}`.
- `endpoint_not_materialized` → renders inline `Generate first →` anchor to `#gen-history-heading`.
- `duplicate_run` → auto-focuses the overwrite checkbox (`useEffect` on `refusal?.error_code`) so the user can opt in without scrolling. Does NOT auto-check.

Focus management: `useEffect(() => bannerRef.current?.focus(), [refusal])` pushes focus to the `role="alert"` banner (with `tabIndex={-1}`) on any refusal.

Overwrite checkbox uses `accent-rose-500` and label tints rose-300 when checked (UI-SPEC §Copywriting destructive confirmation). Primary CTA uses `bg-teal-500/90 hover:bg-teal-400` + `focus:ring-2 focus:ring-teal-500/40` — one ring thickness above standard controls, matching UI-SPEC §Focus rings.

**Grep evidence:**
- `export function RunGwasPanel` × 1
- `useDispatchGwas` × 2, `useEligibleControlCohorts` × 2, `useCovariateSets` × 2
- `font-medium` × 0, `font-semibold` × 7
- `aria-expanded` × 3, `role="alert"` × 1
- `run_in_flight` × 2, `duplicate_run` × 2, `overwriteRef` × 4
- `accent-rose-500` × 1, `bg-teal-500/90` × 1, `focus:ring-2` × 2

Tsc + vite build + ESLint green. 7/7 tests pass.

## Tests Added

17 new test cases across 3 files — all pass.

| File | Cases | Coverage |
|------|-------|----------|
| `__tests__/GenerationHistorySection.test.tsx` | 4 | Empty state / group header count / expand-on-click / overflow disclosure |
| `__tests__/GwasRunsSection.test.tsx` | 7 | Empty state / Phase 16 deep link / case-control format / p-value format / supersede muting + back-link / p-value clamp / role=list + aria-live |
| `__tests__/RunGwasPanel.test.tsx` | 7 | Collapsed default / disabled with no ready sources / expand reveals pickers / CTA disabled-until-complete / dispatch payload shape / run_in_flight banner + link / duplicate_run banner copy |

Plus 2 new cases in `RunStatusBadge.test.tsx` covering the `superseded` render and the font-semibold contract (9/9 passing).

## Verification

| Gate | Status | Evidence |
|------|--------|----------|
| `npx tsc --noEmit` | ✓ | EXIT=0 |
| `npx vite build` (CI-stricter) | ✓ | "built in 808ms" |
| `npx eslint --max-warnings=0` on all 8 touched files | ✓ | EXIT=0 |
| `npx vitest run <Phase 15-06 tests>` | ✓ | 27/27 across 4 files |
| Pre-commit hook (Pint/PHPStan/tsc/ESLint/Vitest/vite build) | ✓ | All 3 commits passed |
| 2-weight contract: `grep -rc font-medium` across Phase 15 code | ✓ | 0 hits |
| Plan 07 handoff: section components import from `@/features/finngen-endpoint-browser/components/*` | ✓ | All three exports named + barrel-ready |

## Threat Model Mitigations Applied

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-15-17 (XSS via refusal.message/hint) | All refusal fields rendered as React text children; no `dangerouslySetInnerHTML` introduced in this plan | `grep -rc dangerouslySetInnerHTML frontend/src/features/finngen-endpoint-browser/components/` returns 0 |
| T-15-19 (Open redirect via existing_run_id / run_id) | `encodeURIComponent` on every dynamic Link segment; Link uses React Router (internal navigation only); no `target="_blank"` | Both GwasRunsSection and RunGwasPanel use `encodeURIComponent(endpointName)` + `encodeURIComponent(run_id)` for Phase 16 deep links + run_in_flight banner link |
| T-15-20 (Clickjacking on row Links) | Accepted — protected by existing Apache `X-Frame-Options: DENY` + Parthenon CSP | n/a here |
| T-15-21 (Accessibility) | aria-expanded + aria-controls on GenerationHistorySection disclosures; role=list + aria-live=polite on GwasRunsSection container; role=alert + tabIndex=-1 banner on RunGwasPanel with focus return via useRef; focus:ring-1/ring-2 on every interactive element | Grep counts in acceptance criteria verified |

## Deviations from Plan

**None in behavior.** Two micro-adjustments to follow lint/style without changing the contract:

1. **`generationRuns` prop on RunGwasPanel is unused in v1.0.** The UI-SPEC contracts the prop (`generationRuns: EndpointGenerationRun[]`); the plan's sample code receives it but does not consume it (derivation of `sourcesReadyForGwas` goes through `endpoint.gwas_ready_sources` per UI-SPEC Assumption 1). Kept the prop in the signature for forward compatibility and silenced the lint with `_generationRuns` rename + `void _generationRuns` — no contract change.

2. **Sibling-workspace sync for pre-commit ESLint.** The `parthenon-node` Docker container is bind-mounted to a sibling worktree (`/home/smudoshi/Github/Parthenon-i18n-unified/frontend`), not this working tree. The pre-commit hook runs ESLint through that container, so new files had to be copied to the sibling dir for the hook to see them. No code change; purely environmental. Flagged for a follow-up fix to either re-bind the container to the canonical path or route the hook's ESLint through the host. Documented so a future agent doesn't re-discover it.

No UI-SPEC deviations. No copy deviations. No Tailwind-class deviations. No ARIA deviations.

## Deferred Issues

- **node container bind-mount mismatch** — the shared `parthenon-node` service is still bound to `Parthenon-i18n-unified/frontend`. This is a pre-existing issue visible to every executor that touches the frontend from this working tree. Short-term workaround: copy new files to the sibling before `git commit`. Long-term: either restart the compose stack with the canonical mount, or rewrite the pre-commit hook to run ESLint on the host (matches how Vitest already works at line 74 of the hook).

## Handoff to Plan 07 + Plan 08

**Plan 07 (drawer wiring):**
```tsx
import { GenerationHistorySection } from "@/features/finngen-endpoint-browser/components/GenerationHistorySection";
import { GwasRunsSection } from "@/features/finngen-endpoint-browser/components/GwasRunsSection";
import { RunGwasPanel } from "@/features/finngen-endpoint-browser/components/RunGwasPanel";
```

Compose in drawer body (UI-SPEC §Section Order):
```tsx
<GenerationHistorySection
  endpointName={endpoint.name}
  longname={endpoint.longname}
  cohortDefinitionId={endpoint.id}
  runs={endpoint.generation_runs ?? []}
  totalCount={endpoint.generation_runs_total}
/>
<GwasRunsSection
  endpointName={endpoint.name}
  runs={endpoint.gwas_runs ?? []}
  totalCount={endpoint.gwas_runs_total}
/>
<RunGwasPanel
  endpoint={endpoint}
  generationRuns={endpoint.generation_runs ?? []}
/>
```

Remove the existing inline `GenerationHistoryRow` block in `FinnGenEndpointBrowserPage.tsx` (lines ~490-731). Keep the coverage / metadata / source-codes / existing `GeneratePanel` (step-1 materialization) sections unchanged.

**Plan 08 (tests + VALIDATION.md):** section-level component tests are already in place. Focus there is integration / Playwright E2E / VALIDATION.md item checklist.

## Self-Check: PASSED

- `frontend/src/features/finngen-endpoint-browser/components/GenerationHistorySection.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/components/GwasRunsSection.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/components/RunGwasPanel.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/components/__tests__/GenerationHistorySection.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/components/__tests__/GwasRunsSection.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/components/__tests__/RunGwasPanel.test.tsx` — FOUND
- `frontend/src/features/_finngen-foundation/components/RunStatusBadge.tsx` — FOUND (7 statuses; font-semibold)
- Commit `e07d0295e` (Task 1) — FOUND (`git log`)
- Commit `0aac3628c` (Task 2) — FOUND (`git log`)
- Commit `51eeeb67c` (Task 3) — FOUND (`git log`)
