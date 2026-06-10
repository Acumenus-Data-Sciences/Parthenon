---
doc_type: handoff
status: shipped
date: 2026-06-10
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/app/Services/Studies/Gates/StudyGateService.php
  - backend/app/Services/Studies/Gates/GateThresholdEvaluator.php
  - backend/app/Support/EstimationResultNormalizer.php
  - backend/app/Services/Publication/ManuscriptComposer.php
  - backend/app/Http/Controllers/Api/V1/AbbyAgentController.php
  - ai/app/agents/abby_tools.py
  - darkstar/R/calibration.R
related_prs:
  - 357
  - 358
  - 359
  - 360
---
# Devlog — Abby protocol-to-publication pipeline shipped (ADR-0020)

**2026-06-09 → 2026-06-10.** Designed and shipped the full gated
protocol-to-publication pipeline (ADR-0020), then rebranded the orchestrator to
**Abby**, Parthenon's default assistant. All work is merged to `main` and
deployed to production. Gating is **OFF by default** — existing study behaviour
is unchanged until `STUDIES_GATING_ENABLED` is set.

## What shipped

| Phase | PR | Delivers |
|---|---|---|
| 1 · Provenance spine | #357 | `expression_sha256` on concept sets/cohorts/designs; compiled-SQL + vocab/CDM pinning on `cohort_generations`; `study_packages`; null-only backfill command |
| 2 · Empirical calibration | #357 | `darkstar/R/calibration.R` (fitNull → convertNullToErrorModel for negative-controls-only designs); calibrated CIs + EASE; Benjamini-Hochberg multiplicity; `CalibrationPanel` |
| 4 · Cohort diagnostics | #357 | index-event breakdown + orphan-concept detection (S3 gate inputs); shared `ConceptIdExtractor` |
| 3 · Gate ledger + blinding | #357 | `app.study_gates`; `GateThresholdEvaluator` (pure); `StudyGateService` (evaluate/approve/override-with-rationale/enforce); estimate blinding; RBAC API; 7-stage `StudyGatesTab` |
| 5 · Orchestrator agent | #357 | `abby` profile + tool pack in the Claude Agent SDK harness; reads/evaluates gates, proposes remediations, never decides validity; execute tools approval-gated |
| 5b · Agent launch surface | #358 | `AbbyAgentController` + `AbbyCopilotPanel` (in the Gates tab) |
| 6 · Manuscript composer | #359 | gate-aware, fabrication-free STROBE/RECORD synthesis; `ManuscriptComposer` + `StudyManuscriptController` |
| — · Rebrand Clio → Abby | #360 | one universal AI brand; pure rename, zero behaviour change |

## Validation

- **On study 114's real production data**, the gates correctly FAIL an
  estimation that "completed" and would have been treated as valid under the old
  system: S5 fails (max post-adjustment SMD 0.31 > 0.10, residual imbalance), S6
  fails (0 informative negative controls). Under gating, its effect estimates
  stay blinded until a reviewer approves or overrides with a logged rationale.
- **Calibration** live-validated against darkstar: a planted +0.2 systematic
  bias was recovered (null mean 0.19), the calibrated CI widened, EASE 0.14.
- **Diagnostics SQL** validated against the 2.3M-row CDM (index-event `EXPLAIN`
  plan valid; orphan query flagged a fake concept at 0 occurrences vs Essential
  hypertension at 380,336).
- Test suites green: 51 backend Pest + 52 AI pytest, plus Pint, PHPStan L8, tsc,
  ESLint, vite, mypy across every PR.

## Deployment state (prod)

- Migrations applied: provenance columns (Phase 1) + `study_gates` (Phase 3).
- Full `./deploy.sh` run: route/config caches cleared (new `gates`,
  `agent/sessions`, `manuscript` routes registered), frontend rebuilt, smoke
  checks 200. `python-ai` + `darkstar` restarted to pick up the renamed code;
  `abby` profile loads live; darkstar HADES `parity_status: ready`.
- **`STUDIES_GATING_ENABLED` is unset (false)** — no behaviour change for
  existing studies. To trial: set it in `backend/.env`, `docker compose up -d`,
  open a study's **Gates** tab.

## Remaining follow-ups (non-blocking)

- A frontend "Generate manuscript" action on the study page.
- Optional per-section AI prose enrichment over the existing publish narrative
  endpoint.
