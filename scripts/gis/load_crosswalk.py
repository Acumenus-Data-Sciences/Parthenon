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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
