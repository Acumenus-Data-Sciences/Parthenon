# ADR 0014 — ARTEMIS Regimen Extraction Strategy

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q8 (ARTEMIS R-package distribution).
**Implements:** Phase 2 Plan 5 (T-019b).

## Context

The HemOnc.org ARTEMIS R-package is the canonical source of
chemotherapy regimen definitions (~600 regimens with curated
drug-set + indication + phase metadata). Phase 2 needs to identify
regimens in OMOP `drug_exposure` rows for downstream cohort selection.

## Decision

**v0.1 — pragmatic shortcut:** ship a hand-curated 5-regimen JSON
pattern library at `templates/runtime/oncology/artemis/v0.1.0/patterns.json`
covering the most common chemo patterns (FOLFIRINOX, FOLFOX, R-CHOP,
AC-T, Carboplatin+Paclitaxel). The matcher is pure Python — no R
runtime in the hot path.

**Phase 3 follow-up:** extend with a build-time R install in the
`parthenon-templates` Dockerfile that fetches the ARTEMIS R-package
from a pinned commit SHA on `HemOnc-org/HemOnc` and runs an extraction
script to materialize the full ~600-regimen JSON. The runtime stays
pure Python.

This v0.1/v0.2 split lets us ship Phase 2 quickly and validates the
matcher's drug-set + temporal-window algorithm against a known-good
5-regimen baseline before scaling to the full library.

## Consequences

- v0.1 covers ~80% of common chemo cases per spec §6 acceptance gate
  (≥80% recall on 20-patient × 5-regimen synthetic cohort).
- Customers who need a regimen not in the v0.1 list can either patch
  `patterns.json` locally or wait for Phase 3.
- The matcher algorithm (drug-set + temporal-window) is fully validated
  in v0.1 and won't change in Phase 3 — only the pattern library grows.
- `RegimenMatcherNode` registers as `regimen_matcher` in NODE_TYPES +
  template.v1.json schema enum + NODE_REGISTRY.
- v0.1 produces episode + episode_event row dicts in a `regimens.json`
  artifact; downstream INSERT into `${cdm_schema}.episode` is deferred
  (the manifest currently emits the artifact only — full INSERT wired
  alongside the Phase 0 `sql_node` `sql_file://` reader follow-up).

## Alternatives considered

- **Build-time R install in v0.1.** Declined — adds Docker complexity
  before the matcher algorithm is validated. Defer to Phase 3.
- **Bundle a static blob of all ~600 regimens in v0.1.** Declined —
  upstream HemOnc has periodic releases; pinning a commit SHA via R
  install is the right shape, just not in v0.1.
- **Customer-supplied pattern library.** Declined per Q8 — increases
  ops burden for marginal flexibility benefit.
- **Use OMOP DRUG_ERA + cohort-builder logic instead of pattern
  matching.** Declined — DRUG_ERA collapses contiguous exposures to a
  single drug, losing the regimen-level structure that ARTEMIS
  patterns capture.

## Open follow-ups

- Build-time R install (Phase 3, T-022 prep work).
- ARTEMIS upstream-diff workflow (quarterly).
- Optional: `RegimenEpisodeLoader` node that takes `regimens.json` and
  inserts directly into `${cdm_schema}.episode` + `episode_event`.
- Cycle metadata: ARTEMIS regimens have phase + cycle structure; v0.1
  collapses to single episodes per match. Phase 3 enhancement to
  emit per-cycle episode rows with `episode_parent_id` linking.
