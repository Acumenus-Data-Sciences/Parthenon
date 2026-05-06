"""OMOP CDM v5.4 oncology-extension row builders for ARTEMIS regimen matches.

Builds episode + episode_event dict rows ready for INSERT into the
``${cdm_schema}.episode`` and ``${cdm_schema}.episode_event`` tables.
"""

from __future__ import annotations

from typing import Any

from runtime.oncology.types import RegimenMatch

# OMOP type concept ids
EHR_DERIVED_EPISODE = 32880
DRUG_EXPOSURE_FIELD = 1147127


def build_episode_row(match: RegimenMatch, *, regimen_concept_id: int = 0) -> dict[str, Any]:
    """Build one episode row from a RegimenMatch.

    ``regimen_concept_id`` is the OMOP concept_id for the regimen itself
    (HemOnc-curated; defaults to 0 if no concept exists yet — Phase 3
    follow-up to populate from the ARTEMIS ontology).
    """
    return {
        "person_id": match.person_id,
        "episode_concept_id": regimen_concept_id,
        "episode_start_date": match.episode_start_date,
        "episode_end_date": match.episode_end_date,
        "episode_object_concept_id": 0,
        "episode_type_concept_id": EHR_DERIVED_EPISODE,
        "episode_source_value": match.regimen_name,
        "episode_source_concept_id": 0,
    }


def build_episode_event_rows(
    match: RegimenMatch,
    episode_id: int,
) -> list[dict[str, Any]]:
    """Build one episode_event row per drug_exposure_id in the match."""
    return [
        {
            "episode_id": episode_id,
            "event_id": de_id,
            "episode_event_field_concept_id": DRUG_EXPOSURE_FIELD,
        }
        for de_id in match.drug_exposure_ids
    ]
