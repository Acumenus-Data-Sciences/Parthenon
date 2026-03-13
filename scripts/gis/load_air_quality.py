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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
