# fhir_to_omop — validation pack (PR-A scope)

End-to-end validation inputs and expected post-conditions for the
`fhir_to_omop` template's PR-A slice (Patient + Encounter + Condition +
Observation).

## Fixture corpus

`fixtures/sample/` ships 4 NDJSON files with synthetic but realistic FHIR R4
resources, all tagged `SYNTHETIC` in `meta.tag`:

- `Patient.ndjson` — 2 patients (p1, p2). p1 has US Core race + ethnicity
  extensions exercising the OID-disambiguation logic; p2 is minimal.
- `Encounter.ndjson` — 2 encounters (e1 ambulatory for p1, e2 inpatient
  for p2). Both with period.start/end.
- `Condition.ndjson` — 2 conditions (Hypertension on c1, Asthma on c2).
- `Observation.ndjson` — 4 observations: 2 vital-signs (systolic BP, body
  weight) → MEASUREMENT, 2 social-history (tobacco status) → OBSERVATION.

## How to validate

1. Bring up Parthenon CDM v5.4 with vocab loaded (Athena standards must be
   present so SNOMED/LOINC concepts resolve).
2. Submit the template via the API or Aqueduct UI with
   `inputs/parameters.json`.
3. Wait for completion (~10s for 10 resources).
4. Run the staging validation runner against `expected/post_conditions.yaml`.
5. Run `dqd_checks.yaml` for cross-resource referential integrity checks.
