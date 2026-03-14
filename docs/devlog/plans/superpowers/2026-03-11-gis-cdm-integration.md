# GIS-CDM Integration: Pennsylvania COVID Explorer

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the GIS Explorer to real CDM patient data so researchers can visualize COVID-19 case density, mortality rates, and temporal spread across Pennsylvania's 67 counties.

**Architecture:** A ZIP-to-county crosswalk table bridges OMOP `location.zip` to GADM `gis_admin_boundaries.gid`. The Python AI service runs spatial aggregation queries joining CDM clinical tables through this crosswalk, returning county-level metrics for choropleth rendering. The frontend adds a Pennsylvania-focused COVID view with time slider, metric selector, and county drill-down to patient-level stats.

**Tech Stack:** PostgreSQL 17 (PostGIS), Python FastAPI (spatial queries), React 19 (MapLibre GL, deck.gl), TanStack Query, Zustand

---

## Data Profile

| Fact | Value |
|------|-------|
| Total patients | 1,005,788 (all PA, Synthea) |
| COVID-19 patients | 81,694 (concept 37311061) |
| COVID deaths | 1,829 |
| Distinct PA ZIPs (real) | 1,336 |
| PA counties in GADM | 67 (all present, `parent_gid = 'USA.39_1'`) |
| PA state GID | `USA.39_1` (boundary_level_id = 2) |
| Location gap | No lat/lon, no county in `omop.location` — ZIP only |
| Temporal range | Mar 2020 – Oct 2021 |
| Masked ZIPs (`00000`) | 41% of patients — aggregate at state level |

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `scripts/load-zip-county-crosswalk.py` | Load HUD USPS ZIP-to-county crosswalk into `app.zip_county_crosswalk` |
| `backend/database/migrations/2026_03_11_200001_create_zip_county_crosswalk.php` | Create crosswalk table + indexes |
| `backend/database/migrations/2026_03_11_200002_create_cdm_spatial_cache.php` | Materialized cache table for county-level CDM aggregates |
| `ai/app/services/cdm_spatial_query.py` | CDM-aware spatial queries (COVID counts, mortality, temporal) |
| `ai/app/routers/cdm_spatial.py` | FastAPI endpoints for CDM spatial data |
| `ai/app/models/cdm_spatial.py` | Pydantic models for CDM spatial requests/responses |
| `frontend/src/features/gis/components/TimeSlider.tsx` | Temporal animation control |
| `frontend/src/features/gis/components/MetricSelector.tsx` | Choropleth metric picker |
| `frontend/src/features/gis/components/CountyDetail.tsx` | County drill-down panel |
| `frontend/src/features/gis/components/CovidSummaryBar.tsx` | Top-level COVID stats bar |

### Modified files
| File | Changes |
|------|---------|
| `ai/app/routers/gis.py` | Mount `cdm_spatial` router |
| `ai/app/services/gis_spatial_query.py` | Update choropleth to use real CDM data |
| `frontend/src/features/gis/pages/GisPage.tsx` | Add COVID view, time slider, metric selector, county detail |
| `frontend/src/features/gis/types.ts` | Add CDM spatial types |
| `frontend/src/features/gis/api.ts` | Add CDM spatial API functions |
| `frontend/src/features/gis/hooks/useGis.ts` | Add CDM spatial hooks |
| `backend/routes/api.php` | Add CDM spatial proxy routes |
| `backend/app/Http/Controllers/Api/V1/GisController.php` | Add CDM spatial proxy methods |

---

## Chunk 1: ZIP-to-County Crosswalk

### Task 1: Create crosswalk migration

**Files:**
- Create: `backend/database/migrations/2026_03_11_200001_create_zip_county_crosswalk.php`

The crosswalk maps 5-digit ZIP codes to GADM county GIDs. A single ZIP can span multiple counties — we store the primary (highest residential ratio) assignment. We also store FIPS codes for interoperability.

- [ ] **Step 1: Create the migration**

```php
<?php
// backend/database/migrations/2026_03_11_200001_create_zip_county_crosswalk.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create in app schema on ohdsi database (local PG 17)
        DB::connection('pgsql')->statement('
            CREATE TABLE IF NOT EXISTS app.zip_county_crosswalk (
                id SERIAL PRIMARY KEY,
                zip VARCHAR(5) NOT NULL,
                county_fips VARCHAR(5) NOT NULL,
                county_name VARCHAR(255) NOT NULL,
                state_fips VARCHAR(2) NOT NULL,
                state_abbr VARCHAR(2) NOT NULL,
                gadm_gid VARCHAR(50),
                residential_ratio NUMERIC(5,4) DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ');

        DB::connection('pgsql')->statement('
            CREATE INDEX idx_zip_crosswalk_zip ON app.zip_county_crosswalk(zip)
        ');
        DB::connection('pgsql')->statement('
            CREATE INDEX idx_zip_crosswalk_gadm ON app.zip_county_crosswalk(gadm_gid)
        ');
        DB::connection('pgsql')->statement('
            CREATE INDEX idx_zip_crosswalk_fips ON app.zip_county_crosswalk(county_fips)
        ');
    }

    public function down(): void
    {
        DB::connection('pgsql')->statement('DROP TABLE IF EXISTS app.zip_county_crosswalk');
    }
};
```

- [ ] **Step 2: Run the migration**

Run on host (targets local PG 17):
```bash
psql -h /var/run/postgresql -d ohdsi -c "
    CREATE TABLE IF NOT EXISTS app.zip_county_crosswalk (
        id SERIAL PRIMARY KEY,
        zip VARCHAR(5) NOT NULL,
        county_fips VARCHAR(5) NOT NULL,
        county_name VARCHAR(255) NOT NULL,
        state_fips VARCHAR(2) NOT NULL,
        state_abbr VARCHAR(2) NOT NULL,
        gadm_gid VARCHAR(50),
        residential_ratio NUMERIC(5,4) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_zip_crosswalk_zip ON app.zip_county_crosswalk(zip);
    CREATE INDEX IF NOT EXISTS idx_zip_crosswalk_gadm ON app.zip_county_crosswalk(gadm_gid);
    CREATE INDEX IF NOT EXISTS idx_zip_crosswalk_fips ON app.zip_county_crosswalk(county_fips);
"
```
Expected: `CREATE TABLE`, `CREATE INDEX` x3

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_11_200001_create_zip_county_crosswalk.php
git commit -m "feat(gis): add ZIP-to-county crosswalk migration"
```

---

### Task 2: Load ZIP-to-county crosswalk data

**Files:**
- Create: `scripts/load-zip-county-crosswalk.py`

Use the HUD USPS ZIP-to-county crosswalk (public domain, updated quarterly). For this Synthea dataset, we need PA ZIPs mapped to PA counties. The crosswalk also maps FIPS codes to GADM GIDs using a name-matching approach since GADM doesn't store FIPS.

- [ ] **Step 1: Create the crosswalk loader script**

```python
#!/usr/bin/env python3
"""Load ZIP-to-county crosswalk into local PostgreSQL.

Uses the HUD USPS crosswalk CSV. If not available, falls back to a
built-in PA ZIP-to-FIPS mapping derived from Census ZCTA data.

Usage:
    python3 scripts/load-zip-county-crosswalk.py
    python3 scripts/load-zip-county-crosswalk.py --csv path/to/hud_crosswalk.csv
    python3 scripts/load-zip-county-crosswalk.py --state PA
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from pathlib import Path

import psycopg2
import urllib.request

DB_PARAMS = {
    "dbname": "ohdsi",
    "user": "smudoshi",
    "host": "/var/run/postgresql",
    "options": "-c search_path=app,public",
}

# Census FIPS for all 67 PA counties → GADM GID mapping
# GADM GIDs follow USA.39.{N}_1 pattern but N doesn't match FIPS
# We'll match by county name instead
PA_FIPS = "42"  # Pennsylvania state FIPS


def load_gadm_county_map(conn) -> dict[str, str]:
    """Build county_name → gadm_gid map for PA counties."""
    cur = conn.cursor()
    cur.execute("""
        SELECT gid, name FROM app.gis_admin_boundaries
        WHERE country_code = 'USA' AND boundary_level_id = 3
          AND parent_gid = 'USA.39_1'
    """)
    name_to_gid = {}
    for gid, name in cur.fetchall():
        # Normalize: "Mc Kean" → "mckean", "Philadelphia" → "philadelphia"
        normalized = name.lower().replace(" ", "").replace(".", "")
        name_to_gid[normalized] = gid
        # Also store with spaces for fuzzy match
        name_to_gid[name.lower()] = gid
    return name_to_gid


def match_gadm_gid(county_name: str, gadm_map: dict[str, str]) -> str | None:
    """Match a county name to its GADM GID."""
    normalized = county_name.lower().replace(" county", "").replace(" ", "").replace(".", "").strip()
    if normalized in gadm_map:
        return gadm_map[normalized]
    # Try with spaces
    spaced = county_name.lower().replace(" county", "").strip()
    if spaced in gadm_map:
        return gadm_map[spaced]
    return None


def load_from_csv(csv_path: str, conn, state_filter: str | None = None) -> int:
    """Load crosswalk from a HUD-format CSV."""
    gadm_map = load_gadm_county_map(conn)
    cur = conn.cursor()
    loaded = 0

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            zip_code = row.get("ZIP", row.get("zip", "")).strip()
            county_fips = row.get("COUNTY", row.get("county", row.get("GEOID", ""))).strip()
            county_name = row.get("COUNTYNAME", row.get("county_name", "")).strip()
            state_fips = county_fips[:2] if len(county_fips) >= 2 else ""
            state_abbr = row.get("USPS_ZIP_PREF_STATE", row.get("state", "")).strip()
            ratio = float(row.get("RES_RATIO", row.get("residential_ratio", "1.0")) or "1.0")

            if state_filter and state_abbr != state_filter:
                continue

            gadm_gid = match_gadm_gid(county_name, gadm_map)

            cur.execute("""
                INSERT INTO app.zip_county_crosswalk
                    (zip, county_fips, county_name, state_fips, state_abbr, gadm_gid, residential_ratio)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (zip_code, county_fips, county_name, state_fips, state_abbr, gadm_gid, ratio))
            loaded += 1

            if loaded % 1000 == 0:
                conn.commit()
                print(json.dumps({"event": "progress", "loaded": loaded}), flush=True)

    conn.commit()
    return loaded


def load_from_cdm_locations(conn) -> int:
    """Build crosswalk from CDM location data + ZCTA-to-county lookup.

    Since the CDM has ZIP + city but no county, we use a public Census
    ZIP-to-county FIPS crosswalk file. If unavailable, we download it.
    """
    crosswalk_url = "https://raw.githubusercontent.com/bgruber/zip2fips/master/zip2fips.json"
    cache_path = Path(__file__).parent / ".zip2fips_cache.json"

    # Try to download or use cached ZIP-to-FIPS mapping
    zip_to_fips: dict[str, str] = {}
    if cache_path.exists():
        zip_to_fips = json.loads(cache_path.read_text())
    else:
        try:
            print(json.dumps({"event": "downloading", "url": crosswalk_url}), flush=True)
            req = urllib.request.Request(crosswalk_url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                zip_to_fips = json.loads(resp.read().decode())
                cache_path.write_text(json.dumps(zip_to_fips))
        except Exception as e:
            print(json.dumps({"event": "warning", "message": f"Cannot download ZIP-to-FIPS: {e}"}), flush=True)

    if not zip_to_fips:
        print(json.dumps({"event": "error", "message": "No ZIP-to-FIPS data available"}), flush=True)
        return 0

    # Load FIPS-to-county-name mapping from Census (embedded for PA)
    # We'll query GADM for county names
    gadm_map = load_gadm_county_map(conn)
    cur = conn.cursor()

    # Get distinct ZIPs from CDM
    cur.execute("""
        SELECT DISTINCT zip FROM omop.location
        WHERE state = 'PA' AND zip != '00000' AND zip IS NOT NULL
    """)
    cdm_zips = [row[0].strip() for row in cur.fetchall()]
    print(json.dumps({"event": "found_zips", "count": len(cdm_zips)}), flush=True)

    # Load FIPS-to-county names
    fips_to_name: dict[str, str] = {}
    cur.execute("""
        SELECT gid, name FROM app.gis_admin_boundaries
        WHERE country_code = 'USA' AND boundary_level_id = 3
          AND parent_gid = 'USA.39_1'
    """)
    for gid, name in cur.fetchall():
        fips_to_name[gid] = name

    loaded = 0
    unmatched = 0
    for zip_code in cdm_zips:
        fips = zip_to_fips.get(zip_code)
        if not fips:
            unmatched += 1
            continue

        county_fips = fips  # Full 5-digit FIPS
        state_fips = fips[:2]

        if state_fips != PA_FIPS:
            continue

        # Look up county name from a reverse mapping
        # We need a FIPS-to-county-name source — use the GADM names
        county_name = ""
        gadm_gid = None

        # Try matching FIPS to GADM — we need to build this mapping
        # For now, store FIPS and match GADM later
        cur.execute("""
            INSERT INTO app.zip_county_crosswalk
                (zip, county_fips, county_name, state_fips, state_abbr, gadm_gid, residential_ratio)
            VALUES (%s, %s, %s, %s, %s, %s, 1.0)
            ON CONFLICT DO NOTHING
        """, (zip_code, county_fips, county_name, state_fips, "PA", gadm_gid))
        loaded += 1

    conn.commit()
    print(json.dumps({"event": "done", "loaded": loaded, "unmatched": unmatched}), flush=True)
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="Load ZIP-to-county crosswalk")
    parser.add_argument("--csv", help="Path to HUD USPS crosswalk CSV")
    parser.add_argument("--state", default=None, help="Filter to state abbreviation (e.g., PA)")
    args = parser.parse_args()

    conn = psycopg2.connect(**DB_PARAMS)
    conn.autocommit = False

    try:
        if args.csv:
            total = load_from_csv(args.csv, conn, args.state)
        else:
            total = load_from_cdm_locations(conn)
        print(json.dumps({"event": "complete", "total": total}), flush=True)
    except Exception as e:
        print(json.dumps({"event": "error", "message": str(e)}), flush=True)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Download HUD crosswalk or Census ZCTA data**

The best source is the HUD USPS ZIP-County crosswalk. If unavailable, use Census ZCTA-to-county relationship file. Download and place in `GIS/` directory.

```bash
# Option A: Census ZCTA-to-county (public, no API key needed)
curl -o GIS/zcta_county_rel.csv "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"

# Option B: If the Census URL changes, use the zip2fips JSON (auto-downloaded by script)
```

- [ ] **Step 3: Load the crosswalk and match GADM GIDs**

```bash
python3 scripts/load-zip-county-crosswalk.py --state PA
```

- [ ] **Step 4: Verify crosswalk coverage**

```sql
-- Check how many CDM ZIPs mapped successfully
SELECT count(DISTINCT l.zip) as cdm_zips,
       count(DISTINCT zc.zip) as mapped_zips
FROM omop.location l
LEFT JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
WHERE l.state = 'PA' AND l.zip != '00000';

-- Check GADM GID fill rate
SELECT count(*) as total,
       count(gadm_gid) as with_gadm,
       count(*) - count(gadm_gid) as missing_gadm
FROM app.zip_county_crosswalk WHERE state_abbr = 'PA';

-- COVID patients now mappable to counties
SELECT zc.county_name, zc.gadm_gid, count(DISTINCT p.person_id) as patients
FROM omop.condition_occurrence co
JOIN omop.person p ON p.person_id = co.person_id
JOIN omop.location l ON l.location_id = p.location_id
JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
WHERE co.condition_concept_id = 37311061
GROUP BY zc.county_name, zc.gadm_gid
ORDER BY patients DESC
LIMIT 10;
```

- [ ] **Step 5: Commit**

```bash
git add scripts/load-zip-county-crosswalk.py
git commit -m "feat(gis): add ZIP-to-county crosswalk loader for CDM-GIS bridge"
```

---

### Task 3: Create CDM spatial cache table

**Files:**
- Create: `backend/database/migrations/2026_03_11_200002_create_cdm_spatial_cache.php`

Pre-aggregate county-level metrics to avoid expensive joins on every map render. This materialized cache is refreshed on demand or after new data loads.

- [ ] **Step 1: Create the cache table**

```sql
-- Run on local PG 17
psql -h /var/run/postgresql -d ohdsi -c "
    CREATE TABLE IF NOT EXISTS app.cdm_county_stats (
        id SERIAL PRIMARY KEY,
        gadm_gid VARCHAR(50) NOT NULL,
        county_name VARCHAR(255),
        metric_type VARCHAR(50) NOT NULL,
        concept_id INTEGER,
        time_period VARCHAR(7),
        value NUMERIC NOT NULL DEFAULT 0,
        denominator NUMERIC,
        rate NUMERIC,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(gadm_gid, metric_type, concept_id, time_period)
    );
    CREATE INDEX idx_county_stats_gid ON app.cdm_county_stats(gadm_gid);
    CREATE INDEX idx_county_stats_metric ON app.cdm_county_stats(metric_type);
    CREATE INDEX idx_county_stats_period ON app.cdm_county_stats(time_period);
"
```

Metric types stored:
- `patient_count` — total patients per county
- `covid_cases` — COVID-19 patients per county (concept_id = 37311061)
- `covid_deaths` — COVID deaths per county
- `covid_cases_monthly` — monthly case counts (time_period = `YYYY-MM`)
- `covid_cfr` — case fatality rate per county (rate = deaths/cases)
- `covid_hospitalization` — inpatient COVID visits per county

- [ ] **Step 2: Create the migration file**

```php
<?php
// backend/database/migrations/2026_03_11_200002_create_cdm_spatial_cache.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::connection('pgsql')->statement("
            CREATE TABLE IF NOT EXISTS app.cdm_county_stats (
                id SERIAL PRIMARY KEY,
                gadm_gid VARCHAR(50) NOT NULL,
                county_name VARCHAR(255),
                metric_type VARCHAR(50) NOT NULL,
                concept_id INTEGER,
                time_period VARCHAR(7),
                value NUMERIC NOT NULL DEFAULT 0,
                denominator NUMERIC,
                rate NUMERIC,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(gadm_gid, metric_type, COALESCE(concept_id, 0), COALESCE(time_period, ''))
            )
        ");
        DB::connection('pgsql')->statement('CREATE INDEX IF NOT EXISTS idx_county_stats_gid ON app.cdm_county_stats(gadm_gid)');
        DB::connection('pgsql')->statement('CREATE INDEX IF NOT EXISTS idx_county_stats_metric ON app.cdm_county_stats(metric_type)');
        DB::connection('pgsql')->statement('CREATE INDEX IF NOT EXISTS idx_county_stats_period ON app.cdm_county_stats(time_period)');
    }

    public function down(): void
    {
        DB::connection('pgsql')->statement('DROP TABLE IF EXISTS app.cdm_county_stats');
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_11_200002_create_cdm_spatial_cache.php
git commit -m "feat(gis): add CDM county stats cache table"
```

---

## Chunk 2: CDM Spatial Query Service

### Task 4: Create CDM spatial aggregation service

**Files:**
- Create: `ai/app/services/cdm_spatial_query.py`

This service runs the heavy SQL queries that join CDM clinical data through the ZIP crosswalk to produce county-level metrics. It writes results to `cdm_county_stats` and reads from there for API responses.

- [ ] **Step 1: Create the service**

```python
# ai/app/services/cdm_spatial_query.py
"""CDM spatial aggregation queries.

Joins OMOP CDM clinical data through the ZIP-to-county crosswalk to produce
county-level metrics for choropleth rendering.

All queries target local PG 17 (ohdsi database) via GIS_DATABASE_URL.
CDM data lives in the 'omop' schema; GIS/crosswalk data in 'app' schema.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

GIS_DATABASE_URL = os.getenv("GIS_DATABASE_URL", os.getenv("DATABASE_URL", ""))
ASYNC_DATABASE_URL = GIS_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

COVID_CONCEPT_ID = 37311061


def get_engine():
    return create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=5,
        connect_args={"server_settings": {"search_path": "app,omop,public"}},
    )


async def refresh_county_stats() -> dict:
    """Rebuild all county-level aggregates from CDM data.

    This is an expensive operation (~30s) that should be called on demand,
    not on every request.
    """
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {"metrics_computed": 0}

    async with async_session() as session:
        # Clear existing stats
        await session.execute(text("DELETE FROM app.cdm_county_stats"))

        # 1. Total patients per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'patient_count',
                   COUNT(DISTINCT p.person_id), NOW()
            FROM omop.person p
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """))
        stats["metrics_computed"] += 1

        # 2. COVID cases per county (all-time)
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'covid_cases', :concept_id,
                   COUNT(DISTINCT co.person_id), NOW()
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :concept_id
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"concept_id": COVID_CONCEPT_ID})
        stats["metrics_computed"] += 1

        # 3. COVID deaths per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'covid_deaths', :concept_id,
                   COUNT(DISTINCT d.person_id), NOW()
            FROM omop.death d
            JOIN omop.condition_occurrence co ON co.person_id = d.person_id
                AND co.condition_concept_id = :concept_id
            JOIN omop.person p ON p.person_id = d.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"concept_id": COVID_CONCEPT_ID})
        stats["metrics_computed"] += 1

        # 4. COVID case fatality rate per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, denominator, rate, updated_at)
            SELECT
                cases.gadm_gid,
                cases.county_name,
                'covid_cfr',
                :concept_id,
                COALESCE(deaths.death_count, 0),
                cases.case_count,
                CASE WHEN cases.case_count > 0
                     THEN ROUND(COALESCE(deaths.death_count, 0)::numeric / cases.case_count * 100, 2)
                     ELSE 0 END,
                NOW()
            FROM (
                SELECT zc.gadm_gid, zc.county_name, COUNT(DISTINCT co.person_id) as case_count
                FROM omop.condition_occurrence co
                JOIN omop.person p ON p.person_id = co.person_id
                JOIN omop.location l ON l.location_id = p.location_id
                JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
                WHERE co.condition_concept_id = :concept_id
                  AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
                GROUP BY zc.gadm_gid, zc.county_name
            ) cases
            LEFT JOIN (
                SELECT zc.gadm_gid, COUNT(DISTINCT d.person_id) as death_count
                FROM omop.death d
                JOIN omop.condition_occurrence co ON co.person_id = d.person_id
                    AND co.condition_concept_id = :concept_id
                JOIN omop.person p ON p.person_id = d.person_id
                JOIN omop.location l ON l.location_id = p.location_id
                JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
                WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
                GROUP BY zc.gadm_gid
            ) deaths ON deaths.gadm_gid = cases.gadm_gid
        """), {"concept_id": COVID_CONCEPT_ID})
        stats["metrics_computed"] += 1

        # 5. Monthly COVID cases per county (temporal)
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, time_period, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'covid_cases_monthly', :concept_id,
                   TO_CHAR(co.condition_start_date, 'YYYY-MM'),
                   COUNT(DISTINCT co.person_id), NOW()
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :concept_id
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
              AND co.condition_start_date >= '2020-01-01'
            GROUP BY zc.gadm_gid, zc.county_name, TO_CHAR(co.condition_start_date, 'YYYY-MM')
        """), {"concept_id": COVID_CONCEPT_ID})
        stats["metrics_computed"] += 1

        # 6. COVID hospitalizations per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'covid_hospitalization', :concept_id,
                   COUNT(DISTINCT vo.person_id), NOW()
            FROM omop.visit_occurrence vo
            JOIN omop.condition_occurrence co ON co.person_id = vo.person_id
                AND co.condition_concept_id = :concept_id
                AND co.condition_start_date BETWEEN vo.visit_start_date AND COALESCE(vo.visit_end_date, vo.visit_start_date + INTERVAL '30 days')
            JOIN omop.person p ON p.person_id = vo.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE vo.visit_concept_id = 9201
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"concept_id": COVID_CONCEPT_ID})
        stats["metrics_computed"] += 1

        await session.commit()

    await engine.dispose()
    return stats


async def get_county_choropleth(
    metric_type: str,
    concept_id: int | None = None,
    time_period: str | None = None,
) -> list[dict]:
    """Read pre-computed county stats for choropleth rendering."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["cs.metric_type = :metric"]
    params: dict = {"metric": metric_type}

    if concept_id:
        conditions.append("cs.concept_id = :concept_id")
        params["concept_id"] = concept_id

    if time_period:
        conditions.append("cs.time_period = :period")
        params["period"] = time_period
    else:
        conditions.append("cs.time_period IS NULL")

    where = " AND ".join(conditions)

    async with async_session() as session:
        result = await session.execute(text(f"""
            SELECT cs.gadm_gid, cs.county_name, cs.value, cs.denominator, cs.rate,
                   b.id as boundary_id
            FROM app.cdm_county_stats cs
            JOIN app.gis_admin_boundaries b ON b.gid = cs.gadm_gid
            WHERE {where}
            ORDER BY cs.value DESC
        """), params)
        rows = result.fetchall()

    await engine.dispose()

    return [
        {
            "boundary_id": row.boundary_id,
            "gid": row.gadm_gid,
            "name": row.county_name,
            "value": float(row.value) if row.value else 0,
            "denominator": float(row.denominator) if row.denominator else None,
            "rate": float(row.rate) if row.rate else None,
        }
        for row in rows
    ]


async def get_available_time_periods(
    metric_type: str = "covid_cases_monthly",
    concept_id: int = COVID_CONCEPT_ID,
) -> list[str]:
    """Return sorted list of available YYYY-MM periods."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT DISTINCT time_period
            FROM app.cdm_county_stats
            WHERE metric_type = :metric AND concept_id = :concept_id
              AND time_period IS NOT NULL
            ORDER BY time_period
        """), {"metric": metric_type, "concept_id": concept_id})
        periods = [row.time_period for row in result]

    await engine.dispose()
    return periods


async def get_covid_summary() -> dict:
    """Return top-level COVID stats for the summary bar."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Total COVID cases
        cases = await session.execute(text("""
            SELECT COUNT(DISTINCT person_id) FROM omop.condition_occurrence
            WHERE condition_concept_id = :cid
        """), {"cid": COVID_CONCEPT_ID})
        total_cases = cases.scalar() or 0

        # Total deaths among COVID patients
        deaths = await session.execute(text("""
            SELECT COUNT(DISTINCT d.person_id)
            FROM omop.death d
            JOIN omop.condition_occurrence co ON co.person_id = d.person_id
            WHERE co.condition_concept_id = :cid
        """), {"cid": COVID_CONCEPT_ID})
        total_deaths = deaths.scalar() or 0

        # Total population
        pop = await session.execute(text("SELECT COUNT(*) FROM omop.person"))
        total_pop = pop.scalar() or 0

        # Counties with cases
        counties = await session.execute(text("""
            SELECT COUNT(DISTINCT gadm_gid) FROM app.cdm_county_stats
            WHERE metric_type = 'covid_cases'
        """))
        affected_counties = counties.scalar() or 0

        # Date range
        dates = await session.execute(text("""
            SELECT MIN(condition_start_date), MAX(condition_start_date)
            FROM omop.condition_occurrence
            WHERE condition_concept_id = :cid
        """), {"cid": COVID_CONCEPT_ID})
        date_row = dates.fetchone()

    await engine.dispose()

    cfr = round(total_deaths / total_cases * 100, 2) if total_cases > 0 else 0

    return {
        "total_cases": total_cases,
        "total_deaths": total_deaths,
        "case_fatality_rate": cfr,
        "total_population": total_pop,
        "prevalence_per_100k": round(total_cases / total_pop * 100_000, 1) if total_pop > 0 else 0,
        "affected_counties": affected_counties,
        "total_counties": 67,
        "date_range": {
            "start": date_row[0].isoformat() if date_row and date_row[0] else None,
            "end": date_row[1].isoformat() if date_row and date_row[1] else None,
        },
    }


async def get_county_detail(gadm_gid: str) -> dict | None:
    """Get detailed stats for a single county."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # All metrics for this county
        result = await session.execute(text("""
            SELECT metric_type, concept_id, time_period, value, denominator, rate
            FROM app.cdm_county_stats
            WHERE gadm_gid = :gid
            ORDER BY metric_type, time_period
        """), {"gid": gadm_gid})
        rows = result.fetchall()

        if not rows:
            await engine.dispose()
            return None

        # Boundary info
        boundary = await session.execute(text("""
            SELECT b.id, b.name, b.country_code,
                   ST_Area(b.geom::geography) / 1e6 as area_km2
            FROM app.gis_admin_boundaries b
            WHERE b.gid = :gid
        """), {"gid": gadm_gid})
        b_row = boundary.fetchone()

        # Age distribution of COVID patients in this county
        age_dist = await session.execute(text("""
            SELECT
                CASE
                    WHEN 2026 - p.year_of_birth < 18 THEN '0-17'
                    WHEN 2026 - p.year_of_birth < 35 THEN '18-34'
                    WHEN 2026 - p.year_of_birth < 50 THEN '35-49'
                    WHEN 2026 - p.year_of_birth < 65 THEN '50-64'
                    ELSE '65+'
                END as age_group,
                COUNT(DISTINCT p.person_id) as count
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid AND zc.gadm_gid = :gid
              AND l.zip != '00000'
            GROUP BY age_group ORDER BY age_group
        """), {"cid": COVID_CONCEPT_ID, "gid": gadm_gid})
        age_groups = [{"group": r.age_group, "count": r.count} for r in age_dist]

        # Gender breakdown
        gender_dist = await session.execute(text("""
            SELECT
                CASE p.gender_concept_id WHEN 8507 THEN 'Male' WHEN 8532 THEN 'Female' ELSE 'Other' END as gender,
                COUNT(DISTINCT p.person_id) as count
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid AND zc.gadm_gid = :gid
              AND l.zip != '00000'
            GROUP BY gender
        """), {"cid": COVID_CONCEPT_ID, "gid": gadm_gid})
        genders = [{"gender": r.gender, "count": r.count} for r in gender_dist]

    await engine.dispose()

    # Organize metrics
    metrics = {}
    timeline = []
    for row in rows:
        if row.time_period:
            timeline.append({
                "period": row.time_period,
                "metric": row.metric_type,
                "value": float(row.value),
            })
        else:
            metrics[row.metric_type] = {
                "value": float(row.value),
                "denominator": float(row.denominator) if row.denominator else None,
                "rate": float(row.rate) if row.rate else None,
            }

    return {
        "gadm_gid": gadm_gid,
        "name": b_row.name if b_row else gadm_gid,
        "boundary_id": b_row.id if b_row else None,
        "area_km2": round(b_row.area_km2, 1) if b_row and b_row.area_km2 else None,
        "metrics": metrics,
        "timeline": timeline,
        "demographics": {
            "age_groups": age_groups,
            "gender": genders,
        },
    }
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/services/cdm_spatial_query.py
git commit -m "feat(gis): add CDM spatial aggregation service for county-level metrics"
```

---

### Task 5: Create CDM spatial API endpoints

**Files:**
- Create: `ai/app/models/cdm_spatial.py`
- Create: `ai/app/routers/cdm_spatial.py`
- Modify: `ai/app/main.py` (mount router)

- [ ] **Step 1: Create Pydantic models**

```python
# ai/app/models/cdm_spatial.py
from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field


class CdmMetricType(str, Enum):
    PATIENT_COUNT = "patient_count"
    COVID_CASES = "covid_cases"
    COVID_DEATHS = "covid_deaths"
    COVID_CFR = "covid_cfr"
    COVID_CASES_MONTHLY = "covid_cases_monthly"
    COVID_HOSPITALIZATION = "covid_hospitalization"


class CdmChoroplethRequest(BaseModel):
    metric: CdmMetricType = CdmMetricType.COVID_CASES
    concept_id: int | None = Field(default=37311061, description="OMOP concept ID")
    time_period: str | None = Field(default=None, description="YYYY-MM for monthly data")


class CountyChoroplethItem(BaseModel):
    boundary_id: int
    gid: str
    name: str
    value: float
    denominator: float | None = None
    rate: float | None = None


class CovidSummary(BaseModel):
    total_cases: int
    total_deaths: int
    case_fatality_rate: float
    total_population: int
    prevalence_per_100k: float
    affected_counties: int
    total_counties: int
    date_range: dict


class RefreshResult(BaseModel):
    status: str
    metrics_computed: int
```

- [ ] **Step 2: Create the router**

```python
# ai/app/routers/cdm_spatial.py
from fastapi import APIRouter, HTTPException

from app.models.cdm_spatial import (
    CdmChoroplethRequest,
    CdmMetricType,
    CountyChoroplethItem,
    CovidSummary,
    RefreshResult,
)
from app.services.cdm_spatial_query import (
    get_county_choropleth,
    get_available_time_periods,
    get_covid_summary,
    get_county_detail,
    refresh_county_stats,
)

router = APIRouter(prefix="/cdm-spatial", tags=["CDM Spatial"])


@router.post("/choropleth", response_model=list[CountyChoroplethItem])
async def choropleth(req: CdmChoroplethRequest):
    """Get county-level choropleth data for a given metric."""
    return await get_county_choropleth(
        metric_type=req.metric.value,
        concept_id=req.concept_id,
        time_period=req.time_period,
    )


@router.get("/time-periods")
async def time_periods(metric: str = "covid_cases_monthly", concept_id: int = 37311061):
    """Get available YYYY-MM time periods for temporal animation."""
    return await get_available_time_periods(metric, concept_id)


@router.get("/covid-summary", response_model=CovidSummary)
async def covid_summary():
    """Get top-level COVID-19 summary statistics."""
    return await get_covid_summary()


@router.get("/county/{gadm_gid}")
async def county_detail(gadm_gid: str):
    """Get detailed COVID stats for a specific county."""
    result = await get_county_detail(gadm_gid)
    if result is None:
        raise HTTPException(status_code=404, detail="County not found or no data")
    return result


@router.post("/refresh", response_model=RefreshResult)
async def refresh():
    """Rebuild all county-level aggregates from CDM data. Takes ~30s."""
    stats = await refresh_county_stats()
    return {"status": "ok", "metrics_computed": stats["metrics_computed"]}
```

- [ ] **Step 3: Mount the router in FastAPI app**

In `ai/app/main.py`, add:
```python
from app.routers import cdm_spatial
app.include_router(cdm_spatial.router)
```

- [ ] **Step 4: Verify endpoints**

```bash
# Refresh stats (builds cache)
curl -X POST http://localhost:8002/cdm-spatial/refresh

# Get COVID choropleth
curl http://localhost:8002/cdm-spatial/choropleth -X POST \
  -H "Content-Type: application/json" \
  -d '{"metric": "covid_cases"}'

# Get summary
curl http://localhost:8002/cdm-spatial/covid-summary

# Get time periods
curl http://localhost:8002/cdm-spatial/time-periods

# Get county detail
curl http://localhost:8002/cdm-spatial/county/USA.39.51_1
```

- [ ] **Step 5: Commit**

```bash
git add ai/app/models/cdm_spatial.py ai/app/routers/cdm_spatial.py ai/app/main.py
git commit -m "feat(gis): add CDM spatial API endpoints for county-level COVID data"
```

---

## Chunk 3: Laravel Proxy & Frontend Types

### Task 6: Add Laravel proxy routes for CDM spatial endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/GisController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add proxy methods to GisController**

Add these methods to `GisController.php`:

```php
public function cdmChoropleth(Request $request): JsonResponse
{
    $response = Http::timeout(30)->post("{$this->aiServiceUrl}/cdm-spatial/choropleth", $request->all());
    if ($response->failed()) {
        return response()->json(['error' => 'CDM choropleth query failed'], $response->status());
    }
    return response()->json(['data' => $response->json()]);
}

public function cdmTimePeriods(Request $request): JsonResponse
{
    $params = $request->only(['metric', 'concept_id']);
    $response = Http::timeout(10)->get("{$this->aiServiceUrl}/cdm-spatial/time-periods", $params);
    if ($response->failed()) {
        return response()->json(['error' => 'Failed to fetch time periods'], 500);
    }
    return response()->json(['data' => $response->json()]);
}

public function covidSummary(): JsonResponse
{
    $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/covid-summary");
    if ($response->failed()) {
        return response()->json(['error' => 'Failed to fetch COVID summary'], 500);
    }
    return response()->json(['data' => $response->json()]);
}

public function countyDetail(string $gadmGid): JsonResponse
{
    $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/county/{$gadmGid}");
    if ($response->failed()) {
        return response()->json(['error' => 'County not found'], $response->status());
    }
    return response()->json(['data' => $response->json()]);
}

public function refreshCdmStats(): JsonResponse
{
    $response = Http::timeout(120)->post("{$this->aiServiceUrl}/cdm-spatial/refresh");
    if ($response->failed()) {
        return response()->json(['error' => 'Refresh failed'], 500);
    }
    return response()->json(['data' => $response->json()]);
}
```

- [ ] **Step 2: Add routes**

In `backend/routes/api.php`, inside the `gis` group:

```php
Route::post('/gis/cdm/choropleth', [GisController::class, 'cdmChoropleth']);
Route::get('/gis/cdm/time-periods', [GisController::class, 'cdmTimePeriods']);
Route::get('/gis/cdm/covid-summary', [GisController::class, 'covidSummary']);
Route::get('/gis/cdm/county/{gadmGid}', [GisController::class, 'countyDetail']);
Route::post('/gis/cdm/refresh', [GisController::class, 'refreshCdmStats']);
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GisController.php backend/routes/api.php
git commit -m "feat(gis): add Laravel proxy routes for CDM spatial endpoints"
```

---

### Task 7: Add frontend types and API functions

**Files:**
- Modify: `frontend/src/features/gis/types.ts`
- Modify: `frontend/src/features/gis/api.ts`
- Modify: `frontend/src/features/gis/hooks/useGis.ts`

- [ ] **Step 1: Add TypeScript types**

Add to `frontend/src/features/gis/types.ts`:

```typescript
// CDM Spatial types
export type CdmMetricType =
  | "patient_count"
  | "covid_cases"
  | "covid_deaths"
  | "covid_cfr"
  | "covid_cases_monthly"
  | "covid_hospitalization";

export interface CountyChoroplethItem {
  boundary_id: number;
  gid: string;
  name: string;
  value: number;
  denominator: number | null;
  rate: number | null;
}

export interface CovidSummary {
  total_cases: number;
  total_deaths: number;
  case_fatality_rate: number;
  total_population: number;
  prevalence_per_100k: number;
  affected_counties: number;
  total_counties: number;
  date_range: { start: string | null; end: string | null };
}

export interface CountyDetailData {
  gadm_gid: string;
  name: string;
  boundary_id: number | null;
  area_km2: number | null;
  metrics: Record<string, { value: number; denominator: number | null; rate: number | null }>;
  timeline: { period: string; metric: string; value: number }[];
  demographics: {
    age_groups: { group: string; count: number }[];
    gender: { gender: string; count: number }[];
  };
}

export interface CdmChoroplethParams {
  metric: CdmMetricType;
  concept_id?: number;
  time_period?: string;
}
```

- [ ] **Step 2: Add API functions**

Add to `frontend/src/features/gis/api.ts`:

```typescript
export async function fetchCdmChoropleth(
  params: CdmChoroplethParams
): Promise<CountyChoroplethItem[]> {
  const { data } = await apiClient.post("/gis/cdm/choropleth", params);
  return data.data;
}

export async function fetchTimePeriods(
  metric: string = "covid_cases_monthly",
  conceptId: number = 37311061
): Promise<string[]> {
  const { data } = await apiClient.get("/gis/cdm/time-periods", {
    params: { metric, concept_id: conceptId },
  });
  return data.data;
}

export async function fetchCovidSummary(): Promise<CovidSummary> {
  const { data } = await apiClient.get("/gis/cdm/covid-summary");
  return data.data;
}

export async function fetchCountyDetail(gadmGid: string): Promise<CountyDetailData> {
  const { data } = await apiClient.get(`/gis/cdm/county/${gadmGid}`);
  return data.data;
}

export async function refreshCdmStats(): Promise<{ status: string; metrics_computed: number }> {
  const { data } = await apiClient.post("/gis/cdm/refresh");
  return data.data;
}
```

- [ ] **Step 3: Add React hooks**

Add to `frontend/src/features/gis/hooks/useGis.ts`:

```typescript
export function useCdmChoropleth(params: CdmChoroplethParams | null) {
  return useQuery({
    queryKey: ["gis", "cdm-choropleth", params],
    queryFn: () => fetchCdmChoropleth(params!),
    enabled: params !== null,
    staleTime: 60_000,
  });
}

export function useTimePeriods() {
  return useQuery({
    queryKey: ["gis", "time-periods"],
    queryFn: () => fetchTimePeriods(),
    staleTime: 5 * 60_000,
  });
}

export function useCovidSummary() {
  return useQuery({
    queryKey: ["gis", "covid-summary"],
    queryFn: fetchCovidSummary,
    staleTime: 60_000,
  });
}

export function useCountyDetail(gadmGid: string | null) {
  return useQuery({
    queryKey: ["gis", "county-detail", gadmGid],
    queryFn: () => fetchCountyDetail(gadmGid!),
    enabled: gadmGid !== null,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/gis/types.ts frontend/src/features/gis/api.ts frontend/src/features/gis/hooks/useGis.ts
git commit -m "feat(gis): add CDM spatial types, API functions, and hooks"
```

---

## Chunk 4: Frontend Components

### Task 8: COVID summary bar component

**Files:**
- Create: `frontend/src/features/gis/components/CovidSummaryBar.tsx`

A horizontal bar across the top of the GIS page showing key COVID-19 metrics at a glance.

- [ ] **Step 1: Create CovidSummaryBar**

```tsx
// frontend/src/features/gis/components/CovidSummaryBar.tsx
import { Activity, Users, Skull, MapPin } from "lucide-react";
import { useCovidSummary } from "../hooks/useGis";

export function CovidSummaryBar() {
  const { data, isLoading } = useCovidSummary();

  if (isLoading || !data) return null;

  const stats = [
    { icon: Activity, label: "COVID-19 Cases", value: data.total_cases.toLocaleString(), color: "#C9A227" },
    { icon: Skull, label: "Deaths", value: data.total_deaths.toLocaleString(), color: "#9B1B30" },
    { icon: Users, label: "CFR", value: `${data.case_fatality_rate}%`, color: "#2DD4BF" },
    { icon: MapPin, label: "Counties", value: `${data.affected_counties}/${data.total_counties}`, color: "#8A857D" },
    { icon: Activity, label: "Per 100K", value: data.prevalence_per_100k.toLocaleString(), color: "#C9A227" },
  ];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#232328] bg-[#18181B] px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        PA COVID-19
      </span>
      <div className="h-4 w-px bg-[#232328]" />
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
          <span className="text-xs text-[#8A857D]">{s.label}:</span>
          <span className="text-sm font-medium text-[#E8E4DC]">{s.value}</span>
        </div>
      ))}
      {data.date_range.start && (
        <>
          <div className="h-4 w-px bg-[#232328]" />
          <span className="text-xs text-[#5A5650]">
            {data.date_range.start?.slice(0, 7)} — {data.date_range.end?.slice(0, 7)}
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/CovidSummaryBar.tsx
git commit -m "feat(gis): add COVID summary stats bar component"
```

---

### Task 9: Time slider component

**Files:**
- Create: `frontend/src/features/gis/components/TimeSlider.tsx`

A range slider that cycles through YYYY-MM periods, with play/pause animation.

- [ ] **Step 1: Create TimeSlider**

```tsx
// frontend/src/features/gis/components/TimeSlider.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTimePeriods } from "../hooks/useGis";

interface TimeSliderProps {
  value: string | null;
  onChange: (period: string | null) => void;
}

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  const { data: periods } = useTimePeriods();
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentIndex = periods && value ? periods.indexOf(value) : -1;

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!periods || periods.length === 0) return;
      const next = currentIndex + dir;
      if (next >= 0 && next < periods.length) {
        onChange(periods[next]);
      } else if (dir === 1) {
        // Loop back to start
        onChange(periods[0]);
      }
    },
    [periods, currentIndex, onChange]
  );

  useEffect(() => {
    if (playing && periods && periods.length > 0) {
      intervalRef.current = setInterval(() => step(1), 800);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, step, periods]);

  if (!periods || periods.length === 0) return null;

  const formatPeriod = (p: string) => {
    const [y, m] = p.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-2 rounded-lg border border-[#232328] bg-[#18181B] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
          Timeline
        </span>
        <span className="text-sm font-medium text-[#C9A227]">
          {value ? formatPeriod(value) : "All time"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { onChange(null); setPlaying(false); }}
          className="rounded p-1 text-[#5A5650] hover:text-[#E8E4DC]"
          title="Reset to all-time"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setPlaying(!playing)}
          className="rounded p-1 text-[#C9A227] hover:text-[#E8E4DC]"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={periods.length - 1}
          value={currentIndex >= 0 ? currentIndex : 0}
          onChange={(e) => onChange(periods[parseInt(e.target.value)])}
          className="flex-1 accent-[#C9A227]"
        />

        <button
          onClick={() => step(1)}
          className="rounded p-1 text-[#5A5650] hover:text-[#E8E4DC]"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-between text-[10px] text-[#5A5650]">
        <span>{formatPeriod(periods[0])}</span>
        <span>{formatPeriod(periods[periods.length - 1])}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/TimeSlider.tsx
git commit -m "feat(gis): add time slider component for temporal COVID animation"
```

---

### Task 10: Metric selector component

**Files:**
- Create: `frontend/src/features/gis/components/MetricSelector.tsx`

- [ ] **Step 1: Create MetricSelector**

```tsx
// frontend/src/features/gis/components/MetricSelector.tsx
import type { CdmMetricType } from "../types";

interface MetricSelectorProps {
  value: CdmMetricType;
  onChange: (metric: CdmMetricType) => void;
}

const METRICS: { value: CdmMetricType; label: string; description: string }[] = [
  { value: "covid_cases", label: "Cases", description: "Total confirmed COVID-19 cases" },
  { value: "covid_deaths", label: "Deaths", description: "COVID-associated mortality" },
  { value: "covid_cfr", label: "CFR %", description: "Case fatality rate (deaths / cases)" },
  { value: "covid_hospitalization", label: "Hospitalized", description: "Inpatient COVID admissions" },
  { value: "patient_count", label: "Population", description: "Total patients per county" },
];

export function MetricSelector({ value, onChange }: MetricSelectorProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-[#232328] bg-[#18181B] p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        Metric
      </span>
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            title={m.description}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              value === m.value
                ? "bg-[#C9A227]/20 text-[#C9A227] font-medium"
                : "bg-[#232328] text-[#5A5650] hover:text-[#8A857D]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/MetricSelector.tsx
git commit -m "feat(gis): add metric selector component for choropleth controls"
```

---

### Task 11: County detail panel component

**Files:**
- Create: `frontend/src/features/gis/components/CountyDetail.tsx`

Shows demographics, timeline chart, and key metrics when a county is clicked.

- [ ] **Step 1: Create CountyDetail**

```tsx
// frontend/src/features/gis/components/CountyDetail.tsx
import { X, Users, Activity, Skull, Building2 } from "lucide-react";
import { useCountyDetail } from "../hooks/useGis";

interface CountyDetailProps {
  gadmGid: string;
  onClose: () => void;
}

export function CountyDetail({ gadmGid, onClose }: CountyDetailProps) {
  const { data, isLoading } = useCountyDetail(gadmGid);

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-[#232328] bg-[#18181B] p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-[#232328]" />
        <div className="h-20 animate-pulse rounded bg-[#232328]" />
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="space-y-3 rounded-lg border border-[#232328] bg-[#18181B] p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#E8E4DC]">{data.name} County</h3>
          {data.area_km2 && (
            <p className="text-xs text-[#5A5650]">{data.area_km2.toLocaleString()} km²</p>
          )}
        </div>
        <button onClick={onClose} className="text-[#5A5650] hover:text-[#E8E4DC]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {m.covid_cases && (
          <MetricCard icon={Activity} label="Cases" value={m.covid_cases.value} color="#C9A227" />
        )}
        {m.covid_deaths && (
          <MetricCard icon={Skull} label="Deaths" value={m.covid_deaths.value} color="#9B1B30" />
        )}
        {m.covid_cfr && (
          <MetricCard icon={Activity} label="CFR" value={`${m.covid_cfr.rate}%`} color="#2DD4BF" />
        )}
        {m.covid_hospitalization && (
          <MetricCard icon={Building2} label="Hospitalized" value={m.covid_hospitalization.value} color="#8A857D" />
        )}
        {m.patient_count && (
          <MetricCard icon={Users} label="Population" value={m.patient_count.value} color="#5A5650" />
        )}
      </div>

      {/* Demographics */}
      {data.demographics.age_groups.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Age Distribution (COVID)
          </span>
          <div className="space-y-1">
            {data.demographics.age_groups.map((ag) => {
              const maxCount = Math.max(...data.demographics.age_groups.map((a) => a.count));
              const pct = maxCount > 0 ? (ag.count / maxCount) * 100 : 0;
              return (
                <div key={ag.group} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-right text-[#8A857D]">{ag.group}</span>
                  <div className="flex-1 rounded-full bg-[#232328]">
                    <div
                      className="h-2 rounded-full bg-[#C9A227]/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[#5A5650]">{ag.count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gender */}
      {data.demographics.gender.length > 0 && (
        <div className="flex gap-3">
          {data.demographics.gender.map((g) => (
            <span key={g.gender} className="text-xs text-[#8A857D]">
              {g.gender}: <span className="font-medium text-[#E8E4DC]">{g.count.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Mini timeline sparkline */}
      {data.timeline.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Monthly Cases
          </span>
          <div className="flex items-end gap-px" style={{ height: 40 }}>
            {data.timeline
              .filter((t) => t.metric === "covid_cases_monthly")
              .map((t) => {
                const max = Math.max(
                  ...data.timeline.filter((x) => x.metric === "covid_cases_monthly").map((x) => x.value)
                );
                const h = max > 0 ? (t.value / max) * 100 : 0;
                return (
                  <div
                    key={t.period}
                    className="flex-1 rounded-t bg-[#C9A227]/40 hover:bg-[#C9A227]/70"
                    style={{ height: `${h}%` }}
                    title={`${t.period}: ${t.value.toLocaleString()} cases`}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="rounded border border-[#232328] bg-[#0E0E11] p-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] uppercase text-[#5A5650]">{label}</span>
      </div>
      <p className="mt-0.5 text-lg font-semibold text-[#E8E4DC]">{display}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/CountyDetail.tsx
git commit -m "feat(gis): add county detail panel with demographics and timeline"
```

---

## Chunk 5: GIS Page Integration

### Task 12: Update GisPage with COVID Explorer view

**Files:**
- Modify: `frontend/src/features/gis/pages/GisPage.tsx`

Wire all components together: summary bar, metric selector, time slider, county detail panel. Default view centers on Pennsylvania with COVID cases choropleth.

- [ ] **Step 1: Update GisPage**

Key changes to `GisPage.tsx`:
1. Import new components: `CovidSummaryBar`, `TimeSlider`, `MetricSelector`, `CountyDetail`
2. Add state: `cdmMetric` (CdmMetricType, default `"covid_cases"`), `timePeriod` (string | null), `selectedCountyGid` (string | null)
3. Add `useCdmChoropleth` hook call with current metric + time period
4. Replace the existing right sidebar content with:
   - `CovidSummaryBar` at the top of the page (above the map)
   - `MetricSelector` in sidebar
   - `TimeSlider` in sidebar
   - `CountyDetail` in sidebar when a county is selected
5. Set default viewport to Pennsylvania: `{ longitude: -77.6, latitude: 40.9, zoom: 7 }`
6. Auto-set `level: "ADM2"`, `countryCode: "USA"`, `parentGid: "USA.39_1"` to show PA counties
7. Color counties by the choropleth data (join `CdmChoroplethItem.gid` to boundary features)

The map rendering uses `useBoundaries` (GeoJSON shapes) + `useCdmChoropleth` (metric values). The `GisMap` component receives a `choroplethData` prop to color-code counties.

- [ ] **Step 2: Verify the page loads**

```bash
cd frontend && npx tsc --noEmit
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/pages/GisPage.tsx
git commit -m "feat(gis): integrate COVID explorer view into GIS page"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Load crosswalk data**

```bash
python3 scripts/load-zip-county-crosswalk.py --state PA
```

- [ ] **Step 2: Refresh CDM stats cache**

```bash
curl -X POST http://localhost:8002/cdm-spatial/refresh
```

- [ ] **Step 3: Verify all API endpoints return data**

```bash
# COVID summary
curl -s http://localhost:8002/cdm-spatial/covid-summary | python3 -m json.tool

# Choropleth (should have 67 counties)
curl -s -X POST http://localhost:8002/cdm-spatial/choropleth \
  -H "Content-Type: application/json" \
  -d '{"metric":"covid_cases"}' | python3 -c "
import sys,json; d=json.load(sys.stdin); print(f'{len(d)} counties with data')
for r in d[:5]: print(f'  {r[\"name\"]}: {r[\"value\"]:,.0f} cases')
"

# Time periods
curl -s http://localhost:8002/cdm-spatial/time-periods | python3 -m json.tool

# County detail (Philadelphia)
curl -s http://localhost:8002/cdm-spatial/county/USA.39.51_1 | python3 -m json.tool
```

- [ ] **Step 4: Test in browser**

Navigate to `http://localhost:5175/gis` (dev) or `http://localhost:8082/gis` (prod).

Expected:
- Summary bar shows total COVID cases, deaths, CFR, affected counties
- Map centered on Pennsylvania showing 67 county polygons
- Counties colored by COVID case count (darker = more cases)
- Philadelphia County should be darkest (highest case count)
- Clicking a county opens detail panel with demographics, mini timeline
- Time slider animates through months (Mar 2020 → Oct 2021)
- Metric selector switches between Cases, Deaths, CFR, Hospitalized, Population

- [ ] **Step 5: Deploy and commit**

```bash
./deploy.sh
git add -A
git commit -m "feat(gis): complete GIS-CDM integration with PA COVID explorer"
git push origin feature/chromadb-abby-brain
```

---

## Summary of Deliverables

| Component | What it does |
|-----------|-------------|
| ZIP-to-county crosswalk | Bridges OMOP `location.zip` → GADM `gis_admin_boundaries.gid` |
| `cdm_county_stats` cache | Pre-aggregated county metrics (cases, deaths, CFR, monthly, hospitalization) |
| CDM spatial query service | SQL joins through crosswalk for county-level aggregation |
| CDM spatial API (6 endpoints) | Choropleth data, time periods, COVID summary, county detail, refresh |
| Laravel proxy routes (5) | Pass-through to AI service for auth-gated access |
| `CovidSummaryBar` | Top-level stats: cases, deaths, CFR, counties |
| `TimeSlider` | Animated month-by-month playback with play/pause |
| `MetricSelector` | Switch between 5 choropleth metrics |
| `CountyDetail` | Demographics, age/gender breakdown, sparkline timeline |
| GIS Page updates | Pennsylvania-focused COVID view with all controls wired |
