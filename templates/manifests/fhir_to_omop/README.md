# `fhir_to_omop` — Phase 1 template (PR-A scope)

Ingests FHIR R4 resources and projects them into OMOP CDM clinical tables.
Phase 1 ships in three slices:

- **PR-A (this slice):** Patient → PERSON, Encounter → VISIT_OCCURRENCE,
  Condition → CONDITION_OCCURRENCE, Observation → MEASUREMENT/OBSERVATION.
- **PR-B (Plan 6):** Procedure, MedicationRequest, MedicationStatement,
  MedicationAdministration, Immunization → DRUG_EXPOSURE / PROCEDURE_OCCURRENCE.
- **PR-C (Plan 7):** DiagnosticReport, Consent + Phase 1 closeout.

## What it does

Seven-stage pipeline:

1. `ingest_fhir` (FhirResourceNode) — pulls Patient/Encounter/Condition/
   Observation from a FHIR source (NDJSON bulk export OR REST search) under
   the configured profile.
2. `map_patients` — `runtime.fhir_to_omop.patient.map_patient` projects each
   FHIR Patient to a `PersonRow` (gender/race/ethnicity via the OMOP vocab).
3. `map_encounters` — `runtime.fhir_to_omop.encounter.map_encounter`
   projects each Encounter to a `VisitRow` using the IG snapshot's
   encounter-class → visit-concept table.
4. `map_conditions` — `runtime.fhir_to_omop.condition.map_condition`
   resolves the first valid coding to `condition_concept_id`.
5. `map_observations` — splits to `MeasurementRow` (vital-signs/labs/imaging/exam)
   or `ObservationRow` (everything else) per the IG snapshot's category list.
6. `load_to_cdm` — INSERTs PERSON rows assigning `person_id` sequentially,
   then VISIT_OCCURRENCE resolving `person_id` from a staging map, then
   CONDITION/MEASUREMENT/OBSERVATION resolving both `person_id` and
   `visit_occurrence_id`. Unmapped concepts fall back to 0 (the
   `unmapped_concepts_queue` writer is invoked here in PR-B; PR-A logs and
   continues).
7. `summarize` — emits `fhir_to_omop_summary.json` with per-table counts.

## When to use it

Run **after** `fhir_anonymizer` (Plan 4) if your source data contains PHI
you don't want to land in the CDM. Run **before** any analytics/cohort
templates that depend on PERSON/VISIT_OCCURRENCE/etc.

The IG version is pinned to `v0.1.0-parthenon` in the shipped IG snapshot
(`runtime/fhir_to_omop/ig/v0.1.0-parthenon.json`). Bumps require an ADR
amendment (see ADR 0008).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | yes | — | `ndjson` or `search` (FhirResourceNode mode). |
| `ndjson_dir` | string | when `source=ndjson` | — | Directory of FHIR NDJSON files. |
| `fhir_base_url` | string | when `source=search` | — | FHIR R4 server base URL. |
| `bearer_token` | string (secret) | when `source=search` | — | OAuth2 bearer token. |
| `profile` | string | no | `us-core` | One of `us-core`, `mcode`, `ips`, `mii`. |
| `strict_profile_match` | boolean | no | `false` | Per spec Q3: fail loudly when a resource declares a `meta.profile` URL not in the run's profile pack. |
| `target_schema` | string | yes | — | OMOP CDM target schema (e.g. `omop`). |
| `vocab_schema` | string | no | `vocab` | OMOP vocabulary schema. |
| `app_schema` | string | no | `app` | App schema (for `unmapped_concepts_queue`). |
| `strict_concept_resolution` | boolean | no | `false` | Raise `UnmappedConceptError` instead of returning 0 for unmapped codes. |

## Prerequisites

- Parthenon CDM v5.3 or v5.4 with `omop` schema initialized
  (PERSON/VISIT_OCCURRENCE/CONDITION_OCCURRENCE/MEASUREMENT/OBSERVATION tables).
- Vocabulary loaded (Athena standards). SNOMED, LOINC, RxNorm, ICD-10-CM
  concepts must be present for the resolver to find them.
- FHIR source reachable from the templates container.

## Examples

NDJSON source (offline / batch):

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/fhir_to_omop/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/fhir_to_omop/runs
```

FHIR search source (online):

```json
{
  "source": "search",
  "fhir_base_url": "https://fhir.example.com",
  "bearer_token": "${SECRET_FHIR_TOKEN}",
  "profile": "us-core",
  "target_schema": "omop"
}
```

Composing with `fhir_anonymizer` (Plan 4):

1. Run `fhir_anonymizer` with `input_path = /srv/fhir/raw`; output lands in
   run storage.
2. Run `fhir_to_omop` with
   `ndjson_dir = <fhir_anonymizer_run_storage>/anonymize/anonymized`.

## Limitations

- **PR-A scope only.** Procedure / MedicationRequest / MedicationStatement /
  MedicationAdministration / Immunization are NOT yet mapped — they land in
  PR-B (Plan 6). DiagnosticReport / Consent land in PR-C (Plan 7).
- `person_id` and `visit_occurrence_id` are resolved via in-memory staging
  maps; on very large fixtures (>10M Patients) this approach is memory-bound.
  Plan 7 will benchmark and decide whether to swap in a temp-table join.
- The `load_to_cdm` step uses naive per-row INSERTs. Performance benchmarking
  (1M Observations < 10 minutes) is deferred to Plan 7's PR-C.
- Unmapped concepts (system not in IG snapshot OR code not in vocab) fall
  back to `concept_id = 0`. PR-B will additionally write rows to
  `app.unmapped_concepts_queue` for human review.
- Multiple codings on a single Condition/Observation are tried in order; the
  first that resolves wins. No ranking by vocabulary preference yet.

## License / attribution

- HL7 FHIR R4 spec is open (FHIR® trademark of HL7).
- OMOP CDM v5.4 is open (Apache 2.0, OHDSI).
- Concept resolution requires customer-loaded Athena vocabulary; Parthenon
  doesn't redistribute SNOMED/LOINC/etc.

## Security notes

- `bearer_token` is declared `secret: true`; the Materializer redacts it
  from run logs and the API echo.
- The mapper modules (Patient/Encounter/Condition/Observation) are pure
  Python — no shell, no eval, no template-string interpolation of FHIR
  values into SQL. SQL parameters are bound; FHIR `id` strings can't reach
  the SQL executor as code.
- The `strict_profile_match` flag enables Q3 fail-loud behavior: a resource
  declaring `meta.profile` outside the run's profile pack causes the run to
  FAIL rather than silently coercing across IGs.
- Unmapped concepts are surfaced via `unmapped_concepts_queue` (Plan 6+)
  rather than silently mapping to a sentinel — keeps clinical analyses
  honest about coverage gaps.
