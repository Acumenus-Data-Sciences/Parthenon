# scripts/gis/ — GIS Loaders

Python ETL pipeline that loads geospatial reference data into the
`gis.*` schema of the `parthenon` PostgreSQL database. All Phase 19
loaders honor the env-driven DSN policy (GIS-04): no hardcoded
credentials, password resolved via `~/.pgpass`.

## Phase 19 — UA County Urban/Rural Stratification

### Setup

1. Copy environment template:

   ```bash
   cp scripts/gis/env.example scripts/gis/.env
   ```

2. Edit `scripts/gis/.env` to match your environment. Defaults assume
   the host PostgreSQL 17 instance (`PGHOST=localhost`,
   `PGUSER=parthenon_migrator`, `PGDATABASE=parthenon`).

3. Configure `~/.pgpass` once (file mode `600`):

   ```
   localhost:5432:parthenon:parthenon_migrator:<the-password>
   ```

4. Source the env and verify connectivity:

   ```bash
   set -a && source scripts/gis/.env && set +a
   psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "\dn gis"
   ```

   The `gis` schema must exist (Plan 02 / Wave 1). If it doesn't,
   run the Phase 19 schema migration first:

   ```bash
   docker compose exec -T php php artisan migrate \
     --path=database/migrations/2026_04_27_000001_create_gis_schema_and_tables.php
   ```

### Run order

```bash
# 1. Counties → gis.geographic_location (3,234 nationwide rows)
python scripts/gis/load_geography.py

# 2. Optional but recommended for the PA GIS demo: PA tract geometries
python scripts/gis/load_pa_tracts.py

# 3. ZIP→tract→county crosswalk + patient_geography matview rebuild
python scripts/gis/load_crosswalk.py

# 4. UA exposures → gis.external_exposure (5 metrics × N matched persons)
python scripts/gis/load_ua_county.py
```

Each loader writes one row in `app.gis_imports` (idempotent on
`(filename, import_mode='cli_loader')`) so the
`/admin/gis-import` panel can surface CLI runs alongside UI imports.

### Verification

```bash
# Counties loaded
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -tAc "
  SELECT count(*) FROM gis.geographic_location WHERE location_type='county'
"
# expected: 3234

# patient_geography per source
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "
  SELECT source_id, count(*) AS rows, count(DISTINCT person_id) AS persons
  FROM gis.patient_geography GROUP BY source_id ORDER BY source_id
"

# UA exposure rows by exposure_type (5 expected types)
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "
  SELECT exposure_type, count(*) FROM gis.external_exposure
  WHERE source_dataset LIKE 'census_ua_2020%'
  GROUP BY exposure_type ORDER BY exposure_type
"

# Synthetic sources should produce ZERO rows
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -tAc "
  SELECT count(*) FROM gis.external_exposure
  WHERE source_dataset LIKE 'census_ua_2020%'
    AND source_id IN (SELECT id FROM app.sources WHERE source_key IN ('SYNPUF','EUNOMIA'))
"
# expected: 0

# CLI loader history (panel reconciliation)
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "
  SELECT id, filename, import_mode, status, row_count,
         summary_snapshot->>'dataset_slug' AS dataset_slug
  FROM app.gis_imports WHERE import_mode = 'cli_loader'
  ORDER BY id DESC
"
```

### Idempotency

Every loader is designed to be safe to re-run:

* `load_geography.py` — `INSERT ... ON CONFLICT (geographic_code,
  location_type) DO UPDATE`. Re-running emits the same county count.
* `load_pa_tracts.py` — `INSERT ... ON CONFLICT (geographic_code,
  location_type) DO UPDATE` for Pennsylvania tract geometries.
* `load_crosswalk.py` — per-source `DELETE` then `INSERT` for
  `gis.location_geography`; matview is rebuilt via DROP+CREATE.
* `load_ua_county.py` — `INSERT ... ON CONFLICT (source_id, person_id,
  exposure_type, exposure_date) DO UPDATE` (D-05). Subsequent runs
  produce 0 net new rows; updated_at timestamps move forward.

### Data dependencies

| File | Default location | env override |
|------|------------------|--------------|
| `2020_UA_COUNTY.xlsx` | `<repo>/2020_UA_COUNTY.xlsx` | `PHASE_19_UA_XLSX_PATH` |
| `TRACT_ZIP_032020.xlsx` | `<repo>/GIS/data/crosswalk/TRACT_ZIP_032020.xlsx` | `PHASE_19_HUD_CROSSWALK` |
| `tl_2020_us_county.shp` (optional) | _unset_ | `PHASE_19_TIGER_COUNTY_SHP` |
| `tl_2020_42_tract.shp` | `<repo>/GIS/data/tiger/tl_2020_42_tract.shp` | `PHASE_19_TIGER_PA_TRACT_SHP` |

### Decisions enforced by these loaders

* **D-04** — Connection comes from env vars (`PGHOST` / `PGUSER` /
  `PGDATABASE` / `PGPORT`). Password lives only in `~/.pgpass`. No
  loader file may contain the legacy hardcoded credentials; the regression
  guard in `tests/test_dsn_no_legacy_credentials.py` enforces this on every
  build.
* **D-05** — UPSERT on `(source_id, person_id, exposure_type,
  exposure_date)` for `gis.external_exposure`.
* **D-06** — Only the main `2020_UA_COUNTY` sheet is read; the
  `CT_2022` planning-region sheet is skipped.
* **D-07** — Real-geography source allow-list:
  `["omop", "pancreas", "irsf"]`. Synthetic-zip CDMs (`synpuf`,
  `eunomia`) are excluded from the per-source loop.
* **D-08** — Pancreas exposure rows tag
  `source_dataset='census_ua_2020:pancreas:limited_geography'` so the
  Studies UI can warn researchers about the 4-zip Philadelphia care-site
  spread.

## Legacy loaders (pre-Phase 19, grandfathered)

The following files are still on the legacy hardcoded-DSN path and will
be migrated to `loader_common.get_dsn()` in Plan 19-05:

* `load_rucc.py`
* `load_svi.py`
* `load_air_quality.py`
* `load_hospitals.py`
* `load_real_data.py`
* `load_all.py`
* `fetch_data.py`

Until then they target the deprecated `ohdsi` database under user
`smudoshi` and will fail against the live `parthenon` database.

## Tests

```bash
# Filtered Phase 19 + DSN regression guard
python -m pytest scripts/gis/tests/ -k 'phase19 or ua_county' -v

# Full pytest suite
python -m pytest scripts/gis/tests/ -v
```
