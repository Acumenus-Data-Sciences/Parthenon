# claims_to_omop — X12 837 → OMOP CDM v5.4 + COST projection

**Tier:** Commercial. Ships in the `parthenon-templates-commercial` wheel.

**Plan:** Phase 3 Plan 1 (T-021A). The first slice of T-021. Plan 2
(T-021B) joins onto this output via `claim_id` for X12 835 remit
reconciliation.

## What it does

Reads X12 837 (Professional / Institutional / Dental) transactions and
projects them to:

| OMOP CDM v5.4 table     | Source 837 segments                       |
|-------------------------|-------------------------------------------|
| `visit_occurrence`      | CLM01, DTP\*434, NM1\*85 (rendering provider) |
| `procedure_occurrence`  | LX + SV1/SV2/SV3 (per service line)        |
| `condition_occurrence`  | HI\*ABK / ABF / BK / BF (ICD-10 dx)         |
| `cost`                  | SV\*02/03 (charged), CAS\*A (allowed), SVC\*04 (paid) |

The COST projection is the **Parthenon-specific commercial wedge** —
D2E does not ship a COST mapper. Customers running this template can
answer cost-effectiveness research questions D2E can't. See
`docs/architecture/adr-0016-claims-to-omop-cost-projection.md`.

## Pipeline (12 stages)

```
bootstrap_source ──┬─> load_837 ──┬─> map_visit_occurrence ──┬─> map_procedure_occurrence ──┬─> project_cost ──┬─> summarize ──> validate
                   │              │                          │                              │                  │
                   └─ bootstrap_cdm                          ├─> map_condition_occurrence   ├─> cost_sentinel_check
                                                                                            ├─> orphan_procedure_check
                                                                                            └─> condition_recall_check
```

Stages 9-11 (`cost_sentinel_check`, `orphan_procedure_check`,
`condition_recall_check`) materialize sentinel artifacts that the
validation pack at `validation/expected/post_conditions.yaml` asserts
against. These are required for the 100k-line E2E acceptance.

## Parameters

| Name           | Default            | Notes |
|----------------|--------------------|-------|
| `x12_root`     | (required)         | Directory of 837 transaction files. |
| `source_schema`| `claims_source`    | Holds `fmt_837_claim` / `fmt_837_line`. |
| `cdm_schema`   | `claims_cdm`       | Target OMOP CDM. |
| `vocab_schema` | `vocab`            | Shared OMOP vocabulary tables. |
| `app_schema`   | `app`              | Run book-keeping. |
| `run_id`       | `0000…`            | UUID for unmapped-concepts queue. |

## Required vocabularies

`ICD10CM`, `CPT4`, `HCPCS`, `SNOMED`, `RxNorm`. The mappers join against
`vocab.concept_relationship` with `relationship_id = 'Maps to'` to land
on standard SNOMED / RxNorm concepts.

## COST conventions (v0.1)

- Currency hard-coded to USD (`44818668`). Multi-currency is a Phase 4
  follow-up — see ADR 0016 §Open follow-ups.
- Charged amount projects always; allowed/paid only when non-NULL on the
  source.
- Professional + Dental claims emit COST rows at the
  `procedure_occurrence` level (anchor = `1147301`). Institutional
  claims additionally emit visit-level header totals (anchor =
  `1147300`).

## Validation

`validation/expected/post_conditions.yaml` — reference row counts.
`validation/expected/cost_sentinels.csv` — known-value sentinels for the
seed=42 100-claim corpus. The E2E test
(`tests/e2e/commercial/test_claims_to_omop_837.py`) asserts the
100k-line synthetic corpus processes in <30 minutes (T-021 perf budget)
and cost sentinel row counts match expected ±2%.

## HIGHSEC §7

The `X12_837_Reader` redacts NM109 values (provider NPIs + subscriber /
member IDs) from log output via `_RedactingFilter`. Test:
`tests/unit/commercial/test_x12_837_phi_guard.py`.
