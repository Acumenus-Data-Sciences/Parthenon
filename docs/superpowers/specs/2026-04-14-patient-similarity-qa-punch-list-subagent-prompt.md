# Patient Similarity QA Punch List — Subagent Prompt

> For Hermes subagents: implement this as a focused frontend/product-quality pass on the Patient Similarity workspace. Treat this document as your full brief. Do not assume unstated context. Inspect the codebase, make targeted improvements, run relevant tests, and leave the branch in a reviewable state.

## Mission

Improve the Patient Similarity page so it behaves like a polished research workflow instead of an internal analytics console.

The highest-priority goals are:
1. Remove workflow friction on page entry.
2. Clarify the setup/actions at the top of the page.
3. Add stronger analytical guardrails for bad cohort comparisons.
4. Improve method discoverability and result readability.
5. Preserve the existing analytical pipeline and avoid unnecessary rewrites.

This is not a greenfield redesign. Work with the current Patient Similarity workspace and make the most impactful UX/product improvements that can realistically ship in one implementation pass.

## Scope

Primary scope:
- `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`
- `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`
- `frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx`
- `frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx`
- `frontend/src/features/patient-similarity/components/PipelineStep.tsx`
- `frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx`
- `frontend/src/features/patient-similarity/components/GenerationStatusBanner.tsx`
- `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx`
- `frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx`
- any nearby tests/styles/helpers needed to support the changes

Secondary scope, only if needed:
- shared page-level UI primitives already used elsewhere in the frontend
- the release-notes / "What's New" entry behavior if the blocker can be addressed cleanly from existing app infrastructure

Out of scope unless absolutely required:
- major backend API redesign
- new analytics algorithms
- replacing the full Patient Similarity pipeline architecture
- unrelated app-wide visual refactors

## Known findings from QA

These findings were observed during live manual inspection of the production page.

### Environment observations
- Production page is functional and renders comparison results.
- Local environment has route issues:
  - `/` returned 403
  - `/patient-similarity` returned 500
- No browser console errors were seen during production use.

### UX / product issues
1. A large "What's New in Parthenon" modal blocks the page on arrival and must be dismissed before the workflow can begin.
2. The top control row is ambiguous. The current labels and arrangement make the workflow hard to parse quickly.
3. The method toggle (`Auto`, `Interpretable`, `Embedding`) is not self-explanatory enough.
4. The page allows analytically weak comparisons, such as very large cohort-size imbalance, without strong warning copy.
5. Visualizations are useful but some chart/summary content feels low-contrast or less legible than it should be.
6. The page should feel more like a guided analysis workflow with a clear primary action and better setup hierarchy.

### Concrete example observed
A successful production comparison was run with:
- Target cohort size: 17,472
- Comparator cohort size: 59
- Overall divergence displayed: 33%

This is exactly the kind of comparison that should surface an analytical caution in the UI.

## Existing architecture context

Current route:
- `/patient-similarity` renders `PatientSimilarityWorkspace`

Current page structure already includes:
- page title + subtitle
- top controls for source / mode / target / comparator / compare
- a pipeline of analysis steps
- compare mode and expand mode
- settings drawer
- profile comparison / covariate balance / PSM / landscape / phenotype discovery / network fusion modules

Important implementation notes from current code:
- `PatientSimilarityWorkspace.tsx` owns pipeline state and orchestration.
- `CohortSelectorBar.tsx` currently renders source select, mode toggle, cohort dropdowns, generation banners, and the main action button.
- `PatientSimilarityWorkspace.tsx` currently stores the method mode separately as `similarityMode`, while the page workflow mode (`compare` vs `expand`) is part of `usePipeline()`.
- There is already a `SimilarityModeToggle` component imported into the workspace.
- The compare-mode primary action label currently appears as a generic `Compare` in `CohortSelectorBar.tsx`.

## Product direction

Implement the following product direction with pragmatic, codebase-native changes.

### 1. Make setup feel like a single coherent "Comparison setup" area
Target outcome:
- A user should immediately understand what must be selected before running analysis.
- The top section should feel like a setup card/form, not a toolbar.

Preferred approach:
- Group top controls visually as one setup region.
- Preserve compactness, but add hierarchy.
- Make the primary CTA visually and semantically obvious.

### 2. Clarify action naming
Target outcome:
- A first-time user should know the next action in under 3 seconds.

Preferred copy direction:
- Compare-mode primary CTA should say `Compare cohorts` instead of `Compare`.
- Expand-mode CTA should say something explicit like `Find similar patients` or equivalent if that already matches the mode intent.
- If secondary controls remain, they should read as helper actions, not competing primaries.

### 3. Explain method selection
Target outcome:
- Users should understand what `Auto`, `Interpretable`, and `Embedding` mean.

Preferred approach:
- Add short helper text and/or tooltips.
- Strengthen selected-state styling.
- Make it obvious that this is a similarity method choice, not a cosmetic display toggle.

Suggested conceptual copy:
- `Auto`: Recommended default; choose the best available method
- `Interpretable`: Feature-based comparison optimized for explainability
- `Embedding`: Representation-based comparison optimized for flexible similarity search

You do not have to use this exact wording, but the end result should teach users what they are choosing.

### 4. Add analytical guardrails for cohort-size imbalance
Target outcome:
- The UI should warn users when the cohort pairing is likely unstable or misleading.

Required behavior:
- When both cohorts are selected in compare mode, compute a simple size-imbalance heuristic.
- Show a visible warning when the comparison is extreme enough to merit caution.

Suggested minimum heuristic:
- warn when one cohort is much smaller than the other (for example ratio > 10x or similarly sensible threshold)
- warn when the smaller cohort falls below a low sample-size threshold

Suggested warning copy direction:
- `Comparator cohort is much smaller than target cohort. Similarity and matching results may be unstable.`

The exact thresholds and wording can be improved if the codebase already has conventions, but the warning must be hard to miss.

### 5. Improve summary/result readability
Target outcome:
- After comparison, the top results should be easier to interpret quickly.

Preferred approach:
- Strengthen contrast where needed.
- Add concise interpretation copy near key summary metrics where appropriate.
- Avoid large structural rewrites if smaller improvements achieve the goal.

### 6. Keep the page pipeline-oriented, not wizard-gated
Target outcome:
- The UI should suggest a sequence without hard-forcing one.

Preferred approach:
- Preserve the pipeline model.
- Emphasize recommended next steps where already supported.
- Do not convert the experience into a mandatory wizard.

## Deliverables

### Required deliverable A: shipped code changes
Make the UI/product improvements in code.

### Required deliverable B: automated test coverage
Add or update tests for at least:
- top CTA copy / behavior
- cohort-size imbalance warning behavior
- method explainer / method toggle presence and clarity
- any changed component behavior with meaningful logic

### Required deliverable C: concise implementation note
At the end of your work, prepare a short summary containing:
- files changed
- what user-visible behavior changed
- what thresholds/rules were chosen for warnings
- what tests were run
- any unresolved follow-up items

## Acceptance criteria

The task is complete only when all of the following are true:

1. The Patient Similarity page has a clearly identifiable primary setup area.
2. The compare CTA no longer reads as a vague generic action.
3. The method selection is meaningfully explained in the UI.
4. An obvious imbalance warning appears for materially bad cohort-size pairings.
5. Existing compare/expand workflow still functions.
6. TypeScript and relevant tests pass.
7. Changes remain aligned with the existing Parthenon design language and do not feel bolted on.

## Implementation guidance

### Recommended file-level approach

#### `PatientSimilarityWorkspace.tsx`
- Audit current page layout and determine whether the similarity method explainer belongs near the page title or within the setup region.
- Pass any new warning/helper props into `CohortSelectorBar`.
- Avoid duplicating logic between workspace and selector bar.
- Prefer computing warning inputs from already-available cohort profile/member count data.

#### `CohortSelectorBar.tsx`
- This is likely the primary place to:
  - rename CTA labels
  - add setup grouping
  - add imbalance warning UI
  - improve help text / labels
- Preserve accessibility semantics.
- Keep compare mode and expand mode clearly differentiated.

#### `SimilarityModeToggle.tsx`
- Improve active-state clarity.
- Add concise explanatory UI.
- Make sure the semantics are understandable without needing outside documentation.

#### result panels
- Touch only as much as needed to improve readability / interpretation.
- Favor small, high-value copy and contrast changes over major layout churn.

### Design / UX constraints
- Respect the existing Parthenon design system and token usage.
- Avoid introducing a second visual language.
- Avoid giant blocks of explanatory copy; aim for crisp, research-friendly language.
- Prefer inline guidance over modal guidance.
- The page should still feel powerful for experienced users.

### Accessibility expectations
- New warnings should be readable and visually distinct.
- Helper text should not rely only on color.
- Button labels and control labels must remain accessible.
- Tooltips alone are not enough; there should be at least some always-visible explanation for method choice.

## Suggested execution plan

1. Inspect current Patient Similarity workspace and top controls.
2. Implement setup-area hierarchy and rename the primary CTA.
3. Add method explanation and stronger toggle states.
4. Implement cohort-size imbalance warning logic + UI.
5. Make targeted readability improvements to summary/results if needed.
6. Update and add tests.
7. Run typecheck and targeted test suite.
8. Summarize changes and call out any follow-up work.

## Commands to run

From `./Parthenon/frontend`:

```bash
npm test -- --runInBand src/features/patient-similarity
```

```bash
npx vitest run src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx
```

```bash
npx tsc --noEmit
```

If there is an existing narrower test command already used in this repo for the feature, use it.

## References inside the repo

Useful context documents:
- `docs/superpowers/plans/2026-04-11-patient-similarity-ux-alignment.md`
- `docs/superpowers/plans/2026-04-10-patient-similarity-ux-redesign.md`
- `docs/blog/2026-04-10-patient-similarity-workspace-redesign.md`

Useful source files:
- `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`
- `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`
- `frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx`
- `frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx`

## Non-goals / anti-patterns

Do not:
- rewrite the whole page from scratch just to improve the setup bar
- add hidden magical behavior without user feedback
- introduce a wizard that blocks experienced users
- bury the imbalance warning in tooltips or developer diagnostics
- change backend contracts unless absolutely necessary
- broaden into unrelated product cleanup

## Definition of done

Your implementation is done when a reviewer can open the page and immediately understand:
- what to select
- what button to press
- what method they are using
- when a cohort comparison is statistically questionable
- what the first result means

Ship the smallest coherent set of changes that achieves that outcome.
