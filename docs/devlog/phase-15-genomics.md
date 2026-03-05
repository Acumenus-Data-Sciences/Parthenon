# Phase 15 — Molecular Diagnostics & Cancer Genomics

**Version target:** 1.1.0
**Devlog started:** March 5, 2026

---

## §15.1 — Genomics Data Layer (Complete)

**What was built:**

### Database Migrations (Docker parthenon DB)
Three app-layer tables:
- `genomic_uploads` — tracks VCF/MAF/FHIR file uploads with status lifecycle (pending → parsing → mapped → review → imported → failed)
- `genomic_variants` — parsed variant staging table with full coordinates (CHROM, POS, REF, ALT), gene annotations (HGVS c./p., SnpEff/VEP consequence), clinical annotation (ClinVar, COSMIC), quality metrics (AF, DP, zygosity), and OMOP mapping fields (measurement_concept_id, mapping_status, omop_measurement_id)
- `genomic_cohort_criteria` — saved genomic filter criteria for the cohort builder (gene_mutation, TMB, MSI, fusion, pathogenicity, treatment_episode types)

### Backend Models
- `GenomicUpload` — BelongsTo Source/User, HasMany GenomicVariant
- `GenomicVariant` — BelongsTo GenomicUpload/Source; full OMOP measurement mapping fields
- `GenomicCohortCriterion` — criteria_definition stored as JSONB for flexible filter specs

### VcfParserService
PHP service parsing:
- **VCF 4.1/4.2** — parses META lines (genome build detection), header, data records
  - INFO field parser (key=value pairs)
  - SnpEff ANN= field parser (gene, HGVS c./p., consequence)
  - VEP CSQ= field parser (gene, HGVS, consequence)
  - FORMAT/sample GT parser (zygosity from alleles, AF from AD or AF field, DP)
  - Auto-detects genome build from ##reference lines
- **MAF/cBioPortal MAF** — column header detection, standard field mapping
- Variant type inference (SNP/INS/DEL/MNP from ref/alt length)
- ClinVar significance normalization (underscore-to-space, pipe-split)
- Per-row error handling with Log::warning; continues on bad records

### GenomicsController
11 API endpoints under `GET|POST|PUT|DELETE /api/v1/genomics/`:
- `stats` — aggregate counts, uploads by status, top 10 mutated genes
- `uploads` (CRUD) — paginated listing, multipart file upload, delete (cascades to variants + storage)
- `variants` — paginated listing with filters (upload_id, source_id, gene, clinvar_significance, mapping_status)
- `criteria` (CRUD) — genomic cohort criteria library

File upload: <10 MB parsed synchronously; larger files would dispatch a queue job (stub for now).

### Frontend Module (`/genomics`)
- **GenomicsPage** — stats cards, top genes chip cloud (clickable filter), uploads table with status badges
- **UploadDetailPage** — variant table with gene/HGVS/ClinVar/OMOP columns; auto-polls during parse
- **UploadDialog** — drag-and-drop zone, format selection (4 types), genome build + sample ID fields, auto-detects format from file extension
- **genomicsApi.ts** — typed API client for all 11 endpoints
- **useGenomics.ts** — TanStack Query hooks with cache invalidation
- **types/index.ts** — TypeScript types for all entities
- **Sidebar** — "Genomics" entry with Dna icon in Research section
- **Router** — lazy-loaded routes at `/genomics` and `/genomics/uploads/:id`

### API Verified
```
GET /api/v1/genomics/stats → {"data":{"total_uploads":0,"total_variants":0,...}}
```

---

## Standards & Best Practices Applied

- **OMOP CDM v5.4 Genomic Extension conventions**: variants map to MEASUREMENT with measurement_concept_id from OMOP Genomic Vocabulary (HGVS/ClinVar/COSMIC concepts); measurement_source_value = "GENE:HGVS_c"
- **GA4GH VRS alignment**: chromosome normalized (chr prefix stripped), HGVS stored as-is for downstream VRS ID generation
- **IBIS-standard VCF parsing**: INFO field key=value format per VCF 4.2 spec; GT allele parsing handles phased (|) and unphased (/) notation
- **Graceful degradation**: parse errors per-row logged and skipped; upload still completes with partial data
- **Code-split lazy routes**: genomics pages load on demand, not in main bundle

---

---

## §15.2 — OMOP Measurement Writer & Person Matcher (Complete)

**What was built:**

### PersonMatcherService
Three-strategy person matching for uploaded variants:
1. Direct numeric match (sample_id is a person_id)
2. person_source_value lookup in OMOP person table
3. Per-variant sample_id matching (multi-sample VCF support)

Graceful fallback — unmatched variants remain with person_id=null, flagged in import stats.

### OmopMeasurementWriterService
Writes matched genomic variants to OMOP MEASUREMENT table:
- `measurement_type_concept_id = 32856` (Lab) — standard for genomic measurements
- `measurement_source_value` = "GENE:HGVS_c" (≤50 chars per CDM spec)
- `value_source_value` = "REF>ALT"
- `value_as_concept_id` → ClinVar pathogenicity concept (Pathogenic=36307720, etc.)
- `value_as_number` = allele_frequency (numerical representation)
- Vocabulary lookup: tries HGVS exact match, then gene-level ILIKE search for standard concept
- Falls back to measurement_concept_id=0 for unmapped variants
- Processes in chunks of 200 to avoid memory limits
- Updates variant.omop_measurement_id + mapping_status after write

### Two new API endpoints
- `POST /api/v1/genomics/uploads/{id}/match-persons` — runs PersonMatcherService
- `POST /api/v1/genomics/uploads/{id}/import` — runs OmopMeasurementWriterService, returns {written, skipped, errors}

### Frontend
- UploadDetailPage: "Match Persons" + "Import to OMOP" action buttons appear when status=mapped
- useMatchPersons() + useImportToOmop() hooks with cache invalidation

### Standards Applied
- OMOP CDM v5.4 measurement table field spec (all required fields populated)
- ClinVar significance → OMOP concept_id mapping (standard vocabulary IDs)
- measurement_source_value capped at 50 chars per CDM convention

---

---

## §15.3 — Genomic Criteria in Cohort Builder (Complete)

**What was built:**

### Type Extension (cohortExpression.ts)
- `GenomicCriteriaType` union: gene_mutation | tmb | msi | fusion | pathogenicity | treatment_episode
- `GenomicCriterion` interface with type-discriminated fields (gene, hgvs, tmbOperator/tmbValue, msiStatus, gene1/gene2, clinvarClasses, exclude)
- `CohortExpression.GenomicCriteria?: GenomicCriterion[]` — extends OHDSI expression format without breaking existing structure

### Zustand Store (cohortExpressionStore.ts)
- `addGenomicCriterion(criterion)` — appends to expression.GenomicCriteria, marks isDirty
- `removeGenomicCriterion(index)` — removes by index, marks isDirty
- Both actions serialize to/from the expression_json stored in cohort_definitions table

### GenomicCriteriaPanel Component
Interactive form for 6 genomic criteria types:
- **Gene Mutation**: gene symbol + optional HGVS p./c. notation
- **TMB**: operator (≥/>/<=/< ) + numeric threshold + "mut/Mb" unit
- **MSI**: radio selection (MSI-H, any_unstable, MSI-L, MSS)
- **Gene Fusion**: primary gene + optional partner gene (displays as GENE1::GENE2)
- **Pathogenicity**: multi-select ClinVar classes (Pathogenic, Likely pathogenic, Uncertain significance)
- **Treatment Episode**: free-text regimen name (maps to EPISODE table in OMOP Oncology Extension)
- Exclude toggle: negates criterion (exclude patients WITH this feature)
- Human-readable label auto-generated for each type

### CohortExpressionEditor Integration
- New "Genomic Criteria" collapsible section (#7, before Qualified Limit)
- Purple/DNA icon theming, badge count, criterion chips with X button
- "Add Genomic Criterion" button renders GenomicCriteriaPanel inline
- GenomicCriteria count shown in section badge

### Standards Applied
- OMOP Oncology Extension: treatment_episode type maps to EPISODE/EPISODE_EVENT tables
- MSI and TMB thresholds follow ASCO/NCCAP clinical nomenclature (MSI-H, TMB-High ≥10 mut/Mb)
- ClinVar classification names follow ClinVar standard terminology

---

---

## §15.4 — Variant-Outcome Analysis Suite (Complete)

**What was built:**

### VariantOutcomeService (backend)
Three analytical methods:

1. **survivalByMutation** — Kaplan-Meier event data:
   - Fetches person_ids with gene variant from genomic_variants
   - Queries omop.observation_period + omop.death to get (time_days, event) pairs
   - Returns mutated vs wild-type series (matched cohort at 3:1 ratio)
   - Uses `EXTRACT(DAY)` for time calculation, handles censored observations
   - Graceful failure with Log::warning + empty array return

2. **treatmentVariantMatrix** — Event rate by gene × drug:
   - For each gene: joins genomic_variants → omop.drug_exposure → omop.concept → omop.death
   - Returns top drugs by patient count, with event_rate = deaths/n
   - HAVING n ≥ 3 filter prevents small-n spurious rates

3. **genomicCharacterization** — Population-level genomic summary:
   - Top mutated genes (count + pct of total)
   - TMB approximation: variant count per sample, bucketed into 5 ranges
   - Variant type distribution (SNP, INS, DEL, MNP)

### Three API endpoints
- `GET /api/v1/genomics/analysis/survival?source_id=9&gene=EGFR&hgvs=p.Leu858Arg`
- `GET /api/v1/genomics/analysis/treatment-matrix?source_id=9&genes[]=EGFR&genes[]=KRAS`
- `GET /api/v1/genomics/analysis/characterization?source_id=9`

### GenomicAnalysisPage (frontend)
Three-tab analysis UI at `/genomics/analysis`:

1. **Mutation-Survival tab**: Gene + HGVS inputs → inline SVG KM curve (no external charting library)
   - KM step function computed in browser from (t, e) event data
   - Two curves: mutated (red) vs wild-type (blue) with n counts in legend
   - X-axis: days, Y-axis: survival probability

2. **Treatment-Variant Matrix tab**: Comma-separated gene input → heatmap
   - Color intensity = event rate (red gradient, max-normalized)
   - Cell tooltip shows n + rate%; rotated drug name headers
   - Empty state guides user to upload data + CDM connection

3. **Genomic Characterization tab**: Top genes waterfall + variant type chips + TMB histogram
   - Gradient bar chart for gene frequencies
   - Variant type distribution as labeled chips
   - TMB bucket bar chart (vertical bars with counts)

### Standards Applied
- KM curves follow standard actuarial method (product-limit estimator)
- TMB buckets align with MSK-IMPACT thresholds (TMB-H ≥10 mut/Mb)
- Drug concept filtering: `concept_class_id IN ('Ingredient','Clinical Drug')` for standard OMOP drug hierarchy

---

## §15.5 — Molecular Tumor Board Dashboard (Complete)

**What was built:**

### TumorBoardService (backend)
Per-patient evidence panel builder:
1. **Patient variants**: all genomic_variants for person_id, sorted by ClinVar significance + gene
2. **Patient demographics**: pulls from omop.person + concept lookups for gender/race/ethnicity
3. **Similar patient outcomes**: for each actionable (Pathogenic/LP) gene, finds patients in genomic_variants with same gene mutation, queries omop.observation_period + omop.death for (n, median_survival_days, event_rate)
   - Uses PostgreSQL `PERCENTILE_CONT(0.5) WITHIN GROUP` for median survival
   - Excludes current patient from cohort
4. **Drug patterns**: across all similar patients (union of all actionable genes), finds top 15 drugs from omop.drug_exposure with n and pct
5. **Evidence summary**: auto-generated text — variant count, actionable genes, VUS count, total similar patients

### API endpoint
`GET /api/v1/genomics/tumor-board/{personId}?source_id=9`

### TumorBoardPage (frontend)
- Person ID search input → loads panel on submit or Enter
- **Evidence summary banner** — auto-generated text + actionable gene chips
- **Variants table** — gene, HGVS p./c., type, class, AF, ClinVar classification with color-coded shield icons (red=Pathogenic, orange=LP, yellow=VUS, blue=LB, green=Benign)
- **Demographics card** — age, gender, race, ethnicity from OMOP CDM
- **Drug patterns card** — horizontal bar chart of drug frequencies in similar patients
- **Similar patient outcomes table** — n, median survival in months, event rate with color-coded progress bar (red-to-green gradient)
- Navigation from GenomicsPage via "Tumor Board" header button

### Navigation
- GenomicsPage: "Analysis Suite" + "Tumor Board" quick-access buttons added to header
- Router: `/genomics/tumor-board` lazy route

### Standards Applied
- Median survival via PERCENTILE_CONT (standard actuarial convention)
- ClinVar classifications follow ClinVar standard terminology + pathogenicity hierarchy
- Drug patterns use Ingredient/Clinical Drug concept classes (standard OMOP drug hierarchy)
- Evidence panel structure follows ASCO Molecular Tumor Board reporting conventions

---

## Phase 15 Complete ✓

All 5 subsections delivered:
- §15.1: Data layer (3 migrations, 3 models, VCF parser, 11 API endpoints, frontend module)
- §15.2: OMOP measurement writer + person matcher + import pipeline
- §15.3: Genomic criteria in cohort builder (6 types, Zustand integration, CohortExpressionEditor section)
- §15.4: Variant-Outcome Analysis Suite (KM survival, treatment×variant matrix, genomic characterization)
- §15.5: Molecular Tumor Board Dashboard (per-patient evidence panel with similar patient outcomes)
