# GIS Dataset Migration Guard

## 2026-04-27

- Added a table-existence guard to `2026_04_27_000002_seed_gis_dataset_ua_county.php` so the dataset registration migration exits cleanly when the GIS schema has not been created yet.
- The guard applies to both `up()` and `down()` and keeps migration rollback/replay behavior deterministic across partial GIS deployments.
