---
slug: patient-similarity-engine
title: "Patients Like Mine: Building a Multi-Modal Patient Similarity Engine on OMOP CDM"
authors: [mudoshi, claude]
tags: [patient-similarity, omop, pgvector, sapbert, embeddings, cohort-discovery, architecture, ai, precision-medicine]
date: 2026-04-02
---

For twenty years, the question "which patients are most like this one?" has haunted clinical informatics. Molecular tumor boards want to know: of the 300 patients in our pancreatic cancer corpus, which ones had the same pathogenic variants, the same comorbidity profile, the same treatment history — and what happened to them? Population health researchers want to seed cohort definitions not from abstract inclusion criteria but from a concrete index patient. And every clinician who has ever stared at a complex case has wished for a button that says *show me others like this*.

Today, Parthenon ships that button. The Patient Similarity Engine is a multi-modal matching system that scores patients across six clinical dimensions — demographics, conditions, measurements, drugs, procedures, and genomic variants — with user-adjustable weights, dual algorithmic modes, bidirectional cohort integration, and tiered privacy controls. It works across any OMOP CDM source in the platform, from the 361-patient Pancreatic Cancer Corpus to the million-patient Acumenus CDM.

This post tells the story of why it was needed, what we studied before building it, how it works under the hood, and what we learned along the way.

<!-- truncate -->

---

## The Gap: From Genomic Identity to Clinical Phenotype

Parthenon already had a form of patient similarity. The Molecular Tumor Board (`TumorBoardService`) could find patients sharing pathogenic or likely-pathogenic variants in the same gene. If your index patient carried a BRCA1 p.C61G variant classified as pathogenic by ClinVar, the tumor board would surface every other patient in the corpus with a pathogenic BRCA1 variant, compute median survival, and tally drug exposure patterns among those matches.

It was useful. It was also binary. You either shared a pathogenic variant or you didn't. There was no notion of *degree* of similarity, no consideration of clinical phenotype, no way to ask: "this 62-year-old woman with pancreatic adenocarcinoma, Type 2 diabetes, and BRCA1 — who *else* in our data looks like her, not just genomically, but clinically?"

The gap matters because clinical decisions are rarely made on genomics alone. Two patients with identical BRCA1 mutations but different comorbidity burdens, different lab profiles, and different treatment histories will have vastly different expected outcomes. Precision medicine requires precision *context* — and that context spans every clinical dimension in the OMOP CDM.

---

## Landscape Research: What Exists and What Doesn't

Before writing a single line of code, we studied the landscape. What we found was a fragmented ecosystem where no single system solved the complete problem on OMOP CDM.

### The Oracle Approach: Weighted PageRank

Oracle Healthcare Translational Research offers a "Patients Like Mine" feature that uses **Weighted Personalized PageRank (PPR)** over a bipartite graph of patients and clinical events. Users adjust weights on clinical categories, and the algorithm performs biased random walks personalized toward a seed patient. The output is a ranked list with drill-down comparison views and Kaplan-Meier survival curves.

The design insights worth borrowing: user-adjustable dimension weights (clinicians know what matters for their case), one-to-one comparison views, and integrated survival analysis on the similar cohort.

### The Academic Frontier: Embeddings and Meta-Paths

The research literature offered several promising methodologies:

| Approach | Key Paper | Insight |
|----------|-----------|---------|
| **Patient2Vec** | Zhang et al., IEEE Access 2018 | LSTM + attention over longitudinal EHR produces personalized patient embeddings. 0.799 AUC. MIT-licensed. |
| **S-PathSim** | PMC8456037 | Annotated Heterogeneous Information Networks prevent false associations. nDCG 0.791 on 53K patients. |
| **Transformer Embeddings** | Nature Digital Medicine, 2025 | Treat each patient as a "sentence" of medical concepts. Enables stratification and progression analysis. |
| **Patient Similarity Networks** | Multi-modal fusion, Frontiers AI 2025 | Graph neural networks with early/intermediate/late fusion strategies. Multi-modal significantly outperforms single-modality. |
| **Phe2vec** | Patterns, 2021 | Unsupervised phenotype embeddings from EHR co-occurrence patterns. |

### The OHDSI Ecosystem

The OHDSI community has related tools but nothing purpose-built for patient similarity:

- **CohortMethod** uses propensity score matching — similar in spirit but designed for treatment effect estimation, not general similarity search.
- **ComparatorSelectionExplorer** computes cosine similarity across drug comparator feature vectors — closer, but drug-only and designed for study design, not clinical matching.

### What Was Missing

No open-source system combined these properties:

1. **OMOP-native** — works directly on standard CDM tables without custom ETL
2. **Multi-modal** — fuses demographics, conditions, labs, drugs, procedures, and genomics
3. **User-weighted** — clinicians adjust dimension weights per search
4. **Interpretable** — every score decomposes into per-dimension explanations
5. **Source-agnostic** — works across any CDM source in the platform
6. **Cohort-integrated** — bidirectional flow between similarity and cohort definitions

We decided to build it.

---

## Architecture: Split Responsibility

The biggest design decision was how to divide work between Parthenon's two backend stacks: Laravel (PHP) for application logic and FastAPI (Python) for AI services. After evaluating three architectural options, we chose **Split Responsibility** — each language does what it's best at:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │     │   Laravel    │     │   Python AI      │
│   React SPA  │────▶│   API        │────▶│   Service        │
│              │     │              │     │                  │
│ Weight sliders│     │ Auth/RBAC   │     │ SapBERT encode   │
│ Score bars   │     │ Extraction   │     │ Mean pooling     │
│ Compare view │     │ Scoring      │     │ 512-dim vectors  │
│ Cohort export│     │ Orchestration│     │ Batch embed      │
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
                            │                      │
                     ┌──────▼──────────────────────▼──────┐
                     │         PostgreSQL + pgvector       │
                     │                                     │
                     │  patient_feature_vectors (JSONB)    │
                     │  patient_feature_vectors.embedding  │
                     │  source_measurement_stats           │
                     │  similarity_dimensions              │
                     │  patient_similarity_cache            │
                     └─────────────────────────────────────┘
```

**Laravel** owns feature extraction (reusing the existing `PatientFeatureExtractor` and `FeatureBuilder` patterns), interpretable scoring, auth/RBAC, and caching. **Python** owns SapBERT embedding generation and dense vector computation. **PostgreSQL + pgvector** stores both structured features (JSONB) and dense embeddings (vector(512)) for approximate nearest-neighbor search.

The critical benefit: **interpretable mode works without the Python service.** If the AI container is down, researchers still get full patient similarity via the Jaccard/Euclidean scoring path. The embedding mode adds semantic power when available, but the system degrades gracefully.

---

## The Six Dimensions

Every patient in a CDM source gets a feature vector extracted across six clinical dimensions. Each extraction is tailored to the OMOP data model:

### 1. Demographics

From the `person` table: age (bucketed into 5-year intervals), gender concept, race concept. Scoring uses a composite: 40% age proximity + 40% gender match + 20% race match.

### 2. Conditions

From `condition_occurrence`, rolled up through `concept_ancestor` to three levels of the SNOMED hierarchy. This means "Essential hypertension" and "Hypertensive heart disease" both map to their shared ancestor "Hypertensive disorder" — capturing clinical relatedness, not just exact code matches.

Scoring uses **Jaccard similarity** on the ancestor-rolled concept sets: `|A ∩ B| / |A ∪ B|`. Two patients who share 40 of 50 ancestor conditions score 0.80.

### 3. Measurements / Labs

From `measurement`, taking the most recent value per measurement type per patient. Values are z-score normalized against source-level population statistics (stored in `source_measurement_stats`), so a hemoglobin of 14 g/dL means different things in a source with mean 13.5 vs. 15.0.

Scoring uses **inverse Euclidean distance** on the z-scored values, computed only over measurement types present in *both* patients:

```
score = 1 / (1 + √(mean_squared_diff))
```

### 4. Drugs

From `drug_exposure`, rolled up to the **ingredient level** via `concept_ancestor` joined to `concept` where `concept_class_id = 'Ingredient'`. This collapses brand names, formulations, and dosage forms into their active ingredients — "Metformin 500 mg tablet" and "Glucophage XR 1000 mg" both become *Metformin*.

Scoring: Jaccard on ingredient-level concept sets.

### 5. Procedures

From `procedure_occurrence`, using distinct procedure concept IDs. No rollup — procedure hierarchies are flatter than condition or drug hierarchies, and exact procedure matching is clinically meaningful.

Scoring: Jaccard on procedure concept sets.

### 6. Genomic Variants

From `genomic_variants` (Parthenon's app-schema table linking VCF-parsed variants to OMOP person IDs). Each variant is represented as a (gene, pathogenicity) tuple.

Scoring uses **pathogenicity-tiered weighted overlap**: pathogenic variants score 3x, likely-pathogenic 2x, VUS 1x. Two patients sharing a pathogenic BRCA1 variant is a stronger match than sharing a VUS in a less actionable gene.

---

## The Missing-Dimension Problem (and Its Elegant Solution)

Not every CDM source has every dimension. SynPUF (CMS synthetic data) has conditions, drugs, and procedures but no lab values and no genomic data. The Pancreatic Cancer Corpus has conditions, drugs, and measurements but no procedures and no genomics (yet). Acumenus CDM has everything except genomics.

A naive approach would give SynPUF patients a 0 on measurements and genomics, penalizing them unfairly. Our approach: **missing dimensions reduce the denominator, not the score.**

```
available_dims = dimensions where BOTH patients have data
score = Σ(weight × dim_score) / Σ(weight)    for dims in available_dims
```

Each patient's feature vector carries a `dimensions_available` array tracking which dimensions have data. When comparing two patients, the scorer only includes dimensions that are available to *both* — and the weighted average divides only by the weights of those included dimensions.

This means a SynPUF patient with perfect condition/drug overlap and the same demographics can score 0.95 against another SynPUF patient, even though neither has lab values or genomic data. The score honestly represents the similarity across the data that *exists*.

---

## Dual Scoring Modes: Interpretable vs. Embedding

The engine supports two algorithmic modes, togglable in the UI:

### Interpretable Mode (Pure SQL)

Every candidate in the source is scored against the seed patient using the six dimension scorers described above. This is a brute-force scan — for each candidate, compute weighted Jaccard/Euclidean across all available dimensions, sum, rank. On the Pancreatic Cancer Corpus (361 patients), this takes ~200ms. On Acumenus (1M patients), it's slower but still feasible for pre-filtered queries.

**Why it matters:** every score is fully decomposable. A researcher can see that patient 341 scored 0.87 because demographics were a perfect match (1.0), conditions overlapped 89.8%, labs were moderately similar (0.60), and drugs were identical (1.0). There is no black box.

### Embedding Mode (pgvector ANN + Re-ranking)

For larger populations, the engine offers a two-stage approach:

1. **Stage 1: Approximate Nearest Neighbors.** Each patient's structured features are sent to the Python AI service, which encodes them into a 512-dimensional dense vector using SapBERT concept embeddings. Demographics get 32 dimensions, conditions get 128, measurements get 64, drugs get 128, procedures get 96, and genomics get 64. The resulting vector is L2-normalized and stored in pgvector with an IVFFlat index for cosine distance search.

   A single pgvector ANN query retrieves the top 200 candidates in milliseconds, even at 1M patients:
   ```sql
   SELECT person_id, 1 - (embedding <=> ?::vector) AS cosine_similarity
   FROM patient_feature_vectors
   WHERE source_id = ? AND person_id != ? AND embedding IS NOT NULL
   ORDER BY embedding <=> ?::vector
   LIMIT 200
   ```

2. **Stage 2: Re-ranking.** The 200 ANN candidates are re-ranked using the *same interpretable scorers* from mode 1. This means the final results have identical per-dimension score breakdowns regardless of which mode was used. The only difference is how candidates were selected — brute-force scan vs. ANN approximation.

The SapBERT encoding is what makes embedding mode genuinely better than fast Jaccard for semantic matching. SapBERT (a PubMedBERT-based biomedical language model) encodes concept names into 768-dimensional vectors where semantically related concepts are close — "Type 2 diabetes mellitus" and "Insulin resistance" have high cosine similarity even though they share no OMOP ancestor concepts. By mean-pooling SapBERT embeddings across a patient's condition set, the resulting vector captures the *gestalt* of their clinical profile, not just the discrete concepts.

---

## Bidirectional Cohort Integration

Patient similarity doesn't live in a vacuum — it feeds into and draws from Parthenon's cohort system.

### Similarity → Cohort (Export)

After running a similarity search, researchers can click "Export as Cohort" to save the result set as a new cohort definition. They set a minimum similarity score threshold, name the cohort, and the engine writes the matching person_ids into `results.cohort`. From there, the cohort is available for characterization, estimation, prediction, pathways — every analysis tool in Parthenon.

This enables a workflow that wasn't possible before: *start with a patient, find similar ones, export them as a cohort, run a Kaplan-Meier analysis on that cohort.* Clinical hypothesis generation driven by concrete clinical intuition rather than abstract inclusion criteria.

### Cohort → Similarity (Seed)

The reverse flow is equally powerful. Instead of "find patients similar to *this person*," researchers can ask "find patients similar to *this cohort*." The engine computes a centroid — the average feature vector across all cohort members — and searches for patients near that centroid.

The centroid is constructed differently for each mode:
- **Interpretable:** Union of member conditions/drugs/procedures, mean of lab z-scores, median age, mode gender/race. A "virtual patient" representing the cohort's composite phenotype.
- **Embedding:** Mean of member 512-dim embeddings. Mathematically equivalent to the centroid of the cohort in embedding space.

This supports cohort enrichment: start with a small, well-characterized cohort, find similar patients to expand it, validate the expanded cohort against the original inclusion criteria.

---

## Tiered Privacy: HIPAA-Friendly by Default

Parthenon handles OMOP CDM data that may include PHI under HIPAA. The similarity engine respects this with tiered access control:

- **Default (patient-similarity.view):** Results show overall and per-dimension scores, age/gender summaries, and condition/drug counts — but no person_ids, no named conditions, no named drugs. Aggregate-level similarity without patient identification.
- **With profiles.view:** Full person-level results including person_ids (clickable to Patient Profile), named shared conditions, named shared drugs, and the Compare view for head-to-head analysis.

The tiering is enforced at the controller level — the service always computes full results, but the controller strips person-level fields before responding to users without `profiles.view` permission.

---

## The Data Model

Four new tables in the `app` schema:

```sql
patient_feature_vectors     — One row per patient per source. Demographics,
                              condition/drug/procedure concept arrays (JSONB),
                              z-scored lab vector, genomic variants, 512-dim
                              pgvector embedding, dimensions_available.
                              Unique on (source_id, person_id).

source_measurement_stats    — Population-level measurement statistics per source.
                              Mean, stddev, n_patients, quartiles per measurement
                              concept. Used for z-score normalization.

similarity_dimensions       — Admin-configurable dimension definitions with default
                              weights. Six seeded dimensions, extensible.

patient_similarity_cache    — Result caching keyed on (source, person, mode,
                              weights_hash). 1-hour TTL. Prevents redundant
                              computation for identical queries.
```

The `patient_feature_vectors` table carries both structured data (for interpretable scoring) and the dense embedding (for ANN search) in the same row. This co-location means a single query can filter by demographics, retrieve the embedding for ANN, and return structured features for re-ranking — no joins required.

---

## Feature Extraction at Scale

The `ComputePatientFeatureVectors` Horizon job processes patients in batches of 500. For each batch:

1. **Demographics** from `person` table — age bucketed into 5-year intervals
2. **Conditions** from `condition_occurrence` joined to `concept_ancestor` (0-3 levels of separation) — ancestor rollup
3. **Measurements** from `measurement` — latest value per concept, z-scored against `source_measurement_stats`
4. **Drugs** from `drug_exposure` joined to `concept_ancestor` and `concept` — ingredient-level rollup
5. **Procedures** from `procedure_occurrence` — distinct procedure concepts
6. **Genomics** from `genomic_variants` — gene/pathogenicity tuples

On the Pancreatic Cancer Corpus (361 patients), full extraction takes **3 seconds**. The Acumenus CDM (1 million patients) processes at approximately **8,000 patients per minute** — around 2 hours for the full population. The measurement statistics (top 50 measurement types by patient count, minimum 10 patients, non-zero standard deviation) are computed once upfront and take 5-10 seconds.

The job is idempotent — it uses `updateOrCreate` on the (source_id, person_id) unique key, so re-running it on the same source updates existing vectors and adds new patients without duplicates.

---

## What We Reused (and Why It Matters)

One of the most satisfying aspects of this build was how much existing Parthenon infrastructure we could leverage:

| Existing Component | How We Reused It |
|-------------------|------------------|
| `PatientFeatureExtractor` (PopulationRisk) | Pattern for demographics/conditions/measurements extraction |
| `FeatureBuilderInterface` (Analysis/Features) | Modular feature extraction pattern with 6 implementations |
| `SapBERT service` (ai/services/sapbert.py) | Core of embedding generation — encode concept names to 768-dim vectors |
| `pgvector` + `search_nearest` pattern | Already deployed for concept embeddings, extended for patient embeddings |
| `SourceContext` | Dynamic schema isolation — one codebase works across all CDM sources |
| `ConceptResolutionService` | Ancestor concept rollup for condition/drug hierarchies |
| Horizon queue infrastructure | Background job processing with monitoring via dashboard |
| `PatientProfileService` | Integrated for contextual "Find Similar" entry point |
| Spatie RBAC | Permission-based tiered access (patient-similarity.view, profiles.view) |

We didn't build a similarity engine from scratch. We built a new *composition* of capabilities that Parthenon had been developing for months — embeddings, vector search, feature extraction, schema isolation, RBAC — and surfaced them through a new lens.

---

## The API Surface

Seven endpoints behind `auth:sanctum` with Spatie RBAC:

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| POST | `/patient-similarity/search` | patient-similarity.view | Single-patient similarity search |
| POST | `/patient-similarity/search-from-cohort` | patient-similarity.view + cohorts.view | Cohort-seeded similarity search |
| GET | `/patient-similarity/compare` | patient-similarity.view + profiles.view | Head-to-head patient comparison |
| POST | `/patient-similarity/export-cohort` | patient-similarity.view + cohorts.create | Export results as cohort definition |
| GET | `/patient-similarity/dimensions` | patient-similarity.view | List configurable dimensions |
| POST | `/patient-similarity/compute` | patient-similarity.compute | Trigger feature extraction |
| GET | `/patient-similarity/status/{sourceId}` | patient-similarity.view | Extraction status + staleness |

The search endpoint accepts user-adjustable weights:

```json
{
  "person_id": 1,
  "source_id": 47,
  "mode": "interpretable",
  "weights": {
    "demographics": 1.0,
    "conditions": 3.0,
    "measurements": 2.0,
    "drugs": 1.0,
    "procedures": 1.0,
    "genomics": 5.0
  },
  "limit": 25,
  "min_score": 0.3
}
```

Boosting genomics to 5.0 makes the engine prioritize shared variant profiles. Zeroing out demographics removes age/gender/race from the scoring entirely. The weights are fully user-controlled, per-search.

---

## Validation Results

### Pancreatic Cancer Corpus (361 patients, 4 dimensions)

| Metric | Value |
|--------|-------|
| Extraction time | 3 seconds |
| Search latency (interpretable) | ~200ms |
| Dimensions available | demographics, conditions, measurements, drugs |
| Top match for person_id=1 | Person 341: 0.87 overall (demo 1.0, conditions 0.90, labs 0.60, drugs 1.0) |
| Missing dimensions | procedures (null), genomics (null) — correctly excluded from scoring |

Custom weight validation: boosting conditions to 3.0 correctly reranked Person 141 (95.9% condition overlap) above Person 341 (89.8% conditions but perfect demographics).

### Acumenus CDM (1M patients, 5 dimensions)

| Metric | Value |
|--------|-------|
| Extraction rate | ~8,000 patients/minute |
| Dimensions available | demographics, conditions, measurements, drugs, procedures |
| Top match for person_id=1 | Person 985: 0.72 overall (demo 0.80, conditions 0.82, labs 0.53, drugs 0.58, procedures 0.86) |
| Missing dimensions | genomics (null) — correctly excluded |

The lower overall scores on Acumenus are expected — with a million diverse patients, even the best match will have more divergence than in a specialized 361-patient corpus.

---

## The Frontend Experience

The Patient Similarity page follows Parthenon's dark clinical theme and offers:

- **Search form** with source selector, patient ID input, and dimension weight sliders (0-5, step 0.5)
- **Mode toggle** between Interpretable and Embedding
- **Results table** with ranked patients, overall score, and per-dimension score bars (teal >0.7, gold >0.4, grey below)
- **Compare link** on each result row for head-to-head patient analysis
- **Staleness indicator** showing when feature vectors were last computed with a "Recompute" action
- **Search mode toggle** between "Single Patient" and "From Cohort" for both entry workflows
- **Export as Cohort** button for saving result sets as cohort definitions

Contextual entry points are embedded throughout the platform:
- **Patient Profile page:** a "Find Similar Patients" button pre-fills the search with the current patient and source
- **Cohort Definitions:** a "Find Similar to Cohort" action opens the similarity page in cohort-seed mode

---

## What's Next

The engine ships today with Phases 1-4 complete. Phase 5 remains as a backlog of advanced capabilities:

1. **Temporal similarity** — consider *when* conditions, treatments, and events occurred relative to each other, not just *which* ones
2. **Imaging radiomics** — tumor volumetrics and radiomic features from DICOM via Orthanc
3. **Clinical notes NLP** — embed `note_nlp` content for text-based phenotype matching
4. **Learned patient embeddings** — train a Patient2Vec or transformer model on Parthenon's CDM data for temporal-aware embeddings
5. **Weighted Personalized PageRank** — implement the Oracle PLM graph algorithm as an alternative to vector-based scoring
6. **Cross-source federated similarity** — find patients in the Pancreatic Cancer Corpus who are similar to an Acumenus patient, blending data across CDM sources without co-locating patient records
7. **Tumor Board integration** — the Molecular Tumor Board's existing genomic matching will be unified with the similarity engine, so clinicians see genomic *and* clinical similarity in one view

---

## Conclusion

The Patient Similarity Engine is the kind of feature that seems obvious in retrospect — of course a research platform should let you find similar patients across all available clinical dimensions. But implementing it correctly required solving a specific, non-trivial composition of challenges: multi-modal feature extraction from OMOP CDM, missing-dimension tolerance, dual algorithmic approaches with shared interpretability, bidirectional cohort integration, HIPAA-conscious tiered access, and source-agnostic architecture that works from 361 patients to 1 million.

What makes this a milestone for Parthenon isn't the similarity scoring itself — Jaccard and cosine distance have been around for decades. It's the *integration*. Patient similarity is woven into the cohort builder, the patient profile, the tumor board, and the permission system. It's not a standalone tool bolted onto the side. It's a new lens through which every other capability in the platform becomes more powerful.

Thirteen commits. Four phases. Six dimensions. One button: **Find Similar Patients.**
