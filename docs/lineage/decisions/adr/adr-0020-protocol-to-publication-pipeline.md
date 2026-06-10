---
doc_type: adr
status: proposed
date: 2026-06-09
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Services/StudyDesign/StudyDesignProtocolImportService.php
  - backend/app/Services/StudyDesign/StudyDesignAbbyOrchestrator.php
  - backend/app/Services/Analysis/StudyService.php
  - backend/app/Services/Analysis/CohortDiagnosticsService.php
  - backend/app/Services/Cohort/CohortSqlCompiler.php
  - backend/app/Support/EstimationResultNormalizer.php
  - backend/app/Services/Dqd/DqdEngineService.php
  - backend/app/Services/Publication/PublicationService.php
  - darkstar/api/estimation.R
  - darkstar/api/hades_packages.R
  - ai/app/routing/claude_client.py
related_prs: []
---
# ADR 0020 — Clio: a gated protocol-to-publication study pipeline

**Status:** Proposed (2026-06-09)
**Service name:** Clio (Muse of history and the written record).
**Deciders:** Dr. S. Udoshi (CMIO) + design session 2026-06-09.
**Validates against:** Hypertension Study v3 (`app.studies.id = 114`) as the golden regression case.

## Naming

The orchestrator is named **Clio** — the Muse of history, whose name derives
from *kleos* ("to make renowned"). She records what happened and proclaims it.
A pipeline that ingests a study protocol, conducts a methodologically rigorous
observational analysis, and emits a publication-ready manuscript is doing
exactly Clio's work: turning events (a clinical question + a CDM) into a
faithful, citable written account.

Clio joins the existing pantheon — **Hecate** searches the crossroads,
**Harmonia** harmonizes mappings, **Ariadne** records the thread, **Phoebe**
recommends concepts, **Morpheus** works the inpatient corpus, **Poseidon**
moves the data. Clio **writes the history**. We avoided `Strategus`, `Theseus`,
`Athena`, and `Themis` — all already claimed in the OHDSI namespace. Per
convention, module/table names stay descriptive (`ai/app/orchestrator/`,
`app.study_gates`); the Greek name lives in this ADR, the UI, and the manual.

## Context

Parthenon already contains roughly 70% of the machinery to take a study
protocol to a publication-ready document — but as **disconnected parts with no
orchestration, no enforced scientific gating, and no reproducibility spine.**

The Hypertension v3 study (study 114) is the proof. A `.docx` protocol was
ingested, four analyses were composed, cohorts were generated, and a report was
produced — but:

- **Estimation failed twice and was never caught as a gate.** Run 258 died on
  *complete propensity-score separation* (the comparator was defined by having
  BP measurements, so the PS model separated the arms trivially); run 262 died
  on an *infrastructure connection error*. Neither produced an effect estimate,
  yet nothing blocked the study from being treated as "run."
- **The treatment-pathway analysis was degenerate** — its `eventCohortIds` were
  `[5425, 5426]` (the comparator pool and the MACE outcome) instead of
  antihypertensive treatment cohorts. It "completed" and re-discovered who had
  MACE. No gate flagged the misconfiguration.
- **The negative-control panel was non-informative** — 10 of 12 controls
  returned zero events, so empirical calibration could not function. Nothing
  flagged that the calibration design was inert.
- **Characterization age-binning was broken** (100% "Unknown") and
  **incidence-rate CIs were unpopulated** (0/0). Both are output defects that a
  diagnostics gate should surface, not a human reading a report after the fact.
- **The report itself was hand-written** by an operator reading `result_json`
  out of the production database. There is no auto-synthesis, and the report is
  not bound to the concept-set / cohort / analysis versions that produced it.

The capabilities to fix each of these *exist already*:

- Protocol ingestion → `StudyDesignProtocolImportService` (docx/pdf → Claude →
  intent → normalized spec → draft assets, with prompt-hash provenance in
  `study_design_ai_events`).
- A Circe-compatible cohort compiler (`CohortSqlCompiler` + 8 builders + 11
  domain criteria builders).
- Six HADES analysis types over the **darkstar** R sidecar, already computing PS
  AUC, equipoise, covariate balance (SMD before/after), negative controls,
  attrition, and Kaplan-Meier.
- **`EmpiricalCalibration` 3.1.4 and `CohortDiagnostics` v3.4.2 are already
  installed** in the darkstar image (`docker/r/Dockerfile:158,207`) — calibration
  and the missing cohort diagnostics are *wiring, not installation*.
- A multi-strategy concept-mapping pipeline with a HITL review queue.
- `PublicationService` with docx/pdf/figures exporters and an AI narrative
  endpoint; a Phase-1 read-only publication agent.
- Three Claude integrations (`StudyDesignClaudeClient.php`,
  `ai/app/routing/claude_client.py` with Opus/Sonnet + cost tracking, and an
  agent runtime with `AGENT_MAX_BUDGET_USD`).

The gap is **orchestration, gating, and provenance binding** — not capability.

## Decision

Build **Clio**, a gated state-machine pipeline with seven stages, each ending
in a human-in-the-loop gate. A Claude Agent SDK orchestrator drives the
*interpretive* steps; deterministic Laravel + darkstar services own every
*computational* step. **The orchestrator never computes a statistic or judges
validity — it proposes, explains, and drafts; deterministic gates and humans
decide.**

### D1 — Pipeline shape (7 stages, 7 gates)

```
Protocol (.docx/.pdf)
  └─▶ S1 DESIGN          protocol → PICO intent → normalized spec → draft assets
        �the GATE 1 (PI): confirm PICO, objectives, design type
  └─▶ S2 PHENOTYPE       concept sets verified · cohorts compiled · HASHED + vocab PINNED
        ▶ GATE 2 (data-steward / reviewer): approve concept sets & cohort logic
  └─▶ S3 COHORT DIAG     generate cohorts · attrition · index-event breakdown · orphan concepts
        ▶ GATE 3 (researcher): counts plausible? attrition sane? — catches degenerate cohorts
  └─▶ S4 DATA QUALITY    DQD run, threshold enforced
        ▶ GATE 4 (data-steward): DQD pass before any estimation
  └─▶ S5 STUDY DIAG      PS AUC · equipoise · SMD · negative-control distribution — ESTIMATES BLINDED
        ▶ GATE 5 (statistician): equipoise OK? balance < 0.1? → unblind only on pass
  └─▶ S6 ESTIMATE+CALIB  effect estimates · empirically calibrated CIs · multiplicity correction
        ▶ GATE 6 (statistician): sign off on calibrated results
  └─▶ S7 PUBLICATION     STROBE/RECORD manuscript · figures · calibrated tables · provenance appendix
        ▶ GATE 7 (PI): approve manuscript
  └─▶ Publication-ready document + reproducible study package
```

### D2 — Orchestrator lives in the Python AI service

Clio is a new module `ai/app/orchestrator/` in the existing FastAPI service. It
reuses `claude_client.py` (Claude SDK, cost tracking, `AGENT_MAX_BUDGET_USD`)
and the StudyAgent MCP transport. It holds **no domain authority**: every
deterministic action is an authenticated call back into the Laravel API, which
owns the models, jobs, RBAC, transactions, and the gate ledger. Rejected
alternatives: a Laravel-side orchestrator (duplicates the LLM plumbing that
already exists in Python) and a standalone microservice (most new infra for no
benefit at this stage).

### D3 — Gate model: block-by-default, override-with-justification

Gates **block by default.** The Study's `principal_investigator_id` or
`lead_statistician_id` may override a failed gate, but only with a **mandatory
written rationale** that is persisted to the gate ledger and reproduced
verbatim in the manuscript's provenance appendix. This matches real
observational-research practice (a known, documented limitation should not
permanently halt a study) while making every deviation auditable. Rejected:
hard-block (too rigid for documented limitations) and advisory-only (this is
today's behavior — it is exactly what let study 114 fail silently).

### D4 — Gate enforcement is mechanical, not advisory

A gate is not a UI suggestion; it is enforced at the tool boundary. The
orchestrator's deterministic levers are MCP/HTTP tools (`generate_cohort`,
`run_study_diagnostics`, `run_estimation`, `calibrate_estimates`,
`export_publication`). A pre-call hook **refuses** `run_estimation` for a study
unless that study's S5 gate is `passed` or `overridden`. Rigor becomes a
property of the wiring, not of operator diligence.

### D5 — Estimate blinding

Through S5, estimation executions return **diagnostics only** — PS distribution,
AUC, equipoise, covariate balance, negative-control distribution. Effect
estimates (HR/OR/RR, CIs) are withheld by the API serializer until the S5 gate
clears. This removes the HARKing surface that study 114's all-in-one payload
created.

### D6 — Empirical calibration is mandatory for inferential studies

Every comparative estimate is calibrated against its negative controls via
`EmpiricalCalibration::fitSystematicErrorModel` +
`calibrateConfidenceInterval`. The manuscript reports **calibrated** estimates
and CIs, the calibration plot, and the EASE metric. A study with too few
*informative* negative controls (study 114 had 2) **fails the calibration
gate** with a clear remediation message rather than silently publishing
uncalibrated point estimates. Multiplicity across multiple outcomes is corrected
(Benjamini-Hochberg by default).

### D7 — Provenance spine: reproducible study packages

Reproducibility is a first-class artifact, not an afterthought:

- `concept_sets.expression_sha256`, `cohort_definitions.expression_sha256`,
  and `analysis_executions.design_sha256` — content hashes of the canonicalized
  definitions.
- `cohort_generations.compiled_sql` (the exact SQL executed),
  `cohort_generations.vocabulary_version`, and
  `cohort_generations.cdm_source_release` — pin the data + vocabulary the cohort
  was built against.
- `study_results.study_design_version_id` — binds every result to the design
  version that produced it (closing the weakest provenance link today).
- `study_packages` — an atomic, exportable snapshot bundling concept-set hashes,
  cohort definitions + compiled SQL, analysis designs, calibrated results, vocab
  version, CDM release, and the full gate-ledger decision trail. This is the
  unit a collaborator re-runs or a reviewer audits.

### D8 — The gate ledger

A single `study_gates` table is the spine of the state machine: one row per
(study, stage, gate_key) with `status`
(`pending|passed|failed|overridden|approved`), the `metrics_json` the gate
evaluated, the `threshold_json` it was checked against, `decided_by`,
`decided_at`, and `override_rationale` (required, non-null when
`status = overridden`). The orchestrator reads it to know what it may do next;
the enforcement hooks read it to decide what to refuse; the manuscript reads it
to write the methods + limitations sections.

## Validation — Hypertension v3 as the golden regression case

Acceptance is defined as **the gates catching the exact failures study 114
shipped.** Re-running study 114 through Clio must produce:

| Study-114 failure | Required Clio behavior |
|---|---|
| PS complete separation (exec 258) | **S5 gate FAILS** on separation / AUC ≈ 1 / equipoise ≈ 0; estimates stay blinded; remediation suggests an active-comparator design. |
| Degenerate pathway, `eventCohortIds=[5425,5426]` | **S3/Design lint FLAGS** event cohorts that are outcomes/pools, not treatment cohorts, before execution. |
| Negative-control panel 10/12 zero events | **S6 calibration gate FAILS** "insufficient informative negative controls (2)"; no uncalibrated estimate is published. |
| Age-binning 100% "Unknown" | **S3 gate FLAGS** the broken characterization stratum as a data-quality defect. |
| Incidence CI 0/0 | Surfaced as a diagnostics flag (the `IncidenceRateResultNormalizer` Byar backfill — already in this session's working tree — supplies real bounds). |
| Infrastructure connection error (exec 262) | Distinguished from a *result*: the run is retried (darkstar `connect_with_retry`, this session's tree) and never recorded as a completed analysis. |

A study that, under the old system, produced a hand-written report full of
caveats must, under Clio, either (a) be **blocked at the right gate with a
precise reason**, or (b) proceed only via a **logged PI/statistician override**
that appears in the manuscript's limitations. That difference is the whole
point of this ADR.

## Consequences

**Positive.** Scientific rigor becomes mechanical and auditable. Studies are
reproducible by construction. The operator-written-report failure mode is
eliminated. Almost all new code is *additive wiring* around services that
already exist; darkstar needs no new packages.

**Negative / costs.** Seven gates add real friction to a study — that is
intentional, but the UX must make each gate fast and legible or researchers will
route around it. The orchestrator adds LLM cost per study (bounded by
`AGENT_MAX_BUDGET_USD`). Estimate blinding requires careful serializer changes
to avoid leaking fields. A prior agentic plan-execution UI was deliberately
removed (commit 93fc212a9) — Clio must not repeat its mistake of orchestration
without an underlying rigor substrate, which is why the gates and deterministic
services (Phases 1–4) land **before** the orchestrator (Phase 5).

**Security.** Per HIGHSEC: every new route carries `auth:sanctum` + a
`permission:` gate; gate-override and publication-approval routes require the
PI/statistician role; the orchestrator authenticates to Laravel with a scoped
service token; no PHI crosses into LLM prompts (designs, counts, and diagnostics
only — never row-level patient data).

## Implementation

Phased plan with task-level detail, file paths, and per-phase acceptance
criteria: **`docs/devlog/plans/protocol-to-publication-implementation-plan.md`**.
Ordering is deliberate — provenance and gates precede the orchestrator so that
the agent is wiring a rigorous substrate rather than improvising one.
