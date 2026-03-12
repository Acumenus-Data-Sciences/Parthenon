# GIS Explorer v3 — Use Case Implementation Design

**Date:** 2026-03-12
**Status:** Approved
**Scope:** 5 GIS use cases for PA COVID-19 cohort (1M Synthea patients)

## Overview

Enhance Parthenon's GIS Explorer with 5 research use cases demonstrating OHDSI GIS capabilities using Pennsylvania COVID-19 patient data. The existing GIS Explorer (deck.gl maps, GADM boundaries, disease selector, CDM choropleth) becomes the foundation for a layered dashboard where each use case is a toggleable analysis layer.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All 5 use cases | Shared infrastructure makes each successive one faster |
| Geocoding | PostGIS ZIP crosswalk | No lat/lon in data; 1,337 ZIPs map to tracts/counties via HUD crosswalk |
| Granularity | County + ZIP/tract | County for broad maps, tract-level for SVI |
| Data acquisition | Local-first + `--fetch` flag | Reliable dev, refreshable from source |
| Map library | Keep deck.gl + Mapbox GL | Already working; don't rip out |
| Chart library | Add Recharts | React-native, lightweight, sufficient for all chart types |
| Spatial stats | Lazy-loaded PySAL in AI service | Avoids Docker sprawl; lazy import prevents startup penalty |
| Privacy | Configurable threshold, default off | Synthea is synthetic; infrastructure ready for real data |
| UI approach | Layered Dashboard (Approach C) | Matches researcher mental model; composable layers |

## Architecture

Four tiers:

1. **External Data Sources** — CDC SVI, USDA RUCC, EPA AQS, CMS hospitals, Census TIGER/crosswalk. Downloaded to `GIS/data/` (gitignored).
2. **ETL Pipeline** — Python scripts in `scripts/gis/` that parse and load into `gis` schema on local PG 17 (ohdsi database).
3. **`gis` schema** — New tables following OHDSI GIS spec: `geographic_location`, `external_exposure`, `location_geography` (crosswalk), `gis_hospital`.
4. **Layer system** — Each use case is a self-contained module (React component + TanStack Query hook + Laravel endpoint + optional Python analytics endpoint).

### Data Flow

```
External CSVs/Shapefiles
  → scripts/gis/load_*.py
    → gis schema (PG 17, ohdsi DB)
      → Laravel API (GIS controllers + services)
        → Python FastAPI (spatial stats, lazy PySAL)
          → React frontend (deck.gl map + Recharts panels)
```

## Database Schema

All new tables in `gis` schema on local PG 17 (ohdsi database), created via Python ETL scripts.

### gis.geographic_location

| Column | Type | Notes |
|--------|------|-------|
| geographic_location_id | BIGSERIAL PK | |
| location_name | VARCHAR(255) | "Allegheny County", "Tract 420010001" |
| location_type | VARCHAR(20) | census_tract, county, zip, zcta |
| geographic_code | VARCHAR(15) | FIPS code |
| state_fips | CHAR(2) | "42" for PA |
| county_fips | CHAR(5) | Enables county roll-up |
| latitude | NUMERIC(9,6) | Centroid |
| longitude | NUMERIC(9,6) | Centroid |
| geometry | GEOGRAPHY(MULTIPOLYGON, 4326) | PostGIS boundary |
| population | INTEGER | Census 2020 |
| area_sq_km | NUMERIC(12,4) | Calculated from geometry |
| parent_location_id | BIGINT FK | Tract → County hierarchy |

Indexes: PK, GIST(geometry), UNIQUE(geographic_code, location_type), (county_fips), (location_type).
~4,600 rows for PA (3,200 tracts + 67 counties + 1,300 ZIPs).

### gis.external_exposure

| Column | Type | Notes |
|--------|------|-------|
| external_exposure_id | BIGSERIAL PK | |
| person_id | BIGINT NOT NULL | FK → omop.person |
| exposure_type | VARCHAR(30) | svi_overall, svi_theme1-4, rucc, pm25, ozone, hospital_distance |
| exposure_date | DATE NOT NULL | When exposure measured |
| value_as_number | NUMERIC | SVI percentile, PM2.5, distance km |
| value_as_string | VARCHAR(100) | RUCC category name |
| value_as_integer | INTEGER | RUCC code (1-9), SVI quartile |
| unit | VARCHAR(30) | percentile, ug/m3, ppb, km, category |
| geographic_location_id | BIGINT FK | Source geography |
| source_dataset | VARCHAR(50) | cdc_svi_2020, usda_rucc_2013, epa_aqs_2020 |

Indexes: PK, (person_id, exposure_type), (geographic_location_id), (exposure_type, value_as_number).
~10M rows (1M patients × ~10 exposure types).

**Pragmatic deviation:** Uses `exposure_type` varchar instead of OHDSI `exposure_concept_id` integer — avoids creating custom vocabulary concepts. Concept_id mapping can be added later for strict compliance.

### gis.location_geography (ZIP crosswalk)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| location_id | INTEGER NOT NULL | FK → omop.location |
| zip_code | VARCHAR(5) | Original ZIP |
| tract_fips | VARCHAR(11) | 11-digit census tract FIPS |
| county_fips | VARCHAR(5) | 5-digit county FIPS |
| tract_allocation_ratio | NUMERIC(6,4) | HUD residential ratio (0.0-1.0) |
| tract_location_id | BIGINT FK | → geographic_location (tract) |
| county_location_id | BIGINT FK | → geographic_location (county) |

~4,000 rows. One ZIP may span multiple tracts. Allocation: tract-level SVI uses weighted average by HUD ratio; county-level (RUCC, air quality) uses deterministic dominant-tract mapping. ZIP "00000" records (~200) get NULL mappings and are excluded.

### gis.gis_hospital

| Column | Type | Notes |
|--------|------|-------|
| hospital_id | SERIAL PK | |
| cms_provider_id | VARCHAR(10) | CMS CCN |
| hospital_name | VARCHAR(255) | |
| address | VARCHAR(255) | |
| city | VARCHAR(100) | |
| county_fips | VARCHAR(5) | |
| zip_code | VARCHAR(5) | |
| latitude | NUMERIC(9,6) | |
| longitude | NUMERIC(9,6) | |
| point | GEOGRAPHY(POINT, 4326) | PostGIS point |
| hospital_type | VARCHAR(50) | Acute Care, Critical Access, etc. |
| has_emergency | BOOLEAN | |
| bed_count | INTEGER | |

~200 PA hospitals with EDs. Indexes: PK, GIST(point), (county_fips).

**Note:** Scalar `latitude`/`longitude` columns are retained for non-spatial queries and display convenience. The `point` GEOGRAPHY column enables GIST-indexed spatial operations (nearest-neighbor, distance). ETL keeps both in sync.

### Relationships

```
omop.person → person.location_id → omop.location (ZIP, city, state)
                                        │ via ZIP code
                                        ↓
                                 gis.location_geography (crosswalk)
                                   │              │
                                   │ tract_fips   │ county_fips
                                   ↓              ↓
                             gis.geographic_location (PostGIS geometry)
                                        ↑
                                        │ geographic_location_id
gis.external_exposure ──────────────────┘
gis.gis_hospital (point geometry → distance to geographic_location centroids)
```

## UI Layout — Layered Dashboard

Full-viewport layout with three panels + collapsible analysis drawer:

### Left Panel: Layer Controls (~220px)
- Disease selector (moved from right panel)
- 5 toggleable analysis layers with on/off state and color indicators
- Active layers show colored borders; inactive are dimmed
- Shared controls: metric selector, time filter, suppression threshold

### Center: Map (flex-1, maximized)
- deck.gl + Mapbox GL (existing)
- Renders overlays from all active layers simultaneously
- Composite legend for active layers (bottom-left overlay)
- Tooltips aggregate data from all active layers

### Right Panel: Context (~220px)
- Selected county stats grid (cases, deaths, hosp rate, CFR)
- Active layer details for selected county (SVI themes, RUCC category, etc.)
- Top counties list
- Research actions (Create Study, Browse Cohorts)

### Bottom: Analysis Drawer (collapsible, ~200px expanded)
- Horizontally scrollable row of Recharts panels
- Shows charts relevant to active layers only
- Collapses to thin bar (~32px) to maximize map space
- Spatial statistics summary panel (Moran's I, hotspot counts)

**Key constraint:** Maximize browser viewport usage. Full-height layout, no wasted space.

## Layer Module Architecture

Each use case is a self-contained layer module implementing a shared interface:

```typescript
interface GisLayer {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: LucideIcon;
  mapOverlay: React.FC<LayerMapProps>;
  legendItems: LegendItem[];
  getTooltipData: (feature: Feature) => TooltipEntry[];
  analysisPanel: React.FC<LayerAnalysisProps>;
  detailPanel: React.FC<LayerDetailProps>;
  useLayerData: (params: LayerDataParams) => LayerDataResult;
}
```

### Directory Structure

```
frontend/src/features/gis/layers/
  types.ts                     # Shared layer interface
  registry.ts                  # Layer registry
  svi/
    index.ts, SviMapOverlay.tsx, SviAnalysisPanel.tsx,
    SviDetailPanel.tsx, useSviData.ts, api.ts
  rucc/
    index.ts, RuccMapOverlay.tsx, RuccAnalysisPanel.tsx,
    RuccDetailPanel.tsx, useRuccData.ts, api.ts
  comorbidity/
    index.ts, ComorbidityMapOverlay.tsx, ComorbidityAnalysisPanel.tsx,
    ComorbidityDetailPanel.tsx, useComorbidityData.ts, api.ts
  air-quality/
    index.ts, AirQualityMapOverlay.tsx, AirQualityAnalysisPanel.tsx,
    AirQualityDetailPanel.tsx, useAirQualityData.ts, api.ts
  hospital-access/
    index.ts, HospitalMapOverlay.tsx, HospitalAnalysisPanel.tsx,
    HospitalDetailPanel.tsx, useHospitalData.ts, api.ts
```

GisPage orchestrates: reads active layers from Zustand store, renders their map overlays, combines tooltip data, shows analysis/detail panels. Adding a future Use Case 6 requires only: new directory, implement interface, register.

## API Endpoints

### Laravel (Backend)

```
# SVI (Use Case 1)
GET  /api/v1/gis/svi/choropleth?level=tract|county&theme=overall|1|2|3|4
GET  /api/v1/gis/svi/quartile-analysis?concept_id=N
GET  /api/v1/gis/svi/theme-correlations?concept_id=N
GET  /api/v1/gis/svi/tract-detail/{fips}

# Urban-Rural (Use Case 2)
GET  /api/v1/gis/rucc/choropleth
GET  /api/v1/gis/rucc/outcome-comparison?concept_id=N
GET  /api/v1/gis/rucc/county-detail/{fips}

# Comorbidity (Use Case 3)
GET  /api/v1/gis/comorbidity/choropleth?conditions=E11,I10,E66
GET  /api/v1/gis/comorbidity/hotspots?concept_id=N
GET  /api/v1/gis/comorbidity/burden-score

# Air Quality (Use Case 4)
GET  /api/v1/gis/air-quality/choropleth?pollutant=pm25|ozone
GET  /api/v1/gis/air-quality/respiratory-outcomes?concept_id=N
GET  /api/v1/gis/air-quality/county-detail/{fips}

# Hospital Access (Use Case 5)
GET  /api/v1/gis/hospitals/map-data
GET  /api/v1/gis/hospitals/access-analysis?concept_id=N
GET  /api/v1/gis/hospitals/deserts

# Shared
GET  /api/v1/gis/layers
GET  /api/v1/gis/geography/counties
GET  /api/v1/gis/geography/tracts?county={fips}
POST /api/v1/gis/spatial-stats

# Admin (super-admin only)
POST /api/v1/gis/etl/load-svi
POST /api/v1/gis/etl/load-rucc
POST /api/v1/gis/etl/load-air-quality
POST /api/v1/gis/etl/load-hospitals
POST /api/v1/gis/etl/geocode-patients
GET  /api/v1/gis/etl/status/{job_id}
```

### Backend Services

```
backend/app/Services/GIS/
  GisLayerService.php, SviAnalysisService.php, RuccAnalysisService.php,
  ComorbidityAnalysisService.php, AirQualityAnalysisService.php,
  HospitalAccessService.php, GeographyService.php, SpatialStatsProxy.php

backend/app/Http/Controllers/Api/V1/
  GisSviController.php, GisRuccController.php, GisComorbidityController.php,
  GisAirQualityController.php, GisHospitalController.php,
  GisGeographyController.php, GisEtlController.php
```

Laravel services query `gis` schema on ohdsi DB via dedicated `gis` database connection. Spatial statistics proxied to Python. All endpoints return `{data: T}` envelope.

### Python FastAPI (AI Service)

```
ai/app/routers/gis_analytics.py  # New router, lazy-loads PySAL
  POST /gis-analytics/morans-i
  POST /gis-analytics/hotspots
  POST /gis-analytics/regression
  POST /gis-analytics/correlation
  POST /gis-analytics/drive-time
```

Dependencies (lazy-loaded): PySAL, libpysal, esda, spreg, geopandas, scipy.

## ETL Pipeline

```
scripts/gis/
  fetch_data.py          # Master downloader (--fetch pulls from source URLs)
  load_geography.py      # Step 1: PA tract + county shapefiles → geographic_location
  load_crosswalk.py      # Step 2: HUD ZIP-Tract → location_geography
  load_svi.py            # Step 3a: CDC SVI → external_exposure (~5M rows)
  load_rucc.py           # Step 3b: USDA RUCC → external_exposure (~1M rows)
  load_air_quality.py    # Step 3c: EPA AQS → external_exposure (~2M rows)
  load_hospitals.py      # Step 3d: CMS → gis_hospital + distance → external_exposure (~1M)
  load_all.py            # Orchestrator: steps 1-3d, validates, emits JSON progress

GIS/data/                # Downloaded data (gitignored)
  svi/, rucc/, tiger/, crosswalk/, aqs/, hospitals/
```

Properties:
- All scripts connect directly to local PG 17 (no Docker)
- Idempotent (`INSERT ... ON CONFLICT DO UPDATE`)
- JSON progress events for admin UI integration
- Tract-level SVI: weighted average by HUD allocation ratio (deterministic)
- County-level data: dominant tract's county (deterministic)
- Total: ~10M external_exposure rows

## Visualizations — 16 Total

### Use Case 1: SVI & COVID Outcomes (4 viz)
1. **Choropleth map** — Census tract fill by SVI percentile + circle markers by case count (deck.gl GeoJsonLayer + ScatterplotLayer). Toggle: overall/theme 1-4.
2. **Quartile bar chart** — Outcomes by SVI quartile, clustered bars with 95% CI (Recharts BarChart).
3. **Scatterplot** — SVI percentile vs outcome rate per tract. Point size = case count. Trend line + 95% CI. Click → highlight on map (Recharts ScatterChart).
4. **Correlation heatmap** — 4 SVI themes × 3 outcomes. Pearson r with p-value annotations (custom SVG grid).

### Use Case 2: Urban-Rural Disparity (3 viz)
1. **County classification map** — 3-category fill: metro (blue), micro (purple), rural (amber) (deck.gl GeoJsonLayer).
2. **Outcome comparison bars** — Grouped: metro/micro/rural, crude + adjusted rates (Recharts BarChart).
3. **RUCC category detail** — Full 9-category horizontal breakdown with patient counts (Recharts BarChart).

### Use Case 3: Comorbidity Clustering (3 viz)
1. **Hotspot heat map** — Getis-Ord Gi* results: hot (red) / cold (blue) / neutral (deck.gl HeatmapLayer).
2. **Burden score histogram** — Distribution of composite comorbidity burden (Recharts BarChart).
3. **Condition prevalence radar** — DM/HTN/obesity prevalence per area vs state average (Recharts RadarChart).

### Use Case 4: Air Quality (3 viz)
1. **Bi-variate choropleth** — 3×3 color grid encoding air quality × respiratory rate (deck.gl GeoJsonLayer, custom palette).
2. **PM2.5 vs ventilation scatter** — Pittsburgh industrial corridor highlighted (Recharts ScatterChart).
3. **Baseline lung disease stratification** — Asthma/COPD vs no baseline by air quality tertile (Recharts BarChart).

### Use Case 5: Hospital Access (3 viz)
1. **Hospital locations + isochrones** — Points sized by beds + distance rings at 15/30/60km (deck.gl ScatterplotLayer + polygon rings).
2. **Distance vs mortality bars** — 5 distance bins vs outcome rate (Recharts BarChart).
3. **Healthcare deserts** — Areas >60km from hospital with high COVID burden (deck.gl GeoJsonLayer, dashed outline).

## New Dependencies

### Frontend
- `recharts` — React charting library

### Python (AI service, lazy-loaded)
- `pysal`, `libpysal`, `esda`, `spreg` — Spatial statistics
- `geopandas` — GeoDataFrame operations
- `scipy` — Statistical tests (already in requirements)

### ETL Scripts
- `geopandas`, `shapely`, `fiona` — Shapefile processing
- `psycopg2` — Direct PG connection (already used by boundary loader)

## Database Connection Strategy

### Split-database design

The existing GIS boundary tables (`gis_admin_boundaries`, `gis_boundary_levels`) live in **Docker PG 16** (parthenon database, `app` schema) and are managed by Laravel migrations. The new OHDSI GIS tables live in **local PG 17** (ohdsi database, `gis` schema) alongside the clinical data they reference.

**New `gis` connection in `backend/config/database.php`:**

```php
'gis' => [
    'driver' => 'pgsql',
    'host' => env('GIS_DB_HOST', 'localhost'),
    'port' => env('GIS_DB_PORT', '5432'),
    'database' => env('GIS_DB_DATABASE', 'ohdsi'),
    'username' => env('GIS_DB_USERNAME', 'smudoshi'),
    'password' => env('GIS_DB_PASSWORD', ''),
    'search_path' => 'gis,omop,public',
],
```

**Geometry source resolution:** The map component uses existing GADM boundaries (`app.gis_admin_boundaries` from Docker PG) for the global boundary system and country-level views. When a use-case layer is active, it fetches layer-specific geometry from `gis.geographic_location` (local PG 17) via its own API endpoints. The two geometry sources do not overlap — GADM provides global admin boundaries, `geographic_location` provides PA-specific census tracts/counties with attached exposure data.

### PostGIS prerequisite

PostGIS must be installed on local PG 17. The ETL orchestrator (`load_all.py`) runs a Step 0 verification:

```python
# Step 0: Verify PostGIS
cursor.execute("SELECT PostGIS_Version()")
# If missing: raise with install instructions
# Ubuntu/Debian: sudo apt install postgresql-17-postgis-3
# Then: CREATE EXTENSION IF NOT EXISTS postgis;
```

## COVID Outcome Cohorts

The use cases analyze COVID-19 outcomes across geographic dimensions. A `GisCovidCohortService` encapsulates the 4 outcome definitions as **runtime CTEs** (not pre-computed cohorts):

| Cohort | Definition | SQL Logic |
|--------|-----------|-----------|
| COVID Diagnosis | Any COVID-19 condition | `condition_concept_id` maps to SNOMED 37311061 (COVID-19) |
| Hospitalization | COVID + inpatient visit | Join `visit_occurrence` where `visit_concept_id = 9201` (inpatient) |
| ICU Admission | COVID + ICU care site | Join `visit_detail` where care_site has ICU concept |
| Mortality | COVID + death within 30 days | Join `death` where `death_date BETWEEN condition_start_date AND +30 days` |

These CTEs are composed into analysis queries by each layer's service class. The `concept_id=N` parameter on API endpoints refers to the disease concept (e.g., 37311061 for COVID), not the cohort type — outcome type is selected via the metric parameter (cases, hospitalizations, icu, deaths, cfr).

## Query Performance Strategy

With ~10M rows in `external_exposure` and multi-table joins across schemas, raw queries will be slow. Mitigation:

### Pre-computed summary table: `gis.patient_geography`

Materialized view created during ETL, refreshed on data load:

```sql
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
JOIN gis.location_geography lg ON l.location_id = lg.location_id;
```

This eliminates the 4-table join from every choropleth query. Indexed on `(person_id)`, `(county_fips)`, `(tract_fips)`.

### Pre-aggregated county/tract summaries

Each ETL loader also populates `gis.geography_summary`:

```sql
CREATE TABLE gis.geography_summary (
  geographic_location_id BIGINT,
  exposure_type VARCHAR(30),
  patient_count INTEGER,
  avg_value NUMERIC,
  median_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  PRIMARY KEY (geographic_location_id, exposure_type)
);
```

Choropleth endpoints query this ~4,600-row table (instant) instead of aggregating 10M rows.

### Performance target

- Choropleth map data: <500ms (reads pre-aggregated summaries)
- Quartile/correlation analysis: <3s (joins patient_geography + external_exposure)
- Spatial statistics (Moran's I): <10s (Python, operates on ~3,200 tract-level aggregates)

## ETL Data Validation

Between `load_crosswalk.py` and `load_svi.py`, a validation gate runs:

```
Validation Report:
  Total locations:           3,127
  Valid 5-digit PA ZIPs:     2,923  (93.5%)
  ZIP "00000" (invalid):       204  (6.5%)
  ZIPs in HUD crosswalk:    2,891  (92.5%)
  ZIPs NOT in crosswalk:       32  (1.0%) — logged for review
  Counties covered:          65/67  (97.0%)
  Patients with geography:  982,341 (97.7%)
  Patients without:          23,447  (2.3%) — excluded from analyses
```

If coverage drops below 85%, the ETL halts with an error. Invalid/unmapped ZIPs are logged but do not block the pipeline.

## Exposure Type Enum

| exposure_type | unit | value_as_number range | source_dataset |
|---------------|------|----------------------|----------------|
| svi_overall | percentile | 0.0 - 1.0 | cdc_svi_2020 |
| svi_theme1 | percentile | 0.0 - 1.0 | cdc_svi_2020 |
| svi_theme2 | percentile | 0.0 - 1.0 | cdc_svi_2020 |
| svi_theme3 | percentile | 0.0 - 1.0 | cdc_svi_2020 |
| svi_theme4 | percentile | 0.0 - 1.0 | cdc_svi_2020 |
| rucc | category | 1 - 9 (in value_as_integer) | usda_rucc_2013 |
| pm25 | ug/m3 | 0.0 - 50.0 | epa_aqs_2020 |
| ozone | ppb | 0.0 - 100.0 | epa_aqs_2020 |
| hospital_distance | km | 0.0 - 200.0 | cms_hospitals_2024 |
| comorbidity_burden | score | 0.0 - 3.0 (count of DM+HTN+obesity) | derived |

## Spatial Stats Proxy Endpoint

`POST /api/v1/gis/spatial-stats` proxies to Python based on `analysis_type`:

```json
{
  "analysis_type": "morans_i | hotspots | regression | correlation | drive_time",
  "variable": "hospitalization_rate",
  "geography_level": "census_tract | county",
  "concept_id": 37311061,
  "filters": {}
}
```

Response envelope: `{data: {result: ..., metadata: {computation_time_ms: N}}}`.

## Distance Calculations (Use Case 5)

V1 uses **Haversine (great-circle) distance** from geographic_location centroids to nearest hospital point. This is Euclidean-on-sphere, not drive-time. Distance rings on the map are circular isodistance bands (15/30/60km), not road-network isochrones.

Drive-time isochrones via OSRM/OpenRouteService are deferred to a future enhancement. The Haversine approach is sufficient for identifying healthcare deserts and correlating distance with outcomes.

## Privacy & Suppression

Configurable suppression threshold per layer:
- Default: 0 (off) — Synthea data is synthetic
- Configurable to 5 (standard) or 11 (conservative) for real data
- Applied at query time: geographic areas below threshold show as "Suppressed" on map and "—" in charts
- Stored as environment variable `GIS_SUPPRESSION_THRESHOLD`
