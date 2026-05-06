"""Plan 5 Tasks 5 + 12: episode/episode_event row builders + HIGHSEC PHI guard."""

from __future__ import annotations

from datetime import date

from runtime.oncology.cdm import (
    DRUG_EXPOSURE_FIELD,
    EHR_DERIVED_EPISODE,
    build_episode_event_rows,
    build_episode_row,
)
from runtime.oncology.types import RegimenMatch


def _match() -> RegimenMatch:
    return RegimenMatch(
        regimen_name="FOLFIRINOX",
        person_id=1,
        episode_start_date=date(2026, 4, 1),
        episode_end_date=date(2026, 6, 1),
        drug_exposure_ids=[101, 102, 103, 104],
        coverage=1.0,
    )


def test_episode_row_carries_canonical_name() -> None:
    row = build_episode_row(_match())
    assert row["episode_source_value"] == "FOLFIRINOX"
    assert row["person_id"] == 1
    assert row["episode_start_date"] == date(2026, 4, 1)
    assert row["episode_type_concept_id"] == EHR_DERIVED_EPISODE


def test_episode_event_rows_emit_one_per_drug_exposure() -> None:
    rows = build_episode_event_rows(_match(), episode_id=42)
    assert len(rows) == 4
    assert all(r["episode_id"] == 42 for r in rows)
    assert all(r["episode_event_field_concept_id"] == DRUG_EXPOSURE_FIELD for r in rows)
    assert {r["event_id"] for r in rows} == {101, 102, 103, 104}


# --- HIGHSEC PHI guard (Task 12) ----------------------------------------


def test_episode_source_value_never_contains_phi() -> None:
    """Per HIGHSEC §7: episode rows carry the canonical regimen name only.

    If a future change lets a free-text input flow into episode_source_value,
    this test catches it (regression guard for what would otherwise be a
    PHI leak into the source-value column).
    """
    row = build_episode_row(_match())
    sv = row["episode_source_value"]
    # Whitelist only canonical regimen name characters (A-Za-z, +, -, digits).
    assert all(
        c.isalnum() or c in "+-" for c in sv
    ), f"episode_source_value contains unexpected chars: {sv!r}"
    assert "Patient" not in sv
    assert "DOB" not in sv
