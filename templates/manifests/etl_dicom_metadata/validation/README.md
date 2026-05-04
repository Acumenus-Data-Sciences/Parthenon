# etl_dicom_metadata — validation pack

End-to-end validation inputs and expected post-conditions for the
`etl_dicom_metadata` template.

## Fixture DICOM corpus

Run once before validation to stage 3 fixture DICOMs (CT, MR, OT) from
pydicom's bundled test data:

```bash
uv run --project templates python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py
```

Output: `templates/manifests/etl_dicom_metadata/fixtures/sample/dicom/*.dcm` —
3 small files (~5 KB each), metadata-rich, no PHI.

## How to validate

1. Bring up Parthenon CDM v5.4 with imaging extension enabled.
2. Run `load_imaging_vocabulary` first (Plan 2 Task 1–4).
3. Stage the fixture corpus (above).
4. Submit this template with `inputs/parameters.json`.
5. Wait for completion (~30 seconds for 3 DICOMs).
6. Run the staging validation runner against `expected/post_conditions.yaml`.
7. (Optional) Run `dqd_checks.yaml` for deeper checks.
