# Patient Similarity Engine — Design Specification

**Date:** 2026-04-02
**Status:** Approved
**Module:** Patient Similarity / "Patients Like Mine"

---

## 1. Purpose

A multi-modal patient similarity engine that matches patients across six clinical dimensions: demographics, conditions, measurements, drugs, procedures, and genomic variants. Serves two primary use cases:

- **Standalone research tool** — any researcher picks a patient from any CDM source and finds clinically similar patients with per-dimension score breakdowns
- **Cohort discovery** — bidirectional integration with cohort definitions: export similar patient sets as cohorts, and seed similarity searches from existing cohorts

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Split Responsibility — Laravel extracts & scores, Python embeds & searches | Each language does what it's best at; interpretable mode works without Python |
| Similarity modes | Dual: Interpretable (Jaccard/Euclidean) + Embedding (SapBERT aggregation), user toggleable | Interpretable for clinical trust, embedding for semantic matching |
| Source strategy | Source-agnostic via SourceContext, validated on SynPUF + Pancreas + Acumenus | SourceContext already handles dynamic schema routing |
| Cohort integration | Bidirectional: export to cohort + seed from cohort (centroid/exemplar) | Both directions are complementary research workflows |
| Privacy | Tiered: aggregates by default, person-level for `profiles.view` holders | HIPAA-friendly default that doesn't cripple authorized researchers |
| Refresh strategy | On-demand compute with staleness indicator in UI | CDM data is ETL-loaded, not real-time; avoids wasted cycles |
| Missing dimensions | Reduce denominator, not penalize score | SynPUF has no genomics — score should reflect available dimensions only |
| Navigation | Standalone top-level module + contextual "Find Similar" entry points | Maximum discoverability from Patient Profile, Tumor Board, Cohort Definitions |

## 3. System Architecture

### 3.1 Split Responsibility Model

**Laravel** owns:
- Feature extraction (reuses existing `PatientFeatureExtractor` + `FeatureBuilder` pattern)
- Interpretable similarity scoring (Jaccard, Euclidean, weighted sum)
- Auth, RBAC, SourceContext schema routing
- Background compute orchestration (Horizon jobs)
- API endpoints, request validation, response enrichment

**Python AI service** owns:
- SapBERT embedding generation (concept aggregation per dimension)
- Dense patient embedding computation (768-dim SapBERT → 512-dim patient vector)
- Embedding storage coordination with pgvector

**PostgreSQL + pgvector** owns:
- Structured feature storage (`patient_feature_vectors`)
- Dense embedding storage and ANN search (IVFFlat index)
- Population-level measurement statistics for z-score normalization

### 3.2 Data Flows

**Background Compute (Horizon Job):**
1. Laravel `ComputePatientFeatureVectors` iterates patients in a CDM source
2. `PatientFeatureExtractor` with 6 `FeatureBuilder` implementations extracts structured features
3. Stores structured features in `app.patient_feature_vectors`
4. Sends structured features to Python `POST /patient-similarity/embed`
5. Python aggregates SapBERT concept embeddings → 512-dim dense vector
6. Dense vector stored in `patient_feature_vectors.embedding` column

**Query — Interpretable Mode (Python not involved):**
1. Laravel loads seed patient's structured features from `patient_feature_vectors`
2. SQL-based scoring: Jaccard on concept sets, Euclidean on lab z-scores, composite demographics
3. Weighted sum with user-specified dimension weights, missing dimensions excluded from denominator
4. Returns top-K results with per-dimension score breakdowns

**Query — Embedding Mode (two-stage):**
1. Laravel loads seed patient's dense embedding from `patient_feature_vectors`
2. pgvector ANN search (`<=>` cosine distance) retrieves top-200 candidates
3. Laravel re-ranks candidates using the same interpretable scorers
4. Returns top-K results with per-dimension score breakdowns (identical response shape)

**Cohort Seed:**
- Centroid strategy: mean of cohort member embeddings → ANN search near centroid
- Exemplar strategy: user selects representative patients → search near their average
- Interpretable mode: union of member conditions/drugs/procedures, mean of lab vectors → "virtual patient"

## 4. Data Model

### 4.1 New Tables (app schema)

```sql
-- Pre-computed patient feature vectors (one row per patient per source)
CREATE TABLE app.patient_feature_vectors (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           INTEGER NOT NULL REFERENCES app.sources(id),
    person_id           BIGINT NOT NULL,

    -- Demographics
    age_bucket          SMALLINT,
    gender_concept_id   INTEGER,
    race_concept_id     INTEGER,

    -- Condition summary
    condition_concepts  JSONB,              -- Array of ancestor-rolled condition_concept_ids
    condition_count     INTEGER,

    -- Measurement summary
    lab_vector          JSONB,              -- {measurement_concept_id: z_score, ...}
    lab_count           INTEGER,

    -- Treatment summary
    drug_concepts       JSONB,              -- Array of ingredient-level concept_ids
    procedure_concepts  JSONB,              -- Array of procedure concept_ids

    -- Genomic summary (nullable)
    variant_genes       JSONB,              -- [{gene, pathogenicity, variant_type}, ...]
    variant_count       INTEGER,

    -- Dense embedding for ANN search
    embedding           vector(512),

    -- Metadata
    dimensions_available JSONB NOT NULL,    -- ["demographics","conditions",...] — tracks which dims have data
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version             SMALLINT NOT NULL DEFAULT 1,

    UNIQUE(source_id, person_id)
);

CREATE INDEX idx_pfv_embedding ON app.patient_feature_vectors
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_pfv_source ON app.patient_feature_vectors(source_id);

-- Source-level measurement statistics (for z-score normalization)
CREATE TABLE app.source_measurement_stats (
    id                      BIGSERIAL PRIMARY KEY,
    source_id               INTEGER NOT NULL REFERENCES app.sources(id),
    measurement_concept_id  INTEGER NOT NULL,
    mean                    DOUBLE PRECISION NOT NULL,
    stddev                  DOUBLE PRECISION NOT NULL,
    n_patients              INTEGER NOT NULL,
    percentile_25           DOUBLE PRECISION,
    percentile_75           DOUBLE PRECISION,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(source_id, measurement_concept_id)
);

-- Similarity dimension definitions (seeded, admin-configurable)
CREATE TABLE app.similarity_dimensions (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    default_weight  FLOAT NOT NULL DEFAULT 1.0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB
);

-- Similarity search results cache
CREATE TABLE app.patient_similarity_cache (
    id              BIGSERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL,
    seed_person_id  BIGINT NOT NULL,
    mode            VARCHAR(20) NOT NULL,       -- 'interpretable' or 'embedding'
    weights_hash    VARCHAR(64) NOT NULL,
    results         JSONB NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,

    UNIQUE(source_id, seed_person_id, mode, weights_hash)
);
```

### 4.2 Seed Data (similarity_dimensions)

| key | name | default_weight | description |
|-----|------|---------------|-------------|
| demographics | Demographics | 1.0 | Age, gender, race matching |
| conditions | Conditions | 1.0 | Diagnosis overlap (ancestor-weighted Jaccard) |
| measurements | Measurements | 1.0 | Lab value similarity (z-score Euclidean) |
| drugs | Drugs | 1.0 | Medication overlap (ingredient-level Jaccard) |
| procedures | Procedures | 1.0 | Procedure overlap (Jaccard) |
| genomics | Genomics | 1.0 | Variant overlap (pathogenicity-tiered) |

## 5. Similarity Scoring

### 5.1 Per-Dimension Scoring Functions

All scorers return a value in [0, 1].

**Demographics (composite):**
```
0.4 * (1 - |age_diff| / max_age_span) + 0.4 * gender_match + 0.2 * race_match
```

**Conditions (ancestor-weighted Jaccard):**
Standard Jaccard `|A ∩ B| / |A ∪ B|` on ancestor-rolled concept sets, with deeper (more specific) shared concepts weighted higher using `concept_ancestor` depth.

**Measurements (inverse Euclidean):**
```
1 / (1 + euclidean_distance(z_a, z_b))
```
Computed only on measurement types present in both patients. Z-scores derived from `source_measurement_stats`.

**Drugs (Jaccard):**
`|A ∩ B| / |A ∪ B|` on ingredient-level concept sets (rolled to ingredient via `concept_ancestor`).

**Procedures (Jaccard):**
`|A ∩ B| / |A ∪ B|` on procedure concept sets.

**Genomics (tiered overlap):**
Weighted by pathogenicity: pathogenic=3, likely_pathogenic=2, VUS=1.
```
score = Σ(weight of shared variants) / Σ(weight of all variants in both patients)
```

### 5.2 Overall Score with Missing-Dimension Handling

```
available_dims = dimensions where BOTH patients have data
score = Σ(weight_d * score_d) / Σ(weight_d)    for d in available_dims
```

If patient A has genomics but patient B doesn't, the genomic dimension is excluded from both numerator and denominator. The `dimensions_available` field on `patient_feature_vectors` drives this.

### 5.3 Cohort Centroid

**Embedding mode:** `centroid = mean(member_embeddings)`

**Interpretable mode:** Virtual patient constructed from:
- `conditions = union(member_conditions)`
- `drugs = union(member_drugs)`
- `procedures = union(member_procedures)`
- `lab_vector = mean(member_lab_vectors)`
- Demographics: median age, mode gender/race

## 6. API Design

### 6.1 Endpoints

```
POST /api/v1/patient-similarity/search
  Body: { person_id, source_id, mode: "interpretable"|"embedding",
          weights: {demographics: 1.0, conditions: 2.0, ...},
          limit: 25, min_score: 0.3,
          filters: {age_range: [40, 70], gender_concept_id: 8507} }
  Permission: patient-similarity.view
  Note: person-level details redacted unless caller has profiles.view

POST /api/v1/patient-similarity/search-from-cohort
  Body: { cohort_definition_id, source_id, mode, weights, limit,
          strategy: "centroid"|"exemplar", exemplar_person_ids?: [] }
  Permission: patient-similarity.view + cohorts.view

GET /api/v1/patient-similarity/compare?person_a=&person_b=&source_id=
  Permission: patient-similarity.view + profiles.view

POST /api/v1/patient-similarity/export-cohort
  Body: { cache_id (from patient_similarity_cache.id), min_score, cohort_name, cohort_description }
  Permission: patient-similarity.view + cohorts.create

GET /api/v1/patient-similarity/dimensions
  Permission: patient-similarity.view

POST /api/v1/patient-similarity/compute
  Body: { source_id, force: false }
  Permission: patient-similarity.compute (data-steward+)

GET /api/v1/patient-similarity/compute/{jobId}
  Permission: patient-similarity.compute

GET /api/v1/patient-similarity/status/{sourceId}
  Permission: patient-similarity.view
  Returns: last_computed_at, patient_count, dimensions_coverage, staleness_warning
```

### 6.2 Response Shape (shared by /search and /search-from-cohort)

```json
{
  "seed": { "person_id": 12345, "demographics": {}, "summary": {} },
  "mode": "interpretable",
  "similar_patients": [
    {
      "person_id": 67890,
      "overall_score": 0.87,
      "dimension_scores": {
        "demographics": 0.95,
        "conditions": 0.82,
        "measurements": 0.91,
        "drugs": 0.73,
        "procedures": 0.65,
        "genomics": 0.88
      },
      "shared_conditions": ["Type 2 diabetes", "Hypertension"],
      "shared_drugs": ["Metformin", "Lisinopril"],
      "shared_variants": ["BRCA1 p.C61G (Pathogenic)"],
      "demographics": { "age": 58, "gender": "Female" }
    }
  ],
  "cohort_outcomes": {
    "n_patients": 25,
    "median_survival_days": 1825,
    "event_rate": 0.12,
    "treatment_patterns": []
  },
  "metadata": {
    "computed_in_ms": 342,
    "candidates_evaluated": 200,
    "dimensions_used": ["demographics", "conditions", "measurements", "drugs", "procedures", "genomics"]
  }
}
```

Person-level fields (`person_id`, `shared_conditions`, `shared_drugs`, `shared_variants`) are redacted for users without `profiles.view` — replaced with anonymized summaries (age/gender only, condition/drug counts).

### 6.3 Permissions

| Permission | Role | Description |
|-----------|------|-------------|
| `patient-similarity.view` | researcher+ | Search, view results, export cohorts |
| `patient-similarity.compute` | data-steward+ | Trigger feature vector computation |

### 6.4 Rate Limiting

- `/search`, `/search-from-cohort`: 30 requests/minute
- `/compute`: 5 requests/hour
- All other endpoints: default API rate limits

## 7. Frontend Structure

### 7.1 New Files

```
frontend/src/features/patient-similarity/
  pages/
    PatientSimilarityPage.tsx       — Main search + results interface
    PatientComparisonPage.tsx       — Side-by-side comparison
  components/
    SimilaritySearchForm.tsx        — Mode toggle, source, patient ID, weight sliders, filters
    SimilarPatientTable.tsx         — Results table with per-dimension score bars
    DimensionScoreBar.tsx           — Visual score bar component
    SimilarityModeToggle.tsx        — Interpretable / Embedding toggle
    StalenessIndicator.tsx          — Last computed + recompute link
    CohortExportDialog.tsx          — Name/describe + min_score threshold
    CohortSeedForm.tsx              — Cohort selector + strategy (centroid/exemplar)
  hooks/
    usePatientSimilarity.ts         — TanStack Query hooks for all endpoints
  api.ts                            — API client functions
```

### 7.2 Entry Points

| Location | Button | Behavior |
|----------|--------|----------|
| Patient Profile page header | "Find Similar Patients" | Opens `/patient-similarity?person_id=X&source_id=Y` |
| Molecular Tumor Board | "Expand with Clinical Similarity" | Opens `/patient-similarity?person_id=X&source_id=Y&weights[genomics]=3.0` |
| Cohort Definitions action menu | "Find Similar to Cohort" | Opens `/patient-similarity?cohort_id=X&source_id=Y&mode=cohort` |

### 7.3 Tiered Access in UI

- **Default (patient-similarity.view only):** Results show "F, 58y" with condition/drug counts. No person_id, no clickable links, no shared feature names.
- **With profiles.view:** Results show person_id (clickable to Patient Profile), shared condition/drug/variant names, full comparison view available.

## 8. Backend Structure

### 8.1 New Files

```
backend/app/Services/PatientSimilarity/
  PatientSimilarityService.php          — Orchestrates search, mode routing, caching
  DimensionScorer.php                   — Per-dimension scoring functions
  DemographicsScorer.php                — Age/gender/race composite score
  ConditionScorer.php                   — Ancestor-weighted Jaccard
  MeasurementScorer.php                 — Inverse Euclidean on z-scored labs
  DrugScorer.php                        — Ingredient-level Jaccard
  ProcedureScorer.php                   — Procedure Jaccard
  GenomicScorer.php                     — Pathogenicity-tiered overlap
  CohortCentroidBuilder.php            — Builds virtual patient from cohort members
  EmbeddingClient.php                   — HTTP client to Python AI service

backend/app/Http/Controllers/Api/V1/
  PatientSimilarityController.php       — API endpoints

backend/app/Http/Requests/
  PatientSimilaritySearchRequest.php
  PatientSimilarityComputeRequest.php
  PatientSimilarityExportCohortRequest.php

backend/app/Jobs/
  ComputePatientFeatureVectors.php      — Horizon batch job

backend/app/Models/App/
  PatientFeatureVector.php
  SimilarityDimension.php
  SourceMeasurementStat.php
  PatientSimilarityCache.php

backend/database/migrations/
  xxxx_create_patient_feature_vectors_table.php
  xxxx_create_source_measurement_stats_table.php
  xxxx_create_similarity_dimensions_table.php
  xxxx_create_patient_similarity_cache_table.php
  xxxx_seed_similarity_dimensions.php
```

### 8.2 Modified Files

```
backend/routes/api.php                                  — New route group with permissions
backend/app/Services/Genomics/TumorBoardService.php     — Add "Expand with Clinical Similarity" hook (future)
frontend/src/App.tsx (or router config)                  — New routes
frontend/src/components/layout/Sidebar.tsx               — New sidebar entry
```

### 8.3 Python AI Service

```
ai/app/routers/patient_similarity.py       — POST /patient-similarity/embed
ai/app/services/patient_embeddings.py      — SapBERT concept aggregation → 512-dim vector
```

## 9. Implementation Phases

### Phase 1 — Feature Extraction + Interpretable Scoring (2 weeks)

- Database migrations for all 4 tables + dimension seed
- Extend `PatientFeatureExtractor` with `GenomicFeatureBuilder`
- 6 dimension scorer classes
- `PatientSimilarityService` with interpretable mode
- `ComputePatientFeatureVectors` Horizon job
- API endpoints: `/search`, `/dimensions`, `/compute`, `/compute/{jobId}`, `/status/{sourceId}`
- Validate on SynPUF (scale, missing dimensions) + Pancreas (multi-modal)

### Phase 2 — Embedding Mode + ANN Search (1.5 weeks)

- Python `POST /patient-similarity/embed` endpoint
- SapBERT concept aggregation → 512-dim patient embedding
- Embedding generation in `ComputePatientFeatureVectors` job
- pgvector IVFFlat index, ANN candidate retrieval
- Two-stage search: ANN candidates → re-rank with Phase 1 scorers
- Mode toggle in API

### Phase 3 — Frontend + Compare View (1.5 weeks)

- `PatientSimilarityPage` with search form, weight sliders, results table, dimension score bars
- Mode toggle, staleness indicator, tiered access display
- `PatientComparisonPage` for side-by-side comparison
- `/compare` API endpoint
- Contextual entry points on Patient Profile, Tumor Board, Cohort Definitions

### Phase 4 — Cohort Integration + Outcomes (1 week)

- `/search-from-cohort` with centroid and exemplar strategies
- `/export-cohort` to save results as cohort definition
- `CohortCentroidBuilder` service
- Outcome analytics on similar cohort (survival, treatment patterns)

### Phase 5 — Advanced (future, unscoped)

- Temporal similarity (event ordering)
- Imaging radiomics feature vectors
- Clinical notes NLP embeddings
- Learned patient embeddings (Patient2Vec / transformer)
- Weighted Personalized PageRank graph algorithm
- Cross-source federated similarity search

## 10. Existing Code Reuse

| Existing Component | Reuse Strategy |
|-------------------|----------------|
| `PatientFeatureExtractor` (PopulationRisk) | Extend with similarity-specific extraction; add GenomicFeatureBuilder |
| `FeatureBuilderInterface` + 6 builders (Analysis/Features) | Pattern reused for dimension-specific feature extraction |
| `PatientProfileService` | Used by compare view for full clinical profiles |
| `SourceContext` | All CDM queries route through SourceContext for schema isolation |
| `SapBERT service` (ai/app/services/sapbert.py) | Core of embedding generation — encode concept names to 768-dim vectors |
| `search_nearest` (ai/app/db.py) | Pattern reused for pgvector ANN search on patient embeddings |
| `ConceptResolutionService` | Ancestor rollup for conditions in feature extraction |
| `ComputeEmbeddings` command | Pattern reused for batch patient embedding computation |
| `CdmModel` (read-only) | All CDM queries go through read-only models |
| Horizon job infrastructure | `ComputePatientFeatureVectors` follows existing job patterns |

## 11. Open Questions Resolved

| Question | Resolution |
|----------|-----------|
| Embedding dimension | 512 — sufficient for 6 dimensions, benchmarking deferred to Phase 2 |
| Lab panel selection | Configurable per source via `similarity_dimensions.config` JSONB |
| Concept rollup depth | 3 levels via `concept_ancestor` — specific → intermediate → broad |
| Minimum data threshold | At least 1 dimension with data required; `dimensions_available` tracks coverage |
| Cross-source similarity | Deferred to Phase 5 (federated similarity) |
| Privacy controls | Tiered: aggregates default, person-level requires `profiles.view` |
| Refresh frequency | On-demand with staleness indicator in UI |
