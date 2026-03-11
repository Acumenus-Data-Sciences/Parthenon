from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class BoundaryLevel(str, Enum):
    ADM0 = "ADM0"
    ADM1 = "ADM1"
    ADM2 = "ADM2"
    ADM3 = "ADM3"
    ADM4 = "ADM4"
    ADM5 = "ADM5"


class BoundaryFeature(BaseModel):
    id: int
    gid: str
    name: str
    country_code: str
    country_name: str
    level: BoundaryLevel
    parent_gid: str | None = None
    type_en: str | None = None


class BoundaryGeoJSON(BaseModel):
    type: str = "FeatureCollection"
    features: list[dict]


class BoundaryQueryParams(BaseModel):
    level: BoundaryLevel = BoundaryLevel.ADM0
    country_code: str | None = None
    parent_gid: str | None = None
    bbox: str | None = Field(
        None,
        description="Bounding box: 'west,south,east,north' in WGS84 degrees",
        pattern=r"^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$",
    )
    simplify_tolerance: float = Field(0.01, ge=0.0, le=1.0)


class RegionStats(BaseModel):
    boundary_id: int
    gid: str
    name: str
    country_code: str
    level: str
    patient_count: int = 0
    condition_counts: dict[str, int] = {}
    exposure_summary: dict[str, float] = {}


class DatasetInfo(BaseModel):
    id: int
    name: str
    slug: str
    source: str
    data_type: str
    feature_count: int
    status: str
    loaded_at: date | None = None


class LoadDatasetRequest(BaseModel):
    source: str = Field(description="'gadm' or 'geoboundaries'")
    levels: list[BoundaryLevel] = Field(
        default=[BoundaryLevel.ADM0, BoundaryLevel.ADM1],
    )
    country_codes: list[str] | None = Field(None)


class ChoroplethMetric(str, Enum):
    PATIENT_COUNT = "patient_count"
    CONDITION_PREVALENCE = "condition_prevalence"
    INCIDENCE_RATE = "incidence_rate"
    EXPOSURE_VALUE = "exposure_value"
    MORTALITY_RATE = "mortality_rate"


class ChoroplethRequest(BaseModel):
    level: BoundaryLevel = BoundaryLevel.ADM1
    country_code: str | None = None
    metric: ChoroplethMetric = ChoroplethMetric.PATIENT_COUNT
    concept_id: int | None = None
    date_from: date | None = None
    date_to: date | None = None
