---
phase: 18
plan: 06
subsystem: finngen-endpoint-browser-frontend
tags: [react, typescript, finngen, endpoint-profile, kaplan-meier, comorbidity, drug-classes, recharts, tanstack-query]
requires:
  - 18-04 (HTTP contract: GET/POST /api/v1/finngen/endpoints/{name}/profile)
  - 18-05 (R worker that writes 4 cached tables in {source}_co2_results)
  - 18-01 (Wave 0 RED Vitest stubs flipped GREEN here)
  - 13.2 (FinnGen drawer + tab pattern reused)
  - 17 (Recharts pattern reference: PrsDistributionPanel.tsx)
provides:
  - "Profile tab inside the FinnGen Endpoint Browser drawer (D-12)"
  - "ProfilePanel orchestrator with auto-dispatch on needs_compute (D-10)"
  - "SurvivalPanel reusing KaplanMeierPlot via D-13 adapter (nCensored derived client-side)"
  - "ComorbidityMatrixPanel 50×1 HTML/CSS heatmap with click-through nav (D-06/D-07)"
  - "DrugClassesPanel horizontal Recharts BarChart (D-14)"
  - "ComputeProfileCta with 4-state machine (cold/computing/ineligible/error)"
  - "useEndpointProfile + useDispatchEndpointProfile + useEndpointProfileKmData hooks"
  - "heatmap-helpers.getPhiCellClass() Tailwind class mapper (D-07 teal-400 / crimson)"
  - "8 EndpointProfile* TypeScript types + 2 fetch fns in api.ts"
affects:
  - "frontend/src/features/finngen-endpoint-browser/api.ts (extended)"
  - "frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx (extended with TabBar)"
tech-stack:
  added: []
  patterns:
    - "TanStack Query refetchInterval gated on data.status — implements UI-SPEC §Auto-dispatch + polling (3s constant exported)"
    - "Adapter hook deriving missing field from server contract (nCensored from subject_count + at_risk + events)"
    - "Recharts Tooltip/LabelList formatter cast `as never` — Parthenon CLAUDE.md Gotcha #11"
    - "HTML/CSS-grid heatmap with Tailwind opacity variants instead of Recharts ScatterChart for 50×1 ranked list"
    - "URL-driven tab state via useSearchParams; ?tab=profile&source=PANCREAS deep-link"
    - "Inline StatTile helper instead of new primitive (UI-SPEC Flag §11)"
key-files:
  created:
    - frontend/src/features/finngen-endpoint-browser/hooks/useEndpointProfile.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useDispatchEndpointProfile.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useEndpointProfileKmData.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/__tests__/useEndpointProfileKmData.test.ts
    - frontend/src/features/finngen-endpoint-browser/components/profile/heatmap-helpers.ts
    - frontend/src/features/finngen-endpoint-browser/components/profile/ProfilePanel.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/SurvivalPanel.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/ComorbidityMatrixPanel.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/DrugClassesPanel.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/ComputeProfileCta.tsx
  modified:
    - frontend/src/features/finngen-endpoint-browser/api.ts
    - frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/__tests__/ProfilePanel.test.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/__tests__/SurvivalPanel.test.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/__tests__/ComorbidityMatrixPanel.test.tsx
    - frontend/src/features/finngen-endpoint-browser/components/profile/__tests__/DrugClassesPanel.test.tsx
decisions:
  - "Used TabBar+TabPanel from @/components/ui/Tabs to split the existing drawer body into 'Overview' (existing Phase 13/15 sections) + 'Profile' (Phase 18). TabBar is mounted at the top of EndpointDetailBody; URL state lives in the drawer parent via useSearchParams."
  - "Defined a local KaplanMeierAdapterPoint type instead of importing KaplanMeierPoint — the latter is an internal `interface` in KaplanMeierPlot.tsx that is not exported. Local mirror keeps the contract documented and avoids touching the reused estimation component (D-13 reuse discipline)."
  - "Mocked the 2 TanStack Query hooks in ProfilePanel.test via vi.mock — avoids needing MSW handlers and lets the test focus on the orchestration state machine (auto-dispatch on needs_compute, sub-panel rendering on cached, banner on ineligible)."
  - "ComorbidityMatrixPanel test asserts onNavigate(name) contract directly via vi.fn() and reconstructs the URL the parent would have built; URL pattern correctness is then re-asserted in ProfilePanel.handleNavigateToComorbid."
metrics:
  duration_seconds: 552
  duration_human: "9m 12s"
  tasks: 2
  files_created: 10
  files_modified: 6
  vitest_assertions_added: 27  # 5 adapter + 5 ProfilePanel + 5 SurvivalPanel + 8 ComorbidityMatrix + 4 DrugClasses
  completed: 2026-04-19
---

# Phase 18 Plan 06: Risteys-style Profile Tab — Frontend Summary

**One-liner:** React Profile tab landing in the FinnGen endpoint drawer — KaplanMeierPlot + 50×1 phi-coefficient heatmap + horizontal ATC3 bars — backed by 3 TanStack Query hooks against the 18-04 HTTP contract.

## Component Tree

```
FinnGenEndpointBrowserPage
└── EndpointDetailDrawer (existing)
    └── EndpointDetailBody (modified — now TabBar-routed)
        ├── TabBar [overview | profile]   ← new
        ├── TabPanel id="overview"        ← wraps existing Phase 13/15 sections
        │   ├── coverage block (existing)
        │   ├── source codes (existing)
        │   ├── GenerationHistorySection (existing)
        │   ├── GwasRunsSection (existing)
        │   ├── RunGwasPanel (existing)
        │   └── GeneratePanel (existing)
        └── TabPanel id="profile"         ← NEW
            └── ProfilePanel
                ├── back-breadcrumb (when priorEndpointName set)
                ├── status branches:
                │   ├── ineligible → AlertTriangle banner with error_code copy
                │   ├── needs_compute → ComputeProfileCta state="computing" + auto-mutate
                │   └── cached:
                │       ├── SurvivalPanel
                │       │   ├── Survival eyebrow
                │       │   ├── (disabled banner if !sourceHasDeathData)
                │       │   ├── 3 inline StatTiles (Median survival / Deaths / Subjects at index)
                │       │   ├── KaplanMeierPlot (via useEndpointProfileKmData adapter, overflow-x-auto)
                │       │   └── Recharts BarChart (age-at-death 5-year bins)
                │       ├── ComorbidityMatrixPanel
                │       │   ├── Comorbidities eyebrow + subtitle
                │       │   ├── 50×1 HTML/CSS grid (button rows with getPhiCellClass fills)
                │       │   ├── tooltip on hover (phi/OR/CI)
                │       │   └── universe footer caption
                │       ├── DrugClassesPanel
                │       │   ├── Drug-classes eyebrow + denominator clarifier
                │       │   ├── empty state (2 distinct copies)
                │       │   └── Recharts BarChart layout="vertical" + LabelList %
                │       └── cached-timestamp footer
```

## URL Sync Contract

| URL pattern | Drawer behavior |
|---|---|
| `?endpoint=E4_DM2` (existing) | Drawer auto-opens to E4_DM2; Overview tab is the default |
| `?endpoint=E4_DM2&tab=profile` | Drawer opens to E4_DM2 with the Profile tab pre-selected |
| `?endpoint=E4_DM2&tab=profile&source=PANCREAS` | Same, with explicit source override |
| Click "Profile" tab | URL becomes `?...&tab=profile&source=PANCREAS` (replace, not push) |
| Click "Overview" tab | URL drops `?tab=profile`; preserves `?source=` |
| ComorbidityMatrixPanel row click → ProfilePanel.onNavigate | `navigate(?open=${clicked}&tab=profile&source=${sourceKey})` with state.fromEndpoint set |
| Browser back-button | React Router restores prior `?open=...&tab=profile&source=...` — TanStack Query cache hit ≤ 200ms |

## Copy-string Adherence (UI-SPEC Verbatim)

All copy strings come VERBATIM from `18-UI-SPEC.md` §Copywriting Contract. Spot checks:

| Element | Required copy | Where |
|---|---|---|
| SurvivalPanel eyebrow | `Survival` | SurvivalPanel.tsx:97 |
| SurvivalPanel disabled banner | `No death data in this source — survival panel disabled. Comorbidity + drug panels still render below.` | SurvivalPanel.tsx:91-93 |
| StatTile labels | `Median survival` / `Deaths` / `Subjects at index` | SurvivalPanel.tsx:107/113/118 |
| StatTile captions | `Kaplan-Meier median` / `Too few deaths to estimate` / `subjects with death date` / `first qualifying event` | SurvivalPanel.tsx:73-76, 115, 120 |
| Age-at-death heading | `Age at death (5-year bins)` | SurvivalPanel.tsx:142 |
| Comorbidities eyebrow | `Comorbidities` | ComorbidityMatrixPanel.tsx:38 |
| Comorbidity subtitle | `Top 50 co-occurring FinnGen endpoints by \|phi\|. Click a row to navigate to that endpoint's profile.` | ComorbidityMatrixPanel.tsx:42 |
| Comorbidity universe footer | `Universe: {N} FinnGen endpoints with ≥ {M} subjects on {source}.` | ComorbidityMatrixPanel.tsx:118 |
| Comorbidity empty (small universe) | `Only {N} FinnGen endpoints have ≥ {M} subjects on this source. Ranked list is shorter than 50.` | ComorbidityMatrixPanel.tsx:51 |
| Comorbidity empty (universe=0) | `No co-occurring endpoints with ≥ {M} subjects on this source.` | ComorbidityMatrixPanel.tsx:49 |
| Drug-classes eyebrow | `Drug classes (90d pre-index)` | DrugClassesPanel.tsx:35 |
| Drug-classes subtitle | `Top 10 ATC3 drug classes prescribed in the 90 days before first qualifying event.` | DrugClassesPanel.tsx:39 |
| Drug-classes denominator clarifier | `Subjects with no drug records in the 90d window are excluded from the denominator.` | DrugClassesPanel.tsx:43 |
| Drug-classes empty (no records, has data) | `No drug records in the 90-day pre-index window for this endpoint × source.` | DrugClassesPanel.tsx:51 |
| Drug-classes empty (no source data) | `This source has no drug-exposure data. Drug timeline cannot be rendered.` | DrugClassesPanel.tsx:52 |
| Ineligible source error | `This source has no death or observation-period data. Endpoint profile cannot be computed.` | ProfilePanel.tsx:32-33 |
| Ineligible endpoint error | `This endpoint has no resolvable concepts. Profile cannot be computed.` | ProfilePanel.tsx:34-35 |
| Permission denied error | `You don't have permission to compute endpoint profiles. Contact an admin.` | ProfilePanel.tsx:36-37 |
| Computing CTA copy | `Computing profile… ~15s` | ComputeProfileCta.tsx:48 |

## nCensored Derivation Proof

The backend `endpoint_profile_km_points` table has columns `(time_days, survival_prob, at_risk, events)` — NO `censored` column. The reused `KaplanMeierPlot` component requires `nCensored` per point.

`useEndpointProfileKmData(kmPoints, subjectCount, displayName)` derives it:

```typescript
// Row 0: prevAtRisk = subjectCount
// Row i (i≥1): prevAtRisk = sorted[i-1].at_risk
// drop = prevAtRisk - p.at_risk
// nCensored = max(0, drop - p.events)   // clamp pathological data
```

**Test evidence** (`useEndpointProfileKmData.test.ts`):

| Input | Expected nCensored | Actual |
|---|---|---|
| 3-point curve, subject_count=100, at_risk=[95,90,85], events=[3,2,5] | `[2, 3, 0]` | ✓ matches |
| Pathological: subject_count=100, at_risk=[90], events=[20] (events>drop) | `[0]` (clamped) | ✓ matches |
| 1-point curve, time_days=730 | `timeUnit="years"` + `time≈1.998` | ✓ matches |
| Empty kmPoints | `comparatorCurve===[], comparatorLabel===undefined` | ✓ matches |

5 adapter assertions GREEN. See `frontend/src/features/finngen-endpoint-browser/hooks/__tests__/useEndpointProfileKmData.test.ts`.

## D-07 teal-400 Adherence (Color Lock)

Per 18-CONTEXT.md D-07: `negative phi → teal (#2DD4BF) / teal-400`, NOT `teal-500` (#14b8a6).

`heatmap-helpers.ts` evidence:

```bash
$ grep -E 'teal-(400|500)|#2DD4BF' frontend/src/features/finngen-endpoint-browser/components/profile/heatmap-helpers.ts
14:  if (phi >= 0.05) return "bg-[#9B1B30]/40 text-rose-50";
16:  if (phi > -0.2) return "bg-teal-400/40 text-teal-100";
17:  if (phi > -0.5) return "bg-teal-400/70 text-slate-950";
18:  return "bg-teal-400 text-slate-900";
```

- ✓ teal-400 present in 3 negative-phi branches
- ✓ teal-500 absent (zero matches)
- ✓ #9B1B30 crimson present in positive-phi branches

ComputeProfileCta also uses `teal-400/80 → teal-400` to visually match the heatmap negative-phi hue (avoids clashing with teal-500).

ComorbidityMatrixPanel hover state uses `hover:border-teal-400/40` and `focus:ring-teal-400/40` for the same hue consistency.

## Vitest GREEN Evidence

```
$ docker compose exec -T node sh -c "cd /app && npx vitest run \
    src/features/finngen-endpoint-browser/components/profile/__tests__/ \
    src/features/finngen-endpoint-browser/hooks/__tests__/useEndpointProfileKmData.test.ts \
    --reporter=verbose"

 ✓ DrugClassesPanel (4 tests)
 ✓ SurvivalPanel (5 tests)
 ✓ ComorbidityMatrixPanel (8 tests)
 ✓ ProfilePanel (5 tests)
 ✓ useEndpointProfileKmData (5 tests)

 Test Files  5 passed (5)
      Tests  27 passed (27)
```

All Plan 18-01 RED stubs (the 4 component tests + the adapter test) flipped GREEN.

## Build Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✓ exits 0 |
| `vite build` | ✓ exits 0 (only chunk-size warnings, no errors) |
| `eslint` (new files) | ✓ exits 0 |
| Vitest (5 files, 27 tests) | ✓ all GREEN |
| Pre-commit hook (Task 1 + Task 2) | ✓ Pint / TypeScript / ESLint / Vitest / vite build all green; no `--no-verify` used |

## Task Commits

| Task | Hash | Title |
|---|---|---|
| 1 | `72f3c527b` | `feat(18-06): extend api.ts + add 3 hooks + heatmap-helpers (Task 1)` |
| 2 | `3975fc5ce` | `feat(18-06): add 5 Profile-tab components + wire drawer tab (Task 2)` |

## Deviations from Plan

None. All steps executed exactly as the plan specified, with two minor clarifications:

1. **Local KaplanMeierAdapterPoint type** — `KaplanMeierPlot.tsx`'s `KaplanMeierPoint` interface is not exported; the adapter mirrors it with a documented local type. Per D-13 reuse discipline (never edit the reused component), this is the correct path.
2. **TabBar refactor inside EndpointDetailBody** — the existing drawer body did not have a tab structure; the page rendered all sections sequentially. To make Profile a peer to Coverage / Generation history / GWAS runs (D-12), the existing sections were grouped into an "Overview" tab and Profile became its peer. URL state via `useSearchParams` syncs `?tab=profile&source=...`.

## Authentication Gates

None. The Profile tab consumes existing Sanctum-authenticated routes from Plan 18-04; the user's session is already established before the drawer opens.

## Threat Model Coverage (from 18-06-PLAN.md)

| Threat | Disposition | Mitigation in Plan 18-06 |
|---|---|---|
| T-18-01 (EoP, ProfilePanel compute dispatch) | mitigate (server-side) | Frontend relies on Plan 18-04 route middleware (`permission:finngen.endpoint_profile.compute`); UI also surfaces `error_code=permission_denied` banner copy verbatim |
| T-18-05 (DoS via access-log middleware) | mitigate (server-side) | Frontend sends normal GETs; Plan 18-04 middleware try-catches all DB writes per CLAUDE.md Gotcha #12 |

## Key Links

- D-06 single-drawer click-through: `ComorbidityMatrixPanel.onNavigate` → `ProfilePanel.handleNavigateToComorbid` → `navigate(?open=...&tab=profile&source=...)` → React Router re-renders the Profile tab with the clicked endpoint
- D-07 color lock: `heatmap-helpers.getPhiCellClass()` (negative phi → teal-400 / `#2DD4BF`)
- D-10 invalidation loop: `useEndpointProfile.refetchInterval` (3s while needs_compute) + `ProfilePanel.useEffect` (auto-dispatch when status===needs_compute)
- D-12 tab placement: `FinnGenEndpointBrowserPage.EndpointDetailBody.TabBar` (Overview + Profile)
- D-13 KM reuse: `useEndpointProfileKmData` adapter → `KaplanMeierPlot` (no edits to estimation component)
- D-14 drug timeline: `DrugClassesPanel` Recharts horizontal BarChart with %-LabelList
- D-15 source eligibility: `SurvivalPanel` renders disabled banner when `sourceHasDeathData=false`; comorbidity + drug panels still render

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or schema changes introduced — Plan 18-06 is pure frontend rendering against the established Plan 18-04 contract.

## Known Stubs

None. All components are wired to real data sources via the api.ts fetch fns. The Profile tab is fully data-driven; no placeholder/mock data flows to the UI.

## Next Phase Readiness

Plan 18-07 (final phase plan — verifier + DEV cutover) can now:
1. Run a Playwright smoke test against `/workbench/finngen-endpoints?endpoint=E4_DM2&tab=profile&source=PANCREAS` and verify the 3 sub-panels render with real data from PANCREAS.
2. Verify the auto-dispatch loop end-to-end: cold drawer-open → POST /profile → 15s wait → cached envelope → sub-panels render.
3. Verify click-through nav: open E4_DM2/Profile → click I9_HTN row → drawer URL updates → I9_HTN profile renders.
4. Confirm ROADMAP §Phase 18 SC 1-4 are satisfied.

## Self-Check: PASSED

- ✓ frontend/src/features/finngen-endpoint-browser/api.ts (modified, contains 8 new types + 2 fns)
- ✓ frontend/src/features/finngen-endpoint-browser/hooks/useEndpointProfile.ts
- ✓ frontend/src/features/finngen-endpoint-browser/hooks/useDispatchEndpointProfile.ts
- ✓ frontend/src/features/finngen-endpoint-browser/hooks/useEndpointProfileKmData.ts
- ✓ frontend/src/features/finngen-endpoint-browser/hooks/__tests__/useEndpointProfileKmData.test.ts
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/heatmap-helpers.ts
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/ProfilePanel.tsx
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/SurvivalPanel.tsx
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/ComorbidityMatrixPanel.tsx
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/DrugClassesPanel.tsx
- ✓ frontend/src/features/finngen-endpoint-browser/components/profile/ComputeProfileCta.tsx
- ✓ frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx (modified, TabBar wired, ProfilePanel imported)
- ✓ Commit 72f3c527b found in git log
- ✓ Commit 3975fc5ce found in git log
