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
import getpass
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path


def reexec_with_local_venv() -> None:
    """Use the repo-local GIS venv when the host python lacks geo packages."""
    if os.environ.get("PARTHENON_GIS_LOADER_NO_VENV") == "1":
        return

    venv_python = Path(__file__).resolve().parent.parent / ".venv-gis" / "bin" / "python"
    if venv_python.exists() and Path(sys.executable).absolute() != venv_python.absolute():
        os.environ["PARTHENON_GIS_LOADER_NO_VENV"] = "1"
        os.execv(str(venv_python), [str(venv_python), *sys.argv])


reexec_with_local_venv()

import geopandas as gpd
import psycopg2
from shapely.geometry import MultiPolygon

GIS_DATA_DIR = Path(__file__).resolve().parent.parent / "GIS"


def env_first(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


def pg_params(
    *,
    database: str | None,
    user: str | None,
    password: str | None,
    host: str | None,
    port: str | None,
    options: str,
) -> dict:
    params = {
        "dbname": database or "parthenon",
        "user": user or getpass.getuser(),
        "options": options,
    }
    if password:
        params["password"] = password
    if host:
        params["host"] = host
    if port:
        params["port"] = port
    return params


# Host PostgreSQL app database. Defaults are intentionally host-native:
# peer auth over the local socket into the current single-database Parthenon DB.
LOCAL_DB_PARAMS = {
    **pg_params(
        database=env_first("GIS_DB_DATABASE", "PGDATABASE", "DB_DATABASE", default="parthenon"),
        user=env_first("GIS_DB_USERNAME", "PGUSER"),
        password=env_first("GIS_DB_PASSWORD", "PGPASSWORD", "DB_PASSWORD"),
        host=env_first("GIS_DB_HOST", "PGHOST", default="/var/run/postgresql"),
        port=env_first("GIS_DB_PORT", "PGPORT"),
        options="-c search_path=app,public",
    ),
}

# Optional progress connection. By default this is the same DB as the loader
# target because app.gis_datasets now lives in the host parthenon database.
PROGRESS_DB_PARAMS = {
    **pg_params(
        database=env_first(
            "GIS_PROGRESS_DB_DATABASE",
            "DOCKER_DB_DATABASE",
            "GIS_DB_DATABASE",
            "PGDATABASE",
            "DB_DATABASE",
            default=LOCAL_DB_PARAMS["dbname"],
        ),
        user=env_first(
            "GIS_PROGRESS_DB_USERNAME",
            "DOCKER_DB_USERNAME",
            "GIS_DB_USERNAME",
            "PGUSER",
            default=LOCAL_DB_PARAMS["user"],
        ),
        password=env_first(
            "GIS_PROGRESS_DB_PASSWORD",
            "DOCKER_DB_PASSWORD",
            "GIS_DB_PASSWORD",
            "PGPASSWORD",
            "DB_PASSWORD",
        ),
        host=env_first(
            "GIS_PROGRESS_DB_HOST",
            "DOCKER_DB_HOST",
            "GIS_DB_HOST",
            "PGHOST",
            default=LOCAL_DB_PARAMS.get("host"),
        ),
        port=env_first("GIS_PROGRESS_DB_PORT", "DOCKER_DB_PORT", "GIS_DB_PORT", "PGPORT"),
        options="-c search_path=app,public",
    ),
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
                self.docker_conn = psycopg2.connect(**PROGRESS_DB_PARAMS)
                self.docker_conn.autocommit = True
            except Exception as e:
                self.emit({"event": "warning", "message": f"Cannot connect to progress database: {e}"})

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


def ensure_boundary_schema(conn, tracker: ProgressTracker) -> None:
    """Create the compatibility tables used by current GIS API endpoints."""
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS app.gis_boundary_levels (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(10) NOT NULL UNIQUE,
            label VARCHAR(255) NOT NULL,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE
        )
        """
    )
    cur.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = 'app.gis_boundary_levels'::regclass
                  AND contype = 'p'
            ) THEN
                ALTER TABLE app.gis_boundary_levels
                    ADD CONSTRAINT gis_boundary_levels_pkey PRIMARY KEY (id);
            END IF;
        END
        $$;
        """
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS gis_boundary_levels_code_unique "
        "ON app.gis_boundary_levels (code)"
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS app.gis_admin_boundaries (
            id BIGSERIAL PRIMARY KEY,
            gid VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            name_variant VARCHAR(255),
            country_code VARCHAR(3) NOT NULL,
            country_name VARCHAR(255) NOT NULL,
            boundary_level_id BIGINT NOT NULL REFERENCES app.gis_boundary_levels(id),
            parent_gid VARCHAR(50),
            type VARCHAR(255),
            type_en VARCHAR(255),
            iso_code VARCHAR(10),
            hasc_code VARCHAR(20),
            valid_from DATE,
            valid_to DATE,
            source VARCHAR(20) NOT NULL DEFAULT 'gadm',
            source_version VARCHAR(20),
            geom geometry(MultiPolygon, 4326),
            created_at TIMESTAMP(0) WITHOUT TIME ZONE,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE
        )
        """
    )
    cur.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'app'
                  AND table_name = 'gis_admin_boundaries'
                  AND column_name = 'geom'
            ) THEN
                ALTER TABLE app.gis_admin_boundaries
                    ADD COLUMN geom geometry(MultiPolygon, 4326);
            END IF;
        END
        $$;
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_gis_boundaries_geom ON app.gis_admin_boundaries USING GIST (geom)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_gis_boundaries_parent_gid ON app.gis_admin_boundaries (parent_gid)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_gis_boundaries_country_code ON app.gis_admin_boundaries (country_code)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_gis_boundaries_level_country ON app.gis_admin_boundaries (boundary_level_id, country_code)")

    level_rows = [
        ("ADM0", "Country", "National boundary", 0),
        ("ADM1", "Province / State", "First-level administrative division", 1),
        ("ADM2", "District / County", "Second-level administrative division", 2),
        ("ADM3", "Sub-district", "Third-level administrative division", 3),
        ("ADM4", "Municipality", "Fourth-level administrative division", 4),
        ("ADM5", "Local Area", "Fifth-level administrative division", 5),
    ]
    for code, label, description, sort_order in level_rows:
        cur.execute(
            """
            INSERT INTO app.gis_boundary_levels
                (code, label, description, sort_order, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (code) DO UPDATE SET
                label = EXCLUDED.label,
                description = EXCLUDED.description,
                sort_order = EXCLUDED.sort_order,
                updated_at = NOW()
            """,
            (code, label, description, sort_order),
        )

    conn.commit()
    tracker.emit({"event": "schema_ready"})


def refresh_level_ids(conn) -> None:
    cur = conn.cursor()
    cur.execute("SELECT code, id FROM app.gis_boundary_levels")
    LEVEL_IDS.clear()
    LEVEL_IDS.update({code: int(id_) for code, id_ in cur.fetchall()})


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
        processed = 0
        inserted = 0

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
                   ON CONFLICT (gid) DO NOTHING
                   RETURNING id""",
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
            processed += 1
            if cur.fetchone() is not None:
                inserted += 1

            if processed % batch_size == 0:
                conn.commit()
                tracker.emit({
                    "event": "batch",
                    "level": level,
                    "loaded": processed,
                    "inserted": inserted,
                    "total": len(gdf),
                })
                # Update progress: completed levels + fraction of current level
                level_progress = processed / len(gdf)
                overall = int(((level_idx + level_progress) / total_levels) * 100)
                tracker.update_dataset(progress_percentage=overall)
                tracker.append_log(f"{level}: {processed}/{len(gdf)} features processed, {inserted} inserted")

        conn.commit()
        tracker.emit({"event": "level_done", "level": level, "count": inserted, "processed": processed})
        tracker.append_log(f"{level} complete: {processed} features processed, {inserted} inserted")
        total_loaded += inserted

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
            tracker.emit({"event": "warning", "level": level, "message": f"File not found: {geojson_path}; skipping {level}"})
            tracker.append_log(f"WARNING: {filename} not found; skipped {level}")
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
        processed = 0
        inserted = 0

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
                   ON CONFLICT (gid) DO NOTHING
                   RETURNING id""",
                (
                    str(gid), str(name), str(country_code),
                    str(name) if level == "ADM0" else "",
                    LEVEL_IDS[level],
                    "geoboundaries", "CGAZ",
                    geom.wkt,
                ),
            )
            processed += 1
            if cur.fetchone() is not None:
                inserted += 1

            if processed % batch_size == 0:
                conn.commit()
                tracker.emit({
                    "event": "batch",
                    "level": level,
                    "loaded": processed,
                    "inserted": inserted,
                    "total": len(gdf),
                })
                level_progress = processed / len(gdf)
                overall = int(((level_idx + level_progress) / total_levels) * 100)
                tracker.update_dataset(progress_percentage=overall)

        conn.commit()
        tracker.emit({"event": "level_done", "level": level, "count": inserted, "processed": processed})
        tracker.append_log(f"{level} complete: {processed} features processed, {inserted} inserted")
        total_loaded += inserted

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
        tracker.update_dataset(
            status="running",
            error_message=None,
            progress_percentage=0,
            started_at=datetime.now(),
        )
        tracker.append_log("Starting GIS boundary load...")

    try:
        conn = psycopg2.connect(**LOCAL_DB_PARAMS)
        conn.autocommit = False
        ensure_boundary_schema(conn, tracker)
        refresh_level_ids(conn)

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
                error_message=None,
                loaded_at=datetime.now(),
                completed_at=datetime.now(),
            )
            tracker.append_log(f"Load complete. Total features: {total}")

    except Exception as e:
        tracker.emit({"event": "error", "message": str(e)})
        if args.dataset_id:
            tracker.update_dataset(status="failed", error_message=str(e), completed_at=datetime.now())
            tracker.append_log(f"ERROR: {e}")
        sys.exit(1)
    finally:
        tracker.close()


if __name__ == "__main__":
    main()
