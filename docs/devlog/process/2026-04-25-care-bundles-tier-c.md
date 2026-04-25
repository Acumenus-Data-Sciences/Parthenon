# CareBundles Tier C — Patient roster + cohort export

**Date:** 2026-04-25

The bridge from "we measured a gap" to "let's intervene on these patients."

## What ships

- New table `app.care_bundle_measure_person_status` — per (run, measure, person)
  fact rows with `is_numer` + `is_excl` flags. Populated during materialization
  via INSERT...SELECT off the same temp tables that drive aggregates and
  strata, so cost is incremental.

- `GET /care-bundles/{bundle}/measures/{measure}/roster?source_id=X&bucket=…`
  paginated roster with minimal demographics (age + sex). Buckets:
  `non_compliant`, `compliant`, `excluded`.

- `POST /care-bundles/{bundle}/measures/{measure}/roster/to-cohort`
  materializes a bucket as a first-class CohortDefinition + CohortGeneration,
  with members written to the source's `results.cohort` table. Sentinel in
  `expression_json` marks it as derived (don't regenerate). Mirrors
  IntersectionCohortService.

- New `Users` icon button on every measure row → `MeasureRosterModal`.
  Bucket toggle, paginated table, "Save N patients as cohort" form, success
  banner with the new cohort id.

## Live verification on Acumenus HTN-01

- Materialization: 5:36 (394K persons, 6 measures, 2.36M fact rows written)
- Roster API call: **135 ms**
- Buckets: compliant 280,267 / non_compliant 98,104 / excluded 15,813 — sums
  match the prior aggregate exactly.

## Why this matters

Researchers who want to study outcomes for the 98K BP-uncontrolled patients
no longer have to leave the workbench, write SQL, or rebuild a cohort by
hand. One click → a cohort that downstream Studies (CohortMethod, PLP,
risk-score evaluation) can consume immediately.
