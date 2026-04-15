# Patient Similarity QA Punch List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is for a focused UX/product-quality pass, not a rewrite.

**Goal:** Ship a concise, high-impact quality pass on `/patient-similarity` so first-time and returning users can immediately understand the setup flow, method choice, primary action, analytical cautions, and top-line results without turning the feature into a gated wizard.

**Architecture / Approach:** Keep `PatientSimilarityWorkspace` as the orchestration layer and preserve the existing pipeline model. Concentrate changes in the page header/setup area (`PatientSimilarityWorkspace`, `CohortSelectorBar`, `SimilarityModeToggle`) plus small readability improvements in the first result panels (`ProfileComparisonPanel`, `CovariateBalancePanel`). Add cohort-size imbalance heuristics close to existing cohort-profile/member-count data instead of introducing backend changes. Address the blocking “What’s New” modal at layout/help infrastructure level with a narrow route-aware suppression or defer behavior rather than changing patient-similarity feature logic to fight a global modal.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Zustand, Tailwind 4, lucide-react, Vitest + Testing Library.

**Primary UX outcome:** The page should read as “Comparison setup → run analysis → inspect pipeline results,” with explicit action names, visible method guidance, and hard-to-miss caution states for analytically weak cohort pairings.

---

## Implementation Principles

- Preserve the current compare/expand pipeline and step ordering.
- Do not convert the page into a mandatory wizard.
- Prefer inline explanation over modals and tooltips-only guidance.
- Reuse existing data already available via `useCohortProfile`, comparison results, and layout/help infrastructure.
- Favor small copy, contrast, and hierarchy changes over major structural churn.
- Keep warning logic deterministic and testable.

---

## Recommended Product Decisions

### 1. Comparison setup hierarchy

Convert the current top row into a compact setup card/section with:
- section title: `Comparison setup`
- short helper copy: `Choose a data source, analysis mode, and cohorts before running the pipeline.`
- clearly labeled control groups rather than toolbar-like unlabeled controls
- one obvious primary CTA aligned with the selected workflow mode

### 2. Primary CTA copy

Use explicit action labels:
- compare mode: `Compare cohorts`
- expand mode: `Find similar patients`

Optional helper text near the CTA or setup footer:
- compare mode: `Runs profile comparison and covariate balance first.`
- expand mode: `Builds a cohort profile, then searches for similar patients.`

### 3. Similarity method copy

Keep the existing toggle but add always-visible explainer text. Recommended copy:
- `Auto` — `Recommended. Uses the best available similarity method for this source.`
- `Interpretable` — `Feature-based comparison with clearer explanation of what drives similarity.`
- `Embedding` — `Representation-based comparison for more flexible similarity search.`

If `recommendedMode` is available, show a compact sentence such as:
- `Auto will use Embedding for this source.`
- `Auto will use Interpretable for this source.`

### 4. Cohort-size imbalance thresholds

Use two visible caution levels derived from selected cohort profile counts:

Warning thresholds:
- show warning when smaller cohort has fewer than 100 members, or size ratio is >= 10:1
- show severe warning when smaller cohort has fewer than 50 members, or size ratio is >= 25:1

Recommended computed values:
- `targetCount`
- `comparatorCount`
- `smallerCount = Math.min(targetCount, comparatorCount)`
- `largerCount = Math.max(targetCount, comparatorCount)`
- `sizeRatio = largerCount / Math.max(smallerCount, 1)`

Recommended compare-mode copy:
- warning: `One cohort is much smaller than the other. Similarity and matching results may be unstable.`
- severe warning: `Comparator setup is highly imbalanced. Treat divergence, balance, and matching outputs as directional only until cohort sizes are better aligned.`

Recommended detail line:
- `Target: 17,472 patients · Comparator: 59 patients · 296x size difference`

Behavior notes:
- only show in compare mode
- only show once both cohort profiles resolve with usable member counts
- do not block the run action; warn prominently instead
- keep warning near the setup controls and above the CTA/helper area

### 5. Result readability improvements

Preferred low-risk upgrades:
- strengthen summary-card contrast and label hierarchy in `ProfileComparisonPanel`
- add a short interpretation sentence directly under the overall divergence value
- surface cohort counts near top-line comparison summary if not already visible elsewhere
- make balance summaries in `CovariateBalancePanel` more scannable with plain-language thresholds
- ensure critical metrics use tabular numerals and accessible contrast

### 6. Blocking “What’s New” modal handling

Recommended product behavior:
- do not auto-open the modal when landing directly on `/patient-similarity`
- preserve manual access to release notes elsewhere
- keep existing global behavior for most routes unless product wants broader suppression

Implementation options, in priority order:
1. Add route-aware suppression in `MainLayout` or `WhatsNewModal` for `/patient-similarity`
2. Add a non-blocking defer rule so the modal does not auto-open on first render for analysis-heavy routes
3. Only if infrastructure forces it, add a prop such as `disableAutoOpen` or `autoOpenStrategy`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `frontend/src/components/layout/MainLayout.tsx` | Add route-aware suppression/defer wiring for the auto-open “What’s New” modal if implemented at layout level |
| Modify | `frontend/src/features/help/components/WhatsNewModal.tsx` | Support route-aware auto-open suppression or explicit opt-out without breaking manual open flows |
| Modify | `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx` | Reorganize page header/setup composition, pass setup helper/warning props, keep pipeline orchestration intact |
| Modify | `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx` | Convert ambiguous toolbar into setup section/card, rename CTA, render cohort imbalance warning, improve labels/helper text |
| Modify | `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx` | Add always-visible method explanation, stronger selected state, optional recommended-mode copy |
| Modify | `frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx` | Improve top-line readability and interpretation copy with minimal structural change |
| Modify | `frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx` | Improve summary readability, plain-language balance guidance, preserve actions |
| Maybe modify | `frontend/src/features/patient-similarity/components/GenerationStatusBanner.tsx` | Only if setup-card layout needs a smaller or denser inline status presentation |
| Modify | `frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx` | Cover CTA copy, setup clarity affordances, imbalance warning states |
| Modify | `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx` | Cover page-level composition, method explainer presence, CTA copy, modal suppression behavior if testable here |
| Maybe add/modify | `frontend/src/features/patient-similarity/components/__tests__/SimilarityModeToggle.test.tsx` | Add focused tests for mode explainer copy and recommended-mode messaging if component logic grows |
| Maybe add/modify | `frontend/src/components/layout/__tests__/*` or help tests | Add route-aware “What’s New” auto-open coverage if that logic lives outside patient-similarity tests |

---

## Current-State Notes From Code Inspection

- `/patient-similarity` already renders `PatientSimilarityWorkspace`.
- `PatientSimilarityWorkspace` owns source/cohort state, pipeline orchestration, step execution, and currently renders `SimilarityModeToggle` in the page header, separate from the setup bar.
- `CohortSelectorBar` already fetches target/comparator cohort profiles via `useCohortProfile`, which makes it a natural place to compute size imbalance warnings without new backend calls.
- The main compare CTA still renders `Compare`; expand renders `Find Similar`.
- `SimilarityModeToggle` currently only renders pill buttons plus optional tiny recommended-mode text; it does not explain the modes sufficiently.
- `ProfileComparisonPanel` already contains an interpretation sentence, but the top summary still has room for stronger hierarchy and cohort-context labeling.
- `CovariateBalancePanel` already computes balanced/imbalanced counts and PSM recommendation logic, but it reads more like a technical panel than a quick-scanning analytical summary.
- `WhatsNewModal` auto-opens globally from `MainLayout` based on `localStorage` version state and currently has no route-aware suppression.

---

## Implementation Order

1. Add route-aware strategy for the “What’s New” modal so patient-similarity entry is not blocked.
2. Rework the patient-similarity header/setup composition.
3. Upgrade `CohortSelectorBar` to a labeled setup card with explicit CTA copy.
4. Add imbalance heuristic + warning UI.
5. Improve `SimilarityModeToggle` with always-visible explainer text.
6. Make targeted readability improvements to top result panels.
7. Update/add tests.
8. Run targeted tests and TypeScript verification.

---

## Task 1: Make Entry Non-Blocking by Deferring or Suppressing “What’s New” Auto-Open

**Files:**
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/features/help/components/WhatsNewModal.tsx`
- tests near layout/help if present

- [ ] Audit where route information is easiest to access (`MainLayout` via `useLocation` vs modal prop-driven strategy).
- [ ] Implement the smallest route-aware mechanism that prevents automatic open on `/patient-similarity` while preserving manual open capability.
- [ ] Keep the modal available from existing manual entry points.
- [ ] Add tests for the selected strategy if the repo has layout/help test coverage nearby; otherwise document manual verification precisely.

Recommended implementation shape:
- `MainLayout` gets `location.pathname`
- derive `disableWhatsNewAutoOpen = location.pathname.startsWith('/patient-similarity')`
- pass prop to `WhatsNewModal`, e.g. `disableAutoOpen={disableWhatsNewAutoOpen}`
- `WhatsNewModal` continues honoring `externalOpen`, but skips the localStorage-triggered auto-open effect when `disableAutoOpen` is true

Acceptance notes:
- direct navigation to `/patient-similarity` should not be blocked by the modal
- opening “What’s New” manually elsewhere should still work

---

## Task 2: Recompose the Page Header Around a Single Setup Story

**Files:**
- `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`
- `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`

- [ ] Move from “page title + detached mode toggle + toolbar” toward “page title + setup section” while keeping the overall page structure compact.
- [ ] Decide whether the similarity-method explainer belongs inside the setup card or immediately beneath the title. Preferred: inside the setup area so all run prerequisites live together.
- [ ] Ensure compare/expand mode still resets comparator state exactly as today.
- [ ] Keep `AnalysisPipeline` and downstream execution behavior untouched unless a prop shape changes.

Recommended layout:
- page title + subtitle + Help button on top
- beneath header, one setup card containing:
  - setup title and one-line helper copy
  - source selector
  - workflow mode toggle (compare vs expand)
  - target/selectors
  - similarity method selector + explainer
  - imbalance warning area in compare mode
  - primary CTA + settings affordance

Do not:
- split setup into multiple disconnected panels
- hide method choice inside settings
- add step gating that blocks expert users

---

## Task 3: Upgrade `CohortSelectorBar` Into a Real Setup Card

**Files:**
- `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- maybe `GenerationStatusBanner.tsx`

- [ ] Add visible section labeling (`Comparison setup` or mode-aware equivalent like `Similarity search setup` if product prefers dynamic copy).
- [ ] Add per-control labels or compact helper captions so the user can parse source / mode / target / comparator quickly.
- [ ] Rename the primary CTA:
  - compare mode: `Compare cohorts`
  - expand mode: `Find similar patients`
- [ ] Ensure the settings affordance remains clearly secondary.
- [ ] Keep generation-status information visible but subordinate to the main selection workflow.
- [ ] Preserve accessibility labels and keyboard interaction.

Recommended control labels:
- `Data source`
- `Workflow`
- `Target cohort` or `Seed cohort`
- `Comparator cohort`
- `Similarity method`

Recommended helper copy under selectors when useful:
- compare mode: `Run profile comparison, covariate balance, and downstream matching analyses.`
- expand mode: `Use a seed cohort to search for patients with a similar clinical profile.`

---

## Task 4: Add Cohort-Size Imbalance Heuristic and Warning UI

**Files:**
- `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- maybe `PatientSimilarityWorkspace.tsx` only if shared helper extraction makes props cleaner
- related tests

- [ ] Compute imbalance only when both compare-mode cohorts have resolved member counts.
- [ ] Use profile `member_count` values already returned by `useCohortProfile`.
- [ ] Add a pure helper function for warning state derivation so tests do not depend on render details.
- [ ] Render a prominent inline warning block above or adjacent to the primary CTA, not hidden in tooltips.
- [ ] Keep the warning informative rather than blocking.

Recommended helper contract:
```ts
interface CohortImbalanceAssessment {
  targetCount: number;
  comparatorCount: number;
  smallerCount: number;
  largerCount: number;
  sizeRatio: number;
  severity: 'none' | 'warning' | 'severe';
  headline?: string;
  detail?: string;
}
```

Recommended rules:
- `none`: both cohorts >= 100 and ratio < 10
- `warning`: smaller < 100 or ratio >= 10
- `severe`: smaller < 50 or ratio >= 25

Recommended rendering:
- warning styling distinct from neutral status banners
- icon + bold headline + one short detail line
- counts formatted with locale separators

Manual QA cases to cover:
- 17,472 vs 59 => severe warning
- 1,000 vs 150 => no warning if ratio < 10 and both >= 100
- 800 vs 80 => warning because smaller < 100 and ratio 10
- 500 vs 30 => severe because smaller < 50

---

## Task 5: Make Method Selection Self-Explanatory

**Files:**
- `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`
- `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`
- optional focused tests

- [ ] Preserve the three current choices (`auto`, `interpretable`, `embedding`).
- [ ] Add always-visible explainer text for all modes, not just a tiny note for auto.
- [ ] Strengthen the selected-state styling so it reads as an analysis choice.
- [ ] If recommended mode is available from source capabilities, surface it in plain language.
- [ ] Ensure the component remains compact enough for the setup card.

Recommended UI pattern:
- segmented toggle or button row on top
- beneath it, a 1–2 sentence explanation for the selected mode
- optional small note: `Recommended default for most workflows.` when auto is selected

Test expectations:
- all three mode names visible
- explanation text updates when selection changes
- recommended-mode note appears only when supplied

---

## Task 6: Improve Result Readability Without Rewriting Panels

**Files:**
- `frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx`
- `frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx`

- [ ] Keep current charts and step actions.
- [ ] Improve top summary-card hierarchy, contrast, and interpretation copy.
- [ ] Surface cohort-count context near top-line comparison results if feasible from existing result data.
- [ ] Make covariate balance guidance easier to scan in one pass.

Recommended `ProfileComparisonPanel` upgrades:
- add a compact subtitle under `Overall divergence`, e.g. `Higher values indicate broader clinical differences between cohorts.`
- show target and comparator counts if available from `result.source_cohort.member_count` and `result.target_cohort.member_count`
- ensure divergence interpretation sentence is high enough contrast to read at a glance
- consider a small badge/tag such as `Low divergence`, `Moderate divergence`, `High divergence`

Recommended `CovariateBalancePanel` upgrades:
- convert summary row into more legible metric cards/badges using existing design tokens
- make the 0.1 SMD threshold explanation more visible
- keep `Run Propensity Score Matching` as a clear recommended next step only when imbalance exists
- preserve `Continue to Landscape` as a non-blocking path

Non-goals:
- no chart library changes
- no new backend metrics
- no broad redesign of downstream pipeline panels

---

## Task 7: Update Tests

**Files:**
- `frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx`
- `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx`
- optional: `frontend/src/features/patient-similarity/components/__tests__/SimilarityModeToggle.test.tsx`
- optional: layout/help tests for modal suppression

- [ ] Update old CTA assertions from `Compare` / `Find Similar` to new explicit labels.
- [ ] Add compare-mode imbalance warning coverage using mocked cohort profiles.
- [ ] Add severe-warning coverage for an extreme ratio example.
- [ ] Add method explainer coverage so `Auto / Interpretable / Embedding` are not just labels.
- [ ] Add page-level coverage that the setup area renders with expected helper text.
- [ ] If route-aware modal suppression is testable, add coverage where direct patient-similarity rendering does not auto-show the blocking modal.

Suggested test scenarios:
1. compare mode renders `Compare cohorts`
2. expand mode renders `Find similar patients`
3. compare mode with both cohorts selected and 17472 vs 59 shows severe warning copy
4. compare mode with near-balanced counts shows no imbalance warning
5. method explainer defaults to Auto guidance
6. clicking method options updates explainer text
7. workspace renders setup heading and mode-aware action labels

---

## Task 8: Verification and Regression Pass

- [ ] Verify compare mode still kicks off profile + balance pipeline stages.
- [ ] Verify expand mode still kicks off centroid + similar-patients pipeline stages.
- [ ] Verify no warning appears before both compare cohorts are selected and profile counts are loaded.
- [ ] Verify warning disappears or recalculates when cohorts/mode/source change.
- [ ] Verify settings drawer still opens from setup area.
- [ ] Verify “What’s New” no longer blocks entry to `/patient-similarity`.
- [ ] Verify manual release-notes access still works where expected.

---

## Acceptance Criteria

The implementation is complete only when all of the following are true:

- [ ] Entering `/patient-similarity` no longer starts with a blocking “What’s New in Parthenon” modal.
- [ ] The page presents a clearly identifiable setup area rather than an ambiguous toolbar row.
- [ ] The compare-mode primary CTA reads `Compare cohorts`.
- [ ] The expand-mode primary CTA reads `Find similar patients` or approved equivalent.
- [ ] The method selector explains `Auto`, `Interpretable`, and `Embedding` with always-visible guidance.
- [ ] Compare mode shows an obvious imbalance warning for materially bad cohort-size pairings.
- [ ] The extreme example of 17,472 vs 59 would trigger the strongest warning state.
- [ ] Result summaries are easier to interpret quickly, with improved contrast and/or interpretation copy.
- [ ] Existing compare and expand workflows still function without forced wizard gating.
- [ ] TypeScript and relevant patient-similarity tests pass.
- [ ] Changes stay aligned with Parthenon’s design language and do not feel bolted on.

---

## Test Commands

From `/home/smudoshi/Github/Parthenon/frontend`:

```bash
npx vitest run src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx
```

```bash
npm test -- --runInBand src/features/patient-similarity
```

```bash
npx tsc --noEmit
```

If a new focused test file is added for `SimilarityModeToggle` or layout/help behavior, include it in the `vitest run` command.

---

## Manual Verification Checklist

1. Navigate directly to `/patient-similarity` with an unseen changelog version.
   - Expected: page is usable immediately; no blocking release-notes modal appears.
2. Confirm the setup area reads clearly without prior training.
   - Expected: source, workflow, cohorts, method, and primary action are visually grouped.
3. In compare mode, select a target and comparator with extreme imbalance.
   - Expected: visible warning with counts and cautionary copy.
4. Switch to expand mode.
   - Expected: comparator controls disappear, CTA copy changes, warning disappears.
5. Run a compare flow.
   - Expected: pipeline steps still populate as before.
6. Inspect top result panels.
   - Expected: overall divergence and covariate balance can be interpreted in one quick scan.

---

## Risks / Open Questions

1. Modal suppression scope
   - Open question: should the “What’s New” auto-open be suppressed only for `/patient-similarity`, or for all deep analytical workspaces?
   - Risk: a route-specific fix may feel ad hoc if other pages have the same complaint.

2. Method recommendation source
   - Open question: is a reliable per-source recommended method already available in current queries/state, or does the UI only know the selected mode?
   - Risk: if `recommendedMode` is not truly grounded, avoid overpromising dynamic recommendations.

3. Warning threshold calibration
   - Open question: do product/clinical stakeholders want 10x/25x and 100/50 thresholds, or a different standard?
   - Risk: too-sensitive warnings may become background noise; too-weak warnings miss real analytical risk.

4. Layout density
   - Risk: putting workflow mode, cohort selectors, method selection, banners, warning copy, settings, and CTA in one compact card could get crowded on narrower widths.
   - Mitigation: allow graceful wrapping and keep helper text concise.

5. Existing tests are shallow
   - Risk: current patient-similarity tests mostly assert static text, so implementation work may require broader mocking of hooks and route state than the current suite uses.

---

## Definition of Done

A reviewer should be able to open `/patient-similarity` and immediately understand:
- what to select
- what button to press
- what similarity method they are choosing
- when a cohort comparison is analytically questionable
- what the first result means

Ship the smallest coherent set of changes that achieves that outcome while preserving the current pipeline workflow.
