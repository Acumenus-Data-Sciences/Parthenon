---
phase: 16-pheweb-ui
plan: 04
subsystem: frontend
tags: [frontend, genomics, canvas, tanstack-query, typescript, hook-extraction, d3]
requires:
  - phase: 16-02
    provides: GET /api/v1/finngen/runs/{id}/manhattan + /manhattan/region + /gencode/genes
  - phase: 16-03
    provides: GET /api/v1/finngen/runs/{id}/top-variants
provides:
  - useManhattanCanvas hook (reusable Canvas + d3 draw loop)
  - gwas-results API client (4 fetch fns + 8 exported interfaces)
  - 4 TanStack Query hooks (useManhattanData, useManhattanRegion, useTopVariants, useGencodeGenes)
  - FinnGenManhattanPanel wrapper (6 visible states + ErrorBoundary + thinning banner)
  - ManhattanPlot backward-compat refactor (preThinned prop, optional negLogP, role=img + aria-label)
affects: [16-05, 16-06, 16-07]
tech-stack:
  added: []
  patterns:
    - "Hook extraction from 364-LOC component for shared draw logic"
    - "202 Accepted polling via TanStack Query refetchInterval"
    - "Test-only hidden button for Canvas click-forwarding assertions"
key-files:
  created:
    - frontend/src/features/investigation/components/genomic/useManhattanCanvas.ts
    - frontend/src/features/finngen-endpoint-browser/api/gwas-results.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useManhattanData.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useManhattanRegion.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useTopVariants.ts
    - frontend/src/features/finngen-endpoint-browser/hooks/useGencodeGenes.ts
    - frontend/src/features/finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPanel.tsx
    - frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/FinnGenManhattanPanel.test.tsx
  modified:
    - frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx
key-decisions:
  - "Extract useManhattanCanvas hook (Q1 RESOLVED) rather than copy 364 LOC of Canvas+d3 logic; both catalog-upload and live GWAS-run consumers share the same draw loop"
  - "Add optional negLogP field to ManhattanPlotDataItem so Phase 16 live-run consumers skip redundant Math.log10 on 100k+ points"
  - "Expose isManhattanInFlight + isManhattanReady type guards from useManhattanData so consumers narrow the 202|200 union safely"
  - "Test-only hidden button for peak-click forwarding (jsdom can't compute Canvas click coordinates)"
  - "data-thinning-banner attribute on the thinning status span so Plan 16-07 Playwright can assert on it (W-4)"
patterns-established:
  - "Reusable Canvas+d3 hook pattern: hook owns draw effect + scale refs; component owns hit-test"
  - "TanStack Query hook naming: ['finngen', <feature>, runId, ...sort-params] keyspace"
  - "202-polling via refetchInterval callback that inspects query state data"
requirements-completed: [GENOMICS-04]
duration: 7min
completed: 2026-04-19
---

# Phase 16 Plan 04: Wave 4a Frontend Data Layer Summary

**Extracted `useManhattanCanvas` hook from 364-LOC `ManhattanPlot.tsx`, shipped 4 TanStack Query hooks + typed API client, and wrapped the live GWAS-run Manhattan plot (`FinnGenManhattanPanel`) with 6-state UX + thinning banner — no breaking change to existing catalog-upload consumer (`GenomicPanel`).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-19T04:18:10Z
- **Completed:** 2026-04-19T04:25:49Z
- **Tasks:** 3/3 (all autonomous; no checkpoints hit)
- **Files modified:** 1 (ManhattanPlot.tsx)
- **Files created:** 8

## Accomplishments

1. **Hook extraction + backward compat.** `useManhattanCanvas` hook extracted the Canvas + d3 draw loop (L114-311 of old ManhattanPlot.tsx) into a reusable surface. Catalog-upload consumer `GenomicPanel.tsx` continues to compile and render without modification — `ManhattanPlot`'s default export preserved, new `preThinned?: boolean` + `onPointClick?` props are optional.
2. **Typed data layer (zero `any`).** `api/gwas-results.ts` exports 8 interfaces (`ManhattanVariant`, `ManhattanPayload`, `ManhattanInFlightResponse`, `RegionVariant`, `ManhattanRegionPayload`, `TopVariantRow`, `TopVariantsPayload`, `Gene`, `GencodePayload`) and 4 fetch functions. `fetchManhattan` uses `validateStatus: s => s===200 || s===202` so the 202 in-flight envelope flows into TanStack Query's `data`.
3. **4 TanStack Query hooks, each with distinct cache semantics:** 24h stale for Manhattan (matches server Redis TTL D-20); 15min for region + top-variants; 7d for GENCODE (static data). `useManhattanData` polls every 30s only while the run is in-flight (detected via `isManhattanInFlight` guard); non-retry on 403/404/409/410/422.
4. **FinnGenManhattanPanel renders all 6 states** (loading / 202 in-flight / success + thinning banner / 410 failed / 404 not-found / generic error). ErrorBoundary wraps the Canvas render so a draw crash falls back to a readable message. Vitest: 9/9 pass (6 state behaviors + 3 type-guard sanity).

## Task Commits

Each task was committed atomically on `worktree-agent-a8cf0a0a` (off base `9abdee869`):

1. **Task 1: Extract useManhattanCanvas hook** — `34655861f` (refactor)
2. **Task 2: API client + 4 TanStack Query hooks** — `3bfab3b35` (feat)
3. **Task 3: FinnGenManhattanPanel + Vitest** — `995b298fc` (feat)

All commits passed `tsc --noEmit` + `npx vite build` before being recorded.

## Files Created/Modified

### Created

- `frontend/src/features/investigation/components/genomic/useManhattanCanvas.ts` (334 lines) — Canvas + d3 draw hook. Exports `PreparedPoint`, `ChromosomeBoundary`, `ManhattanCanvasOptions`, `ManhattanHitTestRefs`, `MANHATTAN_MARGIN`, `useManhattanCanvas`.
- `frontend/src/features/finngen-endpoint-browser/api/gwas-results.ts` (185 lines) — typed fetch wrappers for Manhattan / Region / TopVariants / Gencode endpoints.
- `frontend/src/features/finngen-endpoint-browser/hooks/useManhattanData.ts` (63 lines) — 24h cache, 30s polling on 202, non-retry on terminal errors. Exports `isManhattanInFlight`, `isManhattanReady` type guards.
- `frontend/src/features/finngen-endpoint-browser/hooks/useManhattanRegion.ts` (56 lines) — enabled only when all of runId/chrom/start/end set.
- `frontend/src/features/finngen-endpoint-browser/hooks/useTopVariants.ts` (58 lines) — sort+dir+limit in queryKey for per-column caching.
- `frontend/src/features/finngen-endpoint-browser/hooks/useGencodeGenes.ts` (55 lines) — 7d staleTime matches static Redis TTL.
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPanel.tsx` (193 lines) — 6-state panel; thinning banner carries `data-thinning-banner` attr for Plan 07 Playwright.
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/FinnGenManhattanPanel.test.tsx` (237 lines) — 9 Vitest cases.

### Modified

- `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (364 → 244 lines) — delegates draw loop to hook; adds `preThinned`, optional `negLogP`, `onPointClick`, role=img + dynamic aria-label. Default export preserved for `GenomicPanel.tsx` backward compat.

## API Contracts (for downstream plans)

### `useManhattanCanvas` — reusable Canvas+d3 hook

```ts
import { useManhattanCanvas } from "@/features/investigation/components/genomic/useManhattanCanvas";

useManhattanCanvas(
  {
    canvasRef,          // RefObject<HTMLCanvasElement | null>
    points,             // PreparedPoint[] — computed by caller via prepareData()
    chrBoundaries,      // Map<number, {start, end, mid}>
    width, height,      // CSS px
    preThinned: true,   // skip 500k filter (RESEARCH Pitfall 4)
    themeKey: theme,    // "dark" | "light" — forces redraw on theme change
  },
  { pointsRef, xScaleRef, yScaleRef },  // hit-test refs for click handler
);
```

Plan 16-05 can reuse this hook for the RegionalView canvas if desired — same draw signature, just passes a shorter `points` array with chrom-scoped boundaries.

### `api/gwas-results.ts` — typed fetch wrappers

```ts
import {
  fetchManhattan,           // runId, binCount → ManhattanResponse (ManhattanPayload | ManhattanInFlightResponse)
  fetchManhattanRegion,     // runId, chrom, start, end → ManhattanRegionPayload
  fetchTopVariants,         // runId, sort, dir, limit → TopVariantsPayload
  fetchGencodeGenes,        // chrom, start, end, includePseudogenes? → GencodePayload
  type ManhattanPayload,
  type RegionVariant,
  type TopVariantRow,
  type Gene,
} from "@/features/finngen-endpoint-browser/api/gwas-results";
```

### TanStack Query hooks

```ts
import { useManhattanData, isManhattanInFlight } from "@/features/finngen-endpoint-browser/hooks/useManhattanData";
import { useManhattanRegion } from "@/features/finngen-endpoint-browser/hooks/useManhattanRegion";
import { useTopVariants } from "@/features/finngen-endpoint-browser/hooks/useTopVariants";
import { useGencodeGenes } from "@/features/finngen-endpoint-browser/hooks/useGencodeGenes";

// Example: Plan 05 TopVariantsTable
const { data } = useTopVariants({ runId, sort: "p_value", dir: "asc", limit: 50 });

// Example: Plan 05 RegionalView on peak click
const { data: region } = useManhattanRegion({ runId, chrom, start, end });
const { data: genes } = useGencodeGenes({ chrom, start, end });
```

### Query keyspace (for Plan 05 invalidation)

- `["finngen", "manhattan", runId, binCount]`
- `["finngen", "manhattan", "region", runId, chrom, start, end]`
- `["finngen", "top-variants", runId, sort, dir, limit]`
- `["gencode", "genes", chrom, start, end, includePseudogenes]`

### `FinnGenManhattanPanel` — composed usage for Plan 05 `FinnGenGwasResultsPage`

```tsx
import { FinnGenManhattanPanel } from "@/features/finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPanel";

<FinnGenManhattanPanel
  runId={gwasRunId}
  onPeakClick={(chrom, pos) => openRegionalView(chrom, pos - 500_000, pos + 500_000)}
  width={1200}
  height={400}
/>
```

The panel owns: loading / 202 in-flight / 404 / 410 / 409 / error / success. Plan 05's page wraps it in layout + the regional view + the top-variants table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Collision with Plan 16-05 scaffold for FinnGenManhattanPanel.tsx**
- **Found during:** Task 3
- **Issue:** Plan 16-05 had written a minimal scaffold `FinnGenManhattanPanel.tsx` to make its own `FinnGenGwasResultsPage` composition compile in parallel. That scaffold's component body was incompatible with the richer implementation specified by Plan 16-04.
- **Fix:** Overwrote the scaffold with the plan-specified implementation. The scaffold itself documented at its top that "Plan 16-04 owns this component" and that "the merger should prefer Plan 04's richer implementation" — no cross-plan coordination conflict.
- **Files modified:** `frontend/src/features/finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPanel.tsx`
- **Commit:** `995b298fc`

### Not Fixed (Out of Scope)

**TopVariantsTable.test.tsx has 1 failing case** ("toggles sort direction when a header is clicked"). This is in Plan 16-05's territory (their test, their component) — per the scope boundary rule in the executor runbook, out-of-scope discoveries are NOT auto-fixed. Plan 16-05 owns resolution.

## Auth / Security Gates

None. Frontend-only plan; no new routes, no auth changes, no models, no migrations. All 4 endpoints consumed by the new hooks are already authenticated+RBAC-gated behind `auth:sanctum + permission:*` middleware shipped by Plans 16-02 and 16-03.

## Known Stubs

None. All 6 UX states render real, non-placeholder content driven by live TanStack Query state.

## Threat Flags

None. The threat register from the plan lists T-16-S10/S11/S2/S15 as "mitigate" or "accept" — all mitigations in place:

- **T-16-S10 (Canvas tainting):** No foreign `<img crossOrigin>` usage; Canvas draws numeric coordinates only from same-origin API JSON.
- **T-16-S11 (XSS via variant fields):** The thinning banner template-literalizes numeric fields via `.toLocaleString()` / `.toExponential()`; no `dangerouslySetInnerHTML`. ManhattanPlot canvas draws numeric points only.
- **T-16-S2 (queryKey cache poisoning):** `runId` is an axios path param already validated server-side by Run::findOrFail; the cache is per-browser.
- **T-16-S15 (polling runaway):** `refetchInterval` returns `false` for non-in-flight data AND the retry guard short-circuits on 404/403/422/410/409.

## Verification Log

- `tsc --noEmit`: PASS (after each task)
- `npx vite build`: PASS (after each task)
- `vitest run FinnGenManhattanPanel.test.tsx`: 9/9 PASS
- `grep ": any"` on all new files: 0 hits
- Backward compat: `GenomicPanel.tsx` (the existing catalog-upload consumer) continues to import `ManhattanPlot` as default export and passes the legacy `{chr, pos, p}[]` shape without modification; the negLogP path is opt-in.

## Self-Check: PASSED

- [x] `frontend/src/features/investigation/components/genomic/useManhattanCanvas.ts` exists
- [x] `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` contains `useManhattanCanvas` call, `preThinned` prop, `role="img"`
- [x] `frontend/src/features/finngen-endpoint-browser/api/gwas-results.ts` exports fetch + types
- [x] `frontend/src/features/finngen-endpoint-browser/hooks/useManhattanData.ts` exports `isManhattanInFlight`
- [x] All 3 other hooks created
- [x] `FinnGenManhattanPanel.tsx` + its Vitest file created
- [x] Commits `34655861f`, `3bfab3b35`, `995b298fc` exist in git log
- [x] 9/9 Vitest green
- [x] tsc + vite build clean
- [x] No `: any` in new files
