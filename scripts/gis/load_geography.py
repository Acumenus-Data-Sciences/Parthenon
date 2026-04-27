#!/usr/bin/env python3
"""Load nationwide county geographic_location rows.

Phase 19 Wave 2 (GIS-02). Source-of-truth for the FIPS list is the main
``2020_UA_COUNTY`` sheet of ``2020_UA_COUNTY.xlsx`` (3,234 rows, CT_2022
sheet skipped per D-06). Geometry is OPTIONAL — if a TIGER 2020 county
shapefile is supplied via ``PHASE_19_TIGER_COUNTY_SHP`` and ``geopandas``
is importable, the loader fills the PostGIS ``geometry`` column;
otherwise rows are inserted with ``geometry=NULL`` and choropleth
rendering degrades to non-spatial table.

Idempotent on re-run via ``ON CONFLICT (geographic_code, location_type)
DO UPDATE``. Uses the env-driven DSN from :mod:`scripts.gis.loader_common`
— GIS-04 forbids hardcoded credentials.

Run::

    python scripts/gis/load_geography.py

Required env vars (see env.example):

    PGHOST, PGUSER=parthenon_migrator, PGDATABASE=parthenon
    Password resolved via PGPASSFILE / ~/.pgpass.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Allow direct invocation: ``python scripts/gis/load_geography.py``. When the
# repo root is not already on ``sys.path`` (i.e. the caller didn't set
# ``PYTHONPATH``), prepend it so the ``scripts.gis.loader_common`` import below
# resolves regardless of how the loader is launched.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from scripts.gis.loader_common import GisImportTracker, emit, get_dsn  # noqa: E402

# US state/territory FIPS → name (covers the 56 codes that appear in the UA
# xlsx, including DC + 5 territories).
US_STATE_FIPS_TO_NAME: dict[str, str] = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
    "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
    "11": "District of Columbia", "12": "Florida", "13": "Georgia", "15": "Hawaii",
    "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
    "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
    "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
    "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
    "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
    "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
    "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
    "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
    "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
    "60": "American Samoa", "66": "Guam", "69": "Northern Mariana Islands",
    "72": "Puerto Rico", "78": "U.S. Virgin Islands",
}

REPO_ROOT = Path(__file__).resolve().parents[2]
UA_XLSX_PATH = Path(
    os.environ.get("PHASE_19_UA_XLSX_PATH", str(REPO_ROOT / "2020_UA_COUNTY.xlsx"))
)
TIGER_COUNTY_SHP: Path | None = (
    Path(os.environ["PHASE_19_TIGER_COUNTY_SHP"])
    if os.environ.get("PHASE_19_TIGER_COUNTY_SHP")
    else None
)

INSERT_COUNTY_SQL_NO_GEOM = """
INSERT INTO gis.geographic_location
  (location_name, location_type, geographic_code, state_fips, county_fips,
   population, area_sq_km)
VALUES %s
ON CONFLICT (geographic_code, location_type) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  state_fips = EXCLUDED.state_fips,
  county_fips = EXCLUDED.county_fips,
  population = EXCLUDED.population,
  area_sq_km = EXCLUDED.area_sq_km
"""

INSERT_COUNTY_SQL_WITH_GEOM = """
INSERT INTO gis.geographic_location
  (location_name, location_type, geographic_code, state_fips, county_fips,
   latitude, longitude, geometry, population, area_sq_km)
VALUES %s
ON CONFLICT (geographic_code, location_type) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  state_fips = EXCLUDED.state_fips,
  county_fips = EXCLUDED.county_fips,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geometry = EXCLUDED.geometry,
  population = EXCLUDED.population,
  area_sq_km = EXCLUDED.area_sq_km
"""

INSERT_COUNTY_TEMPLATE_WITH_GEOM = (
    "(%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326)::geography, %s, %s)"
)


def read_ua_counties(path: Path) -> pd.DataFrame:
    """Read main ``2020_UA_COUNTY`` sheet only — skip ``CT_2022`` per D-06."""
    if not path.exists():
        raise FileNotFoundError(f"UA xlsx not found: {path}")
    df = pd.read_excel(
        path, sheet_name="2020_UA_COUNTY", dtype={"STATE": int, "COUNTY": int}
    )
    df["state_fips"] = df["STATE"].astype(str).str.zfill(2)
    df["county_fips_5"] = df["state_fips"] + df["COUNTY"].astype(str).str.zfill(3)
    return df


def _build_geom_lookup(shp_path: Path) -> dict[str, dict[str, Any]]:
    """Read TIGER shapefile and return ``{fips5: {wkt, lat, lon, area_km2}}``."""
    try:
        import geopandas as gpd  # type: ignore[import-untyped]
    except ImportError:
        emit("warn", message="geopandas not importable — skipping geometry column")
        return {}
    if not shp_path.exists():
        emit("warn", message=f"TIGER shapefile missing: {shp_path}")
        return {}

    gdf = gpd.read_file(shp_path)
    out: dict[str, dict[str, Any]] = {}
    for _, row in gdf.iterrows():
        fips = str(row.get("GEOID") or row.get("geoid") or "")
        if len(fips) != 5:
            continue
        geom = row.geometry
        if geom is None:
            continue
        centroid = geom.centroid
        out[fips] = {
            "wkt": geom.wkt,
            "lat": float(centroid.y),
            "lon": float(centroid.x),
            # ALAND is sq meters; convert to sq km.
            "area_km2": (int(row.get("ALAND", 0)) // 1_000_000)
            if row.get("ALAND")
            else None,
        }
    return out


def insert_counties(conn, df: pd.DataFrame, geom_lookup: dict[str, dict[str, Any]]) -> int:
    """Insert one row per county into ``gis.geographic_location``.

    Inserts WITH geometry when ``geom_lookup`` is non-empty (TIGER shapefile
    available), otherwise WITHOUT geometry (degraded mode).
    """
    rows: list[tuple[Any, ...]] = []
    use_geom = bool(geom_lookup)

    for _, r in df.iterrows():
        fips = r["county_fips_5"]
        state_name = US_STATE_FIPS_TO_NAME.get(r["state_fips"], "Unknown")
        county_name = (
            str(r["COUNTY_NAME"]).strip()
            if pd.notna(r.get("COUNTY_NAME"))
            else fips
        )
        location_name = f"{county_name}, {state_name}"
        # POP_COU is the official county-wide total (urban + rural).
        population = int(r["POP_COU"]) if pd.notna(r.get("POP_COU")) else None
        # ALAND_COU is sq m; convert to sq km.
        area_sq_km: float | None = None
        if pd.notna(r.get("ALAND_COU")):
            area_sq_km = float(int(r["ALAND_COU"]) / 1_000_000)

        if use_geom:
            geom = geom_lookup.get(fips)
            if geom is None:
                # Geometry missing for this county — fall back to NULL geometry.
                rows.append(
                    (
                        location_name, "county", fips, r["state_fips"], fips,
                        None, None, None, population, area_sq_km,
                    )
                )
            else:
                rows.append(
                    (
                        location_name, "county", fips, r["state_fips"], fips,
                        geom["lat"], geom["lon"], geom["wkt"],
                        population,
                        area_sq_km if area_sq_km is not None else geom["area_km2"],
                    )
                )
        else:
            rows.append(
                (location_name, "county", fips, r["state_fips"], fips,
                 population, area_sq_km)
            )

    with conn.cursor() as cur:
        if use_geom:
            execute_values(
                cur, INSERT_COUNTY_SQL_WITH_GEOM, rows,
                template=INSERT_COUNTY_TEMPLATE_WITH_GEOM, page_size=500,
            )
        else:
            execute_values(cur, INSERT_COUNTY_SQL_NO_GEOM, rows, page_size=500)
    conn.commit()
    return len(rows)


def main() -> int:
    emit("start", script="load_geography", scope="nationwide_counties")
    if not UA_XLSX_PATH.exists():
        emit("error", message=f"UA xlsx missing: {UA_XLSX_PATH}")
        return 1

    df = read_ua_counties(UA_XLSX_PATH)
    emit("xlsx_parsed", rows=len(df))

    geom_lookup: dict[str, dict[str, Any]] = {}
    if TIGER_COUNTY_SHP is not None:
        emit("loading_tiger", path=str(TIGER_COUNTY_SHP))
        geom_lookup = _build_geom_lookup(TIGER_COUNTY_SHP)
        emit("tiger_loaded", counties_with_geom=len(geom_lookup))
    else:
        emit("info", message="TIGER shapefile path not set — geometry column will be NULL")

    conn = psycopg2.connect(get_dsn())
    tracker = GisImportTracker(conn, filename="2020_UA_COUNTY.xlsx#counties")
    try:
        tracker.start()
        tracker.update_progress(20, f"parsed {len(df)} county rows")
        loaded = insert_counties(conn, df, geom_lookup)
        emit("counties_loaded", count=loaded)
        tracker.update_progress(95, f"inserted/updated {loaded} county rows")
        tracker.complete(
            row_count=loaded,
            summary_snapshot={
                "dataset_slug": "census_ua_2020",
                "scope": "nationwide_counties",
                "counties_loaded": loaded,
                "geometry_loaded": bool(geom_lookup),
                "ct_2022_skipped": True,
            },
            log_line=f"loaded {loaded} counties (geometry={'yes' if geom_lookup else 'no'})",
        )
        emit("complete", counties_loaded=loaded)
    except Exception as exc:
        tracker.fail(exc)
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
