# Publish Page: Study-Driven Manuscript Redesign

**Date:** 2026-03-27
**Status:** Deployed to production
**Scope:** Full-stack — frontend (React), backend (Laravel), AI integration (Claude API)

## Summary

Redesigned the Publish page from a basic analysis-by-analysis picker into a study-driven manuscript composition tool that produces publication-quality documents structured by research question, with AI-generated narratives powered by Claude, auto-generated data tables, and interactive diagrams.

## What Changed

### Before
- Pick individual analyses one at a time
- Manuscript organized by analysis TYPE (one "Methods" per type, one "Results" per execution)
- AI narratives via local MedGemma 4B (couldn't handle complex evidence synthesis)
- No data tables in preview or export
- No diagrams from real result data
- Single "Generic OHDSI Publication" template
- State lost when navigating between steps

### After
- **Study-first workflow**: "Select All" per study, `?studyId=X` URL auto-selection, "Generate Manuscript" button on Study detail page
- **Research-question structure**: Introduction → Methods → Results subsections grouped by clinical question → Discussion
- **8 publication templates**: Generic OHDSI, NEJM, Lancet, JAMIA, Comparative Effectiveness, Incidence Report, Study Protocol/SAP, HIMSS Poster
- **AI narratives via Claude**: `AnalyticsLlmService` with journal-quality system prompts, result summarization for large blobs, plain-text output
- **Auto-generated data tables**: 7 analysis types (IR with 95% CI, estimation HR, SCCS IRR, pathways, characterization demographics, prediction performance, evidence synthesis)
- **Interactive diagrams**: Forest plots, Kaplan-Meier survival curves, attrition diagrams — all from real result_json data
- **Table + narrative + diagram per section**: Each independently toggleable with teal toggle buttons
- **Session persistence**: Wizard state saved to sessionStorage
- **Export with tables**: DOCX (PhpWord tables), PDF (DomPDF with publication CSS), figures-zip

## Architecture

### Frontend
- `PublishPage.tsx` — 4-step wizard with `useReducer` + sessionStorage persistence
- `buildManuscriptSections()` — template-driven section builder, groups executions by analysis type
- `tableBuilders.ts` — 7 per-type extractors aligned to real `result_json` field names
- `diagramBuilders.ts` — transforms raw estimation/characterization data into ForestPlot/KM/Attrition component shapes
- `ResultsTable.tsx` — publication-style HTML table (journal rules, auto-numbered)
- `TagFilterBar.tsx` + `TagSearchModal.tsx` — shared tag declutter components (also deployed to Cohort Definitions and Concept Sets pages)
- `templates/*.ts` — 8 template configs with section definitions, `usesResults` flag, `preferredAnalysisTypes` filter

### Backend
- `PublicationController.php` — switched from `AiService::abbyChat()` to `AnalyticsLlmService::chat()` with separate system/user prompts
- `summarizeContext()` — reduces 300KB characterization blobs to ~10KB (top 5 features per category, SMD pairs, strata)
- `DocxExporter.php` — added `addTable()` with PhpWord Table API, uses section titles instead of hardcoded type names
- `PdfExporter.php` — added `buildTableHtml()` with publication CSS, installed DomPDF
- `StudyAnalysis.php` — `CLASS_TO_SHORT_TYPE` map normalizes morph class names to API short names
- `StudyController.php` — `include=analyses` param eager-loads analyses with executions for publish workflow

### Data Flow
```
User selects study → "Select All" loads executions with result_json + design_json
  → Template selected (8 options)
  → buildManuscriptSections() creates template-driven section structure
  → tableBuilders extract structured tables from result_json
  → diagramBuilders transform data into component-compatible shapes
  → AI generates narratives per section via Claude (with summarized context)
  → Preview renders tables + narratives + diagrams in white paper container
  → Export serializes to DOCX/PDF with tables, or figures-zip with SVGs
```

## Templates

| Template | Sections | Use Case |
|----------|----------|----------|
| Generic OHDSI | Intro → Methods → Results → Discussion | Multi-analysis studies |
| NEJM Style | Intro → Methods → Design & Oversight → Patients → End Points → Stats → Results → Discussion | Clinical impact papers |
| Lancet Style | Intro → Methods → Design & Participants → Procedures → Outcomes → Stats → Funding → Results → Discussion | Global health studies |
| JAMIA Style | Background → Objective → Materials → Data Sources → Phenotypes → Stats → Results → Discussion → Limitations → Conclusion | Informatics methodology |
| Comparative Effectiveness | Background → Methods → Results (estimation/SCCS focused) → Sensitivity → Discussion | PS matching studies |
| Incidence Report | Background → Methods → Results (IR focused) → Discussion | Epidemiological reports |
| Study Protocol / SAP | Objectives → Hypotheses → Design → Sources → Cohorts → Analysis Plan → Timeline | Pre-study documents |
| HIMSS Poster | Background → Problem → Objectives → Methods → Results → Key Findings → Impact → Next Steps | Conference posters |

## Key Debugging Insights

- **result_json field names** vary by analysis type and don't match generic assumptions. Estimation uses `hazard_ratio` not `hr`, `target_outcomes` not `event_count`. Pathways use `path[]` array not `pathway_name`. SCCS uses `covariate` not `window_name`. Characterization demographics use `category: "FEMALE"` not `concept_name`.
- **Morph class names** (`App\Models\App\IncidenceRateAnalysis`) must be normalized to short API names (`incidence_rate`) for frontend type matching.
- **Large result_json** (300KB+ for characterizations) must be summarized before sending to LLM — top features per category, SMD pairs, not raw feature arrays.
- **DomPDF** was not installed — PDF export silently fell back to raw HTML download.
- **Narrative generation** was completely disconnected — `handleGenerateNarrative` in DocumentConfigurator was a no-op. The real mutation in PublishPage was never wired through.

## Files Modified/Created

### New Files (15)
- `frontend/src/features/publish/lib/tableBuilders.ts`
- `frontend/src/features/publish/lib/diagramBuilders.ts`
- `frontend/src/features/publish/components/ResultsTable.tsx`
- `frontend/src/features/publish/templates/comparative-effectiveness.ts`
- `frontend/src/features/publish/templates/incidence-report.ts`
- `frontend/src/features/publish/templates/study-protocol.ts`
- `frontend/src/features/publish/templates/jamia-style.ts`
- `frontend/src/features/publish/templates/nejm-style.ts`
- `frontend/src/features/publish/templates/lancet-style.ts`
- `frontend/src/features/publish/templates/himss-poster.ts`
- `frontend/src/components/ui/TagFilterBar.tsx`
- `frontend/src/components/ui/TagSearchModal.tsx`
- `docs/superpowers/specs/2026-03-26-publish-page-study-driven-redesign.md`
- `docs/superpowers/plans/2026-03-26-publish-page-study-driven-redesign.md`
- `docs/devlog/modules/publish/2026-03-27-publish-page-study-driven-redesign.md`

### Modified Files (15+)
- `frontend/src/features/publish/pages/PublishPage.tsx`
- `frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx`
- `frontend/src/features/publish/components/DocumentPreview.tsx`
- `frontend/src/features/publish/components/DocumentConfigurator.tsx`
- `frontend/src/features/publish/components/SectionEditor.tsx`
- `frontend/src/features/publish/components/ExportPanel.tsx`
- `frontend/src/features/publish/api/publishApi.ts`
- `frontend/src/features/publish/types/publish.ts`
- `frontend/src/features/publish/templates/index.ts`
- `frontend/src/features/publish/templates/generic-ohdsi.ts`
- `frontend/src/features/studies/pages/StudyDetailPage.tsx`
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`
- `frontend/src/features/concept-sets/pages/ConceptSetsPage.tsx`
- `frontend/src/features/administration/pages/AdminDashboardPage.tsx`
- `backend/app/Http/Controllers/Api/V1/PublicationController.php`
- `backend/app/Http/Controllers/Api/V1/StudyController.php`
- `backend/app/Http/Requests/PublicationExportRequest.php`
- `backend/app/Models/App/StudyAnalysis.php`
- `backend/app/Services/Publication/Exporters/DocxExporter.php`
- `backend/app/Services/Publication/Exporters/PdfExporter.php`

## Stats

- **55+ commits** in one session
- **5,000+ lines added**, ~700 removed
- Zero backend API additions (all existing endpoints, new query params only)
- 36/36 existing tests pass
