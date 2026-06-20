---
doc_type: lineage
status: historical
date: 2026-06-20
owner: acumenus
module: cohorts
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Http/Controllers/Api/V1/PhenotypeValidationController.php
  - backend/app/Models/App/CohortPhenotypeAdjudication.php
  - backend/app/Models/App/CohortPhenotypePromotion.php
  - backend/database/migrations/2026_06_20_000001_align_phenotype_adjudication_promotion_columns.php
  - backend/tests/Feature/Api/V1/PhenotypeValidationTest.php
related_prs: []
---
# Phenotype Adjudication Contract Completion (A5)

**Date:** 2026-06-20
**Context:** Production-readiness roadmap item **A5 — close the phenotype
validation contract.** Resolves the `PhenotypeValidationController` spec drift
and un-skips the eight `PhenotypeValidationTest` cases that were blocked behind
"Pending PhenotypeValidationController spec alignment".

## What was missing

The adjudication data layer (tables/models for adjudications, per-reviewer
reviews, and audit events) already existed, but the controller used simplified
placeholder behavior: it never recorded per-reviewer reviews or audit events,
did no conflict detection or agreement scoring, computed metrics inline (instead
of queuing), and promoted cohorts unconditionally. The eight skipped tests
specified the real multi-reviewer adjudication contract.

## Schema alignment (migration 2026_06_20_000001)

The feature surface was gated behind the skipped tests, so these tables carry no
production data; the rename is safe.

- `cohort_phenotype_adjudications.reviewed_by` → `reviewer_id` (matches the
  reviews table and the `reviewer()` relation).
- `cohort_phenotype_promotions`: `validation_id` → `phenotype_validation_id`,
  `promoted_by` → `approver_id`, plus new `promoted_quality_tier` and
  `quality_summary_json` (a snapshot of the agreement/metrics at promotion).

## Controller contract (now implemented)

- **Confusion-matrix mapping** from a reviewed adjudication's `(sample_group,
  label)`: cohort_member+case = TP, cohort_member+non_case = FP,
  non_member+non_case = TN, non_member+case = FN.
- **`updateAdjudication`** records a per-reviewer review (`updateOrCreate` on the
  unique `adjudication_id`+`reviewer_id`), writes a `review_update` audit event,
  recomputes the adjudication's consensus label (single distinct review label →
  consensus; two or more → unresolved conflict with a null label), and returns
  the running `counts` and `agreement` summary.
- **`qualitySummary` / agreement**: `review_records`,
  `double_reviewed_adjudications`, `conflict_adjudications`,
  `resolved_conflict_adjudications`, `unresolved_conflict_adjudications`,
  `unreviewed_adjudications`, and `ready_for_promotion` (no unresolved conflicts
  and no unreviewed adjudications).
- **`resolveAdjudication`** sets the authoritative resolved label, marks the
  adjudication `resolved`, and writes a `conflict_resolved` event.
- **`computeFromAdjudications`** gates: unresolved conflicts always block (422);
  unreviewed adjudications block unless `allow_partial`. On success it stores the
  confusion counts, **queues** `RunPhenotypeValidationJob` (status → Queued), and
  returns `counts` (incl. `unreviewed`) + `agreement`.
- **`promote`** is gated on `review_state == completed`, agreement
  `ready_for_promotion`, and computed PheValuator metrics — otherwise 422. It
  records an approver, the promoted tier, and a quality-summary snapshot, and
  flips the cohort's `quality_tier` to `validated`.

## Verification

All 17 `PhenotypeValidationTest` cases pass (102 assertions), including the 8
previously skipped. PHPStan (the restored enforced level 8) and Pint are clean.
The alignment migration was applied to the local `parthenon_testing` schema; CI
runs it via `migrate --force`.
