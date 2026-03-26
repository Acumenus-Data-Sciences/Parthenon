"""Tests for profile_sources module."""

from __future__ import annotations

import json
import os
import tempfile
from io import StringIO
from pathlib import Path

import pandas as pd
import pytest

from scripts.irsf_etl.profile_sources import (
    detect_date_format,
    profile_all,
    profile_one_csv,
    write_report,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def basic_csv_path(tmp_path: Path) -> Path:
    """Create a basic CSV file for profiling."""
    csv_content = (
        "id,name,status,date_col\n"
        "1,Alice,Active,01/15/2020\n"
        "2,Bob,Active,02/20/2021\n"
        "3,,Inactive,03/10/2022\n"
        "4,Diana,,04/25/2023\n"
    )
    p = tmp_path / "basic.csv"
    p.write_text(csv_content)
    return p


@pytest.fixture()
def csv_with_empty_strings(tmp_path: Path) -> Path:
    """CSV where some cells are empty strings (not null/NA).

    In pandas 3.x, bare empty cells (,,) are read as NaN by default.
    To test empty-string detection, we use keep_default_na=False in the profiler
    which preserves empty cells as "" instead of converting to NaN.
    Then: null_rates counts NaN (from explicit 'NA'/'NaN' markers) and
    empty_string_rates counts "" (from bare empty cells).
    """
    # Row 2: name is empty, notes is empty
    # Row 3: notes is empty
    csv_content = "id,name,notes\n1,Alice,Good\n2,,\n3,Charlie,\n"
    p = tmp_path / "empties.csv"
    p.write_text(csv_content)
    return p


@pytest.fixture()
def csv_with_dates_mmddyy(tmp_path: Path) -> Path:
    """CSV with MM/DD/YY date format."""
    csv_content = "id,visit_date\n1,01/15/20\n2,02/20/21\n3,03/10/22\n"
    p = tmp_path / "dates_mmddyy.csv"
    p.write_text(csv_content)
    return p


@pytest.fixture()
def csv_with_dates_mmddyyyy(tmp_path: Path) -> Path:
    """CSV with MM/DD/YYYY date format."""
    csv_content = "id,visit_date\n1,01/15/2020\n2,02/20/2021\n3,03/10/2022\n"
    p = tmp_path / "dates_mmddyyyy.csv"
    p.write_text(csv_content)
    return p


@pytest.fixture()
def csv_high_cardinality(tmp_path: Path) -> Path:
    """CSV with a column having > 30 unique values."""
    rows = ["id,code"] + [f"{i},CODE_{i}" for i in range(50)]
    p = tmp_path / "high_card.csv"
    p.write_text("\n".join(rows) + "\n")
    return p


@pytest.fixture()
def csv_low_cardinality(tmp_path: Path) -> Path:
    """CSV with a column having < 30 unique values."""
    rows = ["id,status"] + [f"{i},{['Active', 'Inactive', 'Pending'][i % 3]}" for i in range(30)]
    p = tmp_path / "low_card.csv"
    p.write_text("\n".join(rows) + "\n")
    return p


@pytest.fixture()
def bad_csv_path(tmp_path: Path) -> Path:
    """A path that doesn't exist, causing a FileNotFoundError."""
    return tmp_path / "nonexistent" / "bad.csv"


# ---------------------------------------------------------------------------
# Tests: profile_one_csv structure
# ---------------------------------------------------------------------------

class TestProfileOneCsv:
    """Tests for the profile_one_csv function."""

    def test_returns_required_keys(self, basic_csv_path: Path) -> None:
        """profile_one_csv returns dict with all required keys."""
        result = profile_one_csv(basic_csv_path)
        required_keys = {
            "file",
            "rows",
            "columns",
            "column_names",
            "null_rates",
            "empty_string_rates",
            "date_columns_detected",
            "low_cardinality_distributions",
        }
        assert required_keys.issubset(result.keys()), (
            f"Missing keys: {required_keys - result.keys()}"
        )

    def test_correct_row_and_column_counts(self, basic_csv_path: Path) -> None:
        """profile_one_csv correctly counts rows and columns."""
        result = profile_one_csv(basic_csv_path)
        assert result["rows"] == 4
        assert result["columns"] == 4

    def test_column_names_listed(self, basic_csv_path: Path) -> None:
        """profile_one_csv lists column names."""
        result = profile_one_csv(basic_csv_path)
        assert result["column_names"] == ["id", "name", "status", "date_col"]


class TestDateDetection:
    """Tests for date format detection."""

    def test_detects_mmddyy(self, csv_with_dates_mmddyy: Path) -> None:
        """profile_one_csv detects MM/DD/YY date format."""
        result = profile_one_csv(csv_with_dates_mmddyy)
        assert "visit_date" in result["date_columns_detected"]
        assert result["date_columns_detected"]["visit_date"] == "MM/DD/YY"

    def test_detects_mmddyyyy(self, csv_with_dates_mmddyyyy: Path) -> None:
        """profile_one_csv detects MM/DD/YYYY date format."""
        result = profile_one_csv(csv_with_dates_mmddyyyy)
        assert "visit_date" in result["date_columns_detected"]
        assert result["date_columns_detected"]["visit_date"] == "MM/DD/YYYY"

    def test_non_date_column_returns_none(self) -> None:
        """detect_date_format returns None for non-date string columns."""
        series = pd.Series(["hello", "world", "foo", "bar"])
        assert detect_date_format(series) is None

    def test_numeric_column_returns_none(self) -> None:
        """detect_date_format returns None for numeric data."""
        series = pd.Series([1, 2, 3, 4])
        assert detect_date_format(series) is None


class TestEmptyStringVsNull:
    """Tests for distinguishing empty strings from nulls."""

    def test_empty_strings_counted_separately(self, csv_with_empty_strings: Path) -> None:
        """profile_one_csv reports empty_string_rates separately from null_rates."""
        result = profile_one_csv(csv_with_empty_strings)

        # 'name' column: row 2 has empty string -> 1/3 empty string rate
        assert result["empty_string_rates"]["name"] > 0

        # 'notes' column: rows 2 and 3 have empty strings -> 2/3 empty string rate
        assert result["empty_string_rates"]["notes"] > 0

        # null_rates for 'id' should be 0 (no nulls, no empties)
        assert result["null_rates"]["id"] == 0.0


class TestCardinalityDistributions:
    """Tests for low/high cardinality value distributions."""

    def test_low_cardinality_included(self, csv_low_cardinality: Path) -> None:
        """profile_one_csv includes value distribution for columns with < 30 unique values."""
        result = profile_one_csv(csv_low_cardinality)
        assert "status" in result["low_cardinality_distributions"]
        dist = result["low_cardinality_distributions"]["status"]
        assert "Active" in dist
        assert "Inactive" in dist
        assert "Pending" in dist

    def test_high_cardinality_excluded(self, csv_high_cardinality: Path) -> None:
        """profile_one_csv does NOT include value distribution for high-cardinality columns."""
        result = profile_one_csv(csv_high_cardinality)
        assert "code" not in result["low_cardinality_distributions"]


class TestErrorHandling:
    """Tests for error handling on bad CSV files."""

    def test_bad_csv_returns_error_dict(self, bad_csv_path: Path) -> None:
        """profile_one_csv handles a CSV that fails to parse (returns error dict)."""
        result = profile_one_csv(bad_csv_path)
        assert "error" in result
        assert "file" in result
        assert result["file"] == "bad.csv"
        assert "directory" in result


# ---------------------------------------------------------------------------
# Tests: profile_all
# ---------------------------------------------------------------------------

class TestProfileAll:
    """Tests for the profile_all function."""

    def test_profiles_multiple_csvs_with_source_group(self, tmp_path: Path) -> None:
        """profile_all with a temp directory containing 2 CSVs returns profiles with source_group tags."""
        # Create a fake source root with a "5201/csv" subdirectory (matching real structure)
        source_root = tmp_path / "source"
        dir_5201_csv = source_root / "5201" / "csv"
        dir_5201_csv.mkdir(parents=True)

        (dir_5201_csv / "file_a.csv").write_text("id,val\n1,a\n2,b\n")
        (dir_5201_csv / "file_b.csv").write_text("id,val\n3,c\n4,d\n")

        # Use a mock config that points to our temp dirs
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(
            source_root=source_root,
            output_dir=tmp_path / "output",
        )

        profiles = profile_all(config)

        assert len(profiles) == 2
        for p in profiles:
            assert "source_group" in p
            assert p["source_group"] == "5201"


# ---------------------------------------------------------------------------
# Tests: write_report
# ---------------------------------------------------------------------------

class TestWriteReport:
    """Tests for the write_report function."""

    def test_writes_json_report(self, tmp_path: Path) -> None:
        """write_report creates a JSON file with the profiles."""
        profiles = [
            {"file": "test.csv", "rows": 10, "columns": 3},
        ]
        output_dir = tmp_path / "output" / "profiles"
        write_report(profiles, output_dir)

        report_path = output_dir / "profile_report.json"
        assert report_path.exists()

        loaded = json.loads(report_path.read_text())
        assert len(loaded) == 1
        assert loaded[0]["file"] == "test.csv"
