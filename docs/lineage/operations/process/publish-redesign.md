# Publish Feature Redesign — Pre-Publication Document Generator

**Date:** 2026-03-09
**Scope:** Complete rewrite of /publish from basic study exporter to full manuscript preparation tool

---

## What Was Built

### Overview
Transformed the Publish page from a 3-step study-centric report exporter into a 4-step pre-publication manuscript tool with AI narrative generation, publication-quality diagrams, and server-side DOCX/PDF export.

### Backend

**New endpoints:**
- `POST /api/v1/publish/narrative` — AI narrative generation (Methods, Results, Discussion, Captions) via Abby/MedGemma with section-specific medical writing prompts
- `POST /api/v1/publish/export` — Server-side document assembly (DOCX via PhpWord, PDF via HTML/DOMPDF, Figures ZIP)

**New files:**
- `PublicationController` — orchestrates AI narrative + export
- `PublicationNarrativeRequest` / `PublicationExportRequest` — validation
- `PublicationService` — format routing
- `DocxExporter` — Times New Roman, 1" margins, title page, embedded SVG→PNG via Imagick
- `PdfExporter` — styled HTML with DOMPDF fallback
- `FiguresExporter` — ZIP archive of SVG files

**Infrastructure:**
- Added `phpoffice/phpword` v1.1.0
- Added Imagick + GD extensions to Docker PHP image

### Frontend

**4-Step Wizard (replacing 3-step):**
1. **Select Analyses** — Unified picker with "All Analyses" and "From Studies" tabs, search, type filter, sidebar cart
2. **Configure Document** — Drag-and-drop section editor (@dnd-kit), title/authors input, AI narrative toggle per section
3. **Preview** — White paper preview with serif font, auto-numbered figures, AI confirmation warning
4. **Export** — DOCX/PDF/Figures-ZIP format picker, server-side download

**AI Narrative Engine:**
- 4-state workflow: idle → generating → draft → accepted
- Section-specific prompts (Methods, Results, Discussion, Captions)
- Hedging language enforced, no fabricated citations
- "AI Draft" badge, must accept before export

**Publication-Quality Diagrams (D3/SVG):**
- Forest Plot — log-scale, weight-sized squares, CI whiskers, pooled diamond
- Cohort Attrition — waterfall bars with exclusion annotations
- CONSORT Flow — standard flowchart (enrollment → allocation → follow-up → analysis)
- Kaplan-Meier — step-function curves with CI bands and risk table

**New dependencies:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

## Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Entry point | Unified picker (studies + standalone) | Researchers run analyses outside studies |
| AI mode | Hybrid toggle per section | Some want drafts, others want raw data |
| Export | Server-side DOCX/PDF | Browser-based DOCX is unreliable |
| Diagrams | D3/SVG client-side | Crisp at any resolution, exportable |
| Persistence | Stateless (no DB tables) | Reads existing analyses; no drafts to save |
| Templates | Extensible, ship with Generic OHDSI | Avoids journal-specific rabbit hole in v1 |

## Files Created (16 frontend + 7 backend)

### Backend
- `app/Http/Controllers/Api/V1/PublicationController.php`
- `app/Http/Requests/PublicationNarrativeRequest.php`
- `app/Http/Requests/PublicationExportRequest.php`
- `app/Services/Publication/PublicationService.php`
- `app/Services/Publication/Exporters/DocxExporter.php`
- `app/Services/Publication/Exporters/PdfExporter.php`
- `app/Services/Publication/Exporters/FiguresExporter.php`

### Frontend
- `features/publish/components/UnifiedAnalysisPicker.tsx`
- `features/publish/components/AnalysisPickerCart.tsx`
- `features/publish/components/DocumentConfigurator.tsx`
- `features/publish/components/SectionEditor.tsx`
- `features/publish/components/DocumentPreview.tsx`
- `features/publish/components/ExportPanel.tsx`
- `features/publish/components/narrative/AiNarrativeBlock.tsx`
- `features/publish/components/narrative/StructuredDataBlock.tsx`
- `features/publish/components/diagrams/DiagramWrapper.tsx`
- `features/publish/components/diagrams/ForestPlot.tsx`
- `features/publish/components/diagrams/AttritionDiagram.tsx`
- `features/publish/components/diagrams/ConsortDiagram.tsx`
- `features/publish/components/diagrams/KaplanMeierCurve.tsx`
- `features/publish/components/diagrams/index.ts`
- `features/publish/hooks/useAnalysisPicker.ts`
- `features/publish/hooks/useNarrativeGeneration.ts`
- `features/publish/hooks/useDocumentExport.ts`
- `features/publish/templates/generic-ohdsi.ts`

## Future Enhancements
- Journal-specific templates (JAMA, NEJM, BMJ, Lancet)
- DOMPDF integration for true server-side PDF
- Persistent draft saving
- Citation management
- Collaborative editing
- LaTeX export
