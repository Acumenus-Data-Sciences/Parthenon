---
doc_type: reference
status: active
date: 2026-05-11
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - scripts/docs/catalog_lineage_docs.py
related_prs: []
---

# Open Plan Backlog

This directory is intentionally small. Every plan left here still has an
unmet implementation, acceptance, hosted-workflow, or environment-bound
verification gate. Plans should move to `../closed/` only when their
frontmatter can name the closeout document, shipped module record, ADR
amendment, release record, or successor plan that proves the lifecycle state.

## Current open plans

| Plan | Why it remains open | Closure trigger |
|---|---|---|
| `2026-06-19-production-readiness-roadmap.md` | Consolidates the remaining path to a production-ready release into three gates (GA blockers, trust/quality hardening, scope decisions), folding the completion audit and protocol-to-publication plan together with assessment findings (PHPStan ignore-debt, no coverage floor, thin frontend test depth, orphaned `self-controlled-cohort` module, AI CORS, security/scale/DR). | Ship or de-scope every Gate A item, close Gate B hardening, convert Gate C into recorded decisions, then move to `../closed/` with closeout evidence. |
| `2026-06-18-application-completion-plan.md` | Deep completion audit found red validation gates, visible placeholders, skipped contract tests, documentation lifecycle drift, and unfinished analytics/ingestion/AI workflows that need coordinated closure. | Ship or explicitly de-scope the P0/P1 items, reconcile open-plan governance, make validation gates reproducible, and move this plan to `../closed/` with closeout evidence. |
| `protocol-to-publication-implementation-plan.md` | ADR 0020's gated protocol-to-publication phases remain an active checkpointed plan; the implementation record still names provenance, calibration, gate, orchestrator, and manuscript acceptance gates. | Complete or explicitly supersede the remaining phases, update ADR 0020 and closeout evidence, and move this plan to `../closed/`. |
| `2026-04-23-signed-release-packaging.md` | Signing workflow and public-key scaffolding exist, but the lineage does not yet show a first verified signed macOS/Windows/Linux native release asset set. | Attach signed release assets, verify signatures/notarization/trusted signing from the published release, and link the closeout or release note. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-1-bge-base-lora.md` | ADR 0019 still names per-vocabulary bge-base LoRA as the retrieval-recall follow-up; adapter training code, accepted metrics, and hosted artifact evidence are not in the repo. | Land the LoRA training/loader path, record seen/blind acceptance numbers, and amend ADR 0019. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-2-reviewer-ui-timed-test.md` | The reviewer UI exists, but this plan's seed harness and 200-row timed-review evidence are not recorded. | Run the timed reviewer session, record the wall-clock and decision distribution, and amend ADR 0019 plus the Phase 3 Plan 7 closeout. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-3-auto-approval-calibration.md` | Auto-approval depends on Plan 1's calibrated blind-set scores; there is no calibration artifact, feature flag, or challenge workflow evidence yet. | Commit the calibration report, disabled-by-default auto-approver, challenge flow, tests, and ADR 0019 amendment. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-4-cross-encoder-rerank.md` | This is conditional on Plan 1; no post-LoRA decision exists to ship it or mark it HOLD-FINAL. | After Plan 1 metrics, either ship the reranker with acceptance lift evidence or amend ADR 0019 with a HOLD-FINAL decision. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-5-llettuce-reeval.md` | ADR 0013 keeps Llettuce eval-only and says the next reconsideration trigger is issue #295 / Plan 1. | Re-run the graduation eval after Plan 1 or amend ADR 0013 with a final hold decision tied to the post-LoRA evidence. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-6-fhir-bulk-data-reader.md` | The existing FHIR ingestion stack does not include this claims-specific Bulk Data reader, streaming claims manifest, PHI guard, or ADR 0016 amendment. | Ship the reader/manifest/E2E path and update ADR 0016 with the streaming companion contract. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-7-federated-mapping-spike.md` | The spike is gated on Hive Networks federated query readiness; no spike code, POC evidence, or design memo is recorded here. | Record the Hive readiness probe, POC screenshots or stub walkthrough, and federated mapping design memo. |
| `2026-05-07-parthenon-ingestion-templates-phase-4-plan-8-upstream-diff-workflows.md` | Some upstream-diff infrastructure exists, but the plan contract also requires quarterly cadence, shared auto-PR helper, and an operator devlog. | Convert the ARTEMIS/NAACCR jobs to the agreed quarterly auto-PR pattern, add the shared helper or document why it was superseded, and land the operator devlog. |

## Closure rules

- Keep active implementation plans in this directory only while they can still
  drive work.
- Move shipped or superseded plans to `../closed/` in the same commit that sets
  `status: shipped` or `status: superseded` and fills `superseded_by`.
- Regenerate `../catalog.md` with `python3 scripts/docs/catalog_lineage_docs.py
  --write-catalog` after moving files.
