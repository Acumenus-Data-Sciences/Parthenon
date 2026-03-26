"""Error accumulation logger for ETL rejection tracking.

Accumulates rejected/skipped records per table without raising exceptions
(not fail-fast). Produces rejection summary reports, CSV exports, and
supports cross-table merging.
"""

from __future__ import annotations

import csv
import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class RejectionCategory(enum.Enum):
    """Categories for rejected ETL records with severity mapping."""

    UNMAPPED_CONCEPT = "unmapped_concept"
    DEPRECATED_REMAPPED = "deprecated_remapped"
    DEPRECATED_NO_REPLACEMENT = "deprecated_no_replacement"
    INVALID_VALUE = "invalid_value"
    MISSING_REQUIRED = "missing_required"
    DATE_ASSEMBLY_FAILED = "date_assembly_failed"
    DUPLICATE_RECORD = "duplicate_record"
    CUSTOM = "custom"

    @property
    def severity(self) -> str:
        """Return severity level: 'info', 'warning', or 'error'."""
        severity_map: dict[RejectionCategory, str] = {
            RejectionCategory.DEPRECATED_REMAPPED: "info",
            RejectionCategory.UNMAPPED_CONCEPT: "warning",
            RejectionCategory.DEPRECATED_NO_REPLACEMENT: "warning",
            RejectionCategory.DUPLICATE_RECORD: "warning",
            RejectionCategory.CUSTOM: "warning",
            RejectionCategory.INVALID_VALUE: "error",
            RejectionCategory.MISSING_REQUIRED: "error",
            RejectionCategory.DATE_ASSEMBLY_FAILED: "error",
        }
        return severity_map[self]


@dataclass(frozen=True)
class RejectionEntry:
    """A single rejected record entry. Immutable."""

    record_index: int
    column: str
    value: str
    category: RejectionCategory
    message: str
    timestamp: str


@dataclass(frozen=True)
class RejectionSummary:
    """Summary of rejections for a table. Immutable."""

    table_name: str
    total_processed: int
    total_rejected: int
    total_warnings: int
    total_info: int
    counts_by_category: dict[str, int]
    rejection_rate: float
    sample_entries: dict[str, list[dict[str, Any]]]


class RejectionLog:
    """Accumulates rejected/skipped records for an ETL table.

    Core design: log() NEVER raises an exception. Bad records are
    accumulated and reported at the end via summary(), to_csv(), or to_dict().
    """

    def __init__(self, table_name: str) -> None:
        self._table_name = table_name
        self._entries: list[RejectionEntry] = []
        self._processed_count: int = 0

    @property
    def table_name(self) -> str:
        """Return the table name this log is tracking."""
        return self._table_name

    @property
    def entries(self) -> tuple[RejectionEntry, ...]:
        """Return an immutable copy of all logged entries."""
        return tuple(self._entries)

    @property
    def has_errors(self) -> bool:
        """Return True if any entry has error severity."""
        return any(e.category.severity == "error" for e in self._entries)

    @property
    def has_warnings(self) -> bool:
        """Return True if any entry has warning severity."""
        return any(e.category.severity == "warning" for e in self._entries)

    @property
    def error_count(self) -> int:
        """Return count of error-severity entries."""
        return sum(1 for e in self._entries if e.category.severity == "error")

    @property
    def warning_count(self) -> int:
        """Return count of warning-severity entries."""
        return sum(1 for e in self._entries if e.category.severity == "warning")

    def log(
        self,
        record_index: int,
        column: str,
        value: Any,
        category: RejectionCategory,
        message: str,
    ) -> None:
        """Accumulate a rejection entry. Never raises."""
        entry = RejectionEntry(
            record_index=record_index,
            column=column,
            value=str(value),
            category=category,
            message=message,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self._entries.append(entry)

    def set_processed_count(self, count: int) -> None:
        """Set the total number of records processed for rate calculation."""
        self._processed_count = count

    def filter_by_category(
        self, category: RejectionCategory
    ) -> tuple[RejectionEntry, ...]:
        """Return entries matching a specific category."""
        return tuple(e for e in self._entries if e.category == category)

    def sample_entries(
        self, category: RejectionCategory, n: int = 10
    ) -> tuple[RejectionEntry, ...]:
        """Return at most n entries for a given category."""
        matching = [e for e in self._entries if e.category == category]
        return tuple(matching[:n])

    def summary(self) -> RejectionSummary:
        """Generate a rejection summary with counts by category."""
        counts_by_category: dict[str, int] = {}
        for entry in self._entries:
            key = entry.category.value
            counts_by_category[key] = counts_by_category.get(key, 0) + 1

        total_rejected = self.error_count
        total_warnings = self.warning_count
        total_info = sum(
            1 for e in self._entries if e.category.severity == "info"
        )

        rejection_rate = (
            total_rejected / self._processed_count
            if self._processed_count > 0
            else 0.0
        )

        # Build sample entries: first 10 per category
        samples: dict[str, list[dict[str, Any]]] = {}
        for cat_value in counts_by_category:
            cat = RejectionCategory(cat_value)
            cat_entries = self.sample_entries(cat, n=10)
            samples[cat_value] = [
                {
                    "record_index": e.record_index,
                    "column": e.column,
                    "value": e.value,
                    "message": e.message,
                    "timestamp": e.timestamp,
                }
                for e in cat_entries
            ]

        return RejectionSummary(
            table_name=self._table_name,
            total_processed=self._processed_count,
            total_rejected=total_rejected,
            total_warnings=total_warnings,
            total_info=total_info,
            counts_by_category=counts_by_category,
            rejection_rate=rejection_rate,
            sample_entries=samples,
        )

    def to_csv(self, path: Path) -> None:
        """Write all entries to a CSV file with headers."""
        headers = [
            "record_index",
            "column",
            "value",
            "category",
            "message",
            "timestamp",
        ]
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for entry in self._entries:
                writer.writerow([
                    entry.record_index,
                    entry.column,
                    entry.value,
                    entry.category.value,
                    entry.message,
                    entry.timestamp,
                ])

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict representation."""
        s = self.summary()
        return {
            "table_name": self._table_name,
            "total_processed": s.total_processed,
            "total_rejected": s.total_rejected,
            "total_warnings": s.total_warnings,
            "total_info": s.total_info,
            "counts_by_category": s.counts_by_category,
            "rejection_rate": s.rejection_rate,
            "sample_entries": s.sample_entries,
        }

    def merge(self, other: RejectionLog) -> RejectionLog:
        """Combine entries from two logs into a new RejectionLog."""
        merged = RejectionLog(f"{self._table_name}+{other._table_name}")
        merged._entries = list(self._entries) + list(other._entries)
        merged._processed_count = self._processed_count + other._processed_count
        return merged
