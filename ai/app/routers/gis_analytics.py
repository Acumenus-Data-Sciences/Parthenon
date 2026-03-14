"""GIS spatial analytics endpoints.

Provides Moran's I, Getis-Ord Gi* hotspots, correlation, and regression.
PySAL is lazy-loaded on first request to avoid startup penalty.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/gis-analytics", tags=["GIS Analytics"])


class MoransIRequest(BaseModel):
    values: list[float]
    coordinates: list[tuple[float, float]]
    k: int = Field(default=8, ge=2, le=30)


class HotspotsRequest(BaseModel):
    values: list[float]
    coordinates: list[tuple[float, float]]
    fips_codes: list[str]
    k: int = Field(default=8, ge=2, le=30)
    alpha: float = Field(default=0.05, ge=0.001, le=0.1)


class CorrelationRequest(BaseModel):
    x_values: list[float]
    y_values: list[float]
    x_label: str = "x"
    y_label: str = "y"


class RegressionRequest(BaseModel):
    y_values: list[float]
    x_matrix: list[list[float]]
    x_labels: list[str]
    coordinates: list[tuple[float, float]]


@router.post("/morans-i")
async def morans_i(req: MoransIRequest) -> dict[str, Any]:
    """Compute Moran's I spatial autocorrelation statistic."""
    if len(req.values) != len(req.coordinates):
        raise HTTPException(400, "values and coordinates must have same length")
    if len(req.values) < 10:
        raise HTTPException(400, "Need at least 10 observations")

    from app.services.spatial_stats import compute_morans_i

    result = compute_morans_i(req.values, req.coordinates, k=req.k)
    return {"data": result}


@router.post("/hotspots")
async def hotspots(req: HotspotsRequest) -> dict[str, Any]:
    """Compute Getis-Ord Gi* hotspot analysis."""
    if len(req.values) != len(req.coordinates) or len(req.values) != len(req.fips_codes):
        raise HTTPException(400, "values, coordinates, and fips_codes must have same length")
    if len(req.values) < 10:
        raise HTTPException(400, "Need at least 10 observations")

    from app.services.spatial_stats import compute_hotspots

    result = compute_hotspots(req.values, req.coordinates, req.fips_codes, k=req.k, alpha=req.alpha)
    return {"data": result}


@router.post("/correlation")
async def correlation(req: CorrelationRequest) -> dict[str, Any]:
    """Compute Pearson correlation between two variables."""
    if len(req.x_values) != len(req.y_values):
        raise HTTPException(400, "x_values and y_values must have same length")
    if len(req.x_values) < 3:
        raise HTTPException(400, "Need at least 3 observations")

    from app.services.spatial_stats import compute_correlation

    result = compute_correlation(req.x_values, req.y_values, req.x_label, req.y_label)
    return {"data": result}


@router.post("/regression")
async def regression(req: RegressionRequest) -> dict[str, Any]:
    """OLS regression with spatial diagnostics."""
    if len(req.y_values) != len(req.x_matrix) or len(req.y_values) != len(req.coordinates):
        raise HTTPException(400, "y_values, x_matrix, and coordinates must have same length")
    if len(req.x_labels) != len(req.x_matrix[0]):
        raise HTTPException(400, "x_labels must match x_matrix column count")

    from app.services.spatial_stats import compute_regression

    result = compute_regression(req.y_values, req.x_matrix, req.x_labels, req.coordinates)
    return {"data": result}


@router.post("/drive-time")
async def drive_time() -> dict[str, Any]:
    """Drive-time isochrone computation (deferred — returns Haversine only)."""
    return {
        "data": {
            "message": "Drive-time isochrones are deferred to a future release. Current implementation uses Haversine distance.",
            "method": "haversine",
        }
    }
