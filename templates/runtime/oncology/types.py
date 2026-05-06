"""Typed Pydantic models for ARTEMIS regimen patterns + matches."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class RegimenDrug(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    rxnorm_concept_id: int


class RegimenPattern(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    regimen_name: str
    indication: str
    phase: str
    drugs: list[RegimenDrug] = Field(min_length=1)


class RegimenMatch(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    regimen_name: str
    person_id: int
    episode_start_date: date
    episode_end_date: date
    drug_exposure_ids: list[int] = Field(default_factory=list)
    coverage: float = Field(ge=0.0, le=1.0)
