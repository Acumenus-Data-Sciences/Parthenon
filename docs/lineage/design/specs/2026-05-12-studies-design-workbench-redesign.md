---
doc_type: spec
status: active
date: 2026-05-12
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - frontend/src/features/studies/components/StudyDesignWorkbench.tsx
  - frontend/src/features/studies/components/workbench/
  - frontend/src/features/studies/hooks/useStudyDesignWorkbench.ts
related_prs: []
related_artifacts:
  - docs/commons/mockups/studies-design-workbench-v2.html
  - .planning/quick/260512-r6q-html-prototype-full-studies-design-workb/
---

# Studies → Design Tab Redesign — Compiler Workbench

**Date:** 2026-05-12
**Status:** Active
**Mockup:** [docs/commons/mockups/studies-design-workbench-v2.html](../../../commons/mockups/studies-design-workbench-v2.html)

## Overview

The Studies → Design tab compiles a researcher's intent (or uploaded protocol PDF) into a reproducible, federated HADES study package across eight stages (Intent → Phenotypes → Concept Sets → Cohorts → Feasibility → Analyses → Lock → Package). The current implementation in [StudyDesignWorkbench.tsx](../../../../frontend/src/features/studies/components/StudyDesignWorkbench.tsx) renders these as a twelve-panel vertical waterfall. This document proposes a three-pane "Compiler Workbench" replacement that commits to the IDE/compiler metaphor the code already uses (`StudyCompilerGuidancePanel`, `compiler stages`, `materialize`) and resolves three concrete failure modes without removing a single existing feature.

This is a **purely presentational** refactor. No backend changes, no API contract changes, no schema migrations, no asset state-machine changes. Every TanStack Query mutation, every Zod schema, and every Eloquent model in [features/studies/](../../../../frontend/src/features/studies/) is preserved.

## Why redesign

| Failure mode in v1 | Cost to user | What v2 changes |
|---|---|---|
| Pipeline location encoded as scroll depth | No mental model of "where am I" or "what's next" without re-reading the page | Pipeline Rail makes location spatial and persistent |
| All twelve panels render simultaneously regardless of relevance | Visual noise + cognitive cost; Feasibility and Lock live below the fold | Active-Editor pattern gives each stage the screen it deserves when it's the relevant one |
| AI assistance (evidence, lint, open questions, Abby) is adjacent to the form but not bound to it | User sees "Population needs review" but must mentally map it back to the Population field | Peripheral Rail is context-aware: focus a node, get its evidence, lint, AI questions, federation status |

## Architecture — three-pane shell

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Identity Strip                                                              56 px  │
│ wordmark · breadcrumb · session-chip   │   study title (italic subtitle)   │ session-pill · PI · state · upload · Lock-CTA │
├──────────────┬─────────────────────────────────────────────┬───────────────────────┤
│ Pipeline     │ Active Editor                                │ Peripheral Rail       │
│ Rail         │                                              │                       │
│ 220 px       │ minmax(0, 1fr)                               │ 340 px (collapsible)  │
│              │                                              │                       │
│ 8 stations,  │ One stage at a time. Purpose-built layout    │ 6 tabs: Evidence /    │
│ scanlines,   │ per stage:                                   │ Lint / Notes / Sites /│
│ progress     │   01 Intent       → PICO Canvas              │ Versions / Abby       │
│ arcs, state  │   02 Phenotypes   → Asset Matrix             │                       │
│ colors,      │   03 Concept Sets → Asset Matrix             │ Context-aware: tracks │
│ pulsing      │   04 Cohorts      → Role Triptych            │ the focused canvas    │
│ active dot,  │   05 Feasibility  → Federation Heatmap       │ node / table row /    │
│ gold rivet   │   06 Analyses     → Asset Matrix             │ selected site         │
│ on locked    │   07 Lock         → Lock Launchpad           │                       │
│ terminus     │   08 Package      → Package Receipt          │                       │
└──────────────┴─────────────────────────────────────────────┴───────────────────────┘
```

Three first principles:

1. **Focus.** One stage is active at a time, full-width, fully attended.
2. **Persistence.** Pipeline state, study identity, and AI evidence are always visible peripherally.
3. **Provenance.** Every assertion (PICO field, cohort, concept set, analysis plan) shows where it came from (protocol page, prior study, AI inference, manual edit) with one click.

## Feature-fidelity map

Every panel and behavior in [StudyDesignWorkbench.tsx](../../../../frontend/src/features/studies/components/StudyDesignWorkbench.tsx) maps to a specific location in v2. Nothing is dropped.

### Stage-orchestration features

| v1 feature | v1 location | v2 home |
|---|---|---|
| Protocol upload (file input + `ProtocolImportProgress`) | Top of page, always visible | Upload-protocol icon button in Identity Strip; while importing, Intent station shows progress ring; mid-import progress bar appears at top of Intent Active Editor |
| Session list (240 px sidebar of past sessions) | Inside the workbench grid | Session-chip dropdown in Identity Strip — `"session: 'Initial draft' ▾"` — opens session switcher menu |
| Research Question textarea | Below sessions in current page | Empty state of Intent Active Editor (no version yet → textarea + Generate button); populated state shows the text as a one-line readonly field with click-to-expand in the Research-Question strip |
| Generate Intent button | Below the textarea | Empty state of Intent Active Editor; also accessible from session menu as "New session from question" |
| `ActionGateHint` (Generate Intent gate message) | Under the button | Inline gate hint under the Generate button in empty state |
| Version pills (`v1·draft`, `v2·accepted`, `v3·locked`) | Above Intent panel | Version timeline above the canvas; click for selection; shift-click two nodes for compare |
| `StudyCompilerGuidancePanel`: next-best-action text | Mid-page panel | "Next: …" thin banner across the top of the Active Editor (active station's specific guidance) |
| `StudyCompilerGuidancePanel`: 4 metric boxes (Accepted/Concepts/Cohorts/Analyses) | Inside the panel | Encoded as Pipeline Rail station arcs + counts (`3/4 materialized`, `2/3 linked`) |
| `StudyCompilerGuidancePanel`: 8 stage chips | Inside the panel | The 8 Pipeline Rail stations *are* the chips, vertical, with the same status colors |

### Intent Review features

| v1 feature | v1 location | v2 home |
|---|---|---|
| Research Question (full-width field) | Top of `IntentReviewPanel` | One-line readonly value in the Research-Question strip above the PICO Canvas; expand to full textarea on click |
| Primary Objective | Form grid | Same Research-Question strip, second row |
| Population | Form grid | PICO Canvas — dashed frame containing the other nodes |
| Exposure | Form grid | PICO Canvas — editable node |
| Comparator | Form grid | PICO Canvas — editable node branching from Exposure |
| Primary Outcome | Form grid | PICO Canvas — editable node with arrow from Exposure |
| Time at Risk | Form grid | Parchment pill on the Exposure → Outcome arrow |
| Status badge (ready / needs-review) | Below form | Status pill on Version timeline (`v3 · review`) |
| Missing/weak field pills | Below form | (a) Lint dots on PICO nodes, (b) Lint tab on Peripheral Rail, (c) "▲ Resolve N blockers" tooltip on Identity Strip Lock CTA |
| Evidence snippets | List below form | Evidence tab on Peripheral Rail — context-aware: focus a node, see its protocol quotes (parchment style) |
| Open questions | List below form | Under Evidence in Peripheral Rail (AI question row with "Ask Abby" action) |
| Risk notes | List below form | Notes tab on Peripheral Rail (6th tab) |
| Design assumptions | List below form | Notes tab on Peripheral Rail (6th tab) |
| Lint results (blocking / warning bars) | Inside `IntentReviewPanel` | Lint tab + per-field dots + Identity-strip blocker counter (all three views of the same data) |
| Save draft button | Bottom of form | Sticky action bar at bottom of Active Editor: `[Discard] [Save draft]` |
| Accept button (advance version) | Bottom of form | Same sticky action bar: `[Accept v4 →]` (gated when blockers remain — currently rendered with teal CTA, `.gated` class) |

### Bottom-Up Compatibility features

| v1 feature | v1 location | v2 home |
|---|---|---|
| Import existing study as assets | `BottomUpCompatibilityPanel` | "Import prior study" action in canvas-toolbar (above Versions row); also offered as row-hover action in Asset Matrix / Role Triptych |
| Critique current design | Button in panel | "Critique design" action in canvas-toolbar; also an Abby quick-action on the Abby tab |

### Phenotype / Concept Set / Cohort / Analysis features

When the corresponding Pipeline Rail station is selected, the Active Editor renders the stage's purpose-built layout. The four asset state-machine operations (**d**raft → **v**erify → **m**aterialize → **l**ink) are preserved in all of these.

| v1 panel | v2 Active-Editor layout |
|---|---|
| `PhenotypeRecommendationPanel` | Asset Matrix (rows = suggested phenotypes; columns = name, role, evidence, status pipeline, age); per-row Accept / Reject; gating preserved as empty-state when version is not yet accepted |
| `ConceptSetDraftPanel` | Asset Matrix (rows = concept sets; columns = name, role, size, status pipeline glyph `●─●─●─○`, provenance, age); row-hover toolbar: verify / materialize / link / unlink; multi-select → batch actions in a sticky bottom bar; click row → side drawer with full review notes |
| `CohortDraftPanel` | **Cohort Triptych** — three large vertical cards side-by-side, one per role (target / comparator / outcome); each card carries the 4-stop pipeline glyph horizontally; per-source patient counts inline (SynPUF/IRSF/Inpatient/Pancreas); link / unlink to canonical cohort definition; blocking issues shown as a per-card alert |
| `AnalysisPlanPanel` | Asset Matrix (rows = analysis plans; columns = family — CohortMethod / PatientLevelPrediction / Characterization / SccsMethod, name, HADES status, package output, age); per-row verify (HADES compatibility check) / materialize (build R package) |

### Feasibility features

| v1 feature | v1 location | v2 home |
|---|---|---|
| Run Feasibility button | Top of `FeasibilityDashboard` | Header action of Active Editor when Feasibility station selected |
| Per-site cards (counts, attrition, DQ) | Stacked vertical cards | **Federation Heatmap** — matrix of sites × required artifacts (Target / Comparator / Outcome / PS Covariates / DQD); cell color encodes readiness; click cell for a drawer with full per-site detail, freshness, exception log |
| DQD pass rate | Per-card field | Heatmap cell color + drawer detail |
| Site freshness | Per-card field | Heatmap cell tooltip + drawer detail |
| Request data refresh per site | Per-card action | Shift-click row in heatmap |

### Lock & Package features

| v1 feature | v1 location | v2 home |
|---|---|---|
| Readiness checklist | `StudyDesignLockPanel` | Lock Launchpad — full Active Editor with preflight checklist (Intent accepted, cohorts linked, feasibility passed, analyses approved, open questions acknowledged) |
| Lock button | Bottom of panel | Crimson CTA in Launchpad; wax-seal animation on click |
| Package manifest preview | Bottom of panel | File-tree component in Launchpad + provenance card (source protocol, vocabulary version, HADES version, sites bound, signing key) |
| Signing / signature output | (implicit) | Receipt rendered into the Package stage Active Editor after Lock succeeds; signature hash becomes a chip in the Identity Strip |

### Notes tab — what's in it

Catches the leftover content from v1's Assistance Panel that doesn't belong in Evidence or Lint:

- Risk notes
- Design assumptions
- User-added free-text notes (new — small feature add)
- Reviewer comments from peer review (new — small feature add, but the underlying review_notes field already exists on `StudyDesignAsset`)

## Aesthetic system

| Token | v1 | v2 |
|---|---|---|
| Display font | system | `Source Serif 4` (mockup); ideally `GT Sectra` in production — serif, editorial gravity |
| UI body | system / Inter-like | `system-ui` fallback, ideally `NB International Pro` or `Söhne` in production — neo-grotesque, precise, non-Inter |
| Mono | system | `JetBrains Mono` (mockup); ideally `Berkeley Mono` in production — for IDs, SQL, file paths |
| Base background | `#0E0E11` flat | `#0E0E11` + 4% SVG `feTurbulence` grain overlay + faint horizontal scanlines on the rail |
| Surface | `bg-surface-raised` rounded-lg | Slate ramp `#1E2026 → #3A3E48`; 0.5 px hairline borders; etched 1 px inset top-edge highlight on cards |
| Crimson `#9B1B30` | decorative | Reserved: locked / authoritative / brand mark only |
| Gold `#C9A227` | decorative | Review / attention-needed / in-progress hold |
| Teal `#2DD4BF` | decorative | Validated / ready / federation green-light |
| Parchment `#F4EFE6` | — | 8% opacity blockquote background for protocol-evidence quotes — visual callback to the printed protocol |
| Radii | `rounded-lg` everywhere (8 px) | 0 px on rail and table cells, 6 px on cards, 12 px on Lock Launchpad |
| Shadow | none | Long soft shadow (`0 24px 60px -24px`) under the active editor card only |

### Motion

- Active station on Pipeline Rail: 2.4 s ease-in-out pulse (only background-rail motion)
- PICO node hover: 180 ms `translateY(-1px)` + drop-shadow
- Stage transitions: 180 ms ease-out slide on Active Editor
- Lint clearing: field "breathes" once (`scale(1.02 → 1.0)`, 200 ms)
- Asset materialize: pipeline glyph advances with a 300 ms sweep
- Lock: 800 ms wax-seal stamp on the crimson Parthenon mark, then receipt fade-in

No bouncy springs. No purple/violet glows. No decorative ambient loops.

## Component inventory (new React files)

Pure presentational; the data layer is untouched.

| File | Purpose | Approx LOC |
|---|---|---|
| `frontend/src/features/studies/components/v2/CompilerWorkbench.tsx` | Top-level three-pane shell; replaces `StudyDesignWorkbench` body when `studies.workbench.v2` flag is on | <200 |
| `.../v2/IdentityStrip.tsx` | Sticky 56 px top bar — wordmark, breadcrumb, session-chip, title, version pill, PI, state pill, upload icon, Lock CTA | <150 |
| `.../v2/SessionSwitcher.tsx` | Dropdown menu invoked from session-chip | <80 |
| `.../v2/PipelineRail.tsx` | Vertical 8-station rail with progress arcs, state dots, scanlines, gold rivet | <250 |
| `.../v2/PeripheralRail.tsx` | Right tabbed sidecar shell | <120 |
| `.../v2/peripheral/EvidencePanel.tsx` | Parchment quote, lint warning, AI open question, sites preview | <150 |
| `.../v2/peripheral/LintPanel.tsx` | Lint issues grouped by severity, scoped to focused node | <100 |
| `.../v2/peripheral/NotesPanel.tsx` | Risk notes + design assumptions + free-text + reviewer comments | <120 |
| `.../v2/peripheral/SitesPanel.tsx` | Federation site readiness chips with hover detail | <100 |
| `.../v2/peripheral/VersionTimeline.tsx` | Versions tab — full timeline with diff-compare | <200 |
| `.../v2/peripheral/AbbyChat.tsx` | Chat affordance (wraps existing Abby integration) | <150 |
| `.../v2/stages/PicoCanvas.tsx` | SVG editable PICO causal graph; replaces `IntentReviewPanel` body | <400 |
| `.../v2/stages/AssetMatrix.tsx` | Shared table component for Phenotypes, Concept Sets, Analyses | <300 |
| `.../v2/stages/RoleTriptych.tsx` | Three-card cohort role layout; replaces `CohortDraftPanel` body | <250 |
| `.../v2/stages/FederationHeatmap.tsx` | Sites × artifacts matrix; replaces `FeasibilityDashboard` body | <250 |
| `.../v2/stages/LockLaunchpad.tsx` | Preflight checklist + package preview + provenance + Lock CTA | <250 |
| `.../v2/stages/PackageReceipt.tsx` | Post-lock signature receipt | <100 |
| `.../v2/shared/PipelineGlyph.tsx` | 4-stop micro-pipeline used in tables and triptych | <80 |
| `.../v2/shared/ProvenanceDot.tsx` | Single-element provenance indicator with hover detail | <60 |

Existing files **untouched**:

- `frontend/src/features/studies/hooks/useStudyDesignWorkbench.ts`
- `frontend/src/features/studies/api/studyApi.ts`
- `frontend/src/features/studies/schemas/studyDesignSchemas.ts`
- `frontend/src/features/studies/types/study.ts`
- All `components/workbench/*` panels (kept until v2 reaches parity; deleted in cleanup phase)

## Phased rollout

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| 1 | Shell — `IdentityStrip` + `PipelineRail` + `CompilerWorkbench` three-pane wrapper; existing `workbench/*` panels render inside the active-editor pane unchanged behind `studies.workbench.v2` feature flag | ~2 days | Low — pure layout wrapper |
| 2 | `PicoCanvas` replaces `IntentReviewPanel` body | ~3 days | Medium — new visualization, but bounded data shape |
| 3 | `RoleTriptych` + `AssetMatrix` (shared across concept sets / phenotypes / analyses) | ~3 days | Medium — three callsites to migrate |
| 4 | `FederationHeatmap` | ~2 days | Low — straight data viz |
| 5 | `LockLaunchpad` + `PackageReceipt` + `VersionTimeline` compare mode + motion polish | ~2 days | Low — high polish, contained |
| 6 | Typography polish (commercial fonts if licensed); accessibility audit; remove v1 `workbench/*` panels | ~1 day | Low |

Total ≈ 13 dev-days. Behind `studies.workbench.v2` flag throughout, with v1 view preserved until parity is signed off.

### Status (as of 2026-05-13)

| Phase | Status | Commit(s) |
|---|---|---|
| 1 — Shell | ✓ landed | `e85f70e7b`, `9a46b9bca` |
| 2 — PICO Canvas + stage routing | ✓ landed | `6145fa7b2` |
| 3 — Asset Matrix + Cohort Triptych | ✓ landed | `b47124840` |
| 4 — Feasibility View (single-CDM per Decision Q4) | ✓ landed | `f3f5e3b8d` |
| 5 — Lock Launchpad + Package Receipt + Version Timeline + motion polish | ✓ landed | `b184b06b3` |
| 6 — A11y polish (focus rings, reduced-motion, aria-current) | ✓ landed | (this commit) |
| 6 — Typography commercial-font swap (GT Sectra / NB International / Berkeley Mono) | **DEFERRED** — requires font-license confirmation. Current fallbacks (Source Serif 4, system-ui, JetBrains Mono) ship the aesthetic at zero license cost. |  |
| 6 — Remove v1 `workbench/*` panels | **DEFERRED** — requires explicit parity sign-off. v1 remains the codepath when `?wb=v2` is not present, so deletion would force v2 as default. Pending visual review of all 8 stations + decision to flip default flag. |  |

## Verification

### Functional parity (must pass before flipping default flag)

- [ ] Every action available in v1 Design tab is reachable in v2 with the same number of clicks ± 1
- [ ] Every TanStack mutation invoked by v1 is invoked by v2 (same hook, same payload shape)
- [ ] Cypress / Playwright tests for the Studies feature pass against v2 with no test changes (test selectors may need updating, behavior assertions must not)
- [ ] Pest backend test suite is unchanged and green
- [ ] OpenAPI generated types remain unchanged

### Visual / aesthetic gauntlet (lifted from the mockup plan)

- [ ] No `purple`, `indigo`, `violet`, or `fuchsia` Tailwind classes in `v2/`
- [ ] No `Inter` or `Space Grotesk` font families in `v2/`
- [ ] All five palette tokens (`#0E0E11`, `#9B1B30`, `#C9A227`, `#2DD4BF`, `#F4EFE6`) referenced via existing CSS variables, not hex-inlined
- [ ] Each `v2/` file under 500 lines per project rule
- [ ] Only the Active Editor card carries the long shadow

### Accessibility

- [ ] Pipeline Rail stations are keyboard-navigable (arrow keys), have `aria-current` on active station
- [ ] PICO Canvas nodes are focusable, edit on Enter, evidence rail updates on focus
- [ ] Peripheral Rail tabs follow WAI-ARIA tablist pattern (already established in `components/workbench/`)
- [ ] All 6 peripheral tabs have visible focus rings
- [ ] All icon-only buttons (Upload, session caret) have `aria-label`

## Decisions (resolved 2026-05-12)

The five open questions below were resolved before Phase 1 implementation. Each decision is binding on the implementation; deviations require a new ADR-style entry under this section.

| # | Question | Decision | Implementation impact |
|---|---|---|---|
| 1 | Session-chip placement | **Left of breadcrumb (current mockup)** | `IdentityStrip` keeps breadcrumb middle segment capped with `max-width` + ellipsis so the chip and breadcrumb don't compete |
| 2 | Compare-versions UX | **Canvas-toolbar `Compare v2 ↔ v3` button** is canonical entry, opens a side-by-side diff drawer in the Peripheral Rail. Shift-click on timeline nodes works as a power-user shortcut in parallel | `VersionTimeline` exposes both affordances; Phase 5 wires the diff drawer |
| 3 | Risk notes / design assumptions placement | **Hybrid: Notes tab on Peripheral Rail (master list) + per-node count badges on PICO nodes and asset rows that hop to the filtered Notes tab** | `NotesPanel` is the canonical view; canvas nodes carry a `noteCount` indicator with deep-link behavior |
| 4 | Federation Heatmap density (8+ sites) | **Scope reset: single-CDM focus (Acumenus OHDSI) for v2.** No federation matrix to size. Stage 5 (Feasibility) renders as a single-source readiness view — target / comparator / outcome / PS covariate / DQD readiness for the bound CDM. The `FederationHeatmap` design remains documented above as **future scope**, to be revived when multi-site federation returns to the roadmap. | `stages/FeasibilityView.tsx` (new, simpler) replaces `FederationHeatmap.tsx` in the Phase 4 deliverable. Federation chips in the mockup illustrate the *future* shape but the production Phase 4 rendering shows a single CDM. |
| 5 | Mobile / narrow viewport | **Tiered drawer collapse.** Breakpoints: `<1280px` Peripheral Rail collapses to a slide-in drawer (toggle in the editor header); `<960px` Pipeline Rail also collapses to a slide-in drawer; `<768px` render a "Best viewed on desktop" banner with a link back to the Studies list. | `CompilerWorkbench` ships responsive CSS with these three breakpoints; both rails accept a `collapsed` boolean prop that defaults from the matched media query |

## References

- Current implementation: [`frontend/src/features/studies/components/StudyDesignWorkbench.tsx`](../../../../frontend/src/features/studies/components/StudyDesignWorkbench.tsx)
- Workbench panel directory: [`frontend/src/features/studies/components/workbench/`](../../../../frontend/src/features/studies/components/workbench/)
- Data hook: [`frontend/src/features/studies/hooks/useStudyDesignWorkbench.ts`](../../../../frontend/src/features/studies/hooks/useStudyDesignWorkbench.ts)
- Working HTML mockup: [`docs/commons/mockups/studies-design-workbench-v2.html`](../../../commons/mockups/studies-design-workbench-v2.html)
- Originating quick task: `.planning/quick/260512-r6q-html-prototype-full-studies-design-workb/`
