# CareBundles Tier A — Methodology card, DQ flags, Stratification

**Date:** 2026-04-24

Three researcher-grade trust upgrades shipped together:

- **A1 — Per-measure methodology card.** New endpoint surfaces exact concept_ids
  with names, descendant counts via concept_ancestor, lookback windows,
  CDM provenance (schema + max date per domain), and the current run pointer.
  Click any "ⓘ" icon next to a measure to open it.

- **A2 — Data-quality flags.** Computed from source row counts and result
  shape: `domain_empty`, `numerator_concepts_unused` (critical), `rate_near_zero`,
  `rate_near_one`, `wide_confidence_interval` (warn/info), `denominator_below_30`,
  `high_exclusion_rate`. Each flag carries a researcher-facing explanation —
  "0% may be documentation gap rather than care-delivery failure."

- **A3 — Age + sex stratification.** Pre-computed during materialization via a
  GROUPING SETS aggregate over a per-measure temp-table population set.
  Click the chevron next to any measure to see the breakdown.

## Performance

- Materialization on Acumenus HTN (394K persons, 6 measures): **3 min 16 sec**
  (down from 7 min for headline-only and 19+ min for headline + on-click strata).
- Strata read: **88 ms** (was 19+ min for the on-click CTE approach).
- Trade-off: per-measure temp tables (`cb_eval_numer_pp`, `cb_eval_excl_pp`)
  with index + ANALYZE means the CDM domain scan happens exactly once per
  measure; subsequent aggregate query is a join over small in-memory sets.

## Real findings on Acumenus HTN

| Stratum     | BP-control rate (95% CI)   | N       |
|-------------|----------------------------|---------|
| 18–44       | 90.8% (90.5–91.0%)         | 67,805  |
| 45–64       | 88.7% (88.5–88.9%)         | 132,510 |
| 65–74       | 75.4% (75.0–75.7%)         | 68,869  |
| 75+         | **45.1% (44.8–45.4%)**     | 109,181 |
| Female      | 76.7% (76.5–76.9%)         | 173,573 |
| Male        | 71.9% (71.7–72.1%)         | 204,798 |

A 45-percentage-point gap from younger adults to elderly is the kind of
finding that drives quality improvement work — exactly what Tier A was
designed to surface.
