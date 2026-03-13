"""GIS Import API router — file conversion + Abby analysis."""

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

import geopandas as gpd
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

from app.services.abby_gis_analyzer import (
    analyze_columns,
    ask_about_column,
    store_confirmed_mappings,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gis-import", tags=["GIS Import"])


class AnalyzeRequest(BaseModel):
    filename: str
    headers: list[str]
    sample_rows: list[dict[str, Any]]
    column_stats: dict[str, Any]


class AskRequest(BaseModel):
    column_name: str
    sample_values: list[Any]
    stats: dict[str, Any]
    question: str


class LearnRequest(BaseModel):
    mappings: list[dict[str, Any]]


@router.post("/analyze")
async def analyze(req: AnalyzeRequest) -> dict[str, Any]:
    """Analyze columns using Abby (Ollama + ChromaDB)."""
    result = await analyze_columns(
        filename=req.filename,
        headers=req.headers,
        sample_rows=req.sample_rows,
        column_stats=req.column_stats,
    )
    return result


@router.post("/ask")
async def ask(req: AskRequest) -> dict[str, Any]:
    """Ask Abby about a specific column."""
    result = await ask_about_column(
        column_name=req.column_name,
        sample_values=req.sample_values,
        stats=req.stats,
        question=req.question,
    )
    return result


@router.post("/learn")
async def learn(req: LearnRequest) -> dict[str, Any]:
    """Store confirmed mappings in ChromaDB for curated learning."""
    count = store_confirmed_mappings(req.mappings)
    return {"stored": count}


@router.post("/convert")
async def convert_geo_file(file: UploadFile = File(...)) -> dict[str, Any]:
    """Convert geospatial file (Shapefile, KML, GeoPackage) to GeoJSON.

    Reprojects to EPSG:4326 if source CRS differs.
    """
    suffix = Path(file.filename or "upload").suffix.lower()
    allowed = {".zip", ".shp", ".geojson", ".json", ".kml", ".kmz", ".gpkg"}

    if suffix not in allowed:
        raise HTTPException(400, f"Unsupported format: {suffix}")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if suffix == ".zip":
            gdf = gpd.read_file(f"zip://{tmp_path}")
        else:
            gdf = gpd.read_file(tmp_path)

        # Reproject to WGS84 if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            logger.info(f"Reprojecting from {gdf.crs} to EPSG:4326")
            gdf = gdf.to_crs(epsg=4326)

        geojson = json.loads(gdf.to_json())

        return {
            "type": "FeatureCollection",
            "features": geojson.get("features", []),
            "feature_count": len(gdf),
            "crs": "EPSG:4326",
            "columns": list(gdf.columns.drop("geometry", errors="ignore")),
        }
    except Exception as e:
        logger.error(f"Geo conversion failed: {e}")
        raise HTTPException(500, f"Conversion failed: {e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)
