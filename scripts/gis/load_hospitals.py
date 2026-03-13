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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
