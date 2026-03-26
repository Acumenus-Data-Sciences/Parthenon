"""Tests for VisitResolver module."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pandas as pd
import pytest

from scripts.irsf_etl.lib.visit_resolver import VisitResolver


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _sample_df() -> pd.DataFrame:
    """Build a sample visit_id_map DataFrame for testing."""
    return pd.DataFrame(
        {
            "visit_occurrence_id": [1, 2, 3, 4, 5],
            "person_id": [100, 100, 100, 200, 200],
            "visit_date": [
                "2020-01-15",
                "2020-01-15",
                "2020-03-10",
                "2020-02-20",
                "2020-06-01",
            ],
            "visit_label": [
                "Screening",
                "Hospital",
                "Visit 1",
                "Screening",
                "Visit 2",
            ],
            "visit_concept_id": [9202, 9201, 9202, 9202, 9202],
        }
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestFromDataframe:
    def test_from_dataframe_basic(self) -> None:
        """Build resolver from sample DataFrame, verify count."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        assert resolver.count == 5
        assert len(resolver) == 5
        assert 100 in resolver.person_ids
        assert 200 in resolver.person_ids

    def test_immutability(self) -> None:
        """VisitResolver is frozen, cannot be mutated."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        with pytest.raises(AttributeError):
            resolver._visit_count = 999  # type: ignore[misc]


class TestResolveExact:
    def test_resolve_exact_match(self) -> None:
        """(person_id, date, label) returns correct visit_occurrence_id."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        assert resolver.resolve(100, "2020-01-15", "Screening") == 1
        assert resolver.resolve(100, "2020-01-15", "Hospital") == 2
        assert resolver.resolve(100, "2020-03-10", "Visit 1") == 3
        assert resolver.resolve(200, "2020-02-20", "Screening") == 4

    def test_resolve_not_found(self) -> None:
        """Unknown person_id returns None."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        assert resolver.resolve(999, "2020-01-15", "Screening") is None

    def test_resolve_wrong_label(self) -> None:
        """Known person_id+date but wrong label falls through to date match."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        # Person 100 on 2020-01-15 has two visits: Screening (9202) and Hospital (9201)
        # Wrong label -> no exact match, falls to date-only which prefers outpatient
        result = resolver.resolve(100, "2020-01-15", "NonExistent")
        assert result == 1  # Screening (outpatient 9202) preferred


class TestResolveDateFallback:
    def test_resolve_date_only_fallback(self) -> None:
        """(person_id, date) without label returns visit via date match."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        # No label -> date-only fallback
        result = resolver.resolve(100, "2020-03-10")
        assert result == 3  # Only visit on that date

    def test_date_match_prefers_outpatient(self) -> None:
        """Same person, same date: outpatient (9202) preferred over inpatient (9201)."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        # Person 100 on 2020-01-15 has: visit 1 (9202 Screening), visit 2 (9201 Hospital)
        result = resolver.resolve(100, "2020-01-15")
        assert result == 1  # Outpatient preferred


class TestResolveNearest:
    def test_resolve_nearest_within_window(self) -> None:
        """Date off by 2 days still resolves with max_days=7."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        # Person 200 has visits on 2020-02-20 and 2020-06-01
        # Query 2020-02-22 is 2 days off from 2020-02-20
        result = resolver.resolve_or_nearest(200, "2020-02-22", max_days=7)
        assert result == 4  # Visit on 2020-02-20

    def test_resolve_nearest_outside_window(self) -> None:
        """Date off by 10 days returns None with max_days=7."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        # Person 200 has visits on 2020-02-20 and 2020-06-01
        # Query 2020-03-05 is 14 days off from 2020-02-20
        result = resolver.resolve_or_nearest(200, "2020-03-05", max_days=7)
        assert result is None

    def test_resolve_nearest_exact_takes_priority(self) -> None:
        """resolve_or_nearest returns exact match before nearest search."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        result = resolver.resolve_or_nearest(200, "2020-02-20", "Screening")
        assert result == 4


class TestResolveSeries:
    def test_resolve_series(self) -> None:
        """Vectorized resolution across DataFrame."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        person_ids = pd.Series([100, 200, 999])
        visit_dates = pd.Series(["2020-03-10", "2020-02-20", "2020-01-01"])
        visit_labels = pd.Series(["Visit 1", "Screening", "X"])

        results = resolver.resolve_series(person_ids, visit_dates, visit_labels)

        assert results[0] == 3
        assert results[1] == 4
        assert pd.isna(results[2])

    def test_resolve_series_no_labels(self) -> None:
        """resolve_series works without labels (date-only fallback)."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        person_ids = pd.Series([100, 200])
        visit_dates = pd.Series(["2020-03-10", "2020-06-01"])

        results = resolver.resolve_series(person_ids, visit_dates)

        assert results[0] == 3
        assert results[1] == 5

    def test_resolve_series_with_na(self) -> None:
        """resolve_series handles NA inputs gracefully."""
        resolver = VisitResolver.from_dataframe(_sample_df())
        person_ids = pd.Series([100, pd.NA], dtype=pd.Int64Dtype())
        visit_dates = pd.Series(["2020-03-10", "2020-01-01"])

        results = resolver.resolve_series(person_ids, visit_dates)

        assert results[0] == 3
        assert pd.isna(results[1])


class TestFromCsvRoundtrip:
    def test_from_csv_roundtrip(self) -> None:
        """Write visit_id_map to temp file, load via from_csv, verify resolution."""
        df = _sample_df()
        with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
            df.to_csv(f, index=False)
            tmp_path = Path(f.name)

        resolver = VisitResolver.from_csv(tmp_path)
        assert resolver.count == 5
        assert resolver.resolve(100, "2020-01-15", "Screening") == 1
        assert resolver.resolve(200, "2020-06-01", "Visit 2") == 5

        # Clean up
        tmp_path.unlink(missing_ok=True)
