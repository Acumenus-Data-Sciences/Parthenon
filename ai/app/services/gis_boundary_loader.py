from __future__ import annotations

import logging
import os
from pathlib import Path

import geopandas as gpd
from shapely.geometry import MultiPolygon
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

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

DATABASE_URL = os.getenv("DATABASE_URL", "")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


def get_engine():
    return create_async_engine(ASYNC_DATABASE_URL, pool_size=5)


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


async def load_gadm(
    levels: list[BoundaryLevel],
    country_codes: list[str] | None = None,
    batch_size: int = 500,
) -> int:
    gpkg_path = GIS_DATA_DIR / "gadm_410.gpkg"
    if not gpkg_path.exists():
        raise FileNotFoundError(f"GADM file not found: {gpkg_path}")

    logger.info("Reading GADM GeoPackage from %s", gpkg_path)
    gdf = gpd.read_file(str(gpkg_path))
    logger.info("GADM loaded: %d features", len(gdf))

    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            level_num = int(level.value.replace("ADM", ""))
            gid_col = f"GID_{level_num}"
            name_col = f"NAME_{level_num}"

            if gid_col not in gdf.columns:
                logger.warning("Column %s not in GADM, skipping level %s", gid_col, level)
                continue

            level_df = gdf[gdf[gid_col].notna()].copy()

            if country_codes:
                level_df = level_df[level_df["GID_0"].isin(country_codes)]

            level_df = level_df.drop_duplicates(subset=[gid_col])

            logger.info("Loading %d %s boundaries", len(level_df), level.value)

            rows = []
            for _, row in level_df.iterrows():
                geom = row.geometry
                if geom is None:
                    continue
                if geom.geom_type == "Polygon":
                    geom = MultiPolygon([geom])

                parent_gid = None
                if level_num > 0:
                    parent_col = f"GID_{level_num - 1}"
                    parent_gid = row.get(parent_col)

                rows.append({
                    "gid": str(row[gid_col]),
                    "name": str(row[name_col]) if row[name_col] else "Unknown",
                    "name_variant": str(row.get(f"VARNAME_{level_num}", "") or ""),
                    "country_code": str(row["GID_0"]),
                    "country_name": str(row["NAME_0"]),
                    "boundary_level_id": level_map[level.value],
                    "parent_gid": str(parent_gid) if parent_gid else None,
                    "type_en": str(row.get(f"ENGTYPE_{level_num}", "") or ""),
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
    batch_size: int = 500,
) -> int:
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total_loaded = 0
    async with async_session() as session:
        level_map = await ensure_boundary_levels(session)

        for level in levels:
            filename = f"geoBoundariesCGAZ_{level.value}.geojson"
            geojson_path = GIS_DATA_DIR / filename
            if not geojson_path.exists():
                logger.warning("File not found: %s, skipping", geojson_path)
                continue

            logger.info("Reading %s", geojson_path)
            gdf = gpd.read_file(str(geojson_path))
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
