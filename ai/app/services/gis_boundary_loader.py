from __future__ import annotations

import asyncio
import logging
import os
from functools import partial
from pathlib import Path

import geopandas as gpd
from shapely.geometry import MultiPolygon
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.models.gis import BoundaryLevel

logger = logging.getLogger(__name__)

GIS_DATA_DIR = Path(os.getenv("GIS_DATA_DIR", "/app/gis_data"))

LEVEL_LABELS = {
    "ADM0": "Country",
    "ADM1": "Province / State",
    "ADM2": "District / County",
    "ADM3": "Sub-district",
    "ADM4": "Municipality",
    "ADM5": "Local Area",
}

GIS_DATABASE_URL = os.getenv("GIS_DATABASE_URL", os.getenv("DATABASE_URL", ""))
ASYNC_DATABASE_URL = GIS_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


def get_engine() -> AsyncEngine:
    return create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=5,
        connect_args={"server_settings": {"search_path": "app,public"}},
    )


async def ensure_boundary_levels(session: AsyncSession) -> dict[str, int]:
    result = await session.execute(
        text("SELECT id, code FROM app.gis_boundary_levels")
    )
    existing = {row.code: row.id for row in result}

    for i, (code, label) in enumerate(LEVEL_LABELS.items()):
        if code not in existing:
            result = await session.execute(
                text(
                    "INSERT INTO app.gis_boundary_levels (code, label, sort_order, created_at, updated_at) "
                    "VALUES (:code, :label, :sort, NOW(), NOW()) RETURNING id"
                ),
                {"code": code, "label": label, "sort": i},
            )
            existing[code] = result.scalar_one()
    await session.commit()
    return existing


def _build_gadm_sql(level_num: int, country_codes: list[str] | None = None) -> str:
    """Build SQL to extract a specific admin level from the GADM GeoPackage.

    GADM stores every feature at the finest granularity. Each row has GID_0
    through GID_5. To get ADM0 countries we GROUP BY GID_0; for ADM1 we
    GROUP BY GID_1, etc. The GROUP BY collapses duplicates and picks one
    geometry per distinct admin unit.
    """
    gid_col = f"GID_{level_num}"
    name_col = f"NAME_{level_num}"

    # Columns we always need
    select_cols = [f"GID_0", f"NAME_0", f"{gid_col}", f"{name_col}", "geom"]

    # Optional columns per level
    if level_num >= 1:
        select_cols.extend([f"VARNAME_{level_num}", f"ENGTYPE_{level_num}"])
        if level_num == 1:
            select_cols.append("ISO_1")
        # Parent GID for non-country levels
        select_cols.append(f"GID_{level_num - 1}")

    where_parts = [f"{gid_col} IS NOT NULL", f"{gid_col} != ''"]

    if country_codes:
        codes_str = ", ".join(f"'{c}'" for c in country_codes)
        where_parts.append(f"GID_0 IN ({codes_str})")

    where_clause = " AND ".join(where_parts)
    cols = ", ".join(select_cols)

    return f"SELECT {cols} FROM gadm_410 WHERE {where_clause} GROUP BY {gid_col}"


def _read_gadm_level(gpkg_path: str, level_num: int, country_codes: list[str] | None) -> gpd.GeoDataFrame:
    """Read a single admin level from GADM GeoPackage using SQL filter.

    This avoids loading the entire 2.7GB file into memory — only the
    features for the requested level are read (~15-30s per level).
    """
    sql = _build_gadm_sql(level_num, country_codes)
    logger.info("Reading GADM level ADM%d with SQL filter", level_num)
    gdf = gpd.read_file(gpkg_path, sql=sql)
    logger.info("Read %d ADM%d features from GADM", len(gdf), level_num)
    return gdf


async def load_gadm(
    levels: list[BoundaryLevel],
    country_codes: list[str] | None = None,
    batch_size: int = 200,
) -> int:
    gpkg_path = GIS_DATA_DIR / "gadm_410.gpkg"
    if not gpkg_path.exists():
        raise FileNotFoundError(f"GADM file not found: {gpkg_path}")

    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            level_num = int(level.value.replace("ADM", ""))
            gid_col = f"GID_{level_num}"
            name_col = f"NAME_{level_num}"

            # Read from GeoPackage in a thread to avoid blocking the event loop
            loop = asyncio.get_running_loop()
            gdf = await loop.run_in_executor(
                None,
                partial(_read_gadm_level, str(gpkg_path), level_num, country_codes),
            )

            if gdf.empty:
                logger.warning("No features found for level %s", level.value)
                continue

            logger.info("Loading %d %s boundaries into PostGIS", len(gdf), level.value)

            rows = []
            for _, row in gdf.iterrows():
                geom = row.geometry
                if geom is None:
                    continue
                if geom.geom_type == "Polygon":
                    geom = MultiPolygon([geom])

                parent_gid = None
                if level_num > 0:
                    parent_col = f"GID_{level_num - 1}"
                    parent_gid = row.get(parent_col)

                varname_col = f"VARNAME_{level_num}"
                engtype_col = f"ENGTYPE_{level_num}"

                rows.append({
                    "gid": str(row[gid_col]),
                    "name": str(row[name_col]) if row[name_col] else "Unknown",
                    "name_variant": str(row.get(varname_col, "") or ""),
                    "country_code": str(row["GID_0"]),
                    "country_name": str(row["NAME_0"]),
                    "boundary_level_id": level_map[level.value],
                    "parent_gid": str(parent_gid) if parent_gid else None,
                    "type_en": str(row.get(engtype_col, "") or ""),
                    "iso_code": str(row.get("ISO_1", "") or "") if level_num == 1 else None,
                    "source": "gadm",
                    "source_version": "4.1.0",
                    "geom_wkt": geom.wkt,
                })

            for i in range(0, len(rows), batch_size):
                batch = rows[i : i + batch_size]
                for r in batch:
                    await session.execute(
                        text(
                            "INSERT INTO app.gis_admin_boundaries "
                            "(gid, name, name_variant, country_code, country_name, "
                            "boundary_level_id, parent_gid, type_en, iso_code, "
                            "source, source_version, geom, created_at, updated_at) "
                            "VALUES (:gid, :name, :name_variant, :country_code, :country_name, "
                            ":boundary_level_id, :parent_gid, :type_en, :iso_code, "
                            ":source, :source_version, "
                            "ST_Multi(ST_GeomFromText(:geom_wkt, 4326)), NOW(), NOW()) "
                            "ON CONFLICT (gid) DO NOTHING"
                        ),
                        r,
                    )
                await session.commit()
                total_loaded += len(batch)
                logger.info("  Loaded %d / %d %s features", min(i + batch_size, len(rows)), len(rows), level.value)

    await engine.dispose()
    return total_loaded


async def load_geoboundaries(
    levels: list[BoundaryLevel],
    batch_size: int = 200,
) -> int:
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            filename = f"geoBoundariesCGAZ_{level.value}.geojson"
            geojson_path = GIS_DATA_DIR / filename
            if not geojson_path.exists():
                logger.warning("File not found: %s, skipping", geojson_path)
                continue

            # Read in a thread to avoid blocking
            loop = asyncio.get_running_loop()
            gdf = await loop.run_in_executor(
                None,
                partial(gpd.read_file, str(geojson_path)),
            )
            logger.info("Loaded %d features from %s", len(gdf), filename)

            for i in range(0, len(gdf), batch_size):
                batch_df = gdf.iloc[i : i + batch_size]
                for _, row in batch_df.iterrows():
                    geom = row.geometry
                    if geom is None:
                        continue
                    if geom.geom_type == "Polygon":
                        geom = MultiPolygon([geom])

                    gid = row.get("shapeID", row.get("shapeGroup", ""))
                    name = row.get("shapeName", "Unknown")
                    country_code = row.get("shapeGroup", "")

                    await session.execute(
                        text(
                            "INSERT INTO app.gis_admin_boundaries "
                            "(gid, name, country_code, country_name, "
                            "boundary_level_id, source, source_version, "
                            "geom, created_at, updated_at) "
                            "VALUES (:gid, :name, :cc, :cn, :level_id, "
                            "'geoboundaries', 'CGAZ', "
                            "ST_Multi(ST_GeomFromText(:geom_wkt, 4326)), NOW(), NOW()) "
                            "ON CONFLICT (gid) DO NOTHING"
                        ),
                        {
                            "gid": str(gid),
                            "name": str(name),
                            "cc": str(country_code),
                            "cn": str(name) if level.value == "ADM0" else "",
                            "level_id": level_map[level.value],
                            "geom_wkt": geom.wkt,
                        },
                    )
                await session.commit()
                total_loaded += len(batch_df)
                logger.info("  Loaded %d / %d %s features", min(i + batch_size, len(gdf)), len(gdf), level.value)

    await engine.dispose()
    return total_loaded
