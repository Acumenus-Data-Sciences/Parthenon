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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
