# Phase 5: Radiogenomics — Genomics-Imaging Integration

**Date:** 2026-03-07
**Status:** Complete

## What Was Built

Phase 5 integrates genomic variant data with imaging outcomes and treatment history into a unified "Precision Oncology" view within the Patient Profile page. This is the first clinical decision support feature that crosses multiple data domains (genomics + imaging + pharmacy) to generate actionable recommendations.

### Backend

1. **variant_drug_interactions table** — Curated reference database of known gene-drug relationships with evidence levels and confidence scores. Migration: `2026_03_07_100001`. Seeded with 11 interactions covering CRC, NSCLC, and melanoma.

2. **VariantDrugInteraction model** — Eloquent model with `is_active` filtering, unique constraint on (gene_symbol, hgvs_p, drug_name).

3. **RadiogenomicsService** — Core integration engine:
   - `getPatientPanel()` — Aggregates variants, imaging, drugs, correlations, and recommendations into a unified panel
   - `buildCorrelations()` — Matches patient variants against the curated interaction database, cross-references with actual treatment history (drug_exposure), and determines if the patient received each drug
   - `buildRecommendations()` — Generates precision oncology recommendations: drugs to avoid (resistance) vs drugs to consider (sensitivity) with rationale

4. **RadiogenomicsController** — Two endpoints:
   - `GET /api/v1/radiogenomics/patients/{personId}` — Full panel
   - `GET /api/v1/radiogenomics/variant-drug-interactions` — Reference lookup (filterable by gene, drug, relationship)

### Frontend

5. **RadiogenomicsTab component** (`features/radiogenomics/components/RadiogenomicsTab.tsx`) — 450+ line React component with 7 sub-components:
   - **PanelSummary** — 7-stat overview cards (variants, pathogenic, VUS, correlations, recommendations, imaging, treatments)
   - **RecommendationsSection** — Expandable cards showing drugs to avoid (red) and consider (teal) per gene/variant
   - **CorrelationsTable** — Full table with expandable rows showing gene, variant, drug, relationship, confidence, whether patient received the drug, and observed response
   - **VariantsSection** — All variants with significance coloring, actionable/VUS status badges
   - **TreatmentHistory** — Drug exposure timeline with duration
   - **ResponseChip** — Color-coded treatment response indicators (CR/PR/SD/PD)

6. **Integration into PatientProfilePage** — Added "Precision Oncology" as a 6th view mode (alongside Timeline, List, Labs, Visits, Eras) with a DNA icon.

7. **API layer** — `radiogenomicsApi.ts`, `useRadiogenomics.ts` hooks, `types/index.ts` — standard TanStack Query pattern.

## Key Design Decisions

- **Phase 5 before Phase 4**: Genomics integration was prioritized over the DICOM viewer phase because genomic data should be part of the treatment response matrix whenever available, and this is increasingly the norm in oncology.
- **Correlation engine is database-driven**: Rather than hardcoding variant-drug relationships, they live in a curated table that can be expanded by domain experts. The service joins patient variants against this reference at query time.
- **Single unified panel endpoint**: One API call returns everything needed for the Precision Oncology view — demographics, variants, imaging, drugs, correlations, and recommendations. This avoids waterfall requests.

## Validation

Tested with MBU patient (person_id=1005788):
- 17 variants loaded (4 pathogenic from FoundationOne NGS report, 13 VUS)
- 7 variant-drug correlations identified (KRAS G12D resistant to cetuximab/panitumumab, sensitive to bevacizumab/FOLFIRI)
- 2 precision recommendations generated
- 5 drug exposures matched (patient actually received FOLFIRI + bevacizumab — consistent with genomic profile)
- 13 imaging studies linked

## Files Changed

### New Files
- `backend/database/migrations/2026_03_07_100001_create_variant_drug_interactions_table.php`
- `backend/app/Models/App/VariantDrugInteraction.php`
- `backend/app/Services/Radiogenomics/RadiogenomicsService.php`
- `backend/app/Http/Controllers/Api/V1/RadiogenomicsController.php`
- `frontend/src/features/radiogenomics/types/index.ts`
- `frontend/src/features/radiogenomics/api/radiogenomicsApi.ts`
- `frontend/src/features/radiogenomics/hooks/useRadiogenomics.ts`
- `frontend/src/features/radiogenomics/components/RadiogenomicsTab.tsx`

### Modified Files
- `backend/routes/api.php` — Added radiogenomics route group
- `frontend/src/features/profiles/pages/PatientProfilePage.tsx` — Added "Precision Oncology" view mode
