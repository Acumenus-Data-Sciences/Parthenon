# Parthenon Ingestion Templates — Phase 4, Plan 3: Auto-approval policy + confidence calibration

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

> **GATE — calibration**: top-1 precision ≥ **0.99** on Plan 1's blind set. Phase 4 spec Q3 + R2 mitigation.

**Goal:** Calibrate a confidence cutoff above which Harmonia mappings are written directly to `app.parthenon_concept_map` without reviewer approval. Reviewer UI surfaces "Recently auto-approved" with a `Challenge` button so reviewers can claw back if downstream analytics surface anomalies.

**Architecture:**

- **Calibration data:** Plan 1's blind set (521 rows, fine-tuned bge-base + Haiku 4.5 reranker). Plot top-1 precision vs confidence threshold; pick the cutoff where top-1 precision ≥ 0.99.
- **Auto-approver node:** `templates/commercial/runtime/commercial/mapping/auto_approver.py`. Consumes `app.parthenon_mapping_review_queue` rows where `top1_confidence >= cutoff`, writes to `app.parthenon_concept_map` with `reviewer_id = NULL` (system auto-approval) and `status = 'approved'` on the queue row. Per-batch limit param to keep the work bounded.
- **Reviewer UI extension:** new tab "Recently auto-approved" on `/admin/mapping-review`. Shows last N auto-approved mappings with a `Challenge` button. Challenge flips status back to `pending` and clears `omop_concept_id` from `parthenon_concept_map`.
- **HIGHSEC §7:** auto-approver is commercial-tier only. Default behavior is OFF — customers opt in via a feature flag in `app.system_settings`.

**Tech Stack:** Python (commercial wheel) + Laravel API + React reviewer UI + matplotlib for the calibration plot artifact.

**Depends on:** Plan 1 (LoRA fine-tune + acceptance run on blind set).

**Unblocks:** Customer auto-approval rollout in production.

---

## Conventions

- Backend conventions same as prior plans.
- Branch: `feature/phase-4-plan-3-auto-approval-calibration`.
- Type names: `AutoApprovalPolicy`, `ConceptMappingAutoApproverNode`, `useAutoApprovedMappings`, `useChallengeMappingMutation`.
- Default `auto_approver.enabled = false` — Q3 says calibrate first, expose later.

---

## Task index (8 tasks)

1. **Calibration script** — `templates/commercial/scripts/calibrate_auto_approval.py`. Reads blind-set acceptance output (Plan 1 Task 8), computes precision-at-confidence-threshold curve. Picks the lowest cutoff where top-1 precision ≥ 0.99. Writes `_eval/auto_approval_calibration.md` + `auto_approval_calibration.png`.
2. **AutoApprovalPolicy** — `mapping/auto_approver.py::AutoApprovalPolicy`. Constructor takes `cutoff: float`. `should_auto_approve(queue_row) -> bool` returns `top1_confidence >= cutoff AND top_candidate.standard_concept == 'S'`.
3. **ConceptMappingAutoApproverNode** — runtime node that scans pending queue rows, applies the policy, writes approvals. Default batch size 100. Idempotent (re-runs skip already-approved rows). Logs per-batch counts.
4. **Settings flag + admin UI** — `app.system_settings.auto_approver_enabled` (boolean, default false) + `auto_approver_cutoff` (numeric, default = calibration result). Admin settings page exposes both with help text.
5. **Reviewer UI: Recently auto-approved tab** — new route segment `/admin/mapping-review/auto-approved`. Paginated table identical shape to the queue page but filtered to `reviewer_id IS NULL AND status = 'approved'`.
6. **Challenge mutation** — `useChallengeMappingMutation` POSTs to `/api/v1/mapping-review/queue/{queueId}/challenge` (new endpoint on `HarmoniaReviewController`). Endpoint flips status to `pending`, clears `approved_concept_id` + `approved_map_id`, deletes the matching `parthenon_concept_map` row. Captures `challenge_reason` (required) for the audit trail.
7. **Pest tests** — calibration math is regression-tested with synthetic data; auto-approver writes the right rows; challenge flow restores the queue row + removes parthenon_concept_map; auto-approver respects the feature flag.
8. **ADR amendment** — amend ADR 0019 with the calibration plot reference + chosen cutoff + Challenge flow. Decide: ship with `enabled=false` default; flip to `true` per-customer after a 30-day baseline period.

---

## Done

Calibration plot in repo, auto-approver node with feature-flag gating, reviewer UI's "Recently auto-approved" tab with `Challenge` button, ADR 0019 amended.
