# FinnGen Workbench UI Polish — RunStatusBadge, CoverageBadge, StatTile, WorkbenchStepper

**Date:** 2026-04-23
**Milestone:** v1.0 — FinnGen Genomics
**Scope:** Four targeted UI improvements across the FinnGen Workbench, Analysis Gallery, and Endpoint Browser. Pure frontend — no backend changes.

## Summary

After a thorough UX/UI review of all three FinnGen surfaces (Workbench, Analyses, Endpoint Browser), four high-ROI cosmetic improvements were identified and implemented. The changes improve information density, visual hierarchy, and state legibility without altering any layout contracts or API shapes.

## What changed

### 1. RunStatusBadge — animated status dots (`RunStatusBadge.tsx`)

**Problem:** All run states (queued / running / canceling / succeeded / failed / canceled) rendered as static pills. Active jobs were visually indistinguishable from terminal states at a glance.

**Change:**
- Added a 6×6px indicator dot before the status text on every badge variant.
- `running`: dot uses `animate-ping` pulse (cyan, 1.5s ease-in-out) — draws attention to active computation without text changes.
- `queued`: dot uses a slower opacity blink (amber/slate, 2s) — distinct from running pulse, signals waiting-not-computing.
- `canceling`: amber static dot.
- `succeeded` / `failed` / `canceled`: static colored dots matching existing semantic colors.
- Shape remains `rounded-full` pill; all existing Tailwind color classes preserved; no type changes to `RunStatusBadgeStatus`.

This follows the Phase 15-06 decision: the foundation `FinnGenRunStatus` union is not widened; `RunStatusBadge` handles the local `superseded` extension independently.

### 2. CoverageProfileBadge — rectangular with left color stripe

**Problem:** `CoverageProfileBadge` (and inline endpoint-browser bucket pills) used `rounded-full` pill shape — visually identical to run status badges. Researchers had to read the text to distinguish coverage metrics from run states.

**Change:**
- Switched from `rounded-full` to `rounded` (rectangular) on both `finland_only` and `partial` variants.
- Added `border-l-[3px]` left-stripe in the badge's semantic color — the eye reads stripe hue before text.
- In `FinnGenEndpointBrowserPage`, the inline coverage-bucket pills received the same rectangular + left-stripe treatment using `currentColor` border-left, so the color follows `BUCKET_META.tone` automatically with no changes to the bucket map.
- Shape contrast rule: **pills = run status**, **rectangles = coverage/metrics**. Applied consistently.

### 3. SurvivalPanel StatTile — upgraded typography and surface

**Problem:** The four `StatTile` components in `SurvivalPanel` used a flat `bg-slate-950/60` surface and `text-xl` values that looked underdifferentiated against the surrounding panel background.

**Change (inline `StatTile` kept per UI-SPEC Flag §11 — not promoted to shared primitive):**
- Label: `text-[10px]` → `text-[9px]`, `text-slate-500` → `text-slate-400` (slightly better contrast ratio).
- Value: `text-xl` → `text-2xl` with `leading-none` — numbers read as instrument readouts, not prose.
- Tile surface: `bg-slate-950/60` → `bg-gradient-to-br from-slate-950/80 to-slate-900/40` — subtle depth without adding color noise.
- Border: added `transition-colors hover:border-slate-700` — low-key hover affordance.
- The primary clinical outcome tile (median survival) kept its `text-slate-100` value color unchanged; all other tiles also unchanged in color.

### 4. WorkbenchStepper — step-specific lucide icons

**Problem:** The 5-step `WorkbenchStepper` used a number badge for upcoming steps and a `<Check>` icon for completed steps. All pending steps looked identical — no semantic mapping between the step number and its action.

**Change:**
- Imported 5 step-specific lucide icons: `Upload`, `GitMerge`, `Magnet`, `Save`, `ArrowRight`.
- Added `STEP_ICONS` map: `{ 'import-cohorts': Upload, 'operate': GitMerge, 'match': Magnet, 'materialize': Save, 'handoff': ArrowRight }`.
- Current and upcoming steps: render the step-specific icon at 12px inside the existing `h-4 w-4` circle badge.
- Completed steps: unchanged — still render `<Check>` at 10px (done = universal checkmark).
- Color scheme, layout, and click handlers are fully preserved. Zero behavior changes.

`Magnet` confirmed present in the installed lucide-react version — no fallback needed.

## Files changed

| File | Change |
|------|--------|
| `frontend/src/features/_finngen-foundation/components/RunStatusBadge.tsx` | Animated dot indicators per state |
| `frontend/src/features/finngen-endpoint-browser/components/CoverageProfileBadge.tsx` | Rectangular + left-stripe shape |
| `frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx` | Inline bucket pills → rectangular left-stripe |
| `frontend/src/features/finngen-endpoint-browser/components/profile/SurvivalPanel.tsx` | StatTile typography + gradient surface |
| `frontend/src/features/finngen-workbench/components/WorkbenchStepper.tsx` | Step-specific icons per step key |

## Commits

- `6d00baf` — animated dot on RunStatusBadge + rectangular stripe on CoverageProfileBadge
- `5b46173` — rectangular endpoint coverage pill + upgraded StatTile typography
- `8967652` — step-specific lucide icons in WorkbenchStepper

All three commits passed TypeScript (`tsc --noEmit`), ESLint, Vitest `--changed`, and `vite build` via the pre-commit hook.

## Design principles applied

- **Shape as semantic signal:** Pills = run states; rectangles = coverage/data metrics. Consistent across the entire Endpoint Browser.
- **Motion for state:** Animate only what changes (active jobs); keep terminal states static. `animate-ping` on Running, slow opacity blink on Queued.
- **Typography hierarchy:** Instrument readout numbers (`text-2xl leading-none`) vs label captions (`text-[9px] uppercase tracking-wider`). Data should look like data.
- **Icon semantics:** Step icons map to actions (Upload → import, Magnet → matching) rather than abstract numbers.
