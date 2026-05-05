# `qr_eq5d5l_to_measurement` — Phase 1 template

Projects FHIR `QuestionnaireResponse` resources for EQ-5D-5L into OMOP
`MEASUREMENT` rows. Each completed QR yields:

- **5 item rows** (MO, SC, UA, PD, AD) — one per dimension, value 1–5.
- **1 VAS row** — the visual analog scale score, 0–100.
- **1 utility-index row** — derived from the 5-character profile string via
  the configured EuroQol value set.

## What it does

1. `ingest_responses` (FhirResourceNode): pulls `QuestionnaireResponse`
   resources from a FHIR source (NDJSON bulk export OR REST search). Filters
   to the configured `questionnaire_url`.
2. `project_to_measurement` (PythonNode): for each filtered QR, calls
   `runtime.instruments.pro_base.parse_questionnaire_response` and INSERTs
   one MEASUREMENT row per item answer.
3. `derive_utility_index` (PythonNode): groups item rows by
   `(person_source_value, measurement_date)`, builds the 5-character profile
   string, looks up the utility weight in the configured EuroQol value set,
   and INSERTs a derived MEASUREMENT row.
4. `emit_summary` (SqlNode + result_artifact): writes a one-row
   `eq5d5l_summary.json` artifact with `(items, vas_records, utilities)` counts.

## When to use it

Run whenever you need to ingest a batch of EQ-5D-5L responses. The template
is **not** singleton — multiple runs append to `omop.measurement` (use the
`measurement_source_value` and `measurement_date` columns to dedupe if you
re-process).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | yes | — | `ndjson` or `search` (FhirResourceNode mode). |
| `ndjson_dir` | string | when `source=ndjson` | — | Directory of QR NDJSON files. |
| `fhir_base_url` | string | when `source=search` | — | FHIR R4 server base URL. |
| `bearer_token` | string (secret) | when `source=search` | — | OAuth2 bearer token for the FHIR server. |
| `profile` | string | no | `us-core` | FHIR profile to apply (one of: `us-core`, `mcode`, `ips`, `mii`). |
| `target_schema` | string | yes | — | OMOP CDM target schema (e.g. `omop`). |
| `vocab_schema` | string | no | `vocab` | OMOP vocabulary schema. |
| `eq5d_value_set_path` | string | no | placeholder | Path to the EuroQol-licensed value-set CSV (see Limitations). |
| `questionnaire_url` | string | no | EuroQol canonical | FHIR Questionnaire URL to filter QRs by. |
| `mo_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Mobility item. |
| `sc_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Self-care item. |
| `ua_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Usual Activities item. |
| `pd_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Pain/Discomfort item. |
| `ad_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for Anxiety/Depression item. |
| `vas_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for VAS score. |
| `utility_concept_id` | integer | yes | — | OMOP `measurement_concept_id` for derived utility index. |

## Prerequisites

- Parthenon CDM v5.3 or v5.4 initialized (the imaging/oncology extensions
  are not required).
- FHIR source reachable from the templates service container.
- (For real clinical analysis only) a EuroQol-licensed EQ-5D-5L value-set CSV.

## Examples

NDJSON source (offline / batch):

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/qr_eq5d5l_to_measurement/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/qr_eq5d5l_to_measurement/runs
```

FHIR search source (online):

```json
{
  "source": "search",
  "fhir_base_url": "https://fhir.example.com",
  "bearer_token": "${SECRET_FHIR_TOKEN}",
  "profile": "us-core",
  "target_schema": "omop",
  "vocab_schema": "vocab",
  "questionnaire_url": "https://www.euroqol.org/instruments/eq-5d-5l",
  "mo_concept_id": 4231411,
  "sc_concept_id": 4231412,
  "ua_concept_id": 4231413,
  "pd_concept_id": 4231414,
  "ad_concept_id": 4231415,
  "vas_concept_id": 4231416,
  "utility_concept_id": 4231417,
  "eq5d_value_set_path": "/srv/euroqol/eq5d5l_us.csv"
}
```

## Limitations

- The shipped `eq5d_value_set_path` default is a **PLACEHOLDER**. The values
  in `eq5d5l_placeholder.csv` are dimensional placeholder data and NOT
  clinically valid. **You must replace it with your country-specific
  EuroQol-licensed value set before any clinical analysis.** See the
  Licensing section.
- `person_id` is left NULL on inserted rows (Phase 1 scope; cross-mapping to
  OMOP Person is the Phase 2 `link_person` template's job).
- The template assumes one QR per (subject, authoredDate). Multiple QRs for
  the same patient on the same day will produce duplicate rows; downstream
  cohort definitions must dedupe.
- Only EQ-5D-5L is implemented in this Plan. EQ-5D-3L scaffolding ships
  alongside (Plan 3 Task 6); other PRO instruments (PHQ-9, GAD-7, PROMIS,
  KCCQ-12) are Phase 2.

## License / attribution

The EQ-5D-5L instrument and its value sets are owned by **EuroQol Research
Foundation**. Use of EQ-5D requires registration with EuroQol:

- Visit <https://euroqol.org/eq-5d-instruments/>
- Register your study; obtain the country-specific value set CSV.
- Drop the CSV at the path you pass via `eq5d_value_set_path`.

Parthenon ships:

- The mapping logic (Apache 2.0, no EuroQol IP).
- A clearly-marked PLACEHOLDER value-set CSV (dimensional placeholder data
  only — NOT EuroQol-derived).

Parthenon does not relicense EQ-5D content.

## Security notes

- `bearer_token` (when `source=search`) is declared `secret: true`. The
  Materializer redacts it from the run's `parameters` echo so it never
  appears in run logs or the API response.
- `eq5d_value_set_path` points to a host filesystem path mounted into the
  templates container. Confirm the file is readable by the container's
  non-root `templates` user.
- The template never logs raw QR contents. The summary artifact contains
  only counts.
