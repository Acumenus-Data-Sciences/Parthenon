from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class CdmMetricType(str, Enum):
    PATIENT_COUNT = "patient_count"
    CASES = "cases"
    DEATHS = "deaths"
    CFR = "cfr"
    CASES_MONTHLY = "cases_monthly"
    HOSPITALIZATION = "hospitalization"


class CdmChoroplethRequest(BaseModel):
    metric: CdmMetricType = CdmMetricType.CASES
    concept_id: int = Field(description="OMOP condition concept ID")
    time_period: str | None = Field(default=None, description="YYYY-MM for monthly data")


class CountyChoroplethItem(BaseModel):
    boundary_id: int
    gid: str
    name: str
    value: float
    denominator: float | None = None
    rate: float | None = None


class ConditionSummary(BaseModel):
    condition_concept_id: int
    condition_name: str
    total_cases: int
    total_deaths: int
    case_fatality_rate: float
    total_population: int
    prevalence_per_100k: float
    affected_counties: int
    total_counties: int
    date_range: dict


class ConditionItem(BaseModel):
    concept_id: int
    name: str
    patient_count: int
    snomed_category: str


class ConditionCategory(BaseModel):
    category: str
    condition_count: int
    total_patients: int


class RefreshResult(BaseModel):
    status: str
    metrics_computed: int
    concept_id: int | None = None
