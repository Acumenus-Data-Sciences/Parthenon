# FINNGEN Workbench Redesign — 2026-03-16

## Summary

Decomposed the 5,055-line monolithic `FinnGenToolsPage.tsx` into 8 focused component files and redesigned the page layout for intuitive, workflow-oriented usage. The main page is now a 259-line thin shell.

## Problems Solved

1. **Empty placeholder wall** — Each tool tab rendered 10-20 result panels as empty grey "will appear here" boxes before any preview was run
2. **Run Inspector above tool controls** — Users had to scroll past 3 empty panels to reach the actual input controls
3. **Header wasted viewport** — Phase 2A marketing card + source selector consumed ~300px of vertical space
4. **No workflow guidance** — The 4 tools are meant to be used sequentially (ROMOPAPI -> HADES -> Cohort Ops -> CO2) but the UI gave no indication
5. **ROMOPAPI overwhelmed with 8 selectors** — All advanced options shown at once
6. **50+ useState hooks in one component** — Unmaintainable
7. **Cohort Ops showed raw JSON textarea prominently** — Most users use the Operation Builder

## Architecture Changes

### New files

| File | Lines | Purpose |
|------|-------|---------|
| `components/workbenchShared.tsx` | 1,078 | Shared constants, utilities, presentation components |
| `components/RomopapiTab.tsx` | 735 | ROMOPAPI tool tab |
| `components/HadesExtrasTab.tsx` | 635 | HADES Extras tool tab |
| `components/CohortOpsTab.tsx` | 1,509 | Cohort Operations tool tab |
| `components/Co2AnalysisTab.tsx` | 1,083 | CO2 Analysis Modules tool tab |
| `components/WorkflowStepper.tsx` | 125 | Numbered step indicator/navigation |
| `components/CollapsibleSection.tsx` | 34 | Reusable expand/collapse wrapper |

### Modified files

| File | Change |
|------|--------|
| `pages/FinnGenToolsPage.tsx` | 5,055 -> 259 lines. Thin shell: header + source selector + stepper + active tab |
| `pages/__tests__/FinnGenToolsPage.test.tsx` | Updated assertions for new layout (CollapsibleSection expansion, removed Community SDK checks) |

## Design Decisions

1. **WorkflowStepper** replaces flat tab bar — numbered steps (1-4) with subtitles guide the intended sequential workflow
2. **Progressive disclosure** — `ResultSection` component returns `null` when data is absent, eliminating empty panels
3. **Advanced Options** collapsed — ROMOPAPI's 8 selectors and HADES's config fields start hidden in CollapsibleSections
4. **Controls-first layout** — Tool inputs and Run button always visible at top; results appear below only after execution
5. **Cohort Ops Operation Builder surfaced** — Prominent full-width card instead of a small button; raw JSON collapsed
6. **Handoff surfaced** — "Hand Off To CO2 Modules" button appears prominently at top of results when available; auto-navigates stepper to step 4
7. **Run History at bottom** — Recent Runs, Inspector, Comparison moved into collapsed section at bottom of each tab
8. **Source selector inlined** — Dropdown in the header bar, no separate card

## Verification

- TypeScript: 0 errors (`npx tsc --noEmit`)
- Tests: 1/1 passing (`npx vitest run src/features/finngen`)
- No backend or API changes required for the redesign
