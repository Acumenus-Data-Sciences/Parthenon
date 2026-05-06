#!/usr/bin/env python3
"""Load Pennsylvania TIGER 2020 tract geometries into ``gis.geographic_location``.

This is the tract bootstrap for the Acumenus PA cohort geography demo. It is
safe to re-run and uses the same env-driven DSN policy as the Phase 19 loaders.

Run before ``scripts/gis/load_crosswalk.py`` so the HUD crosswalk can populate
``tract_location_id`` and rebuild ``gis.patient_geography`` with tract links.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import execute_values

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from scripts.gis.loader_common import GisImportTracker, emit, get_dsn  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
TRACT_SHP = Path(
    os.environ.get(
        "PHASE_19_TIGER_PA_TRACT_SHP",
        str(REPO_ROOT / "GIS" / "data" / "tiger" / "tl_2020_42_tract.shp"),
    )
)

INSERT_SQL = """
INSERT INTO gis.geographic_location
  (location_name, location_type, geographic_code, state_fips, county_fips,
   latitude, longitude, geometry, population, area_sq_km, parent_location_id)
VALUES %s
ON CONFLICT (geographic_code, location_type) DO UPDATE SET
  location_name = EXCLUDED.location_name,
  state_fips = EXCLUDED.state_fips,
  county_fips = EXCLUDED.county_fips,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geometry = EXCLUDED.geometry,
  area_sq_km = EXCLUDED.area_sq_km,
  parent_location_id = EXCLUDED.parent_location_id
"""

INSERT_TEMPLATE = (
    "(%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326)::geography, %s, %s, %s)"
)


def load_tract_rows(path: Path, county_map: dict[str, int]) -> list[tuple[Any, ...]]:
    try:
        import geopandas as gpd  # type: ignore[import-untyped]
    except ImportError as exc:  # pragma: no cover - host dependency guard
        raise RuntimeError(
            "geopandas is required. Use the repo GIS virtualenv or install scripts/gis/requirements.txt."
        ) from exc

    if not path.exists():
        raise FileNotFoundError(f"PA tract shapefile not found: {path}")

    gdf = gpd.read_file(path)
    rows: list[tuple[Any, ...]] = []
    for _, row in gdf.iterrows():
        geoid = str(row.get("GEOID") or row.get("geoid") or "")
        if len(geoid) != 11 or not geoid.startswith("42"):
            continue

        geom = row.geometry
        if geom is None:
            continue

        centroid = geom.centroid
        county_fips = geoid[:5]
        name = str(row.get("NAMELSAD") or row.get("NAME") or geoid).strip()
        area_sq_km = None
        if row.get("ALAND") is not None:
            area_sq_km = float(row.get("ALAND")) / 1_000_000

        rows.append(
            (
                f"{name}, Pennsylvania",
                "census_tract",
                geoid,
                "42",
                county_fips,
                float(centroid.y),
                float(centroid.x),
                geom.wkt,
                None,
                area_sq_km,
                county_map.get(county_fips),
            )
        )

    return rows


def main() -> int:
    emit("start", script="load_pa_tracts", scope="pennsylvania_tract_geometries")
    conn = psycopg2.connect(get_dsn())
    tracker = GisImportTracker(conn, filename="tl_2020_42_tract.shp")

    try:
        tracker.start()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT geographic_location_id, geographic_code "
                "FROM gis.geographic_location WHERE location_type = 'county'"
            )
            county_map = {code: int(location_id) for location_id, code in cur.fetchall()}

        tracker.update_progress(15, f"loaded {len(county_map)} county parents")
        rows = load_tract_rows(TRACT_SHP, county_map)
        tracker.update_progress(60, f"parsed {len(rows)} PA tract geometries")

        with conn.cursor() as cur:
            execute_values(cur, INSERT_SQL, rows, template=INSERT_TEMPLATE, page_size=500)
        conn.commit()

        tracker.complete(
            row_count=len(rows),
            summary_snapshot={
                "dataset_slug": "tiger_pa_tract_2020",
                "scope": "pennsylvania_tract_geometries",
                "tract_rows": len(rows),
                "source_path": str(TRACT_SHP),
            },
            log_line=f"pa_tracts={len(rows)}",
        )
        emit("complete", tract_rows=len(rows))
    except Exception as exc:
        tracker.fail(exc)
        raise
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
