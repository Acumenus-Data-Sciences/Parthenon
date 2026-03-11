#!/usr/bin/env python3
"""Load GADM or geoBoundaries data into local PostgreSQL.

Usage:
    python3 scripts/load-gis-boundaries.py --source gadm --levels ADM0 ADM1
    python3 scripts/load-gis-boundaries.py --source geoboundaries --levels ADM0 ADM1 ADM2
    python3 scripts/load-gis-boundaries.py --source gadm --levels ADM0 ADM1 --dataset-id 3

When --dataset-id is provided, progress is also written to the Docker PG
gis_datasets table so the browser progress modal can poll status.

Output: JSON progress lines to stdout:
    {"event":"start","level":"ADM0","total_levels":2}
    {"event":"reading","level":"ADM0"}
    {"event":"inserting","level":"ADM0","total":263,"loaded":0}
    {"event":"batch","level":"ADM0","loaded":200,"total":263}
    {"event":"level_done","level":"ADM0","count":263}
    {"event":"done","total":526}
    {"event":"error","message":"..."}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import geopandas as gpd
import psycopg2
from shapely.geometry import MultiPolygon

GIS_DATA_DIR = Path(__file__).resolve().parent.parent / "GIS"

# Local PG 17 — peer auth, ohdsi database, app schema for PostGIS
LOCAL_DB_PARAMS = {
    "dbname": "ohdsi",
    "user": "smudoshi",
    "host": "/var/run/postgresql",
    "options": "-c search_path=app,public",
}

# Docker PG 16 — for updating gis_datasets progress (optional)
DOCKER_DB_PARAMS = {
    "dbname": "parthenon",
    "user": "parthenon",
    "password": os.environ.get("DOCKER_DB_PASSWORD", "secret"),
    "host": "localhost",
    "port": os.environ.get("DOCKER_DB_PORT", "5480"),
    "options": "-c search_path=app,public",
}

LEVEL_IDS = {
    "ADM0": 1, "ADM1": 2, "ADM2": 3,
    "ADM3": 4, "ADM4": 5, "ADM5": 6,
}


class ProgressTracker:
    """Track progress via stdout JSON and optionally Docker PG gis_datasets."""

    def __init__(self, dataset_id: int | None = None):
        self.dataset_id = dataset_id
        self.docker_conn = None
        if dataset_id:
            try:
                self.docker_conn = psycopg2.connect(**DOCKER_DB_PARAMS)
                self.docker_conn.autocommit = True
            except Exception as e:
                self.emit({"event": "warning", "message": f"Cannot connect to Docker PG for progress: {e}"})

    def emit(self, obj: dict) -> None:
        print(json.dumps(obj), flush=True)

    def update_dataset(self, **fields) -> None:
        if not self.docker_conn or not self.dataset_id:
            return
        sets = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [self.dataset_id]
        try:
            cur = self.docker_conn.cursor()
            cur.execute(f"UPDATE app.gis_datasets SET {sets} WHERE id = %s", vals)
        except Exception:
            pass  # Non-critical — stdout is the primary progress channel

    def append_log(self, message: str) -> None:
        if not self.docker_conn or not self.dataset_id:
            return
        try:
            cur = self.docker_conn.cursor()
            cur.execute(
                "UPDATE app.gis_datasets SET log_output = COALESCE(log_output, '') || %s WHERE id = %s",
                (message + "\n", self.dataset_id),
            )
        except Exception:
            pass

    def close(self) -> None:
        if self.docker_conn:
            self.docker_conn.close()


def build_gadm_sql(level_num: int) -> str:
    gid_col = f"GID_{level_num}"
    name_col = f"NAME_{level_num}"
    cols = [f"GID_0", f"NAME_0", gid_col, name_col, "geom"]
    if level_num >= 1:
        cols.extend([f"VARNAME_{level_num}", f"ENGTYPE_{level_num}"])
        if level_num == 1:
            cols.append("ISO_1")
        cols.append(f"GID_{level_num - 1}")
    where = f"{gid_col} IS NOT NULL AND {gid_col} != ''"
    return f"SELECT {', '.join(cols)} FROM gadm_410 WHERE {where} GROUP BY {gid_col}"


def load_gadm(levels: list[str], conn, tracker: ProgressTracker, batch_size: int = 200) -> int:
    gpkg_path = GIS_DATA_DIR / "gadm_410.gpkg"
    if not gpkg_path.exists():
        tracker.emit({"event": "error", "message": f"GADM file not found: {gpkg_path}"})
        return 0

    total_loaded = 0
    total_levels = len(levels)

    for level_idx, level in enumerate(levels):
        level_num = int(level.replace("ADM", ""))
        gid_col = f"GID_{level_num}"
        name_col = f"NAME_{level_num}"

        tracker.emit({"event": "reading", "level": level})
        tracker.append_log(f"Reading {level} from GADM GeoPackage...")
        t0 = time.time()
        sql = build_gadm_sql(level_num)
        gdf = gpd.read_file(str(gpkg_path), sql=sql)
        elapsed = round(time.time() - t0, 1)
        tracker.emit({"event": "read_done", "level": level, "count": len(gdf), "seconds": elapsed})
        tracker.append_log(f"Read {len(gdf)} {level} features in {elapsed}s")

        if gdf.empty:
            continue

        tracker.emit({"event": "inserting", "level": level, "total": len(gdf), "loaded": 0})
        tracker.append_log(f"Inserting {len(gdf)} {level} boundaries into PostGIS...")
        cur = conn.cursor()
        loaded = 0

        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            if geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])

            parent_gid = None
            if level_num > 0:
                parent_gid = row.get(f"GID_{level_num - 1}")

            varname = row.get(f"VARNAME_{level_num}", "") or ""
            engtype = row.get(f"ENGTYPE_{level_num}", "") or ""
            iso_code = row.get("ISO_1", "") or "" if level_num == 1 else None

            cur.execute(
                """INSERT INTO app.gis_admin_boundaries
                   (gid, name, name_variant, country_code, country_name,
                    boundary_level_id, parent_gid, type_en, iso_code,
                    source, source_version, geom, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           ST_Multi(ST_GeomFromText(%s, 4326)), NOW(), NOW())
                   ON CONFLICT (gid) DO NOTHING""",
                (
                    str(row[gid_col]),
                    str(row[name_col]) if row[name_col] else "Unknown",
                    str(varname),
                    str(row["GID_0"]),
                    str(row["NAME_0"]),
                    LEVEL_IDS[level],
                    str(parent_gid) if parent_gid else None,
                    str(engtype),
                    iso_code,
                    "gadm", "4.1.0",
                    geom.wkt,
                ),
            )
            loaded += 1

            if loaded % batch_size == 0:
                conn.commit()
                tracker.emit({"event": "batch", "level": level, "loaded": loaded, "total": len(gdf)})
                # Update progress: completed levels + fraction of current level
                level_progress = loaded / len(gdf)
                overall = int(((level_idx + level_progress) / total_levels) * 100)
                tracker.update_dataset(progress_percentage=overall)
                tracker.append_log(f"{level}: {loaded}/{len(gdf)} features loaded")

        conn.commit()
        tracker.emit({"event": "level_done", "level": level, "count": loaded})
        tracker.append_log(f"{level} complete: {loaded} features loaded")
        total_loaded += loaded

        overall = int(((level_idx + 1) / total_levels) * 100)
        tracker.update_dataset(progress_percentage=overall, feature_count=total_loaded)

    return total_loaded


def load_geoboundaries(levels: list[str], conn, tracker: ProgressTracker, batch_size: int = 200) -> int:
    total_loaded = 0
    total_levels = len(levels)

    for level_idx, level in enumerate(levels):
        filename = f"geoBoundariesCGAZ_{level}.geojson"
        geojson_path = GIS_DATA_DIR / filename
        if not geojson_path.exists():
            tracker.emit({"event": "error", "message": f"File not found: {geojson_path}"})
            continue

        tracker.emit({"event": "reading", "level": level})
        tracker.append_log(f"Reading {level} from {filename}...")
        t0 = time.time()
        gdf = gpd.read_file(str(geojson_path))
        elapsed = round(time.time() - t0, 1)
        tracker.emit({"event": "read_done", "level": level, "count": len(gdf), "seconds": elapsed})
        tracker.append_log(f"Read {len(gdf)} {level} features in {elapsed}s")

        if gdf.empty:
            continue

        tracker.emit({"event": "inserting", "level": level, "total": len(gdf), "loaded": 0})
        tracker.append_log(f"Inserting {len(gdf)} {level} boundaries...")
        cur = conn.cursor()
        loaded = 0

        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            if geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])

            gid = row.get("shapeID", row.get("shapeGroup", ""))
            name = row.get("shapeName", "Unknown")
            country_code = row.get("shapeGroup", "")

            cur.execute(
                """INSERT INTO app.gis_admin_boundaries
                   (gid, name, country_code, country_name,
                    boundary_level_id, source, source_version,
                    geom, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s,
                           ST_Multi(ST_GeomFromText(%s, 4326)), NOW(), NOW())
                   ON CONFLICT (gid) DO NOTHING""",
                (
                    str(gid), str(name), str(country_code),
                    str(name) if level == "ADM0" else "",
                    LEVEL_IDS[level],
                    "geoboundaries", "CGAZ",
                    geom.wkt,
                ),
            )
            loaded += 1

            if loaded % batch_size == 0:
                conn.commit()
                tracker.emit({"event": "batch", "level": level, "loaded": loaded, "total": len(gdf)})
                level_progress = loaded / len(gdf)
                overall = int(((level_idx + level_progress) / total_levels) * 100)
                tracker.update_dataset(progress_percentage=overall)

        conn.commit()
        tracker.emit({"event": "level_done", "level": level, "count": loaded})
        tracker.append_log(f"{level} complete: {loaded} features loaded")
        total_loaded += loaded

        overall = int(((level_idx + 1) / total_levels) * 100)
        tracker.update_dataset(progress_percentage=overall, feature_count=total_loaded)

    return total_loaded


def main() -> None:
    parser = argparse.ArgumentParser(description="Load GIS boundary data into local PostgreSQL")
    parser.add_argument("--source", required=True, choices=["gadm", "geoboundaries"])
    parser.add_argument("--levels", nargs="+", required=True)
    parser.add_argument("--dataset-id", type=int, default=None,
                        help="Docker PG gis_datasets.id for browser progress tracking")
    parser.add_argument("--clear", action="store_true",
                        help="Clear existing boundaries for specified levels before loading")
    args = parser.parse_args()

    tracker = ProgressTracker(args.dataset_id)
    tracker.emit({"event": "start", "source": args.source, "levels": args.levels, "total_levels": len(args.levels)})

    if args.dataset_id:
        tracker.update_dataset(status="running")
        tracker.append_log("Starting GIS boundary load...")

    try:
        conn = psycopg2.connect(**LOCAL_DB_PARAMS)
        conn.autocommit = False

        if args.clear:
            cur = conn.cursor()
            level_ids = [LEVEL_IDS[l] for l in args.levels if l in LEVEL_IDS]
            if level_ids:
                cur.execute(
                    "DELETE FROM app.gis_admin_boundaries WHERE boundary_level_id = ANY(%s)",
                    (level_ids,),
                )
                conn.commit()
                tracker.emit({"event": "cleared", "levels": args.levels})
                tracker.append_log(f"Cleared existing data for levels: {', '.join(args.levels)}")

        if args.source == "gadm":
            total = load_gadm(args.levels, conn, tracker)
        else:
            total = load_geoboundaries(args.levels, conn, tracker)

        conn.close()
        tracker.emit({"event": "done", "total": total})

        if args.dataset_id:
            tracker.update_dataset(
                status="completed",
                feature_count=total,
                progress_percentage=100,
            )
            tracker.append_log(f"Load complete. Total features: {total}")

    except Exception as e:
        tracker.emit({"event": "error", "message": str(e)})
        if args.dataset_id:
            tracker.update_dataset(status="failed", error_message=str(e))
            tracker.append_log(f"ERROR: {e}")
        sys.exit(1)
    finally:
        tracker.close()


if __name__ == "__main__":
    main()
