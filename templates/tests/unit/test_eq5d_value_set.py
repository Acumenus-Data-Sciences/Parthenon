"""EQ-5D placeholder value-set + lookup helper."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.instruments.value_sets.eq5d import (
    Eq5dValueSetError,
    load_value_set,
    lookup_utility,
)

PLACEHOLDER = (
    Path(__file__).resolve().parents[2]
    / "runtime"
    / "instruments"
    / "value_sets"
    / "eq5d5l_placeholder.csv"
)


def test_placeholder_csv_exists_and_is_clearly_marked() -> None:
    text = PLACEHOLDER.read_text(encoding="utf-8")
    assert "PLACEHOLDER" in text.upper()
    assert "EUROQOL" in text.upper()
    assert "REPLACE" in text.upper()


def test_placeholder_has_at_least_one_row() -> None:
    table = load_value_set(PLACEHOLDER)
    assert len(table) >= 1


def test_lookup_returns_utility_for_valid_profile() -> None:
    table = load_value_set(PLACEHOLDER)
    util = lookup_utility("11111", table)
    assert isinstance(util, float)


def test_lookup_unknown_profile_raises() -> None:
    table = load_value_set(PLACEHOLDER)
    with pytest.raises(Eq5dValueSetError, match="profile"):
        lookup_utility("99999", table)


def test_lookup_invalid_profile_format_raises() -> None:
    table = load_value_set(PLACEHOLDER)
    with pytest.raises(Eq5dValueSetError, match="profile"):
        lookup_utility("not-a-profile", table)


def test_load_value_set_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(Eq5dValueSetError, match="not found"):
        load_value_set(tmp_path / "missing.csv")


def test_load_value_set_rejects_malformed_csv(tmp_path: Path) -> None:
    bad = tmp_path / "bad.csv"
    bad.write_text("no,header,we,recognize\n1,2,3,4\n", encoding="utf-8")
    with pytest.raises(Eq5dValueSetError):
        load_value_set(bad)
