# Abby Sidebar Context Expansion

**Date:** 2026-04-03
**Module:** Abby AI
**Type:** Enhancement

## Summary

Expanded Abby AI sidebar page context from 22 route patterns to 42, covering every routed page in Parthenon. Previously, 57 pages fell through to the generic "General" context with no page-specific suggestions. Now every page gets tailored suggestion prompts when the user opens Abby.

## Changes

### Route Context Map (`useAbbyContext.ts`)

Added 20 new route-to-context mappings:

| Route | Context Key | Label |
|-------|-------------|-------|
| `/patient-similarity` | patient_similarity | Patient Similarity |
| `/risk-scores` | risk_scores | Risk Scores |
| `/standard-pros` | standard_pros | Standard PROs+ |
| `/morpheus` | morpheus | Morpheus |
| `/commons` | commons | Commons |
| `/phenotype-library` | phenotype_library | Phenotype Library |
| `/workbench` | workbench | Workbench |
| `/study-packages` | study_packages | Study Packages |
| `/study-designer` | studies | Study Designer |
| `/mapping-assistant` | mapping_assistant | Mapping Assistant |
| `/jobs` | jobs | Jobs |
| `/gis` | gis | GIS Explorer |
| `/query-assistant` | query_assistant | Query Assistant |
| `/publish` | publish | Publish |
| `/settings` | settings | Settings |
| `/jupyter` | jupyter | Jupyter |
| `/source-profiler` | etl_tools | Source Profiler |
| `/fhir-ingestion` | etl_tools | FHIR Ingestion |
| `/etl-tools` | etl_tools | ETL Tools |
| `/care-gaps` | care_gaps | Care Gaps (fix) |

### Suggestion Prompts (`AbbyPanel.tsx`)

Added 17 new `CONTEXT_SUGGESTIONS` entries (2-3 prompts each) and matching `CONTEXT_LABELS`. Each prompt is domain-specific:

- **Patient Similarity**: similarity search mechanics, feature selection, cross-database comparison
- **Risk Scores**: available scores, Charlson CCI calculation, cohort-level analysis
- **Standard PROs+**: instrument library, survey administration, scoring algorithms
- **Morpheus**: patient journey visualization, clinical timelines, inpatient data sources
- **Commons**: workspace overview, cohort sharing, real-time collaboration
- **Phenotype Library**: OHDSI phenotype library, import workflow, validation
- **Workbench**: investigation creation, analysis organization, study components
- **Study Packages**: package definition, multi-site export, artifact contents
- **Mapping Assistant**: AI-assisted mapping, review workflow, target vocabularies
- **Jobs**: queue monitoring, job types, retry/cancel operations
- **GIS Explorer**: geospatial analyses, data loading, spatial visualization
- **Query Assistant**: custom SQL, available schemas, Abby query help
- **Publish**: results publication, export formats, manuscript generation
- **Settings**: profile updates, notification preferences
- **Jupyter**: notebook launch, Python packages, OMOP database access
- **ETL Tools**: source profiling, WhiteRabbit workflow, FHIR ingestion

### Bug Fix

The route map previously only matched `/care-bundles/` for care gaps, but the actual route is `/care-gaps/`. Added `/care-gaps/` as the primary match and kept `/care-bundles/` as a legacy fallback.

## Verification

- All 38 unique context keys are consistent across `ROUTE_CONTEXT_MAP`, `CONTEXT_SUGGESTIONS`, and `CONTEXT_LABELS`
- TypeScript compiles clean (`tsc --noEmit` passes)
- Only auth pages (`/login`, `/register`), public pages (`/shared/:token`, `/survey/:token`), and `finngen-tools` remain without specific context (intentional — auth/public pages don't render Abby, and FinnGen tools is a redirect)

## Files Modified

- `frontend/src/hooks/useAbbyContext.ts` — Route-to-context mapping
- `frontend/src/components/layout/AbbyPanel.tsx` — Suggestion prompts and labels
