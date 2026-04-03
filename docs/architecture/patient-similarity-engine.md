# Patient Similarity Engine — Research & Implementation Plan

**Date:** 2026-04-02
**Status:** Proposal
**Module:** Patient Similarity / "Patients Like Mine"
**Author:** Sanjay Mudoshi + Claude

---

## 1. Executive Summary

Parthenon's molecular tumor board already finds **genomically similar patients** — those sharing pathogenic/likely-pathogenic variants in the same gene. This proposal expands that into a full **multi-modal patient similarity engine** that matches across five clinical dimensions: demographics, conditions/diagnoses, measurements/labs, procedures/treatments, and genomic variants. The engine will serve both the tumor board (oncology) and general-purpose "Patients Like Mine" searches across any disease area in the OMOP CDM.

---

## 2. Landscape Research

### 2.1 Commercial Systems

**Oracle Healthcare Translational Research — "Patients Like Mine"**
Oracle's implementation uses a **Weighted Personalized PageRank (PPR)** algorithm over a bipartite graph of patients and clinical events. Users select a patient of interest, adjust weights on clinical attribute categories (diagnoses, procedures, treatments), and the algorithm performs biased random walks that are "personalized" toward the seed patient. Output is a ranked list of patients by PPR score with drill-down comparison views and Kaplan-Meier survival analysis across the similar cohort.

Key design ideas worth borrowing:
- User-adjustable dimension weights (lets clinicians emphasize what matters for their case)
- One-to-one comparison view showing shared vs. differing attributes
- Integrated survival analysis on the similar cohort
- Graph-based approach that naturally handles heterogeneous clinical events

**xDECIDE (AI-Augmented Precision Oncology)**
A clinical decision support system that ingests EHR data, standardizes clinico-genomic features, and produces ranked treatment options using a "Human-AI Team" model. Relevant pattern: structured health record → standardized features → similarity + evidence lookup.

### 2.2 Open-Source Implementations

| Project | Approach | Data | Language | Status |
|---------|----------|------|----------|--------|
| [patient_similarity](https://github.com/yinchangchang/patient_similarity) (Yin et al.) | CNN with medical concept embeddings over temporal EHR sequences | Longitudinal EHR events | Python/TensorFlow | Research (Python 2.7, TF 0.12 — outdated) |
| [Patient2Vec](https://github.com/BarnesLab/Patient2Vec) (Zhang et al., IEEE Access 2018) | LSTM + attention mechanism for personalized patient embeddings | Longitudinal EHR | Python (MIT license) | Research, 108 stars |
| [Patient-Similarity-through-Representation](https://github.com/HodaMemar/Patient-Similarity-through-Representation) (Memarzadeh et al., 2022) | Doc2Vec over tree-structured medical records + cosine similarity | Structured + unstructured EMR | Python | Research |
| [Patient-Case-Similarity](https://github.com/abdullahkhilji/Patient-Case-Similarity) | Demographic + case feature extraction from XML/EHR | Demographics + case details | Python | Small project |
| [OHDSI/ComparatorSelectionExplorer](https://github.com/OHDSI/ComparatorSelectionExplorer) | Cosine similarity across drug comparator feature vectors | OMOP CDM | R | OHDSI official, HADES ecosystem |
| [OHDSI/CohortMethod](https://github.com/OHDSI/CohortMethod) | Propensity score matching/stratification for cohort studies | OMOP CDM | R | Production-grade, HADES ecosystem |
| [Phe2vec](https://www.sciencedirect.com/science/article/pii/S2666389921001859) | Unsupervised phenotype embeddings from EHR co-occurrence | EHR diagnosis/procedure codes | Python | Published methodology |

### 2.3 Academic Approaches

**Heterogeneous Information Network (HIN) — S-PathSim (PMC8456037)**
Constructs an Annotated HIN connecting patients, diseases, and medicines. Introduces S-PathSim, a weighted meta-path similarity measure. The N-Disease method encodes temporal disease progression (inspired by NLP N-grams). Tested on 53,853 patients, achieving nDCG of 0.791.

Key insight: annotations on links prevent false associations that standard graph approaches create (e.g., incorrectly suggesting two patients used the same drug when they actually used different drugs for the same disease).

**Transformer Patient Embeddings (Nature Digital Medicine, 2025)**
Uses transformer architecture with attention over patient diagnosis and procedure codes (treating each patient as a "sentence" of medical concepts). Enables patient stratification, progression analysis, and similarity search in the embedding space.

**Patient Similarity Networks (PSN) — Multi-Modal Fusion**
PSNs combine diverse data sources (omics, clinical records, labs, imaging) into patient-patient similarity graphs. Recent 2024–2025 work uses multimodal graph neural networks with three fusion strategies:
- **Early fusion**: concatenate raw features before graph reasoning
- **Intermediate fusion**: integrate high-dimensional modalities (imaging + genomic + text) within the network
- **Late fusion**: pretrained unimodal models operate independently, decisions combined

**Key Methodological Findings:**
- Cosine similarity on feature vectors is the baseline; works well for structured data
- Graph-based approaches (PPR, meta-paths) excel at preserving relational structure
- Embedding-based approaches (Patient2Vec, transformers) capture temporal patterns
- Multi-modal fusion significantly outperforms single-modality matching
- Interpretability is critical for clinical adoption — black-box similarity scores are insufficient

---

## 3. What Parthenon Already Has

### 3.1 Molecular Similarity (TumorBoardService)

`backend/app/Services/Genomics/TumorBoardService.php` currently:
1. Retrieves a patient's genomic variants (gene, HGVS, ClinVar significance)
2. Identifies actionable genes (pathogenic/likely-pathogenic variants)
3. Finds patients sharing ≥1 pathogenic variant in the same gene
4. Computes survival outcomes (median survival days, event rate) for the similar cohort
5. Identifies drug exposure patterns among similar patients

**Limitations:**
- Similarity is binary (shares a pathogenic variant in gene X or doesn't)
- No weighting by variant type, allele frequency, or co-occurring variants
- No clinical phenotype matching (conditions, labs, demographics)
- No temporal consideration (when events occurred)
- Limited to 500 similar patients (hard cap)
- Oncology-only — not generalizable to other disease areas

### 3.2 Concept Embeddings (SapBERT)

`ai/app/services/sapbert.py` provides 768-dimensional medical concept embeddings via SapBERT (PubMedBERT-based). Currently used for vocabulary concept similarity search, not patient similarity. The embedding infrastructure (pgvector, cosine distance) is production-ready and can be extended.

### 3.3 OMOP CDM Data

The platform has multiple CDM schemas with rich clinical data:
- `omop.*` — Acumenus CDM (conditions, measurements, procedures, drugs, observations, visits)
- `synpuf.*` — CMS SynPUF 2.3M patients
- `irsf.*` — IRSF Natural History Study
- `pancreas.*` — Pancreatic Cancer Corpus
- `inpatient.*` — Morpheus inpatient

### 3.4 Infrastructure

- **pgvector** — already deployed for concept embeddings, ready for patient embeddings
- **Python AI service** — FastAPI with GPU support for model inference
- **R runtime** — HADES packages available (CohortMethod for propensity scoring)
- **Redis** — available for caching similarity results
- **Horizon** — queue infrastructure for background computation

---

## 4. Proposed Architecture

### 4.1 Design Principles

1. **OMOP-native**: All features extracted from standard OMOP CDM tables — works across any CDM source
2. **Multi-modal**: Fuse clinical, genomic, and (future) imaging similarity dimensions
3. **User-weighted**: Clinicians adjust dimension weights per search (Oracle PLM pattern)
4. **Pre-computed + real-time hybrid**: Patient feature vectors pre-computed; similarity search at query time
5. **Interpretable**: Every similarity score decomposable into contributing features
6. **Source-agnostic**: Works across any Parthenon CDM source (Acumenus, SynPUF, IRSF, etc.)

### 4.2 Similarity Dimensions

| Dimension | OMOP Tables | Feature Extraction | Similarity Metric |
|-----------|-------------|-------------------|-------------------|
| **Demographics** | `person` | Age bucket, gender, race, ethnicity | Exact match + age distance |
| **Conditions** | `condition_occurrence` | Concept ID set → ICD hierarchy embedding | Jaccard + ancestor-weighted overlap |
| **Measurements/Labs** | `measurement` | Recent values for common lab panels → z-score vector | Euclidean distance on normalized values |
| **Procedures/Treatments** | `procedure_occurrence`, `drug_exposure` | Concept ID set → treatment trajectory | Jaccard + temporal ordering similarity |
| **Genomic Variants** | `genomic_variants` (app) | Gene + variant + pathogenicity vector | Weighted overlap (pathogenicity-tiered) |
| **Outcomes** (display, not matching) | `observation_period`, `death` | Survival time, event status | Kaplan-Meier on similar cohort |

### 4.3 Feature Extraction Pipeline

```
┌─────────────────────────────────────────────────────┐
│                  Feature Extraction                  │
│              (Background Job — Horizon)              │
│                                                      │
│  For each patient in a CDM source:                   │
│                                                      │
│  1. Demographics → age_bucket, gender_id, race_id    │
│  2. Conditions → Set of condition_concept_ids        │
│     → Roll up to ancestor concepts (3-level)         │
│     → Binary vector over top-N conditions            │
│  3. Measurements → Latest value per measurement type │
│     → Z-score normalize within source population     │
│  4. Drugs → Set of ingredient-level concept_ids      │
│  5. Procedures → Set of procedure_concept_ids        │
│  6. Genomic → Gene:variant:pathogenicity tuples      │
│                                                      │
│  Output: patient_feature_vectors table               │
│          + patient_embeddings (pgvector)              │
└─────────────────────────────────────────────────────┘
```

### 4.4 Embedding Strategy

**Hybrid approach combining interpretable features with learned embeddings:**

**Layer 1 — Structured Feature Vectors (interpretable)**
Each patient gets a sparse feature vector across all dimensions. Stored in a dedicated table for decomposable similarity scoring and explanation.

**Layer 2 — Dense Patient Embeddings (fast search)**
Concatenate dimension-specific embeddings into a single dense vector per patient. Store in pgvector for approximate nearest neighbor (ANN) search. This enables sub-second "find top-50 similar patients" queries.

**Embedding generation options (in order of preference):**

1. **Weighted feature hashing** (simplest, most interpretable): Hash condition/drug/procedure concept IDs into fixed-width vectors, concatenate with normalized lab values and demographics. No ML model needed.

2. **Concept embedding aggregation**: Use existing SapBERT embeddings for each concept in a patient's record. Aggregate via attention-weighted mean pooling per dimension. Patient embedding = concatenation of dimension embeddings.

3. **Learned patient embeddings** (future): Train a Patient2Vec-style model on Parthenon's CDM data for temporal-aware embeddings. Requires significant data volume and training infrastructure.

**Recommended starting point: Option 1 (weighted feature hashing) with Option 2 as a fast follow.**

### 4.5 Similarity Computation

```
┌─────────────────────────────────────────────────────┐
│              Query-Time Similarity Search             │
│                                                       │
│  Input: person_id, source_id, dimension_weights{}     │
│                                                       │
│  Step 1: Retrieve seed patient's feature vector       │
│                                                       │
│  Step 2: Candidate retrieval (fast, approximate)      │
│    → pgvector ANN search on dense embedding           │
│    → Returns top-200 candidates                       │
│                                                       │
│  Step 3: Re-rank with weighted dimension scoring      │
│    For each candidate:                                │
│      score = Σ (weight_d × similarity_d)              │
│    where d ∈ {demographics, conditions, labs,         │
│               procedures, genomics}                   │
│                                                       │
│  Step 4: Return top-K with per-dimension breakdown    │
│    → Overall similarity score                         │
│    → Per-dimension scores (for explanation)            │
│    → Shared features (conditions, drugs, variants)    │
│                                                       │
│  Step 5: Outcome analysis on similar cohort           │
│    → Survival curves                                  │
│    → Treatment patterns                               │
│    → Outcome distributions                            │
└─────────────────────────────────────────────────────┘
```

### 4.6 System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │     │   Laravel    │     │   Python AI      │
│   React SPA  │────▶│   API        │────▶│   Service        │
│              │     │              │     │                  │
│ - Search UI  │     │ - Auth/RBAC  │     │ - Embedding gen  │
│ - Results    │     │ - Validation │     │ - ANN search     │
│ - Compare    │     │ - Orchestr.  │     │ - Re-ranking     │
│ - Survival   │     │ - Caching    │     │ - Feature extract│
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
                            │                      │
                     ┌──────▼──────────────────────▼──────┐
                     │         PostgreSQL + pgvector       │
                     │                                     │
                     │  app.patient_feature_vectors        │
                     │  app.patient_embeddings (pgvector)  │
                     │  {source}.person, condition, meas…  │
                     │  vocab.concept, concept_ancestor    │
                     └─────────────────────────────────────┘
```

---

## 5. Data Model

### 5.1 New Tables (app schema)

```sql
-- Pre-computed patient feature vectors (one row per patient per source)
CREATE TABLE app.patient_feature_vectors (
    id              BIGSERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES app.sources(id),
    person_id       BIGINT NOT NULL,

    -- Demographics
    age_bucket      SMALLINT,           -- 5-year buckets: 0-4, 5-9, ...
    gender_concept_id INTEGER,
    race_concept_id   INTEGER,

    -- Condition summary
    condition_concepts  JSONB,          -- Array of condition_concept_ids (rolled up)
    condition_count     INTEGER,

    -- Measurement summary
    lab_vector          JSONB,          -- {measurement_concept_id: z_score, ...}
    lab_count           INTEGER,

    -- Treatment summary
    drug_concepts       JSONB,          -- Array of ingredient concept_ids
    procedure_concepts  JSONB,          -- Array of procedure concept_ids

    -- Genomic summary (nullable — only for patients with genomic data)
    variant_genes       JSONB,          -- Array of {gene, pathogenicity, variant_type}
    variant_count       INTEGER,

    -- Dense embedding for ANN search
    embedding           vector(512),    -- pgvector column

    -- Metadata
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version             SMALLINT NOT NULL DEFAULT 1,

    UNIQUE(source_id, person_id)
);

CREATE INDEX idx_pfv_embedding ON app.patient_feature_vectors
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_pfv_source ON app.patient_feature_vectors(source_id);

-- Similarity search results cache (optional, for expensive queries)
CREATE TABLE app.patient_similarity_cache (
    id              BIGSERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL,
    seed_person_id  BIGINT NOT NULL,
    weights_hash    VARCHAR(64) NOT NULL,   -- SHA256 of weight config
    results         JSONB NOT NULL,         -- Cached ranked results
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,

    UNIQUE(source_id, seed_person_id, weights_hash)
);
```

### 5.2 Configuration

```sql
-- Similarity dimension definitions (seeded, admin-configurable)
CREATE TABLE app.similarity_dimensions (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(50) UNIQUE NOT NULL,  -- 'demographics', 'conditions', etc.
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    default_weight  FLOAT NOT NULL DEFAULT 1.0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB           -- Dimension-specific config (e.g., which labs to include)
);
```

---

## 6. API Design

### 6.1 Endpoints

```
# Search for similar patients
POST /api/v1/patient-similarity/search
Body: {
    "person_id": 12345,
    "source_id": 9,
    "weights": {
        "demographics": 1.0,
        "conditions": 2.0,
        "measurements": 1.5,
        "procedures": 1.0,
        "genomics": 3.0
    },
    "limit": 25,
    "min_score": 0.3,
    "filters": {
        "age_range": [40, 70],
        "gender_concept_id": 8507
    }
}
Response: {
    "seed_patient": { demographics, conditions_summary, ... },
    "similar_patients": [
        {
            "person_id": 67890,
            "overall_score": 0.87,
            "dimension_scores": {
                "demographics": 0.95,
                "conditions": 0.82,
                "measurements": 0.91,
                "procedures": 0.73,
                "genomics": 0.88
            },
            "shared_conditions": ["Type 2 diabetes", "Hypertension"],
            "shared_drugs": ["Metformin", "Lisinopril"],
            "shared_variants": ["BRCA1 p.C61G (Pathogenic)"],
            "demographics": { age: 58, gender: "Female" }
        },
        ...
    ],
    "cohort_outcomes": {
        "n_patients": 25,
        "median_survival_days": 1825,
        "event_rate": 0.12,
        "treatment_patterns": [...]
    }
}

# Compare two patients side-by-side
GET /api/v1/patient-similarity/compare?person_a=12345&person_b=67890&source_id=9
Response: {
    "patient_a": { full_profile },
    "patient_b": { full_profile },
    "shared": { conditions: [...], drugs: [...], variants: [...] },
    "different": { conditions: [...], drugs: [...], variants: [...] },
    "dimension_scores": { ... }
}

# Get similarity dimensions and their weights
GET /api/v1/patient-similarity/dimensions
Response: { "dimensions": [...] }

# Trigger feature vector computation for a source
POST /api/v1/patient-similarity/compute
Body: { "source_id": 9, "force": false }
Response: { "job_id": "...", "status": "queued", "estimated_patients": 52000 }

# Get computation status
GET /api/v1/patient-similarity/compute/{jobId}
```

### 6.2 Permissions

```
patient-similarity.view    — Search for similar patients, view results
patient-similarity.compute — Trigger feature vector computation
```

Assign `patient-similarity.view` to `researcher` and above. Assign `patient-similarity.compute` to `data-steward` and above.

---

## 7. Implementation Phases

### Phase 1 — Foundation (Weeks 1–2)

**Goal:** Structured feature extraction + basic similarity scoring

1. Database migrations for `patient_feature_vectors`, `similarity_dimensions`, `patient_similarity_cache`
2. `PatientFeatureExtractor` service (Laravel) — extracts demographics, conditions, drugs, procedures from OMOP tables for a single patient
3. `FeatureVectorComputeJob` (Horizon) — batch computation across a source's patient population
4. `PatientSimilarityService` (Laravel) — weighted Jaccard + Euclidean scoring across dimensions
5. API endpoints: `/search`, `/compare`, `/dimensions`, `/compute`
6. Basic React UI: search form with weight sliders, results table with dimension score breakdown

**Similarity algorithm (Phase 1):**
- Demographics: exact match scoring (gender=1/0, race=1/0, age=1-|age_diff|/max_age_diff)
- Conditions: Jaccard similarity on ancestor-rolled concept sets
- Measurements: 1 - normalized Euclidean distance on z-scored lab values
- Drugs: Jaccard similarity on ingredient concept sets
- Procedures: Jaccard similarity on procedure concept sets
- Overall: weighted sum, user-adjustable weights

### Phase 2 — Embeddings + ANN Search (Weeks 3–4)

**Goal:** Fast approximate search via pgvector

1. Patient embedding generation in Python AI service (SapBERT concept aggregation per dimension → concatenated dense vector)
2. pgvector IVFFlat index for ANN candidate retrieval
3. Two-stage search: ANN candidates → re-rank with interpretable scoring
4. Background job to maintain embeddings as patient data changes
5. Redis caching for frequent searches

### Phase 3 — Genomic Integration (Week 5)

**Goal:** Merge existing TumorBoardService similarity into the unified engine

1. Extend `PatientFeatureExtractor` to include genomic variant features
2. Genomic similarity: weighted overlap considering gene, variant type, pathogenicity tier, allele frequency
3. Migrate TumorBoardService to use PatientSimilarityService internally (backward-compatible)
4. Tumor board UI shows unified similarity scores with genomic dimension highlighted

### Phase 4 — Outcome Analytics + Advanced UI (Week 6)

**Goal:** Clinical decision support features on the similar cohort

1. Kaplan-Meier survival analysis on the similar patient cohort
2. Treatment pattern analysis (what drugs/procedures were most common in similar patients)
3. Outcome comparison: stratify similar patients by treatment received
4. Side-by-side patient comparison view (shared vs. different features)
5. Export similar cohort as a Parthenon cohort definition

### Phase 5 — Advanced Similarity (Future)

1. Temporal similarity: consider when conditions/treatments occurred relative to each other
2. DICOM/imaging similarity: tumor volumetrics via radiomics feature vectors
3. Clinical notes similarity: NLP embeddings from note_nlp table
4. Learned embeddings: train Patient2Vec or transformer model on Parthenon CDM data
5. Graph-based similarity: implement Weighted PPR (Oracle PLM approach) as an alternative algorithm
6. Federated similarity: cross-source similarity search (find patients in SynPUF similar to an Acumenus patient)

---

## 8. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding storage | pgvector (existing) | Already deployed, proven with concept embeddings |
| ANN index | IVFFlat (pgvector) | Good balance of speed/accuracy for <1M patients; upgrade to HNSW if needed |
| Embedding dimension | 512 | Sufficient for 5 clinical dimensions × ~100 features each |
| Feature extraction | Laravel (PHP) | Stays in the request lifecycle, reuses existing CDM connections |
| Embedding generation | Python AI service | SapBERT model + numpy/torch for vector math |
| Background computation | Horizon (Laravel queues) | Existing infrastructure, job monitoring via dashboard |
| Caching | Redis + DB cache table | Redis for hot queries, DB for longer-term result persistence |
| Similarity baseline | Weighted Jaccard + Euclidean | Interpretable, no training required, clinically validated |
| Future ML | Patient2Vec (LSTM+attention) | MIT-licensed, proven on EHR data, personalized embeddings |

---

## 9. Key Files to Create/Modify

### New Files

```
backend/
  app/Services/PatientSimilarity/
    PatientFeatureExtractor.php      — Extract features from OMOP tables
    PatientSimilarityService.php     — Core similarity computation
    DimensionScorer.php              — Per-dimension similarity functions
    EmbeddingGenerator.php           — Orchestrates Python AI service calls
  app/Http/Controllers/Api/V1/
    PatientSimilarityController.php  — API endpoints
  app/Http/Requests/
    PatientSimilaritySearchRequest.php
  app/Jobs/
    ComputePatientFeatureVectors.php — Horizon batch job
  app/Models/App/
    PatientFeatureVector.php
    SimilarityDimension.php
    PatientSimilarityCache.php
  database/migrations/
    xxxx_create_patient_feature_vectors_table.php
    xxxx_create_similarity_dimensions_table.php
    xxxx_create_patient_similarity_cache_table.php
    xxxx_seed_similarity_dimensions.php

ai/app/
  routers/patient_similarity.py      — FastAPI endpoints for embedding generation
  services/patient_embeddings.py     — Patient embedding computation

frontend/src/features/patient-similarity/
  pages/
    PatientSimilarityPage.tsx        — Main search interface
    PatientComparisonPage.tsx        — Side-by-side comparison
  components/
    SimilaritySearchForm.tsx         — Weight sliders + filters
    SimilarPatientTable.tsx          — Results table with dimension scores
    DimensionScoreBar.tsx            — Visual score breakdown
    SurvivalCurveChart.tsx           — Kaplan-Meier on similar cohort
    TreatmentPatternsChart.tsx       — Drug/procedure patterns
  hooks/
    usePatientSimilarity.ts          — TanStack Query hooks
  api.ts                             — API client functions
```

### Modified Files

```
backend/routes/api.php                                — New route group
backend/app/Services/Genomics/TumorBoardService.php   — Delegate to PatientSimilarityService
frontend/src/App.tsx (or router config)               — New routes
```

---

## 10. Open Questions

1. **Embedding dimension**: 512 is a starting point. Should we benchmark 256 vs 512 vs 768?
2. **Lab panel selection**: Which measurement_concept_ids form the "standard" lab vector? Should this be configurable per source?
3. **Concept rollup depth**: How many levels up the OMOP concept_ancestor hierarchy should conditions be rolled up? (Proposed: 3 levels — specific → intermediate → broad)
4. **Minimum data threshold**: What's the minimum number of clinical events a patient needs before their feature vector is meaningful?
5. **Cross-source similarity**: Should Phase 1 support searching across CDM sources, or limit to within a single source?
6. **Privacy controls**: Should similarity results be anonymized (show aggregate stats only) or show individual patient IDs?
7. **Refresh frequency**: How often should feature vectors be recomputed? On-demand only, or scheduled (e.g., nightly)?

---

## 11. References

### Open Source Projects
- [patient_similarity (CNN + concept embeddings)](https://github.com/yinchangchang/patient_similarity)
- [Patient2Vec (LSTM + attention, MIT)](https://github.com/BarnesLab/Patient2Vec)
- [Patient-Similarity-through-Representation (Doc2Vec)](https://github.com/HodaMemar/Patient-Similarity-through-Representation)
- [Patient-Case-Similarity (demographic matching)](https://github.com/abdullahkhilji/Patient-Case-Similarity)
- [OHDSI ComparatorSelectionExplorer (cosine similarity, OMOP)](https://github.com/OHDSI/ComparatorSelectionExplorer)
- [OHDSI CohortMethod (propensity score matching, OMOP)](https://github.com/OHDSI/CohortMethod)

### Key Papers
- Yin et al., "Measuring Patient Similarities via a Deep Architecture with Medical Concept Embedding" — CNN temporal EHR matching
- Zhang et al., "Patient2Vec: A Personalized Interpretable Deep Representation of the Longitudinal EHR" (IEEE Access 2018) — LSTM + attention, 0.799 AUC
- Memarzadeh et al., "A study into patient similarity through representation learning from medical records" (KAIS 2022) — Doc2Vec tree representation
- PMC8456037, "Heterogeneous Information Network-Based Patient Similarity Search" — S-PathSim, N-Disease, nDCG 0.791 on 53K patients
- Phe2vec, "Automated disease phenotyping based on unsupervised embeddings from EHR" (Patterns 2021)
- Nature Digital Medicine 2025, "Transformer patient embedding using EHR enables patient stratification"
- [Patient Similarity Networks for Precision Medicine (J Mol Biol)](https://www.sciencedirect.com/science/article/pii/S0022283618305321)
- [SimNetX: patient similarity networks](https://link.springer.com/article/10.1007/s41109-025-00743-6)
- [Multimodal GNNs in healthcare: fusion strategies (Frontiers AI 2025)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1716706/full)

### Commercial Systems
- [Oracle Patients Like Mine (v4.1)](https://docs.oracle.com/en/industries/health-sciences/healthcare-translational-research/4.1/notebook-ug/patients-mine-notebook.html)
- [Molecular Tumor Board Portal (Nature Cancer 2022)](https://www.nature.com/articles/s43018-022-00332-x)
- [xDECIDE AI-Augmented Precision Oncology](https://www.liebertpub.com/doi/10.1089/aipo.2023.0001)
