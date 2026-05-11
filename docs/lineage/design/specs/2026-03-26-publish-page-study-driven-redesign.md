# Publish Page: Study-Driven Manuscript Redesign

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Frontend only — no backend API changes required

## Problem

The current Publish page (4-step wizard) picks analyses individually and organizes the manuscript by analysis type (one Methods section per type, one Results section per execution). This produces repetitive, fragmented documents — e.g., 4 separate "Results: Incidence Rate" sections instead of one unified "Seizure Incidence by Genotype" table. It doesn't leverage study context to group results into a coherent clinical narrative.

## Goals

1. Enable study-driven manuscript composition: select a study, get all its completed analyses as a manuscript bundle
2. Organize manuscript by research question, not analysis type — matching real journal paper structure
3. Render rich results: structured data tables + AI narrative + diagrams per section
4. Add entry point from Study detail page for discoverability
5. Keep existing individual analysis picking as a secondary workflow

## Non-Goals

- Backend API changes (all data already available via existing endpoints)
- New export formats (DOCX/PDF/figures-zip unchanged)
- New diagram types (existing ForestPlot, KaplanMeierCurve, AttritionDiagram, ConsortDiagram sufficient)
- Changes to AI narrative generation API

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | Standalone `/publish` + "Generate Manuscript" button on Study detail | Best discoverability — researchers find it where they're looking at results |
| Manuscript structure | Research-question sections | Matches NEJM/Lancet paper structure — grouped by clinical question, not statistical method |
| Step 1 selection | Hybrid tabs with "Select All" per study | Least disruptive UX change; keeps individual picking for power users |
| Results rendering | Tables + Narrative + Diagrams per section | Matches real journal papers — Table presents data, narrative interprets, figure visualizes |

## Architecture

### Entry Points

1. **Standalone** — `/publish` route, unchanged. User navigates to Publish, picks analyses via either tab.
2. **Study detail** — New "Generate Manuscript" button on the Study detail page. Navigates to `/publish?studyId={id}`, which auto-selects all completed analyses from that study on mount.

### Step 1: Select Analyses (Enhanced)

**"All Analyses" tab** — Unchanged. Individual analysis picking with search and type filter.

**"From Studies" tab** — Enhanced with:
- "Select All Completed" button per study (replaces expand → click each one)
- Study card shows completion summary: "8 of 10 analyses completed"
- Clicking "Select All" bulk-adds all completed analyses with `studyId` and `studyTitle` metadata
- Individual checkboxes still available within expanded study for granular control
- "Deselect All" toggle when all are already selected

**URL parameter** — When `?studyId=X` is present:
- Auto-switch to "From Studies" tab
- Auto-expand and select all completed analyses from that study
- User can modify selections before proceeding

### Step 2: Configure (Redesigned Section Builder)

Replace `buildSectionsFromExecutions()` with `buildManuscriptSections()`:

```typescript
function buildManuscriptSections(executions: SelectedExecution[]): ReportSection[] {
  // 1. Introduction (always present, editable, AI-generatable)
  // 2. Methods (unified — merges design_json from all analysis types)
  // 3. Results subsections — one per research-question group:
  //    - Population Characteristics (characterization analyses)
  //    - Incidence Rates (incidence_rate analyses → consolidated table)
  //    - Treatment Patterns (pathway analyses)
  //    - Comparative Effectiveness (estimation analyses → HR table + forest plot + KM + attrition)
  //    - Safety Analysis (sccs analyses → IRR table)
  //    - Predictive Modeling (prediction analyses)
  //    - Evidence Synthesis (evidence_synthesis analyses)
  // 4. Discussion (AI-synthesized across all results)
}
```

**Grouping logic:** Analyses are grouped by `analysisType` into research-question sections. Each group maps to a predefined section title:

| analysisType | Section Title | Table Type | Diagram |
|-------------|--------------|------------|---------|
| `characterizations` | Population Characteristics | Cohort comparison table | Attrition |
| `incidence_rates` | Incidence Rates | Rate comparison table (all cohorts consolidated) | None |
| `estimations` | Comparative Effectiveness | Hazard ratio table | Forest plot + KM curve + Attrition |
| `pathways` | Treatment Patterns | Top pathways summary table | None |
| `sccs` | Safety Analysis | IRR table | None |
| `predictions` | Predictive Modeling | Performance metrics table | KM curve |
| `evidence_synthesis` | Evidence Synthesis | Pooled estimates table | Forest plot |

**Section data model extension:**

```typescript
interface ReportSection {
  // ... existing fields ...
  tableData?: TableData;          // Structured data for auto-generated table
  tableIncluded?: boolean;        // Toggle table visibility (default: true)
  narrativeIncluded?: boolean;    // Toggle narrative visibility (default: true)
  diagramIncluded?: boolean;      // Toggle diagram visibility (default: true)
}

interface TableData {
  caption: string;                // "Table 1: Seizure incidence rates by genotype"
  headers: string[];              // Column headers
  rows: Array<Record<string, string | number>>;  // Row data
  footnotes?: string[];           // Table footnotes
}
```

**Table generation:** A new `buildTableFromResults()` function extracts structured table data from `result_json` for each analysis type:

- **Incidence rates:** Consolidates all IR executions into one table with columns: Genotype, Events, Person-Years, Rate/1000PY, 95% CI
- **Estimation:** Extracts HR, CI, p-value, and event counts per outcome
- **SCCS:** Extracts IRR, CI per exposure window
- **Pathways:** Top 10 pathways with patient counts and percentages
- **Characterization:** Cohort sizes, demographics, SMD values

Title, authors, template selector, and DnD section reordering remain unchanged.

### Step 3: Preview (Enhanced Rendering)

**New `ResultsTable` component** renders `TableData` as a publication-style HTML table within the white paper preview:
- Georgia/serif font matching the document
- Proper table borders (top/bottom rules, no vertical lines — journal style)
- Auto-numbered: "Table 1:", "Table 2:", etc.
- Footnotes below table
- Responsive within the 816px paper width

**Section rendering order within each results subsection:**
1. Section heading (e.g., "3.2 Seizure Incidence by Genotype")
2. Table (if `tableIncluded`)
3. Narrative text (if `narrativeIncluded`)
4. Diagram/figure (if `diagramIncluded`)

Each element has an eye icon toggle in the configure step to include/exclude independently.

**Existing components unchanged:** `ForestPlot`, `KaplanMeierCurve`, `AttritionDiagram`, `ConsortDiagram`, `DiagramWrapper`.

### Step 4: Export

No changes. The export pipeline already handles sections generically — tables render as HTML within sections, diagrams serialize as SVG, narrative as text.

### Study Detail Integration

Add to `StudyDetailPage` (or its results/analyses tab):

```tsx
<button onClick={() => navigate(`/publish?studyId=${study.id}`)}>
  Generate Manuscript
</button>
```

Visible when study has at least 1 completed analysis. Uses existing `FileOutput` icon for consistency with the Publish nav item.

## Component Inventory

### New Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `ResultsTable` | `publish/components/ResultsTable.tsx` | Renders `TableData` as publication-style HTML table |
| `ManuscriptSection` | `publish/components/ManuscriptSection.tsx` | Wraps table + narrative + diagram with independent toggles |

### Modified Components
| Component | Changes |
|-----------|---------|
| `PublishPage.tsx` | Add `buildManuscriptSections()`, handle `?studyId` URL param, add Introduction section |
| `UnifiedAnalysisPicker.tsx` | Add "Select All Completed" / "Deselect All" button per study in studies tab |
| `DocumentPreview.tsx` | Render `ResultsTable` within sections, auto-number tables and figures |
| `SectionEditor.tsx` | Add toggle controls for table/narrative/diagram visibility per section |
| `DocumentConfigurator.tsx` | Pass new toggle handlers through to SectionEditor |

### Unchanged Components
| Component | Why |
|-----------|-----|
| `ExportPanel.tsx` | Generic section export — no changes needed |
| `AnalysisPickerCart.tsx` | Cart display — works with existing SelectedExecution type |
| All diagram components | Render from existing data shapes |
| `publishApi.ts` | All API endpoints already exist |
| `useNarrativeGeneration.ts` | AI generation unchanged |
| `useDocumentExport.ts` | Export hook unchanged |

### New Utility
| Utility | Location | Purpose |
|---------|----------|---------|
| `buildTableFromResults` | `publish/lib/tableBuilders.ts` | Extracts `TableData` from `result_json` per analysis type |

## Types Changes

```typescript
// publish/types/publish.ts — additions only

interface TableData {
  caption: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  footnotes?: string[];
}

// Extended ReportSection (add optional fields)
interface ReportSection {
  // ... all existing fields preserved ...
  tableData?: TableData;
  tableIncluded?: boolean;
  narrativeIncluded?: boolean;
  diagramIncluded?: boolean;
}
```

## Data Flow

```
User selects study (or navigates via ?studyId=X)
  → "Select All Completed" loads all SelectedExecution[] with result_json + design_json
  → buildManuscriptSections() groups by analysisType into research-question sections
  → buildTableFromResults() extracts TableData per section from result_json
  → Each section: { tableData, narrativeSlot (empty), diagramType, toggles }
  → User configures: edit title/authors, reorder sections, toggle table/narrative/diagram
  → AI generates narrative per section (existing mutation)
  → Preview renders: heading → table → narrative → diagram per section
  → Export serializes all included content
```

## Edge Cases

1. **Study with only one analysis type** — Manuscript still works; just fewer results subsections. Introduction + Methods + one Results subsection + Discussion.
2. **No result_json on an execution** — Table renders "No structured data available" placeholder. Narrative and diagram still work.
3. **Mixed study + individual analyses** — `buildManuscriptSections()` groups all selected executions regardless of source. Cross-study analyses merge into the same research-question sections by type.
4. **studyId URL param for non-existent study** — Falls back to empty selection, no error. Studies tab loads normally.
5. **Analysis types with no table builder** — Falls back to raw JSON display or empty table. Narrative and diagram unaffected.

## Testing

- Unit tests for `buildManuscriptSections()` with various analysis type combinations
- Unit tests for `buildTableFromResults()` with real result_json shapes from each analysis type
- Component test for `ResultsTable` rendering
- E2E test: select study → configure → preview shows tables + diagrams → export
