"""ColumnProfiler: runs single-pass aggregate queries per table."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.models import ColumnProfile, TableProfile

log = logging.getLogger("blackrabbit.profiler")

# Types that get numeric extras (min, max, mean, stddev)
NUMERIC_TYPES = {"integer", "float", "decimal"}
# Types that get string extras (min_length, max_length, avg_length)
STRING_TYPES = {"string"}
# Types that get date extras (min_date, max_date, date_span_days)
DATE_TYPES = {"date", "datetime", "timestamp"}


class ColumnProfiler:
    def __init__(self, engine: Engine, schema: str | None) -> None:
        self._engine = engine
        self._schema = schema if schema and schema != "main" else None

    def profile_table(
        self,
        table_name: str,
        columns: list[dict[str, str]],
        sample_rows: int | None,
        top_n: int = 20,
    ) -> TableProfile:
        qualified = f"{self._schema}.{table_name}" if self._schema else table_name
        col_profiles = []

        # Phase 1: Single-pass aggregate query for core + type-specific stats
        core_stats = self._run_core_query(qualified, columns)
        row_count = core_stats.get("__row_count__", 0)

        for col_meta in columns:
            col_name = col_meta["name"]
            col_type = col_meta["type"]
            prefix = col_name

            null_count = core_stats.get(f"{prefix}__nulls", 0)
            non_null = row_count - null_count
            null_pct = round((null_count / row_count * 100) if row_count > 0 else 0, 2)
            distinct = core_stats.get(f"{prefix}__distinct", 0)
            distinct_pct = round((distinct / row_count * 100) if row_count > 0 else 0, 2)

            profile = ColumnProfile(
                name=col_name,
                type=col_type,
                row_count=row_count,
                non_null_count=non_null,
                null_count=null_count,
                null_percentage=null_pct,
                distinct_count=distinct,
                distinct_percentage=distinct_pct,
            )

            # Numeric extras
            if col_type in NUMERIC_TYPES:
                profile.min_value = core_stats.get(f"{prefix}__min")
                profile.max_value = core_stats.get(f"{prefix}__max")
                profile.mean = self._safe_round(core_stats.get(f"{prefix}__avg"))
                profile.stddev = self._safe_round(core_stats.get(f"{prefix}__stddev"))

            # String extras
            if col_type in STRING_TYPES:
                profile.min_length = core_stats.get(f"{prefix}__min_len")
                profile.max_length = core_stats.get(f"{prefix}__max_len")
                profile.avg_length = self._safe_round(core_stats.get(f"{prefix}__avg_len"))
                profile.empty_string_count = core_stats.get(f"{prefix}__empty_str", 0)

            # Date extras
            if col_type in DATE_TYPES:
                min_d = core_stats.get(f"{prefix}__min")
                max_d = core_stats.get(f"{prefix}__max")
                if min_d is not None:
                    profile.min_date = str(min_d)
                if max_d is not None:
                    profile.max_date = str(max_d)

            col_profiles.append(profile)

        # Phase 2: Top-N value frequencies (separate query per column)
        for profile in col_profiles:
            profile.top_values = self._run_top_values(qualified, profile.name, top_n)
            profile.sample_values = profile.top_values

        return TableProfile(
            table_name=table_name,
            row_count=row_count,
            column_count=len(col_profiles),
            columns=col_profiles,
        )

    def _run_core_query(self, qualified_table: str, columns: list[dict[str, str]]) -> dict[str, Any]:
        """Build and run a single aggregate query for all columns."""
        parts = ["COUNT(*) AS __row_count__"]

        for col in columns:
            name = col["name"]
            ctype = col["type"]
            q_name = f'"{name}"'

            # Core: null count, distinct count
            parts.append(f'COUNT(*) - COUNT({q_name}) AS "{name}__nulls"')
            parts.append(f'COUNT(DISTINCT {q_name}) AS "{name}__distinct"')

            # Numeric extras
            if ctype in NUMERIC_TYPES:
                parts.append(f'MIN({q_name}) AS "{name}__min"')
                parts.append(f'MAX({q_name}) AS "{name}__max"')
                parts.append(f'AVG(CAST({q_name} AS FLOAT)) AS "{name}__avg"')
                # SQLite doesn't have STDDEV
                if self._engine.dialect.name != "sqlite":
                    parts.append(f'STDDEV({q_name}) AS "{name}__stddev"')

            # String extras
            if ctype in STRING_TYPES:
                parts.append(f'MIN(LENGTH({q_name})) AS "{name}__min_len"')
                parts.append(f'MAX(LENGTH({q_name})) AS "{name}__max_len"')
                parts.append(f'AVG(LENGTH({q_name})) AS "{name}__avg_len"')
                parts.append(f"SUM(CASE WHEN {q_name} = '' THEN 1 ELSE 0 END) AS \"{name}__empty_str\"")

            # Date extras (min/max)
            if ctype in DATE_TYPES:
                parts.append(f'MIN({q_name}) AS "{name}__min"')
                parts.append(f'MAX({q_name}) AS "{name}__max"')

        sql = f"SELECT {', '.join(parts)} FROM {qualified_table}"

        with self._engine.connect() as conn:
            row = conn.execute(text(sql)).mappings().first()
            return dict(row) if row else {}

    def _run_top_values(self, qualified_table: str, column_name: str, top_n: int) -> dict[str, int]:
        """Get top N most frequent values for a column."""
        q_name = f'"{column_name}"'
        sql = (
            f"SELECT CAST({q_name} AS TEXT) AS val, COUNT(*) AS freq "
            f"FROM {qualified_table} "
            f"WHERE {q_name} IS NOT NULL "
            f"GROUP BY {q_name} "
            f"ORDER BY freq DESC "
            f"LIMIT {top_n}"
        )
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(text(sql)).fetchall()
                return {str(r[0]): int(r[1]) for r in rows}
        except Exception as e:
            log.warning("Top values query failed for %s: %s", column_name, e)
            return {}

    @staticmethod
    def _safe_round(value: Any, digits: int = 4) -> float | None:
        if value is None:
            return None
        try:
            return round(float(value), digits)
        except (TypeError, ValueError):
            return None
