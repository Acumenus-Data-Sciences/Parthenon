# Patient Similarity Next Steps Plan

Date: 2026-04-05

## Purpose

This document defines the next implementation steps after the current Patient Similarity milestone work already completed in code:

- contract hardening
- temporal feature extraction
- recent-history-aware interpretable scoring
- provenance and cache-key stabilization
- researcher-facing search diagnostics
- result-cohort balance and warning panels

The remaining work is no longer about basic functionality. It is about operationalizing the engine safely, validating it scientifically, and preparing the platform for modern outcomes-research use.

## Current State

### Completed in code

- Canonical frontend/backend filter contracts
- deterministic candidate selection improvements
- cache/export metadata fixes
- patient-anchored recent-history features
- temporal blending in condition/drug/procedure scorers
- search provenance and query hashing
- result-cohort diagnostics and balance summaries
- export provenance enrichment

### Not yet executed in environment

- database migrations have not been run against live environments
- feature-vector backfill/recompute has not been run
- no benchmark evaluation harness exists yet
- no deployment/runbook exists for safe rollout

This distinction matters. The code is materially improved, but the live system is not fully upgraded until schema migration, recomputation, and validation are completed.

## Guiding Principles

- Treat patient similarity as a research instrument, not just a ranking UI.
- Make every search reproducible.
- Separate retrieval quality from explanation quality.
- Prefer incremental, auditable upgrades over model replacement.
- Require quantitative evaluation before changing default behavior in production.

## Phase 1: Deployment And Backfill

### Goal

Move the current code safely into a state where the temporal and diagnostic logic is actually live.

### Work

1. Run pending migrations.
   - `2026_04_04_000001_add_temporal_features_to_patient_feature_vectors.php`
   - `2026_04_04_000002_add_query_hash_to_patient_similarity_cache.php`

2. Recompute feature vectors for all active sources.
   - recompute `anchor_date`
   - recompute recent concept arrays
   - update `version`
   - regenerate embeddings against the new feature payload

3. Invalidate old cache rows or let them expire, but do not mix pre-query-hash and post-query-hash assumptions in rollout communications.

4. Verify source-level readiness after recompute.
   - vector count
   - embedding count
   - latest compute timestamp
   - random sample QA for recent condition/drug/procedure arrays

### Acceptance Criteria

- migrations succeed in target environments
- every production source has fresh feature vectors
- embeddings are either fully regenerated or explicitly marked unavailable
- patient similarity status endpoint reports coherent counts and freshness

### Risks

- long-running recomputation across large OMOP sources
- embedding generation lag
- stale caches producing confusing transitions if not handled explicitly

## Phase 2: Researcher Workflow Hardening

### Goal

Turn the Patient Similarity page into a defensible workflow for outcomes researchers.

### Work

1. Add explicit "search dossier" export.
   Include:
   - source
   - mode
   - weights
   - filters
   - limit
   - `min_score`
   - query hash
   - temporal window
   - feature-vector version
   - diagnostics snapshot

2. Add UI affordances for researcher interpretation.
   - expandable "why matched" structure by dimension
   - recent vs lifetime overlap counts in a clearer tabular form
   - warning severity styling
   - copyable provenance block

3. Add diagnostics persistence to cohort export workflows.
   - preserve search metadata in exported cohort expression
   - make exported cohorts traceable to the originating similarity run

4. Add empty/low-confidence result guidance.
   - low result count
   - low dimension coverage
   - imbalanced returned cohort
   - stale source vectors

### Acceptance Criteria

- a researcher can inspect, export, and later reconstruct a search
- exported cohorts preserve the methodology used to create them
- low-confidence searches are clearly flagged in UI

## Phase 3: Offline Evaluation Harness

### Goal

Quantitatively evaluate the patient similarity engine before changing defaults or expanding model complexity.

### Scope

Build an offline evaluation framework that can run per source and per engine version.

### Evaluation Axes

1. Retrieval Stability
   - repeated search determinism
   - cache/no-cache equivalence
   - sensitivity to filter changes
   - ranking stability across recomputation runs

2. Temporal Robustness
   - performance under train/test time splits
   - degradation under historical-to-recent drift
   - sensitivity to anchor-date missingness

3. Subgroup Fairness
   - returned-cohort demographic distortion
   - subgroup-specific coverage
   - subgroup-specific score distribution
   - imbalance rates by gender, age band, race when available

4. Outcome Relevance
   - whether nearest neighbors share downstream utilization/outcome patterns better than baseline heuristics
   - top-k outcome concordance
   - calibration of "similarity" vs future risk similarity

5. Transportability
   - same engine version across multiple OMOP sources
   - source-specific performance reporting

### Concrete Deliverables

1. Evaluation dataset builder.
   - seed sets
   - comparator sets
   - subgroup labels
   - outcome labels
   - time splits

2. Evaluation runner.
   - interpretable baseline
   - temporal interpretable engine
   - embedding retrieval plus interpretable rerank

3. Metrics package.
   - top-k overlap metrics
   - SMD-based cohort drift metrics
   - subgroup parity summaries
   - outcome concordance metrics
   - temporal degradation metrics

4. Result artifact format.
   - JSON for machine consumption
   - markdown summary for human review
   - optional frontend visualization later

### Acceptance Criteria

- one command can run a reproducible evaluation bundle for a source
- outputs compare engine versions side-by-side
- results are suitable for milestone go/no-go decisions

## Phase 4: Methodological Upgrades After Baseline Evaluation

### Goal

Add higher-value model improvements only after the harness can measure them.

### Candidate Upgrades

1. Richer interpretable covariates.
   - visit context
   - utilization intensity
   - chronic vs incident conditions
   - medication persistence/switching
   - lab trend summaries instead of latest-only values

2. Better cohort centroid logic.
   - prevalence-weighted centroid features
   - trimmed centroid instead of pure union
   - subgroup-aware centroid summaries for heterogeneous cohorts

3. Embedding retrieval upgrade.
   - longitudinal embedding retrieval as candidate generator
   - interpretable reranking remains the explanation layer
   - no direct black-box-only ranking in researcher workflows

4. Evaluation-driven default mode selection.
   - choose default retrieval mode per source only after benchmark evidence

### Acceptance Criteria

- every methodological change has benchmark evidence against the prior baseline
- defaults are not changed without documented evaluation results

## Phase 5: Outcome Analysis Integration

### Goal

Connect patient similarity to downstream research workflows instead of leaving it as an isolated search tool.

### Work

1. Add outcome profile summaries for returned cohorts.
   - utilization outcomes
   - mortality/survival where available
   - treatment pathway summaries
   - follow-up time summaries

2. Add matched-cohort handoff.
   - export returned cohort into characterization/estimation workflows
   - preserve provenance in the handoff

3. Add sensitivity-analysis affordances.
   - compare results under alternate weights
   - compare recent-window settings
   - compare interpretable vs embedding retrieval

### Acceptance Criteria

- a researcher can move from similarity search to formal analysis without re-entering search assumptions manually

## Technical Work Breakdown

### Backend

- add evaluation services and artifact models or file outputs
- add commands/jobs for evaluation runs
- add source-scoped benchmark configuration
- add cohort/result diagnostic enrichment where needed
- add provenance-preserving export and handoff contracts

### Frontend

- diagnostics dashboards for evaluation summaries
- search dossier/provenance export
- clearer confidence and warning UX
- outcome-summary presentation for returned cohorts

### Operations

- migration runbook
- recomputation runbook
- source-by-source validation checklist
- release note for changed ranking semantics

## Recommended Sequence

1. Run migrations in non-production.
2. Recompute vectors for one validation source.
3. QA temporal fields and diagnostics on that source.
4. Build and run the offline evaluation harness on that source.
5. Review benchmark outputs.
6. Roll out migrations and recomputation source-by-source in production.
7. Only then begin embedding retrieval upgrades or richer covariate expansions.

This order is deliberate. Deployment/backfill and benchmark infrastructure are now higher priority than additional scoring complexity.

## Immediate Next Tickets

1. Create a backend command to run patient-similarity evaluation bundles per source.
2. Define the evaluation artifact schema and output location.
3. Build seed/reference/outcome dataset generation utilities.
4. Implement baseline retrieval-stability and subgroup-balance metrics.
5. Add a markdown benchmark summary generator.
6. Write a migration and recompute runbook for operations.

## Milestone Exit Criteria

This milestone should be considered complete only when:

- the live system is running the new temporal/provenance/diagnostic logic
- exported cohorts are fully traceable
- benchmark evidence exists for at least one representative source
- default behavior is supported by quantitative evaluation, not intuition

## Recommendation

The next engineering task should be the offline evaluation harness, not another similarity algorithm change.

The platform now has enough methodological structure and UX scaffolding to justify formal benchmarking. Without that harness, future model improvements will be difficult to defend scientifically and easy to regress silently.
