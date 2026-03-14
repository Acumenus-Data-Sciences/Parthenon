# GIS Epidemiology Explorer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GIS page in Parthenon that lets researchers explore epidemic/pandemic characteristics by geography, compare public health response effectiveness across regions, and overlay OMOP CDM patient-level data onto geographic boundaries using the OHDSI GIS data model (`location_history`, `external_exposure`).

**Architecture:** A Python FastAPI service ingests the local GADM/geoBoundaries GeoPackage/GeoJSON files into PostGIS-enabled PostgreSQL, serving simplified GeoJSON tiles to a React frontend using deck.gl for WebGL-accelerated map rendering. Laravel acts as the authenticated API gateway, proxying spatial queries to the Python service. The OHDSI GIS CDM extension tables (`location_history`, `external_exposure`) store person-location-time relationships and environmental exposures, enabling spatial joins between patient cohorts and geographic regions.

**Tech Stack:**
- **Frontend:** React 19, TypeScript, deck.gl (WebGL maps), react-map-gl, Tailwind 4, TanStack Query, Zustand
- **Backend:** Laravel 11 (API gateway + migrations), Python FastAPI (spatial queries + GeoJSON serving)
- **Database:** PostgreSQL 16+PostGIS 3.4 (Docker), PostgreSQL 17+PostGIS (host/production)
- **Data:** GADM v4.1 (356K admin boundaries), geoBoundaries CGAZ (ADM0/1/2), OHDSI GIS vocabulary

---

## Research Summary

### OHDSI/GIS Project
The OHDSI GIS Working Group provides an ecosystem for linking geospatial/environmental data to OMOP CDM patient data. Key components:

- **gaiaDB:** PostgreSQL/PostGIS database with backbone schema (data_source, variable_source catalogs) and working schema (geocoded locations, spatial joins, external_exposure output)
- **gaiaCore:** R package for loading geometries, geocoding, creating exposures via `DatabaseConnector` + `sf` + PostGIS
- **CDM Extensions:** `location_history` (person-location-time) and `external_exposure` (person + location + exposure_concept + value + time) tables
- **Status:** Experimental/beta — solid data model but no production web UI exists. The vocabulary package is most mature.

### Local GIS Data (`/GIS/` directory)
| File | Size | Records | Description |
|------|------|---------|-------------|
| `gadm_410.gpkg` | 2.6 GB | 356,508 | GADM v4.1 global admin boundaries (ADM0-5), GeoPackage format |
| `geoBoundariesCGAZ_ADM0.geojson` | 383 MB | 218 | Country boundaries (simplified) |
| `geoBoundariesCGAZ_ADM1.geojson` | 344 MB | 3,224 | Province/state boundaries |
| `geoBoundariesCGAZ_ADM2.geojson` | 525 MB | 49,349 | District/county boundaries |

All data is WGS84 (EPSG:4326). GADM has 6-level admin hierarchy with temporal validity metadata.

### Design Decisions

1. **PostGIS for spatial queries, NOT client-side** — 3.8GB of geometry data cannot be served raw to browsers. PostGIS handles spatial indexing, simplification (`ST_Simplify`), and clipping. Python serves pre-simplified GeoJSON per viewport.

2. **deck.gl over Leaflet** — WebGL rendering handles 50K+ polygons at interactive framerates. Leaflet/SVG chokes above ~5K features. deck.gl's `GeoJsonLayer` + `FillExtrusionLayer` support choropleth, heatmaps, and 3D extrusions natively.

3. **Python FastAPI for spatial service, NOT Laravel** — PostGIS spatial queries (`ST_Simplify`, `ST_Within`, `ST_Intersects`, `ST_AsGeoJSON`) and GeoJSON serialization are dramatically faster in Python (psycopg2/asyncpg + shapely) than PHP. The AI service already has the pattern.

4. **GADM as primary boundary source** — 356K features across 6 admin levels vs. geoBoundaries' 3 levels. Richer metadata (temporal validity, sovereignty, type classifications). GeoPackage format is indexed and queryable without full load.

5. **Phased data loading** — Load boundaries into PostGIS on first use via management command, not at container startup. 2.6GB GADM file takes minutes to ingest.

6. **No Mapbox/Google Maps dependency** — Use open tile servers (CartoDB, Stamen, OpenStreetMap) with deck.gl's `Map` component. Zero API key requirements for development.

---

## File Structure

### Database Migrations (Laravel)
```
backend/database/migrations/
  2026_03_11_000001_enable_postgis_extension.php        — Enable PostGIS on Docker PG
  2026_03_11_000002_create_gis_boundary_tables.php      — admin_boundaries, boundary_levels
  2026_03_11_000003_create_location_history_table.php   — OHDSI location_history CDM extension
  2026_03_11_000004_create_external_exposure_table.php  — OHDSI external_exposure CDM extension
  2026_03_11_000005_create_gis_datasets_table.php       — Metadata catalog for loaded datasets
```

### Python FastAPI (Spatial Service)
```
ai/app/routers/gis.py                    — GIS API endpoints (boundaries, spatial queries, stats)
ai/app/services/gis_boundary_loader.py   — GADM/geoBoundaries PostGIS ingestion
ai/app/services/gis_spatial_query.py     — Spatial join + aggregation engine
ai/app/models/gis.py                     — Pydantic models for GIS API
```

### Laravel Backend (API Gateway)
```
backend/app/Http/Controllers/Api/V1/GisController.php   — Proxy + auth gateway
backend/app/Http/Requests/GisBoundaryRequest.php         — Validation
backend/app/Models/App/GisDataset.php                    — Dataset catalog model
backend/app/Models/Cdm/LocationHistory.php               — OHDSI location_history
backend/app/Models/Cdm/ExternalExposure.php              — OHDSI external_exposure
```

### Frontend (React)
```
frontend/src/features/gis/
  pages/GisPage.tsx                      — Main GIS explorer page (map + panels)
  pages/GisAnalysisPage.tsx              — Detailed analysis drill-down
  components/GisMap.tsx                  — deck.gl map canvas wrapper
  components/BoundaryLayer.tsx           — Choropleth polygon layer
  components/MetricPanel.tsx             — Right-side metric/stat panel
  components/RegionDetail.tsx            — Region detail flyout
  components/LayerControls.tsx           — Layer toggle + admin level selector
  components/LegendPanel.tsx             — Color scale legend
  components/TimeSlider.tsx              — Temporal range selector
  hooks/useGis.ts                       — TanStack Query hooks for GIS API
  hooks/useMapViewport.ts               — Viewport state management
  types.ts                              — TypeScript types
  api.ts                                — API client functions
```

---

## Chunk 1: Database Foundation + PostGIS Setup

### Task 1: Enable PostGIS Extension

**Files:**
- Create: `backend/database/migrations/2026_03_11_000001_enable_postgis_extension.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis_topology');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS postgis_topology CASCADE');
        DB::statement('DROP EXTENSION IF EXISTS postgis CASCADE');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating: 2026_03_11_000001_enable_postgis_extension ... DONE"

**IMPORTANT:** The Docker PG image is `pgvector/pgvector:pg16` which does NOT include PostGIS. You MUST update the Docker image FIRST before running this migration.

- [ ] **Step 1b (REQUIRED): Update Docker image to include PostGIS**

Modify `docker-compose.yml` to build from a custom Dockerfile instead of using the image directly:

```yaml
  postgres:
    container_name: parthenon-postgres
    build:
      context: .
      dockerfile: docker/postgres/Dockerfile
    # ... rest unchanged (remove or comment out the `image:` line)
```

Create `docker/postgres/Dockerfile`:
```dockerfile
FROM pgvector/pgvector:pg16
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-16-postgis-3 \
    && rm -rf /var/lib/apt/lists/*
```

Then rebuild: `docker compose up -d --build postgres`

- [ ] **Step 3: Verify PostGIS is active**

Run: `docker compose exec postgres psql -U parthenon -c "SELECT PostGIS_Version();"`
Expected: `3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1` (or similar)

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_11_000001_enable_postgis_extension.php
git add docker/postgres/Dockerfile docker-compose.yml
git commit -m "feat(gis): enable PostGIS extension on Docker PostgreSQL"
```

---

### Task 2: Create GIS Boundary Tables

**Files:**
- Create: `backend/database/migrations/2026_03_11_000002_create_gis_boundary_tables.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Boundary levels catalog (ADM0 = country, ADM1 = state, etc.)
        Schema::create('app.gis_boundary_levels', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();         // 'ADM0', 'ADM1', etc.
            $table->string('label');                       // 'Country', 'Province/State', etc.
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Admin boundaries — PostGIS geometry column added via raw SQL
        Schema::create('app.gis_admin_boundaries', function (Blueprint $table) {
            $table->id();
            $table->string('gid', 50)->unique();            // GADM GID (e.g., 'USA.5.3_1')
            $table->string('name');                         // Region name
            $table->string('name_variant')->nullable();     // Alternate/local name
            $table->string('country_code', 3)->index();     // ISO 3166-1 alpha-3
            $table->string('country_name');
            $table->foreignId('boundary_level_id')
                  ->constrained('app.gis_boundary_levels');
            $table->string('parent_gid', 50)->nullable()->index(); // Parent region GID
            $table->string('type')->nullable();             // 'State', 'Province', 'District', etc.
            $table->string('type_en')->nullable();          // English type name
            $table->string('iso_code', 10)->nullable();     // ISO sub-national code
            $table->string('hasc_code', 20)->nullable();    // HASC code
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->string('source', 20)->default('gadm');  // 'gadm' or 'geoboundaries'
            $table->string('source_version', 20)->nullable();
            $table->timestamps();
        });

        // Add PostGIS geometry column (MULTIPOLYGON, SRID 4326 = WGS84)
        DB::statement("SELECT AddGeometryColumn('app', 'gis_admin_boundaries', 'geom', 4326, 'MULTIPOLYGON', 2)");

        // Spatial index for fast ST_Within / ST_Intersects queries
        DB::statement('CREATE INDEX idx_gis_boundaries_geom ON app.gis_admin_boundaries USING GIST (geom)');

        // Composite index for level + country filtering
        DB::statement('CREATE INDEX idx_gis_boundaries_level_country ON app.gis_admin_boundaries (boundary_level_id, country_code)');
    }

    public function down(): void
    {
        Schema::dropIfExists('app.gis_admin_boundaries');
        Schema::dropIfExists('app.gis_boundary_levels');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating: 2026_03_11_000002_create_gis_boundary_tables ... DONE"

- [ ] **Step 3: Verify table and geometry column exist**

Run: `docker compose exec postgres psql -U parthenon -c "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='app' AND table_name='gis_admin_boundaries' ORDER BY ordinal_position;"`
Expected: Should show `geom` column with `geometry` type among other columns.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_11_000002_create_gis_boundary_tables.php
git commit -m "feat(gis): create admin boundary tables with PostGIS geometry"
```

---

### Task 3: Create OHDSI CDM Extension Tables

**Files:**
- Create: `backend/database/migrations/2026_03_11_000003_create_location_history_table.php`
- Create: `backend/database/migrations/2026_03_11_000004_create_external_exposure_table.php`

- [ ] **Step 1: Create location_history migration**

This follows the OHDSI GIS CDM extension spec. It links a person to a location over a time period.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.location_history', function (Blueprint $table) {
            $table->id('location_history_id');
            $table->bigInteger('entity_id');               // person_id, care_site_id, etc.
            $table->string('domain_id', 50);               // 'Person', 'CareSite', 'Provider'
            $table->bigInteger('location_id');              // FK to CDM location table
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->bigInteger('relationship_type_concept_id')->nullable();
            $table->timestamps();

            $table->index(['entity_id', 'domain_id']);
            $table->index('location_id');
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app.location_history');
    }
};
```

- [ ] **Step 2: Create external_exposure migration**

This is the core OHDSI GIS output table — analogous to `drug_exposure` but for environmental/geospatial exposures.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.external_exposure', function (Blueprint $table) {
            $table->id('external_exposure_id');
            $table->bigInteger('person_id')->index();
            $table->bigInteger('exposure_concept_id')->index();    // FK to concept
            $table->date('exposure_start_date');
            $table->date('exposure_end_date')->nullable();
            $table->float('value_as_number')->nullable();          // PM2.5 value, SVI score, etc.
            $table->string('value_as_string', 255)->nullable();
            $table->bigInteger('value_as_concept_id')->nullable();
            $table->string('unit_source_value', 50)->nullable();   // 'µg/m³', 'index', etc.
            $table->bigInteger('unit_concept_id')->nullable();
            $table->bigInteger('location_id')->nullable();         // FK to CDM location
            $table->bigInteger('boundary_id')->nullable();         // FK to gis_admin_boundaries
            $table->bigInteger('qualifier_concept_id')->nullable();
            $table->bigInteger('exposure_type_concept_id')->nullable();
            $table->bigInteger('exposure_source_concept_id')->nullable();
            $table->string('exposure_source_value', 255)->nullable();
            $table->timestamps();

            $table->index('exposure_concept_id');
            $table->index(['exposure_start_date', 'exposure_end_date']);
            $table->index('boundary_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app.external_exposure');
    }
};
```

- [ ] **Step 3: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: Both migrations complete successfully.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_11_00000{3,4}_create_*.php
git commit -m "feat(gis): add OHDSI location_history and external_exposure CDM extension tables"
```

---

### Task 4: Create GIS Datasets Catalog Table

**Files:**
- Create: `backend/database/migrations/2026_03_11_000005_create_gis_datasets_table.php`
- Create: `backend/app/Models/App/GisDataset.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.gis_datasets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('source');                        // 'gadm', 'geoboundaries', 'epa', 'cdc', etc.
            $table->string('source_version')->nullable();
            $table->string('source_url')->nullable();
            $table->string('data_type', 20);                 // 'boundary', 'exposure', 'indicator'
            $table->string('geometry_type', 20)->nullable();  // 'MultiPolygon', 'Point', null
            $table->string('file_path')->nullable();          // Local path to source file
            $table->integer('feature_count')->default(0);
            $table->string('status', 20)->default('pending'); // pending, loading, loaded, error
            $table->text('error_message')->nullable();
            $table->timestamp('loaded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app.gis_datasets');
    }
};
```

- [ ] **Step 2: Create Eloquent model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GisDataset extends Model
{
    use HasFactory;

    protected $table = 'app.gis_datasets';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'source',
        'source_version',
        'source_url',
        'data_type',
        'geometry_type',
        'file_path',
        'feature_count',
        'status',
        'error_message',
        'loaded_at',
    ];

    protected function casts(): array
    {
        return [
            'loaded_at' => 'datetime',
            'feature_count' => 'integer',
        ];
    }
}
```

- [ ] **Step 3: Run migration**

Run: `docker compose exec php php artisan migrate`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_11_000005_create_gis_datasets_table.php
git add backend/app/Models/App/GisDataset.php
git commit -m "feat(gis): add GIS datasets catalog table and model"
```

---

### Task 5: Create OHDSI CDM Extension Models

**Files:**
- Create: `backend/app/Models/Cdm/LocationHistory.php`
- Create: `backend/app/Models/Cdm/ExternalExposure.php`

- [ ] **Step 1: Create LocationHistory model**

```php
<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Model;

class LocationHistory extends Model
{
    protected $table = 'app.location_history';
    protected $primaryKey = 'location_history_id';

    protected $fillable = [
        'entity_id',
        'domain_id',
        'location_id',
        'start_date',
        'end_date',
        'relationship_type_concept_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }
}
```

- [ ] **Step 2: Create ExternalExposure model**

```php
<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Model;

class ExternalExposure extends Model
{
    protected $table = 'app.external_exposure';
    protected $primaryKey = 'external_exposure_id';

    protected $fillable = [
        'person_id',
        'exposure_concept_id',
        'exposure_start_date',
        'exposure_end_date',
        'value_as_number',
        'value_as_string',
        'value_as_concept_id',
        'unit_source_value',
        'unit_concept_id',
        'location_id',
        'boundary_id',
        'qualifier_concept_id',
        'exposure_type_concept_id',
        'exposure_source_concept_id',
        'exposure_source_value',
    ];

    protected function casts(): array
    {
        return [
            'exposure_start_date' => 'date',
            'exposure_end_date' => 'date',
            'value_as_number' => 'float',
        ];
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Models/Cdm/LocationHistory.php
git add backend/app/Models/Cdm/ExternalExposure.php
git commit -m "feat(gis): add LocationHistory and ExternalExposure CDM extension models"
```

---

## Chunk 2: Python Spatial Service

### Task 6: Add Python GIS Dependencies

**Files:**
- Modify: `ai/requirements.txt`

- [ ] **Step 1: Add GIS packages to requirements.txt**

Append these lines to `ai/requirements.txt`:

```
# GIS / Spatial
geopandas>=1.0.0
shapely>=2.0.0
fiona>=1.10.0
pyproj>=3.7.0
asyncpg>=0.30.0
```

Note: `psycopg2-binary` should already be in requirements (used by existing DB connections). `geopandas` brings shapely + fiona for reading GeoPackage/GeoJSON. `asyncpg` enables async PostGIS queries from FastAPI.

- [ ] **Step 2: Rebuild Python container**

Run: `docker compose build python-ai && docker compose up -d python-ai`
Expected: Container rebuilds with new packages, health check passes.

- [ ] **Step 3: Verify packages installed**

Run: `docker compose exec python-ai python -c "import geopandas; import shapely; print('OK', geopandas.__version__)"`
Expected: `OK 1.x.x`

- [ ] **Step 4: Commit**

```bash
git add ai/requirements.txt
git commit -m "feat(gis): add geospatial Python dependencies"
```

---

### Task 7: Create Pydantic Models for GIS API

**Files:**
- Create: `ai/app/models/gis.py`

- [ ] **Step 1: Create Pydantic models**

```python
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class BoundaryLevel(str, Enum):
    ADM0 = "ADM0"
    ADM1 = "ADM1"
    ADM2 = "ADM2"
    ADM3 = "ADM3"
    ADM4 = "ADM4"
    ADM5 = "ADM5"


class BoundaryFeature(BaseModel):
    id: int
    gid: str
    name: str
    country_code: str
    country_name: str
    level: BoundaryLevel
    parent_gid: str | None = None
    type_en: str | None = None


class BoundaryGeoJSON(BaseModel):
    """GeoJSON FeatureCollection for map rendering."""
    type: str = "FeatureCollection"
    features: list[dict]  # GeoJSON Feature objects


class BoundaryQueryParams(BaseModel):
    level: BoundaryLevel = BoundaryLevel.ADM0
    country_code: str | None = None
    parent_gid: str | None = None
    bbox: str | None = Field(
        None,
        description="Bounding box: 'west,south,east,north' in WGS84 degrees",
        pattern=r"^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$",
    )
    simplify_tolerance: float = Field(
        0.01,
        ge=0.0,
        le=1.0,
        description="ST_Simplify tolerance in degrees. 0.01 ~= 1km. Higher = faster/coarser.",
    )


class RegionStats(BaseModel):
    boundary_id: int
    gid: str
    name: str
    country_code: str
    level: str
    patient_count: int = 0
    condition_counts: dict[str, int] = {}
    exposure_summary: dict[str, float] = {}


class DatasetInfo(BaseModel):
    id: int
    name: str
    slug: str
    source: str
    data_type: str
    feature_count: int
    status: str
    loaded_at: date | None = None


class LoadDatasetRequest(BaseModel):
    source: str = Field(description="'gadm' or 'geoboundaries'")
    levels: list[BoundaryLevel] = Field(
        default=[BoundaryLevel.ADM0, BoundaryLevel.ADM1],
        description="Which admin levels to load",
    )
    country_codes: list[str] | None = Field(
        None,
        description="ISO 3166-1 alpha-3 codes to filter. None = load all countries.",
    )


class ChoroplethMetric(str, Enum):
    PATIENT_COUNT = "patient_count"
    CONDITION_PREVALENCE = "condition_prevalence"
    INCIDENCE_RATE = "incidence_rate"
    EXPOSURE_VALUE = "exposure_value"
    MORTALITY_RATE = "mortality_rate"


class ChoroplethRequest(BaseModel):
    level: BoundaryLevel = BoundaryLevel.ADM1
    country_code: str | None = None
    metric: ChoroplethMetric = ChoroplethMetric.PATIENT_COUNT
    concept_id: int | None = Field(
        None,
        description="OMOP concept_id to filter by (condition, drug, exposure, etc.)",
    )
    date_from: date | None = None
    date_to: date | None = None
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/models/gis.py
git commit -m "feat(gis): add Pydantic models for GIS API"
```

---

### Task 8: Create Boundary Loader Service

**Files:**
- Create: `ai/app/services/gis_boundary_loader.py`

- [ ] **Step 1: Create the boundary loading service**

This service reads GADM GeoPackage and geoBoundaries GeoJSON files, then bulk-inserts into PostGIS.

```python
from __future__ import annotations

import logging
import os
from pathlib import Path

import geopandas as gpd
from shapely.geometry import MultiPolygon, mapping
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.gis import BoundaryLevel

logger = logging.getLogger(__name__)

GIS_DATA_DIR = Path(os.getenv("GIS_DATA_DIR", "/app/gis_data"))

LEVEL_LABELS = {
    "ADM0": "Country",
    "ADM1": "Province / State",
    "ADM2": "District / County",
    "ADM3": "Sub-district",
    "ADM4": "Municipality",
    "ADM5": "Local Area",
}

DATABASE_URL = os.getenv("DATABASE_URL", "")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


def get_engine():
    return create_async_engine(ASYNC_DATABASE_URL, pool_size=5)


async def ensure_boundary_levels(session: AsyncSession) -> dict[str, int]:
    """Seed the boundary_levels table if empty, return code->id mapping."""
    result = await session.execute(
        text("SELECT id, code FROM app.gis_boundary_levels")
    )
    existing = {row.code: row.id for row in result}

    for i, (code, label) in enumerate(LEVEL_LABELS.items()):
        if code not in existing:
            result = await session.execute(
                text(
                    "INSERT INTO app.gis_boundary_levels (code, label, sort_order, created_at, updated_at) "
                    "VALUES (:code, :label, :sort, NOW(), NOW()) RETURNING id"
                ),
                {"code": code, "label": label, "sort": i},
            )
            existing[code] = result.scalar_one()
    await session.commit()
    return existing


async def load_gadm(
    levels: list[BoundaryLevel],
    country_codes: list[str] | None = None,
    batch_size: int = 500,
) -> int:
    """Load GADM GeoPackage boundaries into PostGIS.

    Returns the number of features loaded.
    """
    gpkg_path = GIS_DATA_DIR / "gadm_410.gpkg"
    if not gpkg_path.exists():
        raise FileNotFoundError(f"GADM file not found: {gpkg_path}")

    logger.info("Reading GADM GeoPackage from %s", gpkg_path)
    gdf = gpd.read_file(str(gpkg_path))
    logger.info("GADM loaded: %d features", len(gdf))

    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            level_num = int(level.value.replace("ADM", ""))
            gid_col = f"GID_{level_num}"
            name_col = f"NAME_{level_num}"

            if gid_col not in gdf.columns:
                logger.warning("Column %s not in GADM, skipping level %s", gid_col, level)
                continue

            # Filter to rows that have data at this level
            level_df = gdf[gdf[gid_col].notna()].copy()

            if country_codes:
                level_df = level_df[level_df["GID_0"].isin(country_codes)]

            # Deduplicate by GID at this level
            level_df = level_df.drop_duplicates(subset=[gid_col])

            logger.info("Loading %d %s boundaries", len(level_df), level.value)

            rows = []
            for _, row in level_df.iterrows():
                geom = row.geometry
                if geom is None:
                    continue
                if geom.geom_type == "Polygon":
                    geom = MultiPolygon([geom])

                parent_gid = None
                if level_num > 0:
                    parent_col = f"GID_{level_num - 1}"
                    parent_gid = row.get(parent_col)

                rows.append({
                    "gid": str(row[gid_col]),
                    "name": str(row[name_col]) if row[name_col] else "Unknown",
                    "name_variant": str(row.get(f"VARNAME_{level_num}", "") or ""),
                    "country_code": str(row["GID_0"]),
                    "country_name": str(row["NAME_0"]),
                    "boundary_level_id": level_map[level.value],
                    "parent_gid": str(parent_gid) if parent_gid else None,
                    "type_en": str(row.get(f"ENGTYPE_{level_num}", "") or ""),
                    "iso_code": str(row.get("ISO_1", "") or "") if level_num == 1 else None,
                    "source": "gadm",
                    "source_version": "4.1.0",
                    "geom_wkt": geom.wkt,
                })

            # Batch insert
            for i in range(0, len(rows), batch_size):
                batch = rows[i : i + batch_size]
                for r in batch:
                    await session.execute(
                        text(
                            "INSERT INTO app.gis_admin_boundaries "
                            "(gid, name, name_variant, country_code, country_name, "
                            "boundary_level_id, parent_gid, type_en, iso_code, "
                            "source, source_version, geom, created_at, updated_at) "
                            "VALUES (:gid, :name, :name_variant, :country_code, :country_name, "
                            ":boundary_level_id, :parent_gid, :type_en, :iso_code, "
                            ":source, :source_version, "
                            "ST_Multi(ST_GeomFromText(:geom_wkt, 4326)), NOW(), NOW()) "
                            "ON CONFLICT (gid) DO NOTHING"
                        ),
                        r,
                    )
                await session.commit()
                total_loaded += len(batch)
                logger.info("  Loaded %d / %d %s features", min(i + batch_size, len(rows)), len(rows), level.value)

    await engine.dispose()
    return total_loaded


async def load_geoboundaries(
    levels: list[BoundaryLevel],
    batch_size: int = 500,
) -> int:
    """Load geoBoundaries CGAZ GeoJSON files into PostGIS.

    Returns the number of features loaded.
    """
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            filename = f"geoBoundariesCGAZ_{level.value}.geojson"
            geojson_path = GIS_DATA_DIR / filename
            if not geojson_path.exists():
                logger.warning("File not found: %s, skipping", geojson_path)
                continue

            logger.info("Reading %s", geojson_path)
            gdf = gpd.read_file(str(geojson_path))
            logger.info("Loaded %d features from %s", len(gdf), filename)

            for i in range(0, len(gdf), batch_size):
                batch_df = gdf.iloc[i : i + batch_size]
                for _, row in batch_df.iterrows():
                    geom = row.geometry
                    if geom is None:
                        continue
                    if geom.geom_type == "Polygon":
                        geom = MultiPolygon([geom])

                    gid = row.get("shapeID", row.get("shapeGroup", ""))
                    name = row.get("shapeName", "Unknown")
                    country_code = row.get("shapeGroup", "")

                    await session.execute(
                        text(
                            "INSERT INTO app.gis_admin_boundaries "
                            "(gid, name, country_code, country_name, "
                            "boundary_level_id, source, source_version, "
                            "geom, created_at, updated_at) "
                            "VALUES (:gid, :name, :cc, :cn, :level_id, "
                            "'geoboundaries', 'CGAZ', "
                            "ST_Multi(ST_GeomFromText(:geom_wkt, 4326)), NOW(), NOW()) "
                            "ON CONFLICT (gid) DO NOTHING"
                        ),
                        {
                            "gid": str(gid),
                            "name": str(name),
                            "cc": str(country_code),
                            "cn": str(name) if level.value == "ADM0" else "",
                            "level_id": level_map[level.value],
                            "geom_wkt": geom.wkt,
                        },
                    )
                await session.commit()
                total_loaded += len(batch_df)
                logger.info("  Loaded %d / %d %s features", min(i + batch_size, len(gdf)), len(gdf), level.value)

    await engine.dispose()
    return total_loaded
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/services/gis_boundary_loader.py
git commit -m "feat(gis): add GADM and geoBoundaries PostGIS boundary loader"
```

---

### Task 9: Create Spatial Query Service

**Files:**
- Create: `ai/app/services/gis_spatial_query.py`

- [ ] **Step 1: Create the spatial query service**

```python
from __future__ import annotations

import json
import logging
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.gis import BoundaryLevel, ChoroplethMetric

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


def get_engine():
    return create_async_engine(ASYNC_DATABASE_URL, pool_size=5)


async def get_boundaries_geojson(
    level: BoundaryLevel,
    country_code: str | None = None,
    parent_gid: str | None = None,
    bbox: str | None = None,
    simplify_tolerance: float = 0.01,
) -> dict:
    """Return GeoJSON FeatureCollection of admin boundaries.

    Uses ST_Simplify to reduce geometry complexity for map rendering.
    Uses ST_AsGeoJSON for direct GeoJSON output from PostGIS.
    """
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["bl.code = :level"]
    params: dict = {"level": level.value, "tol": simplify_tolerance}

    if country_code:
        conditions.append("b.country_code = :cc")
        params["cc"] = country_code

    if parent_gid:
        conditions.append("b.parent_gid = :pgid")
        params["pgid"] = parent_gid

    if bbox:
        west, south, east, north = [float(x) for x in bbox.split(",")]
        conditions.append(
            "b.geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)"
        )
        params.update({"west": west, "south": south, "east": east, "north": north})

    where_clause = " AND ".join(conditions)

    query = text(f"""
        SELECT
            b.id,
            b.gid,
            b.name,
            b.country_code,
            b.country_name,
            b.type_en,
            b.parent_gid,
            ST_AsGeoJSON(ST_Simplify(b.geom, :tol))::json AS geometry
        FROM app.gis_admin_boundaries b
        JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
        WHERE {where_clause}
        ORDER BY b.country_code, b.name
    """)

    async with async_session() as session:
        result = await session.execute(query, params)
        rows = result.fetchall()

    await engine.dispose()

    features = []
    for row in rows:
        if row.geometry is None:
            continue
        features.append({
            "type": "Feature",
            "id": row.id,
            "geometry": row.geometry,
            "properties": {
                "id": row.id,
                "gid": row.gid,
                "name": row.name,
                "country_code": row.country_code,
                "country_name": row.country_name,
                "type": row.type_en,
                "parent_gid": row.parent_gid,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


async def get_choropleth_data(
    level: BoundaryLevel,
    metric: ChoroplethMetric,
    country_code: str | None = None,
    concept_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """Compute per-region metric values for choropleth coloring.

    Returns list of {boundary_id, gid, name, value} objects.
    """
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    if metric == ChoroplethMetric.PATIENT_COUNT:
        query = text("""
            SELECT
                b.id AS boundary_id,
                b.gid,
                b.name,
                b.country_code,
                COUNT(DISTINCT lh.entity_id) AS value
            FROM app.gis_admin_boundaries b
            JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
            LEFT JOIN app.location_history lh
                ON lh.domain_id = 'Person'
                AND ST_Within(
                    (SELECT geom FROM app.gis_admin_boundaries WHERE id = lh.location_id LIMIT 1),
                    b.geom
                )
            WHERE bl.code = :level
              AND (:cc IS NULL OR b.country_code = :cc)
            GROUP BY b.id, b.gid, b.name, b.country_code
            ORDER BY value DESC
        """)
        params = {"level": level.value, "cc": country_code}

    elif metric == ChoroplethMetric.EXPOSURE_VALUE:
        query = text("""
            SELECT
                b.id AS boundary_id,
                b.gid,
                b.name,
                b.country_code,
                AVG(ee.value_as_number) AS value
            FROM app.gis_admin_boundaries b
            JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
            LEFT JOIN app.external_exposure ee ON ee.boundary_id = b.id
            WHERE bl.code = :level
              AND (:cc IS NULL OR b.country_code = :cc)
              AND (:concept_id IS NULL OR ee.exposure_concept_id = :concept_id)
              AND (:date_from IS NULL OR ee.exposure_start_date >= :date_from::date)
              AND (:date_to IS NULL OR ee.exposure_end_date <= :date_to::date)
            GROUP BY b.id, b.gid, b.name, b.country_code
            HAVING AVG(ee.value_as_number) IS NOT NULL
            ORDER BY value DESC
        """)
        params = {
            "level": level.value,
            "cc": country_code,
            "concept_id": concept_id,
            "date_from": date_from,
            "date_to": date_to,
        }
    else:
        # Default: return empty for unimplemented metrics
        return []

    async with async_session() as session:
        result = await session.execute(query, params)
        rows = result.fetchall()

    await engine.dispose()

    return [
        {
            "boundary_id": row.boundary_id,
            "gid": row.gid,
            "name": row.name,
            "country_code": row.country_code,
            "value": float(row.value) if row.value else 0.0,
        }
        for row in rows
    ]


async def get_region_detail(boundary_id: int) -> dict | None:
    """Get detailed stats for a single region."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Basic boundary info
        result = await session.execute(
            text("""
                SELECT
                    b.id, b.gid, b.name, b.country_code, b.country_name,
                    b.type_en, b.parent_gid, bl.code AS level,
                    ST_Area(b.geom::geography) / 1e6 AS area_km2
                FROM app.gis_admin_boundaries b
                JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
                WHERE b.id = :id
            """),
            {"id": boundary_id},
        )
        row = result.fetchone()
        if row is None:
            return None

        # Count children
        children_result = await session.execute(
            text("SELECT COUNT(*) FROM app.gis_admin_boundaries WHERE parent_gid = :gid"),
            {"gid": row.gid},
        )
        child_count = children_result.scalar() or 0

        # Exposure stats for this region
        exposure_result = await session.execute(
            text("""
                SELECT
                    ee.exposure_concept_id,
                    COUNT(*) AS record_count,
                    AVG(ee.value_as_number) AS avg_value,
                    MIN(ee.value_as_number) AS min_value,
                    MAX(ee.value_as_number) AS max_value
                FROM app.external_exposure ee
                WHERE ee.boundary_id = :id
                GROUP BY ee.exposure_concept_id
                LIMIT 20
            """),
            {"id": boundary_id},
        )
        exposures = [
            {
                "concept_id": r.exposure_concept_id,
                "count": r.record_count,
                "avg": float(r.avg_value) if r.avg_value else None,
                "min": float(r.min_value) if r.min_value else None,
                "max": float(r.max_value) if r.max_value else None,
            }
            for r in exposure_result
        ]

    await engine.dispose()

    return {
        "id": row.id,
        "gid": row.gid,
        "name": row.name,
        "country_code": row.country_code,
        "country_name": row.country_name,
        "level": row.level,
        "type": row.type_en,
        "parent_gid": row.parent_gid,
        "area_km2": round(row.area_km2, 2) if row.area_km2 else None,
        "child_count": child_count,
        "exposures": exposures,
    }


async def get_boundary_stats() -> dict:
    """Get summary statistics about loaded boundaries."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT bl.code, bl.label, COUNT(b.id) AS count
            FROM app.gis_boundary_levels bl
            LEFT JOIN app.gis_admin_boundaries b ON b.boundary_level_id = bl.id
            GROUP BY bl.code, bl.label, bl.sort_order
            ORDER BY bl.sort_order
        """))
        levels = [
            {"code": r.code, "label": r.label, "count": r.count}
            for r in result
        ]

        total_result = await session.execute(
            text("SELECT COUNT(*) FROM app.gis_admin_boundaries")
        )
        total = total_result.scalar() or 0

        country_result = await session.execute(
            text("SELECT COUNT(DISTINCT country_code) FROM app.gis_admin_boundaries")
        )
        countries = country_result.scalar() or 0

    await engine.dispose()

    return {
        "total_boundaries": total,
        "total_countries": countries,
        "levels": levels,
    }
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/services/gis_spatial_query.py
git commit -m "feat(gis): add spatial query service for boundaries, choropleth, and region detail"
```

---

### Task 10: Create GIS API Router

**Files:**
- Create: `ai/app/routers/gis.py`
- Modify: `ai/app/routers/__init__.py` (add router registration)

- [ ] **Step 1: Create the GIS router**

```python
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.models.gis import (
    BoundaryLevel,
    BoundaryQueryParams,
    ChoroplethMetric,
    ChoroplethRequest,
    LoadDatasetRequest,
)
from app.services.gis_boundary_loader import load_gadm, load_geoboundaries
from app.services.gis_spatial_query import (
    get_boundaries_geojson,
    get_boundary_stats,
    get_choropleth_data,
    get_region_detail,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["GIS"])


@router.get("/boundaries")
async def boundaries(
    level: BoundaryLevel = Query(BoundaryLevel.ADM0),
    country_code: str | None = Query(None),
    parent_gid: str | None = Query(None),
    bbox: str | None = Query(None),
    simplify: float = Query(0.01, ge=0.0, le=1.0),
):
    """Get admin boundaries as GeoJSON FeatureCollection.

    Use `simplify` to control geometry detail (higher = faster, coarser).
    Use `bbox` to clip to viewport (format: 'west,south,east,north').
    """
    return await get_boundaries_geojson(
        level=level,
        country_code=country_code,
        parent_gid=parent_gid,
        bbox=bbox,
        simplify_tolerance=simplify,
    )


@router.get("/boundaries/{boundary_id}")
async def boundary_detail(boundary_id: int):
    """Get detailed statistics for a single region."""
    detail = await get_region_detail(boundary_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Boundary not found")
    return detail


@router.get("/stats")
async def stats():
    """Get summary statistics about loaded GIS data."""
    return await get_boundary_stats()


@router.post("/choropleth")
async def choropleth(request: ChoroplethRequest):
    """Compute choropleth metric values for map coloring."""
    return await get_choropleth_data(
        level=request.level,
        metric=request.metric,
        country_code=request.country_code,
        concept_id=request.concept_id,
        date_from=str(request.date_from) if request.date_from else None,
        date_to=str(request.date_to) if request.date_to else None,
    )


@router.post("/load")
async def load_dataset(request: LoadDatasetRequest):
    """Load boundary data from local GIS files into PostGIS.

    This is an admin operation — loads GADM or geoBoundaries data.
    Can filter by admin level and country code.
    """
    try:
        if request.source == "gadm":
            count = await load_gadm(
                levels=request.levels,
                country_codes=request.country_codes,
            )
        elif request.source == "geoboundaries":
            count = await load_geoboundaries(levels=request.levels)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown source: {request.source}. Use 'gadm' or 'geoboundaries'.",
            )

        return {"status": "ok", "features_loaded": count}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to load GIS dataset")
        raise HTTPException(status_code=500, detail=f"Load failed: {e}")


@router.get("/countries")
async def list_countries():
    """List all countries with loaded boundaries."""
    from sqlalchemy import text as sql_text
    from app.services.gis_spatial_query import get_engine
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(sql_text("""
            SELECT DISTINCT country_code, country_name,
                   COUNT(*) AS boundary_count
            FROM app.gis_admin_boundaries
            GROUP BY country_code, country_name
            ORDER BY country_name
        """))
        countries = [
            {"code": r.country_code, "name": r.country_name, "boundaries": r.boundary_count}
            for r in result
        ]

    await engine.dispose()
    return countries
```

- [ ] **Step 2: Register the router in `ai/app/main.py`**

Router registration happens in `main.py` via `app.include_router()`, NOT in `__init__.py`. Add the import and registration following the existing pattern:

```python
from app.routers import gis
```

And in the router registration block:
```python
app.include_router(gis.router, prefix="/gis", tags=["gis"])
```

- [ ] **Step 3: Mount GIS data directory in docker-compose.yml**

Add a volume mount to the `python-ai` service so it can access the GIS files:

```yaml
    volumes:
      - ./ai:/app
      - ./GIS:/app/gis_data:ro           # <-- ADD THIS LINE
      - ./backend/resources/help:/var/www/html/resources/help:ro
      - ./docs:/app/docs:ro
```

- [ ] **Step 4: Rebuild and test**

Run: `docker compose up -d --build python-ai`
Then: `curl http://localhost:8002/gis/stats`
Expected: `{"total_boundaries": 0, "total_countries": 0, "levels": []}` (empty until data is loaded)

- [ ] **Step 5: Commit**

```bash
git add ai/app/routers/gis.py ai/app/main.py docker-compose.yml
git commit -m "feat(gis): add GIS API router with boundary, choropleth, and load endpoints"
```

---

## Chunk 3: Laravel API Gateway

### Task 11: Create Laravel GIS Controller

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/GisController.php`
- Create: `backend/app/Http/Requests/GisBoundaryRequest.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create validation request**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisBoundaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'level' => ['sometimes', Rule::in(['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4', 'ADM5'])],
            'country_code' => ['sometimes', 'string', 'size:3'],
            'parent_gid' => ['sometimes', 'string'],
            'bbox' => ['sometimes', 'string', 'regex:/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/'],
            'simplify' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
```

- [ ] **Step 2: Create GIS controller**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GisBoundaryRequest;
use App\Models\App\GisDataset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GisController extends Controller
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Get admin boundaries as GeoJSON.
     */
    public function boundaries(GisBoundaryRequest $request): JsonResponse
    {
        $response = Http::timeout(30)->get("{$this->aiServiceUrl}/gis/boundaries", $request->validated());

        if ($response->failed()) {
            Log::error('GIS boundary request failed', ['status' => $response->status(), 'body' => $response->body()]);
            return response()->json(['error' => 'Failed to fetch boundaries'], $response->status());
        }

        return response()->json($response->json());
    }

    /**
     * Get detailed stats for a single region.
     */
    public function boundaryDetail(int $id): JsonResponse
    {
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/gis/boundaries/{$id}");

        if ($response->failed()) {
            return response()->json(['error' => 'Boundary not found'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Get GIS data summary statistics.
     */
    public function stats(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/gis/stats");

        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch GIS stats'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Compute choropleth data for map visualization.
     */
    public function choropleth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'level' => ['sometimes', 'string'],
            'metric' => ['sometimes', 'string'],
            'country_code' => ['sometimes', 'string', 'size:3'],
            'concept_id' => ['sometimes', 'integer'],
            'date_from' => ['sometimes', 'date'],
            'date_to' => ['sometimes', 'date'],
        ]);

        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/gis/choropleth", $validated);

        if ($response->failed()) {
            return response()->json(['error' => 'Choropleth query failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * List available countries with boundaries.
     */
    public function countries(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/gis/countries");

        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch countries'], 500);
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Load GIS dataset from local files (admin only).
     */
    public function loadDataset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', 'string', 'in:gadm,geoboundaries'],
            'levels' => ['sometimes', 'array'],
            'levels.*' => ['string', 'in:ADM0,ADM1,ADM2,ADM3,ADM4,ADM5'],
            'country_codes' => ['sometimes', 'array'],
            'country_codes.*' => ['string', 'size:3'],
        ]);

        $response = Http::timeout(300)->post("{$this->aiServiceUrl}/gis/load", $validated);

        if ($response->failed()) {
            return response()->json(['error' => 'Dataset load failed', 'detail' => $response->body()], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * List loaded GIS datasets.
     */
    public function datasets(): JsonResponse
    {
        $datasets = GisDataset::orderBy('name')->get();
        return response()->json(['data' => $datasets]);
    }
}
```

- [ ] **Step 3: Add routes to api.php**

Add inside the `Route::middleware('auth:sanctum')->group(function () {` block:

```php
        // GIS
        Route::prefix('gis')->group(function () {
            Route::get('/boundaries', [GisController::class, 'boundaries']);
            Route::get('/boundaries/{id}', [GisController::class, 'boundaryDetail']);
            Route::get('/stats', [GisController::class, 'stats']);
            Route::post('/choropleth', [GisController::class, 'choropleth']);
            Route::get('/countries', [GisController::class, 'countries']);
            Route::get('/datasets', [GisController::class, 'datasets']);
            Route::post('/load', [GisController::class, 'loadDataset'])->middleware('role:super-admin');
        });
```

Also add the import at the top of api.php:
```php
use App\Http\Controllers\Api\V1\GisController;
```

- [ ] **Step 4: Add AI service URL config**

Check if `config/services.php` already has an `ai` key. If not, add:

```php
    'ai' => [
        'url' => env('AI_SERVICE_URL', 'http://python-ai:8000'),
    ],
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GisController.php
git add backend/app/Http/Requests/GisBoundaryRequest.php
git add backend/routes/api.php
git add backend/config/services.php  # if modified
git commit -m "feat(gis): add Laravel GIS controller as API gateway to Python spatial service"
```

---

## Chunk 4: Frontend — Map Infrastructure

### Task 12: Install Frontend Map Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install deck.gl and map dependencies**

Run:
```bash
docker compose exec node sh -c "cd /app && npm install --legacy-peer-deps \
  deck.gl \
  @deck.gl/core \
  @deck.gl/layers \
  @deck.gl/geo-layers \
  @deck.gl/react \
  react-map-gl \
  maplibre-gl"
```

Note: `maplibre-gl` is the open-source fork of Mapbox GL JS — no API key needed. deck.gl uses it as the base map renderer.

- [ ] **Step 2: Verify installation**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit 2>&1 | head -5"`
Expected: No new type errors from the map packages.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(gis): install deck.gl, react-map-gl, and maplibre-gl"
```

---

### Task 13: Create GIS TypeScript Types

**Files:**
- Create: `frontend/src/features/gis/types.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface BoundaryLevel {
  code: string;
  label: string;
  count: number;
}

export interface GisStats {
  total_boundaries: number;
  total_countries: number;
  levels: BoundaryLevel[];
}

export interface BoundaryProperties {
  id: number;
  gid: string;
  name: string;
  country_code: string;
  country_name: string;
  type: string | null;
  parent_gid: string | null;
}

export interface BoundaryFeature {
  type: "Feature";
  id: number;
  geometry: GeoJSON.Geometry;
  properties: BoundaryProperties;
}

export interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

export interface ChoroplethDataPoint {
  boundary_id: number;
  gid: string;
  name: string;
  country_code: string;
  value: number;
}

export interface RegionDetail {
  id: number;
  gid: string;
  name: string;
  country_code: string;
  country_name: string;
  level: string;
  type: string | null;
  parent_gid: string | null;
  area_km2: number | null;
  child_count: number;
  exposures: ExposureSummary[];
}

export interface ExposureSummary {
  concept_id: number;
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface Country {
  code: string;
  name: string;
  boundaries: number;
}

export interface GisDataset {
  id: number;
  name: string;
  slug: string;
  source: string;
  data_type: string;
  feature_count: number;
  status: string;
  loaded_at: string | null;
}

export type AdminLevel = "ADM0" | "ADM1" | "ADM2" | "ADM3" | "ADM4" | "ADM5";

export type ChoroplethMetric =
  | "patient_count"
  | "condition_prevalence"
  | "incidence_rate"
  | "exposure_value"
  | "mortality_rate";

export interface MapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ChoroplethParams {
  level: AdminLevel;
  metric: ChoroplethMetric;
  country_code?: string;
  concept_id?: number;
  date_from?: string;
  date_to?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/types.ts
git commit -m "feat(gis): add TypeScript types for GIS feature"
```

---

### Task 14: Create GIS API Client and TanStack Query Hooks

**Files:**
- Create: `frontend/src/features/gis/api.ts`
- Create: `frontend/src/features/gis/hooks/useGis.ts`

- [ ] **Step 1: Create API client**

```typescript
import apiClient from "@/lib/api-client";
import type {
  AdminLevel,
  BoundaryCollection,
  ChoroplethDataPoint,
  ChoroplethParams,
  Country,
  GisStats,
  RegionDetail,
} from "./types";

export async function fetchBoundaries(params: {
  level?: AdminLevel;
  country_code?: string;
  parent_gid?: string;
  bbox?: string;
  simplify?: number;
}): Promise<BoundaryCollection> {
  const { data } = await apiClient.get("/gis/boundaries", { params });
  return data;
}

export async function fetchBoundaryDetail(id: number): Promise<RegionDetail> {
  const { data } = await apiClient.get(`/api/v1/gis/boundaries/${id}`);
  return data.data;
}

export async function fetchGisStats(): Promise<GisStats> {
  const { data } = await apiClient.get("/gis/stats");
  return data.data;
}

export async function fetchChoropleth(
  params: ChoroplethParams
): Promise<ChoroplethDataPoint[]> {
  const { data } = await apiClient.post("/gis/choropleth", params);
  return data.data;
}

export async function fetchCountries(): Promise<Country[]> {
  const { data } = await apiClient.get("/gis/countries");
  return data.data;
}

export async function loadGisDataset(params: {
  source: string;
  levels?: AdminLevel[];
  country_codes?: string[];
}): Promise<{ features_loaded: number }> {
  const { data } = await apiClient.post("/gis/load", params);
  return data.data;
}
```

- [ ] **Step 2: Create TanStack Query hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBoundaries,
  fetchBoundaryDetail,
  fetchGisStats,
  fetchChoropleth,
  fetchCountries,
  loadGisDataset,
} from "../api";
import type { AdminLevel, ChoroplethParams } from "../types";

export function useGisStats() {
  return useQuery({
    queryKey: ["gis", "stats"],
    queryFn: fetchGisStats,
    staleTime: 60_000,
  });
}

export function useBoundaries(params: {
  level?: AdminLevel;
  country_code?: string;
  parent_gid?: string;
  bbox?: string;
  simplify?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: ["gis", "boundaries", queryParams],
    queryFn: () => fetchBoundaries(queryParams),
    enabled,
    staleTime: 5 * 60_000, // Boundaries rarely change
  });
}

export function useBoundaryDetail(id: number | null) {
  return useQuery({
    queryKey: ["gis", "boundaries", id],
    queryFn: () => fetchBoundaryDetail(id!),
    enabled: id !== null,
  });
}

export function useChoropleth(params: ChoroplethParams | null) {
  return useQuery({
    queryKey: ["gis", "choropleth", params],
    queryFn: () => fetchChoropleth(params!),
    enabled: params !== null,
    staleTime: 30_000,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: ["gis", "countries"],
    queryFn: fetchCountries,
    staleTime: 5 * 60_000,
  });
}

export function useLoadDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loadGisDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gis"] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/api.ts frontend/src/features/gis/hooks/useGis.ts
git commit -m "feat(gis): add GIS API client and TanStack Query hooks"
```

---

### Task 15: Create Map Viewport Hook

**Files:**
- Create: `frontend/src/features/gis/hooks/useMapViewport.ts`

- [ ] **Step 1: Create viewport state hook**

```typescript
import { useState, useCallback } from "react";
import type { MapViewport } from "../types";

const INITIAL_VIEWPORT: MapViewport = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
};

export function useMapViewport(initial?: Partial<MapViewport>) {
  const [viewport, setViewport] = useState<MapViewport>({
    ...INITIAL_VIEWPORT,
    ...initial,
  });

  const onViewportChange = useCallback(
    (evt: { viewState: MapViewport }) => {
      setViewport(evt.viewState);
    },
    []
  );

  const flyTo = useCallback(
    (target: Partial<MapViewport>, duration = 1500) => {
      setViewport((prev) => ({
        ...prev,
        ...target,
      }));
    },
    []
  );

  const resetViewport = useCallback(() => {
    setViewport({ ...INITIAL_VIEWPORT, ...initial });
  }, [initial]);

  // Compute bounding box string for API queries
  const bbox = `${viewport.longitude - 180 / Math.pow(2, viewport.zoom)},${viewport.latitude - 90 / Math.pow(2, viewport.zoom)},${viewport.longitude + 180 / Math.pow(2, viewport.zoom)},${viewport.latitude + 90 / Math.pow(2, viewport.zoom)}`;

  return {
    viewport,
    onViewportChange,
    flyTo,
    resetViewport,
    bbox,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/hooks/useMapViewport.ts
git commit -m "feat(gis): add map viewport state management hook"
```

---

## Chunk 5: Frontend — Map Components

### Task 16: Create GisMap Component

**Files:**
- Create: `frontend/src/features/gis/components/GisMap.tsx`

- [ ] **Step 1: Create the deck.gl map wrapper**

```tsx
import { useCallback, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BoundaryCollection, ChoroplethDataPoint, MapViewport } from "../types";

// Open tile server — no API key needed
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface GisMapProps {
  viewport: MapViewport;
  onViewportChange: (evt: { viewState: MapViewport }) => void;
  boundaries: BoundaryCollection | null;
  choroplethData: ChoroplethDataPoint[] | null;
  selectedRegionId: number | null;
  onRegionClick: (id: number, name: string) => void;
  onRegionHover: (id: number | null, name: string | null) => void;
  loading?: boolean;
}

function valueToColor(value: number, max: number): [number, number, number, number] {
  if (max === 0) return [30, 30, 35, 180];
  const t = Math.min(value / max, 1);

  // Dark theme gradient: transparent dark → crimson (#9B1B30) → gold (#C9A227)
  if (t < 0.5) {
    const s = t * 2;
    return [
      Math.round(30 + s * (155 - 30)),
      Math.round(30 + s * (27 - 30)),
      Math.round(35 + s * (48 - 35)),
      Math.round(80 + s * 120),
    ];
  }
  const s = (t - 0.5) * 2;
  return [
    Math.round(155 + s * (201 - 155)),
    Math.round(27 + s * (162 - 27)),
    Math.round(48 + s * (39 - 48)),
    Math.round(200 + s * 55),
  ];
}

export function GisMap({
  viewport,
  onViewportChange,
  boundaries,
  choroplethData,
  selectedRegionId,
  onRegionClick,
  onRegionHover,
  loading,
}: GisMapProps) {
  const choroplethMap = useMemo(() => {
    if (!choroplethData) return new Map<number, number>();
    return new Map(choroplethData.map((d) => [d.boundary_id, d.value]));
  }, [choroplethData]);

  const maxValue = useMemo(() => {
    if (!choroplethData?.length) return 0;
    return Math.max(...choroplethData.map((d) => d.value));
  }, [choroplethData]);

  const layers = useMemo(() => {
    if (!boundaries) return [];

    return [
      new GeoJsonLayer({
        id: "boundaries",
        data: boundaries as unknown as GeoJSON.FeatureCollection,
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        lineWidthMinPixels: 1,
        getFillColor: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          const id = feature.properties.id;
          if (id === selectedRegionId) return [45, 212, 191, 180]; // teal highlight
          const value = choroplethMap.get(id) ?? 0;
          return valueToColor(value, maxValue);
        },
        getLineColor: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          return feature.properties.id === selectedRegionId
            ? [45, 212, 191, 255]
            : [80, 80, 85, 150];
        },
        getLineWidth: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          return feature.properties.id === selectedRegionId ? 3 : 1;
        },
        onClick: (info: { object?: { properties: { id: number; name: string } } }) => {
          if (info.object) {
            onRegionClick(info.object.properties.id, info.object.properties.name);
          }
        },
        onHover: (info: { object?: { properties: { id: number; name: string } } | null }) => {
          if (info.object) {
            onRegionHover(info.object.properties.id, info.object.properties.name);
          } else {
            onRegionHover(null, null);
          }
        },
        updateTriggers: {
          getFillColor: [choroplethMap, maxValue, selectedRegionId],
          getLineColor: [selectedRegionId],
          getLineWidth: [selectedRegionId],
        },
      }),
    ];
  }, [boundaries, choroplethMap, maxValue, selectedRegionId, onRegionClick, onRegionHover]);

  return (
    <div className="relative h-full w-full">
      <DeckGL
        viewState={viewport}
        onViewStateChange={onViewportChange}
        layers={layers}
        controller
        getCursor={({ isHovering }: { isHovering: boolean }) =>
          isHovering ? "pointer" : "grab"
        }
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      {loading && (
        <div className="absolute left-4 top-4 rounded bg-[#1A1A1F]/90 px-3 py-1.5 text-xs text-[#8A857D]">
          Loading boundaries...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/GisMap.tsx
git commit -m "feat(gis): add deck.gl GisMap component with choropleth rendering"
```

---

### Task 17: Create Layer Controls Component

**Files:**
- Create: `frontend/src/features/gis/components/LayerControls.tsx`

- [ ] **Step 1: Create the layer controls panel**

```tsx
import type { AdminLevel, ChoroplethMetric, Country } from "../types";

interface LayerControlsProps {
  level: AdminLevel;
  onLevelChange: (level: AdminLevel) => void;
  metric: ChoroplethMetric;
  onMetricChange: (metric: ChoroplethMetric) => void;
  countryCode: string | null;
  onCountryChange: (code: string | null) => void;
  countries: Country[];
}

const LEVEL_OPTIONS: { value: AdminLevel; label: string }[] = [
  { value: "ADM0", label: "Countries" },
  { value: "ADM1", label: "States / Provinces" },
  { value: "ADM2", label: "Districts / Counties" },
  { value: "ADM3", label: "Sub-districts" },
];

const METRIC_OPTIONS: { value: ChoroplethMetric; label: string }[] = [
  { value: "patient_count", label: "Patient Count" },
  { value: "condition_prevalence", label: "Condition Prevalence" },
  { value: "incidence_rate", label: "Incidence Rate" },
  { value: "exposure_value", label: "Exposure Value" },
  { value: "mortality_rate", label: "Mortality Rate" },
];

export function LayerControls({
  level,
  onLevelChange,
  metric,
  onMetricChange,
  countryCode,
  onCountryChange,
  countries,
}: LayerControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#232328] bg-[#141418] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        Map Controls
      </h3>

      {/* Admin Level */}
      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Boundary Level</label>
        <select
          value={level}
          onChange={(e) => onLevelChange(e.target.value as AdminLevel)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Metric */}
      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Metric</label>
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as ChoroplethMetric)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          {METRIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Country Filter */}
      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Country</label>
        <select
          value={countryCode ?? ""}
          onChange={(e) => onCountryChange(e.target.value || null)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.boundaries})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/LayerControls.tsx
git commit -m "feat(gis): add layer controls for admin level, metric, and country filter"
```

---

### Task 18: Create Legend and Region Detail Components

**Files:**
- Create: `frontend/src/features/gis/components/LegendPanel.tsx`
- Create: `frontend/src/features/gis/components/RegionDetail.tsx`

- [ ] **Step 1: Create LegendPanel**

```tsx
interface LegendPanelProps {
  metric: string;
  maxValue: number;
}

export function LegendPanel({ metric, maxValue }: LegendPanelProps) {
  const labels = [
    { pct: 0, label: "0" },
    { pct: 25, label: formatValue(maxValue * 0.25) },
    { pct: 50, label: formatValue(maxValue * 0.5) },
    { pct: 75, label: formatValue(maxValue * 0.75) },
    { pct: 100, label: formatValue(maxValue) },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        {metric.replace(/_/g, " ")}
      </div>
      <div
        className="h-3 w-full rounded"
        style={{
          background:
            "linear-gradient(to right, #1E1E23, #9B1B30, #C9A227)",
        }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-[#5A5650]">
        {labels.map((l) => (
          <span key={l.pct}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
```

- [ ] **Step 2: Create RegionDetail**

```tsx
import { Loader2, MapPin, Layers, BarChart3 } from "lucide-react";
import type { RegionDetail as RegionDetailType } from "../types";

interface RegionDetailProps {
  detail: RegionDetailType | null;
  loading: boolean;
  onClose: () => void;
  onDrillDown: (gid: string) => void;
}

export function RegionDetail({
  detail,
  loading,
  onClose,
  onDrillDown,
}: RegionDetailProps) {
  if (!detail && !loading) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#141418] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E8E4DC]">
          {loading ? "Loading..." : detail?.name}
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-[#5A5650] hover:text-[#E8E4DC]"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#5A5650]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading region details...
        </div>
      )}

      {detail && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#8A857D]">
              <MapPin className="h-3 w-3" />
              {detail.country_name}
            </div>
            <div className="flex items-center gap-1.5 text-[#8A857D]">
              <Layers className="h-3 w-3" />
              {detail.level} — {detail.type ?? "Region"}
            </div>
          </div>

          {detail.area_km2 !== null && (
            <div className="text-xs text-[#5A5650]">
              Area: {detail.area_km2.toLocaleString()} km²
            </div>
          )}

          {detail.child_count > 0 && (
            <button
              onClick={() => onDrillDown(detail.gid)}
              className="w-full rounded border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs text-[#C9A227] hover:border-[#C9A227]/50"
            >
              Drill down ({detail.child_count} sub-regions)
            </button>
          )}

          {detail.exposures.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5A5650]">
                <BarChart3 className="h-3 w-3" />
                Exposures
              </div>
              <div className="space-y-1">
                {detail.exposures.map((exp) => (
                  <div
                    key={exp.concept_id}
                    className="flex items-center justify-between rounded bg-[#0E0E11] px-2 py-1 text-xs"
                  >
                    <span className="text-[#8A857D]">
                      Concept {exp.concept_id}
                    </span>
                    <span className="text-[#E8E4DC]">
                      avg: {exp.avg?.toFixed(2) ?? "—"} ({exp.count} records)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/components/LegendPanel.tsx
git add frontend/src/features/gis/components/RegionDetail.tsx
git commit -m "feat(gis): add legend panel and region detail flyout components"
```

---

## Chunk 6: Frontend — GIS Page + Routing

### Task 19: Create Main GIS Page

**Files:**
- Create: `frontend/src/features/gis/pages/GisPage.tsx`

- [ ] **Step 1: Create the GIS explorer page**

```tsx
import { useState, useCallback, useMemo } from "react";
import { Globe, Database, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { GisMap } from "../components/GisMap";
import { LayerControls } from "../components/LayerControls";
import { LegendPanel } from "../components/LegendPanel";
import { RegionDetail } from "../components/RegionDetail";
import {
  useGisStats,
  useBoundaries,
  useBoundaryDetail,
  useChoropleth,
  useCountries,
  useLoadDataset,
} from "../hooks/useGis";
import { useMapViewport } from "../hooks/useMapViewport";
import type { AdminLevel, ChoroplethMetric, ChoroplethParams } from "../types";
import { HelpButton } from "@/features/help";

export default function GisPage() {
  // Map state
  const { viewport, onViewportChange, flyTo, resetViewport } =
    useMapViewport();

  // Control state
  const [level, setLevel] = useState<AdminLevel>("ADM0");
  const [metric, setMetric] = useState<ChoroplethMetric>("patient_count");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Data queries
  const { data: stats, isLoading: statsLoading } = useGisStats();
  const { data: countries } = useCountries();
  const {
    data: boundaries,
    isLoading: boundariesLoading,
    error: boundariesError,
  } = useBoundaries({
    level,
    country_code: countryCode ?? undefined,
    simplify: level === "ADM0" ? 0.1 : level === "ADM1" ? 0.01 : 0.001,
    enabled: (stats?.total_boundaries ?? 0) > 0,
  });

  const choroplethParams: ChoroplethParams | null = useMemo(
    () =>
      (stats?.total_boundaries ?? 0) > 0
        ? { level, metric, country_code: countryCode ?? undefined }
        : null,
    [level, metric, countryCode, stats]
  );
  const { data: choroplethData } = useChoropleth(choroplethParams);

  const { data: regionDetail, isLoading: detailLoading } =
    useBoundaryDetail(selectedRegionId);

  // Load dataset mutation
  const loadMutation = useLoadDataset();

  // Event handlers
  const handleRegionClick = useCallback((id: number, name: string) => {
    setSelectedRegionId(id);
  }, []);

  const handleRegionHover = useCallback(
    (id: number | null, name: string | null) => {
      setHoveredRegion(name);
    },
    []
  );

  const handleDrillDown = useCallback(
    (gid: string) => {
      // Move to next admin level, filtering by parent
      const levels: AdminLevel[] = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4", "ADM5"];
      const idx = levels.indexOf(level);
      if (idx < levels.length - 1) {
        setLevel(levels[idx + 1]);
        setSelectedRegionId(null);
      }
    },
    [level]
  );

  const handleLoadData = useCallback(() => {
    loadMutation.mutate({
      source: "gadm",
      levels: ["ADM0", "ADM1"],
    });
  }, [loadMutation]);

  const maxChoroplethValue = useMemo(() => {
    if (!choroplethData?.length) return 0;
    return Math.max(...choroplethData.map((d) => d.value));
  }, [choroplethData]);

  const isEmpty = !statsLoading && (stats?.total_boundaries ?? 0) === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h1 className="text-lg font-semibold text-[#E8E4DC]">
              GIS Explorer
            </h1>
            <p className="text-xs text-[#5A5650]">
              Geographic epidemiology and exposure analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hoveredRegion && (
            <span className="text-xs text-[#8A857D]">{hoveredRegion}</span>
          )}
          {stats && (
            <span className="text-xs text-[#5A5650]">
              {stats.total_boundaries.toLocaleString()} boundaries ·{" "}
              {stats.total_countries} countries
            </span>
          )}
          <HelpButton helpKey="gis" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map (takes most of the space) */}
        <div className="relative flex-1">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0E0E11]">
              <Database className="h-12 w-12 text-[#5A5650]" />
              <div className="text-center">
                <p className="text-sm text-[#E8E4DC]">
                  No geographic boundaries loaded
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  Load GADM or geoBoundaries data to begin exploring
                </p>
              </div>
              <button
                onClick={handleLoadData}
                disabled={loadMutation.isPending}
                className="flex items-center gap-2 rounded bg-[#9B1B30] px-4 py-2 text-sm text-white hover:bg-[#B22040] disabled:opacity-50"
              >
                {loadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading boundaries...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Load GADM Boundaries (ADM0 + ADM1)
                  </>
                )}
              </button>
              {loadMutation.isSuccess && (
                <p className="text-xs text-[#2DD4BF]">
                  Loaded {loadMutation.data.features_loaded.toLocaleString()}{" "}
                  features
                </p>
              )}
              {loadMutation.isError && (
                <p className="text-xs text-[#E85A6B]">
                  Load failed:{" "}
                  {loadMutation.error instanceof Error
                    ? loadMutation.error.message
                    : "Unknown error"}
                </p>
              )}
            </div>
          ) : (
            <GisMap
              viewport={viewport}
              onViewportChange={onViewportChange}
              boundaries={boundaries ?? null}
              choroplethData={choroplethData ?? null}
              selectedRegionId={selectedRegionId}
              onRegionClick={handleRegionClick}
              onRegionHover={handleRegionHover}
              loading={boundariesLoading}
            />
          )}

          {boundariesError && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded bg-[#E85A6B]/15 px-3 py-2 text-xs text-[#E85A6B]">
              <AlertCircle className="h-3 w-3" />
              Failed to load boundaries
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {!isEmpty && (
          <div className="flex w-72 flex-col gap-3 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-3">
            <LayerControls
              level={level}
              onLevelChange={(l) => {
                setLevel(l);
                setSelectedRegionId(null);
              }}
              metric={metric}
              onMetricChange={setMetric}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              countries={countries ?? []}
            />

            <LegendPanel metric={metric} maxValue={maxChoroplethValue} />

            <RegionDetail
              detail={regionDetail ?? null}
              loading={detailLoading}
              onClose={() => setSelectedRegionId(null)}
              onDrillDown={handleDrillDown}
            />

            {/* Quick stats */}
            {stats && (
              <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                  Loaded Data
                </h3>
                <div className="space-y-1">
                  {stats.levels
                    .filter((l) => l.count > 0)
                    .map((l) => (
                      <div
                        key={l.code}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[#8A857D]">{l.label}</span>
                        <span className="text-[#E8E4DC]">
                          {l.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Map controls */}
            <button
              onClick={resetViewport}
              className="flex items-center justify-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs text-[#8A857D] hover:border-[#5A5650]"
            >
              <RefreshCw className="h-3 w-3" />
              Reset View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/pages/GisPage.tsx
git commit -m "feat(gis): add main GIS Explorer page with map, controls, and data loading"
```

---

### Task 20: Add GIS Route and Sidebar Navigation

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add GIS route to router.tsx**

Add inside the `children` array of the `ProtectedLayout` route, after the HEOR routes block:

```tsx
      // ── GIS Explorer ────────────────────────────────────────────────
      {
        path: "gis",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/gis/pages/GisPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
```

- [ ] **Step 2: Add GIS item to sidebar navigation**

In `Sidebar.tsx`, add the `Globe` icon import from lucide-react, then add to the `navItems` array after the HEOR entry:

```tsx
  { path: "/gis", label: "GIS Explorer", icon: Globe },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit 2>&1 | tail -5"`
Expected: No errors (or only pre-existing errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(gis): add GIS Explorer route and sidebar navigation"
```

---

### Task 21: Add GIS to Sidebar Help Keys and Section

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add GIS help key**

Add to the `routeHelpKeys` object:
```tsx
  "/gis": "gis",
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(gis): register GIS help key in sidebar"
```

---

## Chunk 7: Integration, Testing & Polish

### Task 22: Seed Boundary Level Data

**Files:**
- Create: `backend/database/seeders/GisBoundaryLevelSeeder.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

- [ ] **Step 1: Create the seeder**

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GisBoundaryLevelSeeder extends Seeder
{
    public function run(): void
    {
        $levels = [
            ['code' => 'ADM0', 'label' => 'Country', 'description' => 'National boundary', 'sort_order' => 0],
            ['code' => 'ADM1', 'label' => 'Province / State', 'description' => 'First-level administrative division', 'sort_order' => 1],
            ['code' => 'ADM2', 'label' => 'District / County', 'description' => 'Second-level administrative division', 'sort_order' => 2],
            ['code' => 'ADM3', 'label' => 'Sub-district', 'description' => 'Third-level administrative division', 'sort_order' => 3],
            ['code' => 'ADM4', 'label' => 'Municipality', 'description' => 'Fourth-level administrative division', 'sort_order' => 4],
            ['code' => 'ADM5', 'label' => 'Local Area', 'description' => 'Fifth-level administrative division', 'sort_order' => 5],
        ];

        foreach ($levels as $level) {
            DB::table('app.gis_boundary_levels')->updateOrInsert(
                ['code' => $level['code']],
                array_merge($level, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]),
            );
        }
    }
}
```

- [ ] **Step 2: Register in DatabaseSeeder**

Add to `DatabaseSeeder::run()`:
```php
$this->call(GisBoundaryLevelSeeder::class);
```

- [ ] **Step 3: Run seeder**

Run: `docker compose exec php php artisan db:seed --class=GisBoundaryLevelSeeder`

- [ ] **Step 4: Commit**

```bash
git add backend/database/seeders/GisBoundaryLevelSeeder.php backend/database/seeders/DatabaseSeeder.php
git commit -m "feat(gis): add boundary level seeder for ADM0-ADM5"
```

---

### Task 23: Add GIS Permission

**Files:**
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Add GIS permissions**

Add to the permissions array in RolePermissionSeeder:
```php
'gis.view',
'gis.load-data',
```

And ensure the `researcher` and `admin` roles include `gis.view`, while only `super-admin` gets `gis.load-data`.

- [ ] **Step 2: Run permission seeder**

Run: `docker compose exec php php artisan db:seed --class=RolePermissionSeeder`

- [ ] **Step 3: Commit**

```bash
git add backend/database/seeders/RolePermissionSeeder.php
git commit -m "feat(gis): add GIS view and load-data permissions"
```

---

### Task 24: Build Frontend and Verify

- [ ] **Step 1: Build frontend**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build completes successfully.

- [ ] **Step 2: Verify GIS page loads**

Navigate to `http://localhost:8082/gis` (or via Vite dev server at port 5175).
Expected: See GIS Explorer page with empty state and "Load GADM Boundaries" button.

- [ ] **Step 3: Test data loading**

Click "Load GADM Boundaries (ADM0 + ADM1)". Wait for loading to complete.
Expected: Map renders country boundaries with dark theme choropleth coloring.

- [ ] **Step 4: Test interactions**

- Change admin level dropdown to "States / Provinces" — map should show ADM1 boundaries
- Click on a region — right panel should show RegionDetail
- Change metric dropdown — choropleth colors should update

---

### Task 25: Final Commit and Deploy

- [ ] **Step 1: Verify no uncommitted changes**

Run: `git status`

- [ ] **Step 2: Rebuild and deploy**

Run: `./deploy.sh`
Expected: Frontend built, PHP cache cleared, migrations run.

---

## Future Enhancements (Not in Scope)

These are documented here for planning but NOT part of this implementation:

1. **Exposure Data Ingestion** — Load EPA AQS, CDC SVI, NASA PM2.5 data into `external_exposure` table
2. **Geocoding Pipeline** — DeGauss integration for geocoding patient addresses from OMOP `location` table
3. **Spatial Join Engine** — Connect patient `location_history` records to boundaries via PostGIS `ST_Within`
4. **Time-Series Animation** — Temporal slider animating choropleth data over pandemic timeline
5. **Cohort Overlay** — Overlay existing OMOP cohorts on the map (cohort members by location)
6. **Comparative Analysis** — Side-by-side region comparison panels
7. **OHDSI GIS Vocabulary** — Import GIS/Exposome/SDoH concept vocabulary deltas from CVB
8. **GIS Analysis Page** — Detailed drill-down page (`/gis/:regionId`) with charts, exposure timelines, and comparative panels
9. **Export** — GeoJSON/Shapefile/CSV export of spatial analysis results
10. **3D Extrusion Mode** — deck.gl FillExtrusionLayer for 3D bar-chart style geographic visualization
