"""Plan 5 Tasks 3-4: RegimenPattern types + RegimenMatcher core."""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from runtime.oncology.exceptions import ArtemisLibraryError
from runtime.oncology.matcher import RegimenMatcher, load_pattern_library
from runtime.oncology.types import RegimenDrug, RegimenMatch, RegimenPattern

# --- Library load -----------------------------------------------------------


def test_library_loads_5_regimens() -> None:
    patterns = load_pattern_library()
    names = {p.regimen_name for p in patterns}
    assert names == {"FOLFIRINOX", "FOLFOX", "R-CHOP", "AC-T", "Carboplatin+Paclitaxel"}


def test_library_rejects_unknown_version() -> None:
    with pytest.raises(ArtemisLibraryError):
        load_pattern_library(version="v9.9.9")


def test_folfirinox_has_4_drugs() -> None:
    patterns = load_pattern_library()
    folfirinox = next(p for p in patterns if p.regimen_name == "FOLFIRINOX")
    assert len(folfirinox.drugs) == 4


# --- Pattern model ----------------------------------------------------------


def test_pattern_rejects_empty_drugs() -> None:
    with pytest.raises(ValidationError):
        RegimenPattern(regimen_name="x", indication="x", phase="induction", drugs=[])


# --- Matcher ----------------------------------------------------------------


@pytest.fixture
def folfirinox() -> RegimenPattern:
    return RegimenPattern(
        regimen_name="FOLFIRINOX",
        indication="pancreatic cancer",
        phase="induction",
        drugs=[
            RegimenDrug(name="fluorouracil", rxnorm_concept_id=1153888),
            RegimenDrug(name="leucovorin", rxnorm_concept_id=1190795),
            RegimenDrug(name="irinotecan", rxnorm_concept_id=1736776),
            RegimenDrug(name="oxaliplatin", rxnorm_concept_id=1736816),
        ],
    )


def test_matcher_identifies_full_regimen(folfirinox: RegimenPattern) -> None:
    matcher = RegimenMatcher(patterns=[folfirinox])
    drug_exposures = [
        {
            "person_id": 1,
            "drug_concept_id": 1153888,
            "drug_exposure_start_date": date(2026, 4, 1),
            "drug_exposure_id": 100,
        },
        {
            "person_id": 1,
            "drug_concept_id": 1190795,
            "drug_exposure_start_date": date(2026, 4, 1),
            "drug_exposure_id": 101,
        },
        {
            "person_id": 1,
            "drug_concept_id": 1736776,
            "drug_exposure_start_date": date(2026, 4, 2),
            "drug_exposure_id": 102,
        },
        {
            "person_id": 1,
            "drug_concept_id": 1736816,
            "drug_exposure_start_date": date(2026, 4, 2),
            "drug_exposure_id": 103,
        },
    ]
    matches = matcher.match(drug_exposures)
    assert len(matches) == 1
    m: RegimenMatch = matches[0]
    assert m.regimen_name == "FOLFIRINOX"
    assert m.person_id == 1
    assert m.episode_start_date == date(2026, 4, 1)
    assert m.coverage == 1.0
    assert m.drug_exposure_ids == [100, 101, 102, 103]


def test_matcher_skips_below_threshold(folfirinox: RegimenPattern) -> None:
    """Only 2 of 4 FOLFIRINOX drugs administered → < 75% → no match."""
    matcher = RegimenMatcher(patterns=[folfirinox])
    drug_exposures = [
        {"person_id": 1, "drug_concept_id": 1153888, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1190795, "drug_exposure_start_date": date(2026, 4, 1)},
    ]
    assert matcher.match(drug_exposures) == []


def test_matcher_respects_temporal_window(folfirinox: RegimenPattern) -> None:
    """4 drugs but spread over 30 days → window violation → no match."""
    matcher = RegimenMatcher(patterns=[folfirinox], window_days=7)
    drug_exposures = [
        {"person_id": 1, "drug_concept_id": 1153888, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1190795, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1736776, "drug_exposure_start_date": date(2026, 4, 25)},
        {"person_id": 1, "drug_concept_id": 1736816, "drug_exposure_start_date": date(2026, 4, 25)},
    ]
    assert matcher.match(drug_exposures) == []


def test_matcher_handles_multi_person_input(folfirinox: RegimenPattern) -> None:
    matcher = RegimenMatcher(patterns=[folfirinox])
    drug_exposures = []
    for pid in (1, 2, 3):
        drug_exposures.extend(
            [
                {
                    "person_id": pid,
                    "drug_concept_id": 1153888,
                    "drug_exposure_start_date": date(2026, 4, 1),
                },
                {
                    "person_id": pid,
                    "drug_concept_id": 1190795,
                    "drug_exposure_start_date": date(2026, 4, 1),
                },
                {
                    "person_id": pid,
                    "drug_concept_id": 1736776,
                    "drug_exposure_start_date": date(2026, 4, 2),
                },
                {
                    "person_id": pid,
                    "drug_concept_id": 1736816,
                    "drug_exposure_start_date": date(2026, 4, 2),
                },
            ]
        )
    matches = matcher.match(drug_exposures)
    assert len(matches) == 3
    assert {m.person_id for m in matches} == {1, 2, 3}
