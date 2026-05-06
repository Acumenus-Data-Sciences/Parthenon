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
    """v0.1.0 hand-curated subset must continue to work after Plan 7 default switch."""
    patterns = load_pattern_library(version="v0.1.0")
    names = {p.regimen_name for p in patterns}
    assert names == {"FOLFIRINOX", "FOLFOX", "R-CHOP", "AC-T", "Carboplatin+Paclitaxel"}


def test_library_rejects_unknown_version() -> None:
    with pytest.raises(ArtemisLibraryError):
        load_pattern_library(version="v9.9.9")


def test_folfirinox_has_4_drugs() -> None:
    patterns = load_pattern_library(version="v0.1.0")
    folfirinox = next(p for p in patterns if p.regimen_name == "FOLFIRINOX")
    assert len(folfirinox.drugs) == 4


def test_default_version_is_v0_2_0() -> None:
    """Phase 3 Plan 7 Task 15 — default bumped to v0.2.0 (full library)."""
    import inspect

    from runtime.oncology import matcher

    sig = inspect.signature(matcher.load_pattern_library)
    assert sig.parameters["version"].default == "v0.2.0"


def test_default_loader_falls_back_to_v0_1_0_when_v0_2_0_absent() -> None:
    """On a dev runner without the Docker build, v0.2.0/patterns.json is
    absent. The loader must fall back to v0.1.0 so the unit suite stays
    runnable without R installed."""
    patterns = load_pattern_library()
    # The fallback yields the v0.1.0 subset — at minimum, FOLFIRINOX is present.
    names = {p.regimen_name for p in patterns}
    assert "FOLFIRINOX" in names


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
