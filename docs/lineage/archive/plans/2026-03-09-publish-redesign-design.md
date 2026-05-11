# Publish Feature Redesign — Pre-Publication Document & Diagram Generator

**Date:** 2026-03-09
**Status:** Approved

## Goal

Transform the Publish page from a basic study-centric report exporter into a full pre-publication tool that helps researchers create journal-ready manuscripts with AI-generated narrative, publication-quality diagrams, and flexible export formats.

## Architecture

Hybrid approach: frontend provides interactive editing and live preview; backend handles final document assembly and export. The AI service (Abby) generates draft prose for Methods, Results, and Discussion sections. Diagrams are rendered client-side as D3/SVG and passed to the backend for embedding in exports.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | Unified picker (studies + standalone analyses) | Researchers run analyses outside studies; mixed selection is common |
| AI involvement | Hybrid toggle (prose vs. structured data per section) | Some researchers want drafts, others want raw data |
| Diagrams | CONSORT, Forest Plot, KM Curves, Attrition — all four | All are standard in OHDSI publications |
| Export formats | DOCX + PDF + Individual Figures (SVG/PNG) | Journals require DOCX manuscript + separate figure uploads |
| Templates | Extensible template system, ship with Generic OHDSI | Avoids journal-specific rabbit hole; architecture supports future templates |
| Persistence | Stateless (no DB tables) | Reads existing analyses/executions; no need to persist drafts |

---

## 1. Page Structure & Workflow

4-step wizard replacing the current 3-step flow:

### Step 1 — Select Analyses (Unified Picker)

Two tabs:
- **From Studies** — Study cards with expandable execution lists (similar to current)
- **All Analyses** — Filterable table of all analysis executions, grouped by type (Estimation, Prediction, Characterization, SCCS, Evidence Synthesis, Incidence Rate, Pathways)

Researchers can mix and match selections across tabs. A sidebar "cart" persists selections across tab switches.

### Step 2 — Configure Document

Section editor with drag-and-drop reordering. Auto-generated sections based on selected analyses:
- **Title Page** — Editable title, author list, date
- **Methods** — One per unique analysis design (deduplicated across shared parameters)
- **Results** — One per selected execution, with AI narrative toggle (prose vs. structured data)
- **Diagrams** — Auto-detected by analysis type (CONSORT for cohort-based, forest plots for estimation/evidence synthesis, KM curves for time-to-event, attrition for cohort definitions)
- **Discussion** — AI-generated interpretation (optional, toggleable)

Each section: include/exclude toggle, AI narrative toggle, inline editing for AI text. Template selector dropdown (v1: "Generic OHDSI Publication" only).

### Step 3 — Preview

Full document preview in white "paper" container. Live-rendered SVG diagrams, editable AI narrative sections, auto-calculated section and figure numbering.

### Step 4 — Export

Format picker:
- **DOCX** — Server-side via PhpWord, downloaded as file
- **PDF** — Server-side via DOMPDF, downloaded as file
- **Individual Figures** — Client-side SVG extraction, zip download if multiple

---

## 2. AI Narrative Engine

Uses Abby (FastAPI AI service) with section-specific system prompts.

### Flow
1. Researcher toggles AI narrative on a section
2. Frontend sends analysis parameters + results JSON to `POST /api/v1/publish/narrative`
3. Laravel proxies to AI service with section-specific prompt
4. AI returns prose; frontend renders as editable text in `AiNarrativeBlock`
5. Researcher can regenerate, edit inline, or switch back to structured view

### Section Prompts

| Section | Input | Output |
|---------|-------|--------|
| Methods | Analysis type, cohort definitions, covariates, time-at-risk, matching, model settings | 2-3 paragraphs of journal-ready study design description |
| Results | Execution results JSON (HR, CI, p-values, counts, AUC, etc.) | 1-2 paragraphs interpreting results with proper statistical language |
| Discussion | All results + analysis parameters combined | 2-3 paragraphs on clinical significance, limitations |
| Figure Captions | Diagram type + underlying data | One-sentence caption per figure |

### Guardrails
- AI text marked with "AI Draft" badge — researchers know what needs review
- System prompts enforce hedging language ("suggests," "is associated with") — no causal claims
- No fabricated citations — model only references provided data
- Researchers must accept or edit AI text before export (confirmation step)
- Uses whatever AI provider is active in admin settings (Ollama/MedGemma default)

---

## 3. Diagram Generation

Four publication-quality diagram types, all rendered as D3/SVG.

### CONSORT Flow Diagram
- **Input:** Cohort definition criteria (Circe JSON) + generation result counts
- **Output:** Standard CONSORT flowchart (enrollment → allocation → follow-up → analysis)
- **Rendering:** D3.js custom hierarchical layout

### Forest Plot
- **Input:** Estimation/evidence synthesis results (effect sizes, CIs, source names)
- **Output:** Point estimates with CI whiskers, diamond for pooled, I-squared annotation
- **Rendering:** D3.js

### Kaplan-Meier Survival Curves
- **Input:** Time-to-event data (survival probabilities for target vs. comparator)
- **Output:** Step-function curves with risk table, censoring marks, CI bands
- **Rendering:** D3.js step-line chart

### Cohort Attrition Diagram
- **Input:** Cohort criteria + inclusion rule counts
- **Output:** Horizontal funnel showing population reduction per criteria step
- **Data:** `cohort_inclusion_stats` table
- **Rendering:** D3.js horizontal bar/funnel

### Shared Infrastructure
- All diagrams are React components wrapping D3 SVG rendering
- Self-contained `<svg>` elements with data props
- `DiagramWrapper` provides figure numbering, AI caption, per-figure export buttons
- SVG serialized for vector export; rasterized via canvas for PNG
- Backend receives SVG markup for DOCX/PDF embedding

---

## 4. Backend Export Pipeline

### New Endpoints

**`POST /api/v1/publish/narrative`** — AI text generation
```
Request:  { section_type, analysis_id?, execution_id?, context: {} }
Response: { text: "Generated prose...", section_type }
```

**`POST /api/v1/publish/export`** — Document assembly + download
```
Request: {
  template: "generic-ohdsi",
  format: "docx" | "pdf" | "figures-zip",
  title, authors,
  sections: [
    { type, content, included, svg?, caption? }
  ]
}
Response: File download (docx/pdf/zip)
```

### Backend Flow
1. `PublicationController@export` validates request via `PublicationRequest`
2. `PublicationService` orchestrates:
   - Narrative sections: uses researcher's edited text (already finalized)
   - Diagrams: SVG from frontend → PNG via Imagick (for DOCX embedding)
   - Fresh AI text (if any): calls AI service
3. Format-specific exporter:
   - `DocxExporter` — PhpWord: headings, paragraphs, embedded images, figure numbering, page breaks
   - `PdfExporter` — DOMPDF: HTML template rendering
   - `FiguresExporter` — Zip archive of SVG/PNG files

### New Backend Files
- `app/Http/Controllers/Api/V1/PublicationController.php`
- `app/Http/Requests/PublicationRequest.php`
- `app/Services/Publication/PublicationService.php`
- `app/Services/Publication/Exporters/DocxExporter.php`
- `app/Services/Publication/Exporters/PdfExporter.php`
- `app/Services/Publication/Exporters/FiguresExporter.php`

### Dependencies
- `phpoffice/phpword` (MIT) — DOCX generation
- Imagick PHP extension (already in Docker image) — SVG→PNG

---

## 5. Frontend Component Architecture

```
frontend/src/features/publish/
  pages/
    PublishPage.tsx                — 4-step wizard shell
  components/
    UnifiedAnalysisPicker.tsx      — Step 1: tabbed picker (Studies / All Analyses)
    AnalysisPickerCart.tsx          — Sidebar showing selected items
    DocumentConfigurator.tsx        — Step 2: section editor with drag-and-drop
    SectionEditor.tsx               — Individual section with AI toggle + inline edit
    DocumentPreview.tsx             — Step 3: full paper preview
    ExportPanel.tsx                 — Step 4: format picker + download triggers
    diagrams/
      ConsortDiagram.tsx            — CONSORT flow diagram (D3 + SVG)
      ForestPlot.tsx                — Forest plot (D3 + SVG)
      KaplanMeierCurve.tsx          — KM survival curve (D3 + SVG)
      AttritionDiagram.tsx          — Cohort attrition funnel (D3 + SVG)
      DiagramWrapper.tsx            — Shared: figure numbering, caption, export buttons
    narrative/
      AiNarrativeBlock.tsx          — AI text with edit/regenerate/accept controls
      StructuredDataBlock.tsx       — Tabular data view (non-AI alternative)
  hooks/
    usePublishWorkflow.ts           — Wizard state management
    useNarrativeGeneration.ts       — TanStack mutation for AI text
    useDocumentExport.ts            — TanStack mutation for export
    useAnalysisPicker.ts            — Query hook for analyses + executions
  api/
    publishApi.ts                   — API client functions
  types/
    publish.ts                      — Updated types
  templates/
    generic-ohdsi.ts                — Template definition (section order, formatting)
```

### Key Decisions
- Diagram components are reusable (can be imported by analysis detail pages later)
- `AiNarrativeBlock` state machine: `idle` → `generating` → `draft` → `accepted`
- Drag-and-drop via `@dnd-kit/core` (lightweight React DnD)
- D3 renders into React refs (no direct DOM manipulation outside ref container)

---

## 6. Data Flow

```
Step 1: UnifiedAnalysisPicker
  GET /api/v1/studies                          (existing)
  GET /api/v1/analyses                         (existing, all types)
  GET /api/v1/analyses/{id}/executions         (existing)
  → User selects executions across studies/standalone

Step 2: DocumentConfigurator
  Auto-generates sections from selected executions
  POST /api/v1/publish/narrative               (NEW — AI text)
  → User edits, reorders, toggles sections

Step 3: DocumentPreview
  Renders full document (narrative + D3/SVG diagrams)
  AI confirmation check before proceeding

Step 4: ExportPanel
  DOCX: POST /api/v1/publish/export            (NEW — server-side)
  PDF:  POST /api/v1/publish/export             (NEW — server-side)
  Figures: Client-side SVG extraction → zip
  → Downloaded publication-ready document
```

**New API endpoints:** 2 (`/publish/narrative`, `/publish/export`)
**New database tables:** 0 (stateless — reads existing data)
**New PHP packages:** 1 (`phpoffice/phpword`)
**New npm packages:** 1 (`@dnd-kit/core`)
