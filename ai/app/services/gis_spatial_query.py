from __future__ import annotations

import logging
import os

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.models.gis import BoundaryLevel, ChoroplethMetric

logger = logging.getLogger(__name__)

GIS_DATABASE_URL = os.getenv("GIS_DATABASE_URL", os.getenv("DATABASE_URL", ""))
GIS_ASYNC_DATABASE_URL = GIS_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


def get_engine() -> AsyncEngine:
    return create_async_engine(
        GIS_ASYNC_DATABASE_URL,
        pool_size=5,
        connect_args={"server_settings": {"search_path": "app,public"}},
    )


async def get_boundaries_geojson(
    level: BoundaryLevel,
    country_code: str | None = None,
    parent_gid: str | None = None,
    bbox: str | None = None,
    simplify_tolerance: float = 0.01,
) -> dict[str, Any]:
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["bl.code = :level"]
    params: dict[str, Any] = {"level": level.value, "tol": simplify_tolerance}

    if country_code:
        conditions.append("b.country_code = :cc")
        params["cc"] = country_code

    if parent_gid:
        conditions.append("b.parent_gid = :pgid")
        params["pgid"] = parent_gid

    if bbox:
        west, south, east, north = [float(x) for x in bbox.split(",")]
        conditions.append(
            "b.geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)"
        )
        params.update({"west": west, "south": south, "east": east, "north": north})

    where_clause = " AND ".join(conditions)

    query = text(f"""
        SELECT
            b.id,
            b.gid,
            b.name,
            b.country_code,
            b.country_name,
            b.type_en,
            b.parent_gid,
            ST_AsGeoJSON(ST_Simplify(b.geom, :tol))::json AS geometry
        FROM app.gis_admin_boundaries b
        JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
        WHERE {where_clause}
        ORDER BY b.country_code, b.name
    """)

    async with async_session() as session:
        result = await session.execute(query, params)
        rows = result.fetchall()

    await engine.dispose()

    features = []
    for row in rows:
        if row.geometry is None:
            continue
        features.append({
            "type": "Feature",
            "id": row.id,
            "geometry": row.geometry,
            "properties": {
                "id": row.id,
                "gid": row.gid,
                "name": row.name,
                "country_code": row.country_code,
                "country_name": row.country_name,
                "type": row.type_en,
                "parent_gid": row.parent_gid,
            },
        })

    return {"type": "FeatureCollection", "features": features}


async def get_choropleth_data(
    level: BoundaryLevel,
    metric: ChoroplethMetric,
    country_code: str | None = None,
    concept_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict[str, Any]]:
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    if metric == ChoroplethMetric.PATIENT_COUNT:
        query = text("""
            SELECT
                b.id AS boundary_id, b.gid, b.name, b.country_code,
                COUNT(DISTINCT lh.entity_id) AS value
            FROM app.gis_admin_boundaries b
            JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
            LEFT JOIN app.location_history lh
                ON lh.domain_id = 'Person'
                AND ST_Within(
                    (SELECT geom FROM app.gis_admin_boundaries WHERE id = lh.location_id LIMIT 1),
                    b.geom
                )
            WHERE bl.code = :level
              AND (:cc IS NULL OR b.country_code = :cc)
            GROUP BY b.id, b.gid, b.name, b.country_code
            ORDER BY value DESC
        """)
        params: dict[str, Any] = {"level": level.value, "cc": country_code}
    elif metric == ChoroplethMetric.EXPOSURE_VALUE:
        query = text("""
            SELECT
                b.id AS boundary_id, b.gid, b.name, b.country_code,
                AVG(ee.value_as_number) AS value
            FROM app.gis_admin_boundaries b
            JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
            LEFT JOIN app.external_exposure ee ON ee.boundary_id = b.id
            WHERE bl.code = :level
              AND (:cc IS NULL OR b.country_code = :cc)
              AND (:concept_id IS NULL OR ee.exposure_concept_id = :concept_id)
              AND (:date_from IS NULL OR ee.exposure_start_date >= :date_from::date)
              AND (:date_to IS NULL OR ee.exposure_end_date <= :date_to::date)
            GROUP BY b.id, b.gid, b.name, b.country_code
            HAVING AVG(ee.value_as_number) IS NOT NULL
            ORDER BY value DESC
        """)
        params = {
            "level": level.value, "cc": country_code,
            "concept_id": concept_id, "date_from": date_from, "date_to": date_to,
        }
    else:
        return []

    async with async_session() as session:
        result = await session.execute(query, params)
        rows = result.fetchall()

    await engine.dispose()

    return [
        {"boundary_id": row.boundary_id, "gid": row.gid, "name": row.name,
         "country_code": row.country_code, "value": float(row.value) if row.value else 0.0}
        for row in rows
    ]


async def get_region_detail(boundary_id: int) -> dict[str, Any] | None:
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT b.id, b.gid, b.name, b.country_code, b.country_name,
                    b.type_en, b.parent_gid, bl.code AS level,
                    ST_Area(b.geom::geography) / 1e6 AS area_km2
                FROM app.gis_admin_boundaries b
                JOIN app.gis_boundary_levels bl ON bl.id = b.boundary_level_id
                WHERE b.id = :id
            """),
            {"id": boundary_id},
        )
        row = result.fetchone()
        if row is None:
            return None

        children_result = await session.execute(
            text("SELECT COUNT(*) FROM app.gis_admin_boundaries WHERE parent_gid = :gid"),
            {"gid": row.gid},
        )
        child_count = children_result.scalar() or 0

        exposure_result = await session.execute(
            text("""
                SELECT ee.exposure_concept_id, COUNT(*) AS record_count,
                    AVG(ee.value_as_number) AS avg_value,
                    MIN(ee.value_as_number) AS min_value,
                    MAX(ee.value_as_number) AS max_value
                FROM app.external_exposure ee
                WHERE ee.boundary_id = :id
                GROUP BY ee.exposure_concept_id LIMIT 20
            """),
            {"id": boundary_id},
        )
        exposures = [
            {"concept_id": r.exposure_concept_id, "count": r.record_count,
             "avg": float(r.avg_value) if r.avg_value else None,
             "min": float(r.min_value) if r.min_value else None,
             "max": float(r.max_value) if r.max_value else None}
            for r in exposure_result
        ]

    await engine.dispose()

    return {
        "id": row.id, "gid": row.gid, "name": row.name,
        "country_code": row.country_code, "country_name": row.country_name,
        "level": row.level, "type": row.type_en, "parent_gid": row.parent_gid,
        "area_km2": round(row.area_km2, 2) if row.area_km2 else None,
        "child_count": child_count, "exposures": exposures,
    }


async def get_boundary_stats() -> dict[str, Any]:
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT bl.code, bl.label, COUNT(b.id) AS count
            FROM app.gis_boundary_levels bl
            LEFT JOIN app.gis_admin_boundaries b ON b.boundary_level_id = bl.id
            GROUP BY bl.code, bl.label, bl.sort_order
            ORDER BY bl.sort_order
        """))
        levels = [{"code": r.code, "label": r.label, "count": r.count} for r in result]

        total_result = await session.execute(
            text("SELECT COUNT(*) FROM app.gis_admin_boundaries")
        )
        total = total_result.scalar() or 0

        country_result = await session.execute(
            text("SELECT COUNT(DISTINCT country_code) FROM app.gis_admin_boundaries")
        )
        countries = country_result.scalar() or 0

    await engine.dispose()

    return {"total_boundaries": total, "total_countries": countries, "levels": levels}
