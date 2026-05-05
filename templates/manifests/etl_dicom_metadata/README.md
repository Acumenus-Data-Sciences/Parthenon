# `etl_dicom_metadata` — Phase 1 template

Ingests DICOM metadata into the OMOP imaging extension. **Pixel data is never
copied.** Two source backends: filesystem and DICOMweb (QIDO-RS).

## What it does

1. `ingest_metadata` (DicomMetadataNode): scans the configured DICOM source
   and emits a single Parquet artifact with one row per SOPInstance and
   columns for the standard DICOM tags. **Pixel data is never read.**
2. `project_to_imaging_extension` (PythonNode): reads the Parquet artifact
   and inserts one row per study/series into `omop.image_occurrence`,
   resolving modality codes via the `Parthenon-Imaging` vocabulary loaded
   by `load_imaging_vocabulary`.
3. `emit_summary` (SqlNode with `result_artifact`): writes a one-row
   `dicom_etl_summary.json` artifact showing the post-load
   `image_occurrence` count.

## When to use it

Run after `load_imaging_vocabulary` (which seeds the `Parthenon-Imaging`
concept rows). Submit once per DICOM source you want to onboard, OR re-submit
incrementally as new studies arrive (the template appends; no DELETE).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | yes | — | `filesystem` or `dicomweb`. |
| `dicom_dir` | string | when `source=filesystem` | — | Directory of `*.dcm` files (recursive). |
| `dicomweb_base_url` | string | when `source=dicomweb` | — | DICOMweb base URL. |
| `dicomweb_token` | string (secret) | when `source=dicomweb` | — | Bearer token. **Redacted by the Materializer** in run logs. |
| `target_schema` | string | yes | — | OMOP CDM target schema. |
| `vocab_schema` | string | no | `vocab` | OMOP vocabulary schema. |

## Prerequisites

- Parthenon CDM v5.4 with imaging extension tables (`image_occurrence`,
  `image_feature` etc.) initialized.
- `load_imaging_vocabulary` previously run; rows present in
  `vocab.concept` for `vocabulary_id = 'Parthenon-Imaging'`.
- Network access to the DICOM source (filesystem mount or DICOMweb endpoint).

## Examples

Filesystem source with the fixture corpus:

```bash
# Stage fixtures once
uv run --project templates python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py

# Submit
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/etl_dicom_metadata/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/etl_dicom_metadata/runs
```

DICOMweb source (production):

```json
{
  "source": "dicomweb",
  "dicomweb_base_url": "https://pacs.example.com/dicom-web",
  "dicomweb_token": "${SECRET_DICOMWEB_TOKEN}",
  "target_schema": "omop",
  "vocab_schema": "vocab"
}
```

## Limitations

- Phase 1 ships **modality + study/series UID** projection only. Body part,
  contrast agent, and detailed series-level attributes (TR/TE for MR,
  kVp/mAs for CT) require the imaging-feature extension and are out of
  scope until Phase 2.
- DICOMweb pagination is server-defined; the node fetches the first
  response page only in Phase 1. Servers returning >1000 instances per
  query may need follow-up paginated runs.
- The template does **not** copy pixel data (by design — see Security notes).
  If you need image-feature extraction, that's a Phase 3+ template that
  would deliberately use WADO-RS under audit.
- `person_id` is left NULL for now; cross-mapping DICOM `PatientID` to
  OMOP `person_id` is the responsibility of an upstream `link_person`
  template (Phase 2).

## License / attribution

The DICOM standard is publicly available (NEMA). The OMOP imaging extension
mapping follows Nagy et al., "Breaking data silos: incorporating the DICOM
imaging standard into the OMOP CDM," JAMIA 2025 (`paulnagy/DICOM2OMOP`).

## Security notes

- **Pixel data is never copied.** Three independent enforcement points:
  - `DicomMetadataNode` filesystem backend uses
    `pydicom.dcmread(stop_before_pixels=True)`.
  - `DicomMetadataNode` DICOMweb backend issues only QIDO-RS calls;
    WADO-RS is never called.
  - The output Parquet artifact has no column matching `*pixel*`.
- `dicomweb_token` is declared `secret: true` in the manifest and redacted
  by the Materializer in run logs and the API echo.
- DICOM files often contain PHI in tags like `PatientName`, `PatientID`,
  `AccessionNumber`. The current template projects these AS-IS into the
  imaging-extension rows. **Run `fhir_anonymizer` (Plan 4) on the upstream
  source before this template if PHI handling requires it.**
