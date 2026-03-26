from __future__ import annotations

from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    dbms: str = "postgresql"
    server: str
    port: int = 5432
    user: str = ""
    password: str = ""
    schema_name: str = Field("public", alias="schema")
    tables: list[str] | None = None
    scan_values: bool = True
    min_cell_count: int = 5
    max_distinct_values: int = 1000
    rows_per_table: int = 100_000
    concurrency: int = 4

    model_config = {"populate_by_name": True}


class ScanStartResponse(BaseModel):
    scan_id: str


class ColumnProfile(BaseModel):
    name: str
    type: str
    row_count: int
    non_null_count: int
    null_count: int
    null_percentage: float
    distinct_count: int
    distinct_percentage: float
    top_values: dict[str, int] | None = None
    sample_values: dict[str, int] | None = None
    # Numeric extras
    min_value: float | str | None = Field(None, alias="min")
    max_value: float | str | None = Field(None, alias="max")
    mean: float | None = None
    median: float | None = None
    stddev: float | None = None
    # String extras
    min_length: int | None = None
    max_length: int | None = None
    avg_length: float | None = None
    empty_string_count: int | None = None
    # Date extras
    min_date: str | None = None
    max_date: str | None = None
    date_span_days: int | None = None

    model_config = {"populate_by_name": True}


class TableProfile(BaseModel):
    table_name: str
    row_count: int
    column_count: int
    columns: list[ColumnProfile]


class ScanResult(BaseModel):
    status: str  # "ok" or "error"
    tables: list[TableProfile]
    scan_time_seconds: float | None = None
    errors: list[dict[str, str]] | None = None


class ProgressEvent(BaseModel):
    event: str
    scan_id: str | None = None
    total_tables: int | None = None
    table: str | None = None
    index: int | None = None
    of: int | None = None
    rows: int | None = None
    columns: int | None = None
    elapsed_ms: int | None = None
    total_elapsed_ms: int | None = None
    succeeded: int | None = None
    failed: int | None = None
    tables_count: int | None = None
    columns_count: int | None = None
    message: str | None = None


class DialectInfo(BaseModel):
    name: str
    driver: str
    installed: bool
    version: str | None = None


class HealthResponse(BaseModel):
    status: str
    service: str = "blackrabbit"
    version: str = "0.1.0"
    python_version: str
    dialects_available: int
    dialects_total: int = 12
