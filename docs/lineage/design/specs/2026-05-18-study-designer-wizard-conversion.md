---
doc_type: spec
status: active
date: 2026-05-18
supersedes: 2026-05-12-studies-design-workbench-redesign.md
---

# Study Designer Wizard Conversion (v2 → wizard-shell)

**Author:** Sanjay Udoshi
**Audience:** frontend engineers, study-designer maintainers
**Effective:** Phase 3 of the studies-v2 effort

## Why

The current `CompilerWorkbench` (v2 Pipeline Rail) is over-chromed and
inconsistent with the project's gold-standard wizard pattern that users have
already been trained on via the Cohort Wizard. Three concrete problems:

1. **Redundant identity strip.** `IdentityStrip.tsx` (135 LOC) repeats data
   already shown by `StudyDetailPage.tsx` one line above it: study title,
   status, PI, breadcrumb. The "Lock" button on this strip is decorative.
2. **Peripheral Rail is empty.** The right aside renders the literal string
   "coming in Phase 3" with 6 `aria-disabled` tabs (Evidence, Lint, Notes,
   Sites, Versions, Abby). It eats ~25% of horizontal real estate for zero
   present-day user value.
3. **Pipeline Rail visual noise.** Gold rivets, SVG progress arcs, scanlines,
   state-colored dots, mono "last-touched" labels, and a decorative spine
   — none of which a researcher needs to navigate 8 steps.

Net: ~700 LOC of chrome that produces no user task output, plus 4 Critical +
10 High issues in `.planning/audit/studies-v2-redesign-review.md` that live
almost entirely in this chrome (rail/strip race conditions, asset-type
mismatches in `CompilerWorkbench`'s state-spread).

The Cohort Wizard (`features/cohort-definitions/components/wizard/CohortWizardModal.tsx`)
ships a horizontal numbered stepper, slide animations, a Back/Next footer
gated by `canProceed()`, and a Zustand store with ~150 LOC of state. It
works. Reuse it.

## Decisions (confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Step count | **8 steps** — keep v2's stage breakdown intact |
| 2 | Shell | **Inline** — the Design tab itself becomes the wizard; no modal |
| 3 | Navigation | **Hybrid** — free-nav across visited steps; Next button gates on current-step validity |

## The 8 steps (unchanged from v2 today)

| # | Label        | Component (existing, reused as-is) |
|---|--------------|------------------------------------|
| 1 | Intent       | `v2/stages/PicoCanvas.tsx` |
| 2 | Phenotypes   | `v2/stages/PhenotypeMatrix.tsx` |
| 3 | Concept Sets | `v2/stages/ConceptSetMatrix.tsx` |
| 4 | Cohorts      | `v2/stages/CohortTriptych.tsx` |
| 5 | Feasibility  | `v2/stages/FeasibilityView.tsx` |
| 6 | Analyses     | `v2/stages/AnalysisMatrix.tsx` |
| 7 | Lock         | `v2/stages/LockLaunchpad.tsx` |
| 8 | Package      | `v2/stages/PackageReceipt.tsx` |

These components are not changing. Only the orchestrator and chrome around
them change.

## Gold-standard match — the StepIndicator

Source of truth: `frontend/src/features/cohort-definitions/components/wizard/CohortWizardModal.tsx:32-77`.

Visual contract (reused verbatim, just with 8 nodes instead of 6):

```
┌──────────────────────────────────────────────────────────────────────┐
│  ①────②────③────④────⑤────⑥────⑦────⑧                              │
│ Intent Phen ConSet Cohort Feas Analy Lock Pkg                        │
└──────────────────────────────────────────────────────────────────────┘
```

State treatment (Tailwind tokens, matching CohortWizard exactly):

| State | Circle | Label |
|-------|--------|-------|
| Completed | `bg-accent text-surface-base` with `<Check size={14} strokeWidth={3} />` | `text-accent` |
| Active | `border-2 border-accent bg-accent/10 text-accent` | `text-text-primary` |
| Pending | `border-2 border-surface-highlight text-text-ghost bg-transparent`, displays step number | `text-text-ghost` |
| **Partial** *(new — v2 affordance preserved)* | `border-2 border-warning bg-warning/10 text-warning` with `<AlertTriangle size={12} />` | `text-warning` |

Connectors: `h-[2px]` rounded, `bg-accent` between two completed/active
steps, `bg-surface-highlight` between two pending steps. The "partial" state
uses `bg-warning/40` connector on the *incoming* edge to make warnings
visible at the indicator level.

Layout: `flex items-center justify-between pl-8 pr-14 pt-6 pb-2` — same
container classes as `CohortWizardModal.tsx:36`. Steps `flex items-center
flex-1 last:flex-none`.

## Inline shell layout

```
┌─ StudyDetailPage tab header (study title, tabs row, PI, status) ─┐
│                                                                  │
├─ StudyDesignerStepper (horizontal, 8 nodes, gold-standard look) ─┤
│                                                                  │
├─ Slide container (animKey-keyed, 220 ms slide-in)                │
│                                                                  │
│   <active step component, full width>                            │
│                                                                  │
├─ Footer toolbar:                                                 │
│   [↑Upload protocol]  [version chip v1.2 · 4h ago▾]              │
│                                          [Back ←]    [Next →]    │
└──────────────────────────────────────────────────────────────────┘
```

No `IdentityStrip`. No `PipelineRail`. No `Peripheral Rail`. No
`VersionTimeline` strip in the body. No `narrow-banner`. No `wb-compat-bridge`
wrapper — the `BottomUpCompatibilityPanel` (Intent step) renders inline
below `PicoCanvas` as plain markup, no eyebrow chrome.

## Hybrid navigation contract

Free-nav rules (matching v2's permissiveness for already-touched steps):

- A step is **reachable** if `compilerGuidance.stages[i].status` is one of
  `complete | active | blocked`. (Blocked steps are reachable so users can
  see what's wrong.)
- A step is **unreachable** if status is `not-started` AND it's more than 1
  ahead of the furthest-advanced step.
- Click on a reachable step number → jump there immediately.
- Click on an unreachable step → no-op, `cursor-not-allowed`,
  `aria-disabled="true"`.

Linear Next gate (matching Cohort Wizard's `canProceed()`):

- The **Next** button is enabled when the *current* step's compiler-guidance
  status is `complete` OR (`active` AND the step's local form is valid per
  its own `onDirtyChange`/save handlers).
- The **Back** button is always enabled except on step 1.
- Pressing Next on a completed final step (Package) is a no-op (button
  hidden, same as CohortWizard's `isLastStep` branch).

Keyboard:
- `←` / `→` on the stepper navigate between reachable steps.
- `Enter` / `Space` on a step circle activates it.
- Same `tabIndex` / focus model as `PipelineRail.tsx:96-109` (already
  accessible — preserve the keyboard handler logic).

## State management

New: `frontend/src/features/studies/stores/studyDesignerWizardStore.ts`
(mirror of `cohortWizardStore.ts`, ~120 LOC).

```ts
interface StudyDesignerWizardStore {
  currentStep: 0..7;
  slideDir: "forward" | "back";
  visited: Set<0..7>;          // remembers which steps user has touched
  setStep: (step: number) => void;  // free-nav, adds to visited
  goNext: () => void;          // linear, gated by canProceed()
  goBack: () => void;
  canProceed: () => boolean;   // reads compiler-guidance for current step
  isReachable: (step: number) => boolean;
}
```

The store does NOT own study/version/asset data — that stays in
`useStudyDesignWorkbench(study)` exactly as today. The wizard store is
strictly navigation + slide animation, mirroring `cohortWizardStore.ts:154-188`.

`canProceed()` implementation (replaces the v2 verification dance):

```ts
canProceed: () => {
  const stage = compilerGuidance?.stages.find(s => s.id === STEP_TO_SOURCE[currentStep]);
  if (!stage) return false;
  if (stage.status === "complete") return true;
  if (stage.status === "active") return !isDirty;  // user has saved
  return false;  // blocked or not-started
}
```

Where `STEP_TO_SOURCE` is the inverse of `CompilerWorkbench.tsx:78-86`'s
`SOURCE_TO_STATION` map (steps 1-7 map to guidance stage ids;
step 8 / Package always reachable from step 7).

## Files

**New:**

| Path | LOC est. | Purpose |
|---|---|---|
| `frontend/src/features/studies/stores/studyDesignerWizardStore.ts` | ~120 | Navigation + slide-direction Zustand store |
| `frontend/src/features/studies/components/v2/StudyDesignerWizard.tsx` | ~200 | Inline wizard shell — stepper + slide container + footer |
| `frontend/src/features/studies/components/v2/StudyDesignerStepper.tsx` | ~90 | 8-node horizontal stepper, gold-standard styling |
| `frontend/src/features/studies/components/v2/WizardFooter.tsx` | ~80 | Back / Next + protocol upload + version chip |

**Deleted:**

| Path | LOC | Reason |
|---|---|---|
| `frontend/src/features/studies/components/v2/IdentityStrip.tsx` | 135 | Redundant with StudyDetailPage header |
| `frontend/src/features/studies/components/v2/PipelineRail.tsx` | 155 | Replaced by StudyDesignerStepper |
| `frontend/src/features/studies/components/v2/peripheral/VersionTimeline.tsx` | (TBD) | Replaced by WizardFooter version chip |

**Modified:**

| Path | Change |
|---|---|
| `CompilerWorkbench.tsx` | Shrinks to ~80 LOC — wraps `<StudyDesignerWizard study={...} />`, removes rail/strip/peripheral chrome, removes the `studies-v2-narrow-banner`. Kept for now to preserve the `v2Enabled` flag in `StudyDetailPage.tsx:434-438`; can be inlined in a follow-up. |
| CSS: `studies-v2-*` classes | Most can be deleted (rail, strip, peripheral, spine, station-arc, lock-rivet). New classes for stepper match `cohortDefinitions.auto.*` utility patterns. |

Net change estimate: **+490 LOC new shell, −450 LOC deleted chrome ≈ +40 LOC** (and ~700 LOC of unused `studies-v2-*` CSS can be deleted in the same PR).

## What we lose, and why it's fine

| v2 feature dropped | Why it's fine |
|---|---|
| Gold-rivet decorative ring on Lock step | The stepper conveys "Lock is step 7" with a number. The rivet was decoration, not signal. |
| State-colored dots + SVG progress arcs | The Cohort Wizard's check/circle/border pattern conveys the same three-state model with less visual mass. |
| `studies-v2-narrow-banner` ("best viewed on desktop") | Inline wizard is responsive — the horizontal stepper wraps on `<768px` like the Cohort Wizard's. |
| Peripheral Rail's 6 inert tabs | When Evidence / Lint / Abby become real (post-Phase 3), they re-emerge as **in-step inline widgets** on the steps where they're relevant, not as a global rail. Abby specifically is a project-wide concern and should be a floating panel invoked from anywhere, not nailed to the Design tab. |
| `IdentityStrip` Lock button | Decorative — the real Lock action lives on step 7. |
| `IdentityStrip` session chip dropdown | Was decorative anyway (no menu wired). When session-switching is needed, it goes in the `WizardFooter` next to the version chip. |
| `wb-compat-bridge` eyebrow framing on Intent step | `BottomUpCompatibilityPanel` already uses theme tokens; the eyebrow was lipstick. |

## What we keep (the v2 advancements)

| v2 advancement | How it survives |
|---|---|
| Compiler-guidance drives step state | Same — wizard store reads `compilerGuidance.stages[i].status` |
| Per-asset verification (verified / partial / blocked) with `acknowledge_warnings` | Renders inline on the relevant step; partial state surfaces as the **warning-colored circle** in the stepper |
| Free navigation across already-visited steps | Hybrid nav contract above |
| 8 distinct steps with their own components | Components reused unchanged |
| Protocol upload starts a session | Moves to WizardFooter's upload icon, still routes to `useStudyDesignWorkbench.handleProtocolUpload` |
| Version timeline (switch between v1.0, v1.1, ...) | Moves to WizardFooter as a click-to-open chip — versions are infrequent enough |
| `BottomUpCompatibilityPanel` on Intent step | Renders inline under `PicoCanvas`, no eyebrow chrome |

## Phase 3 PR plan (three commits)

1. **`feat(studies/v2): wizard shell + stepper`**
   - Add `studyDesignerWizardStore.ts`, `StudyDesignerWizard.tsx`,
     `StudyDesignerStepper.tsx`, `WizardFooter.tsx`.
   - No behavior change yet — the new shell isn't wired in.
   - Vitest: store nav, `canProceed` matrix, `isReachable` rules.

2. **`refactor(studies/v2): replace rail/strip with wizard shell`**
   - Rewire `CompilerWorkbench.tsx` to mount `<StudyDesignerWizard>`.
   - Delete `IdentityStrip.tsx`, `PipelineRail.tsx`,
     `peripheral/VersionTimeline.tsx`, `studies-v2-narrow-banner`,
     `wb-compat-bridge` wrapper.
   - Delete dead `studies-v2-*` CSS.
   - Vitest: snapshot test for 8-step rendering against gold-standard
     stepper structure (mirrors `CohortWizardModal`'s `StepIndicator`
     snapshot if one exists).
   - Playwright: existing v2 E2E flows continue to pass — the step
     components didn't change.

3. **`feat(studies/v2): protocol upload + version chip in footer`**
   - Wire the `WizardFooter` upload icon to the v1
     `handleProtocolUpload` (closing the `// TODO: Phase 3` in
     `CompilerWorkbench.tsx:42`).
   - Convert the click-to-open version chip into a real popover.

After commit 3, every "coming in Phase 3" string and Phase 3 TODO is closed.

## Verification

- Visual diff (chromatic / manual): stepper matches `CohortWizardModal`
  `StepIndicator` pixel-for-pixel on a 6-step sample (`<StoryBookExample />`).
- Keyboard: tab order = stepper → step content → footer. Arrow keys
  navigate the stepper. Enter activates a step.
- A11y: every step button has `aria-label="Step N — {name}, {state}"` and
  `aria-current="step"` on the active one. Footer Next has
  `aria-disabled` when `!canProceed()`.
- `npx tsc --noEmit` and `npx vite build` both green.
- `vendor/bin/pint` clean (no PHP touched, just sanity).
- All existing `useStudyDesignWorkbench` Vitest tests pass unchanged —
  the hook contract doesn't change.

## Out of scope (deferred or dropped)

- **Peripheral Rail revival.** Evidence/Lint/Notes/Sites/Versions/Abby do
  not return as a global rail. If they become real features later, they
  belong inline on the step where they apply (Lint on Lock, Evidence on
  Cohorts) or as a floating side-panel (Abby).
- **Session switcher menu** beyond the version chip. If users need a
  multi-session dropdown (study has parallel "what-if" sessions), that
  becomes a separate UX exercise — out of scope for this conversion.
- **Migrating v2 audit issues that live in step components themselves**
  (asset type mismatches in `PicoCanvas`/`PhenotypeMatrix` per the
  2026-05-13 review). Tracked separately; this spec only deletes the
  chrome issues. Issues C-01, C-02, C-04 (rail navigation, state spread)
  are resolved by deletion. Issue C-03 (lock/timer race) is fixed by
  moving session protocol upload into the footer where it doesn't
  contend with the rail's stage-change effects.

## Open follow-ups

- After Phase 3 lands and ~1 week of internal use, decide whether to
  collapse steps 4+5 (Cohorts + Feasibility) or 7+8 (Lock + Package).
  My recommendation today is 8, per your decision; revisit after seeing
  it in flight.
- Decide whether `CompilerWorkbench.tsx` survives as a thin wrapper or
  gets inlined into `StudyDetailPage.tsx`. Cosmetic.
