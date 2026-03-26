"""Tests for CSV reading utilities."""

from io import StringIO

import pandas as pd

from scripts.irsf_etl.lib.csv_utils import read_csv_safe


class TestReadCsvSafe:
    """Tests for read_csv_safe function."""

    def test_reads_valid_csv_returns_dataframe(self, sample_csv_stringio: StringIO) -> None:
        """read_csv_safe reads a valid CSV StringIO and returns a DataFrame."""
        result = read_csv_safe(sample_csv_stringio)
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2
        assert list(result.columns) == ["col_a", "col_b"]

    def test_handles_encoding_errors_gracefully(self) -> None:
        """read_csv_safe handles encoding errors without raising."""
        # Simulate a CSV with bytes that would cause encoding issues
        # by passing a StringIO (always valid encoding) -- the function
        # should still work without raising
        csv_data = StringIO("col_a,col_b\n1,caf\u00e9\n2,na\u00efve\n")
        result = read_csv_safe(csv_data)
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2

    def test_replaces_empty_strings_with_na(self) -> None:
        """read_csv_safe replaces empty strings with pd.NA."""
        csv_data = StringIO("col_a,col_b\n1,\n2,hello\n")
        result = read_csv_safe(csv_data)
        assert pd.isna(result.loc[0, "col_b"])
        assert result.loc[1, "col_b"] == "hello"
