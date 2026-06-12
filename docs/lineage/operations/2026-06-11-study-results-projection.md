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
  - backend/database/migrations/2026_06_11_150000_add_study_results_projection_unique_index.php
  - backend/app/Services/Studies/StudyResultProjector.php
  - backend/app/Observers/AnalysisExecutionObserver.php
  - backend/app/Console/Commands/Studies/BackfillStudyResultsCommand.php
  - backend/app/Http/Controllers/Api/V1/StudyResultController.php
  - ai/app/agents/abby_tools.py
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

## Hardening (debug pass, same day)

Migration `2026_06_11_150000` adds a partial unique index
`study_results_projection_unique (study_id, study_analysis_id, result_type)
WHERE site_id IS NULL` so the projector's read-then-write idempotency is backed
by a real constraint (concurrent observer + backfill can no longer race to
duplicate). Code fixes:

- **Project the latest completed execution, not the firing one.** The observer
  used to project the specific execution whose `saved` event fired; a late
  retry of an *older* execution could overwrite the row with stale results. Both
  the observer and the backfill now resolve `latestCompletedExecution($sa)`.
- **Re-project on human gate decisions.** `StudyGateController::approve/override`
  now re-runs `StudyResultProjector::projectStudy()` (non-critical, try/catch),
  so `study_results.is_publishable` stays in sync with the gate ledger after an
  S5 approval/override — previously the row stayed stale while the live
  manuscript reflected the decision.

## Copilot reach: action-taking Abby (same day)

The projector now backs an approval-gated action on the omnipresent Abby
copilot. New route:

```
POST /api/v1/studies/{study}/results/reproject   (permission:studies.execute)
  → StudyResultController::reproject → StudyResultProjector::projectStudy
```

Idempotent and non-destructive (preserves `is_primary`; only effect-estimate
publishability moves with the gate state), so it is safe to expose. It exists so
Abby can refresh the Results tab + manuscript after an `evaluate_gates` —
previously only a gate approve/override or a fresh execution re-projected.

The Abby Claude Agent SDK profile (`ai/app/agents/abby_tools.py`) gained four
tools so the copilot can both **see** and **act on** the full study lifecycle:

| Tool | Kind | Wraps |
|---|---|---|
| `get_study_results` | read (auto) | `GET studies/{slug}/results` |
| `get_manuscript` | read (auto) | `GET studies/{slug}/manuscript` |
| `reproject_results` | write (**approval-gated**) | `POST studies/{slug}/results/reproject` |
| `open_in_publisher` | write (**approval-gated**) | `POST studies/{slug}/manuscript/draft` |

Writes route through the harness `can_use_tool` gate (`tool_packs._WRITE_TOOLS`),
so every mutation streams an `agent.approval.request` card the PI/author must
accept. Abby still never decides scientific validity — `reproject_results` and
`open_in_publisher` only reflect the existing gate state; gate approve/override
stays human-only in the Gates tab.

Frontend: `AbbyCopilotPanel` is now a fixed dock mounted once on `StudyDetailPage`
(present on every tab, collapsed launcher ↔ docked chat). Inline `AskAbbyButton`
affordances (gate cards "Why blocked?", the Results and Manuscript headers) hand
Abby a context-specific question via `abbyDockStore`, which auto-starts a session
and sends it.

## Rollback

`migrate:rollback` drops `analysis_execution_id` and restores `NOT NULL` on
`execution_id` only when no projected (null-execution) rows remain. To fully
revert, delete projected rows first:
`DELETE FROM app.study_results WHERE analysis_execution_id IS NOT NULL;`
