---
slug: patient-similarity-workspace-redesign
title: "From Five Disconnected Tabs to a Research Workspace: Redesigning the Patient Similarity UI"
authors: [mudoshi, claude]
tags: [patient-similarity, ux, react, component-architecture, cohort-comparison, psm, umap, clinical-workflow, design, frontend]
date: 2026-04-10
---

We shipped eight analytical upgrades to the Patient Similarity Engine last week — hierarchical concept similarity, Love plots, distributional divergence, propensity score matching, UMAP projections, temporal DTW, consensus clustering, and similarity network fusion. The engine is now, arguably, more analytically capable than anything in the OHDSI ecosystem for cohort-level comparison.

But the UI was still the original five-tab layout we built in the first sprint. And no amount of analytical horsepower matters if a researcher opens the page, sees five tabs without context, and doesn't understand the order of operations.

Tonight we replaced it entirely.

<!-- truncate -->

---

## The Problem with Five Tabs

The original Patient Similarity page had a clean enough structure on the surface: five tabs covering single patient search, cohort seeding, cohort comparison, UMAP landscape, and head-to-head patient comparison. A 320px left sidebar held the form inputs. Total page component: 720 lines, all in one file.

The design had three compounding UX failures.

**Mode discovery.** A researcher landing on the page for the first time sees "Profile Comparison" as the default tab. There's no indication that the page also contains a 3D UMAP projection, temporal trajectory comparison, or network fusion — capabilities that took weeks to build. The tabs don't describe what they do or when to use them. Cohort Seed and Cohort Comparison look like peer alternatives, not complements. Head-to-Head is tucked at the far right where it rarely gets found.

**Workflow fragmentation.** The analytical story we told in the ["From Jaccard to Network Fusion" blog post](/blog/patient-similarity-v2-research-grade) has a clear progression: profile divergence → covariate balance → propensity score matching → UMAP projection → phenotype discovery → network fusion. Each step informs the next. PSM without prior balance assessment is guesswork. UMAP after PSM reveals whether the matching actually worked. But the tab structure presented these as peer alternatives, not stages of a pipeline. No data flowed between tabs. Running PSM didn't automatically update the Love plot. Viewing the landscape didn't know which cohorts were currently selected in the comparison tab.

**Wasted screen real estate.** The 320px left sidebar consumed approximately 25% of viewport width — permanently, whether or not you were actively changing inputs. Most researchers select their cohorts once and spend the rest of the session analyzing results. The sidebar was paying full rent for an input form that gets used for thirty seconds and then sits idle while its visualizations were crammed into the remaining 75%.

These aren't cosmetic issues. They map directly to researcher behavior: users were missing capabilities they needed, running analyses out of order, and working with smaller charts than the analysis required.

---

## Design Direction: Guided Pipeline + Expandable Panels

The redesign is built around a single structural insight: **the analytical workflow is a pipeline, not a menu**. The UI should express that.

We evaluated three approaches before settling on the final design.

A **wizard / forced linear flow** would guarantee that researchers follow the correct order, but it sacrifices agency. An experienced researcher who wants to skip straight to PSM shouldn't be blocked by a "complete Step 1 first" gate. Wizards work well for setup flows; they're frustrating for iterative analysis.

A **dashboard with cards** gives maximum flexibility but provides no guidance. It solves mode discovery (you can see everything at once) but doesn't help with workflow fragmentation — there's still no data flowing between panels and no sense of sequence.

A **guided pipeline with expandable panels** is the hybrid we landed on. The pipeline expresses the intended order of operations and makes each step's purpose self-documenting. But steps are independently accessible — you can expand any completed step, re-run any step, skip steps entirely. Multiple panels can be open simultaneously. Results from earlier steps are available as context to later steps, but accessing a later step doesn't require a sequential gate. The analytical trail stays visible.

---

## The Cohort Selector Bar

The most immediately visible change is the elimination of the left sidebar. In its place, a persistent horizontal bar sits at the top of the page, always visible, never scrolling away.

The bar contains everything that defines the research context: the data source dropdown, a mode toggle between "Compare Cohorts" and "Expand Cohort", target and comparator cohort dropdowns with inline member count badges, an action button, and a settings gear. That's it — five elements that would have been scattered across a 320px sidebar now fit in a single row.

The color language is consistent and deliberate: crimson (#9B1B30) for the target cohort throughout every visualization, teal (#2DD4BF) for the comparator. This isn't cosmetic. When a researcher looks at a Love plot and sees a crimson dot above the 0.1 line, they immediately know which cohort is driving the imbalance — no legend lookups required. When the UMAP projection shows patient clusters, the cohort membership coloring uses the same language established in the selector bar. The terminology "target" and "comparator" maps directly to OHDSI study design conventions, where a target cohort receives an intervention and a comparator cohort provides the reference group.

A second row of generation status badges appears conditionally below the cohort selections when vector readiness needs attention — when embeddings haven't been generated yet, are stale, or are actively computing. When everything is ready, the second row doesn't appear and the bar stays compact.

Changing either cohort resets the entire pipeline, clearing all step results. This is the right behavior: a Love plot computed for Cohort A vs. Cohort B has no meaning once you've switched to Cohort C. The reset is immediate and visible — the pipeline steps drop back to their "future" state (dashed border, 50% opacity) and the researcher can see at a glance that they need to re-run.

---

## The Analysis Pipeline

Below the selector bar, a vertical stack of collapsible analysis panels replaces the five tabs. Each panel has four visual states that communicate where it sits in the workflow:

**Future** — dashed border, 50% opacity, step number visible, "Run" button present. The step exists, its purpose is explained by the panel title and description, and the researcher knows exactly what to click to execute it. The opacity signals that this step hasn't run yet without hiding it entirely — you can still read the title and understand what it does.

**Loading** — solid border, spinner, progress text. Non-interactive. The step is executing; there's nothing to do but wait.

**Completed (collapsed)** — solid border, checkmark, a single-line summary showing the most actionable metric from that step's results, and execution time. The collapsed summary is a design decision worth explaining: we're not just saying "done." We're surfacing the key finding so that a researcher can scan their analytical trail without expanding every panel. "12/47 covariates imbalanced · worst: age (SMD 0.34)" tells you in one line whether you need to look at this step or move on. "AUC 0.78 · 847 matched pairs · 73% SMD reduction" tells you whether the propensity matching was successful before you expand the full Love plot.

**Completed (expanded)** — colored border, full visualizations, action bar with contextual next-step suggestions. Multiple panels can be expanded simultaneously. The researcher controls their own view.

The action bar at the bottom of each expanded panel contains two types of buttons: secondary actions for the current step (export, diagnostics, full-page navigation) and a primary "Continue to X →" button that suggests the natural next step without requiring it. The suggestion is based on the step's results — Step 2's action bar says "Run Propensity Score Matching →" because that's what covariate balance analysis is designed to feed.

---

## Six Steps in Compare Mode

The pipeline for cohort comparison has six steps. The first two trigger automatically when the researcher clicks "Compare" — they're fast PHP operations against pre-computed data. Steps 3 through 6 require explicit "Run" because they invoke the Python AI service and can take tens of seconds on large cohorts.

**Step 1: Profile Comparison** is the overview. The divergence radar chart shows both cohorts superimposed on six axes — demographics, conditions, measurements, drugs, procedures, and genomics — using the existing `CohortComparisonRadar` component. Per-dimension divergence bars sort covariates by divergence descending, making the worst dimensions immediately visible. An overall divergence banner with color-coded interpretation (Low / Moderate / High) gives the researcher a one-sentence summary before they look at any individual axis.

**Step 2: Covariate Balance** is where the research decision gets made. This step surfaces the output of `CohortComparisonService` — SMD per covariate across all OMOP domains, plus JSD and Wasserstein distance for distributional comparison. The Love plot on the left shows every covariate as a horizontal dot sorted by |SMD| descending, with a reference line at 0.1. Dots are teal if balanced, crimson if imbalanced. The distributional divergence table on the right adds JSD badges (bounded [0,1], symmetric, appropriate for categorical condition prevalence) and Wasserstein distances (continuous features like age and lab values, interpreted as the minimum "work" to transform one distribution into the other).

Most importantly: if any covariate exceeds the 0.1 SMD threshold, Step 2 displays an amber warning badge: "⚠ PSM recommended." This is the smart recommendation. The system is not just displaying data — it's interpreting the balance assessment and connecting it explicitly to the next analytical action. The recommendation badge is the design pattern that converts a table of numbers into a research decision.

**Step 3: Propensity Score Matching** contains the full PSM workflow — preference score distribution (mirrored density showing target above the x-axis in crimson, comparator below in teal, overlap region indicating equipoise), the enhanced before/after Love plot (dual series: circles for pre-matching SMD, triangles for post-matching SMD), and a metrics row showing AUC, matched pairs, caliper, and SMD reduction percentage. The before/after Love plot is the key diagnostic: watching the imbalanced red dots shift toward the center when PSM succeeds is visually immediate. Post-PSM, a "Find Matching Patients" button appears in the action bar — this runs `crossCohortSearch` to find comparator patients who match the target profile, surfacing the matching results inline rather than requiring a tab switch.

**Step 4: UMAP Landscape** provides the spatial view. The React Three Fiber InstancedMesh projection renders all patients as instanced spheres — 10,000+ points with GPU-efficient rendering — colored by cohort membership or K-means cluster assignment. The 3D viewport is 360px tall at full page width, finally giving the UMAP the screen space it needs to be readable. OrbitControls allow rotate/zoom/pan. Toggling between 3D and 2D drops from spheres to a flat scatter plot suitable for screenshots. The cluster mode directly answers the question the UMAP was built to answer: after PSM, do the two cohorts occupy overlapping patient space or remain spatially separated?

**Step 5: Phenotype Discovery** and **Step 6: Similarity Network Fusion** are wired into the pipeline but marked "Phase 3" — the consensus clustering and SNF services are implemented and tested, but the frontend components for these steps will ship in the next iteration. The pipeline shows placeholder panels with descriptions of what these steps will produce. This isn't an oversight — it's intentional. Displaying the future steps with their descriptions solves the mode discovery problem even for capabilities that aren't fully implemented yet. A researcher can read what Step 5 will do and understand where the pipeline is headed.

---

## The Expand Mode Pipeline

The mode toggle switches the entire pipeline to a four-step flow for cohort expansion: finding similar patients from a cohort centroid rather than comparing two populations.

Expand mode omits PSM and SNF — both require a comparator cohort and have no meaning when the goal is expansion. The steps that remain are adapted: Step 1 shows the cohort centroid profile (the average feature vector of the seed cohort, visualized as a radar with dimension coverage bars), Step 2 runs the cross-cohort search and displays the `SimilarPatientTable`, Step 3 runs the UMAP projection on the combined seed + results population, and Step 4 runs phenotype discovery within that combined population. The pipeline adapts to the research intent.

---

## Settings Drawer: Progressive Disclosure for Power Users

All configuration that doesn't change between most analyses — dimension weights, demographic filters, PSM matching parameters, UMAP projection settings — moved behind the gear icon into a 360px slide-out drawer.

The dimension weight sliders (seven dimensions: demographics, conditions, measurements, drugs, procedures, genomics, temporal) use color feedback to make the weight configuration visually immediate: gold for high weights (> 2.5), teal for normal range (0.5–2.5), gray for zero (dimension excluded entirely). Setting a dimension to zero visually "dims" it, communicating that it won't contribute to the similarity computation.

PSM configuration lives here too: matching ratio (1:1 / 1:K / Variable), caliper width with a live label showing the Rosenbaum & Rubin formula (0.2 × SD(logit PS)), and the max sample per arm slider that guards against OOM errors in the AI service. The UMAP parameters (n_neighbors, min_dist) allow researchers to tune the projection for their specific dataset characteristics.

The "Apply & Re-run Pipeline" button at the drawer's footer re-executes the full pipeline with new settings. Changing configuration without re-running would produce a misleading state — the displayed results would reflect different settings than the current configuration. The explicit re-run button makes the relationship between settings and results transparent.

---

## Head-to-Head as a Contextual Drawer

The original head-to-head tab was the hardest mode to find and the one most researchers didn't know existed. The conceptual problem was that head-to-head comparison is not a parallel mode to cohort comparison — it's a contextual action that becomes meaningful *after* you've done cohort-level analysis and found two patients you want to examine individually.

The redesign makes it contextual. The `HeadToHeadDrawer` (520px, right slide-over) can be triggered from anywhere a patient is visible: shift-clicking two points in the UMAP landscape, selecting two rows in the similar patients table, clicking two nodes in the network fusion graph, or selecting from cross-cohort search results. The drawer shows both patients in a side-by-side layout — demographic cards, overall similarity score, per-dimension score bars, shared feature overlap (stacked bar showing A-only / shared / B-only), and the trajectory comparison chart with DTW distance.

An "Open Full Page ↗" button navigates to `/patient-similarity/compare?person_a=X&person_b=Y&source_id=Z` for the full-width experience when a researcher wants to do a detailed individual comparison. The drawer is the quick-look version; the full page is the deep-dive version.

---

## Backend: Wiring the New Endpoints

The UI redesign required one backend change of substance: the `compareCohorts` endpoint now returns covariate balance data — SMD per covariate and distributional divergence metrics — by calling `CohortComparisonService` as part of the comparison response.

Previously, cohort comparison returned the six-dimension divergence percentages for the radar chart. That data is still there. But Step 2's Covariate Balance panel needs per-covariate SMD (which covariates specifically are imbalanced, not just "conditions are 42% divergent"), JSD for categorical features, and Wasserstein distances for continuous ones. The `CohortComparisonService` already computed all of this — the work from last week's upgrades. The backend change was adding the service call to the controller and including the balance data in the response envelope.

The PSM, UMAP, temporal similarity, and phenotype discovery endpoints were already wired into the AI router from last week's work. The frontend pipeline steps call them directly via their existing TanStack Query hooks.

---

## Component Architecture

The redesign introduces 13 new components and deprecates 7.

The structural core is the `PatientSimilarityWorkspace` page component, `CohortSelectorBar`, `AnalysisPipeline`, and `PipelineStep`. `PipelineStep` is a generic collapsible wrapper that handles all four visual states (future / loading / completed-collapsed / completed-expanded) independent of what content is inside it. Every step panel (`ProfileComparisonPanel`, `CovariateBalancePanel`, `PsmPanel`, `LandscapePanel`, and the Phase 3 placeholders) renders as a child of `PipelineStep`. This separation between the panel's state management and its content is the key to keeping each panel component focused: `CovariateBalancePanel` knows about Love plots and JSD tables; `PipelineStep` knows about collapse animations and state badges.

The 14 existing visualization components are preserved and wrapped. `CohortComparisonRadar`, `LovePlot`, `PreferenceScoreDistribution`, `PatientLandscape`, `SimilarPatientTable`, `TrajectoryComparison` — none of these needed API changes. They were wrapped into their respective pipeline panel components without modification. This is the correct approach: the visualization components encode how to display data; the pipeline panels encode where that display fits in the workflow.

The deprecated components are the ones that the cohort selector bar made redundant: `CohortCompareForm`, `CohortSeedForm`, `SimilarityModeToggle`, `SimilaritySearchForm`, `StalenessIndicator`, `SearchDiagnosticsPanel`, and `ResultCohortDiagnosticsPanel`. The first two became the `CohortSelectorBar`. The search form moves to the Patient Profiles page where single-patient search makes more contextual sense. The diagnostics panels move behind "View Diagnostics" buttons in each step's action bar — available on demand rather than always occupying screen space.

Pipeline state is managed at the workspace level with a `usePipeline` hook: the current mode, source ID, cohort selections, a `Set<string>` of expanded step IDs, and a `Map<string, StepResult>` of completed step results. Changing cohort selections resets the completed map. The `StepResult` type stores the response data, a pre-formatted summary string (used for the collapsed one-liner), execution time in milliseconds, and completion timestamp. Individual step panels receive their data via props from this state object — no Zustand store, no prop drilling through many layers, just a single workspace-level hook that owns the pipeline.

React Query keys follow the existing `SIMILARITY_KEYS` pattern, extended for each pipeline step with the appropriate cache dimensions (source ID + cohort IDs + any step-specific config).

---

## What Researchers Actually Get

The analytical capabilities didn't change. The PSM algorithm is the same L1 logistic regression. The UMAP projection uses the same parameters. The Love plot shows the same SMD values.

What changed is how researchers discover and navigate those capabilities.

Mode discovery is solved by the pipeline itself. Every step has a title and description visible in the "future" state — even steps 5 and 6, which are Phase 3. A researcher who has never used Patient Similarity before can read down the pipeline and understand the complete analytical workflow from a single page view.

Workflow fragmentation is solved by data continuity. Step 2 feeds into Step 3's recommendation. Step 3's matched cohort carries into Step 4's projection. The "Continue to X →" buttons make the intended sequence explicit without enforcing it mechanically.

Smart recommendations are the highest-value addition for most researchers. Detecting covariate imbalance and surfacing a PSM recommendation converts a raw metric (42% of covariates above the SMD threshold) into a research action ("run propensity score matching"). The system is now opinionated about methodology in a way that supports research quality without constraining research design.

The analytical trail stays visible in collapsed panels. A researcher who ran all six steps can scroll up, glance at the collapsed summaries, and reconstruct their analytical narrative — "Profile showed 42% divergence, balance check found 12 imbalanced covariates, PSM achieved 73% SMD reduction, UMAP showed good overlap post-matching." That's a publishable methods section surfaced in six one-liners.

And the 25% of screen width recovered from the sidebar goes entirely to visualizations. The Love plot that was previously showing 40 covariates in a 600px-wide container now has 800+ pixels. The UMAP landscape that was crammed into the right half of the page now spans the full content width.

---

## What's Next

Steps 5 and 6 — Phenotype Discovery and Similarity Network Fusion — are wired, tested, and waiting for their pipeline panels. The backend services and AI service endpoints are fully implemented from last week's research grade work. The Phase 3 label is temporary.

Single patient search is marked for migration to the Patient Profiles page, where a researcher viewing a patient profile has the natural context to search for similar patients. That move consolidates the workflow at the right entry point.

The "Select Cluster → New Cohort" action in the UMAP Landscape step is the feature with the most downstream leverage: identifying a spatially coherent subpopulation visually and converting it to a named cohort, which then becomes available across every other Parthenon module. That integration is in the queue.

---

*The design specification that drove this redesign lives at `docs/superpowers/specs/2026-04-10-patient-similarity-ux-redesign.md`. The 13 new frontend components and backend endpoint changes are in the same commit as this post. All code is open-source under the Apache 2.0 license.*
