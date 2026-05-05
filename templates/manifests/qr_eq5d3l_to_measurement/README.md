# `qr_eq5d3l_to_measurement` — Phase 1 SCAFFOLD

> **This template is a scaffold.** It exists to prove that the
> `runtime.instruments.pro_base` module is reusable across PRO instruments
> (acceptance criterion for Phase 1 T-011). It ingests EQ-5D-3L
> QuestionnaireResponses and projects items + VAS into `omop.measurement`,
> but it does NOT yet derive a utility index. Utility derivation is deferred
> to Phase 2 once the EQ-5D-3L EuroQol value-set licensing posture is
> confirmed alongside the EQ-5D-5L flow.

## What it does

1. Pulls `QuestionnaireResponse` resources via `FhirResourceNode`.
2. Filters to the configured `questionnaire_url` (default: EuroQol
   EQ-5D-3L canonical).
3. Calls `runtime.instruments.pro_base.parse_questionnaire_response` to yield
   one row per item answer + one VAS row per QR. **Same shared logic as
   `qr_eq5d5l_to_measurement`** — the reuse is the proof point.
4. INSERTs each row into `omop.measurement`.
5. Emits a `eq5d3l_summary.json` artifact.

## When to use it

For now: **don't run this template in production.** Use it as a reference for
how to build a new PRO instrument template by wiring `pro_base` to a different
`questionnaire_url` + concept_id mapping.

For full EQ-5D-5L functionality (with utility-index derivation), see
[`qr_eq5d5l_to_measurement`](../qr_eq5d5l_to_measurement/README.md).

## Parameters

Identical to `qr_eq5d5l_to_measurement` (see that template's README) except:

- `eq5d_value_set_path` defaults to `eq5d3l_placeholder.csv` (also a placeholder).
- `questionnaire_url` defaults to the EQ-5D-3L canonical URL.
- `utility_concept_id` is accepted but unused (utility derivation is not
  implemented in the scaffold).

## Prerequisites

Same as EQ-5D-5L — see that template's README.

## Examples

The scaffold accepts the same input shape as EQ-5D-5L; reuse that template's
example with `qr_eq5d3l_to_measurement` substituted as the `template_id`.

## Limitations

- **No utility-index derivation.** Phase 2 work.
- **No CI E2E test.** The EQ-5D-5L test in CI exercises the shared `pro_base`
  module path; the scaffold is not separately gated.
- **Placeholder value-set table.** Same EuroQol licensing reminder as the
  EQ-5D-5L flow — Parthenon ships a placeholder, customer obtains the real
  value set.

## License / attribution

EQ-5D-3L is owned by EuroQol Research Foundation. See
`qr_eq5d5l_to_measurement/README.md` for the licensing posture (identical
for the 3L variant).

## Security notes

Same as EQ-5D-5L. The scaffold imports the same `pro_base` module and the
same `eq5d` value-set helper; no new attack surface.
