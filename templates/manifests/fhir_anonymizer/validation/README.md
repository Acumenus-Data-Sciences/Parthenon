# fhir_anonymizer — validation pack

End-to-end validation inputs and expected post-conditions for the
`fhir_anonymizer` template. Fixture corpus contains **synthetic PHI** that
the anonymized output must NOT carry through.

## Fixture corpus

`fixtures/sample_with_phi/` ships 3 NDJSON files (Patient, Encounter,
Observation) with synthetic but realistic-looking PHI:

- 2 patients with synthetic names (Jane Doe, John Smith)
- Synthetic phone numbers (555-01XX), email addresses, MRN identifiers
- 2 encounters, 1 observation linked to the patients

Every resource is tagged `SYNTHETIC` in `meta.tag` so security audits can
verify by header inspection that this isn't real PHI.

## How to validate

1. Submit the template via the API or Aqueduct UI with the included
   `inputs/parameters.json`.
2. Wait for completion (~5s for 5 resources).
3. Run the staging validation runner against `expected/post_conditions.yaml`.
4. Run the PHI-leak regression test (`tests/unit/test_anonymizer_phi_leak.py`)
   to assert no source PHI string appears in the anonymized output.
