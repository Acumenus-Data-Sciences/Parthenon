# Patient Similarity Evaluation Report

Date: 2026-04-04

## Executive Summary

Parthenon's Patient Similarity module has a solid architectural foundation:

- OMOP-native feature extraction
- precomputed patient vectors
- interpretable per-dimension scores
- optional embedding retrieval
- cohort export and cohort-seeded search concepts
- source-aware routing and permission-aware redaction

However, the current implementation is not yet at the level expected by modern healthcare outcomes researchers. The main issues are:

1. The methodology is still a mostly static heuristic engine rather than a modern longitudinal patient representation system.
2. Several frontend/backend contract mismatches make the page bug-prone in normal use.
3. Large-source search behavior is not methodologically neutral; it hard-biases by demographics in ways that can suppress clinically valid matches.
4. The product lacks the evaluation, diagnostics, provenance, and outcome-analysis workflows that make similarity systems trustworthy for serious research.

My overall recommendation is not to replace the current engine outright. The right path is a hybrid redesign:

- keep interpretable domain scoring as the explanation layer
- upgrade the interpretable feature model to use temporal windows and richer covariates
- add modern longitudinal embeddings as the retrieval layer
- build a formal evaluation framework around retrieval quality, outcome utility, transportability, fairness, and stability

## Current Implementation: What Is Good

The current codebase has several strong points worth preserving:

- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php` already supports a two-stage pattern: candidate retrieval followed by interpretable re-ranking.
- `backend/app/Services/PatientSimilarity/SimilarityFeatureExtractor.php` is OMOP-native and portable across sources.
- `backend/app/Services/PatientSimilarity/SimilarityExplainer.php` already produces human-readable explanations and shared-feature summaries.
- `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx` supports single-patient search, cohort-seeded search, and cohort comparison.
- `frontend/src/features/patient-similarity/components/StalenessIndicator.tsx` exposes refresh state and makes feature freshness visible.
- The tiered access model in `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php` is directionally correct for research environments with mixed access levels.

In short: the scaffolding is good. The methodology and product behavior need to catch up.

## Observed Implementation Defects

These are not theoretical concerns. They are concrete issues in the current code.

### 1. Filter contracts are broken across frontend, validation, and service layers

Observed behavior:

- `frontend/src/features/patient-similarity/components/SimilaritySearchForm.tsx:93-105` sends `filters.age_min`, `filters.age_max`, and `filters.gender`.
- `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx:70-82` sends the same shape.
- `backend/app/Http/Requests/PatientSimilaritySearchRequest.php:25-29` validates `filters.age_range` and `filters.gender_concept_id`.
- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:333-346` expects `age_range`, but as an object with `min` and `max`.
- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:387-390` expects `age_range` as a 2-element array.

Impact:

- age and gender filters are effectively unreliable
- the same filter concept has three incompatible schemas
- embedding mode and interpretable mode do not consume filters the same way

This is a major reason the page feels error-prone.

### 2. Cohort metadata is returned in one place and read from another

Observed behavior:

- `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php:271-281` returns cohort name and member count in top-level `meta`.
- `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx:154-173` reads cohort information from `result.metadata`.

Impact:

- cohort header context is lost
- "Add to cohort" behavior becomes fragile
- the page quietly drops important context after cohort-seeded search

### 3. Cohort export is wired to a cache ID the page never receives

Observed behavior:

- `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx:161-162` expects `metadata.cache_id`.
- search responses do not currently place `cache_id` in `result.metadata`.
- `frontend/src/features/patient-similarity/components/CohortExportDialog.tsx:31-37` submits `cache_id`.
- `backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php:18-21` requires a valid `cache_id`.

Impact:

- export can fail even when the page appears export-ready

### 4. Cohort export description field is mismatched

Observed behavior:

- `frontend/src/features/patient-similarity/components/CohortExportDialog.tsx:33-36` submits `description`.
- `backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php:21` validates `cohort_description`.
- `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php:321` reads `cohort_description`.

Impact:

- user-entered descriptions are dropped

### 5. `auto` mode is inconsistent with the status API

Observed behavior:

- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:94-99` switches `auto` to embedding mode if the count of rows with embeddings exceeds the in-memory threshold.
- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:586-589` recommends embedding mode only when embeddings are fully ready.

Impact:

- partial embedding coverage can silently change search mode
- the UI can recommend one mode while the service chooses another

### 6. Large-source interpretable search hard-filters by demographics before scoring

Observed behavior:

- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:248-271` limits candidates to same gender and age bucket +/- 15 years before any full scoring.
- This path does not use dimension weights, does not honor zero-weight demographics, and does not match its own comments about SQL pre-scoring on conditions/drugs.

Impact:

- clinically plausible matches can be dropped before ranking
- results are biased toward demographic similarity even when the user intends otherwise
- behavior diverges materially from the documented design

### 7. Large-source cohort search takes an arbitrary subset

Observed behavior:

- `backend/app/Services/PatientSimilarity/PatientSimilarityService.php:467-484` adds demographic restrictions and `limit(...)`, but no `orderBy(...)`, before loading candidates.

Impact:

- for large cohorts, candidate selection can depend on database row order
- results can be unstable and non-reproducible

### 8. Demographics scoring overweights exact matches and uses race as a crude exact-match bonus

Observed behavior:

- `backend/app/Services/PatientSimilarity/Scorers/DemographicsScorer.php:19-48` uses a fixed formula with exact gender and exact race matches contributing 60% of the demographic score.

Impact:

- coarse demographic exact matching can dominate clinically relevant domains
- exact race matching is methodologically weak and fairness-sensitive
- this is not aligned with modern transportable similarity modeling

## Methodological Gap vs. Modern Best Practice

## What Modern Systems Actually Do

Modern patient-similarity work is not converging on one universal model, but it is converging on a few patterns:

1. Longitudinal representation matters.
2. Multi-modal fusion matters.
3. Interpretable explanations are still required.
4. External validation, temporal robustness, and subgroup analysis are mandatory if the tool is intended for real research use.

### 1. Static set overlap is now baseline, not state of the art

The current engine is mostly:

- condition/drug/procedure set overlap
- simple lab z-score distance
- simple demographic matching

That is reasonable as an initial baseline, but modern systems increasingly use longitudinal sequence representations or richer time-aware covariates.

Relevant examples:

- CEHR-BERT provides an OMOP-oriented structured EHR transformer framework with explicit temporal tokenization and an end-to-end evaluation framework.
- The 2025 transformer patient embedding paper evaluated patient embeddings across internal and external datasets and benchmarked against Deep Patient and BEHRT.
- CLMBR/FEMR emphasizes robustness under temporal distribution shift and standardized evaluation of learned patient representations.

Implication for Parthenon:

- keep the current heuristic engine as a transparent baseline
- do not position it as a modern endpoint

### 2. Temporal windows are missing from the current feature model

The strongest recent classical methodology I found for observational-health research is not "use one giant embedding and hope." It is to split the patient state into clinically meaningful temporal domains and compare them separately.

The 2025 comparator-selection work used five clinically oriented domains:

- demographics
- medical history
- presentation
- prior medications
- visit context

Similarity was computed as domain-wise cosine similarity on high-dimensional covariate prevalence vectors, then averaged across domains.

Parthenon currently collapses too much:

- conditions are a single ancestor-rolled set
- drugs are a single ingredient set
- procedures are a single set
- labs are only latest value per concept

Missing entirely:

- recency vs chronicity
- index-period presentation
- utilization/visit context
- trajectory features
- persistence and intensity
- condition onset sequencing
- treatment line / switching behavior

### 3. Cohort centroid = union of features is too blunt

`backend/app/Services/PatientSimilarity/CohortCentroidBuilder.php:62-95` creates cohort centroids by taking unions of conditions, drugs, procedures, and genomics, plus average labs.

That is easy to implement, but methodologically weak:

- unions make heterogeneous cohorts look artificially broad
- rare features from any single member become part of the "prototype"
- disease mixtures can create implausible synthetic patients

Modern alternatives:

- medoid or exemplar selection
- sparse centroid with prevalence thresholds
- multiple prototypes per cohort
- cluster-aware cohort representation
- averaged dense embeddings plus interpretable cohort summaries

### 4. Outcomes researchers expect balance diagnostics, not just similarity scores

For observational studies, a useful "similar patient" or "similar cohort" engine must support validity checks such as:

- standardized mean differences (SMDs)
- overlap diagnostics
- prevalence plots by domain
- missingness comparison
- sensitivity to thresholds
- subgroup consistency

OHDSI tooling is strong here. `FeatureExtraction`, `CohortMethod`, and related comparator-selection work show a more research-grade pattern:

- derive rich baseline covariates
- compare populations in high-dimensional covariate space
- report balance and overlap explicitly

Parthenon currently gives users a score, some bars, and a few shared concepts. That is useful for exploration, but not enough for study design.

### 5. External validation and temporal robustness are now expected

This is a major gap.

The 2026 JAMIA systematic review of structured-EHR foundation models found:

- only 26% of studies evaluated transfer to external datasets
- none described clinical deployment
- methodological and reporting practices remain fragmented

That review does not imply "foundation models are bad." It implies that serious teams now treat transportability and reporting rigor as first-class requirements.

Parthenon currently has no visible evaluation harness for:

- cross-source generalization
- temporal drift
- subgroup fairness
- score stability
- threshold sensitivity

### 6. Fairness and transportability need to be explicit

The current implementation includes race as an exact-match component and uses demographic narrowing as a large-source retrieval shortcut. That may improve apparent similarity in some contexts, but it creates methodological and governance risks:

- demographic shortcuts may hide clinically relevant cross-group matches
- exact-match race bonuses are difficult to defend analytically
- fairness behavior is not monitored

The fairness literature on patient representation learning now treats subgroup behavior as something to measure, not assume.

## Open Source and Literature Worth Borrowing From

## Highest-value methodology references

### 1. OHDSI comparator similarity / feature extraction

Why it matters:

- directly relevant to outcomes research
- high-dimensional baseline covariates
- domain-wise similarity
- explicit evaluation against covariate balance and literature comparators

Best reuse ideas:

- use richer temporal domains
- compute domain-level covariate prevalence vectors
- add SMD-style balance diagnostics for candidate cohorts

### 2. CEHR-BERT and related OMOP/MEDS sequence models

Why it matters:

- OMOP-compatible ecosystem
- explicit temporal representation
- sequence-based patient embeddings
- end-to-end fine-tuning and evaluation workflows

Best reuse ideas:

- visit-aware timelines
- time-gap encoding
- longitudinal embeddings as retrieval candidates

### 3. FEMR + MEDS

Why it matters:

- practical tooling for large-scale self-supervised EHR learning
- strong focus on evaluation and standardized data representation
- path from OMOP to modern foundation-model pipelines

Best reuse ideas:

- cleaner offline research pipeline
- reproducible representation-learning experiments
- benchmark harness for future embedding models

### 4. PyHealth and ehrapy

Why they matter:

- broad experimentation stacks
- many healthcare models already implemented
- useful for fast prototyping and internal benchmarking

Best reuse ideas:

- rapid bake-off between RETAIN/Transformer/GRASP/ConCare-style models
- common evaluation code and task definitions

### 5. netDx

Why it matters:

- interpretable patient similarity networks
- multimodal integration
- clinically intuitive "patients like this" framing

Best reuse ideas:

- multi-network fusion
- feature-level interpretability
- patient-similarity graphs rather than flat score lists

### 6. PMC-Patients

Why it matters:

- explicit patient-to-patient retrieval benchmark
- ready-made retrieval metrics and evaluation framing

Best reuse ideas:

- adopt retrieval metrics such as nDCG, MAP, Recall@K, Precision@K
- structure Parthenon's offline evaluation like a retrieval benchmark, not just a classifier benchmark

## Recommended Methodological Improvements

## Priority 1: Harden the current interpretable engine

Before adding a new model, fix the current system so researchers can trust its mechanics.

Required changes:

- unify filter schema across frontend, request validation, interpretable search, and embedding search
- return a canonical response shape so cohort metadata and cache IDs are always where the UI expects them
- remove arbitrary large-source candidate narrowing that ignores user weights
- make large-source cohort search deterministic
- add search provenance to every result:
  - retrieval mode
  - candidate pool size
  - filters applied
  - dimensions actually used
  - feature-vector version
  - compute timestamp

## Priority 2: Upgrade the interpretable feature model

This is the highest-value methodological upgrade short of full foundation-model adoption.

Recommended redesign:

- replace single condition/drug/procedure sets with temporal windows:
  - baseline history
  - recent presentation
  - active treatment window
  - long-term chronic burden
- replace "latest lab only" with robust summaries:
  - recent median
  - slope/trend
  - abnormality flags
  - variability
  - missingness indicators
- add visit-context features:
  - inpatient
  - ED
  - ICU
  - utilization density
- add severity proxies:
  - polypharmacy
  - procedure intensity
  - comorbidity burden
  - recent acute events

Scoring approach:

- domain-specific cosine similarity or soft Jaccard on richer feature vectors
- keep per-domain interpretability
- use weights as true ranking weights, not as decorations after demographic prefiltering

## Priority 3: Add a modern longitudinal embedding layer

The current embedding mode is mostly an acceleration strategy. It should evolve into a real patient-representation layer.

Recommended architecture:

1. Build an offline research pipeline using OMOP -> MEDS or OMOP-native sequences.
2. Benchmark several sequence models:
   - CEHR-BERT-style transformer
   - CLMBR/FEMR-style foundation representation
   - RETAIN-like interpretable sequence baseline
   - simpler sequence pooling baseline
3. Use dense embeddings only for candidate retrieval.
4. Keep interpretable re-ranking and explanations in Laravel.

This hybrid pattern is the most defensible near-term design:

- fast retrieval
- modern longitudinal signal
- interpretable final ranking

## Priority 4: Replace single cohort centroids with prototype-based cohort search

Recommended cohort representations:

- medoid patient
- top-N exemplars
- cluster prototypes
- sparse prevalence-threshold centroid
- averaged embedding centroid for ANN retrieval

Recommended workflow:

- let users choose between:
  - medoid/exemplar search
  - centroid search
  - "find patients unlike the comparison cohort but like the source cohort"

This is especially important for heterogeneous oncology and multimorbidity cohorts.

## Priority 5: Add formal evaluation and diagnostics

This is the biggest missing capability for research credibility.

Recommended offline evaluation framework:

### Retrieval quality

- Precision@K
- Recall@K
- MAP
- nDCG
- MRR where appropriate

Ground truths:

- same curated phenotype
- known treatment comparator cohorts
- expert-labeled similar/dissimilar pairs
- matched downstream outcomes

### Outcome utility

- covariate balance when using similar-patient cohorts as comparator candidates
- survival separation where clinically expected
- treatment-pattern coherence
- subgroup phenotype enrichment

### Robustness

- cross-source validation
- temporal validation by calendar year
- bootstrap stability of neighbor sets
- threshold sensitivity curves

### Fairness and governance

- subgroup performance by age, sex, race/ethnicity, source
- missingness-stratified performance
- audit of how demographic variables influence final ranking

## UX and Researcher Experience Enhancements

## What the page lacks today

The current UI is functional but not research-grade. It primarily answers:

- who are the top matches?

Modern researcher tools also answer:

- why are they matches?
- how stable are the matches?
- what definition of similarity did I just use?
- what happens to outcomes if I use these patients as a cohort?
- how do I defend this selection analytically?

## Recommended UX improvements

### 1. "Why this patient?" panel

For every result, show:

- strongest positive similarity contributors
- strongest mismatch contributors
- timeline snippets for recent diagnoses, treatments, and labs
- modality coverage
- missingness warnings

### 2. Similarity configuration as a first-class object

Allow users to save/share named similarity profiles:

- oncology molecular similarity
- cardiometabolic phenotype similarity
- utilization comparator search
- treatment-history heavy search

Each saved profile should store:

- weights
- feature domains
- temporal windows
- inclusion/exclusion rules
- version of feature extractor

### 3. Research diagnostics tab

For any search result set, show:

- score distribution
- dimension contribution distribution
- cohort balance versus seed/cohort
- missingness comparison
- demographics composition
- threshold sensitivity

### 4. Outcome analysis tab

Users will expect:

- Kaplan-Meier curves
- incidence plots
- treatment pathway summaries
- event rates
- follow-up distributions

This is especially important because your own internal design docs already position outcomes analysis as part of the intended value.

### 5. Better cohort-seeded search UX

Current cohort search is conceptually promising but should expose:

- search strategy: medoid, centroid, exemplar, cluster prototype
- preview of cohort heterogeneity
- warning when the cohort is multi-modal and a single centroid is a bad summary

### 6. Provenance and reproducibility

Every result page should expose:

- search definition ID
- source ID and snapshot date
- feature vector version
- embedding model version
- evaluation badge or confidence note

Researchers need to be able to reproduce exactly what they saw.

## Recommended Product Roadmap

## Phase 1: Reliability and contract fixes

- fix all request/response mismatches
- add deterministic large-source selection
- expose cache IDs and canonical metadata
- add provenance fields
- add tests covering real request shapes

## Phase 2: Interpretable engine v2

- temporal windows
- richer lab summaries
- utilization context
- prevalence/cosine domain scoring
- cohort diagnostics and SMD views

## Phase 3: Embedding engine v2

- benchmark CEHR-BERT / CLMBR-style representations
- use dense retrieval + interpretable reranking
- compare against current heuristic baseline on retrieval and downstream utility

## Phase 4: Research-grade UX

- saved similarity profiles
- why-this-patient explanations
- cohort diagnostics
- outcomes tab
- prototype-based cohort search

## Final Assessment

Parthenon's Patient Similarity implementation is promising but not yet publication-grade, comparator-design-grade, or strong enough for demanding healthcare outcomes researchers.

The good news is that the codebase is not starting from zero. The existing architecture already supports the right high-level direction:

- precompute features
- retrieve candidates
- rerank interpretably
- expose cohort workflows

The next step should not be cosmetic polish. It should be a deliberate upgrade from:

- static heuristic matching with fragile page contracts

to:

- validated longitudinal patient retrieval with interpretable reranking, cohort diagnostics, and research-grade provenance

That would turn this page from an interesting exploratory feature into a defensible analytical tool.

## Verification Notes

I ran the frontend patient-similarity tests:

- `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityPage.test.tsx`
- `frontend/src/features/patient-similarity/components/__tests__/SimilarPatientTable.test.tsx`

They passed.

I did not run backend patient-similarity tests because the repository blocks `php artisan test` against the protected `parthenon` database in the current environment.

## Sources

- OHDSI FeatureExtraction: https://github.com/OHDSI/FeatureExtraction
- Bohn et al., 2025, large-scale cohort similarity for comparator selection: https://pmc.ncbi.nlm.nih.gov/articles/PMC12515211/
- CEHR-BERT: https://github.com/cumc-dbmi/cehrbert
- FEMR: https://github.com/som-shahlab/femr
- MEDS organization: https://github.com/Medical-Event-Data-Standard
- PyHealth: https://github.com/sunlabuiuc/PyHealth
- ehrapy: https://github.com/theislab/ehrapy
- netDx paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC6423721/
- Transformer patient embedding paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC12354887/
- CLMBR temporal robustness paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC9992466/
- PMC-Patients benchmark: https://github.com/pmc-patients/pmc-patients
- Parimbelli et al., patient similarity systematic review: https://pubmed.ncbi.nlm.nih.gov/29864490/
- Guo et al., 2026 systematic review of structured-EHR foundation models: https://academic.oup.com/jamia/advance-article-pdf/doi/10.1093/jamia/ocag033/67357766/ocag033.pdf
