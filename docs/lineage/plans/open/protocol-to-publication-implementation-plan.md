---
doc_type: plan
status: active
date: 2026-06-09
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
related_prs:
  - 357
---
# Abby — Protocol-to-Publication Pipeline: Implementation Plan

**ADR:** `docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md`
**Status:** Active — implementation complete (P0–P6 shipped + tested 2026-06-19..21); open pending the live gated re-run of study 114
**Validation target:** Hypertension Study v3 (`app.studies.id = 114`) rerun as the golden regression case
**Date:** 2026-06-09

> **Implementation status (2026-06-21).** All seven phases (P0–P6) have shipped
> code with passing tests; see the closeout
> `docs/lineage/modules/studies/2026-06-21-protocol-to-publication-closeout.md`
> for per-phase commit/file/test evidence. The orchestrator has been dry-walked
> end-to-end (HTTP 200, gated-halt proven offline). This plan stays **open** for
> the single remaining acceptance: the live `execute=true` re-run of study 114
> confirming the S5 halt with estimates blinded against real analytics. On that,
> move this plan to `plans/closed/` with `status: shipped`.

> Ordering principle (from the ADR): the **rigor substrate ships before the
> orchestrator.** Phases 1–4 build provenance, calibration, gates, and the
> missing diagnostics; Phase 5 wires the Claude Agent SDK orchestrator over
> them; Phase 6 synthesizes the manuscript. Each phase is independently
> shippable and independently testable, and each lands behind the pre-commit
> checks (Pint, PHPStan L8, tsc, vite build, ESLint, Vitest, pytest/mypy).

---

## Phase 0 — Regression harness (½ day)

**Goal.** Freeze study 114's current behavior as a fixture so every later phase
can assert "the gate now catches what shipped before."

**Deliverables.**
- `backend/tests/Fixtures/Studies/hypertension-v3/` — captured `design_json`
  for analyses 41/58/20/63, the cohort definitions 5424–5439, and the
  `result_json` payloads from executions 259–262 (read-only export via
  `claude_dev` on host PG17; no schema writes).
- `backend/tests/Feature/Studies/HypertensionV3RegressionTest.php` — skeleton
  with one assertion per row of the ADR validation table, initially marked
  `->skip()` and un-skipped phase by phase.

**Acceptance.** The skipped test enumerates all six required gate behaviors;
`vendor/bin/pest --filter HypertensionV3Regression` is green (all skipped).

**Risk.** None — read-only data capture.

---

## Phase 1 — Provenance spine (2–3 days)

**Goal.** Make every study artifact content-addressable and every result bound
to the design + data version that produced it. Unblocks reproducibility for all
later phases.

**Migrations** (`backend/database/migrations/`, applied via `./deploy.sh --db`
or `artisan migrate --path=` — never `--force`):
- `concept_sets.expression_sha256 varchar(64) null`
- `cohort_definitions.expression_sha256 varchar(64) null`
- `cohort_generations`: `compiled_sql text null`, `expression_sha256 varchar(64) null`,
  `vocabulary_version varchar(64) null`, `cdm_source_release varchar(64) null`
- `analysis_executions`: `design_sha256 varchar(64) null`, `vocabulary_version varchar(64) null`,
  `cdm_source_release varchar(64) null`
- `study_results.study_design_version_id` (FK → `study_design_versions.id`, null)
- new `study_packages` table: `study_id`, `version`, `bundle_json jsonb`,
  `bundle_sha256`, `vocabulary_version`, `cdm_source_release`, `created_by`,
  timestamps

**Backend.**
- `app/Support/Hashing/DefinitionHasher.php` — canonicalize (sort keys, strip
  volatile fields) then SHA-256. One method per artifact type.
- Hook hashing into `ConceptSetController::store/update`,
  `CohortDefinitionController::store/update`, and the analysis store paths.
- `CohortGenerationService::generate()` — persist `compiled_sql` (already
  produced by `CohortSqlCompiler`), pin `vocabulary_version` (from
  `vocab.vocabulary` release) and `cdm_source_release` (from
  `app.source_releases`), and the expression hash.
- `StudyService` — set `study_results.study_design_version_id` when storing
  results.
- `app/Services/Studies/StudyPackageService.php` — `build(Study): StudyPackage`
  assembles the atomic snapshot; `export(StudyPackage): zip` writes a portable
  bundle (definitions + compiled SQL + designs + results + gate ledger +
  versions). Reuses `StudyArtifact` for storage with
  `artifact_type='study_package'`.

**API / routes** (HIGHSEC: `auth:sanctum` + `permission:studies.view` read,
`studies.create` write):
- `POST /api/v1/studies/{study}/package` → build snapshot (`studies.create`)
- `GET  /api/v1/studies/{study}/package/{version}/export` → download

**Acceptance.**
- Re-saving an unchanged concept set / cohort yields an identical
  `expression_sha256`; any change flips it.
- A fresh cohort generation stores non-null `compiled_sql`, `vocabulary_version`,
  `cdm_source_release`.
- A study package for study 114 round-trips: export → re-import metadata →
  hashes match.
- Pint + PHPStan L8 clean; unit tests for `DefinitionHasher` and
  `StudyPackageService`.

**Risk.** Low. Pure additive columns (all nullable), no behavior change to
existing reads. Backfill of hashes for existing rows is a separate idempotent
artisan command, not a blocking migration.

---

## Phase 2 — Empirical calibration service (3–4 days)

**Goal.** Turn the negative controls darkstar already collects into calibrated
estimates + a calibration gate. **Wiring only — `EmpiricalCalibration` 3.1.4 is
already installed.**

**darkstar** (`darkstar/api/`):
- New endpoint `POST /analysis/calibrate` (`calibration.R`): inputs = outcome
  estimate(s) `{logRr, seLogRr}` + negative-control estimates; runs
  `fitSystematicErrorModel`, `calibrateConfidenceInterval`,
  `calibrateP`; returns calibrated point + CI, the systematic-error model, EASE,
  and calibration-plot series. Register in `plumber_api.R`; add to
  `hades_packages.R` health surface.
- Fold a `calibrate` step into `estimation.R` so a CohortMethod run with
  negative controls returns calibrated fields in one round trip (preferred), or
  keep it as a discrete call the orchestrator chains.

**Backend.**
- `app/Services/Analysis/Calibration/CalibrationService.php` — wraps the
  darkstar endpoint via `RService`.
- Extend `EstimationResultNormalizer` with `calibrated_estimates[]`
  (`calibrated_hr`, `cal_ci_lower`, `cal_ci_upper`, `calibrated_p`),
  `systematic_error_model`, `ease`, and `calibration_plot`.
- `app/Support/Statistics/Multiplicity.php` — Benjamini-Hochberg across the
  outcome set; annotate each estimate with `adjusted_p`.

**Frontend** (`frontend/src/features/analyses/components/`):
- `CalibrationPlot.tsx` — negative-control scatter + calibrated CI band
  (Recharts; `formatter` cast as `never` per house rule).
- Show calibrated vs uncalibrated side-by-side in `EstimationResults`.

**Acceptance.**
- A CohortMethod run with an *informative* control panel returns calibrated CIs
  wider than nominal and a populated calibration plot.
- Study 114's panel (2 informative controls) yields
  `calibration_status = "insufficient_controls"` with a remediation message —
  **no uncalibrated estimate is surfaced as primary.**
- Multiplicity: 2+ outcomes get `adjusted_p`; single-outcome studies are
  unchanged.
- Unit test on a synthetic control distribution with known systematic error
  recovers it within tolerance.

**Risk.** Medium. `EmpiricalCalibration` needs ≥~5 informative controls to be
stable; the gate must encode that floor, not crash on sparse panels. R↔PHP JSON
shape needs a contract test.

---

## Phase 3 — Gate ledger + blocking gates + estimate blinding (3–4 days)

**Goal.** The state machine spine. Convert already-computed diagnostics into
enforced, overridable, audited decisions.

**Migration.**
- `study_gates`: `study_id`, `stage` (enum: `design|phenotype|cohort_diagnostics|
  data_quality|study_diagnostics|estimation_calibration|publication`),
  `gate_key`, `status` (`pending|passed|failed|overridden|approved`),
  `metrics_json jsonb`, `threshold_json jsonb`, `decision` (`auto|human`),
  `decided_by` (FK users), `decided_at`, `override_rationale text null`,
  timestamps. Constraint: `override_rationale` NOT NULL when
  `status='overridden'`.

**Backend.**
- `app/Services/Studies/Gates/GateEvaluator.php` + one evaluator per stage
  (`DataQualityGate`, `CohortDiagnosticsGate`, `StudyDiagnosticsGate`,
  `CalibrationGate`, …). Each reads `metrics_json`, compares to
  `threshold_json`, writes a `study_gates` row.
- Default thresholds (config `config/studies.php`, overridable per study):
  PS AUC < 0.80 *or* max-SMD-after < 0.10 *or* equipoise ≥ 0.30 to pass S5;
  DQD severe-failures = 0 to pass S4; ≥5 informative negative controls to pass
  S6 calibration.
- `app/Services/Studies/Gates/GateEnforcement.php` — `assertMayRun(study, tool)`;
  throws `GateBlockedException` unless the prerequisite gate is
  `passed|overridden`. Called from `RunEstimationJob` and the estimation
  controller before dispatch.
- **Estimate blinding:** `EstimationResultNormalizer` gains a `blinded` mode
  (diagnostics only); the resource/serializer strips effect-estimate fields
  unless the study's S5 gate is cleared. Single chokepoint, covered by a test
  asserting no HR leaks while blinded.
- Override path: `StudyGateService::override(gate, user, rationale)` —
  authorizes against `principal_investigator_id` / `lead_statistician_id`,
  requires non-empty rationale.

**API / routes** (HIGHSEC):
- `GET  /api/v1/studies/{study}/gates` (`studies.view`)
- `POST /api/v1/studies/{study}/gates/{gate}/approve` (role: PI/statistician per
  stage)
- `POST /api/v1/studies/{study}/gates/{gate}/override` (role: PI/statistician;
  rationale required)

**Frontend** (`frontend/src/features/studies/`):
- `StudyGateTimeline.tsx` — the 7-gate progress rail with status, metrics,
  approve/override actions, and a rationale modal.

**Acceptance.**
- `run_estimation` for a study whose S5 gate is `failed` throws
  `GateBlockedException` (regression test for study 114's separation case).
- Blinded estimation responses contain diagnostics and **no** HR/CI fields;
  after S5 approve, the same execution exposes them.
- Override writes a row with non-null rationale; the rationale is retrievable for
  the manuscript.
- RBAC: a `researcher` cannot approve S5/S6; only the PI/statistician can.

**Risk.** Medium-high. Blinding must not break existing `EstimationResults`
rendering — gate it behind a feature flag (`config('studies.gating_enabled')`)
so existing studies are unaffected until opted in.

---

## Phase 4 — Missing cohort diagnostics (2–3 days)

**Goal.** Make S3 able to catch empty/degenerate cohorts. The three diagnostics
study 114 needed and lacked.

**Backend / compiler.**
- `CohortSqlCompiler` gains a `generateStats` mode that emits per-inclusion-rule
  survivor counts (Circe-style attrition) into a stats table during generation.
- `CohortDiagnosticsService` adds:
  - `getInclusionAttrition()` — n entering / remaining / dropped per rule.
  - `getIndexEventBreakdown()` — which domain criterion matched at index,
    per-concept counts.
  - `getOrphanConcepts()` — concept-set members that never matched a row in the
    target schema.
- Optionally proxy `CohortDiagnostics` v3.4.2 (already installed) via darkstar
  for the richer temporal/incidence diagnostics; SQL path is sufficient for the
  three gate-critical ones.

**Frontend.** Extend `CohortDiagnosticsPanel` + `AttritionChart` to render the
three new sections.

**Acceptance.**
- Attrition for cohort 5424 shows per-rule drop-off; an empty inclusion rule is
  visible.
- The S3 gate FLAGS a pathway/event-cohort that resolves to an outcome/pool
  rather than treatment cohorts (study 114's `[5425,5426]` case), and FLAGS the
  100%-"Unknown" age stratum.
- Orphan-concept detection lists unused concepts for a deliberately
  over-broad set.

**Risk.** Medium. Attrition requires the compiler to emit intermediate counts —
additive `generateStats` flag, default off, so existing generation is untouched.

---

## Phase 5 — Abby orchestrator (Claude Agent SDK, Python AI) (5–7 days)

**Goal.** The coordinator that drives S1→S7, calling the deterministic services
behind the gate ledger.

**Python AI** (`ai/app/orchestrator/`):
- `state_machine.py` — the 7-stage FSM; persists state via the Laravel API
  (`study_design_sessions` + `study_gates`), resumable across the days a real
  study takes.
- `tools.py` — the orchestrator's only deterministic levers, each an
  authenticated call into the Laravel API: `extract_design`, `verify_concept_sets`,
  `compile_and_generate_cohort`, `run_cohort_diagnostics`, `run_dqd`,
  `run_study_diagnostics`, `run_estimation`, `calibrate_estimates`,
  `draft_manuscript`, `export_publication`.
- `guards.py` — pre-call enforcement mirroring `GateEnforcement`: refuse
  `run_estimation`/`calibrate_estimates`/`export_publication` unless the
  prerequisite gate is cleared (defense in depth — Laravel also enforces).
- Reuse `ai/app/routing/claude_client.py` (Claude SDK, cost tracking,
  `AGENT_MAX_BUDGET_USD`). Subagents per interpretive stage
  (design-extractor, phenotype-proposer, diagnostics-interpreter,
  manuscript-writer) with narrow tool allowlists.
- **No PHI in prompts** — designs, counts, SMDs, and diagnostics only.

**Laravel.**
- Scoped service token for the orchestrator (Sanctum ability-scoped per ADR C3
  pattern already used by the publication agent).
- `POST /api/v1/studies/{study}/orchestrate` — kick off / resume; streams
  progress over Reverb to `StudyGateTimeline`.

**Acceptance.**
- End-to-end dry run on study 114: orchestrator advances S1→S3, **halts at S5**
  with the separation failure, and emits a remediation proposal (active
  comparator) — never reaching estimation. This is the headline regression
  assertion.
- Killing the orchestrator mid-run and re-invoking resumes from the last cleared
  gate (FSM persistence).
- Cost per study stays under `AGENT_MAX_BUDGET_USD`.

**Risk.** High — this is the integration keystone. Mitigated by landing it last,
over services already independently tested, with both Python-side and
Laravel-side enforcement so the agent cannot bypass a gate even if its own guard
is wrong.

---

## Phase 6 — Manuscript synthesis (2–3 days)

**Goal.** Auto-generate a publication-ready document from calibrated results +
provenance — replacing the hand-written report.

**Backend.**
- `app/Services/Publication/ManuscriptComposer.php` — assembles a STROBE/RECORD-
  structured document: Methods (from designs + gate thresholds), Results (from
  calibrated estimates + diagnostics figures), Limitations (from gate overrides +
  flags), and a **Provenance Appendix** (artifact hashes, vocab/CDM versions,
  full gate-ledger decision trail). Drives `claude_client.py` for prose; pulls
  numbers from result payloads (never invents them).
- Extend `PublicationController::narrative` to call the composer; export via the
  existing `DocxExporter` / `PdfExporter`.

**Acceptance.**
- A completed study renders a docx whose every quantitative claim traces to a
  `result_json` value and whose limitations section reproduces each gate
  override rationale verbatim.
- Study 114, run to whatever gate it legitimately reaches, produces a manuscript
  that **states plainly that no calibrated effect estimate is available and
  why** — instead of burying it in operator caveats.

**Risk.** Medium. The composer must be forbidden from fabricating numbers —
enforce by passing it a closed set of result fields and asserting (test) that no
numeric token in the output is absent from the source payload.

---

## Critical path & sequencing

```
P0 ─▶ P1 ─┬▶ P2 ─┐
          ├▶ P4 ─┤
          └▶ P3 ─┴▶ P5 ─▶ P6
```

- **P1 (provenance)** gates everything — do it first.
- **P2 (calibration), P3 (gates), P4 (diagnostics)** are parallelizable after
  P1; P3 consumes P2's calibration metric and P4's diagnostics as gate inputs,
  so land P2/P4 just ahead of P3's S5/S6 evaluators.
- **P5 (orchestrator)** requires P1–P4 complete.
- **P6 (manuscript)** requires P5 (or can be exercised standalone against a
  manually-advanced study).

**Rough effort:** ~3 working weeks of focused build, P5 the largest single item.

## Checkpoints (where I stop for review)

1. After **P1** — provenance schema + study-package export reviewed before more
   builds on it.
2. After **P3** — the gate model + blinding behavior reviewed on a real study
   before the orchestrator is allowed to drive it.
3. Before **P5 first live orchestration run** on study 114 (a live agent run
   touching the production DB read-path).
4. Before **P6 manuscript** is presented as publication-ready.

Per working-style: drive through the phases, check in at these natural gates
(schema, gate semantics, live agent run, publishable output) rather than after
every task.

## Cross-cutting requirements

- **HIGHSEC** on every new route: `auth:sanctum` + `permission:`; override/approve
  routes require PI/statistician role; orchestrator uses an ability-scoped token;
  no PHI in LLM prompts.
- **Pre-commit parity:** Pint, PHPStan L8, `tsc --noEmit` *and* `vite build`,
  ESLint, Vitest, pytest/mypy green before each commit.
- **Migrations:** additive + nullable; backfills are separate idempotent artisan
  commands; never `migrate --force`.
- **No `omop`-schema writes** — all reads via the source-scoped connections;
  diagnostics use the existing read paths.
- **Feature flag** `studies.gating_enabled` so existing studies are unaffected
  until explicitly opted into the gated pipeline.
