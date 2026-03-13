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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
