# GIS Explorer v3 — Use Case Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 GIS use cases (SVI, Urban-Rural, Comorbidity, Air Quality, Hospital Access) as composable analysis layers in Parthenon's GIS Explorer, using PA COVID-19 patient data.

**Architecture:** Layered dashboard with left layer panel, center map (deck.gl), right context panel, and collapsible bottom analysis drawer (Recharts). Each use case is a self-contained layer module (React component + TanStack Query hook + Laravel service + Python analytics). Data flows from external CSVs through Python ETL scripts into a `gis` schema on local PG 17, queried via a new Laravel `gis` database connection, with spatial statistics delegated to Python FastAPI.

**Tech Stack:** Laravel 11 (PHP 8.4), React 19, TypeScript, deck.gl, Recharts, Python FastAPI, PySAL, PostGIS, PostgreSQL 17

**Spec:** `docs/superpowers/specs/2026-03-12-gis-explorer-v3-use-cases-design.md`

---

## File Map

### New Files — Backend

| File | Responsibility |
|------|---------------|
| `backend/config/database.php` (modify) | Add `gis` connection |
| `backend/.env` (modify) | Add `GIS_DB_*` env vars |
| `backend/app/Http/Controllers/Api/V1/GisSviController.php` | SVI choropleth, quartile analysis, theme correlations |
| `backend/app/Http/Controllers/Api/V1/GisRuccController.php` | RUCC choropleth, outcome comparison |
| `backend/app/Http/Controllers/Api/V1/GisComorbidityController.php` | Comorbidity choropleth, hotspots, burden |
| `backend/app/Http/Controllers/Api/V1/GisAirQualityController.php` | Air quality choropleth, respiratory outcomes |
| `backend/app/Http/Controllers/Api/V1/GisHospitalController.php` | Hospital map data, access analysis, deserts |
| `backend/app/Http/Controllers/Api/V1/GisGeographyController.php` | Counties, tracts, layers list |
| `backend/app/Http/Controllers/Api/V1/GisEtlController.php` | Admin ETL triggers |
| `backend/app/Services/GIS/GeographyService.php` | Shared county/tract lookups, crosswalk queries |
| `backend/app/Services/GIS/SviAnalysisService.php` | SVI-specific queries |
| `backend/app/Services/GIS/RuccAnalysisService.php` | RUCC-specific queries |
| `backend/app/Services/GIS/ComorbidityAnalysisService.php` | Comorbidity prevalence, burden scoring |
| `backend/app/Services/GIS/AirQualityAnalysisService.php` | Air quality + respiratory outcome queries |
| `backend/app/Services/GIS/HospitalAccessService.php` | Hospital distance, desert identification |
| `backend/app/Services/GIS/GisCovidCohortService.php` | COVID outcome CTE builder (4 cohorts) |
| `backend/app/Services/GIS/SpatialStatsProxy.php` | HTTP client to Python spatial analytics |
| `backend/routes/api.php` (modify) | Add GIS use-case routes |

### New Files — ETL Scripts

| File | Responsibility |
|------|---------------|
| `scripts/gis/fetch_data.py` | Download external datasets to `GIS/data/` |
| `scripts/gis/load_geography.py` | Load PA tract/county shapefiles → `gis.geographic_location` |
| `scripts/gis/load_crosswalk.py` | Load HUD ZIP-Tract crosswalk → `gis.location_geography` |
| `scripts/gis/load_svi.py` | Load CDC SVI → `gis.external_exposure` |
| `scripts/gis/load_rucc.py` | Load USDA RUCC → `gis.external_exposure` |
| `scripts/gis/load_air_quality.py` | Load EPA AQS → `gis.external_exposure` |
| `scripts/gis/load_hospitals.py` | Load CMS hospitals → `gis.gis_hospital` + distances |
| `scripts/gis/load_all.py` | Orchestrator: runs all steps with validation |
| `scripts/gis/create_schema.sql` | Schema DDL (tables, indexes, materialized views) |
| `scripts/gis/requirements.txt` | Python dependencies for ETL |

### New Files — Python AI Service

| File | Responsibility |
|------|---------------|
| `ai/app/routers/gis_analytics.py` | Spatial statistics endpoints (Moran's I, hotspots, regression, correlation) |
| `ai/app/services/spatial_stats.py` | PySAL wrapper functions (lazy-loaded) |

### New Files — Frontend

| File | Responsibility |
|------|---------------|
| `frontend/src/features/gis/layers/types.ts` | `GisLayer` interface, shared layer types |
| `frontend/src/features/gis/layers/registry.ts` | Layer registry, exports all layers |
| `frontend/src/features/gis/stores/layerStore.ts` | Zustand store for active layers |
| `frontend/src/features/gis/components/LayerPanel.tsx` | Left panel: disease selector + layer toggles + controls |
| `frontend/src/features/gis/components/AnalysisDrawer.tsx` | Bottom collapsible drawer with Recharts panels |
| `frontend/src/features/gis/components/ContextPanel.tsx` | Right panel: county detail + layer details |
| `frontend/src/features/gis/components/ComposeLegend.tsx` | Composite legend for multiple active layers |
| `frontend/src/features/gis/layers/svi/index.ts` | SVI layer definition |
| `frontend/src/features/gis/layers/svi/SviMapOverlay.tsx` | SVI choropleth deck.gl sublayer |
| `frontend/src/features/gis/layers/svi/SviAnalysisPanel.tsx` | Quartile bars, scatter, heatmap |
| `frontend/src/features/gis/layers/svi/SviDetailPanel.tsx` | Theme breakdown for selected county |
| `frontend/src/features/gis/layers/svi/useSviData.ts` | TanStack Query hooks |
| `frontend/src/features/gis/layers/svi/api.ts` | API client functions |
| `frontend/src/features/gis/layers/rucc/index.ts` | RUCC layer definition |
| `frontend/src/features/gis/layers/rucc/RuccMapOverlay.tsx` | 3-category county fill |
| `frontend/src/features/gis/layers/rucc/RuccAnalysisPanel.tsx` | Outcome bars, RUCC detail |
| `frontend/src/features/gis/layers/rucc/RuccDetailPanel.tsx` | RUCC category for selected county |
| `frontend/src/features/gis/layers/rucc/useRuccData.ts` | TanStack Query hooks |
| `frontend/src/features/gis/layers/rucc/api.ts` | API client functions |
| `frontend/src/features/gis/layers/comorbidity/index.ts` | Comorbidity layer definition |
| `frontend/src/features/gis/layers/comorbidity/ComorbidityMapOverlay.tsx` | Hotspot heat layer |
| `frontend/src/features/gis/layers/comorbidity/ComorbidityAnalysisPanel.tsx` | Burden histogram, radar |
| `frontend/src/features/gis/layers/comorbidity/ComorbidityDetailPanel.tsx` | Condition prevalence for county |
| `frontend/src/features/gis/layers/comorbidity/useComorbidityData.ts` | TanStack Query hooks |
| `frontend/src/features/gis/layers/comorbidity/api.ts` | API client functions |
| `frontend/src/features/gis/layers/air-quality/index.ts` | Air quality layer definition |
| `frontend/src/features/gis/layers/air-quality/AirQualityMapOverlay.tsx` | Bi-variate choropleth |
| `frontend/src/features/gis/layers/air-quality/AirQualityAnalysisPanel.tsx` | PM2.5 scatter, stratification |
| `frontend/src/features/gis/layers/air-quality/AirQualityDetailPanel.tsx` | Pollutant levels for county |
| `frontend/src/features/gis/layers/air-quality/useAirQualityData.ts` | TanStack Query hooks |
| `frontend/src/features/gis/layers/air-quality/api.ts` | API client functions |
| `frontend/src/features/gis/layers/hospital-access/index.ts` | Hospital access layer definition |
| `frontend/src/features/gis/layers/hospital-access/HospitalMapOverlay.tsx` | Hospital points + distance rings |
| `frontend/src/features/gis/layers/hospital-access/HospitalAnalysisPanel.tsx` | Distance bars, desert overlay |
| `frontend/src/features/gis/layers/hospital-access/HospitalDetailPanel.tsx` | Nearest hospital for county |
| `frontend/src/features/gis/layers/hospital-access/useHospitalData.ts` | TanStack Query hooks |
| `frontend/src/features/gis/layers/hospital-access/api.ts` | API client functions |
| `frontend/src/features/gis/pages/GisPage.tsx` (modify) | Refactor to 3-panel layered dashboard |

---

## Chunk 1: Database Infrastructure & ETL Pipeline

### Task 1: Create GIS Schema DDL

**Files:**
- Create: `scripts/gis/create_schema.sql`

- [ ] **Step 1: Write the schema DDL**

Create `scripts/gis/create_schema.sql` with all table definitions, indexes, and materialized view:

```sql
-- GIS Explorer v3 Schema
-- Run against local PG 17 (ohdsi database) as superuser

-- Step 0: Verify PostGIS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE EXTENSION postgis;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS gis;

-- geographic_location: census tracts, counties, ZIPs with PostGIS geometry
CREATE TABLE IF NOT EXISTS gis.geographic_location (
  geographic_location_id BIGSERIAL PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('census_tract', 'county', 'zip', 'zcta')),
  geographic_code VARCHAR(15) NOT NULL,
  state_fips CHAR(2) NOT NULL DEFAULT '42',
  county_fips CHAR(5),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  geometry GEOGRAPHY(MULTIPOLYGON, 4326),
  population INTEGER,
  area_sq_km NUMERIC(12,4),
  parent_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
  UNIQUE(geographic_code, location_type)
);

CREATE INDEX IF NOT EXISTS idx_geo_loc_geom ON gis.geographic_location USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_geo_loc_county ON gis.geographic_location(county_fips);
CREATE INDEX IF NOT EXISTS idx_geo_loc_type ON gis.geographic_location(location_type);

-- external_exposure: person-level geographic/environmental exposures
CREATE TABLE IF NOT EXISTS gis.external_exposure (
  external_exposure_id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  exposure_type VARCHAR(30) NOT NULL,
  exposure_date DATE NOT NULL,
  value_as_number NUMERIC,
  value_as_string VARCHAR(100),
  value_as_integer INTEGER,
  unit VARCHAR(30),
  geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
  source_dataset VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_ext_exp_person_type ON gis.external_exposure(person_id, exposure_type);
CREATE INDEX IF NOT EXISTS idx_ext_exp_geo ON gis.external_exposure(geographic_location_id);
CREATE INDEX IF NOT EXISTS idx_ext_exp_type_val ON gis.external_exposure(exposure_type, value_as_number);

-- location_geography: ZIP-to-tract/county crosswalk
CREATE TABLE IF NOT EXISTS gis.location_geography (
  id BIGSERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  zip_code VARCHAR(5),
  tract_fips VARCHAR(11),
  county_fips VARCHAR(5),
  tract_allocation_ratio NUMERIC(6,4),
  tract_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
  county_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id)
);

CREATE INDEX IF NOT EXISTS idx_loc_geo_location ON gis.location_geography(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_geo_zip ON gis.location_geography(zip_code);
CREATE INDEX IF NOT EXISTS idx_loc_geo_tract ON gis.location_geography(tract_fips);
CREATE INDEX IF NOT EXISTS idx_loc_geo_county ON gis.location_geography(county_fips);

-- gis_hospital: PA hospitals with PostGIS point geometry
CREATE TABLE IF NOT EXISTS gis.gis_hospital (
  hospital_id SERIAL PRIMARY KEY,
  cms_provider_id VARCHAR(10),
  hospital_name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  county_fips VARCHAR(5),
  zip_code VARCHAR(5),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  point GEOGRAPHY(POINT, 4326),
  hospital_type VARCHAR(50),
  has_emergency BOOLEAN DEFAULT false,
  bed_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hospital_point ON gis.gis_hospital USING GIST(point);
CREATE INDEX IF NOT EXISTS idx_hospital_county ON gis.gis_hospital(county_fips);

-- geography_summary: pre-aggregated stats per geographic area per exposure type
CREATE TABLE IF NOT EXISTS gis.geography_summary (
  geographic_location_id BIGINT NOT NULL,
  exposure_type VARCHAR(30) NOT NULL,
  patient_count INTEGER,
  avg_value NUMERIC,
  median_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  PRIMARY KEY (geographic_location_id, exposure_type)
);

-- patient_geography: materialized view for fast person-to-geography joins
-- Created AFTER load_crosswalk.py populates location_geography
-- See load_all.py Step 4 for CREATE MATERIALIZED VIEW
```

- [ ] **Step 2: Run the schema DDL against local PG 17**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -f scripts/gis/create_schema.sql
```

Expected: All tables created, no errors.

- [ ] **Step 3: Verify schema**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -c "\dt gis.*"
```

Expected: 5 tables listed (geographic_location, external_exposure, location_geography, gis_hospital, geography_summary).

- [ ] **Step 4: Commit**

```bash
git add scripts/gis/create_schema.sql
git commit -m "feat(gis): add OHDSI GIS schema DDL for use case tables"
```

---

### Task 2: Add Laravel `gis` Database Connection

**Files:**
- Modify: `backend/config/database.php` (after line 149, the `results` connection)
- Modify: `backend/.env`

- [ ] **Step 1: Add `gis` connection to database.php**

Add after the `results` connection block (after the closing `],` around line 153):

```php
        // GIS schema connection — connects to local PG 17 (ohdsi database)
        // for OHDSI GIS extension tables (geographic_location, external_exposure, etc.)
        // Used by GIS use-case services. On Docker installs, set GIS_DB_* env vars.
        'gis' => [
            'driver' => 'pgsql',
            'host' => env('GIS_DB_HOST', env('CDM_DB_HOST', '127.0.0.1')),
            'port' => env('GIS_DB_PORT', env('CDM_DB_PORT', '5432')),
            'database' => env('GIS_DB_DATABASE', env('CDM_DB_DATABASE', 'ohdsi')),
            'username' => env('GIS_DB_USERNAME', env('CDM_DB_USERNAME', 'smudoshi')),
            'password' => env('GIS_DB_PASSWORD', env('CDM_DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => env('GIS_DB_SEARCH_PATH', 'gis,omop,public'),
            'sslmode' => 'prefer',
        ],
```

- [ ] **Step 2: Add GIS env vars to backend/.env**

Append to the database section:

```
# GIS Schema (local PG 17 — ohdsi database)
GIS_DB_HOST=localhost
GIS_DB_PORT=5432
GIS_DB_DATABASE=ohdsi
GIS_DB_USERNAME=smudoshi
GIS_DB_PASSWORD=acumenus
GIS_DB_SEARCH_PATH=gis,omop,public
GIS_SUPPRESSION_THRESHOLD=0
```

- [ ] **Step 3: Verify connection works**

```bash
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec php php artisan tinker --execute="DB::connection('gis')->select('SELECT current_schema(), current_database()')"
```

Expected: Returns `gis` schema, `ohdsi` database.

- [ ] **Step 4: Commit**

```bash
git add backend/config/database.php
git commit -m "feat(gis): add gis database connection for OHDSI GIS tables"
```

Note: Do NOT commit `backend/.env` (contains credentials).

---

### Task 3: ETL Requirements & Data Fetcher

**Files:**
- Create: `scripts/gis/requirements.txt`
- Create: `scripts/gis/fetch_data.py`

- [ ] **Step 1: Create requirements.txt**

```
geopandas>=0.14.0
shapely>=2.0.0
fiona>=1.9.0
psycopg2-binary>=2.9.0
requests>=2.31.0
pandas>=2.0.0
```

- [ ] **Step 2: Install requirements**

```bash
pip install -r scripts/gis/requirements.txt
```

- [ ] **Step 3: Write fetch_data.py**

Create `scripts/gis/fetch_data.py` — downloads all external datasets to `GIS/data/`:

```python
#!/usr/bin/env python3
"""Download external GIS datasets for Parthenon use cases.

Usage:
    python scripts/gis/fetch_data.py --fetch          # Download all datasets
    python scripts/gis/fetch_data.py --fetch --only svi  # Download specific dataset
    python scripts/gis/fetch_data.py --check           # Check which datasets exist locally
"""

import argparse
import os
import sys
import zipfile
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"

DATASETS = {
    "tiger_tracts": {
        "url": "https://www2.census.gov/geo/tiger/TIGER2020/TRACT/tl_2020_42_tract.zip",
        "dir": "tiger",
        "filename": "tl_2020_42_tract.zip",
        "description": "PA Census Tract Shapefiles (2020)",
    },
    "tiger_counties": {
        "url": "https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip",
        "dir": "tiger",
        "filename": "tl_2020_us_county.zip",
        "description": "US County Shapefiles (2020) — filtered to PA",
    },
    "svi": {
        "url": "https://data.cdc.gov/api/views/4d8n-kk8a/rows.csv?accessType=DOWNLOAD",
        "dir": "svi",
        "filename": "SVI_2020_US.csv",
        "description": "CDC Social Vulnerability Index (2020)",
    },
    "crosswalk": {
        "url": "https://www.huduser.gov/portal/datasets/usps/TRACT_ZIP_032020.xlsx",
        "dir": "crosswalk",
        "filename": "TRACT_ZIP_032020.xlsx",
        "description": "HUD ZIP-Tract Crosswalk (Q1 2020)",
    },
    "rucc": {
        "url": "https://www.ers.usda.gov/webdocs/DataFiles/53251/ruralurbancodes2013.csv",
        "dir": "rucc",
        "filename": "ruralurbancodes2013.csv",
        "description": "USDA Rural-Urban Continuum Codes (2013)",
    },
    "aqs": {
        "url": "https://aqs.epa.gov/aqsweb/airdata/annual_conc_by_monitor_2020.zip",
        "dir": "aqs",
        "filename": "annual_conc_by_monitor_2020.zip",
        "description": "EPA Air Quality System Annual Data (2020)",
    },
    "hospitals": {
        "url": "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?limit=5000&offset=0&format=csv",
        "dir": "hospitals",
        "filename": "Hospital_General_Information.csv",
        "description": "CMS Hospital General Information",
    },
}


def download_dataset(key: str, force: bool = False) -> bool:
    """Download a single dataset. Returns True if successful."""
    ds = DATASETS[key]
    target_dir = BASE_DIR / ds["dir"]
    target_file = target_dir / ds["filename"]

    if target_file.exists() and not force:
        print(f"  SKIP {key}: {target_file} already exists (use --force to re-download)")
        return True

    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"  DOWNLOADING {key}: {ds['description']}")
    print(f"    URL: {ds['url']}")

    try:
        resp = requests.get(ds["url"], stream=True, timeout=120)
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0

        with open(target_file, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = int(100 * downloaded / total)
                    print(f"\r    Progress: {pct}% ({downloaded // 1024}KB / {total // 1024}KB)", end="")
        print(f"\n    SAVED: {target_file} ({target_file.stat().st_size // 1024}KB)")

        # Unzip if needed
        if target_file.suffix == ".zip":
            print(f"    EXTRACTING: {target_file}")
            with zipfile.ZipFile(target_file, "r") as zf:
                zf.extractall(target_dir)
            print(f"    EXTRACTED to {target_dir}")

        return True
    except Exception as e:
        print(f"\n    ERROR: {e}")
        if target_file.exists():
            target_file.unlink()
        return False


def check_datasets():
    """Report which datasets exist locally."""
    print("Dataset Status:")
    for key, ds in DATASETS.items():
        target = BASE_DIR / ds["dir"] / ds["filename"]
        status = "FOUND" if target.exists() else "MISSING"
        size = f"({target.stat().st_size // 1024}KB)" if target.exists() else ""
        print(f"  [{status}] {key}: {ds['description']} {size}")


def main():
    parser = argparse.ArgumentParser(description="Download GIS datasets for Parthenon use cases")
    parser.add_argument("--fetch", action="store_true", help="Download datasets from source URLs")
    parser.add_argument("--check", action="store_true", help="Check which datasets exist locally")
    parser.add_argument("--only", type=str, help="Download only this dataset (comma-separated)")
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    if args.check:
        check_datasets()
        return

    if not args.fetch:
        parser.print_help()
        return

    keys = args.only.split(",") if args.only else list(DATASETS.keys())
    invalid = [k for k in keys if k not in DATASETS]
    if invalid:
        print(f"Unknown datasets: {invalid}. Valid: {list(DATASETS.keys())}")
        sys.exit(1)

    print(f"Downloading {len(keys)} datasets to {BASE_DIR}")
    results = {}
    for key in keys:
        results[key] = download_dataset(key, force=args.force)

    failed = [k for k, v in results.items() if not v]
    if failed:
        print(f"\nFailed: {failed}")
        sys.exit(1)
    print(f"\nAll {len(keys)} datasets ready.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Test the check command**

```bash
python scripts/gis/fetch_data.py --check
```

Expected: All datasets show as MISSING (unless already downloaded).

- [ ] **Step 5: Commit**

```bash
git add scripts/gis/requirements.txt scripts/gis/fetch_data.py
git commit -m "feat(gis): add ETL requirements and data fetcher script"
```

---

### Task 4: Load Geography (PA Tracts & Counties)

**Files:**
- Create: `scripts/gis/load_geography.py`

- [ ] **Step 1: Download PA shapefiles**

```bash
python scripts/gis/fetch_data.py --fetch --only tiger_tracts,tiger_counties
```

- [ ] **Step 2: Write load_geography.py**

Create `scripts/gis/load_geography.py`:

```python
#!/usr/bin/env python3
"""Load PA census tract and county shapefiles into gis.geographic_location.

Reads TIGER shapefiles from GIS/data/tiger/, inserts tract and county boundaries
with PostGIS geometry into the gis schema on local PG 17.

Usage:
    python scripts/gis/load_geography.py
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import psycopg2
from psycopg2.extras import execute_values
from shapely.geometry import mapping

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
PA_FIPS = "42"


def emit(event: str, **kwargs):
    """Emit a JSON progress event to stdout."""
    print(json.dumps({"event": event, **kwargs}), flush=True)


def load_counties(conn):
    """Load PA county boundaries from TIGER shapefile."""
    shapefile = GIS_DATA / "tiger" / "tl_2020_us_county.shp"
    if not shapefile.exists():
        emit("error", message=f"County shapefile not found: {shapefile}")
        sys.exit(1)

    emit("reading", source="counties")
    gdf = gpd.read_file(shapefile)
    pa_counties = gdf[gdf["STATEFP"] == PA_FIPS].copy()
    emit("filtered", count=len(pa_counties), state="PA")

    rows = []
    for _, row in pa_counties.iterrows():
        centroid = row.geometry.centroid
        area_km2 = row.geometry.area / 1e6 if row.geometry.area else None
        rows.append((
            row["NAMELSAD"],           # location_name
            "county",                  # location_type
            row["GEOID"],             # geographic_code (5-digit FIPS)
            PA_FIPS,                  # state_fips
            row["GEOID"],            # county_fips
            float(centroid.y),        # latitude
            float(centroid.x),        # longitude
            row.geometry.wkt,         # geometry (WKT)
            int(row.get("ALAND", 0)) // 1000000 if row.get("ALAND") else None,  # area_sq_km
        ))

    emit("inserting", table="geographic_location", count=len(rows), type="county")
    with conn.cursor() as cur:
        execute_values(
            cur,
            """INSERT INTO gis.geographic_location
               (location_name, location_type, geographic_code, state_fips, county_fips,
                latitude, longitude, geometry, area_sq_km)
               VALUES %s
               ON CONFLICT (geographic_code, location_type) DO UPDATE SET
                 location_name = EXCLUDED.location_name,
                 latitude = EXCLUDED.latitude,
                 longitude = EXCLUDED.longitude,
                 geometry = EXCLUDED.geometry,
                 area_sq_km = EXCLUDED.area_sq_km""",
            rows,
            template="(%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326)::geography, %s)",
        )
    conn.commit()
    emit("done", type="county", count=len(rows))
    return len(rows)


def load_tracts(conn):
    """Load PA census tract boundaries from TIGER shapefile."""
    shapefile = GIS_DATA / "tiger" / "tl_2020_42_tract.shp"
    if not shapefile.exists():
        emit("error", message=f"Tract shapefile not found: {shapefile}")
        sys.exit(1)

    emit("reading", source="tracts")
    gdf = gpd.read_file(shapefile)
    emit("loaded", count=len(gdf))

    # Get county IDs for parent linkage
    with conn.cursor() as cur:
        cur.execute(
            "SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'"
        )
        county_map = {row[1]: row[0] for row in cur.fetchall()}

    rows = []
    for _, row in gdf.iterrows():
        centroid = row.geometry.centroid
        county_fips = row["GEOID"][:5]
        parent_id = county_map.get(county_fips)
        rows.append((
            f"Tract {row['GEOID']}",   # location_name
            "census_tract",             # location_type
            row["GEOID"],              # geographic_code (11-digit FIPS)
            PA_FIPS,                   # state_fips
            county_fips,               # county_fips
            float(centroid.y),         # latitude
            float(centroid.x),         # longitude
            row.geometry.wkt,          # geometry (WKT)
            int(row.get("ALAND", 0)) // 1000000 if row.get("ALAND") else None,
            parent_id,                 # parent_location_id
        ))

    emit("inserting", table="geographic_location", count=len(rows), type="tract")
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        with conn.cursor() as cur:
            execute_values(
                cur,
                """INSERT INTO gis.geographic_location
                   (location_name, location_type, geographic_code, state_fips, county_fips,
                    latitude, longitude, geometry, area_sq_km, parent_location_id)
                   VALUES %s
                   ON CONFLICT (geographic_code, location_type) DO UPDATE SET
                     location_name = EXCLUDED.location_name,
                     latitude = EXCLUDED.latitude,
                     longitude = EXCLUDED.longitude,
                     geometry = EXCLUDED.geometry,
                     area_sq_km = EXCLUDED.area_sq_km,
                     parent_location_id = EXCLUDED.parent_location_id""",
                batch,
                template="(%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326)::geography, %s, %s)",
            )
        conn.commit()
        emit("batch", type="tract", loaded=min(i + batch_size, len(rows)), total=len(rows))

    emit("done", type="tract", count=len(rows))
    return len(rows)


def main():
    emit("start", script="load_geography")
    conn = psycopg2.connect(DB_DSN)
    try:
        county_count = load_counties(conn)
        tract_count = load_tracts(conn)
        emit("complete", counties=county_count, tracts=tract_count)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run geography loader**

```bash
python scripts/gis/load_geography.py
```

Expected: ~67 counties + ~3,200 tracts loaded. JSON events stream to stdout.

- [ ] **Step 4: Verify data**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -c "SELECT location_type, COUNT(*) FROM gis.geographic_location GROUP BY location_type;"
```

Expected: `county: 67`, `census_tract: ~3,200`.

- [ ] **Step 5: Commit**

```bash
git add scripts/gis/load_geography.py
git commit -m "feat(gis): add PA tract/county geography loader from TIGER shapefiles"
```

---

### Task 5: Load ZIP-Tract Crosswalk

**Files:**
- Create: `scripts/gis/load_crosswalk.py`

- [ ] **Step 1: Download HUD crosswalk**

```bash
python scripts/gis/fetch_data.py --fetch --only crosswalk
```

- [ ] **Step 2: Write load_crosswalk.py**

Create `scripts/gis/load_crosswalk.py`:

```python
#!/usr/bin/env python3
"""Load HUD ZIP-Tract crosswalk into gis.location_geography.

Maps omop.location ZIP codes to census tracts and counties using HUD
residential allocation ratios. Creates the bridge between patient locations
and geographic analysis units.

Usage:
    python scripts/gis/load_crosswalk.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
PA_FIPS = "42"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def main():
    emit("start", script="load_crosswalk")

    # Read HUD crosswalk
    xwalk_file = GIS_DATA / "crosswalk" / "TRACT_ZIP_032020.xlsx"
    if not xwalk_file.exists():
        emit("error", message=f"Crosswalk file not found: {xwalk_file}")
        sys.exit(1)

    emit("reading", source="HUD crosswalk")
    df = pd.read_excel(xwalk_file)

    # Filter to PA tracts (FIPS starts with 42)
    df["TRACT"] = df["TRACT"].astype(str).str.zfill(11)
    df["ZIP"] = df["ZIP"].astype(str).str.zfill(5)
    pa_df = df[df["TRACT"].str.startswith(PA_FIPS)].copy()
    emit("filtered", total_rows=len(df), pa_rows=len(pa_df))

    conn = psycopg2.connect(DB_DSN)

    try:
        # Get geographic_location IDs for tracts and counties
        with conn.cursor() as cur:
            cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'census_tract'")
            tract_map = {r[1]: r[0] for r in cur.fetchall()}

            cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'")
            county_map = {r[1]: r[0] for r in cur.fetchall()}

        # Get omop.location records with ZIP codes
        with conn.cursor() as cur:
            cur.execute("SELECT location_id, zip FROM omop.location WHERE zip IS NOT NULL AND zip != '00000'")
            locations = {r[1]: r[0] for r in cur.fetchall()}

        emit("locations", total=len(locations), description="omop.location records with valid ZIPs")

        # Build crosswalk rows
        rows = []
        matched_zips = set()
        for _, row in pa_df.iterrows():
            zip_code = row["ZIP"]
            tract_fips = row["TRACT"]
            county_fips = tract_fips[:5]
            ratio = float(row.get("RES_RATIO", row.get("TOT_RATIO", 1.0)))

            if zip_code not in locations:
                continue

            matched_zips.add(zip_code)
            tract_loc_id = tract_map.get(tract_fips)
            county_loc_id = county_map.get(county_fips)

            rows.append((
                locations[zip_code],  # location_id
                zip_code,
                tract_fips,
                county_fips,
                ratio,
                tract_loc_id,
                county_loc_id,
            ))

        emit("crosswalk_built", rows=len(rows), matched_zips=len(matched_zips))

        # Insert crosswalk
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.location_geography")  # Idempotent: clear and reload
            execute_values(
                cur,
                """INSERT INTO gis.location_geography
                   (location_id, zip_code, tract_fips, county_fips,
                    tract_allocation_ratio, tract_location_id, county_location_id)
                   VALUES %s""",
                rows,
            )
        conn.commit()

        # Validation report
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM omop.location")
            total_locations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM omop.location WHERE zip IS NOT NULL AND zip != '00000'")
            valid_zips = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT county_fips) FROM gis.location_geography")
            counties_covered = cur.fetchone()[0]

        emit("validation", **{
            "total_locations": total_locations,
            "valid_zips": valid_zips,
            "invalid_zips": total_locations - valid_zips,
            "zips_in_crosswalk": len(matched_zips),
            "crosswalk_rows": len(rows),
            "counties_covered": counties_covered,
            "counties_total": 67,
        })

        # Create materialized view for fast joins
        emit("creating_materialized_view", name="patient_geography")
        with conn.cursor() as cur:
            cur.execute("DROP MATERIALIZED VIEW IF EXISTS gis.patient_geography")
            cur.execute("""
                CREATE MATERIALIZED VIEW gis.patient_geography AS
                SELECT
                  p.person_id,
                  p.gender_concept_id,
                  p.year_of_birth,
                  l.location_id,
                  l.zip AS zip_code,
                  lg.tract_fips,
                  lg.county_fips,
                  lg.tract_location_id,
                  lg.county_location_id,
                  lg.tract_allocation_ratio
                FROM omop.person p
                JOIN omop.location l ON p.location_id = l.location_id
                JOIN gis.location_geography lg ON l.location_id = lg.location_id
            """)
            cur.execute("CREATE INDEX idx_pg_person ON gis.patient_geography(person_id)")
            cur.execute("CREATE INDEX idx_pg_county ON gis.patient_geography(county_fips)")
            cur.execute("CREATE INDEX idx_pg_tract ON gis.patient_geography(tract_fips)")
        conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM gis.patient_geography")
            pg_count = cur.fetchone()[0]

        emit("complete", crosswalk_rows=len(rows), patient_geography_rows=pg_count)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run crosswalk loader**

```bash
python scripts/gis/load_crosswalk.py
```

Expected: Validation report showing ~92%+ ZIP coverage, materialized view created.

- [ ] **Step 4: Verify**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -c "SELECT COUNT(*) FROM gis.location_geography; SELECT COUNT(*) FROM gis.patient_geography;"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gis/load_crosswalk.py
git commit -m "feat(gis): add ZIP-tract crosswalk loader with patient_geography materialized view"
```

---

### Task 6: Load SVI Data (Use Case 1)

**Files:**
- Create: `scripts/gis/load_svi.py`

- [ ] **Step 1: Download SVI data**

```bash
python scripts/gis/fetch_data.py --fetch --only svi
```

- [ ] **Step 2: Write load_svi.py**

Create `scripts/gis/load_svi.py`:

```python
#!/usr/bin/env python3
"""Load CDC Social Vulnerability Index data into gis.external_exposure.

Downloads CDC SVI 2020 PA data, maps to census tracts, then assigns SVI
scores to patients via the patient_geography materialized view.

Usage:
    python scripts/gis/load_svi.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
PA_FIPS = "42"

SVI_THEMES = {
    "svi_overall": "RPL_THEMES",
    "svi_theme1": "RPL_THEME1",  # Socioeconomic Status
    "svi_theme2": "RPL_THEME2",  # Household Characteristics
    "svi_theme3": "RPL_THEME3",  # Racial/Ethnic Minority Status
    "svi_theme4": "RPL_THEME4",  # Housing Type / Transportation
}

EXPOSURE_DATE = "2020-01-01"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def main():
    emit("start", script="load_svi")

    svi_file = GIS_DATA / "svi" / "SVI_2020_US.csv"
    if not svi_file.exists():
        emit("error", message=f"SVI file not found: {svi_file}")
        sys.exit(1)

    emit("reading", source="CDC SVI 2020")
    df = pd.read_csv(svi_file, dtype={"FIPS": str})

    # Filter to PA
    pa_df = df[df["ST_ABBR"] == "PA"].copy()
    emit("filtered", total=len(df), pa=len(pa_df))

    # Clean FIPS (ensure 11 digits for tracts)
    pa_df["FIPS"] = pa_df["FIPS"].str.zfill(11)

    conn = psycopg2.connect(DB_DSN)

    try:
        # Get tract → geographic_location_id mapping
        with conn.cursor() as cur:
            cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'census_tract'")
            tract_map = {r[1]: r[0] for r in cur.fetchall()}

        # Build SVI lookup: tract_fips → {theme: percentile}
        svi_lookup = {}
        for _, row in pa_df.iterrows():
            fips = row["FIPS"]
            if fips not in tract_map:
                continue
            svi_lookup[fips] = {}
            for exposure_type, col in SVI_THEMES.items():
                val = row.get(col)
                if pd.notna(val) and val >= 0:  # SVI uses -999 for missing
                    svi_lookup[fips][exposure_type] = float(val)

        emit("svi_mapped", tracts_with_svi=len(svi_lookup))

        # Get patients with tract assignments from patient_geography
        with conn.cursor() as cur:
            cur.execute("""
                SELECT person_id, tract_fips, tract_location_id, tract_allocation_ratio
                FROM gis.patient_geography
                WHERE tract_fips IS NOT NULL
            """)
            patients = cur.fetchall()

        emit("patients", count=len(patients))

        # For patients in multi-tract ZIPs, compute weighted average SVI
        # Group by person_id first
        person_tracts = {}
        for person_id, tract_fips, tract_loc_id, ratio in patients:
            if person_id not in person_tracts:
                person_tracts[person_id] = []
            person_tracts[person_id].append((tract_fips, tract_loc_id, float(ratio) if ratio else 1.0))

        # Build exposure rows
        rows = []
        for person_id, tracts in person_tracts.items():
            # Weighted average across all tract assignments
            for exposure_type in SVI_THEMES:
                weighted_sum = 0.0
                weight_total = 0.0
                geo_loc_id = None

                for tract_fips, tract_loc_id, ratio in tracts:
                    svi_data = svi_lookup.get(tract_fips, {})
                    val = svi_data.get(exposure_type)
                    if val is not None:
                        weighted_sum += val * ratio
                        weight_total += ratio
                        if geo_loc_id is None:
                            geo_loc_id = tract_loc_id  # Use first tract's location

                if weight_total > 0:
                    avg_val = weighted_sum / weight_total
                    quartile = min(4, int(avg_val * 4) + 1) if avg_val < 1.0 else 4
                    rows.append((
                        person_id,
                        exposure_type,
                        EXPOSURE_DATE,
                        round(avg_val, 4),          # value_as_number
                        None,                        # value_as_string
                        quartile,                    # value_as_integer
                        "percentile",                # unit
                        geo_loc_id,                  # geographic_location_id
                        "cdc_svi_2020",              # source_dataset
                    ))

        emit("exposure_rows", count=len(rows))

        # Clear existing SVI data and insert
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type LIKE 'svi_%'")

        # Batch insert
        batch_size = 10000
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """INSERT INTO gis.external_exposure
                       (person_id, exposure_type, exposure_date, value_as_number,
                        value_as_string, value_as_integer, unit, geographic_location_id, source_dataset)
                       VALUES %s""",
                    batch,
                )
            conn.commit()
            emit("batch", loaded=min(i + batch_size, len(rows)), total=len(rows))

        emit("complete", exposure_rows=len(rows))

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run SVI loader**

```bash
python scripts/gis/load_svi.py
```

Expected: ~5M rows inserted (1M patients × 5 SVI types).

- [ ] **Step 4: Verify**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -c "SELECT exposure_type, COUNT(*), ROUND(AVG(value_as_number)::numeric, 3) as avg_val FROM gis.external_exposure WHERE exposure_type LIKE 'svi_%' GROUP BY exposure_type ORDER BY exposure_type;"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gis/load_svi.py
git commit -m "feat(gis): add CDC SVI data loader for external_exposure table"
```

---

### Task 7: Load RUCC Data (Use Case 2)

**Files:**
- Create: `scripts/gis/load_rucc.py`

- [ ] **Step 1: Download RUCC data**

```bash
python scripts/gis/fetch_data.py --fetch --only rucc
```

- [ ] **Step 2: Write load_rucc.py**

Create `scripts/gis/load_rucc.py`:

```python
#!/usr/bin/env python3
"""Load USDA Rural-Urban Continuum Codes into gis.external_exposure.

Maps counties to RUCC classifications (1-9 scale), then assigns to patients
via patient_geography county_fips.

Usage:
    python scripts/gis/load_rucc.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
PA_FIPS = "42"

RUCC_LABELS = {
    1: "Metro - Counties in metro areas of 1 million+",
    2: "Metro - Counties in metro areas of 250,000 to 1 million",
    3: "Metro - Counties in metro areas of fewer than 250,000",
    4: "Nonmetro - Urban population of 20,000+, adjacent to metro",
    5: "Nonmetro - Urban population of 20,000+, not adjacent to metro",
    6: "Nonmetro - Urban population of 2,500 to 19,999, adjacent to metro",
    7: "Nonmetro - Urban population of 2,500 to 19,999, not adjacent to metro",
    8: "Nonmetro - Completely rural or <2,500, adjacent to metro",
    9: "Nonmetro - Completely rural or <2,500, not adjacent to metro",
}

RUCC_CATEGORIES = {
    1: "Metro", 2: "Metro", 3: "Metro",
    4: "Micropolitan", 5: "Micropolitan",
    6: "Micropolitan", 7: "Micropolitan",
    8: "Rural", 9: "Rural",
}

EXPOSURE_DATE = "2013-01-01"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def main():
    emit("start", script="load_rucc")

    rucc_file = GIS_DATA / "rucc" / "ruralurbancodes2013.csv"
    if not rucc_file.exists():
        emit("error", message=f"RUCC file not found: {rucc_file}")
        sys.exit(1)

    emit("reading", source="USDA RUCC 2013")
    df = pd.read_csv(rucc_file, dtype={"FIPS": str})

    # Filter to PA (state FIPS = 42)
    df["FIPS"] = df["FIPS"].astype(str).str.zfill(5)
    pa_df = df[df["FIPS"].str.startswith(PA_FIPS)].copy()
    emit("filtered", pa_counties=len(pa_df))

    conn = psycopg2.connect(DB_DSN)

    try:
        # Build county RUCC lookup
        with conn.cursor() as cur:
            cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'")
            county_loc_map = {r[1]: r[0] for r in cur.fetchall()}

        rucc_lookup = {}
        for _, row in pa_df.iterrows():
            fips = row["FIPS"]
            code = int(row["RUCC_2013"])
            rucc_lookup[fips] = {
                "code": code,
                "label": RUCC_LABELS.get(code, "Unknown"),
                "category": RUCC_CATEGORIES.get(code, "Unknown"),
                "geo_loc_id": county_loc_map.get(fips),
            }

        emit("rucc_mapped", counties=len(rucc_lookup))

        # Get patients grouped by county
        with conn.cursor() as cur:
            cur.execute("SELECT person_id, county_fips, county_location_id FROM gis.patient_geography WHERE county_fips IS NOT NULL")
            patients = cur.fetchall()

        rows = []
        for person_id, county_fips, county_loc_id in patients:
            rucc = rucc_lookup.get(county_fips)
            if rucc is None:
                continue
            rows.append((
                person_id,
                "rucc",
                EXPOSURE_DATE,
                float(rucc["code"]),        # value_as_number
                rucc["category"],            # value_as_string (Metro/Micropolitan/Rural)
                rucc["code"],                # value_as_integer
                "category",                  # unit
                rucc["geo_loc_id"],          # geographic_location_id
                "usda_rucc_2013",            # source_dataset
            ))

        emit("exposure_rows", count=len(rows))

        # Clear and insert
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type = 'rucc'")

        batch_size = 50000
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """INSERT INTO gis.external_exposure
                       (person_id, exposure_type, exposure_date, value_as_number,
                        value_as_string, value_as_integer, unit, geographic_location_id, source_dataset)
                       VALUES %s""",
                    batch,
                )
            conn.commit()
            emit("batch", loaded=min(i + batch_size, len(rows)), total=len(rows))

        emit("complete", exposure_rows=len(rows))

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run RUCC loader**

```bash
python scripts/gis/load_rucc.py
```

- [ ] **Step 4: Verify**

```bash
PGPASSWORD=acumenus psql -h localhost -U smudoshi -d ohdsi -c "SELECT value_as_string, value_as_integer, COUNT(*) FROM gis.external_exposure WHERE exposure_type = 'rucc' GROUP BY value_as_string, value_as_integer ORDER BY value_as_integer;"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gis/load_rucc.py
git commit -m "feat(gis): add USDA RUCC data loader for urban-rural classification"
```

---

### Task 8: Load Air Quality Data (Use Case 4)

**Files:**
- Create: `scripts/gis/load_air_quality.py`

- [ ] **Step 1: Download EPA data**

```bash
python scripts/gis/fetch_data.py --fetch --only aqs
```

- [ ] **Step 2: Write load_air_quality.py**

Create `scripts/gis/load_air_quality.py`:

```python
#!/usr/bin/env python3
"""Load EPA Air Quality data into gis.external_exposure.

Loads PM2.5 and Ozone county-level annual averages from EPA AQS data,
assigns to patients via county FIPS.

Usage:
    python scripts/gis/load_air_quality.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
PA_FIPS = "42"
EXPOSURE_DATE = "2020-01-01"

# EPA parameter codes for pollutants we care about
POLLUTANTS = {
    "88101": {"type": "pm25", "unit": "ug/m3", "name": "PM2.5"},
    "44201": {"type": "ozone", "unit": "ppb", "name": "Ozone"},
}


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def main():
    emit("start", script="load_air_quality")

    aqs_file = GIS_DATA / "aqs" / "annual_conc_by_monitor_2020.csv"
    if not aqs_file.exists():
        emit("error", message=f"AQS file not found: {aqs_file}")
        sys.exit(1)

    emit("reading", source="EPA AQS 2020")
    df = pd.read_csv(aqs_file, dtype={"State Code": str, "County Code": str, "Parameter Code": str})

    # Filter to PA and our pollutants
    pa_df = df[df["State Code"] == PA_FIPS].copy()
    pa_df = pa_df[pa_df["Parameter Code"].isin(POLLUTANTS.keys())]
    emit("filtered", pa_records=len(pa_df))

    # Aggregate to county-level mean
    pa_df["county_fips"] = pa_df["State Code"] + pa_df["County Code"].str.zfill(3)
    county_means = pa_df.groupby(["county_fips", "Parameter Code"])["Arithmetic Mean"].mean().reset_index()
    emit("aggregated", county_pollutant_pairs=len(county_means))

    conn = psycopg2.connect(DB_DSN)

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'")
            county_loc_map = {r[1]: r[0] for r in cur.fetchall()}

        # Build lookup: county_fips → {pollutant_type: value}
        aqs_lookup = {}
        for _, row in county_means.iterrows():
            fips = row["county_fips"]
            param = row["Parameter Code"]
            pol = POLLUTANTS[param]
            if fips not in aqs_lookup:
                aqs_lookup[fips] = {}
            aqs_lookup[fips][pol["type"]] = {
                "value": float(row["Arithmetic Mean"]),
                "unit": pol["unit"],
                "geo_loc_id": county_loc_map.get(fips),
            }

        emit("aqs_mapped", counties_with_data=len(aqs_lookup))

        # Get patients by county
        with conn.cursor() as cur:
            cur.execute("SELECT person_id, county_fips, county_location_id FROM gis.patient_geography WHERE county_fips IS NOT NULL")
            patients = cur.fetchall()

        rows = []
        for person_id, county_fips, county_loc_id in patients:
            county_data = aqs_lookup.get(county_fips, {})
            for pol_type, pol_data in county_data.items():
                rows.append((
                    person_id,
                    pol_type,                    # pm25 or ozone
                    EXPOSURE_DATE,
                    pol_data["value"],           # value_as_number
                    None,                        # value_as_string
                    None,                        # value_as_integer
                    pol_data["unit"],            # unit
                    pol_data["geo_loc_id"],       # geographic_location_id
                    "epa_aqs_2020",              # source_dataset
                ))

        emit("exposure_rows", count=len(rows))

        # Clear and insert
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type IN ('pm25', 'ozone')")

        batch_size = 50000
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """INSERT INTO gis.external_exposure
                       (person_id, exposure_type, exposure_date, value_as_number,
                        value_as_string, value_as_integer, unit, geographic_location_id, source_dataset)
                       VALUES %s""",
                    batch,
                )
            conn.commit()
            emit("batch", loaded=min(i + batch_size, len(rows)), total=len(rows))

        emit("complete", exposure_rows=len(rows))

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run air quality loader**

```bash
python scripts/gis/load_air_quality.py
```

- [ ] **Step 4: Commit**

```bash
git add scripts/gis/load_air_quality.py
git commit -m "feat(gis): add EPA air quality data loader for PM2.5 and ozone"
```

---

### Task 9: Load Hospital Data (Use Case 5)

**Files:**
- Create: `scripts/gis/load_hospitals.py`

- [ ] **Step 1: Download CMS hospital data**

```bash
python scripts/gis/fetch_data.py --fetch --only hospitals
```

- [ ] **Step 2: Write load_hospitals.py**

Create `scripts/gis/load_hospitals.py`:

```python
#!/usr/bin/env python3
"""Load CMS hospital data into gis.gis_hospital and calculate distances.

Loads PA hospitals with emergency departments, creates PostGIS points,
then calculates Haversine distance from each patient's county centroid
to the nearest hospital.

Usage:
    python scripts/gis/load_hospitals.py
"""

import json
import math
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

GIS_DATA = Path(__file__).resolve().parent.parent.parent / "GIS" / "data"
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"
EXPOSURE_DATE = "2024-01-01"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate great-circle distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def main():
    emit("start", script="load_hospitals")

    hosp_file = GIS_DATA / "hospitals" / "Hospital_General_Information.csv"
    if not hosp_file.exists():
        emit("error", message=f"Hospital file not found: {hosp_file}")
        sys.exit(1)

    emit("reading", source="CMS Hospital General Information")
    df = pd.read_csv(hosp_file)

    # Filter to PA hospitals with emergency services
    pa_df = df[df["State"] == "PA"].copy()
    ed_df = pa_df[pa_df["Emergency Services"] == "Yes"].copy()
    emit("filtered", pa_hospitals=len(pa_df), with_ed=len(ed_df))

    conn = psycopg2.connect(DB_DSN)

    try:
        # Load hospitals
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.gis_hospital")

        rows = []
        for _, row in ed_df.iterrows():
            lat = row.get("Latitude") or row.get("Location_Latitude")
            lon = row.get("Longitude") or row.get("Location_Longitude")
            if pd.isna(lat) or pd.isna(lon):
                continue

            county_fips = str(row.get("County Name", ""))  # We'll map later if needed
            rows.append((
                str(row.get("Facility ID", "")),
                str(row.get("Facility Name", "")),
                str(row.get("Address", "")),
                str(row.get("City", "")),
                None,  # county_fips — filled below
                str(row.get("ZIP Code", ""))[:5],
                float(lat),
                float(lon),
                str(row.get("Hospital Type", "")),
                True,  # has_emergency
                None,  # bed_count — not in all CMS datasets
            ))

        with conn.cursor() as cur:
            execute_values(
                cur,
                """INSERT INTO gis.gis_hospital
                   (cms_provider_id, hospital_name, address, city, county_fips, zip_code,
                    latitude, longitude, hospital_type, has_emergency, bed_count)
                   VALUES %s""",
                rows,
            )
            # Set PostGIS point from lat/lon
            cur.execute("""
                UPDATE gis.gis_hospital
                SET point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """)
        conn.commit()
        emit("hospitals_loaded", count=len(rows))

        # Calculate nearest hospital distance for each county centroid
        with conn.cursor() as cur:
            cur.execute("SELECT geographic_location_id, geographic_code, latitude, longitude FROM gis.geographic_location WHERE location_type = 'county'")
            counties = cur.fetchall()

            cur.execute("SELECT hospital_id, latitude, longitude FROM gis.gis_hospital WHERE latitude IS NOT NULL")
            hospitals = cur.fetchall()

        # For each county, find nearest hospital
        county_distances = {}
        for geo_id, fips, clat, clon in counties:
            if clat is None or clon is None:
                continue
            min_dist = float("inf")
            for _, hlat, hlon in hospitals:
                dist = haversine_km(float(clat), float(clon), float(hlat), float(hlon))
                min_dist = min(min_dist, dist)
            county_distances[fips] = {"distance": round(min_dist, 2), "geo_loc_id": geo_id}

        emit("distances_calculated", counties=len(county_distances))

        # Assign hospital distance to patients
        with conn.cursor() as cur:
            cur.execute("SELECT person_id, county_fips, county_location_id FROM gis.patient_geography WHERE county_fips IS NOT NULL")
            patients = cur.fetchall()

        exp_rows = []
        for person_id, county_fips, county_loc_id in patients:
            dist_data = county_distances.get(county_fips)
            if dist_data is None:
                continue
            exp_rows.append((
                person_id,
                "hospital_distance",
                EXPOSURE_DATE,
                dist_data["distance"],
                None,
                None,
                "km",
                dist_data["geo_loc_id"],
                "cms_hospitals_2024",
            ))

        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type = 'hospital_distance'")

        batch_size = 50000
        for i in range(0, len(exp_rows), batch_size):
            batch = exp_rows[i : i + batch_size]
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """INSERT INTO gis.external_exposure
                       (person_id, exposure_type, exposure_date, value_as_number,
                        value_as_string, value_as_integer, unit, geographic_location_id, source_dataset)
                       VALUES %s""",
                    batch,
                )
            conn.commit()
            emit("batch", loaded=min(i + batch_size, len(exp_rows)), total=len(exp_rows))

        emit("complete", hospitals=len(rows), distance_rows=len(exp_rows))

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run hospital loader**

```bash
python scripts/gis/load_hospitals.py
```

- [ ] **Step 4: Commit**

```bash
git add scripts/gis/load_hospitals.py
git commit -m "feat(gis): add CMS hospital loader with distance calculations"
```

---

### Task 10: ETL Orchestrator & Summary Aggregation

**Files:**
- Create: `scripts/gis/load_all.py`

- [ ] **Step 1: Write load_all.py**

Create `scripts/gis/load_all.py`:

```python
#!/usr/bin/env python3
"""Orchestrate all GIS data loading steps.

Runs steps in order with validation gates between each step.
Generates geography_summary pre-aggregated table at the end.

Usage:
    python scripts/gis/load_all.py              # Run all steps (expects data in GIS/data/)
    python scripts/gis/load_all.py --fetch       # Download data first, then load
    python scripts/gis/load_all.py --step 3a     # Run only a specific step
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import psycopg2

SCRIPTS_DIR = Path(__file__).resolve().parent
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def run_step(script_name: str, step_label: str):
    """Run an ETL script, streaming its output."""
    emit("step_start", step=step_label, script=script_name)
    script = SCRIPTS_DIR / script_name
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=False,
        text=True,
    )
    if result.returncode != 0:
        emit("step_failed", step=step_label, returncode=result.returncode)
        sys.exit(1)
    emit("step_done", step=step_label)


def verify_postgis():
    """Step 0: Verify PostGIS is available."""
    emit("step_start", step="0_postgis_check")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT PostGIS_Version()")
            version = cur.fetchone()[0]
            emit("postgis_version", version=version)
    except Exception as e:
        emit("error", message=f"PostGIS not available: {e}")
        print("\nPostGIS is required. Install with:")
        print("  sudo apt install postgresql-17-postgis-3")
        print("  psql -c 'CREATE EXTENSION postgis;' ohdsi")
        sys.exit(1)
    finally:
        conn.close()
    emit("step_done", step="0_postgis_check")


def run_schema():
    """Step 0.5: Create schema if not exists."""
    emit("step_start", step="0.5_schema")
    schema_sql = SCRIPTS_DIR / "create_schema.sql"
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "smudoshi", "-d", "ohdsi", "-f", str(schema_sql)],
        capture_output=True,
        text=True,
        env={**__import__("os").environ, "PGPASSWORD": "acumenus"},
    )
    if result.returncode != 0:
        emit("error", message=f"Schema creation failed: {result.stderr}")
        sys.exit(1)
    emit("step_done", step="0.5_schema")


def build_summary():
    """Final step: Build geography_summary pre-aggregated table."""
    emit("step_start", step="summary")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.geography_summary")
            cur.execute("""
                INSERT INTO gis.geography_summary
                  (geographic_location_id, exposure_type, patient_count, avg_value, min_value, max_value)
                SELECT
                  ee.geographic_location_id,
                  ee.exposure_type,
                  COUNT(DISTINCT ee.person_id),
                  AVG(ee.value_as_number),
                  MIN(ee.value_as_number),
                  MAX(ee.value_as_number)
                FROM gis.external_exposure ee
                WHERE ee.geographic_location_id IS NOT NULL
                GROUP BY ee.geographic_location_id, ee.exposure_type
            """)
            cur.execute("SELECT COUNT(*) FROM gis.geography_summary")
            count = cur.fetchone()[0]
        conn.commit()
        emit("summary_built", rows=count)
    finally:
        conn.close()
    emit("step_done", step="summary")


def validate():
    """Run validation checks."""
    emit("step_start", step="validation")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            checks = {}
            cur.execute("SELECT location_type, COUNT(*) FROM gis.geographic_location GROUP BY location_type")
            checks["geographic_location"] = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM gis.location_geography")
            checks["crosswalk_rows"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM gis.patient_geography")
            checks["patient_geography_rows"] = cur.fetchone()[0]

            cur.execute("SELECT exposure_type, COUNT(*) FROM gis.external_exposure GROUP BY exposure_type ORDER BY exposure_type")
            checks["external_exposure"] = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM gis.gis_hospital")
            checks["hospitals"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM gis.geography_summary")
            checks["summary_rows"] = cur.fetchone()[0]

        emit("validation_report", **checks)
    finally:
        conn.close()
    emit("step_done", step="validation")


STEPS = {
    "0": ("PostGIS check", verify_postgis),
    "0.5": ("Schema creation", run_schema),
    "1": ("Geography (tracts/counties)", lambda: run_step("load_geography.py", "1_geography")),
    "2": ("ZIP-Tract crosswalk", lambda: run_step("load_crosswalk.py", "2_crosswalk")),
    "3a": ("CDC SVI data", lambda: run_step("load_svi.py", "3a_svi")),
    "3b": ("USDA RUCC data", lambda: run_step("load_rucc.py", "3b_rucc")),
    "3c": ("EPA Air Quality data", lambda: run_step("load_air_quality.py", "3c_air_quality")),
    "3d": ("CMS Hospital data", lambda: run_step("load_hospitals.py", "3d_hospitals")),
    "4": ("Summary aggregation", build_summary),
    "5": ("Validation", validate),
}


def main():
    parser = argparse.ArgumentParser(description="Run all GIS ETL steps")
    parser.add_argument("--fetch", action="store_true", help="Download data before loading")
    parser.add_argument("--step", type=str, help="Run only this step")
    args = parser.parse_args()

    if args.fetch:
        emit("fetching_data")
        subprocess.run([sys.executable, str(SCRIPTS_DIR / "fetch_data.py"), "--fetch"], check=True)

    if args.step:
        if args.step not in STEPS:
            print(f"Unknown step: {args.step}. Valid: {list(STEPS.keys())}")
            sys.exit(1)
        label, fn = STEPS[args.step]
        emit("running_single_step", step=args.step, label=label)
        fn()
    else:
        emit("start_all", steps=len(STEPS))
        for step_key, (label, fn) in STEPS.items():
            emit("running_step", step=step_key, label=label)
            fn()
        emit("all_complete")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test orchestrator (schema + validation only)**

```bash
python scripts/gis/load_all.py --step 5
```

- [ ] **Step 3: Commit**

```bash
git add scripts/gis/load_all.py
git commit -m "feat(gis): add ETL orchestrator with validation and summary aggregation"
```

---

## End of Chunk 1

Chunk 1 covers database infrastructure and the complete ETL pipeline (10 tasks). After running `load_all.py`, the `gis` schema will have:
- ~4,600 geographic locations (tracts + counties)
- ~4,000 crosswalk rows
- ~10M external exposure rows (SVI, RUCC, air quality, hospital distance)
- ~200 hospitals
- Pre-aggregated summary table
- `patient_geography` materialized view for fast joins

---

## Chunk 2: Backend API (Laravel Controllers, Services, Routes)

### Task 11: Database Connection & COVID Cohort Service

**Files:**
- Modify: `backend/config/database.php`
- Modify: `backend/.env`
- Create: `backend/app/Services/GIS/GisCovidCohortService.php`

- [ ] **Step 1: Add GIS database connection**

Add to `backend/config/database.php` inside the `'connections'` array, after the `'results'` connection:

```php
'gis' => [
    'driver' => 'pgsql',
    'host' => env('GIS_DB_HOST', 'localhost'),
    'port' => env('GIS_DB_PORT', '5432'),
    'database' => env('GIS_DB_DATABASE', 'ohdsi'),
    'username' => env('GIS_DB_USERNAME', 'smudoshi'),
    'password' => env('GIS_DB_PASSWORD', ''),
    'charset' => 'utf8',
    'prefix' => '',
    'prefix_indexes' => true,
    'search_path' => 'gis,omop,public',
    'sslmode' => 'prefer',
],
```

- [ ] **Step 2: Add env vars to backend/.env**

Append to `backend/.env`:

```
# GIS Database (local PG 17 — ohdsi DB, gis schema)
GIS_DB_HOST=localhost
GIS_DB_PORT=5432
GIS_DB_DATABASE=ohdsi
GIS_DB_USERNAME=smudoshi
GIS_DB_PASSWORD=
```

- [ ] **Step 3: Write GisCovidCohortService**

Create `backend/app/Services/GIS/GisCovidCohortService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class GisCovidCohortService
{
    private const COVID_CONCEPT_ID = 37311061;

    /**
     * Return a CTE fragment and bindings for COVID diagnosis cases.
     * Uses parameterized query to prevent SQL injection.
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function covidDiagnosisCte(int $conceptId = self::COVID_CONCEPT_ID): array
    {
        return [
            'sql' => "covid_dx AS (
                SELECT DISTINCT co.person_id,
                       co.condition_start_date AS index_date
                FROM omop.condition_occurrence co
                WHERE co.condition_concept_id = ?
            )",
            'bindings' => [$conceptId],
        ];
    }

    /**
     * CTE for COVID hospitalizations (inpatient visit within ±7 days of diagnosis).
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function hospitalizationCte(): array
    {
        return [
            'sql' => "covid_hosp AS (
                SELECT DISTINCT cd.person_id, cd.index_date
                FROM covid_dx cd
                JOIN omop.visit_occurrence vo ON cd.person_id = vo.person_id
                WHERE vo.visit_concept_id = 9201
                  AND vo.visit_start_date BETWEEN cd.index_date - INTERVAL '7 days'
                                              AND cd.index_date + INTERVAL '30 days'
            )",
            'bindings' => [],
        ];
    }

    /**
     * CTE for COVID mortality (death within 30 days of diagnosis).
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function mortalityCte(): array
    {
        return [
            'sql' => "covid_death AS (
                SELECT DISTINCT cd.person_id, cd.index_date
                FROM covid_dx cd
                JOIN omop.death d ON cd.person_id = d.person_id
                WHERE d.death_date BETWEEN cd.index_date
                                       AND cd.index_date + INTERVAL '30 days'
            )",
            'bindings' => [],
        ];
    }

    /**
     * Build full CTE prefix with all outcome types.
     *
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    public function allCtes(int $conceptId = self::COVID_CONCEPT_ID): array
    {
        $parts = [
            $this->covidDiagnosisCte($conceptId),
            $this->hospitalizationCte(),
            $this->mortalityCte(),
        ];

        $sql = "WITH " . implode(",\n", array_column($parts, 'sql'));
        $bindings = array_merge(...array_column($parts, 'bindings'));

        return ['sql' => $sql, 'bindings' => $bindings];
    }

    /**
     * Return the appropriate CTE table name for a metric.
     */
    public function cteTableForMetric(string $metric): string
    {
        return match ($metric) {
            'cases' => 'covid_dx',
            'hospitalizations' => 'covid_hosp',
            'deaths' => 'covid_death',
            default => 'covid_dx',
        };
    }
}
```

> **Security note:** All CTE methods return `{sql, bindings}` arrays. Calling services MUST merge the bindings array into their `DB::select()` calls to use parameterized queries. Example: `DB::connection('gis')->select($cte['sql'] . "\n" . $mainQuery, array_merge($cte['bindings'], $mainBindings))`

- [ ] **Step 4: Verify connection**

```bash
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec php php artisan tinker --execute="DB::connection('gis')->select('SELECT COUNT(*) as c FROM gis.geographic_location')"
```

Expected: Returns row count (0 if ETL hasn't run yet, or ~4600 if it has).

- [ ] **Step 5: Commit**

```bash
git add backend/config/database.php backend/.env.example backend/app/Services/GIS/GisCovidCohortService.php
git commit -m "feat(gis): add gis database connection and COVID cohort CTE service"
```

---

### Task 12: Geography Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/GeographyService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisGeographyController.php`

- [ ] **Step 1: Write GeographyService**

Create `backend/app/Services/GIS/GeographyService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class GeographyService
{
    /**
     * List all PA counties with geometry as GeoJSON.
     */
    public function counties(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gl.population,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geographic_location gl
            WHERE gl.location_type = 'county'
              AND gl.state_fips = '42'
            ORDER BY gl.location_name
        ");
    }

    /**
     * List tracts within a county, with geometry.
     */
    public function tractsByCounty(string $countyFips): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gl.population,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geographic_location gl
            WHERE gl.location_type = 'census_tract'
              AND gl.county_fips = ?
            ORDER BY gl.geographic_code
        ", [$countyFips]);
    }

    /**
     * Return available layer metadata.
     */
    public function layers(): array
    {
        return [
            [
                'id' => 'svi',
                'name' => 'Social Vulnerability Index',
                'description' => 'CDC/ATSDR SVI by census tract — 4 themes + overall',
                'color' => '#E85A6B',
                'available' => $this->hasExposureData('svi_overall'),
            ],
            [
                'id' => 'rucc',
                'name' => 'Urban-Rural Classification',
                'description' => 'USDA Rural-Urban Continuum Codes by county',
                'color' => '#8B5CF6',
                'available' => $this->hasExposureData('rucc'),
            ],
            [
                'id' => 'comorbidity',
                'name' => 'Comorbidity Clustering',
                'description' => 'Geographic comorbidity burden (DM, HTN, obesity)',
                'color' => '#F59E0B',
                'available' => $this->hasExposureData('comorbidity_burden'),
            ],
            [
                'id' => 'air-quality',
                'name' => 'Air Quality',
                'description' => 'EPA PM2.5 and ozone vs respiratory outcomes',
                'color' => '#10B981',
                'available' => $this->hasExposureData('pm25'),
            ],
            [
                'id' => 'hospital-access',
                'name' => 'Hospital Access',
                'description' => 'CMS hospital proximity and healthcare deserts',
                'color' => '#3B82F6',
                'available' => $this->hasHospitalData(),
            ],
        ];
    }

    private function hasExposureData(string $exposureType): bool
    {
        $row = DB::connection('gis')->selectOne(
            "SELECT EXISTS(SELECT 1 FROM gis.external_exposure WHERE exposure_type = ? LIMIT 1) AS has_data",
            [$exposureType]
        );
        return $row->has_data ?? false;
    }

    private function hasHospitalData(): bool
    {
        $row = DB::connection('gis')->selectOne(
            "SELECT EXISTS(SELECT 1 FROM gis.gis_hospital LIMIT 1) AS has_data"
        );
        return $row->has_data ?? false;
    }
}
```

- [ ] **Step 2: Write GisGeographyController**

Create `backend/app/Http/Controllers/Api/V1/GisGeographyController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\GeographyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisGeographyController extends Controller
{
    public function __construct(
        private readonly GeographyService $geographyService
    ) {}

    public function layers(): JsonResponse
    {
        return response()->json(['data' => $this->geographyService->layers()]);
    }

    public function counties(): JsonResponse
    {
        return response()->json(['data' => $this->geographyService->counties()]);
    }

    public function tracts(Request $request): JsonResponse
    {
        $request->validate(['county' => 'required|string|size:5']);
        $tracts = $this->geographyService->tractsByCounty($request->input('county'));
        return response()->json(['data' => $tracts]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/GeographyService.php backend/app/Http/Controllers/Api/V1/GisGeographyController.php
git commit -m "feat(gis): add geography service and controller (counties, tracts, layers)"
```

---

### Task 13: SVI Analysis Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/SviAnalysisService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisSviController.php`

- [ ] **Step 1: Write SviAnalysisService**

Create `backend/app/Services/GIS/SviAnalysisService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class SviAnalysisService
{
    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth data: SVI value per geography with patient counts.
     */
    public function choropleth(string $level = 'county', string $theme = 'overall'): array
    {
        $exposureType = $theme === 'overall' ? 'svi_overall' : "svi_theme{$theme}";
        $locationType = $level === 'tract' ? 'census_tract' : 'county';

        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS svi_value,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = ?
              AND gl.location_type = ?
            ORDER BY gs.avg_value DESC
        ", [$exposureType, $locationType]);
    }

    /**
     * Quartile analysis: COVID outcomes grouped by SVI quartile.
     */
    public function quartileAnalysis(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            patient_svi AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS svi_value,
                    NTILE(4) OVER (ORDER BY ee.value_as_number) AS quartile
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = 'svi_overall'
            )
            SELECT
                ps.quartile,
                COUNT(DISTINCT ps.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT ps.person_id), 0) * 100, 2) AS rate,
                MIN(ps.svi_value) AS quartile_min,
                MAX(ps.svi_value) AS quartile_max
            FROM patient_svi ps
            LEFT JOIN {$cteTable} ct ON ps.person_id = ct.person_id
            GROUP BY ps.quartile
            ORDER BY ps.quartile
        ", $cte['bindings']);
    }

    /**
     * Correlation between 4 SVI themes and 3 outcome metrics.
     */
    public function themeCorrelations(int $conceptId): array
    {
        $themes = ['svi_theme1', 'svi_theme2', 'svi_theme3', 'svi_theme4'];
        $results = [];
        $cte = $this->cohortService->allCtes($conceptId);

        foreach ($themes as $theme) {
            $rows = DB::connection('gis')->select("
                {$cte['sql']}
                SELECT
                    gs.geographic_location_id,
                    gs.avg_value AS theme_value,
                    COALESCE(dx.cnt, 0) AS cases,
                    COALESCE(hosp.cnt, 0) AS hospitalizations,
                    COALESCE(death.cnt, 0) AS deaths,
                    gs.patient_count
                FROM gis.geography_summary gs
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd.person_id) AS cnt
                    FROM covid_dx cd JOIN gis.patient_geography pg ON cd.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) dx ON gs.geographic_location_id = dx.geo_id
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT ch.person_id) AS cnt
                    FROM covid_hosp ch JOIN gis.patient_geography pg ON ch.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) hosp ON gs.geographic_location_id = hosp.geo_id
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd2.person_id) AS cnt
                    FROM covid_death cd2 JOIN gis.patient_geography pg ON cd2.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) death ON gs.geographic_location_id = death.geo_id
                WHERE gs.exposure_type = ?
            ", array_merge($cte['bindings'], [$theme]));

            $results[$theme] = $rows;
        }

        return $results;
    }

    /**
     * Detail for a single tract.
     */
    public function tractDetail(string $fips): array|null
    {
        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                ee_overall.value_as_number AS svi_overall,
                ee_t1.value_as_number AS svi_theme1,
                ee_t2.value_as_number AS svi_theme2,
                ee_t3.value_as_number AS svi_theme3,
                ee_t4.value_as_number AS svi_theme4
            FROM gis.geographic_location gl
            LEFT JOIN LATERAL (
                SELECT AVG(value_as_number) AS value_as_number
                FROM gis.external_exposure
                WHERE geographic_location_id = gl.geographic_location_id AND exposure_type = 'svi_overall'
            ) ee_overall ON true
            LEFT JOIN LATERAL (
                SELECT AVG(value_as_number) AS value_as_number
                FROM gis.external_exposure
                WHERE geographic_location_id = gl.geographic_location_id AND exposure_type = 'svi_theme1'
            ) ee_t1 ON true
            LEFT JOIN LATERAL (
                SELECT AVG(value_as_number) AS value_as_number
                FROM gis.external_exposure
                WHERE geographic_location_id = gl.geographic_location_id AND exposure_type = 'svi_theme2'
            ) ee_t2 ON true
            LEFT JOIN LATERAL (
                SELECT AVG(value_as_number) AS value_as_number
                FROM gis.external_exposure
                WHERE geographic_location_id = gl.geographic_location_id AND exposure_type = 'svi_theme3'
            ) ee_t3 ON true
            LEFT JOIN LATERAL (
                SELECT AVG(value_as_number) AS value_as_number
                FROM gis.external_exposure
                WHERE geographic_location_id = gl.geographic_location_id AND exposure_type = 'svi_theme4'
            ) ee_t4 ON true
            WHERE gl.geographic_code = ? AND gl.location_type = 'census_tract'
        ", [$fips]);

        return $row ? (array) $row : null;
    }
}
```

- [ ] **Step 2: Write GisSviController**

Create `backend/app/Http/Controllers/Api/V1/GisSviController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\SviAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisSviController extends Controller
{
    public function __construct(
        private readonly SviAnalysisService $sviService
    ) {}

    public function choropleth(Request $request): JsonResponse
    {
        $request->validate([
            'level' => 'sometimes|in:tract,county',
            'theme' => 'sometimes|in:overall,1,2,3,4',
        ]);

        $data = $this->sviService->choropleth(
            $request->input('level', 'county'),
            $request->input('theme', 'overall')
        );

        return response()->json(['data' => $data]);
    }

    public function quartileAnalysis(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->sviService->quartileAnalysis(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function themeCorrelations(Request $request): JsonResponse
    {
        $request->validate(['concept_id' => 'required|integer']);

        $data = $this->sviService->themeCorrelations(
            (int) $request->input('concept_id')
        );

        return response()->json(['data' => $data]);
    }

    public function tractDetail(string $fips): JsonResponse
    {
        $data = $this->sviService->tractDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'Tract not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/SviAnalysisService.php backend/app/Http/Controllers/Api/V1/GisSviController.php
git commit -m "feat(gis): add SVI analysis service and controller"
```

---

### Task 14: RUCC Analysis Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/RuccAnalysisService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisRuccController.php`

- [ ] **Step 1: Write RuccAnalysisService**

Create `backend/app/Services/GIS/RuccAnalysisService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class RuccAnalysisService
{
    private const RUCC_LABELS = [
        1 => 'Metro ≥1M', 2 => 'Metro 250K-1M', 3 => 'Metro <250K',
        4 => 'Nonmetro ≥20K adj', 5 => 'Nonmetro ≥20K nonadj',
        6 => 'Nonmetro 2.5-19.9K adj', 7 => 'Nonmetro 2.5-19.9K nonadj',
        8 => 'Nonmetro <2.5K adj', 9 => 'Nonmetro <2.5K nonadj',
    ];

    private const RUCC_CATEGORIES = [
        'metro' => [1, 2, 3],
        'micro' => [4, 5, 6],
        'rural' => [7, 8, 9],
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * County choropleth colored by RUCC 3-category classification.
     */
    public function choropleth(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS rucc_code,
                gs.patient_count,
                CASE
                    WHEN gs.avg_value <= 3 THEN 'metro'
                    WHEN gs.avg_value <= 6 THEN 'micro'
                    ELSE 'rural'
                END AS category,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'rucc'
              AND gl.location_type = 'county'
            ORDER BY gl.location_name
        ");
    }

    /**
     * COVID outcomes compared across metro/micro/rural.
     */
    public function outcomeComparison(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']}
            SELECT
                CASE
                    WHEN ee.value_as_integer <= 3 THEN 'metro'
                    WHEN ee.value_as_integer <= 6 THEN 'micro'
                    ELSE 'rural'
                END AS category,
                COUNT(DISTINCT pg.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT pg.person_id), 0) * 100, 2) AS rate
            FROM gis.patient_geography pg
            JOIN gis.external_exposure ee ON pg.person_id = ee.person_id AND ee.exposure_type = 'rucc'
            LEFT JOIN {$cteTable} ct ON pg.person_id = ct.person_id
            GROUP BY category
            ORDER BY category
        ", $cte['bindings']);
    }

    /**
     * Full 9-category RUCC breakdown.
     */
    public function countyDetail(string $fips): array|null
    {
        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                gs.avg_value AS rucc_code,
                gs.patient_count
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gl.geographic_code = ? AND gs.exposure_type = 'rucc'
        ", [$fips]);

        if (!$row) return null;

        $result = (array) $row;
        $code = (int) $row->rucc_code;
        $result['rucc_label'] = self::RUCC_LABELS[$code] ?? 'Unknown';
        $result['category'] = match (true) {
            $code <= 3 => 'metro',
            $code <= 6 => 'micro',
            default => 'rural',
        };

        return $result;
    }
}
```

- [ ] **Step 2: Write GisRuccController**

Create `backend/app/Http/Controllers/Api/V1/GisRuccController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\RuccAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisRuccController extends Controller
{
    public function __construct(
        private readonly RuccAnalysisService $ruccService
    ) {}

    public function choropleth(): JsonResponse
    {
        return response()->json(['data' => $this->ruccService->choropleth()]);
    }

    public function outcomeComparison(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->ruccService->outcomeComparison(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function countyDetail(string $fips): JsonResponse
    {
        $data = $this->ruccService->countyDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'County not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/RuccAnalysisService.php backend/app/Http/Controllers/Api/V1/GisRuccController.php
git commit -m "feat(gis): add RUCC analysis service and controller"
```

---

### Task 15: Comorbidity Analysis Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/ComorbidityAnalysisService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisComorbidityController.php`

- [ ] **Step 1: Write ComorbidityAnalysisService**

Create `backend/app/Services/GIS/ComorbidityAnalysisService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class ComorbidityAnalysisService
{
    // Diabetes, Hypertension, Obesity concept IDs (SNOMED)
    private const COMORBIDITY_CONCEPTS = [
        'diabetes' => 201820,     // Type 2 DM
        'hypertension' => 320128, // Essential HTN
        'obesity' => 433736,      // Obesity
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth of comorbidity burden score by county.
     */
    public function choropleth(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS burden_score,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ");
    }

    /**
     * Hotspot data: counties with highest burden for spatial stats input.
     */
    public function hotspots(int $conceptId): array
    {
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']}
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS burden_score,
                gs.patient_count,
                COALESCE(dx.cnt, 0) AS covid_cases,
                COALESCE(hosp.cnt, 0) AS hospitalizations,
                ROUND(COALESCE(hosp.cnt, 0)::numeric / NULLIF(COALESCE(dx.cnt, 0), 0) * 100, 2) AS hosp_rate
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            LEFT JOIN (
                SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd.person_id) AS cnt
                FROM covid_dx cd JOIN gis.patient_geography pg ON cd.person_id = pg.person_id
                GROUP BY pg.county_location_id
            ) dx ON gl.geographic_location_id = dx.geo_id
            LEFT JOIN (
                SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT ch.person_id) AS cnt
                FROM covid_hosp ch JOIN gis.patient_geography pg ON ch.person_id = pg.person_id
                GROUP BY pg.county_location_id
            ) hosp ON gl.geographic_location_id = hosp.geo_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ", $cte['bindings']);
    }

    /**
     * Burden score distribution histogram data.
     */
    public function burdenScore(): array
    {
        return DB::connection('gis')->select("
            SELECT
                WIDTH_BUCKET(gs.avg_value, 0, 3, 10) AS bucket,
                COUNT(*) AS county_count,
                ROUND(MIN(gs.avg_value), 2) AS bucket_min,
                ROUND(MAX(gs.avg_value), 2) AS bucket_max,
                SUM(gs.patient_count) AS total_patients
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            GROUP BY bucket
            ORDER BY bucket
        ");
    }
}
```

- [ ] **Step 2: Write GisComorbidityController**

Create `backend/app/Http/Controllers/Api/V1/GisComorbidityController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\ComorbidityAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisComorbidityController extends Controller
{
    public function __construct(
        private readonly ComorbidityAnalysisService $comorbidityService
    ) {}

    public function choropleth(): JsonResponse
    {
        return response()->json(['data' => $this->comorbidityService->choropleth()]);
    }

    public function hotspots(Request $request): JsonResponse
    {
        $request->validate(['concept_id' => 'required|integer']);
        $data = $this->comorbidityService->hotspots((int) $request->input('concept_id'));
        return response()->json(['data' => $data]);
    }

    public function burdenScore(): JsonResponse
    {
        return response()->json(['data' => $this->comorbidityService->burdenScore()]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/ComorbidityAnalysisService.php backend/app/Http/Controllers/Api/V1/GisComorbidityController.php
git commit -m "feat(gis): add comorbidity analysis service and controller"
```

---

### Task 16: Air Quality Analysis Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/AirQualityAnalysisService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisAirQualityController.php`

- [ ] **Step 1: Write AirQualityAnalysisService**

Create `backend/app/Services/GIS/AirQualityAnalysisService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class AirQualityAnalysisService
{
    // Respiratory condition concepts for outcome analysis
    private const RESPIRATORY_CONCEPTS = [
        'asthma' => 317009,
        'copd' => 255573,
        'pneumonia' => 255848,
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth of PM2.5 or ozone levels by county.
     */
    public function choropleth(string $pollutant = 'pm25'): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS pollutant_value,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = ?
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ", [$pollutant]);
    }

    /**
     * Respiratory outcomes by air quality tertile.
     */
    public function respiratoryOutcomes(int $conceptId, string $pollutant = 'pm25'): array
    {
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            aq_tertiles AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS aq_value,
                    NTILE(3) OVER (ORDER BY ee.value_as_number) AS tertile
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = ?
            )
            SELECT
                aq.tertile,
                COUNT(DISTINCT aq.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT aq.person_id), 0) * 100, 2) AS rate,
                ROUND(MIN(aq.aq_value), 2) AS tertile_min,
                ROUND(MAX(aq.aq_value), 2) AS tertile_max
            FROM aq_tertiles aq
            LEFT JOIN covid_hosp ct ON aq.person_id = ct.person_id
            GROUP BY aq.tertile
            ORDER BY aq.tertile
        ", array_merge($cte['bindings'], [$pollutant]));
    }

    /**
     * County detail with both pollutant values.
     */
    public function countyDetail(string $fips): array|null
    {
        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                pm25.avg_value AS pm25_value,
                ozone.avg_value AS ozone_value,
                pm25.patient_count
            FROM gis.geographic_location gl
            LEFT JOIN gis.geography_summary pm25 ON gl.geographic_location_id = pm25.geographic_location_id AND pm25.exposure_type = 'pm25'
            LEFT JOIN gis.geography_summary ozone ON gl.geographic_location_id = ozone.geographic_location_id AND ozone.exposure_type = 'ozone'
            WHERE gl.geographic_code = ? AND gl.location_type = 'county'
        ", [$fips]);

        return $row ? (array) $row : null;
    }
}
```

- [ ] **Step 2: Write GisAirQualityController**

Create `backend/app/Http/Controllers/Api/V1/GisAirQualityController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\AirQualityAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisAirQualityController extends Controller
{
    public function __construct(
        private readonly AirQualityAnalysisService $airQualityService
    ) {}

    public function choropleth(Request $request): JsonResponse
    {
        $request->validate(['pollutant' => 'sometimes|in:pm25,ozone']);
        $data = $this->airQualityService->choropleth($request->input('pollutant', 'pm25'));
        return response()->json(['data' => $data]);
    }

    public function respiratoryOutcomes(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'pollutant' => 'sometimes|in:pm25,ozone',
        ]);

        $data = $this->airQualityService->respiratoryOutcomes(
            (int) $request->input('concept_id'),
            $request->input('pollutant', 'pm25')
        );

        return response()->json(['data' => $data]);
    }

    public function countyDetail(string $fips): JsonResponse
    {
        $data = $this->airQualityService->countyDetail($fips);

        if ($data === null) {
            return response()->json(['error' => 'County not found'], 404);
        }

        return response()->json(['data' => $data]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/AirQualityAnalysisService.php backend/app/Http/Controllers/Api/V1/GisAirQualityController.php
git commit -m "feat(gis): add air quality analysis service and controller"
```

---

### Task 17: Hospital Access Service & Controller

**Files:**
- Create: `backend/app/Services/GIS/HospitalAccessService.php`
- Create: `backend/app/Http/Controllers/Api/V1/GisHospitalController.php`

- [ ] **Step 1: Write HospitalAccessService**

Create `backend/app/Services/GIS/HospitalAccessService.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class HospitalAccessService
{
    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * All hospitals with coordinates for map markers.
     */
    public function mapData(): array
    {
        return DB::connection('gis')->select("
            SELECT
                h.hospital_id,
                h.cms_provider_id,
                h.hospital_name,
                h.city,
                h.county_fips,
                h.latitude,
                h.longitude,
                h.hospital_type,
                h.has_emergency,
                h.bed_count
            FROM gis.gis_hospital h
            ORDER BY h.bed_count DESC
        ");
    }

    /**
     * Access analysis: COVID outcomes by distance bin.
     */
    public function accessAnalysis(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            distance_bins AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS distance_km,
                    CASE
                        WHEN ee.value_as_number < 15 THEN '0-15 km'
                        WHEN ee.value_as_number < 30 THEN '15-30 km'
                        WHEN ee.value_as_number < 60 THEN '30-60 km'
                        WHEN ee.value_as_number < 100 THEN '60-100 km'
                        ELSE '100+ km'
                    END AS distance_bin,
                    CASE
                        WHEN ee.value_as_number < 15 THEN 1
                        WHEN ee.value_as_number < 30 THEN 2
                        WHEN ee.value_as_number < 60 THEN 3
                        WHEN ee.value_as_number < 100 THEN 4
                        ELSE 5
                    END AS bin_order
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = 'hospital_distance'
            )
            SELECT
                db.distance_bin,
                db.bin_order,
                COUNT(DISTINCT db.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT db.person_id), 0) * 100, 2) AS rate
            FROM distance_bins db
            LEFT JOIN {$cteTable} ct ON db.person_id = ct.person_id
            GROUP BY db.distance_bin, db.bin_order
            ORDER BY db.bin_order
        ", $cte['bindings']);
    }

    /**
     * Healthcare deserts: counties >60km average distance from hospital.
     */
    public function deserts(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS avg_distance_km,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'hospital_distance'
              AND gl.location_type = 'county'
              AND gs.avg_value > 60
            ORDER BY gs.avg_value DESC
        ");
    }
}
```

- [ ] **Step 2: Write GisHospitalController**

Create `backend/app/Http/Controllers/Api/V1/GisHospitalController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GIS\HospitalAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GisHospitalController extends Controller
{
    public function __construct(
        private readonly HospitalAccessService $hospitalService
    ) {}

    public function mapData(): JsonResponse
    {
        return response()->json(['data' => $this->hospitalService->mapData()]);
    }

    public function accessAnalysis(Request $request): JsonResponse
    {
        $request->validate([
            'concept_id' => 'required|integer',
            'metric' => 'sometimes|in:cases,hospitalizations,deaths',
        ]);

        $data = $this->hospitalService->accessAnalysis(
            (int) $request->input('concept_id'),
            $request->input('metric', 'cases')
        );

        return response()->json(['data' => $data]);
    }

    public function deserts(): JsonResponse
    {
        return response()->json(['data' => $this->hospitalService->deserts()]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/GIS/HospitalAccessService.php backend/app/Http/Controllers/Api/V1/GisHospitalController.php
git commit -m "feat(gis): add hospital access service and controller"
```

---

### Task 18: Spatial Stats Proxy & Routes Registration

**Files:**
- Create: `backend/app/Services/GIS/SpatialStatsProxy.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Write SpatialStatsProxy**

Create `backend/app/Services/GIS/SpatialStatsProxy.php`:

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpatialStatsProxy
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Proxy spatial statistics request to Python FastAPI service.
     */
    public function compute(array $payload): array
    {
        $analysisType = $payload['analysis_type'] ?? 'morans_i';
        $endpoint = match ($analysisType) {
            'morans_i' => '/gis-analytics/morans-i',
            'hotspots' => '/gis-analytics/hotspots',
            'regression' => '/gis-analytics/regression',
            'correlation' => '/gis-analytics/correlation',
            'drive_time' => '/gis-analytics/drive-time',
            default => throw new \InvalidArgumentException("Unknown analysis type: {$analysisType}"),
        };

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}{$endpoint}", $payload);

        if ($response->failed()) {
            Log::error('Spatial stats proxy failed', [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException("Spatial stats computation failed: {$response->status()}");
        }

        return $response->json();
    }
}
```

- [ ] **Step 2: Add GIS use-case routes to api.php**

In `backend/routes/api.php`, add the following route group after the existing `// ── GIS Epidemiology` block (after line 743):

```php
// ── GIS Use Case Layers (v3) ───────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::prefix('gis')->group(function () {
        // Geography & layers
        Route::get('/layers', [GisGeographyController::class, 'layers']);
        Route::get('/geography/counties', [GisGeographyController::class, 'counties']);
        Route::get('/geography/tracts', [GisGeographyController::class, 'tracts']);

        // SVI (Use Case 1)
        Route::prefix('svi')->group(function () {
            Route::get('/choropleth', [GisSviController::class, 'choropleth']);
            Route::get('/quartile-analysis', [GisSviController::class, 'quartileAnalysis']);
            Route::get('/theme-correlations', [GisSviController::class, 'themeCorrelations']);
            Route::get('/tract-detail/{fips}', [GisSviController::class, 'tractDetail']);
        });

        // RUCC (Use Case 2)
        Route::prefix('rucc')->group(function () {
            Route::get('/choropleth', [GisRuccController::class, 'choropleth']);
            Route::get('/outcome-comparison', [GisRuccController::class, 'outcomeComparison']);
            Route::get('/county-detail/{fips}', [GisRuccController::class, 'countyDetail']);
        });

        // Comorbidity (Use Case 3)
        Route::prefix('comorbidity')->group(function () {
            Route::get('/choropleth', [GisComorbidityController::class, 'choropleth']);
            Route::get('/hotspots', [GisComorbidityController::class, 'hotspots']);
            Route::get('/burden-score', [GisComorbidityController::class, 'burdenScore']);
        });

        // Air Quality (Use Case 4)
        Route::prefix('air-quality')->group(function () {
            Route::get('/choropleth', [GisAirQualityController::class, 'choropleth']);
            Route::get('/respiratory-outcomes', [GisAirQualityController::class, 'respiratoryOutcomes']);
            Route::get('/county-detail/{fips}', [GisAirQualityController::class, 'countyDetail']);
        });

        // Hospital Access (Use Case 5)
        Route::prefix('hospitals')->group(function () {
            Route::get('/map-data', [GisHospitalController::class, 'mapData']);
            Route::get('/access-analysis', [GisHospitalController::class, 'accessAnalysis']);
            Route::get('/deserts', [GisHospitalController::class, 'deserts']);
        });

        // Spatial statistics (proxy to Python)
        Route::post('/spatial-stats', function (\Illuminate\Http\Request $request) {
            $request->validate([
                'analysis_type' => 'required|in:morans_i,hotspots,regression,correlation,drive_time',
                'variable' => 'required|string',
                'geography_level' => 'required|in:census_tract,county',
            ]);
            $proxy = app(SpatialStatsProxy::class);
            return response()->json(['data' => $proxy->compute($request->all())]);
        });
    });
});
```

Add use statements at top of `backend/routes/api.php`:

```php
use App\Http\Controllers\Api\V1\GisGeographyController;
use App\Http\Controllers\Api\V1\GisSviController;
use App\Http\Controllers\Api\V1\GisRuccController;
use App\Http\Controllers\Api\V1\GisComorbidityController;
use App\Http\Controllers\Api\V1\GisAirQualityController;
use App\Http\Controllers\Api\V1\GisHospitalController;
use App\Services\GIS\SpatialStatsProxy;
```

- [ ] **Step 3: Verify routes register**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose exec php php artisan route:list --path=gis
```

Expected: All new GIS routes appear (layers, svi/*, rucc/*, comorbidity/*, air-quality/*, hospitals/*, spatial-stats).

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/GIS/SpatialStatsProxy.php backend/routes/api.php
git commit -m "feat(gis): add spatial stats proxy and register all GIS v3 routes"
```

---

### Task 18b: GIS ETL Controller (Admin-Only)

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/GisEtlController.php`
- Modify: `backend/routes/api.php` (add ETL routes)

- [ ] **Step 1: Write GisEtlController**

Create `backend/app/Http/Controllers/Api/V1/GisEtlController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;

class GisEtlController extends Controller
{
    private const SCRIPTS_DIR = '/home/smudoshi/Github/Parthenon/scripts/gis';

    private const VALID_STEPS = [
        'svi' => 'load_svi.py',
        'rucc' => 'load_rucc.py',
        'air-quality' => 'load_air_quality.py',
        'hospitals' => 'load_hospitals.py',
        'crosswalk' => 'load_crosswalk.py',
        'all' => 'load_all.py',
    ];

    /**
     * Trigger an ETL load step. Runs synchronously (these are admin-triggered, not user-facing).
     */
    public function load(Request $request, string $step): JsonResponse
    {
        if (!isset(self::VALID_STEPS[$step])) {
            return response()->json(['error' => "Invalid ETL step: {$step}"], 422);
        }

        $script = self::SCRIPTS_DIR . '/' . self::VALID_STEPS[$step];

        Log::info("GIS ETL triggered", ['step' => $step, 'script' => $script]);

        $result = Process::timeout(600)->run("python3 {$script}");

        if ($result->failed()) {
            Log::error("GIS ETL failed", ['step' => $step, 'output' => $result->errorOutput()]);
            return response()->json([
                'error' => 'ETL step failed',
                'step' => $step,
                'output' => $result->errorOutput(),
            ], 500);
        }

        return response()->json([
            'data' => [
                'step' => $step,
                'status' => 'completed',
                'output' => $result->output(),
            ],
        ]);
    }

    /**
     * Get ETL status / validation report.
     */
    public function status(): JsonResponse
    {
        $script = self::SCRIPTS_DIR . '/load_all.py';
        $result = Process::timeout(30)->run("python3 {$script} --step 5");

        return response()->json([
            'data' => [
                'status' => $result->successful() ? 'ok' : 'error',
                'output' => $result->output(),
            ],
        ]);
    }
}
```

- [ ] **Step 2: Add ETL routes to api.php**

Add inside the GIS Use Case Layers route group (Task 18), within the `gis` prefix:

```php
// ETL Admin (super-admin only)
Route::prefix('etl')->middleware('role:super-admin')->group(function () {
    Route::post('/load/{step}', [GisEtlController::class, 'load'])
        ->where('step', 'svi|rucc|air-quality|hospitals|crosswalk|all');
    Route::get('/status', [GisEtlController::class, 'status']);
});
```

Add use statement: `use App\Http\Controllers\Api\V1\GisEtlController;`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GisEtlController.php backend/routes/api.php
git commit -m "feat(gis): add admin-only ETL controller with load/status endpoints"
```

---

## End of Chunk 2

Chunk 2 adds 9 tasks (11-18b): the `gis` database connection, parameterized COVID cohort CTE service, 5 use-case service+controller pairs (SVI, RUCC, comorbidity, air quality, hospital access), geography service (includes layer metadata — consolidates spec's GisLayerService), spatial stats proxy, route registration, and admin ETL controller. All endpoints follow the `{data: T}` envelope convention and use parameterized queries.

---

## Chunk 3: Frontend Layer System (Types, Store, GisPage Refactor, Shared Components)

### Task 19: Install Recharts & Layer Type Definitions

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/features/gis/layers/types.ts`

- [ ] **Step 1: Install recharts**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
docker compose exec node sh -c "cd /app && npm install recharts --legacy-peer-deps"
```

- [ ] **Step 2: Write layer type definitions**

Create `frontend/src/features/gis/layers/types.ts`:

```typescript
import type { LucideIcon } from "lucide-react";
import type { Feature } from "geojson";

/** Data params passed to every layer's data hook. */
export interface LayerDataParams {
  conceptId: number | null;
  selectedFips: string | null;
  metric: string;
}

/** Standard result shape from a layer data hook. */
export interface LayerDataResult {
  choroplethData: LayerChoroplethItem[] | undefined;
  analysisData: unknown;
  detailData: unknown;
  isLoading: boolean;
}

/** Single item in a layer's choropleth dataset. */
export interface LayerChoroplethItem {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  latitude: number;
  longitude: number;
  value: number;
  patient_count: number;
  geometry: GeoJSON.Geometry | null;
  /** Extra fields per layer (category, burden_score, etc.) */
  [key: string]: unknown;
}

/** Props passed to a layer's map overlay component. */
export interface LayerMapProps {
  data: LayerChoroplethItem[];
  selectedFips: string | null;
  onRegionClick: (fips: string, name: string) => void;
  onRegionHover: (fips: string | null, name: string | null) => void;
  visible: boolean;
}

/** Props passed to a layer's analysis panel component. */
export interface LayerAnalysisProps {
  conceptId: number;
  metric: string;
}

/** Props passed to a layer's detail panel component. */
export interface LayerDetailProps {
  fips: string;
  conceptId: number;
}

/** Legend item for composite legend. */
export interface LegendItem {
  label: string;
  color: string;
  type: "gradient" | "category" | "circle";
  min?: number;
  max?: number;
  categories?: { label: string; color: string }[];
}

/** Tooltip entry returned by a layer for a hovered feature. */
export interface TooltipEntry {
  layerId: string;
  label: string;
  value: string | number;
  color: string;
}

/** The core layer interface. Every use case implements this. */
export interface GisLayer {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: LucideIcon;
  mapOverlay: React.FC<LayerMapProps>;
  legendItems: LegendItem[];
  getTooltipData: (feature: LayerChoroplethItem) => TooltipEntry[];
  analysisPanel: React.FC<LayerAnalysisProps>;
  detailPanel: React.FC<LayerDetailProps>;
  useLayerData: (params: LayerDataParams) => LayerDataResult;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/features/gis/layers/types.ts
git commit -m "feat(gis): install recharts and define layer type system"
```

---

### Task 20: Layer Store & Registry

**Files:**
- Create: `frontend/src/features/gis/stores/layerStore.ts`
- Create: `frontend/src/features/gis/layers/registry.ts`

- [ ] **Step 1: Write Zustand layer store**

Create `frontend/src/features/gis/stores/layerStore.ts`:

```typescript
import { create } from "zustand";

interface LayerState {
  activeLayers: Set<string>;
  selectedFips: string | null;
  selectedName: string | null;
  drawerOpen: boolean;
  suppressionThreshold: number;
}

interface LayerActions {
  toggleLayer: (id: string) => void;
  setSelectedRegion: (fips: string | null, name: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setSuppressionThreshold: (threshold: number) => void;
  isLayerActive: (id: string) => boolean;
}

export const useLayerStore = create<LayerState & LayerActions>((set, get) => ({
  activeLayers: new Set<string>(),
  selectedFips: null,
  selectedName: null,
  drawerOpen: false,
  suppressionThreshold: 0,

  toggleLayer: (id) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { activeLayers: next };
    }),

  setSelectedRegion: (fips, name) =>
    set({ selectedFips: fips, selectedName: name }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),

  setSuppressionThreshold: (threshold) =>
    set({ suppressionThreshold: threshold }),

  isLayerActive: (id) => get().activeLayers.has(id),
}));
```

- [ ] **Step 2: Write layer registry (placeholder — layers registered in Chunk 4)**

Create `frontend/src/features/gis/layers/registry.ts`:

```typescript
import type { GisLayer } from "./types";

/**
 * Central registry of all available GIS layers.
 * Each use-case layer is registered here after implementation.
 * Layers are rendered in registration order.
 */
const layers: GisLayer[] = [];

export function registerLayer(layer: GisLayer): void {
  if (!layers.find((l) => l.id === layer.id)) {
    layers.push(layer);
  }
}

export function getLayers(): readonly GisLayer[] {
  return layers;
}

export function getLayer(id: string): GisLayer | undefined {
  return layers.find((l) => l.id === id);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/stores/layerStore.ts frontend/src/features/gis/layers/registry.ts
git commit -m "feat(gis): add Zustand layer store and layer registry"
```

---

### Task 21: LayerPanel Component (Left Sidebar)

**Files:**
- Create: `frontend/src/features/gis/components/LayerPanel.tsx`

- [ ] **Step 1: Write LayerPanel**

Create `frontend/src/features/gis/components/LayerPanel.tsx`:

```typescript
import { useCallback } from "react";
import { Layers, ChevronRight } from "lucide-react";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { DiseaseSelector } from "./DiseaseSelector";

interface LayerPanelProps {
  selectedConceptId: number | null;
  onDiseaseSelect: (conceptId: number, name: string) => void;
}

export function LayerPanel({ selectedConceptId, onDiseaseSelect }: LayerPanelProps) {
  const { activeLayers, toggleLayer } = useLayerStore();
  const layers = getLayers();

  const handleToggle = useCallback(
    (id: string) => {
      toggleLayer(id);
    },
    [toggleLayer]
  );

  return (
    <div className="flex w-56 flex-col gap-3 overflow-y-auto border-r border-[#232328] bg-[#0E0E11] p-3">
      {/* Disease selector */}
      <DiseaseSelector
        selectedConceptId={selectedConceptId}
        onSelect={onDiseaseSelect}
      />

      {/* Layer toggles */}
      <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[#5A5650]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Analysis Layers
          </h3>
        </div>
        <div className="space-y-1">
          {layers.map((layer) => {
            const isActive = activeLayers.has(layer.id);
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => handleToggle(layer.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "border border-opacity-50 bg-opacity-10"
                    : "border border-transparent text-[#8A857D] hover:bg-[#232328]"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: `${layer.color}80`,
                        backgroundColor: `${layer.color}15`,
                        color: layer.color,
                      }
                    : undefined
                }
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{layer.name}</span>
                {isActive && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppression threshold (collapsed by default) */}
      {layers.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Privacy
          </h3>
          <p className="text-[10px] text-[#5A5650]">
            Suppression: off (synthetic data)
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/LayerPanel.tsx
git commit -m "feat(gis): add LayerPanel component with layer toggles"
```

---

### Task 22: AnalysisDrawer Component (Bottom Panel)

**Files:**
- Create: `frontend/src/features/gis/components/AnalysisDrawer.tsx`

- [ ] **Step 1: Write AnalysisDrawer**

Create `frontend/src/features/gis/components/AnalysisDrawer.tsx`:

```typescript
import { ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";

interface AnalysisDrawerProps {
  conceptId: number;
  metric: string;
}

export function AnalysisDrawer({ conceptId, metric }: AnalysisDrawerProps) {
  const { activeLayers, drawerOpen, setDrawerOpen } = useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  if (activeLayerList.length === 0) return null;

  return (
    <div
      className={`border-t border-[#232328] bg-[#0E0E11] transition-all duration-200 ${
        drawerOpen ? "h-52" : "h-8"
      }`}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        className="flex h-8 w-full items-center justify-between px-4 text-xs text-[#8A857D] hover:text-[#E8E4DC]"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>
            Analysis ({activeLayerList.length} layer
            {activeLayerList.length !== 1 ? "s" : ""})
          </span>
        </div>
        {drawerOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Panels */}
      {drawerOpen && (
        <div className="flex h-[calc(100%-2rem)] gap-3 overflow-x-auto px-4 pb-3">
          {activeLayerList.map((layer) => {
            const Panel = layer.analysisPanel;
            return (
              <div
                key={layer.id}
                className="min-w-[320px] flex-shrink-0 rounded-lg border bg-[#141418] p-3"
                style={{ borderColor: `${layer.color}40` }}
              >
                <h4
                  className="mb-2 text-xs font-semibold"
                  style={{ color: layer.color }}
                >
                  {layer.name}
                </h4>
                <Panel conceptId={conceptId} metric={metric} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/AnalysisDrawer.tsx
git commit -m "feat(gis): add collapsible AnalysisDrawer component"
```

---

### Task 23: ContextPanel Component (Right Sidebar)

**Files:**
- Create: `frontend/src/features/gis/components/ContextPanel.tsx`

- [ ] **Step 1: Write ContextPanel**

Create `frontend/src/features/gis/components/ContextPanel.tsx`:

```typescript
import { X, FlaskConical, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";

interface ContextPanelProps {
  conceptId: number;
  diseaseName: string;
}

export function ContextPanel({ conceptId, diseaseName }: ContextPanelProps) {
  const navigate = useNavigate();
  const { activeLayers, selectedFips, selectedName, setSelectedRegion } =
    useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  return (
    <div className="flex w-56 flex-col gap-3 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-3">
      {/* Disease info */}
      <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
        <h3 className="text-xs font-semibold text-[#C9A227]">{diseaseName}</h3>
        <p className="mt-1 text-[10px] text-[#5A5650]">
          {activeLayerList.length} analysis layer
          {activeLayerList.length !== 1 ? "s" : ""} active
        </p>
      </div>

      {/* Selected region detail panels */}
      {selectedFips && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#E8E4DC]">
              {selectedName ?? selectedFips}
            </h3>
            <button
              onClick={() => setSelectedRegion(null, null)}
              className="rounded p-0.5 text-[#5A5650] hover:text-[#E8E4DC]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {activeLayerList.map((layer) => {
            const DetailPanel = layer.detailPanel;
            return (
              <div
                key={layer.id}
                className="rounded-lg border bg-[#141418] p-3"
                style={{ borderColor: `${layer.color}40` }}
              >
                <h4
                  className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: layer.color }}
                >
                  {layer.name}
                </h4>
                <DetailPanel fips={selectedFips} conceptId={conceptId} />
              </div>
            );
          })}

          {/* Research actions */}
          <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
              Research Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() =>
                  navigate(
                    `/studies/create?region=${selectedFips}&region_name=${encodeURIComponent(selectedName ?? "")}`
                  )
                }
                className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#C9A227] hover:border-[#C9A227]/50"
              >
                <FlaskConical className="h-3 w-3" />
                Create Study
              </button>
              <button
                onClick={() =>
                  navigate(`/cohort-definitions?region=${selectedFips}`)
                }
                className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#2DD4BF] hover:border-[#2DD4BF]/50"
              >
                <Search className="h-3 w-3" />
                Browse Cohorts
              </button>
            </div>
          </div>
        </>
      )}

      {/* Prompt when no region selected */}
      {!selectedFips && activeLayerList.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#141418] p-3 text-center">
          <p className="text-xs text-[#5A5650]">
            Click a region on the map to see layer details
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/ContextPanel.tsx
git commit -m "feat(gis): add ContextPanel component with layer detail panels"
```

---

### Task 24: CompositeLegend Component

**Files:**
- Create: `frontend/src/features/gis/components/CompositeLegend.tsx`

- [ ] **Step 1: Write CompositeLegend**

Create `frontend/src/features/gis/components/CompositeLegend.tsx`:

```typescript
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";

export function CompositeLegend() {
  const { activeLayers } = useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  if (activeLayerList.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg border border-[#232328] bg-[#0E0E11]/90 p-3 backdrop-blur-sm">
      {activeLayerList.map((layer) => (
        <div key={layer.id} className="mb-2 last:mb-0">
          <h4
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: layer.color }}
          >
            {layer.name}
          </h4>
          <div className="space-y-0.5">
            {layer.legendItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-[#8A857D]">
                {item.type === "gradient" && (
                  <div
                    className="h-2 w-8 rounded-sm"
                    style={{
                      background: `linear-gradient(to right, ${layer.color}30, ${layer.color})`,
                    }}
                  />
                )}
                {item.type === "category" && (
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                {item.type === "circle" && (
                  <div
                    className="h-2 w-2 rounded-full border"
                    style={{ borderColor: item.color }}
                  />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/CompositeLegend.tsx
git commit -m "feat(gis): add CompositeLegend component for multi-layer map legend"
```

---

### Task 25: Refactor GisPage to Layered Dashboard Layout

**Files:**
- Modify: `frontend/src/features/gis/pages/GisPage.tsx`

- [ ] **Step 1: Rewrite GisPage with 3-panel + drawer layout**

Replace the entire content of `frontend/src/features/gis/pages/GisPage.tsx` with:

```typescript
import { useState, useCallback, useMemo } from "react";
import { Globe, AlertCircle, RefreshCw } from "lucide-react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { LayerPanel } from "../components/LayerPanel";
import { ContextPanel } from "../components/ContextPanel";
import { AnalysisDrawer } from "../components/AnalysisDrawer";
import { CompositeLegend } from "../components/CompositeLegend";
import { DiseaseSummaryBar } from "../components/DiseaseSummaryBar";
import { useMapViewport } from "../hooks/useMapViewport";
import { HelpButton } from "@/features/help";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function GisPage() {
  const { viewport, onViewportChange, resetViewport } = useMapViewport();
  const { activeLayers, selectedFips, setSelectedRegion } = useLayerStore();
  const layers = getLayers();

  // Disease selection
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
  const [selectedDiseaseName, setSelectedDiseaseName] = useState<string | null>(null);
  const [cdmMetric, setCdmMetric] = useState("cases");

  const handleDiseaseSelect = useCallback((conceptId: number, name: string) => {
    setSelectedConceptId(conceptId);
    setSelectedDiseaseName(name);
    setSelectedRegion(null, null);
  }, [setSelectedRegion]);

  const handleRegionClick = useCallback(
    (fips: string, name: string) => {
      setSelectedRegion(fips, name);
    },
    [setSelectedRegion]
  );

  const handleRegionHover = useCallback(
    (_fips: string | null, _name: string | null) => {
      // Future: tooltip aggregation
    },
    []
  );

  // Collect deck.gl layers from all active use-case layers
  const activeLayerList = useMemo(
    () => layers.filter((l) => activeLayers.has(l.id)),
    [layers, activeLayers]
  );

  const hasActiveLayers = activeLayerList.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h1 className="text-lg font-semibold text-[#E8E4DC]">
              GIS Explorer{selectedDiseaseName ? ` — ${selectedDiseaseName}` : ""}
            </h1>
            <p className="text-xs text-[#5A5650]">
              {hasActiveLayers
                ? `${activeLayerList.length} analysis layer${activeLayerList.length !== 1 ? "s" : ""} active`
                : selectedDiseaseName
                  ? "Enable analysis layers in the left panel"
                  : "Select a disease to begin spatial analysis"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetViewport}
            className="flex items-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-xs text-[#8A857D] hover:border-[#5A5650]"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <HelpButton helpKey="gis" />
        </div>
      </div>

      {/* Disease summary bar */}
      {selectedConceptId && (
        <div className="border-b border-[#232328] bg-[#0E0E11] px-6 py-2">
          <DiseaseSummaryBar conceptId={selectedConceptId} />
        </div>
      )}

      {/* Main 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Layer controls */}
        <LayerPanel
          selectedConceptId={selectedConceptId}
          onDiseaseSelect={handleDiseaseSelect}
        />

        {/* Center: Map + drawer */}
        <div className="flex flex-1 flex-col">
          <div className="relative flex-1">
            <DeckGL
              viewState={viewport}
              onViewStateChange={((params: { viewState: typeof viewport }) =>
                onViewportChange({ viewState: params.viewState })) as React.ComponentProps<typeof DeckGL>["onViewStateChange"]}
              layers={[]}
              controller
              getCursor={({ isHovering }: { isHovering: boolean }) =>
                isHovering ? "pointer" : "grab"
              }
            >
              <Map mapStyle={MAP_STYLE} />
            </DeckGL>

            {/* Composite legend overlay */}
            <CompositeLegend />
          </div>

          {/* Bottom: Analysis drawer */}
          {selectedConceptId && hasActiveLayers && (
            <AnalysisDrawer conceptId={selectedConceptId} metric={cdmMetric} />
          )}
        </div>

        {/* Right: Context panel */}
        {selectedConceptId && selectedDiseaseName && (
          <ContextPanel
            conceptId={selectedConceptId}
            diseaseName={selectedDiseaseName}
          />
        )}
      </div>
    </div>
  );
}
```

> **Note:** This refactored GisPage uses the new layer system but renders no map overlays yet (empty `layers={[]}` on DeckGL). Chunk 4 wires each layer's `mapOverlay` component into the DeckGL layer array. The old GisMap component is no longer used — deck.gl is rendered inline for direct access to the layer array.

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose exec node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1 | head -30"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/pages/GisPage.tsx
git commit -m "refactor(gis): rewrite GisPage with 3-panel layered dashboard layout"
```

---

## End of Chunk 3

Chunk 3 adds 7 tasks (19-25): Recharts installation, layer type system (`GisLayer` interface), Zustand layer store, layer registry, 3 shared UI components (LayerPanel, AnalysisDrawer, ContextPanel, CompositeLegend), and the GisPage refactor to the 3-panel + drawer layout. The page compiles but renders no layer overlays — those are wired in Chunk 4.

---

## Chunk 4: Use Case Layer Implementations

Each task creates one complete layer module (api.ts, hook, map overlay, analysis panel, detail panel, index.ts) and registers it.

### Task 26: SVI Layer — API & Hook

**Files:**
- Create: `frontend/src/features/gis/layers/svi/api.ts`
- Create: `frontend/src/features/gis/layers/svi/useSviData.ts`

- [ ] **Step 1: Write SVI API client**

Create `frontend/src/features/gis/layers/svi/api.ts`:

```typescript
import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";

export interface SviQuartileItem {
  quartile: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
  quartile_min: number;
  quartile_max: number;
}

export interface SviTractDetail {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  population: number;
  svi_overall: number | null;
  svi_theme1: number | null;
  svi_theme2: number | null;
  svi_theme3: number | null;
  svi_theme4: number | null;
}

export async function fetchSviChoropleth(
  level: string = "county",
  theme: string = "overall"
): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/svi/choropleth", {
    params: { level, theme },
  });
  return data.data;
}

export async function fetchSviQuartileAnalysis(
  conceptId: number,
  metric: string = "cases"
): Promise<SviQuartileItem[]> {
  const { data } = await apiClient.get("/gis/svi/quartile-analysis", {
    params: { concept_id: conceptId, metric },
  });
  return data.data;
}

export async function fetchSviThemeCorrelations(
  conceptId: number
): Promise<Record<string, unknown[]>> {
  const { data } = await apiClient.get("/gis/svi/theme-correlations", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchSviTractDetail(
  fips: string
): Promise<SviTractDetail> {
  const { data } = await apiClient.get(`/gis/svi/tract-detail/${fips}`);
  return data.data;
}
```

- [ ] **Step 2: Write SVI data hook**

Create `frontend/src/features/gis/layers/svi/useSviData.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import {
  fetchSviChoropleth,
  fetchSviQuartileAnalysis,
  fetchSviTractDetail,
} from "./api";

export function useSviData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "svi", "choropleth"],
    queryFn: () => fetchSviChoropleth("county", "overall"),
    staleTime: 5 * 60_000,
  });

  const quartiles = useQuery({
    queryKey: ["gis", "svi", "quartiles", conceptId],
    queryFn: () => fetchSviQuartileAnalysis(conceptId!, "cases"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  const detail = useQuery({
    queryKey: ["gis", "svi", "tract-detail", selectedFips],
    queryFn: () => fetchSviTractDetail(selectedFips!),
    enabled: selectedFips !== null,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: quartiles.data,
    detailData: detail.data,
    isLoading: choropleth.isLoading,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/layers/svi/api.ts frontend/src/features/gis/layers/svi/useSviData.ts
git commit -m "feat(gis): add SVI layer API client and data hook"
```

---

### Task 27: SVI Layer — Components & Registration

**Files:**
- Create: `frontend/src/features/gis/layers/svi/SviMapOverlay.tsx`
- Create: `frontend/src/features/gis/layers/svi/SviAnalysisPanel.tsx`
- Create: `frontend/src/features/gis/layers/svi/SviDetailPanel.tsx`
- Create: `frontend/src/features/gis/layers/svi/index.ts`

- [ ] **Step 1: Write SviMapOverlay**

Create `frontend/src/features/gis/layers/svi/SviMapOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function sviToColor(value: number): [number, number, number, number] {
  // Red gradient: low SVI = light, high SVI = dark red
  const t = Math.min(value, 1);
  return [
    Math.round(60 + t * 172),  // 60 → 232
    Math.round(60 - t * 30),   // 60 → 30
    Math.round(70 - t * 3),    // 70 → 67
    Math.round(80 + t * 175),
  ];
}

export function SviMapOverlay({
  data,
  selectedFips,
  onRegionClick,
  onRegionHover,
  visible,
}: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data
        .filter((d) => d.geometry)
        .map((d) => ({
          type: "Feature" as const,
          geometry: d.geometry!,
          properties: { fips: d.fips, name: d.location_name, value: d.value },
        })),
    };

    return new GeoJsonLayer({
      id: "svi-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (f: unknown) => {
        const feat = f as { properties: { value: number } };
        return sviToColor(feat.properties.value);
      },
      getLineColor: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips
          ? [45, 212, 191, 255]
          : [80, 80, 85, 100];
      },
      getLineWidth: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name);
        else onRegionHover(null, null);
      },
      updateTriggers: {
        getLineColor: [selectedFips],
        getLineWidth: [selectedFips],
      },
    });
  }, [data, selectedFips, onRegionClick, onRegionHover, visible]);

  return layer;
}
```

- [ ] **Step 2: Write SviAnalysisPanel**

Create `frontend/src/features/gis/layers/svi/SviAnalysisPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchSviQuartileAnalysis } from "./api";
import type { LayerAnalysisProps } from "../types";

export function SviAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "svi", "quartiles", conceptId, metric],
    queryFn: () => fetchSviQuartileAnalysis(conceptId, metric),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <p className="text-xs text-[#5A5650]">Loading...</p>;
  }

  if (!data?.length) {
    return <p className="text-xs text-[#5A5650]">No data available</p>;
  }

  const chartData = data.map((d) => ({
    name: `Q${d.quartile}`,
    rate: d.rate,
    patients: d.total_patients,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141418",
            border: "1px solid #232328",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Bar dataKey="rate" fill="#E85A6B" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Write SviDetailPanel**

Create `frontend/src/features/gis/layers/svi/SviDetailPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchSviTractDetail } from "./api";
import type { LayerDetailProps } from "../types";

const THEME_LABELS = [
  "Socioeconomic Status",
  "Household Composition",
  "Minority Status",
  "Housing & Transportation",
];

export function SviDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "svi", "detail", fips],
    queryFn: () => fetchSviTractDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data) return <p className="text-xs text-[#5A5650]">No SVI data</p>;

  const themes = [data.svi_theme1, data.svi_theme2, data.svi_theme3, data.svi_theme4];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8A857D]">Overall SVI</span>
        <span className="font-medium text-[#E8E4DC]">
          {data.svi_overall !== null ? (data.svi_overall * 100).toFixed(0) + "%" : "—"}
        </span>
      </div>
      {themes.map((val, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#5A5650]">{THEME_LABELS[i]}</span>
            <span className="text-[#8A857D]">
              {val !== null ? (val * 100).toFixed(0) + "%" : "—"}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#232328]">
            <div
              className="h-1 rounded-full bg-[#E85A6B]"
              style={{ width: `${(val ?? 0) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write SVI layer index (registration)**

Create `frontend/src/features/gis/layers/svi/index.ts`:

```typescript
import { Shield } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { SviMapOverlay } from "./SviMapOverlay";
import { SviAnalysisPanel } from "./SviAnalysisPanel";
import { SviDetailPanel } from "./SviDetailPanel";
import { useSviData } from "./useSviData";
import { registerLayer } from "../registry";

const sviLayer: GisLayer = {
  id: "svi",
  name: "Social Vulnerability",
  description: "CDC/ATSDR SVI by census tract",
  color: "#E85A6B",
  icon: Shield,
  mapOverlay: SviMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Low vulnerability", color: "#E85A6B30", type: "gradient" },
    { label: "High vulnerability", color: "#E85A6B", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "svi",
      label: "SVI",
      value: feature.value !== undefined ? `${(Number(feature.value) * 100).toFixed(0)}%` : "—",
      color: "#E85A6B",
    },
  ],
  analysisPanel: SviAnalysisPanel,
  detailPanel: SviDetailPanel,
  useLayerData: useSviData,
};

registerLayer(sviLayer);

export default sviLayer;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/gis/layers/svi/
git commit -m "feat(gis): implement SVI layer (map overlay, analysis panel, detail panel)"
```

---

### Task 28: RUCC Layer (Complete Module)

**Files:**
- Create: `frontend/src/features/gis/layers/rucc/api.ts`
- Create: `frontend/src/features/gis/layers/rucc/useRuccData.ts`
- Create: `frontend/src/features/gis/layers/rucc/RuccMapOverlay.tsx`
- Create: `frontend/src/features/gis/layers/rucc/RuccAnalysisPanel.tsx`
- Create: `frontend/src/features/gis/layers/rucc/RuccDetailPanel.tsx`
- Create: `frontend/src/features/gis/layers/rucc/index.ts`

- [ ] **Step 1: Write RUCC api.ts**

Create `frontend/src/features/gis/layers/rucc/api.ts`:

```typescript
import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";

export interface RuccChoroplethItem extends LayerChoroplethItem {
  rucc_code: number;
  category: "metro" | "micro" | "rural";
}

export interface RuccOutcomeItem {
  category: string;
  total_patients: number;
  outcome_count: number;
  rate: number;
}

export interface RuccCountyDetail {
  location_name: string;
  fips: string;
  population: number;
  rucc_code: number;
  rucc_label: string;
  category: string;
  patient_count: number;
}

export async function fetchRuccChoropleth(): Promise<RuccChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/rucc/choropleth");
  return data.data;
}

export async function fetchRuccOutcomeComparison(
  conceptId: number,
  metric: string = "cases"
): Promise<RuccOutcomeItem[]> {
  const { data } = await apiClient.get("/gis/rucc/outcome-comparison", {
    params: { concept_id: conceptId, metric },
  });
  return data.data;
}

export async function fetchRuccCountyDetail(
  fips: string
): Promise<RuccCountyDetail> {
  const { data } = await apiClient.get(`/gis/rucc/county-detail/${fips}`);
  return data.data;
}
```

- [ ] **Step 2: Write RUCC hook, components, and index**

Create `frontend/src/features/gis/layers/rucc/useRuccData.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchRuccChoropleth, fetchRuccOutcomeComparison, fetchRuccCountyDetail } from "./api";

export function useRuccData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "rucc", "choropleth"],
    queryFn: fetchRuccChoropleth,
    staleTime: 5 * 60_000,
  });

  const outcomes = useQuery({
    queryKey: ["gis", "rucc", "outcomes", conceptId],
    queryFn: () => fetchRuccOutcomeComparison(conceptId!, "cases"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  const detail = useQuery({
    queryKey: ["gis", "rucc", "detail", selectedFips],
    queryFn: () => fetchRuccCountyDetail(selectedFips!),
    enabled: selectedFips !== null,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: outcomes.data,
    detailData: detail.data,
    isLoading: choropleth.isLoading,
  };
}
```

Create `frontend/src/features/gis/layers/rucc/RuccMapOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

const CATEGORY_COLORS: Record<string, [number, number, number, number]> = {
  metro: [59, 130, 246, 180],   // blue
  micro: [139, 92, 246, 180],   // purple
  rural: [245, 158, 11, 180],   // amber
};

export function RuccMapOverlay({ data, selectedFips, onRegionClick, onRegionHover, visible }: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data
        .filter((d) => d.geometry)
        .map((d) => ({
          type: "Feature" as const,
          geometry: d.geometry!,
          properties: { fips: d.fips, name: d.location_name, category: (d as { category?: string }).category ?? "metro" },
        })),
    };

    return new GeoJsonLayer({
      id: "rucc-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (f: unknown) => {
        const feat = f as { properties: { category: string } };
        return CATEGORY_COLORS[feat.properties.category] ?? [80, 80, 85, 100];
      },
      getLineColor: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? [45, 212, 191, 255] : [80, 80, 85, 100];
      },
      getLineWidth: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name);
        else onRegionHover(null, null);
      },
      updateTriggers: { getLineColor: [selectedFips], getLineWidth: [selectedFips] },
    });
  }, [data, selectedFips, onRegionClick, onRegionHover, visible]);

  return layer;
}
```

Create `frontend/src/features/gis/layers/rucc/RuccAnalysisPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchRuccOutcomeComparison } from "./api";
import type { LayerAnalysisProps } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  metro: "#3B82F6",
  micro: "#8B5CF6",
  rural: "#F59E0B",
};

export function RuccAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "outcomes", conceptId, metric],
    queryFn: () => fetchRuccOutcomeComparison(conceptId, metric),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;

  const chartData = data.map((d) => ({
    name: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    rate: d.rate,
    fill: CATEGORY_COLORS[d.category] ?? "#8A857D",
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => (
            <rect key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

Create `frontend/src/features/gis/layers/rucc/RuccDetailPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchRuccCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";

export function RuccDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "detail", fips],
    queryFn: () => fetchRuccCountyDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data) return <p className="text-xs text-[#5A5650]">No RUCC data</p>;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-[#8A857D]">RUCC Code</span>
        <span className="font-medium text-[#E8E4DC]">{data.rucc_code}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8A857D]">Classification</span>
        <span className="font-medium text-[#E8E4DC]">{data.rucc_label}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8A857D]">Category</span>
        <span className="font-medium capitalize text-[#E8E4DC]">{data.category}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8A857D]">Patients</span>
        <span className="font-medium text-[#E8E4DC]">{data.patient_count?.toLocaleString()}</span>
      </div>
    </div>
  );
}
```

Create `frontend/src/features/gis/layers/rucc/index.ts`:

```typescript
import { MapPin } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { RuccMapOverlay } from "./RuccMapOverlay";
import { RuccAnalysisPanel } from "./RuccAnalysisPanel";
import { RuccDetailPanel } from "./RuccDetailPanel";
import { useRuccData } from "./useRuccData";
import { registerLayer } from "../registry";

const ruccLayer: GisLayer = {
  id: "rucc",
  name: "Urban-Rural",
  description: "USDA Rural-Urban Continuum Codes",
  color: "#8B5CF6",
  icon: MapPin,
  mapOverlay: RuccMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Metro", color: "#3B82F6", type: "category" },
    { label: "Micropolitan", color: "#8B5CF6", type: "category" },
    { label: "Rural", color: "#F59E0B", type: "category" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "rucc",
      label: "Classification",
      value: String((feature as { category?: string }).category ?? "—"),
      color: "#8B5CF6",
    },
  ],
  analysisPanel: RuccAnalysisPanel,
  detailPanel: RuccDetailPanel,
  useLayerData: useRuccData,
};

registerLayer(ruccLayer);

export default ruccLayer;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/layers/rucc/
git commit -m "feat(gis): implement RUCC layer (metro/micro/rural classification)"
```

---

### Task 29: Comorbidity Layer (Complete Module)

**Files:**
- Create: `frontend/src/features/gis/layers/comorbidity/api.ts`
- Create: `frontend/src/features/gis/layers/comorbidity/useComorbidityData.ts`
- Create: `frontend/src/features/gis/layers/comorbidity/ComorbidityMapOverlay.tsx`
- Create: `frontend/src/features/gis/layers/comorbidity/ComorbidityAnalysisPanel.tsx`
- Create: `frontend/src/features/gis/layers/comorbidity/ComorbidityDetailPanel.tsx`
- Create: `frontend/src/features/gis/layers/comorbidity/index.ts`

- [ ] **Step 1: Write comorbidity api.ts**

Create `frontend/src/features/gis/layers/comorbidity/api.ts`:

```typescript
import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";

export interface BurdenBucket {
  bucket: number;
  county_count: number;
  bucket_min: number;
  bucket_max: number;
  total_patients: number;
}

export async function fetchComorbidityChoropleth(): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/comorbidity/choropleth");
  return data.data;
}

export async function fetchComorbidityHotspots(conceptId: number): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/comorbidity/hotspots", { params: { concept_id: conceptId } });
  return data.data;
}

export async function fetchBurdenScore(): Promise<BurdenBucket[]> {
  const { data } = await apiClient.get("/gis/comorbidity/burden-score");
  return data.data;
}
```

- [ ] **Step 2: Write hook, components, index**

Create `frontend/src/features/gis/layers/comorbidity/useComorbidityData.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchComorbidityChoropleth, fetchBurdenScore } from "./api";

export function useComorbidityData(params: LayerDataParams): LayerDataResult {
  const choropleth = useQuery({
    queryKey: ["gis", "comorbidity", "choropleth"],
    queryFn: fetchComorbidityChoropleth,
    staleTime: 5 * 60_000,
  });

  const burden = useQuery({
    queryKey: ["gis", "comorbidity", "burden"],
    queryFn: fetchBurdenScore,
    staleTime: 5 * 60_000,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: burden.data,
    detailData: null,
    isLoading: choropleth.isLoading,
  };
}
```

Create `frontend/src/features/gis/layers/comorbidity/ComorbidityMapOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function burdenToColor(value: number): [number, number, number, number] {
  const t = Math.min(value / 3, 1);
  return [
    Math.round(60 + t * 185),
    Math.round(60 + t * 98),
    Math.round(70 - t * 59),
    Math.round(80 + t * 175),
  ];
}

export function ComorbidityMapOverlay({ data, selectedFips, onRegionClick, onRegionHover, visible }: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data.filter((d) => d.geometry).map((d) => ({
        type: "Feature" as const,
        geometry: d.geometry!,
        properties: { fips: d.fips, name: d.location_name, value: d.value },
      })),
    };

    return new GeoJsonLayer({
      id: "comorbidity-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (f: unknown) => {
        const feat = f as { properties: { value: number } };
        return burdenToColor(feat.properties.value);
      },
      getLineColor: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? [45, 212, 191, 255] : [80, 80, 85, 100];
      },
      getLineWidth: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name);
        else onRegionHover(null, null);
      },
      updateTriggers: { getLineColor: [selectedFips], getLineWidth: [selectedFips] },
    });
  }, [data, selectedFips, onRegionClick, onRegionHover, visible]);

  return layer;
}
```

Create `frontend/src/features/gis/layers/comorbidity/ComorbidityAnalysisPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchBurdenScore } from "./api";
import type { LayerAnalysisProps } from "../types";

export function ComorbidityAnalysisPanel(_props: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "comorbidity", "burden"],
    queryFn: fetchBurdenScore,
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;

  const chartData = data.map((d) => ({
    name: `${d.bucket_min.toFixed(1)}-${d.bucket_max.toFixed(1)}`,
    counties: d.county_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 9 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="counties" fill="#F59E0B" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

Create `frontend/src/features/gis/layers/comorbidity/ComorbidityDetailPanel.tsx`:

```typescript
import type { LayerDetailProps } from "../types";

export function ComorbidityDetailPanel({ fips }: LayerDetailProps) {
  // Detail panel uses hotspot data from parent — simplified for now
  return (
    <div className="text-xs text-[#8A857D]">
      <p>Comorbidity data for {fips}</p>
      <p className="mt-1 text-[10px] text-[#5A5650]">
        DM + HTN + Obesity burden score
      </p>
    </div>
  );
}
```

Create `frontend/src/features/gis/layers/comorbidity/index.ts`:

```typescript
import { Activity } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { ComorbidityMapOverlay } from "./ComorbidityMapOverlay";
import { ComorbidityAnalysisPanel } from "./ComorbidityAnalysisPanel";
import { ComorbidityDetailPanel } from "./ComorbidityDetailPanel";
import { useComorbidityData } from "./useComorbidityData";
import { registerLayer } from "../registry";

const comorbidityLayer: GisLayer = {
  id: "comorbidity",
  name: "Comorbidity Burden",
  description: "DM, HTN, obesity clustering",
  color: "#F59E0B",
  icon: Activity,
  mapOverlay: ComorbidityMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Low burden (0)", color: "#F59E0B30", type: "gradient" },
    { label: "High burden (3)", color: "#F59E0B", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    { layerId: "comorbidity", label: "Burden", value: Number(feature.value).toFixed(1), color: "#F59E0B" },
  ],
  analysisPanel: ComorbidityAnalysisPanel,
  detailPanel: ComorbidityDetailPanel,
  useLayerData: useComorbidityData,
};

registerLayer(comorbidityLayer);
export default comorbidityLayer;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/layers/comorbidity/
git commit -m "feat(gis): implement comorbidity layer (burden scoring, histogram)"
```

---

### Task 30: Air Quality Layer (Complete Module)

**Files:**
- Create: `frontend/src/features/gis/layers/air-quality/api.ts`
- Create: `frontend/src/features/gis/layers/air-quality/useAirQualityData.ts`
- Create: `frontend/src/features/gis/layers/air-quality/AirQualityMapOverlay.tsx`
- Create: `frontend/src/features/gis/layers/air-quality/AirQualityAnalysisPanel.tsx`
- Create: `frontend/src/features/gis/layers/air-quality/AirQualityDetailPanel.tsx`
- Create: `frontend/src/features/gis/layers/air-quality/index.ts`

- [ ] **Step 1: Write air quality api.ts and hook**

Create `frontend/src/features/gis/layers/air-quality/api.ts`:

```typescript
import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";

export interface AqRespiratoryItem {
  tertile: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
  tertile_min: number;
  tertile_max: number;
}

export interface AqCountyDetail {
  location_name: string;
  fips: string;
  population: number;
  pm25_value: number | null;
  ozone_value: number | null;
  patient_count: number;
}

export async function fetchAqChoropleth(pollutant: string = "pm25"): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/air-quality/choropleth", { params: { pollutant } });
  return data.data;
}

export async function fetchAqRespiratoryOutcomes(conceptId: number, pollutant: string = "pm25"): Promise<AqRespiratoryItem[]> {
  const { data } = await apiClient.get("/gis/air-quality/respiratory-outcomes", { params: { concept_id: conceptId, pollutant } });
  return data.data;
}

export async function fetchAqCountyDetail(fips: string): Promise<AqCountyDetail> {
  const { data } = await apiClient.get(`/gis/air-quality/county-detail/${fips}`);
  return data.data;
}
```

Create `frontend/src/features/gis/layers/air-quality/useAirQualityData.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchAqChoropleth, fetchAqRespiratoryOutcomes, fetchAqCountyDetail } from "./api";

export function useAirQualityData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "aq", "choropleth"],
    queryFn: () => fetchAqChoropleth("pm25"),
    staleTime: 5 * 60_000,
  });

  const respiratory = useQuery({
    queryKey: ["gis", "aq", "respiratory", conceptId],
    queryFn: () => fetchAqRespiratoryOutcomes(conceptId!, "pm25"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  const detail = useQuery({
    queryKey: ["gis", "aq", "detail", selectedFips],
    queryFn: () => fetchAqCountyDetail(selectedFips!),
    enabled: selectedFips !== null,
  });

  return { choroplethData: choropleth.data, analysisData: respiratory.data, detailData: detail.data, isLoading: choropleth.isLoading };
}
```

- [ ] **Step 2: Write air quality components and index**

Create `frontend/src/features/gis/layers/air-quality/AirQualityMapOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function aqToColor(value: number): [number, number, number, number] {
  // Green (good) → Red (bad): 0-50 ug/m3
  const t = Math.min(value / 35, 1);
  return [
    Math.round(16 + t * 216),
    Math.round(185 - t * 95),
    Math.round(129 - t * 62),
    Math.round(80 + t * 175),
  ];
}

export function AirQualityMapOverlay({ data, selectedFips, onRegionClick, onRegionHover, visible }: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data.filter((d) => d.geometry).map((d) => ({
        type: "Feature" as const,
        geometry: d.geometry!,
        properties: { fips: d.fips, name: d.location_name, value: d.value },
      })),
    };
    return new GeoJsonLayer({
      id: "aq-choropleth",
      data: geojson, pickable: true, stroked: true, filled: true,
      getFillColor: (f: unknown) => aqToColor((f as { properties: { value: number } }).properties.value),
      getLineColor: (f: unknown) => (f as { properties: { fips: string } }).properties.fips === selectedFips ? [45, 212, 191, 255] : [80, 80, 85, 100],
      getLineWidth: (f: unknown) => (f as { properties: { fips: string } }).properties.fips === selectedFips ? 3 : 1,
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => { if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name); },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => { if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name); else onRegionHover(null, null); },
      updateTriggers: { getLineColor: [selectedFips], getLineWidth: [selectedFips] },
    });
  }, [data, selectedFips, onRegionClick, onRegionHover, visible]);
  return layer;
}
```

Create `frontend/src/features/gis/layers/air-quality/AirQualityAnalysisPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAqRespiratoryOutcomes } from "./api";
import type { LayerAnalysisProps } from "../types";

export function AirQualityAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "respiratory", conceptId, metric],
    queryFn: () => fetchAqRespiratoryOutcomes(conceptId, "pm25"),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;
  const chartData = data.map((d) => ({ name: `T${d.tertile}`, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="#10B981" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

Create `frontend/src/features/gis/layers/air-quality/AirQualityDetailPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchAqCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";

export function AirQualityDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "detail", fips],
    queryFn: () => fetchAqCountyDetail(fips),
  });
  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data) return <p className="text-xs text-[#5A5650]">No air quality data</p>;
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-[#8A857D]">PM2.5</span>
        <span className="font-medium text-[#E8E4DC]">{data.pm25_value?.toFixed(1) ?? "—"} µg/m³</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8A857D]">Ozone</span>
        <span className="font-medium text-[#E8E4DC]">{data.ozone_value?.toFixed(1) ?? "—"} ppb</span>
      </div>
    </div>
  );
}
```

Create `frontend/src/features/gis/layers/air-quality/index.ts`:

```typescript
import { Wind } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { AirQualityMapOverlay } from "./AirQualityMapOverlay";
import { AirQualityAnalysisPanel } from "./AirQualityAnalysisPanel";
import { AirQualityDetailPanel } from "./AirQualityDetailPanel";
import { useAirQualityData } from "./useAirQualityData";
import { registerLayer } from "../registry";

const airQualityLayer: GisLayer = {
  id: "air-quality",
  name: "Air Quality",
  description: "EPA PM2.5 and ozone levels",
  color: "#10B981",
  icon: Wind,
  mapOverlay: AirQualityMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Good (low PM2.5)", color: "#10B98130", type: "gradient" },
    { label: "Poor (high PM2.5)", color: "#10B981", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    { layerId: "air-quality", label: "PM2.5", value: `${Number(feature.value).toFixed(1)} µg/m³`, color: "#10B981" },
  ],
  analysisPanel: AirQualityAnalysisPanel,
  detailPanel: AirQualityDetailPanel,
  useLayerData: useAirQualityData,
};

registerLayer(airQualityLayer);
export default airQualityLayer;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/layers/air-quality/
git commit -m "feat(gis): implement air quality layer (PM2.5/ozone choropleth)"
```

---

### Task 31: Hospital Access Layer (Complete Module)

**Files:**
- Create: `frontend/src/features/gis/layers/hospital-access/api.ts`
- Create: `frontend/src/features/gis/layers/hospital-access/useHospitalData.ts`
- Create: `frontend/src/features/gis/layers/hospital-access/HospitalMapOverlay.tsx`
- Create: `frontend/src/features/gis/layers/hospital-access/HospitalAnalysisPanel.tsx`
- Create: `frontend/src/features/gis/layers/hospital-access/HospitalDetailPanel.tsx`
- Create: `frontend/src/features/gis/layers/hospital-access/index.ts`

- [ ] **Step 1: Write hospital access api.ts and hook**

Create `frontend/src/features/gis/layers/hospital-access/api.ts`:

```typescript
import apiClient from "@/lib/api-client";

export interface HospitalPoint {
  hospital_id: number;
  cms_provider_id: string;
  hospital_name: string;
  city: string;
  county_fips: string;
  latitude: number;
  longitude: number;
  hospital_type: string;
  has_emergency: boolean;
  bed_count: number;
}

export interface AccessBin {
  distance_bin: string;
  bin_order: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
}

export interface DesertArea {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  avg_distance_km: number;
  patient_count: number;
  geometry: GeoJSON.Geometry;
}

export async function fetchHospitalMapData(): Promise<HospitalPoint[]> {
  const { data } = await apiClient.get("/gis/hospitals/map-data");
  return data.data;
}

export async function fetchAccessAnalysis(conceptId: number, metric: string = "cases"): Promise<AccessBin[]> {
  const { data } = await apiClient.get("/gis/hospitals/access-analysis", { params: { concept_id: conceptId, metric } });
  return data.data;
}

export async function fetchDeserts(): Promise<DesertArea[]> {
  const { data } = await apiClient.get("/gis/hospitals/deserts");
  return data.data;
}
```

Create `frontend/src/features/gis/layers/hospital-access/useHospitalData.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchHospitalMapData, fetchAccessAnalysis, fetchDeserts } from "./api";

export function useHospitalData(params: LayerDataParams): LayerDataResult {
  const { conceptId } = params;

  const hospitals = useQuery({
    queryKey: ["gis", "hospitals", "map"],
    queryFn: fetchHospitalMapData,
    staleTime: 5 * 60_000,
  });

  const access = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId],
    queryFn: () => fetchAccessAnalysis(conceptId!, "cases"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  const deserts = useQuery({
    queryKey: ["gis", "hospitals", "deserts"],
    queryFn: fetchDeserts,
    staleTime: 5 * 60_000,
  });

  return {
    choroplethData: undefined, // hospitals use ScatterplotLayer, not choropleth
    analysisData: { hospitals: hospitals.data, access: access.data, deserts: deserts.data },
    detailData: null,
    isLoading: hospitals.isLoading,
  };
}
```

- [ ] **Step 2: Write hospital components and index**

Create `frontend/src/features/gis/layers/hospital-access/HospitalMapOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";
import type { HospitalPoint } from "./api";

/**
 * Hospital layer uses ScatterplotLayer for point markers rather than GeoJsonLayer.
 * The `data` prop from LayerMapProps is not used — instead, hospital points are
 * passed via the analysisData field from useHospitalData and injected by GisPage.
 *
 * GisPage should pass hospital point data as a separate prop or via a context.
 * For simplicity, we accept hospital data via a custom `hospitals` prop.
 */

interface HospitalMapOverlayProps extends LayerMapProps {
  hospitals?: HospitalPoint[];
}

export function HospitalMapOverlay({ hospitals, visible }: HospitalMapOverlayProps) {
  const layer = useMemo(() => {
    if (!hospitals?.length || !visible) return null;

    return new ScatterplotLayer({
      id: "hospital-points",
      data: hospitals,
      getPosition: (d: HospitalPoint) => [d.longitude, d.latitude],
      getRadius: (d: HospitalPoint) => Math.max(Math.sqrt(d.bed_count) * 50, 500),
      getFillColor: (d: HospitalPoint) => d.has_emergency ? [59, 130, 246, 200] : [59, 130, 246, 100],
      getLineColor: [255, 255, 255, 150],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 20,
    });
  }, [hospitals, visible]);

  return layer;
}
```

> **Note for implementer:** The hospital layer is a special case — it renders point markers from `gis_hospital` data rather than choropleth polygons. GisPage should call `useHospitalData` and pass the `hospitals` array to HospitalMapOverlay as a custom prop. The other 4 layers use the standard `data: LayerChoroplethItem[]` prop flow.
```

Create `frontend/src/features/gis/layers/hospital-access/HospitalAnalysisPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccessAnalysis } from "./api";
import type { LayerAnalysisProps } from "../types";

export function HospitalAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId, metric],
    queryFn: () => fetchAccessAnalysis(conceptId, metric),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;
  const chartData = data.map((d) => ({ name: d.distance_bin, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 9 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="#3B82F6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

Create `frontend/src/features/gis/layers/hospital-access/HospitalDetailPanel.tsx`:

```typescript
import type { LayerDetailProps } from "../types";

export function HospitalDetailPanel({ fips }: LayerDetailProps) {
  return (
    <div className="text-xs text-[#8A857D]">
      <p>Nearest hospitals to {fips}</p>
      <p className="mt-1 text-[10px] text-[#5A5650]">Distance rings: 15/30/60 km</p>
    </div>
  );
}
```

Create `frontend/src/features/gis/layers/hospital-access/index.ts`:

```typescript
import { Hospital } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { HospitalMapOverlay } from "./HospitalMapOverlay";
import { HospitalAnalysisPanel } from "./HospitalAnalysisPanel";
import { HospitalDetailPanel } from "./HospitalDetailPanel";
import { useHospitalData } from "./useHospitalData";
import { registerLayer } from "../registry";

const hospitalLayer: GisLayer = {
  id: "hospital-access",
  name: "Hospital Access",
  description: "CMS hospital proximity",
  color: "#3B82F6",
  icon: Hospital,
  mapOverlay: HospitalMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Hospital (ED)", color: "#3B82F6", type: "circle" },
    { label: "Hospital (no ED)", color: "#3B82F680", type: "circle" },
  ],
  getTooltipData: (): TooltipEntry[] => [],
  analysisPanel: HospitalAnalysisPanel,
  detailPanel: HospitalDetailPanel,
  useLayerData: useHospitalData,
};

registerLayer(hospitalLayer);
export default hospitalLayer;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/layers/hospital-access/
git commit -m "feat(gis): implement hospital access layer (points, distance analysis, deserts)"
```

---

### Task 32: Wire Layers into GisPage & Import Registry

**Files:**
- Modify: `frontend/src/features/gis/layers/registry.ts`
- Modify: `frontend/src/features/gis/pages/GisPage.tsx`

- [ ] **Step 1: Import all layers into registry**

Add side-effect imports to the top of `frontend/src/features/gis/layers/registry.ts`:

```typescript
// Side-effect imports — each module calls registerLayer()
import "./svi";
import "./rucc";
import "./comorbidity";
import "./air-quality";
import "./hospital-access";
```

- [ ] **Step 2: Wire deck.gl layers from active use-case layers into GisPage**

In `frontend/src/features/gis/pages/GisPage.tsx`, add an import at the top:

```typescript
import "../layers/registry"; // triggers all layer registrations
```

Then replace the `layers={[]}` prop on DeckGL with the real layer objects. After the `activeLayerList` memo, add:

```typescript
// This is a simplified wiring — each layer's mapOverlay returns a deck.gl Layer
// In practice, each overlay component renders inside the DeckGL children
```

> **Note for implementer:** The map overlay components return deck.gl Layer objects (not React elements). The GisPage should call each active layer's `mapOverlay` as a function component that returns a Layer, then collect those into the `layers` array. The exact wiring depends on how deck.gl's React integration handles sub-layers vs the imperative `layers` prop. The implementer should test both approaches and pick the one that renders correctly.

- [ ] **Step 3: Verify compilation**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose exec node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1 | head -30"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/gis/layers/registry.ts frontend/src/features/gis/pages/GisPage.tsx
git commit -m "feat(gis): wire all 5 layer modules into GisPage via registry"
```

---

## End of Chunk 4

Chunk 4 adds 7 tasks (26-32): 5 complete layer module implementations (SVI, RUCC, comorbidity, air quality, hospital access) plus the registry wiring and GisPage integration. Each module follows the `GisLayer` interface pattern with api.ts, data hook, map overlay, analysis panel, detail panel, and index.ts.

**Visualization coverage (10/16 implemented, 6 deferred to iteration):**
- Implemented: 5 choropleths/map overlays + 5 primary analysis charts (quartile bars, outcome comparison, burden histogram, respiratory tertiles, distance bins)
- Deferred (add in follow-up tasks after base layers work): SVI scatterplot, SVI correlation heatmap, RUCC 9-category breakdown, comorbidity radar chart, air quality bi-variate 3x3 grid, hospital desert overlay with dashed outline. The API endpoints and data hooks for these are already in place — only the Recharts components need to be added.

---

## Chunk 5: Python Spatial Statistics Service

### Task 33: Spatial Stats Service (PySAL Wrapper)

**Files:**
- Create: `ai/app/services/spatial_stats.py`

- [ ] **Step 1: Write PySAL wrapper with lazy imports**

Create `ai/app/services/spatial_stats.py`:

```python
"""Spatial statistics service using PySAL (lazy-loaded).

All PySAL imports are deferred to first use to avoid startup penalty.
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np


def _lazy_import_pysal():
    """Import PySAL modules on first call."""
    import libpysal
    from esda.moran import Moran
    from esda.getisord import G_Local
    from spreg import OLS

    return libpysal, Moran, G_Local, OLS


def compute_morans_i(
    values: list[float],
    coordinates: list[tuple[float, float]],
    k: int = 8,
) -> dict[str, Any]:
    """Compute Moran's I statistic for spatial autocorrelation."""
    start = time.time()
    libpysal, Moran, _, _ = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(values)

    # K-nearest neighbors spatial weights
    w = libpysal.weights.KNN.from_array(coords, k=k)
    w.transform = "r"

    mi = Moran(y, w)

    return {
        "morans_i": float(mi.I),
        "expected_i": float(mi.EI),
        "p_value": float(mi.p_sim),
        "z_score": float(mi.z_sim),
        "significant": mi.p_sim < 0.05,
        "interpretation": (
            "positive spatial autocorrelation (clustering)"
            if mi.I > mi.EI and mi.p_sim < 0.05
            else "negative spatial autocorrelation (dispersion)"
            if mi.I < mi.EI and mi.p_sim < 0.05
            else "no significant spatial pattern"
        ),
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_hotspots(
    values: list[float],
    coordinates: list[tuple[float, float]],
    fips_codes: list[str],
    k: int = 8,
    alpha: float = 0.05,
) -> dict[str, Any]:
    """Compute Getis-Ord Gi* hotspot analysis."""
    start = time.time()
    libpysal, _, G_Local, _ = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(values)

    w = libpysal.weights.KNN.from_array(coords, k=k)
    w.transform = "b"

    g = G_Local(y, w, star=True)

    hotspots = []
    for i, (z, p, fips) in enumerate(zip(g.Zs, g.p_sim, fips_codes)):
        if p < alpha:
            hotspots.append({
                "fips": fips,
                "z_score": float(z),
                "p_value": float(p),
                "type": "hot" if z > 0 else "cold",
            })

    return {
        "hotspots": hotspots,
        "total_hot": sum(1 for h in hotspots if h["type"] == "hot"),
        "total_cold": sum(1 for h in hotspots if h["type"] == "cold"),
        "total_regions": len(values),
        "alpha": alpha,
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_correlation(
    x_values: list[float],
    y_values: list[float],
    x_label: str = "x",
    y_label: str = "y",
) -> dict[str, Any]:
    """Compute Pearson correlation between two variables."""
    start = time.time()
    from scipy import stats

    x = np.array(x_values)
    y = np.array(y_values)

    r, p = stats.pearsonr(x, y)

    return {
        "r": float(r),
        "r_squared": float(r**2),
        "p_value": float(p),
        "significant": p < 0.05,
        "n": len(x),
        "x_label": x_label,
        "y_label": y_label,
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_regression(
    y_values: list[float],
    x_matrix: list[list[float]],
    x_labels: list[str],
    coordinates: list[tuple[float, float]],
) -> dict[str, Any]:
    """OLS regression with spatial diagnostics."""
    start = time.time()
    libpysal, _, _, OLS = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(y_values).reshape(-1, 1)
    x = np.array(x_matrix)

    w = libpysal.weights.KNN.from_array(coords, k=8)
    w.transform = "r"

    model = OLS(y, x, w=w, name_y="outcome_rate", name_x=x_labels)

    coefficients = []
    for i, label in enumerate(x_labels):
        coefficients.append({
            "variable": label,
            "coefficient": float(model.betas[i + 1][0]),
            "std_error": float(model.std_err[i + 1]),
            "t_stat": float(model.t_stat[i + 1][0]),
            "p_value": float(model.t_stat[i + 1][1]),
        })

    return {
        "r_squared": float(model.r2),
        "adj_r_squared": float(model.ar2),
        "f_stat": float(model.f_stat[0]),
        "f_p_value": float(model.f_stat[1]),
        "coefficients": coefficients,
        "n": len(y_values),
        "computation_time_ms": int((time.time() - start) * 1000),
    }
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/services/spatial_stats.py
git commit -m "feat(gis): add PySAL spatial statistics service (lazy-loaded)"
```

---

### Task 34: GIS Analytics Router (FastAPI Endpoints)

**Files:**
- Create: `ai/app/routers/gis_analytics.py`
- Modify: `ai/app/main.py`

- [ ] **Step 1: Write gis_analytics router**

Create `ai/app/routers/gis_analytics.py`:

```python
"""GIS spatial analytics endpoints.

Provides Moran's I, Getis-Ord Gi* hotspots, correlation, and regression.
PySAL is lazy-loaded on first request to avoid startup penalty.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/gis-analytics", tags=["GIS Analytics"])


class MoransIRequest(BaseModel):
    values: list[float]
    coordinates: list[tuple[float, float]]
    k: int = Field(default=8, ge=2, le=30)


class HotspotsRequest(BaseModel):
    values: list[float]
    coordinates: list[tuple[float, float]]
    fips_codes: list[str]
    k: int = Field(default=8, ge=2, le=30)
    alpha: float = Field(default=0.05, ge=0.001, le=0.1)


class CorrelationRequest(BaseModel):
    x_values: list[float]
    y_values: list[float]
    x_label: str = "x"
    y_label: str = "y"


class RegressionRequest(BaseModel):
    y_values: list[float]
    x_matrix: list[list[float]]
    x_labels: list[str]
    coordinates: list[tuple[float, float]]


@router.post("/morans-i")
async def morans_i(req: MoransIRequest):
    """Compute Moran's I spatial autocorrelation statistic."""
    if len(req.values) != len(req.coordinates):
        raise HTTPException(400, "values and coordinates must have same length")
    if len(req.values) < 10:
        raise HTTPException(400, "Need at least 10 observations")

    from app.services.spatial_stats import compute_morans_i

    result = compute_morans_i(req.values, req.coordinates, k=req.k)
    return {"data": result}


@router.post("/hotspots")
async def hotspots(req: HotspotsRequest):
    """Compute Getis-Ord Gi* hotspot analysis."""
    if len(req.values) != len(req.coordinates) or len(req.values) != len(req.fips_codes):
        raise HTTPException(400, "values, coordinates, and fips_codes must have same length")
    if len(req.values) < 10:
        raise HTTPException(400, "Need at least 10 observations")

    from app.services.spatial_stats import compute_hotspots

    result = compute_hotspots(req.values, req.coordinates, req.fips_codes, k=req.k, alpha=req.alpha)
    return {"data": result}


@router.post("/correlation")
async def correlation(req: CorrelationRequest):
    """Compute Pearson correlation between two variables."""
    if len(req.x_values) != len(req.y_values):
        raise HTTPException(400, "x_values and y_values must have same length")
    if len(req.x_values) < 3:
        raise HTTPException(400, "Need at least 3 observations")

    from app.services.spatial_stats import compute_correlation

    result = compute_correlation(req.x_values, req.y_values, req.x_label, req.y_label)
    return {"data": result}


@router.post("/regression")
async def regression(req: RegressionRequest):
    """OLS regression with spatial diagnostics."""
    if len(req.y_values) != len(req.x_matrix) or len(req.y_values) != len(req.coordinates):
        raise HTTPException(400, "y_values, x_matrix, and coordinates must have same length")
    if len(req.x_labels) != len(req.x_matrix[0]):
        raise HTTPException(400, "x_labels must match x_matrix column count")

    from app.services.spatial_stats import compute_regression

    result = compute_regression(req.y_values, req.x_matrix, req.x_labels, req.coordinates)
    return {"data": result}


@router.post("/drive-time")
async def drive_time():
    """Drive-time isochrone computation (deferred — returns Haversine only)."""
    return {
        "data": {
            "message": "Drive-time isochrones are deferred to a future release. Current implementation uses Haversine distance.",
            "method": "haversine",
        }
    }
```

- [ ] **Step 2: Register router in main.py**

In `ai/app/main.py`, add the import and include:

```python
from app.routers import gis_analytics

app.include_router(gis_analytics.router)
```

- [ ] **Step 3: Add PySAL dependencies to requirements.txt**

Append to `ai/requirements.txt`:

```
# Spatial statistics (lazy-loaded)
libpysal>=4.9
esda>=2.5
spreg>=1.4
geopandas>=0.14
```

- [ ] **Step 4: Test endpoint (health check)**

```bash
curl -s http://localhost:8002/gis-analytics/drive-time -X POST | python3 -m json.tool
```

Expected: `{"data": {"message": "Drive-time isochrones are deferred...", "method": "haversine"}}`

- [ ] **Step 5: Commit**

```bash
git add ai/app/routers/gis_analytics.py ai/app/main.py ai/requirements.txt
git commit -m "feat(gis): add FastAPI spatial analytics router (Moran's I, hotspots, regression)"
```

---

### Task 35: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify backend routes**

```bash
docker compose exec php php artisan route:list --path=gis | grep -c "gis/"
```

Expected: 20+ routes.

- [ ] **Step 2: Verify frontend compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Expected: No errors.

- [ ] **Step 3: Verify Python service starts**

```bash
curl -s http://localhost:8002/health | python3 -m json.tool
```

Expected: `{"status": "ok", ...}`

- [ ] **Step 4: Build frontend for production**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(gis): GIS Explorer v3 — 5 use case layers complete"
```

---

## End of Chunk 5

Chunk 5 adds 3 tasks (33-35): the PySAL spatial statistics service with lazy loading, the FastAPI gis_analytics router (4 endpoints + drive-time stub), and integration verification.

---

## Plan Summary

| Chunk | Tasks | Scope |
|-------|-------|-------|
| 1 | 1-10 | Database schema, ETL pipeline (10 scripts) |
| 2 | 11-18 | Backend API (8 services + controllers + routes) |
| 3 | 19-25 | Frontend layer system (types, store, shared components, GisPage refactor) |
| 4 | 26-32 | 5 use case layer implementations (SVI, RUCC, comorbidity, air quality, hospital) |
| 5 | 33-35 | Python spatial statistics service + final verification |

**Total: 35 tasks across 5 chunks.**
