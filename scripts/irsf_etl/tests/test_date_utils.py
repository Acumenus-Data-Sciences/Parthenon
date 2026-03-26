"""Tests for date utility functions."""

from scripts.irsf_etl.lib.date_utils import detect_split_date_columns


class TestDetectSplitDateColumns:
    """Tests for detect_split_date_columns function."""

    def test_finds_known_split_date_groups(self, split_date_columns: list[str]) -> None:
        """detect_split_date_columns finds known split-date column groups."""
        result = detect_split_date_columns(split_date_columns)
        assert isinstance(result, dict)
        assert len(result) >= 2
        # Should detect ChildsDOB and DiagnosisDate groups
        assert "ChildsDOB" in result
        assert "DiagnosisDate" in result
        # Each group should have month, day, year columns
        for label, cols in result.items():
            assert "month" in cols
            assert "day" in cols
            assert "year" in cols

    def test_returns_empty_for_no_date_patterns(self, no_date_columns: list[str]) -> None:
        """detect_split_date_columns returns empty dict for non-date columns."""
        result = detect_split_date_columns(no_date_columns)
        assert isinstance(result, dict)
        assert len(result) == 0
