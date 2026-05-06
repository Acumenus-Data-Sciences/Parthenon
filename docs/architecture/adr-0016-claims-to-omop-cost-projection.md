# ADR 0016 — `claims_to_omop` COST Projection (Parthenon Commercial Wedge)

**Status:** Accepted (2026-05-06)
**Deciders:** Phase 3 spec §2 + Q1=(b'); Phase 3 Plan 1 (T-021A).
**Implements:** Phase 3 Plan 1 — X12 837 reader + COST projection (the
first slice of T-021 `claims_to_omop`).

## Context

Parthenon ingests US healthcare claims data (X12 837 P/I/D, X12 835,
NCPDP) and projects it to OMOP CDM v5.4. The same projection problem is
solved by [Data2Evidence
(D2E)](https://github.com/data2evidence/d2e), the OHDSI-aligned
ingestion stack maintained by SAP. D2E ships the canonical reference
implementation for FHIR → OMOP, claims → OMOP, and HL7 v2 → OMOP, but
**D2E does not project costs**. Its claims pipeline lands
`procedure_occurrence` and `condition_occurrence` rows but skips the
OMOP CDM v5.4 `cost` table entirely.

This is a deliberate D2E choice — the open-source pipeline is targeted
at clinical research where the cost dimension is rarely present in the
source EHR feed. But for commercial-payer data (which always ships
charged / allowed / paid amounts) and for cost-effectiveness research
(HEOR, value-based-care benchmarking, real-world economic-evidence
studies), the absence of `cost` is a research-blocking gap.

T-021 §"why this matters" identified the COST projection as the
**Parthenon commercial wedge** — the differentiator that justifies the
proprietary `parthenon-templates-commercial` wheel in the Phase 3
two-tier license model (Phase 3 Q1=(b')).

## Decision

**Project X12 837/835 amounts to OMOP CDM v5.4 `cost` rows in the
`claims_to_omop` template.** The convention shipped in Plan 1:

### Cost-event anchor

- **Line-level:** every claim line emits up to three `cost` rows
  (charged, allowed, paid). `cost_event_field_concept_id = 1147301`
  ("procedure_occurrence"). `cost_event_id = procedure_occurrence_id`.
- **Header-level (Institutional 837I only):** every institutional claim
  additionally emits visit-level header rows (`charged + paid`).
  `cost_event_field_concept_id = 1147300` ("visit_occurrence"). 837P
  (Professional) and 837D (Dental) claims do NOT emit header rows —
  their cost is line-level by construction.

### Cost-concept selectors

| `cost_concept_id` | Meaning           | Source (X12)                                  |
|-------------------|-------------------|-----------------------------------------------|
| 31968             | Total charged     | SV1\*02 / SV2\*03 / SV3\*02 (837 line); CLM02 (header) |
| 31976             | Total allowed     | CAS\*A adjudication (835); not in 837 alone    |
| 31973             | Paid by payer     | SVC\*04 (835); not in 837 alone                |

The three concept IDs are OMOP standardized vocabulary entries (Cost
Concept Class) and represent the OHDSI-blessed taxonomy for X12
837/835 amount kinds.

### Currency

`currency_concept_id = 44818668` (United States Dollar) — **hard-coded**
in v0.1. See *Open follow-ups* below for the multi-currency plan.

### NULL semantics

- `charged_amount` is always present on a 837 line (`Field(ge=0)`) and
  always projects to a row.
- `allowed_amount` and `paid_amount` are NULL on 837-only loads (those
  amounts come from the 835 remit). Plan 2 (T-021B, X12 835 reader)
  will UPSERT-update the source rows; the COST mapper re-runs and
  emits the additional rows on the next pipeline pass.
- `revenue_code_concept_id` is populated only for institutional claims
  (837I has SV2\*01 revenue code; 837P/D do not).
- `payer_plan_period_id` is NULL until upstream member-eligibility data
  is loaded — it's not derivable from a 837 transaction alone.

## Consequences

### Positive

- Customers running `claims_to_omop` can answer cost-effectiveness
  research questions D2E can't: per-procedure unit cost trends,
  payer-level allowed-vs-paid ratios, hospital revenue-cycle benchmarks,
  high-cost-claimant episode analysis, and real-world economic-evidence
  studies for value-based-care contracts.
- The OMOP `cost` table is the standard target — Atlas, OHDSI HADES
  packages (e.g., `Eunomia`, `CohortMethod`), and downstream
  visualization tooling consume it natively. We don't break interop.
- The `parthenon-templates-commercial` wheel becomes a hard dependency
  for any analytics that joins `cost`, anchoring the commercial tier.

### Negative / risk

- **Wheel split contract:** the AGPLv3 community wheel
  (`parthenon-templates`) MUST NOT import from
  `runtime.commercial.*`. The `import-linter` contract at
  `templates/.importlinter` enforces this. Adding a community-tier
  consumer of COST requires re-deriving the projection in OSS-licensed
  code — non-trivial.
- **Currency ambiguity:** customers with multi-currency feeds (Canadian
  payers, multi-national employer plans) cannot use v0.1 unmodified.
  See *Open follow-ups*.
- **Reconciliation latency:** allowed/paid rows only land after the 835
  remit arrives, which can be 2-180 days post-claim. The mapper is
  re-runnable but customers querying "real-time" cost data will see
  charged-only rows for unreconciled claims.

### Validation

The Plan 1 §10 E2E test
(`tests/e2e/commercial/test_claims_to_omop_837.py`) generates a
seed=42 / n_claims=50000 synthetic 837 corpus (~111k lines), runs the
reader + projector pipeline, and asserts:

1. Total processing completes in <30 minutes (T-021 perf budget).
2. Per-(claim_type, cost_event_field, cost_concept) row counts match
   the seed=42 / n_claims=100 sentinel CSV scaled by mix ratio (±2%).
3. Zero orphan `procedure_occurrence` rows without a matching
   `cost_event_field_concept_id = 1147301` cost row.

The full SQL pipeline is wired to the `parthenon-templates` runner in
Plan 2; until then the in-process reader → projector path is the
load-bearing test.

## Alternatives considered

### Custom `parthenon_cost` table

We considered shipping a Parthenon-private cost table outside the OMOP
schema. **Rejected** — losing OHDSI interop is too high a price for a
modest v0.1 simplicity gain. Aurora, Atlas, and any downstream HADES
analytics expect to find cost data at `cdm.cost`. Forcing customers to
union our private table into their queries would break the "drop-in
OMOP" value proposition.

### 835-only cost (skip 837 charged amounts)

Pulling cost only from the 835 remit (allowed + paid) and skipping 837
charged-amount projection was considered as a simpler v0.1.
**Rejected** — charged-amount is the primary cost dimension for
unreconciled claims (claims still in payer adjudication), and the most
common HEOR question is "what did the provider bill?". Losing
charged-amount visibility breaks the primary use case.

### Currency-aware projection in v0.1

Auto-detecting currency from payer-country metadata + supporting
multi-currency `cost.currency_concept_id` was considered.
**Deferred** — adds material complexity (currency lookup tables,
exchange-rate handling for cross-currency aggregations) for a
single-digit-percent slice of the addressable customer base in the
Phase 3 timeframe. See *Open follow-ups*.

## Open follow-ups

1. **Multi-currency support (Phase 4).** Detect currency from payer
   metadata (X12 envelope GS04/GS05, ISA12 routing); populate
   `currency_concept_id` accordingly; add an
   `claims_to_omop_normalize_currency` post-stage for cross-currency
   aggregation. Tracked in Phase 4 spec §"international claims".
2. **`payer_plan_period` table population.** Requires upstream
   member-eligibility data (X12 271, 834, or proprietary feeds) — not
   in 837 itself. The current mapper leaves `cost.payer_plan_period_id`
   NULL.
3. **Reversal / voided-claim handling.** Plan 2's 835 reconciliation
   will surface CAS-segment claim adjustments (denials, takebacks,
   voided claims). The COST projection convention needs to handle
   reversal by emitting offsetting rows or by updating the existing
   row's `cost_concept_id`. Decision deferred to Plan 2 ADR.
4. **OMOP CDM v6.0 migration.** The `cost` table shape changed in v6.0
   draft (composite types, per-event currency). Re-evaluate when v6.0
   stabilizes.

## References

- OMOP CDM v5.4 §COST —
  https://ohdsi.github.io/CommonDataModel/cdm54.html#COST
- D2E claims pipeline —
  https://github.com/data2evidence/d2e/tree/main/etl/claims
- X12 837P implementation guide 005010X222A1 (Washington Publishing).
- X12 835 implementation guide 005010X221A1 (Washington Publishing).
- HIGHSEC §7 — `/.claude/rules/HIGHSEC.spec.md`.
- Phase 3 Plan 1 — `docs/superpowers/plans/2026-05-06-parthenon-ingestion-templates-phase-3-plan-1-x12-837.md`.
- ADR 0015 (`sql_file://` reader) — `docs/architecture/adr-0015-sql-file-reader.md`.
