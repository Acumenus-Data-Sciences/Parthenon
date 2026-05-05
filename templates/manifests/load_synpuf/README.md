# load_synpuf

Loads CMS SynPUF (Synthetic Public Use Files) into an OMOP CDM target schema.

## What it does

Bootstraps an empty OMOP CDM in the target schema, downloads the
OHDSI-hosted CDM-shaped SynPUF CSV bundle (1K or 100K patient slice),
and loads the 7 core tables — PERSON, OBSERVATION_PERIOD,
VISIT_OCCURRENCE, CONDITION_OCCURRENCE, DRUG_EXPOSURE,
PROCEDURE_OCCURRENCE, MEASUREMENT — in dependency order via PostgreSQL
`COPY FROM STDIN`. Emits `achilles_summary.json` as the final artifact
with table row counts and the observation-period date range.

## When to use it

- After `load_athena_vocabulary` to stand up a populated demo CDM.
- Sales engineering: a working OMOP environment in <20 min for SE demos.
- Smoke testing OHDSI tooling against a known dataset.
- Training data for new analysts learning OMOP CDM.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `target_schema` | string | `synpuf` | OMOP schema name. Created if absent. Must match `^[a-z][a-z0-9_]*$`. |
| `patient_count` | enum | `1k` | One of `1k` (~1116 patients, ~15 min) or `100k` (~111K patients, ~3 hours). |
| `cdm_version` | enum | `5.4` | OMOP CDM version to bootstrap in the target schema. One of `5.3` or `5.4`. |
| `force` | boolean | `false` | If true, truncates the 7 target tables before re-loading. Required for re-runs. |
| `vocab_schema` | string | `vocab` | Schema containing the loaded Athena vocabulary tables. |
| `synpuf_base_url` | string | `https://ftp.ohdsi.org/synpuf` | Base URL for the OHDSI-hosted SynPUF CSV bundle. Override only for an HTTPS mirror or air-gapped staging. Scheme must be `http` or `https`. |

## Prerequisites

- **Vocabulary loaded:** the `load_athena_vocabulary` template must have
  completed successfully and populated SNOMED, RxNorm, LOINC at minimum.
  Declared in `requires.vocabularies`.
- **Network access:** the `parthenon-templates` runtime container needs
  outbound HTTPS to `ftp.ohdsi.org` (or to your configured mirror).
- **Disk:** ~200 MB for 1K, ~20 GB for 100K under the templates storage
  volume — the downloaded CSVs plus the loaded tables.
- **Postgres role:** uses `parthenon_migrator` for the `bootstrap_cdm`
  step (`CREATE TABLE`/`CREATE SCHEMA`) and the `precheck` truncate.
  Runtime row inserts use the same role since `COPY FROM STDIN` runs in
  a single transaction with the truncate.

## Examples

### 1K demo load

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf_demo",
      "patient_count": "1k",
      "cdm_version": "5.4",
      "force": false,
      "vocab_schema": "vocab"
    }
  }'
```

### 100K full slice (production validation)

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf_100k",
      "patient_count": "100k",
      "cdm_version": "5.4",
      "force": false,
      "vocab_schema": "vocab"
    }
  }'
```

### Re-load same slice (overwrites)

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf_demo",
      "patient_count": "1k",
      "cdm_version": "5.4",
      "force": true,
      "vocab_schema": "vocab"
    }
  }'
```

### Air-gapped staging (HTTPS mirror)

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_synpuf/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "target_schema": "synpuf_demo",
      "patient_count": "1k",
      "cdm_version": "5.4",
      "force": false,
      "vocab_schema": "vocab",
      "synpuf_base_url": "https://internal-mirror.example.org/ohdsi/synpuf"
    }
  }'
```

## Limitations

- **SynPUF is synthetic.** Patterns approximate real Medicare claims
  data but should never be used for clinical decision-making — only for
  tooling validation, demos, and analyst training.
- **No DEATH table:** SynPUF does not provide DEATH data; the OMOP
  DEATH table will be empty after this load.
- **Limited table coverage:** SynPUF only includes the 7 tables loaded
  by this template. NOTE, NOTE_NLP, OBSERVATION, DEVICE_EXPOSURE,
  SPECIMEN, FACT_RELATIONSHIP, and others remain empty.
- **Re-load truncates:** `force=true` runs `TRUNCATE` on every target
  table inside one transaction. Don't run during business hours.
- **Not in CI:** validation runs are user-initiated in staging only per
  devplan §8.
- **No incremental loads:** the loader is full-replace only. Plan 1 of
  Phase 1 (FHIR/DICOM/SDTM) introduces an incremental ingestion model;
  SynPUF is small enough that full reload is acceptable.

## License / attribution

- CMS SynPUF is published by the Centers for Medicare and Medicaid
  Services as public-domain data:
  <https://www.cms.gov/research-statistics-data-and-systems/downloadable-public-use-files/synpufs>
- The CDM-shaped version was prepared by Christophe Lambert and the
  OHDSI ETL-CMS contributors: <https://github.com/OHDSI/ETL-CMS>
- No license restrictions on redistribution. Parthenon may bundle small
  fixtures from this dataset for testing.

## Security notes

- No PHI in SynPUF — patients are synthetic. Standard ingestion
  permission (`ingestion.run`) is sufficient.
- `synpuf_base_url` is restricted to `http` and `https` schemes inside
  the download node before any network call. `file://`, `ftp://`, and
  other schemes are rejected with a `RuntimeError` at runtime.
- The download node uses `httpx.stream(...)` with `follow_redirects=True`
  and a 10-minute timeout. Rate the size of the slice against your
  egress budget before running 100K in a non-staging environment.
- No parameter is named `*_key`/`*_token`/`*_password`/`*_secret`, so
  the `lint-secret-keys` linter has nothing to enforce here. Adding a
  future authenticated-mirror parameter MUST go through a `secret: true`
  field and be sourced from the platform secrets manager.
