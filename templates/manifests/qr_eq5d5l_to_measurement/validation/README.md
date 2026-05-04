# qr_eq5d5l_to_measurement — validation pack

End-to-end validation inputs and expected post-conditions for the
`qr_eq5d5l_to_measurement` template.

## Fixture FHIR corpus

`fixtures/sample/QuestionnaireResponse.ndjson` ships 2 EQ-5D-5L responses for
2 synthetic patients (`Patient/p1`, `Patient/p2`) on different dates. No PHI.

## How to validate

1. Bring up Parthenon CDM v5.4.
2. Submit the template via the API or Aqueduct UI with `inputs/parameters.json`.
3. Run the staging validation runner against `expected/post_conditions.yaml`.
4. (Optional) Run `dqd_checks.yaml` for deeper integrity checks.

## EuroQol licensing reminder

The template's default `eq5d_value_set_path` points to a placeholder file with
dimensional placeholder data only. **Replace with your country-specific
EuroQol-licensed value set before any clinical analysis** — see the template
README for instructions.
