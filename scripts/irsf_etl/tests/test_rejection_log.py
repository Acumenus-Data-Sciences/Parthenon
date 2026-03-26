"""Tests for RejectionLog error accumulation and reporting."""

from __future__ import annotations

import csv
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from scripts.irsf_etl.lib.rejection_log import (
    RejectionCategory,
    RejectionEntry,
    RejectionLog,
    RejectionSummary,
)


# ── RejectionCategory enum ──────────────────────────────────────────


class TestRejectionCategory:
    """Tests for RejectionCategory enum values and severity mapping."""

    def test_all_category_values_exist(self) -> None:
        expected = {
            "UNMAPPED_CONCEPT",
            "DEPRECATED_REMAPPED",
            "DEPRECATED_NO_REPLACEMENT",
            "INVALID_VALUE",
            "MISSING_REQUIRED",
            "DATE_ASSEMBLY_FAILED",
            "DUPLICATE_RECORD",
            "CUSTOM",
        }
        actual = {c.name for c in RejectionCategory}
        assert actual == expected

    def test_category_string_values(self) -> None:
        assert RejectionCategory.UNMAPPED_CONCEPT.value == "unmapped_concept"
        assert RejectionCategory.DEPRECATED_REMAPPED.value == "deprecated_remapped"
        assert RejectionCategory.DEPRECATED_NO_REPLACEMENT.value == "deprecated_no_replacement"
        assert RejectionCategory.INVALID_VALUE.value == "invalid_value"
        assert RejectionCategory.MISSING_REQUIRED.value == "missing_required"
        assert RejectionCategory.DATE_ASSEMBLY_FAILED.value == "date_assembly_failed"
        assert RejectionCategory.DUPLICATE_RECORD.value == "duplicate_record"
        assert RejectionCategory.CUSTOM.value == "custom"

    def test_severity_info(self) -> None:
        assert RejectionCategory.DEPRECATED_REMAPPED.severity == "info"

    def test_severity_warning(self) -> None:
        assert RejectionCategory.UNMAPPED_CONCEPT.severity == "warning"
        assert RejectionCategory.DEPRECATED_NO_REPLACEMENT.severity == "warning"
        assert RejectionCategory.DUPLICATE_RECORD.severity == "warning"

    def test_severity_error(self) -> None:
        assert RejectionCategory.INVALID_VALUE.severity == "error"
        assert RejectionCategory.MISSING_REQUIRED.severity == "error"
        assert RejectionCategory.DATE_ASSEMBLY_FAILED.severity == "error"

    def test_custom_severity_is_warning(self) -> None:
        assert RejectionCategory.CUSTOM.severity == "warning"


# ── RejectionEntry frozen dataclass ─────────────────────────────────


class TestRejectionEntry:
    """Tests for RejectionEntry immutability and fields."""

    def test_fields_present(self) -> None:
        entry = RejectionEntry(
            record_index=0,
            column="col_a",
            value="bad_val",
            category=RejectionCategory.INVALID_VALUE,
            message="invalid format",
            timestamp="2026-03-26T00:00:00+00:00",
        )
        assert entry.record_index == 0
        assert entry.column == "col_a"
        assert entry.value == "bad_val"
        assert entry.category == RejectionCategory.INVALID_VALUE
        assert entry.message == "invalid format"
        assert entry.timestamp == "2026-03-26T00:00:00+00:00"

    def test_frozen_enforcement(self) -> None:
        entry = RejectionEntry(
            record_index=0,
            column="x",
            value="y",
            category=RejectionCategory.INVALID_VALUE,
            message="test",
            timestamp="2026-03-26T00:00:00+00:00",
        )
        with pytest.raises(FrozenInstanceError):
            entry.message = "changed"  # type: ignore[misc]


# ── RejectionSummary frozen dataclass ────────────────────────────────


class TestRejectionSummary:
    """Tests for RejectionSummary immutability."""

    def test_frozen_enforcement(self) -> None:
        summary = RejectionSummary(
            table_name="test",
            total_processed=100,
            total_rejected=5,
            total_warnings=3,
            total_info=1,
            counts_by_category={},
            rejection_rate=0.05,
            sample_entries={},
        )
        with pytest.raises(FrozenInstanceError):
            summary.total_processed = 999  # type: ignore[misc]


# ── RejectionLog core behavior ──────────────────────────────────────


class TestRejectionLogCore:
    """Tests for RejectionLog accumulation and properties."""

    def test_creates_log_for_table(self) -> None:
        log = RejectionLog("person")
        assert log.table_name == "person"

    def test_log_adds_entry_without_raising(self) -> None:
        log = RejectionLog("person")
        # This must NOT raise
        log.log(0, "gender_source_value", "X", RejectionCategory.INVALID_VALUE, "invalid gender")
        assert len(log.entries) == 1

    def test_accumulates_100_entries(self) -> None:
        log = RejectionLog("person")
        for i in range(100):
            log.log(i, "col", f"val_{i}", RejectionCategory.INVALID_VALUE, "test error")
        assert len(log.entries) == 100

    def test_entries_returns_tuple(self) -> None:
        log = RejectionLog("person")
        log.log(0, "col", "val", RejectionCategory.INVALID_VALUE, "msg")
        entries = log.entries
        assert isinstance(entries, tuple)

    def test_empty_log_has_zero_counts(self) -> None:
        log = RejectionLog("empty_table")
        assert len(log.entries) == 0
        assert log.error_count == 0
        assert log.warning_count == 0
        assert not log.has_errors
        assert not log.has_warnings

    def test_has_errors_true_when_error_severity(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        assert log.has_errors is True

    def test_has_errors_false_with_only_warnings(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn")
        assert log.has_errors is False

    def test_has_warnings_true(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn")
        assert log.has_warnings is True

    def test_has_warnings_false_with_only_errors(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        assert log.has_warnings is False

    def test_error_count(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "e1")
        log.log(1, "c", "v", RejectionCategory.MISSING_REQUIRED, "e2")
        log.log(2, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "w1")
        assert log.error_count == 2

    def test_warning_count(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "w1")
        log.log(1, "c", "v", RejectionCategory.DUPLICATE_RECORD, "w2")
        log.log(2, "c", "v", RejectionCategory.INVALID_VALUE, "e1")
        assert log.warning_count == 2

    def test_log_stringifies_non_string_value(self) -> None:
        log = RejectionLog("t")
        log.log(0, "age", 999, RejectionCategory.INVALID_VALUE, "out of range")
        assert log.entries[0].value == "999"

    def test_log_stringifies_none_value(self) -> None:
        log = RejectionLog("t")
        log.log(0, "col", None, RejectionCategory.MISSING_REQUIRED, "missing")
        assert log.entries[0].value == "None"


# ── RejectionLog summary ────────────────────────────────────────────


class TestRejectionLogSummary:
    """Tests for RejectionLog.summary() output."""

    def test_summary_returns_rejection_summary(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.set_processed_count(100)
        s = log.summary()
        assert isinstance(s, RejectionSummary)

    def test_summary_counts_by_category(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.log(1, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.log(2, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn")
        s = log.summary()
        assert s.counts_by_category["invalid_value"] == 2
        assert s.counts_by_category["unmapped_concept"] == 1

    def test_summary_total_processed_and_rejected(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.log(1, "c", "v", RejectionCategory.MISSING_REQUIRED, "err")
        log.log(2, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn")
        log.set_processed_count(500)
        s = log.summary()
        assert s.total_processed == 500
        assert s.total_rejected == 2  # only error-severity
        assert s.total_warnings == 1
        assert s.total_info == 0

    def test_summary_rejection_rate(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.set_processed_count(200)
        s = log.summary()
        assert s.rejection_rate == pytest.approx(0.005)

    def test_summary_rejection_rate_zero_when_no_processed(self) -> None:
        log = RejectionLog("person")
        s = log.summary()
        assert s.rejection_rate == 0.0

    def test_empty_summary(self) -> None:
        log = RejectionLog("empty")
        s = log.summary()
        assert s.total_processed == 0
        assert s.total_rejected == 0
        assert s.total_warnings == 0
        assert s.total_info == 0
        assert s.counts_by_category == {}
        assert s.rejection_rate == 0.0


# ── RejectionLog filtering ──────────────────────────────────────────


class TestRejectionLogFiltering:
    """Tests for filter_by_category and sample_entries."""

    def test_filter_by_category(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.log(1, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn")
        log.log(2, "c", "v", RejectionCategory.INVALID_VALUE, "err2")
        filtered = log.filter_by_category(RejectionCategory.INVALID_VALUE)
        assert len(filtered) == 2
        assert all(e.category == RejectionCategory.INVALID_VALUE for e in filtered)

    def test_filter_by_category_returns_tuple(self) -> None:
        log = RejectionLog("t")
        filtered = log.filter_by_category(RejectionCategory.INVALID_VALUE)
        assert isinstance(filtered, tuple)

    def test_sample_entries_limits_to_n(self) -> None:
        log = RejectionLog("t")
        for i in range(25):
            log.log(i, "c", "v", RejectionCategory.INVALID_VALUE, f"err_{i}")
        samples = log.sample_entries(RejectionCategory.INVALID_VALUE, n=10)
        assert len(samples) == 10

    def test_sample_entries_returns_all_when_fewer_than_n(self) -> None:
        log = RejectionLog("t")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.log(1, "c", "v", RejectionCategory.INVALID_VALUE, "err2")
        samples = log.sample_entries(RejectionCategory.INVALID_VALUE, n=10)
        assert len(samples) == 2

    def test_sample_entries_returns_tuple(self) -> None:
        log = RejectionLog("t")
        samples = log.sample_entries(RejectionCategory.INVALID_VALUE)
        assert isinstance(samples, tuple)


# ── RejectionLog CSV export ──────────────────────────────────────────


class TestRejectionLogCsv:
    """Tests for RejectionLog.to_csv()."""

    def test_to_csv_writes_file(self, tmp_path: Path) -> None:
        log = RejectionLog("person")
        log.log(0, "gender", "X", RejectionCategory.INVALID_VALUE, "invalid gender")
        csv_path = tmp_path / "rejections.csv"
        log.to_csv(csv_path)
        assert csv_path.exists()

    def test_to_csv_has_headers(self, tmp_path: Path) -> None:
        log = RejectionLog("person")
        log.log(0, "gender", "X", RejectionCategory.INVALID_VALUE, "invalid gender")
        csv_path = tmp_path / "rejections.csv"
        log.to_csv(csv_path)
        with open(csv_path) as f:
            reader = csv.reader(f)
            headers = next(reader)
        assert "record_index" in headers
        assert "column" in headers
        assert "value" in headers
        assert "category" in headers
        assert "message" in headers
        assert "timestamp" in headers

    def test_to_csv_parseable_by_csv_reader(self, tmp_path: Path) -> None:
        log = RejectionLog("person")
        log.log(0, "name", 'O"Brien', RejectionCategory.INVALID_VALUE, "quote in value")
        log.log(1, "addr", "line1\nline2", RejectionCategory.INVALID_VALUE, "newline in value")
        log.log(2, "note", "a,b,c", RejectionCategory.INVALID_VALUE, "commas in value")
        csv_path = tmp_path / "rejections.csv"
        log.to_csv(csv_path)
        with open(csv_path, newline="") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 3

    def test_to_csv_empty_log(self, tmp_path: Path) -> None:
        log = RejectionLog("empty")
        csv_path = tmp_path / "rejections.csv"
        log.to_csv(csv_path)
        with open(csv_path) as f:
            reader = csv.reader(f)
            headers = next(reader)
            rows = list(reader)
        assert len(headers) > 0
        assert len(rows) == 0


# ── RejectionLog to_dict ─────────────────────────────────────────────


class TestRejectionLogToDict:
    """Tests for RejectionLog.to_dict() JSON serialization."""

    def test_to_dict_returns_dict(self) -> None:
        log = RejectionLog("person")
        result = log.to_dict()
        assert isinstance(result, dict)

    def test_to_dict_json_serializable(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.set_processed_count(100)
        result = log.to_dict()
        # Must not raise
        serialized = json.dumps(result)
        assert isinstance(serialized, str)

    def test_to_dict_contains_table_name(self) -> None:
        log = RejectionLog("person")
        result = log.to_dict()
        assert result["table_name"] == "person"

    def test_to_dict_contains_counts(self) -> None:
        log = RejectionLog("person")
        log.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err")
        log.set_processed_count(50)
        result = log.to_dict()
        assert "total_processed" in result
        assert "total_rejected" in result
        assert "counts_by_category" in result


# ── RejectionLog merge ───────────────────────────────────────────────


class TestRejectionLogMerge:
    """Tests for RejectionLog.merge()."""

    def test_merge_combines_entries(self) -> None:
        log1 = RejectionLog("person")
        log1.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err1")
        log2 = RejectionLog("visit")
        log2.log(0, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn1")
        merged = log1.merge(log2)
        assert len(merged.entries) == 2

    def test_merge_preserves_table_name(self) -> None:
        log1 = RejectionLog("person")
        log2 = RejectionLog("visit")
        merged = log1.merge(log2)
        assert merged.table_name == "person+visit"

    def test_merge_returns_new_instance(self) -> None:
        log1 = RejectionLog("person")
        log2 = RejectionLog("visit")
        merged = log1.merge(log2)
        assert merged is not log1
        assert merged is not log2

    def test_merge_does_not_mutate_originals(self) -> None:
        log1 = RejectionLog("person")
        log1.log(0, "c", "v", RejectionCategory.INVALID_VALUE, "err1")
        log2 = RejectionLog("visit")
        log2.log(0, "c", "v", RejectionCategory.UNMAPPED_CONCEPT, "warn1")
        log1.merge(log2)
        assert len(log1.entries) == 1
        assert len(log2.entries) == 1

    def test_merge_processed_count_sums(self) -> None:
        log1 = RejectionLog("person")
        log1.set_processed_count(100)
        log2 = RejectionLog("visit")
        log2.set_processed_count(200)
        merged = log1.merge(log2)
        s = merged.summary()
        assert s.total_processed == 300
