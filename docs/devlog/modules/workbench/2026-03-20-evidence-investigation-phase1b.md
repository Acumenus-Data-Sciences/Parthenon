# Workbench: Evidence Investigation Platform — Phase 1b

**Date:** 2026-03-20
**Phase:** Evidence Investigation Phase 1b (Plumbing + Heavy Visualizations)
**Commits:** d88d0d6 – 3c09157 (12 commits total)
**Status:** Deployed to production

---

## Overview

Phase 1b completed the Evidence Investigation platform's Phenotype domain in two sub-phases within the same session. Phase 1b-i wired Phase 1a's shell to persistent state and integrated it with existing backend services. Phase 1b-ii added D3 and Recharts visualizations — Venn diagrams, attrition funnels, forest plots, and signal bar charts — to make the Cohort Builder and CodeWAS tabs fully functional.

---

## Phase 1b-i: Plumbing and Integration

**Commits:** d88d0d6 – aa7e412 (6 commits)

### Motivation

Phase 1a delivered the structural shell: Evidence Board layout, Concept Explorer, domain panel stubs, and the backend Investigation/EvidencePin/ConceptExplorer APIs. But state was ephemeral — concept sets lived in component state and were lost on navigation. The Cohort Builder and CodeWAS Validate tabs were stubbed out with placeholder content. Phase 1b-i closed these gaps by connecting the shell to the server and activating the two remaining Phenotype panel tabs using existing backend services.

### Auto-Save Hook

A `useAutoSave` hook provides 2-second debounced auto-persistence with JSON deduplication to suppress no-op saves. The hook exposes a `status` value (`idle | saving | saved | error`) that surfaces in the Phenotype panel header as a small status indicator.

```
frontend/src/features/workbench/hooks/useAutoSave.ts
```

The hook is wired through `EvidenceBoard` → `PhenotypePanel`. On each concept set mutation the debounce timer resets; after 2 seconds of quiet the current `PhenotypeState` is serialized and sent to `PUT /api/v1/investigations/{id}` via the `metadata.phenotype_state` JSONB field.

### Multi-Set Management

Concept sets are now stored as a `Map<string, {name, entries}>` keyed by UUID inside `PhenotypeState`. The Phenotype panel gained:

- **Name input** — editable label per concept set, persisted on auto-save
- **Set switcher dropdown** — select the active concept set from all sets in the investigation
- **"New Set" button** — generates a new UUID, seeds an empty set, switches to it

All sets are serialized together into `phenotype_state.concept_sets` on each auto-save cycle. The Concept Set Builder's add/remove/toggle operations operate only on the active set's entries; other sets are carried forward unchanged.

### Concept Set Format Mapper

A bidirectional mapper handles the casing mismatch between the investigation's internal lowercase format and the OHDSI Atlas uppercase wire format required by downstream HADES modules.

```
frontend/src/features/workbench/utils/conceptSetMapper.ts
```

Converts `concept_id / include_descendants / is_excluded` ↔ `CONCEPT_ID / includeDescendants / isExcluded`. Used when exporting concept sets for FinnGen cohort operations and when importing from the Phenotype Library.

### Cohort Builder Tab

The Build tab in `PhenotypePanel` was activated from its Phase 1a stub. It provides an import mode selector with four options:

| Mode | Source |
|------|--------|
| Parthenon | Existing cohort definitions in this instance |
| Atlas JSON | Paste raw Atlas cohort JSON |
| File | Upload `.json` cohort definition file |
| Phenotype Library | OHDSI phenotype library (synced via `phenotype:sync`) |

The Parthenon mode uses a `CohortPicker` component backed by the existing `useCohortDefinitions` TanStack Query hook from the cohort-definitions feature — no new backend code required. Cohorts are multi-selectable with a "primary" designation radio button. Selected cohort chips appear below the picker. The primary cohort is passed to the Cohort Operation Panel (Phase 1b-ii) for Venn diagram anchoring.

### CodeWAS Validate Tab

The Validate tab was activated from its Phase 1a stub. It calls the existing FinnGen CO2 `codewas_preview` module via `previewFinnGenCo2Analysis`:

- **Source selector** — CDM data source dropdown (same sources available in FinnGen tools)
- **Case/control labels** — text inputs for labeling the primary cohort and comparator
- **Results display** — summary metrics table (N cases, N controls, N codes tested, N significant at FDR 5%) followed by a signals chart and forest plot (both replaced with proper D3/Recharts components in Phase 1b-ii)
- **Pin-to-dossier** — "Pin" buttons on individual CodeWAS hits create `codewas_hit` evidence pins on the current investigation

### Guided Mode Entry

`NewInvestigationPage` now calls the StudyAgent `splitIntent` endpoint when the research question field contains more than 20 characters and the user submits. The AI decomposes the free-text research question into a target-outcome pair and seeds two named concept sets into `phenotype_state` — one for the target exposure concept and one for the outcome concept. If StudyAgent is unavailable the page falls back silently to the standard empty investigation creation, so guided mode is best-effort and does not block the creation flow.

### Key Files (Phase 1b-i)

```
frontend/src/features/workbench/hooks/useAutoSave.ts                  (new)
frontend/src/features/workbench/utils/conceptSetMapper.ts              (new)
frontend/src/features/workbench/components/panels/PhenotypePanel.tsx   (modified — auto-save wiring, multi-set management, tab activation)
frontend/src/features/workbench/components/evidence-board/EvidenceBoard.tsx  (modified — auto-save integration)
frontend/src/features/workbench/components/cohort-builder/CohortPicker.tsx   (new)
frontend/src/features/workbench/pages/NewInvestigationPage.tsx         (modified — guided mode entry)
```

---

## Phase 1b-ii: Heavy Visualizations

**Commits:** 3d9aeac – 3c09157 (6 commits)

### Motivation

The Cohort Builder and CodeWAS Validate tabs needed visualizations to be genuinely useful. The existing published components — `AttritionDiagram`, `ForestPlot` — use hardcoded white backgrounds incompatible with the dark clinical theme (`#0E0E11` base). New standalone dark-themed versions were built rather than patching shared components that are used in other contexts.

### D3 Venn Diagram

```
frontend/src/features/workbench/components/cohort-builder/VennDiagram.tsx
```

SVG-rendered circles for 2–3 cohorts with approximately 40% overlap. Supports three set operations, each with distinct visual treatment:

| Operation | Highlight behavior |
|-----------|-------------------|
| `union` | All circle regions bright |
| `intersect` | Overlap region highlighted, non-overlap dimmed |
| `subtract` | Primary circle minus overlap region highlighted |

Clip paths define the overlap and non-overlap regions for selection. A result count overlay renders at the center of the highlighted region. Colors follow the dark clinical palette: teal (`#2DD4BF`) for the primary cohort, crimson (`#9B1B30`) for the comparator, gold (`#C9A227`) for a third cohort when present.

### D3 Attrition Funnel

```
frontend/src/features/workbench/components/cohort-builder/AttritionFunnel.tsx
```

Standalone dark-themed waterfall chart. Horizontal bars are scaled against the first step's count. Features:

- Dashed connectors between steps
- Crimson drop indicators with `−N excluded` annotations on the right
- Percent-retained badges on each bar
- Step labels on the left rail

Built as a standalone component rather than extending the existing `AttritionDiagram` (which has a hardcoded white background used in the Results Explorer).

### Cohort Operation Panel

```
frontend/src/features/workbench/components/cohort-builder/CohortOperationPanel.tsx
```

Integrates VennDiagram, AttritionFunnel, and CohortSizeComparison into a single panel with an execute action. UI elements:

- **Pill-button operation selector** — union / intersect / subtract
- **CDM source dropdown** — selects target data source for execution
- **Execute button** — calls `executeCohortOperation` → FinnGen cohort-operations endpoint
- **Result area** — shows result count, attrition funnel for the operation's steps, and a compile summary message
- **Pin button** — creates a `cohort_summary` evidence pin with operation type, input cohort IDs, result count, and attrition data in the pin's `content` JSONB

The Venn diagram updates reactively as the operation selector changes — no execute needed to see the visual representation of the chosen set operation.

### Recharts Cohort Size Comparison

```
frontend/src/features/workbench/components/cohort-builder/CohortSizeComparison.tsx
```

Horizontal bar chart comparing person counts across selected cohorts. Gold (`#C9A227`) for the primary cohort, teal (`#2DD4BF`) for all others. Built with Recharts `BarChart` in horizontal layout. Rendered inside `CohortOperationPanel` above the Venn diagram as a quick size-at-a-glance before running operations.

### D3 Forest Plot

```
frontend/src/features/workbench/components/codewas/ForestPlotWrapper.tsx
```

Standalone dark-themed forest plot. Features:

- Log-scale hazard ratio axis centered on 1.0
- Crimson confidence interval bars with whisker caps
- Teal point estimate circles
- Gold dashed null line at HR = 1.0
- Row labels on the left

Built as `ForestPlotWrapper` to distinguish it from the existing `ForestPlot` component used in the Results Explorer / Studies module (white background, different prop contract).

### Recharts Signals Bar Chart

```
frontend/src/features/workbench/components/codewas/SignalsBarChart.tsx
```

Horizontal bar chart for CodeWAS top signals. Teal fill, sorted descending by signal strength, 40-character label truncation for long ICD/ATC code descriptions. Built with Recharts `BarChart` in horizontal layout.

### CodeWAS Results Upgrade

The Validate tab's results area was upgraded from a CSS progress-bar table to the new visualization stack:

- `SignalsBarChart` renders the top N signals sorted by association strength
- `ForestPlotWrapper` renders hazard ratios with CIs for the displayed signals
- A detail table below the charts retains individual pin buttons for each CodeWAS hit

### Key Files (Phase 1b-ii)

```
frontend/src/features/workbench/components/cohort-builder/VennDiagram.tsx          (new)
frontend/src/features/workbench/components/cohort-builder/AttritionFunnel.tsx       (new)
frontend/src/features/workbench/components/cohort-builder/CohortSizeComparison.tsx  (new)
frontend/src/features/workbench/components/cohort-builder/CohortOperationPanel.tsx  (new)
frontend/src/features/workbench/components/codewas/ForestPlotWrapper.tsx            (new)
frontend/src/features/workbench/components/codewas/SignalsBarChart.tsx              (new)
frontend/src/features/workbench/components/panels/PhenotypePanel.tsx                (modified — Validate tab upgraded to use new chart components)
```

---

## Deferred Items

Three visualization features were scoped but deferred due to a data shape limitation in the CO2 backend:

| Feature | Blocker |
|---------|---------|
| **Volcano plot** | CO2 returns `{label, count}` signals — no p-value or OR fields available |
| **TimeCodeWAS heatmap** | Same data shape limitation |
| **Matching panel with love plot** | Phase 2 scope |

The CO2 `codewas_preview` endpoint would need to be extended in the R runtime to return statistical fields (p-value, odds ratio, confidence interval) before these visualizations can be built. Tracked as a Phase 2 dependency.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| `vendor/bin/phpstan analyse` (level 8) | 0 errors on all new files |
| `vendor/bin/pest --filter Investigation` | 15/15 passing (36 assertions) |
| Production deploy | Deployed via `./deploy.sh` |

No new backend code was added in Phase 1b — all backend tests from Phase 1a continue to pass unchanged.

---

## What's Next

### Phase 2 — Clinical Evidence Domain
- Analysis gallery: HADES modules (CohortMethod, PatientLevelPrediction, FeatureExtraction)
- Background execution via Horizon job queue with live status polling
- Result cards pinnable to Evidence Board
- CO2 backend extension to return statistical fields (unblocks volcano plot, TimeCodeWAS heatmap)

### Phase 3 — Genomic Evidence Domain
- Open Targets GraphQL integration (gene-disease associations, drugs, pathways)
- GWAS Catalog REST (top associations, studies by trait)
- Risteys API (FinnGen endpoint statistics, correlations)
- GWAS summary stats upload + local query

### Phase 4 — Synthesis + Export
- PDF export (Evidence Dossier)
- JSON export (machine-readable)
- Shareable link (read-only investigation view)
- Colocalization import (coloc2/HyPrColoc output)
- Split-pane view (Clinical | Genomic side by side)
- Collaboration (shared investigations, comments)
- Matching panel with love plot (deferred from Phase 1b)
