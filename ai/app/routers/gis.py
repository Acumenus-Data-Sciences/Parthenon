from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.models.gis import (
    BoundaryLevel,
    ChoroplethMetric,
    ChoroplethRequest,
    LoadDatasetRequest,
)
from app.services.gis_boundary_loader import load_gadm, load_geoboundaries
from app.services.gis_spatial_query import (
    get_boundaries_geojson,
    get_boundary_stats,
    get_choropleth_data,
    get_region_detail,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["GIS"])


@router.get("/boundaries")
async def boundaries(
    level: BoundaryLevel = Query(BoundaryLevel.ADM0),
    country_code: str | None = Query(None),
    parent_gid: str | None = Query(None),
    bbox: str | None = Query(None),
    simplify: float = Query(0.01, ge=0.0, le=1.0),
) -> dict[str, Any]:
    return await get_boundaries_geojson(
        level=level, country_code=country_code, parent_gid=parent_gid,
        bbox=bbox, simplify_tolerance=simplify,
    )


@router.get("/boundaries/{boundary_id}")
async def boundary_detail(boundary_id: int) -> dict[str, Any]:
    detail = await get_region_detail(boundary_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Boundary not found")
    return detail


@router.get("/stats")
async def stats() -> dict[str, Any]:
    return await get_boundary_stats()


@router.post("/choropleth")
async def choropleth(request: ChoroplethRequest) -> list[dict[str, Any]]:
    return await get_choropleth_data(
        level=request.level, metric=request.metric,
        country_code=request.country_code, concept_id=request.concept_id,
        date_from=str(request.date_from) if request.date_from else None,
        date_to=str(request.date_to) if request.date_to else None,
    )


@router.post("/load")
async def load_dataset(request: LoadDatasetRequest) -> dict[str, Any]:
    try:
        if request.source == "gadm":
            count = await load_gadm(levels=request.levels, country_codes=request.country_codes)
        elif request.source == "geoboundaries":
            count = await load_geoboundaries(levels=request.levels)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown source: {request.source}")
        return {"status": "ok", "features_loaded": count}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to load GIS dataset")
        raise HTTPException(status_code=500, detail=f"Load failed: {e}")


@router.get("/countries")
async def list_countries() -> list[dict[str, Any]]:
    from sqlalchemy import text as sql_text
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from app.services.gis_spatial_query import get_engine

    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(sql_text("""
            SELECT DISTINCT country_code, country_name,
                   COUNT(*) AS boundary_count
            FROM app.gis_admin_boundaries
            GROUP BY country_code, country_name
            ORDER BY country_name
        """))
        countries = [
            {"code": r.country_code, "name": r.country_name, "boundaries": r.boundary_count}
            for r in result
        ]

    await engine.dispose()
    return countries
