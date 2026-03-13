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
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
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
