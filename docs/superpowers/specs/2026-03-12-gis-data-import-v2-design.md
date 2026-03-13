# GIS Data Import v2 — Design Specification

**Date:** 2026-03-12
**Status:** Approved
**Scope:** Flexible GIS data import system with AI-assisted mapping via Abby

---

## 1. Architecture Overview

### Dual-Database Context

Parthenon uses two PostgreSQL databases:

- **Docker PG 16** (`parthenon` DB) — Laravel app tables (users, roles, migrations). Laravel migrations run here.
- **Local PG 17** (`ohdsi` DB) — Clinical/OMOP data + GIS schema. Connected via Laravel's `gis` connection.

The GIS import system spans both databases:
- **Import tracking** (`gis_imports`) — Laravel migration in Docker PG (`parthenon` DB, `public` schema)
- **GIS data tables** (`gis_point_feature`, `geography_summary`, `external_exposure`) — in local PG (`ohdsi` DB, `gis` schema)
- **Cross-database FK is impossible** — referential integrity between `gis_imports.id` and GIS data tables is enforced at the application level, not via DB constraints. The `import_id` column on GIS tables is a plain BIGINT, not a foreign key.

### Import Modes

The system supports three import modes to handle the full spectrum of geospatial data:

1. **Tabular + Geography Code** — CSV/Excel files with FIPS codes, ISO country codes, or other standard geographic identifiers. System joins to existing `geographic_location` records by code.

2. **Tabular + Coordinates** — Files containing lat/lon columns. System geocodes points to geographic regions and creates `gis_point_feature` records for point-level visualization.

3. **Geospatial Native** — Shapefiles (.shp/.dbf/.prj), GeoJSON, KML/KMZ, GeoPackage. Backend sends file to AI service HTTP endpoint for conversion to GeoJSON, then loads into PostGIS.

### Import Pipeline

```
Upload → Abby Analyzes → Column Map → Configure → Validate → Import & Summary
```

A 6-step wizard guides users through the import. Abby (Ollama + ChromaDB) analyzes uploaded files to auto-detect column purposes, geography types, and value semantics. High-confidence mappings (>90%) are applied automatically; medium-confidence (50-90%) are presented for user confirmation; low-confidence (<50%) require manual mapping.

### Upload Strategy (Hybrid)

- **Browser upload** for files <50MB — direct multipart POST to Laravel, enforced via `upload_max_filesize` and Form Request validation
- **CLI tool** for larger files — `php artisan gis:import <file>` with streaming and progress bar
- Both paths feed the same backend pipeline
- **Temp file storage:** `storage/app/gis-imports/` (Docker volume-mounted), cleaned after import completes or fails

### Global Scale

The system is designed for global data. To support this, the existing `geographic_location` table requires schema changes (see Section 2).

---

## 2. Database Changes

### Schema Migration: `gis.geographic_location` (ALTER)

The existing table has US-centric constraints that must be relaxed for global support:

```sql
-- Run against local PG 17 (ohdsi database) via a versioned SQL script
-- (Not a Laravel migration — GIS schema lives on a different database)

-- 1. Expand location_type to support international geography levels
ALTER TABLE gis.geographic_location
    DROP CONSTRAINT IF EXISTS geographic_location_location_type_check;
ALTER TABLE gis.geographic_location
    ADD CONSTRAINT geographic_location_location_type_check
    CHECK (location_type IN (
        'census_tract', 'county', 'zip', 'zcta',           -- US types (existing)
        'state', 'country', 'district', 'province',         -- International
        'nuts1', 'nuts2', 'nuts3',                           -- EU NUTS
        'custom'                                             -- User-defined
    ));

-- 2. Make state_fips optional (not applicable for non-US data)
ALTER TABLE gis.geographic_location
    ALTER COLUMN state_fips DROP NOT NULL,
    ALTER COLUMN state_fips DROP DEFAULT;

-- 3. Add import_id for rollback tracking (application-level FK to gis_imports in Docker PG)
ALTER TABLE gis.geographic_location ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_geo_loc_import ON gis.geographic_location(import_id);
```

### Schema Migration: `gis.geography_summary` and `gis.external_exposure` (ALTER)

Add `import_id` tracking for rollback. Since `geography_summary` has a composite PK and multiple imports may contribute to the same row, rollback uses a separate tracking table:

```sql
-- Add import_id to external_exposure (1:1 relationship — each row belongs to one import)
ALTER TABLE gis.external_exposure ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ext_exp_import ON gis.external_exposure(import_id);

-- For geography_summary: multiple imports may update the same row.
-- Rollback replaces current values with a snapshot stored before the import.
-- See "Rollback Strategy" in Section 5 for details.
```

### New Table: `gis.gis_point_feature`

Stores point-level features from coordinate-based imports (hospitals, monitoring stations, facilities).

```sql
CREATE TABLE gis.gis_point_feature (
    point_feature_id    BIGSERIAL PRIMARY KEY,
    import_id           BIGINT NOT NULL,             -- app-level FK to gis_imports (cross-DB)
    feature_type        VARCHAR(100) NOT NULL,        -- 'hospital', 'monitoring_station', etc.
    feature_name        VARCHAR(500),
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    geometry            GEOMETRY(Point, 4326) NOT NULL,
    properties          JSONB DEFAULT '{}',            -- arbitrary key-value pairs from source
    geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_feature_import ON gis.gis_point_feature(import_id);
CREATE INDEX idx_point_feature_type ON gis.gis_point_feature(feature_type);
CREATE INDEX idx_point_feature_geom ON gis.gis_point_feature USING GIST(geometry);
```

### New Table: `public.gis_imports` (Laravel Migration — Docker PG)

Replaces the existing `gis_datasets` table (migration `2026_03_11_000005`) with a more comprehensive import tracking table. The old `gis_datasets` table is dropped.

```php
// Laravel migration in Docker PG (parthenon DB)
Schema::dropIfExists('gis_datasets');

Schema::create('gis_imports', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained();
    $table->string('filename', 500);
    $table->string('import_mode', 50);           // tabular_geocode, tabular_coords, geospatial
    $table->string('status', 50)->default('pending');
    $table->jsonb('column_mapping')->default('{}');
    $table->jsonb('abby_suggestions')->default('{}');
    $table->jsonb('config')->default('{}');        // layer name, exposure_type, value semantics
    $table->jsonb('summary_snapshot')->default('{}'); // pre-import geography_summary values for rollback
    $table->integer('row_count')->nullable();
    $table->integer('progress_percentage')->default(0);
    $table->jsonb('error_log')->default('[]');
    $table->timestamp('started_at')->nullable();
    $table->timestamp('completed_at')->nullable();
    $table->timestamps();
});
```

### ChromaDB Collection: `gis_import_mappings`

Abby's curated knowledge base for column mapping patterns. Only user-confirmed mappings are stored.

- **Created:** On first import attempt (lazy initialization in `AbbyGisService`)
- **Embedding model:** ChromaDB default (all-MiniLM-L6-v2) — lightweight, suitable for column name similarity
- **Deduplication:** Upsert by `column_name` key — latest confirmed mapping replaces previous

```
Collection: gis_import_mappings
Document schema:
{
    "column_name": "RPL_THEMES",
    "mapped_to": "svi_overall",
    "source_description": "CDC SVI ranking percentile, all themes combined",
    "data_type": "float",
    "confirmed_by": "user@example.com",
    "confirmed_at": "2026-03-12T20:00:00Z"
}
Embedding: column_name + source_description (for semantic similarity search)
```

### Adaptive Geography Matching

When imported data references geographies not yet in `geographic_location`:

- **Match existing** by `geographic_code` (FIPS, ISO, NUTS, etc.)
- **Create stubs** for unmatched geographies with `location_name` from data, `location_type` inferred from code pattern (5-digit → county, 11-digit → census_tract, 2-letter → country, etc.), `geometry=NULL`
- Stubs are flagged in the import summary so users know which regions lack boundary data
- All stubs carry the `import_id` and are removed on rollback

---

## 3. Abby Integration

### Column Analysis Pipeline

When a file is uploaded, Abby receives the first 20 rows plus column headers and statistics (min, max, mean, distinct count, sample values). She uses:

1. **ChromaDB semantic search** — find similar column names from past confirmed mappings
2. **Ollama inference** — analyze column semantics, detect geography codes, value types, temporal patterns
3. **Confidence scoring** — combine ChromaDB similarity score + LLM confidence

### Confidence Thresholds

| Confidence | Behavior |
|-----------|----------|
| >90% | Auto-applied, shown as "Abby mapped" with green checkmark |
| 50-90% | Presented as suggestion, user confirms or overrides |
| <50% | Manual mapping required, Abby explains what she found |

### Curated Learning

Abby's ChromaDB knowledge grows only from user-confirmed mappings:

- When user confirms an auto-suggestion → stored as-is
- When user overrides a suggestion → corrected mapping stored, original discarded
- When user manually maps a column → new mapping stored
- Unconfirmed auto-suggestions are never persisted to ChromaDB

This ensures Abby's knowledge base stays high-quality and trustworthy over time.

### Ollama Prompt Structure

```
You are Abby, a GIS data analysis assistant. Analyze these columns from a data file upload.

File: {filename}
Columns: {column_headers}
Sample data (first 20 rows): {sample_rows}
Statistics: {column_stats}

Previously seen patterns (from ChromaDB):
{similar_mappings}

For each column, determine:
1. Purpose: geography_code, geography_name, latitude, longitude, value, metadata, skip
2. If geography_code: what type? (fips_county, fips_tract, fips_state, iso_country, iso_subdivision, nuts, custom)
3. If value: what does it measure? Suggest an exposure_type name.
4. Confidence: 0.0 to 1.0
5. Reasoning: brief explanation

Respond in JSON format.
```

---

## 4. Frontend: Import Wizard

### Location

New **"Data Import"** tab alongside the existing **"Boundaries"** tab in the GIS Boundary Data panel at `/admin/system-health`.

### Permission

Requires `gis.import` permission (new Spatie permission). Admin and super-admin roles have it by default. The import history view is scoped to the current user unless the user has `gis.import.manage` (admins see all imports, can rollback any).

### 6-Step Wizard Flow

**Step 1: Upload**
- Drag-and-drop zone with file type detection
- Accepts: CSV, TSV, Excel (.xlsx/.xls), Shapefile (.zip containing .shp/.dbf/.prj/.shx), GeoJSON, KML/KMZ, GeoPackage
- Max browser upload: 50MB (enforced via Form Request + nginx `client_max_body_size`)
- For files >50MB: shows CLI command (`php artisan gis:import <file>`)
- Shapefile .zip validation: must contain .shp + .dbf + .prj + .shx (reject otherwise)
- File preview: first 10 rows in a table
- CSV encoding: auto-detect via PHP `mb_detect_encoding()` with fallback to UTF-8

**Step 2: Abby Analyzes**
- Loading state: "Abby is analyzing your data..."
- Shows Abby's avatar and a conversational summary of what she found
- Detected: file type, row count, geography type, number of value columns
- If Abby encounters issues: explains them conversationally

**Step 3: Column Mapping**
- Two-column layout: source columns (left) → target mappings (right)
- High-confidence mappings shown with green badges, pre-filled
- Medium-confidence shown with amber badges, editable dropdowns
- Low-confidence shown with red badges, empty dropdowns
- "Ask Abby" button on any column for additional context (calls `POST /{id}/ask`)
- Target options: geographic_code, geography_name, latitude, longitude, value (with exposure_type name), metadata (stored in properties JSONB), skip

**Step 4: Configure**
- Layer name (how it appears in GIS Explorer layer panel)
- Exposure type (auto-suggested from value column analysis)
- Geography level (county, tract, state, country — auto-detected)
- Value interpretation: continuous (choropleth), categorical (discrete colors), binary (presence/absence)
- Aggregation method for duplicate geographies: sum, mean, max, min, latest

**Step 5: Validate**
- Dry-run results: X rows parsed, Y geographies matched, Z new stubs to create
- Validation errors: invalid coordinates, missing required columns, type mismatches
- Match summary table (not a map preview — avoids a large new component)
- "Fix & Re-validate" or "Proceed with Import"

**Step 6: Import & Summary**
- Progress bar (Horizon job, polled via `/status` endpoint)
- Final summary: rows imported, geographies matched, stubs created, errors skipped
- "View in GIS Explorer" button to jump to the new layer
- Mapping confirmation prompt: "Save these mappings so Abby learns for next time?"

---

## 5. Backend API

### Endpoints

All under `/api/v1/gis/import/`:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/upload` | Upload file, returns `import_id` + file metadata |
| POST | `/{id}/analyze` | Trigger Abby analysis, returns column suggestions |
| POST | `/{id}/ask` | Ask Abby about a specific column (ad-hoc question) |
| PUT | `/{id}/mapping` | Save confirmed column mapping |
| PUT | `/{id}/config` | Save layer configuration |
| POST | `/{id}/validate` | Dry-run validation, returns match stats |
| POST | `/{id}/execute` | Start import job (Horizon) |
| GET | `/{id}/status` | Poll job progress |
| DELETE | `/{id}` | Rollback: delete all data with this import_id |
| GET | `/history` | List past imports with status |

### Middleware

```php
Route::prefix('gis/import')->middleware(['auth:sanctum', 'permission:gis.import'])->group(function () {
    // ... routes
});
```

### Controller: `GisImportController`

Single resource controller handling all import operations. Uses Form Requests for validation.

### Job: `GisImportJob`

Dispatched to Horizon queue `gis-import`. Processes rows in batches of 1000:

1. Parse file based on format (CSV via PHP, geospatial via AI service HTTP call)
2. For each row: resolve geography, create/update records
3. Store progress in Redis (`gis:import:{id}:progress`)
4. On completion: update `gis_imports.status`, clear temp file

### Rollback Strategy

Rollback must handle two cases differently:

**Simple tables** (`gis_point_feature`, `external_exposure`, `geographic_location` stubs):
- `DELETE WHERE import_id = ?` — straightforward, each row belongs to exactly one import

**Aggregate tables** (`geography_summary`):
- Before import, snapshot current values for affected `(geographic_location_id, exposure_type)` pairs into `gis_imports.summary_snapshot` (JSONB)
- On rollback, restore values from snapshot (or delete row if it didn't exist pre-import)
- This handles the case where multiple imports contribute to the same summary row

**Rollback sequence:**
1. Delete from `gis.gis_point_feature WHERE import_id = ?`
2. Delete from `gis.external_exposure WHERE import_id = ?`
3. Delete from `gis.geographic_location WHERE import_id = ?` (stubs only)
4. Restore `gis.geography_summary` from `summary_snapshot`
5. Update `gis_imports.status = 'rolled_back'`

### Geospatial Format Processing

For Shapefiles, GeoJSON, KML, GeoPackage:
- Laravel sends file to AI service via HTTP: `POST /api/geo/convert` with multipart upload
- AI service (FastAPI) uses `geopandas`/`fiona` to normalize to GeoJSON, reprojects to EPSG:4326 if source CRS differs
- Laravel reads normalized GeoJSON response and processes like any other import
- `geopandas`, `fiona`, `pyproj` added to `ai/requirements.txt`

This avoids needing Python installed in the PHP container and is architecturally consistent with the existing AI service pattern.

---

## 6. Non-Functional Requirements

- **Rollback safety:** Every imported record carries `import_id` — rollback uses DELETE + snapshot restore
- **Idempotency:** Re-importing updates existing records. Upsert keys: `(geographic_code, location_type)` for geography, `(person_id, exposure_type, exposure_date, geographic_location_id)` for external_exposure, `(geographic_location_id, exposure_type)` for geography_summary
- **Audit trail:** `gis_imports` table preserves full history including Abby's suggestions vs. final confirmed mapping
- **Performance:** Batch inserts (1000 rows/batch), PostGIS spatial index on point features, `COPY` for large datasets
- **Security:** File uploads validated (extension + MIME type + content sniffing), shapefile .zip contents validated, temp files cleaned after import, max 50MB browser upload, no arbitrary file execution
- **Rate limiting:** Import endpoint throttled (5 imports/hour/user)
- **Permissions:** `gis.import` for basic access, `gis.import.manage` for viewing all imports and rollback
