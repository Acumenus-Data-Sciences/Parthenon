---
slug: patient-similarity-v2-research-grade
title: "From Jaccard to Network Fusion: How Parthenon's Patient Similarity Engine Became Research-Grade"
authors: [mudoshi, claude]
tags: [patient-similarity, omop, propensity-scores, umap, clustering, snf, dtw, cohort-comparison, precision-medicine, architecture, ai, ohdsi]
date: 2026-04-10
---

Eight days ago, we [shipped the Patient Similarity Engine](/blog/patient-similarity-engine) — a multi-modal system that scores patients across six clinical dimensions using weighted Jaccard, z-scored lab distances, and pathogenicity-tiered genomic matching. Two days later, we [generated embeddings for a million patients](/blog/patient-embeddings-at-scale). The engine worked. Researchers could find patients like a seed patient, compare cohorts, and export results.

But it wasn't *research-grade*. The Jaccard similarity was binary — two patients with Type 1 DM and Type 2 DM got zero credit even though they share the ancestor "Diabetes mellitus" in the SNOMED hierarchy. The cohort comparison showed a radar chart with divergence percentages, but couldn't tell you *which* covariates were driving the imbalance or *how* the distributions actually differed. There was no propensity scoring, no temporal analysis, no phenotype discovery, and no way to fuse multiple data modalities into a single principled similarity measure.

Tonight, in a single session, we shipped eight interconnected upgrades that transform the Patient Similarity Engine from a useful clinical tool into a research platform that exceeds the analytical capabilities of OHDSI Atlas, Oracle Healthcare's "Patients Like Mine," and every open-source OMOP similarity system we've been able to find.

This is the story of what we built, why each piece matters, and how they work together.

<!-- truncate -->

---

## The Problem: Flat Similarity in a Hierarchical World

The original Patient Similarity Engine had a fundamental limitation baked into its core algorithm. When computing similarity between two patients' condition profiles, it used Jaccard set similarity on concept IDs:

`J(A, B) = |A ∩ B| / |A ∪ B|`

This works beautifully when two patients share the *exact same* diagnosis codes. But medicine is hierarchical. SNOMED CT organizes clinical concepts into a directed acyclic graph where "Type 2 diabetes mellitus" (201826) and "Type 1 diabetes mellitus" (201254) are siblings under the parent "Diabetes mellitus" (201820). A patient with Type 2 DM and a patient with Type 1 DM share zero concepts in a flat comparison — their Jaccard score for the diabetes dimension is 0.0, as if one had diabetes and the other had a broken arm.

This isn't an edge case. It's the *common* case. Clinical coding produces a long tail of specific codes that rarely match exactly across patients. The more precisely you code, the worse flat similarity performs. This is an irony that anyone who has worked with real-world OMOP data will recognize: the CDM's vocabulary richness, which is its greatest strength for precision analytics, becomes a liability for similarity computation.

The same problem extended to drugs (brand vs. generic vs. ingredient) and procedures (specific technique vs. general category). Our feature extractor already did some ancestor expansion — rolling conditions up 0-3 levels and drugs to ingredient class — but the Jaccard itself was still binary. A concept either matched or it didn't. There was no notion of *partial credit* for hierarchical proximity.

---

## Upgrade 1: Hierarchical Concept Similarity

The fix required changing two things: the feature representation and the similarity computation.

### Ancestor-Aware Feature Vectors

Previously, the feature extractor stored concept arrays as flat integer lists: `[201826, 4120002, 4045900]`. Now it stores them as associative maps of `concept_id => min_levels_of_separation`:

```php
// Before: flat list
[201826, 201254, 4120002]

// After: concept => depth from original code
[
    201826 => 0,  // Type 2 DM (leaf concept, exact match)
    201820 => 1,  // Diabetes mellitus (parent, 1 level up)
    201254 => 0,  // Type 1 DM (leaf concept)
    73211009 => 2 // Endocrine disorder (grandparent, 2 levels up)
]
```

This representation captures the full ancestry path. Each concept carries its distance from the original clinical code, enabling depth-weighted scoring. The feature extractor queries `vocab.concept_ancestor` to expand each clinical concept up to 3 levels of separation, keeping the minimum level per concept when the same ancestor appears through multiple paths.

Critically, procedures — which had *no* ancestor expansion in the original engine — now use the same pattern. This means procedural similarity is no longer limited to exact CPT/SNOMED code matches.

### Depth-Weighted Jaccard

The new `hierarchicalBlendedJaccard` method replaces binary set intersection with weighted overlap:

```
For each concept in the union:
  weight = decayFactor ^ min_levels_of_separation

Intersection weight = sum of min(weight_A, weight_B) for shared concepts
Union weight = sum of max(weight_A, weight_B) for all concepts
Score = intersection_weight / union_weight
```

With a default decay factor of 0.5, an exact match (level 0) contributes weight 1.0, a shared parent (level 1) contributes 0.5, a shared grandparent (level 2) contributes 0.25, and so on. Two patients who share "Diabetes mellitus" as a parent but diverge at the specific type receive meaningful partial credit instead of zero.

The blending with temporal recency is preserved: 70% lifetime Jaccard + 30% recent (365-day window) Jaccard, computed using the hierarchical method for each. The original flat `blendedJaccard` is preserved as a fallback.

### Impact

Consider two patients from our IRSF Rett Syndrome cohort:
- Patient A: coded with MECP2 duplication syndrome (specific)
- Patient B: coded with Rett syndrome, classic form (specific)

Under flat Jaccard, their condition similarity was dominated by exact matches in common comorbidities like epilepsy and scoliosis, with zero credit for their closely related primary diagnoses. Under hierarchical Jaccard, their shared ancestry through "Rett syndrome" and "Neurodevelopmental disorder" contributes graduated similarity, producing scores that better reflect clinical judgment about how similar these patients actually are.

---

## Upgrade 2: Love Plots and Distributional Comparison

The OHDSI community has a signature visualization for assessing covariate balance between two cohorts: the **Love plot** (named after Thomas Love, who popularized it). It's a dot plot of Standardized Mean Differences (SMD) for every covariate, with a vertical reference line at |SMD| = 0.1 — the standard threshold for "balanced."

Our original cohort comparison showed a radar chart with six high-level divergence percentages. Useful for a quick overview, but it couldn't answer the question every researcher asks first: *which specific covariates are driving the imbalance?*

### The New CohortComparisonService

We built a dedicated `CohortComparisonService` in Laravel that computes three categories of metrics:

**Per-covariate SMD** across all domains — demographics (age, gender, race), top conditions by prevalence, top drugs, and top procedures. Each covariate gets a standardized mean difference computed using the OHDSI formula:

`SMD = (mean_target - mean_comparator) / sqrt((var_target + var_comparator) / 2)`

For binary variables (diagnosis present/absent), we use the proportion-based variant. The service resolves concept IDs to human-readable names via `vocab.concept` and returns a sorted array ready for visualization.

**Jensen-Shannon Divergence (JSD)** for categorical features — a symmetric, bounded [0, 1] measure of how different two probability distributions are. JSD is the natural choice for comparing diagnosis prevalence profiles because it's always defined (unlike KL divergence, which blows up when one distribution has zero mass where the other doesn't) and has an intuitive interpretation as the average information gained by observing which distribution a sample came from.

`JSD(P, Q) = 0.5 * KL(P || M) + 0.5 * KL(Q || M), where M = (P + Q) / 2`

**Wasserstein Distance (Earth Mover's Distance)** for continuous features — particularly lab values and age distributions. The Wasserstein distance represents the minimum "work" needed to transform one distribution into the other, computed as:

`W₁(P, Q) = ∫ |F_P(x) - F_Q(x)| dx`

For discrete samples, this reduces to the mean absolute difference between sorted quantiles — elegant and interpretable.

### The Love Plot Component

The frontend `LovePlot` component renders a horizontal Recharts BarChart:
- Y-axis: covariate names, sorted by |SMD| descending
- X-axis: absolute SMD value
- Vertical reference line at 0.1 (OHDSI standard)
- Bars colored teal (#2DD4BF) if balanced (< 0.1), crimson (#9B1B30) if imbalanced
- Collapsible: shows top 20 by default with a "Show all" toggle

The `DistributionalDivergence` component adds a table with JSD/Wasserstein badges, color-coded interpretation (low/moderate/high divergence), and the metric type for each feature.

---

## Upgrade 3: UMAP Patient Landscape

One of the most powerful ways to understand a patient population is to *see* it. Dimensionality reduction projects high-dimensional patient feature vectors into 2D or 3D coordinates where proximity reflects similarity. Patients who cluster together are clinically similar; patients far apart are different.

We chose UMAP (Uniform Manifold Approximation and Projection) over t-SNE for three reasons:
1. **Global structure preservation** — inter-cluster distances are meaningful, not just intra-cluster structure
2. **Parametric transform** — new patients can be projected without re-running the full algorithm
3. **Speed** — UMAP is 10-100x faster than t-SNE, critical for datasets approaching a million patients

### The Pipeline

The UMAP projection runs entirely in the Python AI service, leveraging the existing projection infrastructure we built for Vector Explorer and Chroma Studio:

1. **Load embeddings** from `patient_feature_vectors` (768-dim pgvector column)
2. **PCA** to 50 dimensions (denoising — removes irrelevant variance)
3. **UMAP** to 2D or 3D (n_neighbors=15, min_dist=0.1, cosine metric)
4. **Percentile normalization** to [-1, 1] coordinate space
5. **K-means clustering** for automatic group identification
6. **Return** projected coordinates with cluster assignments, demographics, and cohort membership flags

For sources without pre-computed embeddings, the service falls back to constructing a numeric feature vector from the structured fields (age bucket, condition count, lab values, etc.) and running the same pipeline.

### The Visualization

The `PatientLandscape` component reuses the R3F (React Three Fiber) infrastructure from our Vector Explorer — specifically the InstancedMesh pattern that renders 10,000+ points as instanced spheres for GPU-efficient rendering:

- **Cohort mode**: teal (#2DD4BF) for cohort members, gray for non-members — instantly shows whether a cohort occupies a distinct region of patient space
- **Cluster mode**: each K-means cluster gets a unique color, revealing natural patient subgroups
- **Hover tooltips**: person ID, age, gender, cluster assignment
- **2D/3D toggle**: 2D for publication-quality screenshots, 3D for interactive exploration
- **OrbitControls**: rotate, zoom, pan for spatial exploration

This is the same visualization pattern that Atlas users see in CohortDiagnostics — but integrated directly into the similarity workflow rather than requiring a separate R package run.

---

## Upgrade 4: Propensity Score Matching

If hierarchical Jaccard is the engine upgrade and UMAP is the dashboard upgrade, propensity score matching is the *scientific rigor* upgrade. PSM is the OHDSI gold standard for comparative effectiveness research — the methodology behind every large-scale observational study published through the OHDSI network.

### Why PSM Matters

When comparing two cohorts (e.g., "patients who received Drug A" vs. "patients who received Drug B"), raw comparison is confounded by systematic differences between the groups. Patients prescribed Drug A might be older, sicker, or have different comorbidity patterns than patients prescribed Drug B. PSM addresses this by estimating each patient's probability of being in the target cohort given their covariates, then matching patients with similar propensity scores to create balanced comparison groups.

### The Implementation

Our `PropensityScoreService` implements the full OHDSI-standard pipeline in Python:

**1. Covariate extraction**: For each patient in both cohorts, we construct a sparse feature matrix from `patient_feature_vectors` — binary indicators for every condition, drug, and procedure concept, plus continuous features for lab values and demographics. This can produce tens of thousands of covariates, following the OHDSI philosophy of "include everything and regularize" rather than hand-selecting confounders.

**2. Propensity model**: L1-regularized logistic regression via scikit-learn (`LogisticRegression(penalty='l1', solver='saga')`). L1 regularization performs automatic variable selection by driving irrelevant covariate coefficients to exactly zero — essential when the covariate space is massive. The model outputs P(target cohort | covariates) for every patient.

**3. Preference score transformation**: Raw propensity scores are hard to interpret when cohort sizes differ dramatically. The preference score rescales to account for prevalence:

`preference = PS * (1 - prevalence) / (PS * (1 - prevalence) + (1 - PS) * prevalence)`

When prevalence = 0.5, preference = PS. Otherwise, it adjusts for the base rate, making the overlap between distributions more meaningful.

**4. Nearest-neighbor matching**: Within a caliper of 0.2 * SD(logit(PS)) — the Rosenbaum & Rubin recommended threshold — each target patient is matched to up to k comparator patients (variable-ratio matching). This retains more patients than strict 1:1 matching while maintaining balance.

**5. Balance diagnostics**: SMD computed for every covariate *before* and *after* matching. This is where the Love plot shines — two dot series per covariate showing the shift from imbalanced to balanced.

### Frontend Components

- **PreferenceScoreDistribution**: A mirrored density plot — target cohort distribution above the x-axis, comparator below — showing the overlap region where clinical equipoise exists
- **PropensityMatchResults**: Container displaying AUC (discrimination of the PS model), matched/unmatched patient counts, and the enhanced Love plot with before/after comparison
- **Enhanced LovePlot**: Now supports dual series — circles for pre-matching SMD and triangles for post-matching SMD, making the balance improvement visually immediate

---

## Upgrade 5: Temporal Similarity via Dynamic Time Warping

The first four upgrades treat patient data as static snapshots: what conditions does this patient have, what drugs are they on, what are their latest lab values. But clinical trajectories carry information that snapshots miss entirely.

Consider two patients with identical mean HbA1c of 7.0%:
- Patient A: stable at 7.0% for two years (well-controlled diabetic)
- Patient B: declining from 12.0% to 5.0% over two years (newly treated, rapid response)

Our original `MeasurementScorer` would rate these patients as maximally similar on the lab dimension. Their z-scored means are identical. But clinically, they are on completely different journeys — and a clinician looking for patients "like" Patient B would want the rapid responders, not the stable ones.

### Dynamic Time Warping

DTW solves this by comparing the *shape* of two time series, allowing for stretching and compression along the time axis. Given two sequences X = (x_1, ..., x_n) and Y = (y_1, ..., y_m), DTW finds the alignment that minimizes total distance:

`DTW(X, Y) = min over all warping paths W of: sum d(x_i, y_j) for (i,j) in W`

where W is a warping path through the (n x m) distance matrix, constrained to be monotonic and continuous.

We implemented DTW as a pure numpy dynamic programming solution (~30 lines, no external dependencies):

```python
def compute_dtw(series_a: np.ndarray, series_b: np.ndarray) -> float:
    n, m = len(series_a), len(series_b)
    dtw_matrix = np.full((n + 1, m + 1), np.inf)
    dtw_matrix[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(series_a[i-1] - series_b[j-1])
            dtw_matrix[i, j] = cost + min(
                dtw_matrix[i-1, j],     # insertion
                dtw_matrix[i, j-1],     # deletion
                dtw_matrix[i-1, j-1]    # match
            )
    return dtw_matrix[n, m] / max(n, m)
```

### The Pipeline

1. **Extract time series** from the OMOP `measurement` table for both patients — `(measurement_date, value_as_number)` ordered by date, per `measurement_concept_id`
2. **Z-score normalize** each measurement type against population statistics from the same source
3. **Compute DTW** for each shared measurement type (capped at 365 data points per series)
4. **Aggregate** across shared types: `similarity = 1 / (1 + mean_dtw_distance)`

### New Dimension Scorer

The `TemporalScorer` implements `DimensionScorerInterface` and delegates computation to the Python AI service. It appears as a new dimension in the similarity results, alongside demographics, conditions, measurements, drugs, procedures, and genomics. Users can weight it like any other dimension.

### Trajectory Visualization

The `TrajectoryComparison` component renders a Recharts LineChart showing two patients' lab series overlaid:
- Teal line for Patient A, gold for Patient B
- X-axis: calendar time, Y-axis: standardized value
- Dropdown to select measurement type (HbA1c, creatinine, ALT, etc.)
- Integrated into the head-to-head patient comparison view

---

## Upgrade 6: Clustering-Based Phenotype Discovery

The first five upgrades improve how we *compare* patients and cohorts. The sixth answers a fundamentally different question: **"What distinct patient subtypes exist within this cohort?"**

This is the question that drives precision medicine. A cohort defined by a single inclusion criterion (e.g., "all patients with Type 2 DM") is not homogeneous. It contains subphenotypes — perhaps a cluster with predominantly renal complications, another with cardiovascular comorbidity, another with well-controlled disease and minimal complications. Discovering these subgroups is the first step toward targeted interventions.

### Consensus Clustering

Simple k-means is sensitive to initialization and may produce different clusters on different runs. Consensus clustering addresses this through repeated subsampling:

1. **Feature matrix construction**: Build a patient x feature matrix from `patient_feature_vectors` — binary diagnosis presence, continuous lab z-scores, demographic variables
2. **PCA denoising**: Reduce to 50 components to remove noise
3. **Repeated clustering**: Run k-means 100 times, each time using a random 80% subsample of patients
4. **Co-clustering matrix**: Build an N x N matrix where entry (i,j) = proportion of runs where patients i and j were assigned to the same cluster
5. **Spectral clustering**: Apply spectral clustering to the co-clustering matrix to produce final, robust cluster assignments
6. **Optimal k selection**: Repeat steps 3-5 for k = 2 through 10, select the k with the highest silhouette score

This procedure produces clusters that are robust to initialization, outliers, and subsampling — unlike a single k-means run.

### Cluster Profiling

For each discovered cluster, the service computes:
- **Top conditions**: The 10 most prevalent condition concepts and their within-cluster prevalence
- **Top drugs**: Same for drug concepts
- **Demographic distribution**: Mean age, gender breakdown, race breakdown
- **Lab profile**: Mean and standard deviation of each lab measurement type
- **Size**: Number of patients in the cluster

Concept names are resolved from `vocab.concept` for human-readable output.

### The Visualization

`PhenotypeDiscovery` provides:
- **Cluster cards**: One card per discovered cluster showing size, top conditions (with prevalence bars), and demographic summary
- **Feature prevalence heatmap**: Rows = features, columns = clusters, cell color intensity = prevalence. This immediately reveals which features differentiate the clusters — e.g., Cluster 3 has 85% prevalence of atrial fibrillation while other clusters have < 10%
- **Integration with UMAP landscape**: The cluster assignments can be passed to `PatientLandscape` for visualization — confirming that the discovered clusters correspond to spatially distinct regions in patient space

---

## Upgrade 7: Similarity Network Fusion

The final upgrade is the most theoretically sophisticated: **Similarity Network Fusion** (SNF), originally published by Wang et al. in Nature Methods (2014) and widely adopted for multi-omics integration in cancer subtyping.

### The Limitation of Weighted Averages

Our original patient similarity system computed a weighted average across dimension scores:

`overall = sum(w_d * score_d) for each dimension d`

This is "late fusion" — each modality is reduced to a scalar, and the scalars are combined. It's simple and interpretable, but it loses cross-modal interactions. A patient who is similar in conditions AND drugs simultaneously carries more signal than one who is similar in conditions OR drugs independently. The weighted average can't capture this.

### How SNF Works

SNF operates on full similarity *matrices*, not scalar scores. For K data modalities (we use four: diagnoses, labs, drugs, procedures):

**Step 1: Build per-modality similarity matrices**

For each modality, construct an N x N patient similarity matrix:
- Diagnoses: Jaccard similarity on condition concept sets
- Labs: Cosine similarity on z-scored lab vectors
- Drugs: Jaccard similarity on drug concept sets
- Procedures: Jaccard similarity on procedure concept sets

**Step 2: KNN filtering**

For each similarity matrix W, construct a KNN-filtered version S that retains only the K nearest neighbors per patient (default K=20). This removes noise from weak similarities while preserving the local neighborhood structure.

**Step 3: Iterative diffusion**

The core of SNF. Each modality's similarity structure gets propagated through the other modalities:

`P_k(t+1) = S_k × (1/(K-1) × sum of P_j(t) for j ≠ k) × S_k^T`

Intuitively: modality k's similarities are "filtered" through the consensus of all other modalities. After ~20 iterations, the networks converge to a single fused network that captures cross-modal interactions — patients who are similar across multiple modalities will have the highest fused similarity, even if no single modality would have ranked them highly.

**Step 4: Community detection**

Spectral clustering on the fused network discovers patient communities — groups that are similar across all modalities simultaneously. These are stronger subphenotypes than those found by clustering on any single modality.

### Implementation

The `SimilarityNetworkFusion` service in Python implements the full algorithm using numpy and scipy.sparse. Key design decisions:

- **Patient cap**: 2,000 patients maximum (SNF is O(N^2 x K x T))
- **Sparse matrices**: Using scipy's sparse representation for the similarity matrices, since most patient pairs have near-zero similarity
- **Top-K edge output**: The fused network is N x N — too large to transmit to the frontend. We return only the top-K most similar pairs per patient, plus the community assignments
- **Modality contribution analysis**: We compute how much each modality's structure is preserved in the fused network, giving researchers insight into which data types drive the similarity patterns

### The Visualization

`NetworkFusionResults` renders three views:
- **Community cards**: Similar to phenotype discovery clusters, but discovered through the more principled SNF approach
- **MDS force graph**: An SVG-based graph where nodes are patients (colored by community) and edges represent the strongest fused similarities. MDS (Multidimensional Scaling) positions nodes to approximate the fused distance matrix in 2D.
- **Modality contribution chart**: A bar chart showing how much each data type (diagnoses, labs, drugs, procedures) contributed to the fused network structure

---

## How It All Fits Together

These eight upgrades aren't independent features bolted onto a page. They form an integrated analytical workflow:

```
1. HIERARCHICAL SIMILARITY
   ↓ Better per-patient scoring with concept ancestry
2. LOVE PLOTS + JSD/WASSERSTEIN
   ↓ Identify which covariates differentiate two cohorts
3. PROPENSITY SCORE MATCHING
   ↓ Create balanced comparison groups for causal inference
4. UMAP LANDSCAPE
   ↓ Visualize patient space, see where cohorts cluster
5. PHENOTYPE DISCOVERY
   ↓ Discover latent subgroups within a cohort
6. SIMILARITY NETWORK FUSION
   ↓ Principled multi-modal similarity for subtyping
7. TEMPORAL SIMILARITY
   ↓ Compare patient trajectories, not just snapshots
```

A researcher studying a treatment effect might:
1. Select target and comparator cohorts
2. View the Love plot to understand baseline imbalance
3. Run PSM to create matched cohorts
4. View the UMAP landscape to confirm spatial separation (or overlap) after matching
5. Discover phenotypes within the target cohort to identify subgroups that respond differently
6. Use SNF to identify cross-modal patient communities
7. Compare temporal trajectories for patients in the same SNF community

Each capability unlocks analytical questions that the previous capabilities couldn't answer.

---

## What Atlas Can't Do

For context, here's what OHDSI Atlas provides for patient comparison and cohort characterization:

| Capability | Atlas | Parthenon |
|-----------|-------|-----------|
| Cohort characterization | Prevalence tables | Prevalence tables + Love plots + JSD/Wasserstein |
| Propensity score matching | Via CohortMethod R package (requires R scripting) | Web UI, one-click, integrated visualization |
| Patient similarity search | None | Multi-modal, hierarchical, weighted |
| UMAP visualization | None | Interactive 2D/3D with cohort coloring |
| Temporal comparison | None | DTW on lab trajectories |
| Phenotype discovery | None | Consensus clustering with heatmap |
| Multi-modal fusion | None | SNF with community detection |
| Treatment pathway Sankey | TreatmentPatterns R package | Coming in Tier 3 |
| Love plot | CohortMethod R output | Native, interactive, before/after |
| Preference score distribution | CohortMethod R output | Native, mirrored density |

The fundamental difference is accessibility. Atlas provides many of these analytical capabilities through the HADES R package ecosystem, but they require R scripting expertise, batch execution, and manual assembly of visualizations. Parthenon makes them available through a web interface, in real time, with integrated visualization — lowering the barrier from "biostatistician with R fluency" to "clinical researcher with a browser."

---

## Architecture Overview

The implementation spans three layers:

### Python AI Service (4 new services, ~1,500 lines)

| Service | Lines | Purpose |
|---------|-------|---------|
| `propensity_score.py` | 340 | L1 logistic regression, PS matching, balance diagnostics |
| `temporal_similarity.py` | 274 | DTW computation, lab series extraction, z-score normalization |
| `phenotype_discovery.py` | 446 | Consensus clustering, feature matrix, cluster profiling |
| `similarity_network_fusion.py` | 437 | SNF algorithm, KNN filtering, community detection |

All services use asyncpg for direct PostgreSQL access to `patient_feature_vectors` and OMOP tables, numpy/scipy for matrix operations, and scikit-learn for machine learning components. No new Python dependencies were introduced — everything builds on scikit-learn, numpy, and scipy which were already in the stack.

### Laravel Backend (controller + service enhancements)

- `CohortComparisonService` — SMD, JSD, Wasserstein computation
- `TemporalScorer` — new dimension scorer implementing `DimensionScorerInterface`
- `PatientSimilarityController` — 4 new proxy endpoints with cohort resolution, auth, throttle
- New migration seeding the `temporal` dimension

### React Frontend (8 new/enhanced components, ~2,100 lines)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `LovePlot.tsx` | 263 | SMD dot plot with 0.1 threshold, before/after support |
| `DistributionalDivergence.tsx` | 122 | JSD/Wasserstein metric table |
| `PatientLandscape.tsx` | 349 | R3F InstancedMesh 2D/3D scatter plot |
| `PreferenceScoreDistribution.tsx` | 109 | Mirrored density for PS overlap |
| `PropensityMatchResults.tsx` | 135 | PSM results container |
| `TrajectoryComparison.tsx` | 274 | Recharts line overlay for DTW |
| `PhenotypeDiscovery.tsx` | 300 | Cluster cards + feature prevalence heatmap |
| `NetworkFusionResults.tsx` | 438 | MDS graph + community cards + modality contribution |

---

## What's Next: Tier 3

The research survey that motivated these upgrades identified a third tier of capabilities that build on what we've shipped:

- **GRAM Embeddings** — concept embeddings that respect the OMOP `concept_ancestor` hierarchy, using attention over ancestor paths. The most OMOP-native embedding approach in the literature.
- **Treatment Pathway Sankey Diagrams** — visualizing drug sequences from `drug_era` as flow diagrams, enabling cohort-level treatment pattern comparison.
- **Latent Class Growth Analysis** — discovering trajectory subgroups (rapid decliners vs. stable vs. improvers) in longitudinal lab data.

But those are for another late night. For now, the Patient Similarity Engine has the analytical depth to support publication-quality research — and it's available to every user with a browser and a Parthenon login.

---

*The eight upgrades described in this post were designed in a single research session and implemented as quick tasks using the GSD workflow. Total time from research to deployment: one session. The underlying algorithms are based on peer-reviewed methods from the OHDSI community, the machine learning literature, and the patient similarity network research pioneered by Pai & Bader (Nature Methods, 2018). All code is open-source under the Apache 2.0 license.*
