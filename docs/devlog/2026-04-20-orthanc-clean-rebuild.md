# Orthanc Clean Native Rebuild

## Why this was needed

The production Orthanc index was pointing at attachment UUID paths that were not present in the active storage tree. This surfaced in OHIF/DICOMweb as `500 Internal Server Error` responses with:

```text
The specified path does not point to a regular file
```

Hardlink repair restored many missing attachment paths, but a full scan still showed a large number of indexed instance attachments without backing DICOM files in the local storage trees. The reliable recovery path is a clean Orthanc index rebuilt from the DICOM bytes that actually exist locally.

## Clean candidate

- Container: `parthenon-orthanc-clean-rebuild`
- Local test URL: `http://127.0.0.1:8044`
- Storage path: `/mnt/md0/orthanc-data-clean-native-20260420-012411`
- Import state: `/mnt/md0/orthanc-rebuild/import-state-20260420-012411.sqlite`
- Sources:
  - `/mnt/md0/orthanc-data-pg`
  - `/mnt/md0/orthanc-data`

The final native import preserved source transfer syntaxes. This avoided the storage expansion caused by Orthanc ingest transcoding.

## Final import counts

```text
Processed: 1,027,171
Imported:  546,462
Duplicate: 480,709
Failed:    0
```

Orthanc statistics on the clean candidate:

```json
{
  "CountInstances": 546462,
  "CountPatients": 1762,
  "CountSeries": 8077,
  "CountStudies": 2232,
  "TotalDiskSizeMB": 336495
}
```

Disk use:

```text
331G  /mnt/md0/orthanc-data-clean-native-20260420-012411
```

## Verification

The originally failing study UID was:

```text
1.2.392.200036.9116.2.5.1.48.1215544567.1380842106.994669
```

Clean candidate verification:

```text
target_study_qido=1
target_series=14
metadata_ok=14
metadata_fail=0
```

Additional DICOMweb smoke checks sampled six studies and fetched one series metadata payload from each. All six returned `200`.

First uncached metadata generation can take tens of seconds for large series. A repeated cached call returned in under one second.

## Production cutover

Production was switched to this candidate on 2026-04-20.

The compose mount now reads `ORTHANC_DATA_PATH` from `.env`; on this host it is set to:

```text
/mnt/md0/orthanc-data-clean-native-20260420-012411
```

Post-cutover production stats:

```json
{
  "CountInstances": 546462,
  "CountPatients": 1762,
  "CountSeries": 8077,
  "CountStudies": 2232,
  "TotalDiskSizeMB": 336525
}
```

Post-cutover verification:

```text
direct_prod_qido=1
direct_prod_series=14
direct_metadata_ok=14
direct_metadata_fail=0
vhost_metadata_ok=14
vhost_metadata_fail=0
```

No new `The specified path does not point to a regular file` errors were present in the Orthanc logs after the verification pass.

Rollback path:

1. Capture current production stats and a timestamped note.
2. Stop only the production Orthanc container.
3. Point `ORTHANC_DATA_PATH` back at `/mnt/md0/orthanc-data-pg`.
4. Start Orthanc.
5. Verify:
   - `/system`
   - `/statistics`
   - `/dicom-web/studies?limit=10`
   - the originally failing study and all 14 series metadata endpoints
6. Keep both storage directories intact until OHIF and DICOMweb have been exercised through the vhost.

Do not delete `/mnt/md0/orthanc-data-pg` or `/mnt/md0/orthanc-data` during the first cutover.
