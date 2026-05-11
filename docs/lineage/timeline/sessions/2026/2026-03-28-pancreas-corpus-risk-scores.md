# 2026-03-28 — Pancreatic Cancer Corpus + Population Risk Scores

## Summary

Built a research-grade 361-patient pancreatic cancer corpus with full multimodal enrichment, then designed and implemented a cohort-scoped population risk scoring engine (v1 frontend + v2 backend).

## Pancreatic Cancer Corpus

### Phase 1: Clinical Trajectories (189 patients)
- Extended `enrich_cdm.py` to generate full clinical trajectories for 189 patients (21 PANCREAS-CT + 168 CPTAC-PDA)
- 3 clinical subgroups: resectable (35%), borderline (29%), metastatic (35%)
- Per patient: 5-8 visits, CA 19-9/CEA/bilirubin/CBC labs with realistic trends, chemo regimens (FOLFIRINOX/Gem-nab/Gem mono), conditions, procedures, specimens, death
- 4 pre-built cohort definitions with membership in `pancreas_results.cohort`

### Phase 2: Full Multimodal Enrichment (361 patients)
- **TCGA-PAAD expansion**: +172 patients from MAF barcode extraction, total corpus 361
- **DICOM linkage**: 159 Orthanc studies mapped to CDM persons (10 CT + 149 pathology slides)
- **Genomic profiles**: KRAS/TP53/SMAD4/CDKN2A for all 361 patients — real MAF mutations for TCGA-PAAD, synthetic assignment at published frequencies for original cohort
- **Clinical notes**: 1,227 MedGemma-generated notes (consultation, pathology, operative, progress) across all 361 patients
- **5th cohort**: KRAS Mutant PDAC (285/361 = 79%)
- **Achilles**: 128/128 analyses passing
- **E2E verification**: 15 data quality checks, all zero issues, 100% coverage

### Key Data Counts
| Table | Count |
|-------|-------|
| person | 361 |
| visit_occurrence | 2,223 |
| measurement | 24,198 (22,754 clinical + 1,444 genomic) |
| drug_exposure | 11,725 |
| condition_occurrence | 1,325 |
| procedure_occurrence | 146 |
| specimen | 507 |
| death | 273 (76% mortality) |
| note | 1,227 |
| imaging_studies | 159 |
| condition_era | 1,325 |
| drug_era | 1,511 |

## Population Risk Scores

### v1 Frontend
- Catalogue page at `/risk-scores` with 20 score cards grouped by 6 clinical categories
- Source-aware cards (3 states: no source, eligible/run, has results)
- Achilles-pattern run modal with progress display
- Detail page with tier breakdown charts (Recharts) and summary stats
- Eligibility pre-flight endpoint for CDM data availability check

### v1 Issues Discovered
- **Wrong concept IDs**: 10/20 scores used hallucinated concept IDs (e.g., 4178681 = "Dermatological complication" used for "malignancy")
- **"Run All" antipattern**: Running CHADS2-VASc on a cancer cohort is clinically meaningless
- **Exact matches**: Scores used `condition_concept_id = X` instead of `concept_ancestor` descendant lookups

### v2 Backend Architecture
- **Cohort-scoped**: Scores run against target cohorts via `results.cohort` JOIN, not entire source
- **Recommendation-driven**: `RiskScoreRecommendationService` profiles cohort and recommends applicable scores
- **Vocab-validated**: `ConceptResolutionService` resolves ancestors to descendants at runtime via `concept_ancestor`, cached 1 hour
- **Patient-level**: Individual scores stored in `risk_score_patient_results`, not just population summaries
- **Pure compute**: `PopulationRiskScoreV2Interface` with `compute()` method — no SQL templates, testable with mock data
- **Charlson CCI v2**: Proof of concept with 17 verified ancestor concept IDs. Result: 226 low (CCI=2) + 135 moderate (CCI=3) on pancreas corpus

### New Tables
- `app.risk_score_analyses` — analysis definitions with `design_json`
- `app.risk_score_run_steps` — per-score execution tracking
- `app.risk_score_patient_results` — patient-level scores

### New Endpoints
- `POST /sources/{source}/risk-scores/recommend` — cohort-aware score recommendations
- `POST /risk-score-analyses` — create analysis
- `POST /risk-score-analyses/{id}/execute` — run on source
- `GET /risk-score-analyses/{id}/executions/{id}` — results with population summaries
- `GET /risk-score-analyses/{id}/executions/{id}/patients` — patient-level drill-through

## Blog Post
- Published "Building a Clinically Intelligent Risk Scoring Engine on OMOP CDM" to Docusaurus
- Includes Tyche artwork and mythology introduction
- Covers the v1→v2 journey: hallucinated concepts, "Run All" antipattern, cohort-scoped redesign

## Remaining Work
- Risk Scores v2 Phases C+D: Frontend for cohort-scoped analysis creator and results
- Risk Scores v2 Phase E: Migrate remaining 19 scores to v2 interface
- Cohort builder integration: risk scores as inclusion criteria

## Lesson Learned
**Never hardcode OMOP concept IDs from training data.** Always query `vocab.concept` to verify. The Charlson CCI scored 0.37 for a cancer cohort because concept 4178681 was "Dermatological complication of procedure", not "malignancy." Saved as memory: `feedback_risk_score_concepts.md`.
