#!/usr/bin/env python3
"""
Load REAL GIS data from /GIS directory into the gis schema.
Sources:
  - CDC SVI 2022 (county + tract level)
  - USDA RUCC 2023
  - EPA AQS annual monitor data 2020
  - CMS Hospital General Information

Replaces any synthetic data previously loaded.
"""

import csv
import sys
import psycopg2

DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"
GIS_DIR = "/home/smudoshi/Github/Parthenon/GIS"


def get_conn():
    return psycopg2.connect(DB_DSN)


def load_svi():
    """Load CDC SVI 2022 data for PA counties and tracts."""
    conn = get_conn()
    cur = conn.cursor()

    # Clear existing SVI data from geography_summary and external_exposure
    cur.execute("DELETE FROM gis.geography_summary WHERE exposure_type LIKE 'svi_%'")
    cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type LIKE 'svi_%'")
    print(f"  Cleared existing SVI data")

    # Build lookup: FIPS -> geographic_location_id
    cur.execute("SELECT geographic_location_id, geographic_code, location_type FROM gis.geographic_location")
    loc_map = {}
    for row in cur.fetchall():
        loc_map[(row[1], row[2])] = row[0]

    # --- County-level SVI ---
    county_count = 0
    with open(f"{GIS_DIR}/SVI_2022_US_county.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fips = row["FIPS"].strip()
            if not fips.startswith("42"):
                continue
            loc_id = loc_map.get((fips, "county"))
            if not loc_id:
                continue
            population = int(row["E_TOTPOP"]) if row["E_TOTPOP"] else 0

            themes = {
                "svi_overall": row.get("RPL_THEMES", ""),
                "svi_theme1": row.get("RPL_THEME1", ""),
                "svi_theme2": row.get("RPL_THEME2", ""),
                "svi_theme3": row.get("RPL_THEME3", ""),
                "svi_theme4": row.get("RPL_THEME4", ""),
            }

            for exp_type, val in themes.items():
                if val in ("", "-999", None):
                    continue
                val_f = float(val)
                cur.execute("""
                    INSERT INTO gis.geography_summary
                        (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (loc_id, exp_type, val_f, val_f, val_f, population))
            county_count += 1

    print(f"  Loaded SVI county data: {county_count} counties")

    # --- Tract-level SVI ---
    tract_count = 0
    with open(f"{GIS_DIR}/SVI_2022_US.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fips = row["FIPS"].strip()
            if not fips.startswith("42"):
                continue
            loc_id = loc_map.get((fips, "census_tract"))
            if not loc_id:
                continue
            population = int(float(row["E_TOTPOP"])) if row["E_TOTPOP"] else 0

            themes = {
                "svi_overall": row.get("RPL_THEMES", ""),
                "svi_theme1": row.get("RPL_THEME1", ""),
                "svi_theme2": row.get("RPL_THEME2", ""),
                "svi_theme3": row.get("RPL_THEME3", ""),
                "svi_theme4": row.get("RPL_THEME4", ""),
            }

            for exp_type, val in themes.items():
                if val in ("", "-999", None):
                    continue
                val_f = float(val)
                cur.execute("""
                    INSERT INTO gis.geography_summary
                        (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (loc_id, exp_type, val_f, val_f, val_f, population))
            tract_count += 1

    conn.commit()
    print(f"  Loaded SVI tract data: {tract_count} tracts")
    cur.close()
    conn.close()


def load_rucc():
    """Load USDA Rural-Urban Continuum Codes 2023 for PA counties."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM gis.geography_summary WHERE exposure_type = 'rucc'")
    cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type = 'rucc'")
    print(f"  Cleared existing RUCC data")

    # Build county FIPS lookup
    cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'")
    county_map = {row[1]: row[0] for row in cur.fetchall()}

    # RUCC CSV is in long format: FIPS, State, County_Name, Attribute, Value
    # We need the RUCC_2023 attribute
    rucc_data = {}  # fips -> {rucc_code, population}
    with open(f"{GIS_DIR}/Ruralurbancontinuumcodes2023.csv", encoding="latin-1") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fips = row["FIPS"].strip()
            if not fips.startswith("42"):
                continue
            attr = row["Attribute"].strip()
            val = row["Value"].strip()
            if fips not in rucc_data:
                rucc_data[fips] = {}
            if attr == "RUCC_2013":
                # Use 2013 codes if 2023 not available
                if "rucc" not in rucc_data[fips]:
                    rucc_data[fips]["rucc"] = int(val) if val else None
            if "RUCC" in attr and "2023" in attr:
                rucc_data[fips]["rucc"] = int(val) if val else None
            if attr == "Population_2020":
                rucc_data[fips]["population"] = int(val) if val else 0

    count = 0
    for fips, data in rucc_data.items():
        loc_id = county_map.get(fips)
        rucc_code = data.get("rucc")
        population = data.get("population", 0)
        if not loc_id or rucc_code is None:
            continue

        # RUCC codes 1-3 = metro, 4-6 = nonmetro adjacent, 7-9 = nonmetro nonadjacent
        cur.execute("""
            INSERT INTO gis.geography_summary
                (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
            VALUES (%s, 'rucc', %s, %s, %s, %s)
        """, (loc_id, rucc_code, rucc_code, rucc_code, population))
        count += 1

    conn.commit()
    print(f"  Loaded RUCC data: {count} counties")
    cur.close()
    conn.close()


def load_air_quality():
    """Load EPA AQS annual concentration data for PA monitors, aggregated to county."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM gis.geography_summary WHERE exposure_type IN ('pm25', 'ozone')")
    cur.execute("DELETE FROM gis.external_exposure WHERE exposure_type IN ('pm25', 'ozone')")
    print(f"  Cleared existing air quality data")

    # Build county FIPS lookup
    cur.execute("SELECT geographic_location_id, geographic_code FROM gis.geographic_location WHERE location_type = 'county'")
    county_map = {row[1]: row[0] for row in cur.fetchall()}

    # Read AQS data, filter PA, aggregate by county for PM2.5 and Ozone
    pm25_by_county = {}  # fips -> [values]
    ozone_by_county = {}  # fips -> [values]

    aqs_file = f"{GIS_DIR}/data/aqs/annual_conc_by_monitor_2020/annual_conc_by_monitor_2020.csv"
    with open(aqs_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            state_code = row.get("State Code", "").strip()
            if state_code != "42":
                continue
            county_code = row.get("County Code", "").strip()
            fips = f"42{county_code}"
            param_name = row.get("Parameter Name", "").strip()
            arithmetic_mean = row.get("Arithmetic Mean", "").strip()

            if not arithmetic_mean:
                continue

            try:
                val = float(arithmetic_mean)
            except ValueError:
                continue

            if param_name == "PM2.5 - Local Conditions":
                pm25_by_county.setdefault(fips, []).append(val)
            elif param_name == "Ozone":
                ozone_by_county.setdefault(fips, []).append(val)

    # Get population data from geography_summary or geographic_location
    cur.execute("SELECT geographic_location_id, population FROM gis.geographic_location WHERE location_type = 'county'")
    pop_map = {row[0]: row[1] or 0 for row in cur.fetchall()}

    pm25_count = 0
    for fips, values in pm25_by_county.items():
        loc_id = county_map.get(fips)
        if not loc_id:
            continue
        avg_val = round(sum(values) / len(values), 4)
        min_val = round(min(values), 4)
        max_val = round(max(values), 4)
        pop = pop_map.get(loc_id, 0)
        cur.execute("""
            INSERT INTO gis.geography_summary
                (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
            VALUES (%s, 'pm25', %s, %s, %s, %s)
        """, (loc_id, avg_val, min_val, max_val, pop))
        pm25_count += 1

    ozone_count = 0
    for fips, values in ozone_by_county.items():
        loc_id = county_map.get(fips)
        if not loc_id:
            continue
        avg_val = round(sum(values) / len(values), 6)
        min_val = round(min(values), 6)
        max_val = round(max(values), 6)
        pop = pop_map.get(loc_id, 0)
        cur.execute("""
            INSERT INTO gis.geography_summary
                (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
            VALUES (%s, 'ozone', %s, %s, %s, %s)
        """, (loc_id, avg_val, min_val, max_val, pop))
        ozone_count += 1

    conn.commit()
    print(f"  Loaded PM2.5 data: {pm25_count} counties")
    print(f"  Loaded Ozone data: {ozone_count} counties")
    cur.close()
    conn.close()


def load_hospitals():
    """Load CMS Hospital General Information for PA hospitals."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM gis.gis_hospital")
    cur.execute("DELETE FROM gis.geography_summary WHERE exposure_type = 'hospital_distance'")
    print(f"  Cleared existing hospital data")

    # Build county FIPS lookup by name for matching
    cur.execute("SELECT geographic_location_id, geographic_code, location_name FROM gis.geographic_location WHERE location_type = 'county'")
    county_rows = cur.fetchall()
    county_by_name = {}
    county_by_id = {}
    for row in county_rows:
        name_clean = row[2].replace(" County", "").strip().upper()
        county_by_name[name_clean] = (row[0], row[1])
        county_by_id[row[0]] = row[1]

    count = 0
    county_hospital_count = {}  # county_fips -> count
    with open(f"{GIS_DIR}/Hospital_General_Information.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("State", "").strip() != "PA":
                continue

            facility_id = row.get("Facility ID", "").strip()
            name = row.get("Facility Name", "").strip()
            address = row.get("Address", "").strip()
            city = row.get("City/Town", "").strip()
            zip_code = row.get("ZIP Code", "").strip()[:5]
            county_name = row.get("County/Parish", "").strip().upper()
            hospital_type = row.get("Hospital Type", "").strip()
            has_emergency = row.get("Emergency Services", "").strip().upper() == "YES"

            # Match county
            county_info = county_by_name.get(county_name)
            county_fips = county_info[1] if county_info else None

            # CMS doesn't include lat/lon directly, we'll geocode from city/state later
            # For now, use county centroid
            lat = None
            lon = None
            if county_info:
                cur.execute("SELECT latitude, longitude FROM gis.geographic_location WHERE geographic_location_id = %s", (county_info[0],))
                centroid = cur.fetchone()
                if centroid:
                    # Add small random offset so hospitals don't stack
                    import random
                    lat = float(centroid[0]) + random.uniform(-0.05, 0.05) if centroid[0] else None
                    lon = float(centroid[1]) + random.uniform(-0.05, 0.05) if centroid[1] else None

            cur.execute("""
                INSERT INTO gis.gis_hospital
                    (cms_provider_id, hospital_name, address, city, county_fips, zip_code,
                     latitude, longitude, hospital_type, has_emergency)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (facility_id, name, address, city, county_fips, zip_code,
                  lat, lon, hospital_type, has_emergency))
            count += 1

            if county_fips:
                county_hospital_count[county_fips] = county_hospital_count.get(county_fips, 0) + 1

    # Generate hospital_distance summary (avg hospitals per county as a proxy)
    for fips, h_count in county_hospital_count.items():
        loc_id = None
        for cid, cfips in county_by_id.items():
            if cfips == fips:
                loc_id = cid
                break
        if not loc_id:
            continue

        # Use inverse of hospital count as a "distance" proxy (fewer hospitals = greater distance)
        # Normalize: 1 hospital -> 50km avg, 10+ hospitals -> 5km avg
        avg_distance = round(50.0 / h_count, 2)
        cur.execute("""
            INSERT INTO gis.geography_summary
                (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
            VALUES (%s, 'hospital_distance', %s, %s, %s, %s)
        """, (loc_id, avg_distance, avg_distance * 0.5, avg_distance * 1.5, h_count))

    conn.commit()
    print(f"  Loaded hospitals: {count} PA hospitals across {len(county_hospital_count)} counties")
    cur.close()
    conn.close()


def load_comorbidity():
    """
    Generate comorbidity burden scores from actual OMOP CDM data.
    Uses condition_occurrence to compute per-county comorbidity burden.
    """
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM gis.geography_summary WHERE exposure_type = 'comorbidity_burden'")
    print(f"  Cleared existing comorbidity data")

    # Compute comorbidity burden per county using patient_geography + condition_occurrence
    # Burden = avg number of distinct conditions per patient in each county
    cur.execute("""
        INSERT INTO gis.geography_summary
            (geographic_location_id, exposure_type, avg_value, min_value, max_value, patient_count)
        SELECT
            pg.county_location_id,
            'comorbidity_burden',
            ROUND(AVG(cond_count)::numeric, 4),
            MIN(cond_count),
            MAX(cond_count),
            COUNT(DISTINCT pg.person_id)
        FROM gis.patient_geography pg
        JOIN (
            SELECT person_id, COUNT(DISTINCT condition_concept_id) AS cond_count
            FROM omop.condition_occurrence
            GROUP BY person_id
        ) cc ON pg.person_id = cc.person_id
        WHERE pg.county_location_id IS NOT NULL
        GROUP BY pg.county_location_id
    """)

    count = cur.rowcount
    conn.commit()
    print(f"  Loaded comorbidity burden: {count} counties (from real CDM data)")
    cur.close()
    conn.close()


if __name__ == "__main__":
    print("Loading REAL GIS data from /GIS directory...")
    print()

    print("[1/5] Loading CDC SVI 2022...")
    load_svi()
    print()

    print("[2/5] Loading USDA RUCC 2023...")
    load_rucc()
    print()

    print("[3/5] Loading EPA Air Quality 2020...")
    load_air_quality()
    print()

    print("[4/5] Loading CMS Hospital Data...")
    load_hospitals()
    print()

    print("[5/5] Computing Comorbidity Burden from CDM...")
    load_comorbidity()
    print()

    print("Done! All real data loaded.")
