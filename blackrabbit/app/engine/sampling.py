"""Dialect-aware row sampling strategies."""
from __future__ import annotations

from sqlalchemy.engine import Engine


def get_sample_clause(engine: Engine, table_name: str, schema: str | None, sample_rows: int) -> str:
    """Return a SQL clause for row sampling, or empty string if no sampling needed."""
    dialect_name = engine.dialect.name

    if dialect_name == "postgresql":
        return f"TABLESAMPLE SYSTEM (50) LIMIT {sample_rows}"

    if dialect_name in ("mysql", "mariadb"):
        return f"LIMIT {sample_rows}"

    if dialect_name in ("mssql",):
        return f"TABLESAMPLE ({sample_rows} ROWS)"

    # Default: unordered LIMIT (biased but fast)
    return f"LIMIT {sample_rows}"
