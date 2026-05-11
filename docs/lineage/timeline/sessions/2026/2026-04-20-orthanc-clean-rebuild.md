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

## Performance follow-up

After cutover, OHIF loaded images but first-view performance was poor. The issue was cold DICOMweb metadata generation plus conservative Orthanc defaults:

- DICOMweb WADO-RS file loading was using 1 thread.
- Orthanc's explicit storage cache setting was absent from compose.
- The nginx DICOMweb proxy cache was only 2 GB.

Applied runtime tuning:

```text
ORTHANC__HTTP_THREADS_COUNT=100
ORTHANC__MAXIMUM_STORAGE_CACHE_SIZE=1024
ORTHANC__DICOM_WEB__WADO_RS_LOADER_THREADS_COUNT=8
ORTHANC__DICOM_WEB__METADATA_WORKER_THREADS_COUNT=8
ORTHANC__DICOM_WEB__ENABLE_PERFORMANCE_LOGS=true
```

The Orthanc startup log confirmed:

```text
The DICOMweb plugin will use 8 threads to load DICOM files for WADO-RS queries
```

The nginx DICOMweb cache was increased:

```text
keys_zone=dicom_cache:100m
max_size=20g
inactive=24h
```

Post-tuning cached checks for the originally failing study:

```text
direct series metadata: 200 in ~0.19s
vhost series metadata: 200 in ~0.04s, X-Cache-Status=HIT
direct WADO-RS instance: 200 in ~0.08s
vhost WADO-RS instance: 200 in ~0.12s
```

## PostgreSQL index performance cutover

The prior high-volume Orthanc devlogs showed that native/SQLite indexing becomes
the performance ceiling at large instance counts. A PG-indexed candidate was
rebuilt from the clean native store instead of enabling the existing empty PG
index in place.

Runtime tuning applied before the PG cutover:

```text
ORTHANC__HTTP_THREADS_COUNT=200
ORTHANC__MAXIMUM_STORAGE_CACHE_SIZE=2048
ORTHANC__DICOM_WEB__WADO_RS_LOADER_THREADS_COUNT=16
ORTHANC__DICOM_WEB__METADATA_WORKER_THREADS_COUNT=16
ORTHANC__CONCURRENT_JOBS=8
ORTHANC__GDCM__THROTTLING=8
ORTHANC__POSTGRESQL__INDEX_CONNECTIONS_COUNT=10
Orthanc container memory limit: 8G
```

PG-indexed sidecar candidate:

```text
Container:    parthenon-orthanc-pg-rebuild
Endpoint:     http://127.0.0.1:8045
Source:       /mnt/md0/orthanc-data-clean-native-20260420-012411
Storage:      /mnt/md0/orthanc-data-pg-indexed-20260420-143029
PG database:  orthanc_clean_index_20260420_143029
Import state: /mnt/md0/orthanc-rebuild/import-state-pg-indexed-20260420-143029.sqlite
Import log:   /mnt/md0/orthanc-rebuild/import-pg-indexed-20260420-143029.log
```

The first sidecar import attempt used a 4G container cap and was killed by the
kernel with Docker exit 137 after 11,999 instances. The failed state rows were
transient connection failures after the sidecar died; they were reset to
`pending`, the sidecar memory cap was raised to 16G, and the import resumed with
8 workers.

Final PG-indexed import:

```text
Processed: 534,463
Imported:  534,463
Duplicate: 0
Failed:    0
Rate:      249.8/sec
Final target instances: 546,462
State DB status: success=546,462
```

Post-import sidecar statistics matched production:

```json
{
  "CountInstances": 546462,
  "CountPatients": 1762,
  "CountSeries": 8077,
  "CountStudies": 2232,
  "TotalDiskSizeMB": 336651
}
```

Sidecar DICOMweb benchmark before cutover:

```text
tools/find limit 10:      0.024s
DICOMweb studies limit 10: 0.015s
target study QIDO:         0.009s
target series list:        0.047s
14 metadata endpoints:     0.112s wall, 14/14 ok
```

Production cutover:

```text
ORTHANC_DATA_PATH=/mnt/md0/orthanc-data-pg-indexed-20260420-143029
ORTHANC_POSTGRESQL_ENABLE_INDEX=true
ORTHANC_DB_DATABASE=orthanc_clean_index_20260420_143029
```

Post-cutover production verification:

```text
DatabaseBackendPlugin: /usr/share/orthanc/plugins/libOrthancPostgreSQLIndex.so
CountInstances: 546,462
CountPatients: 1,762
CountSeries: 8,077
CountStudies: 2,232
Jobs: []
```

Post-cutover benchmark:

```text
direct statistics:          0.008s
direct tools/find limit 10: 0.026s
direct studies limit 10:    0.021s
direct target QIDO:         0.013s
direct target series list:  0.163s
direct 14 metadata calls:   0.141s wall, 14/14 ok

vhost statistics:           0.053s
vhost studies limit 10:     0.040s
vhost target QIDO:          0.023s
vhost target series list:   0.029s
vhost 14 metadata calls:    0.086s wall, 14/14 ok
```

Keep `/mnt/md0/orthanc-data-clean-native-20260420-012411` intact as the rollback
source until the PG-indexed deployment has had several days of OHIF use.

A resumable DICOMweb metadata cache prewarm is available:

```bash
python3 scripts/orthanc-prewarm-dicomweb-cache.py \
  --target http://127.0.0.1:8042 \
  --auth-header "$ORTHANC_AUTH_HEADER" \
  --state /mnt/md0/orthanc-rebuild/dicomweb-cache-prewarm-20260420.sqlite \
  --workers 3 \
  --timeout 1200
```

Initial pilot:

```text
30/30 studies prewarmed
0 failures
average study duration ~135s
```

The full prewarm is intentionally resumable because it can run for many hours. During active user testing, keep concurrency conservative to avoid competing with interactive OHIF requests.

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
