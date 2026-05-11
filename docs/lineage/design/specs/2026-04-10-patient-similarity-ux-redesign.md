# Patient Similarity UX Redesign — Design Specification

**Date:** 2026-04-10
**Status:** Approved
**Author:** Dr. Sanjay M. Udoshi + Claude

---

## Problem Statement

The Patient Similarity page crams 5 analytical modes (single patient search, cohort seed, cohort comparison, UMAP landscape, head-to-head) into a single 720-line component with a fixed 320px left sidebar. This layout has three critical UX failures:

1. **Mode discovery** — researchers don't realize all 5 modes exist or understand when to use each
2. **Workflow fragmentation** — analyses that naturally flow together (compare → PSM → landscape) feel disconnected with no data flowing between steps
3. **Wasted screen real estate** — a permanent sidebar consumes 25% of width for inputs that are used once, leaving visualizations cramped

The blog post "From Jaccard to Network Fusion" describes an integrated analytical progression — but the UI presents these as disconnected tabs. The design should match the analytical workflow the engine was built to support.

---

## Design Direction: Guided Pipeline + Expandable Panels (Hybrid)

A cohort-centric research workspace that replaces the 5-tab mode switcher with a progressive pipeline of analysis steps. Each step builds on the previous, results flow forward, and the researcher can see their full analytical trail at a glance.

---

## 1. Page Structure

### 1.1 Cohort Selector Bar (persistent, top of page)

Replaces the 320px left sidebar. Always visible, never scrolls away.

**Layout:** Single horizontal row with:
- **Data Source** dropdown (min-width: 160px)
- **Mode Toggle** — pill button group: "Compare Cohorts" (default) | "Expand Cohort"
- **Target Cohort** dropdown with inline member count badge (e.g., `n=2,847`), crimson (#9B1B30) label
- **Comparator Cohort** dropdown with inline member count badge, teal (#2DD4BF) label — hidden in Expand mode
- **Action button** — "Compare" (crimson) or "Find Similar" (teal) depending on mode
- **Settings gear** (⚙) — opens the settings drawer

**Row 2 (conditional):** Generation status badges below each cohort showing vector readiness. Only appears when vectors need attention (not yet generated, stale, or generating).

**Behavior:**
- Changing either cohort resets the pipeline (clears all step results)
- Changing the data source clears both cohort selections and resets
- Color language: crimson = target, teal = comparator — consistent through every visualization

### 1.2 Analysis Pipeline (scrollable area below the bar)

A vertical stack of collapsible analysis panels. Each panel has three states:

| State | Appearance | Behavior |
|-------|-----------|----------|
| **Future** | Dashed border, 50% opacity, step number, "Run ▸" button | Clickable to execute |
| **Loading** | Solid border, spinner, step name | Non-interactive during execution |
| **Completed (collapsed)** | Solid border, checkmark, step name, summary metric, execution time | Click header to expand |
| **Completed (expanded)** | Colored border, full content with visualizations and action bar | Click header to collapse |

**Collapsed summary format:** Single-line showing the most actionable metric from that step's results.
- Profile Comparison: `Overall divergence 42% · 6 dimensions analyzed`
- Covariate Balance: `12/47 covariates imbalanced · worst: age (SMD 0.34)`
- PSM: `AUC 0.78 · 847 matched pairs · 73% SMD reduction`
- Landscape: `7,970 patients projected · 5 clusters detected`
- Phenotypes: `4 subphenotypes · silhouette 0.62`
- SNF: `5 communities · 4 modalities fused · converged at 1.2e-4`

**Multiple panels can be expanded simultaneously.** Click headers to toggle.

**"Continue to X →"** button at the bottom of each expanded panel suggests the natural next step without forcing it.

---

## 2. Pipeline Steps — Compare Mode

Clicking "Compare" triggers Steps 1-2 automatically (fast PHP operations). Steps 3-6 require explicit "Run" (computationally expensive Python AI service calls).

### Step 1: Profile Comparison (AUTO)

**Content when expanded:**
- **Overall divergence banner** — large percentage with color-coded progress bar and interpretation text (Low/Moderate/High)
- **Two-column layout:**
  - Left: Divergence Radar chart (Recharts) — superimposed polygons, crimson for target, teal for comparator, 6 axes for dimensions
  - Right: Per-dimension divergence bars — sorted by divergence descending, color-coded (crimson >50%, gold 30-50%, teal <30%)
- **Demographics comparison table** — Mean age (±SD), Female %, Race distribution, with SMD column color-coded by threshold

**Collapsed summary:** `Overall divergence {X}% · {N} dimensions analyzed`

### Step 2: Covariate Balance (AUTO)

**Content when expanded:**
- **Summary metrics row:** Total covariates, Balanced count (|SMD| < 0.1), Imbalanced count, Mean |SMD|
- **Recommendation badge** — if imbalanced > 0: amber "⚠ PSM recommended" badge
- **Two-column layout:**
  - Left: Love Plot (pre-matching only) — horizontal dot plot, |SMD| on x-axis, covariates sorted by |SMD| descending, vertical reference line at 0.1, dots colored teal (balanced) or crimson (imbalanced)
  - Right: Distributional Divergence table — Feature name, Metric type (JSD/Wasserstein), Value, Interpretation badge (Low/Moderate/High)
- **Action bar:** Contextual recommendation text + "Run Propensity Score Matching →" button

**Collapsed summary:** `{N}/{Total} covariates imbalanced · worst: {name} (SMD {value})`

### Step 3: Propensity Score Matching (MANUAL)

**Content when expanded:**
- **Metrics row:** AUC, Matched Pairs, SMD Reduction %, Caliper
- **Two-column layout:**
  - Left: Preference Score Distribution — mirrored density plot, target above x-axis (crimson), comparator below (teal), overlap region indicates equipoise
  - Right: Love Plot Before/After — dual-series dot plot, crimson circles for pre-matching SMD, teal circles for post-matching SMD, showing balance improvement
- **Cross-Cohort Search** — "Find Matching Patients" button appears in the action bar after PSM completes. Runs `crossCohortSearch` to find patients in the comparator cohort who match the target profile. Results appear as an inline SimilarPatientTable below the PSM charts.
- **Action bar:** "Export Matched Cohort" (secondary), "Find Matching Patients" (secondary, post-PSM), "View Diagnostics" (secondary), "Continue to Landscape →" (primary)

**Collapsed summary:** `AUC {X} · {N} matched pairs · {X}% SMD reduction`

**Diagnostics display:** "View Diagnostics" buttons throughout the pipeline expand an inline collapsible section within the current panel (not a drawer or modal). This keeps the researcher's context intact while revealing metadata about candidate pool size, query contract, provenance, balance metrics, and warnings.

### Step 4: UMAP Landscape (MANUAL)

**Content when expanded:**
- **Controls bar:** 3D/2D toggle, Color mode (Cohort/Cluster), stats display (patients projected, clusters detected, UMAP params)
- **Full-width 3D viewport** — React Three Fiber InstancedMesh scatter plot, 360px height
  - Cohort mode: crimson for target members, teal for comparator members
  - Cluster mode: unique color per K-means cluster
  - Hover tooltips: person_id, age, gender, cluster assignment, cohort membership
  - OrbitControls for rotate/zoom/pan
  - Legend overlay (bottom-right)
- **Action bar:** "Export Screenshot" (secondary), "Select Cluster → New Cohort" (secondary), "Continue to Phenotype Discovery →" (primary)

**Collapsed summary:** `{N} patients projected · {K} clusters detected`

### Step 5: Phenotype Discovery (MANUAL) — Phase 3

**Content when expanded:**
- **Summary metrics:** Clusters Found, Method (Consensus K-Means), Silhouette Score, Patients Clustered
- **Cluster cards** — 4-column grid, each card with:
  - Unique color top border
  - Cluster name and member count
  - Top 3 conditions with prevalence bars
  - Demographic summary (mean age, % female)
- **Feature Prevalence Heatmap** — rows = features, columns = clusters, cell color intensity = prevalence within cluster. Reveals differentiating features at a glance.
- **Action bar:** "Export Cluster → New Cohort" (secondary), "View on Landscape" (secondary — passes cluster assignments to Step 4), "Continue to Network Fusion →" (primary)

**Collapsed summary:** `{K} subphenotypes · silhouette {score}`

### Step 6: Similarity Network Fusion (MANUAL) — Phase 3

**Content when expanded:**
- **Summary metrics:** Communities, Modalities Fused (Dx/Labs/Rx/Px), Iterations, Convergence
- **Two-column layout (2:1 ratio):**
  - Left: Fused Similarity Network — SVG-based MDS force graph, nodes colored by community, edges representing strongest fused similarities. 500-node cap.
  - Right: Modality Contribution — vertical bar chart showing % contribution of each data modality to the fused network, plus natural language interpretation paragraph
- **Action bar:** "Export Community → New Cohort" (secondary), "Compare Communities" (secondary), pipeline complete indicator

**Collapsed summary:** `{K} communities · {N} modalities fused · converged at {delta}`

---

## 3. Pipeline Steps — Expand Mode

When the mode toggle is set to "Expand Cohort", the pipeline adapts:

| Step | Name | Trigger | Content |
|------|------|---------|---------|
| 1 | Centroid Profile | AUTO | Cohort centroid radar (CohortCentroidRadar), dimension coverage bars |
| 2 | Similar Patients | AUTO | SimilarPatientTable with results, "Export as Cohort" and "Expand Existing Cohort" actions |
| 3 | Landscape | MANUAL | UMAP projection of seed cohort + found similar patients |
| 4 | Phenotypes | MANUAL | Subgroup discovery within combined seed + results population |

PSM and Network Fusion are excluded (they require a comparator cohort). The pipeline adapts automatically based on the entry mode.

---

## 4. Settings Drawer

Slides from the right on ⚙ click. 360px wide, dimmed backdrop.

**Sections:**

### 4.1 Dimension Weights
- 7 sliders (Demographics, Conditions, Measurements, Drugs, Procedures, Genomics, Temporal)
- Range: 0-5, step 0.5
- Color feedback: gold for high values (>2.5), teal for normal (0.5-2.5), gray for zero (excluded)
- "Reset defaults" button
- Explanatory text: "Control how much each clinical dimension contributes to similarity scoring. Set to 0 to exclude entirely."

### 4.2 Demographic Filters
- Age range: min/max number inputs (0-150)
- Gender: dropdown (All / Male / Female)

### 4.3 PSM Configuration
- Matching ratio: button group (1:1 / 1:K / Variable)
- Caliper: slider with label showing `0.2 × SD(logit PS)`
- Max sample per arm: slider (default 5,000)

### 4.4 UMAP Projection
- n_neighbors: number input (default 15)
- min_dist: number input (default 0.1)

### 4.5 Similarity Mode
- Button group: Auto / Interpretable / Embedding
- Moved from the main UI — this is a power-user setting

**Footer:** "Apply & Re-run Pipeline" button — re-executes from Step 1 with new settings.

---

## 5. Head-to-Head Comparison Drawer

A slide-over drawer (520px, from the right) for comparing any two patients. Replaces the current standalone "Head-to-Head" tab.

**Triggers:**
- UMAP Landscape: Click + Shift+Click two points, or right-click → "Compare with..."
- Similar Patients Table: Checkbox two rows → "Compare Selected"
- Phenotype Discovery: Click patients within/across cluster cards
- Network Fusion Graph: Click two nodes
- Cross-Cohort Search Results: Select from patient list

**Content (top to bottom):**
1. **Patient cards** — side-by-side with VS badge. Each shows person_id, demographics, condition/drug counts, cohort membership badge
2. **Overall similarity score** — large number with progress bar
3. **Dimension scores** — 2-column grid, each dimension with inline bar and score
4. **Shared features** — stacked overlap bar (A only | Shared | B only), condition pills, drug pills
5. **Temporal trajectory** — Recharts LineChart with measurement type dropdown, two patient series overlaid (crimson/teal), DTW distance and similarity stats
6. **Action links** — "View Patient A Profile ↗" / "View Patient B Profile ↗"

**Header:** "Open Full Page ↗" button navigates to `/patient-similarity/compare?person_a=X&person_b=Y&source_id=Z` for the full-width experience.

---

## 6. What Moves Out

| Component | Current Location | New Location |
|-----------|-----------------|-------------|
| Single Patient Search (SimilaritySearchForm) | Tab on Patient Similarity page | Patient Profiles page (fix existing button) |
| SearchDiagnosticsPanel | Always visible in results | Behind "View Diagnostics" button in each panel's action bar |
| ResultCohortDiagnosticsPanel | Always visible in results | Behind "View Diagnostics" button in each panel's action bar |
| SimilarityModeToggle (Auto/Interpretable/Embedding) | Main UI toggle | Settings drawer, Section 4.5 |
| StalenessIndicator | Per-source component | Replaced by generation status row in cohort selector bar |
| Head-to-Head tab | Standalone tab | Contextual drawer available from any panel |

---

## 7. Component Architecture

### New Components

| Component | Purpose | Est. Lines |
|-----------|---------|-----------|
| `PatientSimilarityWorkspace` | Top-level page, replaces PatientSimilarityPage | ~300 |
| `CohortSelectorBar` | Persistent top bar with source, mode toggle, cohort dropdowns | ~200 |
| `AnalysisPipeline` | Manages step state, ordering, collapse/expand | ~250 |
| `PipelineStep` | Generic collapsible panel wrapper with states (future/loading/completed) | ~120 |
| `ProfileComparisonPanel` | Step 1 content: radar + dimension bars + demographics | ~200 |
| `CovariateBalancePanel` | Step 2 content: summary + Love plot + distributional divergence | ~250 |
| `PsmPanel` | Step 3 content: metrics + preference score + enhanced Love plot | ~200 |
| `LandscapePanel` | Step 4 content: controls + 3D viewport wrapper | ~150 |
| `PhenotypeDiscoveryPanel` | Step 5 content: cluster cards + heatmap (Phase 3) | ~300 |
| `NetworkFusionPanel` | Step 6 content: MDS graph + modality contribution (Phase 3) | ~350 |
| `SettingsDrawer` | Right slide-out with weights, filters, PSM/UMAP config | ~250 |
| `HeadToHeadDrawer` | Right slide-out with full patient comparison | ~350 |
| `CentroidProfilePanel` | Expand mode Step 1: centroid radar + coverage | ~150 |

### Preserved Components (refactored as needed)

| Component | Changes |
|-----------|---------|
| `CohortComparisonRadar` | Wrap in ProfileComparisonPanel, no API changes |
| `DivergenceScores` | Wrap in ProfileComparisonPanel |
| `LovePlot` | Used in both CovariateBalancePanel and PsmPanel |
| `PreferenceScoreDistribution` | Wrap in PsmPanel |
| `PropensityMatchResults` | Decompose into PsmPanel (metrics extracted) |
| `PatientLandscape` | Wrap in LandscapePanel, no rendering changes |
| `NetworkFusionResults` | Decompose into NetworkFusionPanel |
| `TrajectoryComparison` | Embed in HeadToHeadDrawer |
| `SimilarPatientTable` | Used in Expand mode Step 2 |
| `CohortCentroidRadar` | Used in Expand mode Step 1 |
| `CohortExportDialog` | Available from action bars |
| `CohortExpandDialog` | Available from Expand mode action bars |
| `GenerationStatusBanner` | Adapted for cohort selector bar Row 2 |
| `DimensionScoreBar` | Used in HeadToHeadDrawer dimension scores |

### Removed Components

| Component | Reason |
|-----------|--------|
| `SimilaritySearchForm` | Moves to Patient Profiles |
| `SimilarityModeToggle` | Absorbed into SettingsDrawer |
| `StalenessIndicator` | Replaced by generation status in CohortSelectorBar |
| `CohortCompareForm` | Replaced by CohortSelectorBar |
| `CohortSeedForm` | Replaced by CohortSelectorBar (Expand mode) |
| `SearchDiagnosticsPanel` | Available on-demand via "View Diagnostics" |
| `ResultCohortDiagnosticsPanel` | Available on-demand via "View Diagnostics" |

---

## 8. State Management

### Pipeline State (component-level useState)

```typescript
interface PipelineState {
  mode: 'compare' | 'expand';
  sourceId: number | null;
  targetCohortId: number | null;
  comparatorCohortId: number | null;
  expandedSteps: Set<string>;
  completedSteps: Map<string, StepResult>;
  activeStep: string | null;
}

interface StepResult {
  data: unknown;
  summary: string;
  executionTimeMs: number;
  completedAt: Date;
}
```

### Data Flow

- Steps 1-2 auto-trigger on "Compare" click via React Query mutations
- Each step's mutation result is stored in `completedSteps` Map
- The "Continue to X →" button triggers the next step's mutation with context from previous steps
- Changing cohorts in the selector bar resets `completedSteps` and `expandedSteps`
- Settings drawer changes trigger full pipeline re-execution

### React Query Keys

Existing `SIMILARITY_KEYS` pattern extended for pipeline steps:

```typescript
const PIPELINE_KEYS = {
  profileComparison: (sourceId, targetId, comparatorId) => [...],
  covariateBalance: (sourceId, targetId, comparatorId) => [...],
  psm: (sourceId, targetId, comparatorId, config) => [...],
  landscape: (sourceId, targetId, comparatorId, umapConfig) => [...],
  phenotypes: (sourceId, cohortId) => [...],
  snf: (sourceId, cohortId) => [...],
};
```

---

## 9. Color Language

Consistent across all panels:

| Element | Color | Hex |
|---------|-------|-----|
| Target cohort | Crimson | #9B1B30 |
| Comparator cohort | Teal | #2DD4BF |
| Warnings / recommendations | Gold | #C9A227 |
| Balanced / good | Teal | #2DD4BF |
| Imbalanced / attention | Crimson | #9B1B30 |
| Moderate | Gold | #C9A227 |
| Background (base) | Dark | #0E0E11 |
| Panel background | Slightly lighter | #131316 |
| Phenotype cluster 1 | Coral | #E06C75 |
| Phenotype cluster 2 | Blue | #61AFEF |
| Phenotype cluster 3 | Green | #98C379 |
| Phenotype cluster 4 | Purple | #C678DD |
| Phenotype cluster 5 | Orange | #D19A66 |

---

## 10. Visualization Libraries

| Use Case | Library | Rationale |
|----------|---------|-----------|
| Radar, bar, line charts | Recharts (existing) | Already in stack, sufficient for data volumes |
| UMAP 3D/2D scatter | React Three Fiber (existing) | Already used for Vector Explorer, InstancedMesh pattern proven |
| Love plots | Recharts ScatterChart | Consistent with existing chart library |
| Feature heatmap | Custom HTML/CSS grid | Simple prevalence table, no chart library needed |
| Network fusion graph | SVG (existing pattern) | 500-node cap makes SVG feasible, reuse existing MDS layout |
| Preference score distribution | Recharts AreaChart | Symmetric mirrored density |

No new visualization dependencies introduced. The existing stack (Recharts + React Three Fiber) handles all requirements.

---

## 11. Accessibility

- All interactive panels keyboard-navigable (Enter/Space to expand/collapse)
- ARIA labels on pipeline steps indicating state (completed, active, available)
- Color-coded elements always paired with text labels or shape differentiation
- Settings drawer uses focus trap when open
- 3D landscape has 2D fallback for screen readers and reduced-motion preferences

---

## 12. Not In Scope

- Drag-and-drop cohort selection (dropdowns are more accessible and sufficient)
- New visualization libraries (deck.gl, nivo, visx) — existing stack covers all needs
- Treatment Pathway Sankey diagrams (Tier 3 of the blog's roadmap)
- GRAM Embeddings integration
- Latent Class Growth Analysis
- Cross-session persistence of pipeline state (ephemeral per page load)
