---
doc_type: lineage
status: historical
date: 2026-06-21
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
  - docs/lineage/plans/open/protocol-to-publication-implementation-plan.md
  - backend/app/Support/Hashing/DefinitionHasher.php
  - backend/app/Services/Analysis/Calibration/CalibrationService.php
  - backend/app/Services/Studies/Gates/StudyGateService.php
  - backend/app/Services/Studies/Gates/GateThresholdEvaluator.php
  - backend/app/Support/EstimationResultNormalizer.php
  - backend/app/Services/Analysis/CohortDiagnosticsService.php
  - backend/app/Services/Publication/ManuscriptComposer.php
  - backend/app/Http/Controllers/Api/V1/StudyOrchestratorController.php
  - ai/app/orchestrator/state_machine.py
  - darkstar/api/calibration.R
  - backend/tests/Feature/Studies/HypertensionV3RegressionTest.php
  - backend/tests/Feature/Studies/ManuscriptComposerTest.php
  - backend/tests/Unit/Services/Analysis/Calibration/CalibrationServiceTest.php
  - ai/tests/test_orchestrator.py
---

# Protocol-to-Publication (ADR-0020) — Implementation Closeout

This closeout records the shipped evidence for each phase of the ADR-0020
protocol-to-publication pipeline. All seven phases (P0–P6) landed in code with
passing tests between 2026-06-19 and 2026-06-21. It satisfies the
`docs/lineage/plans/open/2026-06-18-application-completion-plan.md` Phase 3
acceptance "Protocol-to-publication has shipped closeout evidence for each
phase." The implementation plan
(`docs/lineage/plans/open/protocol-to-publication-implementation-plan.md`)
**remains open** for the one outstanding acceptance: the live gated re-run of
the golden regression study (`app.studies.id = 114`).

## Per-phase shipped evidence

| Phase | Deliverable | Code | Test | Commit |
|---|---|---|---|---|
| **P0** | Regression harness for the golden study-114 failures | `backend/tests/Feature/Studies/HypertensionV3RegressionTest.php` | Load-bearing cases un-skipped: S5 gate-fail + blinding, S6 calibration-fail, incidence-rate CIs (green). 3 cases remain `markTestSkipped` as explicitly-scoped future discrete rules (design-lint, 100%-Unknown DQ-flag, connection-retry), documented in-test. | `8fd842c70` |
| **P1** | Provenance spine (SHA-256 over definitions) | `backend/app/Support/Hashing/DefinitionHasher.php`; consumed by `CohortDefinition`, `ConceptSet`, `AnalysisExecution`, `StudyPackageService`, `Console/Commands/Provenance/BackfillProvenanceHashes` | Provenance asserted in `ManuscriptComposerTest` (`study_diagnostics=overridden`) | — |
| **P2** | Empirical calibration service + R endpoint | `backend/app/Services/Analysis/Calibration/CalibrationService.php`; `darkstar/api/calibration.R` (`POST /analysis/calibrate`) | `CalibrationServiceTest` (payload contract, insufficient-controls refusal, error fallback — green) | `f9b208182` |
| **P3** | Gate ledger, blocking gates, estimate blinding | `StudyGateService::blindEstimationIfGated()`, `GateThresholdEvaluator`, `EstimationResultNormalizer::blind()` | `HypertensionV3RegressionTest` S5 (blind strips estimates — green) | — |
| **P4** | Missing/inclusion cohort diagnostics | `backend/app/Services/Analysis/CohortDiagnosticsService.php::getInclusionAttrition()` (emits `severe_inclusion_attrition`) | Live-verified cohort 68 → 29,204 entry → 27,702 final | `5b4c39a95` |
| **P5** | Abby orchestration via python-ai with recoverable job state | `ai/app/orchestrator/{state_machine,guards,tools}.py`; Laravel relay `StudyOrchestratorController` (`POST /orchestrate`, scoped Sanctum token); channel `abby.study.{study}` | `ai/tests/test_orchestrator.py` — 7 passed in the python-ai container (study-114 halts at S5 with estimates blinded, full-pass, S6 halt, guards) | `40cb5c3ab` |
| **P6** | Manuscript synthesis with provenance-linked sections | `backend/app/Services/Publication/ManuscriptComposer.php` | `ManuscriptComposerTest` — gate-aware compose, withholds estimates when gate uncleared, never prints a fabricated effect number (green) | `ed6ca4eaf` |

## Adjacent verified evidence

- **HADES sidecar readiness** (Phase 3): 40/40 HADES packages installed, 0
  required missing, real end-to-end compute; recorded in
  `docs/lineage/modules/analyses/2026-06-20-hades-sidecar-readiness-verification.md`.
- **Sidecar contract tests** (Phase 3): `backend/tests/Unit/Services/RServiceTest.php`
  covers all four runners across success / invalid-input / legacy
  `not_implemented` / empty-non-JSON / connection-failure.
- **`r_not_implemented` decision** (Phase 3): retained as a defensive fallback for
  unconfigured deployments (decision recorded in commit `cc3faba17`).

## Remaining before the implementation plan can close

1. **Live gated re-run of study 114** with `execute=true`, confirming the
   orchestrator halts at S5 with estimates blinded against real analytics
   (offline + dry-walk already proven; the full live run is ~90 min of prod
   analytics and is the last acceptance).
2. **UI diagnostics** (Phase 3 sub-item, not P0–P6): the dedicated
   `EstimationResults.tsx` / `PredictionResults.tsx` sidecar-pending branch still
   renders generic copy rather than package/environment-specific diagnostics.
3. **Frontend contract coverage** for the resolved phenotype-validation behavior
   (the backend contract — 17 cases, 0 skips — is shipped).

Once item 1 lands, move
`docs/lineage/plans/open/protocol-to-publication-implementation-plan.md` to
`plans/closed/` with `status: shipped` and link this closeout.
