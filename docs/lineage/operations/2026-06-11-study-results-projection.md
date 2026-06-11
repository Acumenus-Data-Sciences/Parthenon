---
doc_type: runbook
status: active
date: 2026-06-11
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_06_11_130000_relax_study_results_execution_and_link_analysis_execution.php
  - backend/app/Services/Studies/StudyResultProjector.php
  - backend/app/Observers/AnalysisExecutionObserver.php
  - backend/app/Console/Commands/Studies/BackfillStudyResultsCommand.php
related_prs: []
related_adr: docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
---
# Migration + backfill: project analysis executions into `study_results`

## What

Schema (migration `2026_06_11_130000_relax_study_results_execution_and_link_analysis_execution.php`):

- `study_results.execution_id` (→ `study_executions`) made **nullable**.
- New nullable `study_results.analysis_execution_id` FK (→ `analysis_executions`,
  `nullOnDelete`) so a single-site result links precisely to the run that
  produced it.

Runtime:

- `StudyResultProjector` + `AnalysisExecutionObserver` project each completed
  `analysis_executions` row into curated `study_results` rows (one per study
  analysis × result type), reusing the existing result normalizers. Savepoint +
  try/catch guarded so a projection failure never aborts the analysis run
  (CLAUDE.md Gotcha #12 — PG transaction poisoning).
- `studies:backfill-results {study?}` projects already-completed executions;
  idempotent and preserves reviewer curation (`is_primary`).

## Why

Analyses computed their output into `analysis_executions.result_json`
(morph-keyed), but the study **Results** tab, the package builder, and the
publication layer all read `study_results` — which no production code ever
wrote (only a Shiny seed). Every real study's Results tab was structurally
empty. The projector is the missing bridge.

## Production application (host PG17, study 165 — Hypertension v4)

```
# schema (as parthenon_migrator via deploy.sh --db)
./deploy.sh --db    # applies 2026_06_11_130000 only (sole pending migration)

# backfill (as parthenon_app — has DML on study_results)
php artisan studies:backfill-results 165   # → 4 rows projected
```

Result for study 165: 4 `study_results` rows — `characterization` (pub),
`incidence_rate` (pub), and two `effect_estimate` rows (both
`is_publishable=false`, faithfully blinded by the **failed** `study_diagnostics`
gate). All 4 linked analyses now report `latest_execution=completed`; the
ManuscriptComposer composes all six STROBE/RECORD sections.

## Companion data fixes (additive, claude_dev)

- Persisted a `cohort_generations` row for the normotensive comparator
  (cohort 5455, `person_count=37106`, derived from estimation execution 276's
  entering comparator count — **not** a fresh Circe generation; see
  `docs/research/hypertension-v4/normotensive_comparator_generation.sql`).
- Backfilled `app.studies.protocol_version='ACUM-PROT-HTN-V4-001'` on study 165.

## Per-contrast gate reconciliation (resolved in code)

Initially the `study_diagnostics` gate for study 165 was `failed` — it cited
SMD 0.244 from the within-HTN delay-strata contrast (exec 275) and blinded
**every** contrast, including the recording-comparable normotensive contrast
(exec 276) whose own diagnostics are clean (AUC 0.57, SMD 0.0155, equipoise
0.99).

Root cause: `StudyGateService::evaluateEstimationGates` was called once per
contrast, each `updateOrCreate`-ing the same `gate_key='default'` row, so the
last-evaluated (unbalanceable) contrast silently clobbered the verdict.

Fix: `StudyGateService::evaluateStudyEstimationGates(Study)` evaluates the S5/S6
gates **across all contrasts at once**. S5 passes when at least one contrast
meets the diagnostic thresholds; the representative metrics come from the
cleared (least-imbalanced) contrast, and `metrics_json` records
`contrasts_total`, `contrasts_cleared`, `cleared_contrast`, and
`blinded_contrasts`. The unbalanceable contrasts are still blinded individually
by `EstimationClearance` (which defers to each contrast's own diagnostics once
the study-level gate is not `failed`). `POST /studies/{study}/gates/evaluate`
now calls this study-level path.

After re-evaluation (`evaluateStudyEstimationGates(165)`):
`study_diagnostics=passed` (1/2 cleared — normotensive cleared, delay-strata
blinded); re-projecting set the normotensive `effect_estimate` to
`is_publishable=true` and kept the delay-strata one withheld; the manuscript now
includes effect estimates and documents the blinded contrast in its limitations.

A PI may still tighten or loosen this with a documented gate **override** from
the Gates tab if a stricter per-study policy is desired.

## Rollback

`migrate:rollback` drops `analysis_execution_id` and restores `NOT NULL` on
`execution_id` only when no projected (null-execution) rows remain. To fully
revert, delete projected rows first:
`DELETE FROM app.study_results WHERE analysis_execution_id IS NOT NULL;`
