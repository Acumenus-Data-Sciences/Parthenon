# BlackRabbit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WhiteRabbit Java CLI + Python shim with a native Python FastAPI profiling service that supports all 12 HADES database dialects, parallel single-pass profiling, and real-time SSE progress reporting.

**Architecture:** BlackRabbit is a standalone FastAPI service using SQLAlchemy for multi-dialect database connectivity. It profiles tables in parallel using single-pass aggregate SQL, streams progress via Server-Sent Events, and returns structured JSON compatible with the existing Laravel persistence layer.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, uvicorn, psycopg3, pyodbc, PyMySQL, python-oracledb, duckdb-engine, sqlalchemy-bigquery, sqlalchemy-redshift, snowflake-sqlalchemy, databricks-sql-connector

**Spec:** `docs/superpowers/specs/2026-03-26-blackrabbit-design.md`

---

## File Map

```
New files:
  blackrabbit/
    app/
      __init__.py
      main.py                    -- FastAPI app, lifespan, CORS
      config.py                  -- Settings via pydantic-settings
      models.py                  -- Pydantic request/response models
      scan_store.py              -- In-memory scan state + result storage
      engine/
        __init__.py
        connection.py            -- ConnectionFactory: dbms string -> SQLAlchemy engine
        inspector.py             -- SchemaInspector: enumerate tables/columns
        profiler.py              -- ColumnProfiler: per-table aggregate queries
        assembler.py             -- ResultAssembler: structure JSON output
        sampling.py              -- Dialect-aware TABLESAMPLE strategies
      routers/
        __init__.py
        health.py                -- GET /health, GET /dialects
        scan.py                  -- POST /scan, GET /scan/{id}, GET /scan/{id}/result
    tests/
      __init__.py
      conftest.py                -- SQLite in-memory fixtures
      test_connection.py         -- ConnectionFactory tests
      test_inspector.py          -- SchemaInspector tests
      test_profiler.py           -- ColumnProfiler tests
      test_assembler.py          -- ResultAssembler tests
      test_scan_api.py           -- Integration tests for /scan endpoints
      test_health_api.py         -- Tests for /health and /dialects
    requirements.txt
    requirements-dev.txt
  docker/blackrabbit/
    Dockerfile

Modified files:
  docker-compose.yml                                              -- Replace whiterabbit service with blackrabbit
  backend/config/services.php                                     -- Add blackrabbit URL config
  backend/app/Services/Profiler/SourceProfilerService.php         -- POST /scan -> fetch result, SSE proxy support
  backend/app/Http/Controllers/Api/V1/SourceProfilerController.php -- Add SSE stream endpoint
  backend/routes/api.php                                          -- Add scan-progress route
  backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php -- Add blackrabbit health check
  frontend/src/features/etl/api.ts                                -- Add SSE scan types + functions
  frontend/src/features/etl/hooks/useProfilerData.ts              -- Add useRunScanWithProgress hook
  frontend/src/features/etl/components/ScanProgressIndicator.tsx  -- Replace fake phases with real SSE progress
  frontend/src/features/etl/pages/SourceProfilerPage.tsx          -- Wire new progress hook
```

---

### Task 1: Pydantic Models & Configuration

**Files:**
- Create: `blackrabbit/app/__init__.py`
- Create: `blackrabbit/app/config.py`
- Create: `blackrabbit/app/models.py`
- Create: `blackrabbit/app/scan_store.py`
- Test: `blackrabbit/tests/__init__.py`
- Test: `blackrabbit/tests/conftest.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p blackrabbit/app/engine blackrabbit/app/routers blackrabbit/tests
touch blackrabbit/app/__init__.py blackrabbit/app/engine/__init__.py blackrabbit/app/routers/__init__.py blackrabbit/tests/__init__.py
```

- [ ] **Step 2: Write config.py**

```python
# blackrabbit/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    scan_timeout_seconds: int = 1200
    per_table_timeout_seconds: int = 300
    default_concurrency: int = 4
    default_top_n: int = 20
    default_sample_rows: int = 100_000
    result_ttl_seconds: int = 1800  # 30 minutes
    host: str = "0.0.0.0"
    port: int = 8090

    model_config = {"env_prefix": "BLACKRABBIT_"}


settings = Settings()
```

- [ ] **Step 3: Write models.py**

```python
# blackrabbit/app/models.py
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
```

- [ ] **Step 4: Write scan_store.py**

```python
# blackrabbit/app/scan_store.py
"""In-memory store for active scans and their results."""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field

from app.config import settings
from app.models import ProgressEvent, ScanResult


@dataclass
class ScanState:
    scan_id: str
    created_at: float
    status: str = "running"  # running | completed | error
    result: ScanResult | None = None
    events: list[ProgressEvent] = field(default_factory=list)
    subscribers: list[asyncio.Queue[ProgressEvent | None]] = field(default_factory=list)

    def publish(self, event: ProgressEvent) -> None:
        self.events.append(event)
        for q in self.subscribers:
            q.put_nowait(event)

    def complete(self, result: ScanResult) -> None:
        self.status = "completed"
        self.result = result
        for q in self.subscribers:
            q.put_nowait(None)  # Signal end of stream

    def fail(self, message: str) -> None:
        self.status = "error"
        self.result = ScanResult(status="error", tables=[], errors=[{"message": message}])
        for q in self.subscribers:
            q.put_nowait(None)

    def subscribe(self) -> asyncio.Queue[ProgressEvent | None]:
        q: asyncio.Queue[ProgressEvent | None] = asyncio.Queue()
        # Replay existing events
        for e in self.events:
            q.put_nowait(e)
        if self.status != "running":
            q.put_nowait(None)
        else:
            self.subscribers.append(q)
        return q


class ScanStore:
    def __init__(self) -> None:
        self._scans: dict[str, ScanState] = {}

    def create(self) -> ScanState:
        scan_id = uuid.uuid4().hex[:12]
        state = ScanState(scan_id=scan_id, created_at=time.time())
        self._scans[scan_id] = state
        self._evict_expired()
        return state

    def get(self, scan_id: str) -> ScanState | None:
        return self._scans.get(scan_id)

    def _evict_expired(self) -> None:
        cutoff = time.time() - settings.result_ttl_seconds
        expired = [k for k, v in self._scans.items() if v.created_at < cutoff and v.status != "running"]
        for k in expired:
            del self._scans[k]


scan_store = ScanStore()
```

- [ ] **Step 5: Write conftest.py with SQLite test fixtures**

```python
# blackrabbit/tests/conftest.py
import pytest
from sqlalchemy import Column, Integer, String, Float, Date, Table, MetaData, create_engine, text


@pytest.fixture
def sqlite_engine():
    """Create an in-memory SQLite database with test tables."""
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()

    Table("person", meta,
        Column("person_id", Integer, primary_key=True),
        Column("gender_concept_id", Integer),
        Column("year_of_birth", Integer),
        Column("birth_datetime", String),  # SQLite has no native date
        Column("race_concept_id", Integer),
        Column("person_source_value", String),
    )

    Table("visit_occurrence", meta,
        Column("visit_occurrence_id", Integer, primary_key=True),
        Column("person_id", Integer),
        Column("visit_concept_id", Integer),
        Column("visit_start_date", String),
        Column("visit_end_date", String),
        Column("visit_type_concept_id", Integer),
    )

    meta.create_all(engine)

    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO person (person_id, gender_concept_id, year_of_birth, "
            "birth_datetime, race_concept_id, person_source_value) VALUES "
            "(1, 8507, 1980, '1980-06-15', 8527, 'P001'), "
            "(2, 8532, 1975, '1975-03-22', 8527, 'P002'), "
            "(3, 8507, 1990, NULL, 8516, NULL)"
        ))
        conn.execute(text(
            "INSERT INTO visit_occurrence (visit_occurrence_id, person_id, "
            "visit_concept_id, visit_start_date, visit_end_date, visit_type_concept_id) VALUES "
            "(1, 1, 9201, '2020-01-15', '2020-01-15', 44818517), "
            "(2, 1, 9202, '2020-06-01', '2020-06-03', 44818517), "
            "(3, 2, 9201, '2021-03-10', '2021-03-10', 44818517)"
        ))

    return engine


@pytest.fixture
def sqlite_schema():
    return "main"
```

- [ ] **Step 6: Commit**

```bash
git add blackrabbit/
git commit -m "feat(blackrabbit): add Pydantic models, config, scan store, and test fixtures"
```

---

### Task 2: ConnectionFactory — Dialect Registry & Engine Builder

**Files:**
- Create: `blackrabbit/app/engine/connection.py`
- Test: `blackrabbit/tests/test_connection.py`

- [ ] **Step 1: Write the failing test**

```python
# blackrabbit/tests/test_connection.py
import pytest
from app.engine.connection import ConnectionFactory, DIALECT_REGISTRY


def test_dialect_registry_has_12_entries():
    assert len(DIALECT_REGISTRY) == 12


def test_build_url_postgresql():
    url = ConnectionFactory.build_url("postgresql", "localhost/mydb", 5432, "user", "pass", "omop")
    assert "postgresql+psycopg" in str(url)
    assert "localhost" in str(url)


def test_build_url_sqlserver():
    url = ConnectionFactory.build_url("sql server", "myhost/mydb", 1433, "sa", "pass", "dbo")
    assert "mssql+pyodbc" in str(url)


def test_build_url_sqlite():
    url = ConnectionFactory.build_url("sqlite", ":memory:", 0, "", "", "main")
    assert "sqlite" in str(url)


def test_build_url_unknown_dialect_raises():
    with pytest.raises(ValueError, match="Unsupported dialect"):
        ConnectionFactory.build_url("nosqldb", "host/db", 0, "", "", "")


def test_create_engine_sqlite(sqlite_engine):
    """Verify the factory can create a working SQLite engine."""
    engine = ConnectionFactory.create_engine("sqlite", ":memory:", 0, "", "", "main")
    assert engine is not None
    engine.dispose()


def test_available_dialects_includes_sqlite():
    dialects = ConnectionFactory.available_dialects()
    sqlite_info = next((d for d in dialects if d.name == "sqlite"), None)
    assert sqlite_info is not None
    assert sqlite_info.installed is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd blackrabbit && python -m pytest tests/test_connection.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.engine.connection'`

- [ ] **Step 3: Write ConnectionFactory**

```python
# blackrabbit/app/engine/connection.py
"""ConnectionFactory: maps HADES dialect names to SQLAlchemy engine URLs."""
from __future__ import annotations

import importlib
from dataclasses import dataclass

from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.engine import Engine, URL

from app.models import DialectInfo


@dataclass(frozen=True)
class DialectSpec:
    name: str
    scheme: str
    driver_package: str
    default_port: int


DIALECT_REGISTRY: dict[str, DialectSpec] = {
    "postgresql": DialectSpec("postgresql", "postgresql+psycopg", "psycopg", 5432),
    "sql server": DialectSpec("sql server", "mssql+pyodbc", "pyodbc", 1433),
    "oracle": DialectSpec("oracle", "oracle+oracledb", "oracledb", 1521),
    "mysql": DialectSpec("mysql", "mysql+pymysql", "pymysql", 3306),
    "mariadb": DialectSpec("mariadb", "mariadb+pymysql", "pymysql", 3306),
    "bigquery": DialectSpec("bigquery", "bigquery", "sqlalchemy_bigquery", 443),
    "redshift": DialectSpec("redshift", "redshift+psycopg2", "sqlalchemy_redshift", 5439),
    "snowflake": DialectSpec("snowflake", "snowflake", "snowflake.sqlalchemy", 443),
    "spark": DialectSpec("spark", "databricks", "databricks.sql", 443),
    "duckdb": DialectSpec("duckdb", "duckdb", "duckdb_engine", 0),
    "sqlite": DialectSpec("sqlite", "sqlite", "sqlite3", 0),
    "synapse": DialectSpec("synapse", "mssql+pyodbc", "pyodbc", 1433),
}


class ConnectionFactory:
    @staticmethod
    def build_url(dbms: str, server: str, port: int, user: str, password: str, schema: str) -> URL | str:
        key = dbms.lower().strip()
        spec = DIALECT_REGISTRY.get(key)
        if spec is None:
            raise ValueError(f"Unsupported dialect: {dbms!r}. Supported: {list(DIALECT_REGISTRY.keys())}")

        if key == "sqlite":
            return f"sqlite:///{server}" if server != ":memory:" else "sqlite:///:memory:"

        if key == "bigquery":
            return f"bigquery://{server}"

        # HADES convention: server = "host/database"
        parts = server.split("/", 1)
        host = parts[0]
        database = parts[1] if len(parts) > 1 else ""

        if key in ("sql server", "synapse"):
            driver_str = "ODBC+Driver+17+for+SQL+Server"
            return URL.create(
                drivername=spec.scheme,
                username=user,
                password=password,
                host=host,
                port=port or spec.default_port,
                database=database,
                query={"driver": driver_str},
            )

        return URL.create(
            drivername=spec.scheme,
            username=user,
            password=password,
            host=host,
            port=port or spec.default_port,
            database=database,
        )

    @staticmethod
    def create_engine(dbms: str, server: str, port: int, user: str, password: str, schema: str) -> Engine:
        url = ConnectionFactory.build_url(dbms, server, port, user, password, schema)
        return sa_create_engine(url, poolclass=None, echo=False)

    @staticmethod
    def available_dialects() -> list[DialectInfo]:
        results: list[DialectInfo] = []
        for spec in DIALECT_REGISTRY.values():
            installed = False
            version = None
            try:
                mod = importlib.import_module(spec.driver_package)
                installed = True
                version = getattr(mod, "__version__", getattr(mod, "version", None))
                if version and not isinstance(version, str):
                    version = str(version)
            except ImportError:
                pass
            results.append(DialectInfo(
                name=spec.name,
                driver=spec.driver_package,
                installed=installed,
                version=version,
            ))
        return results
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd blackrabbit && python -m pytest tests/test_connection.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add blackrabbit/app/engine/connection.py blackrabbit/tests/test_connection.py
git commit -m "feat(blackrabbit): add ConnectionFactory with 12-dialect registry"
```

---

### Task 3: SchemaInspector — Table & Column Enumeration

**Files:**
- Create: `blackrabbit/app/engine/inspector.py`
- Test: `blackrabbit/tests/test_inspector.py`

- [ ] **Step 1: Write the failing test**

```python
# blackrabbit/tests/test_inspector.py
import pytest
from app.engine.inspector import SchemaInspector


def test_list_tables(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    tables = inspector.list_tables()
    assert set(tables) == {"person", "visit_occurrence"}


def test_list_tables_with_filter(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    tables = inspector.list_tables(include=["person"])
    assert tables == ["person"]


def test_get_columns(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    names = [c["name"] for c in columns]
    assert "person_id" in names
    assert "gender_concept_id" in names
    assert len(columns) == 6


def test_get_columns_returns_type(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    pid = next(c for c in columns if c["name"] == "person_id")
    assert pid["type"] in ("integer", "INTEGER", "int")


def test_get_columns_nonexistent_table(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    with pytest.raises(Exception):
        inspector.get_columns("nonexistent_table")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd blackrabbit && python -m pytest tests/test_inspector.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.engine.inspector'`

- [ ] **Step 3: Write SchemaInspector**

```python
# blackrabbit/app/engine/inspector.py
"""SchemaInspector: enumerate tables and columns via SQLAlchemy reflection."""
from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


TYPE_MAP: dict[str, str] = {
    "INTEGER": "integer",
    "BIGINT": "integer",
    "SMALLINT": "integer",
    "TINYINT": "integer",
    "INT": "integer",
    "FLOAT": "float",
    "DOUBLE": "float",
    "DOUBLE_PRECISION": "float",
    "REAL": "float",
    "NUMERIC": "decimal",
    "DECIMAL": "decimal",
    "BOOLEAN": "boolean",
    "BOOL": "boolean",
    "DATE": "date",
    "DATETIME": "datetime",
    "TIMESTAMP": "timestamp",
    "TIMESTAMP WITHOUT TIME ZONE": "timestamp",
    "TIMESTAMP WITH TIME ZONE": "timestamp",
    "VARCHAR": "string",
    "NVARCHAR": "string",
    "TEXT": "string",
    "CHAR": "string",
    "NCHAR": "string",
    "STRING": "string",
    "CLOB": "string",
    "BLOB": "binary",
    "BYTEA": "binary",
    "VARBINARY": "binary",
    "BINARY": "binary",
}


def normalize_type(raw_type: str) -> str:
    """Map a SQLAlchemy type string to our normalized type set."""
    upper = raw_type.upper().split("(")[0].strip()
    return TYPE_MAP.get(upper, "unknown")


class SchemaInspector:
    def __init__(self, engine: Engine, schema: str) -> None:
        self._engine = engine
        self._schema = schema if schema and schema != "main" else None
        self._inspector = inspect(engine)

    def list_tables(self, include: list[str] | None = None) -> list[str]:
        tables = self._inspector.get_table_names(schema=self._schema)
        if include:
            include_lower = {t.lower() for t in include}
            tables = [t for t in tables if t.lower() in include_lower]
        return sorted(tables)

    def get_columns(self, table_name: str) -> list[dict[str, str]]:
        raw_columns = self._inspector.get_columns(table_name, schema=self._schema)
        if not raw_columns:
            raise ValueError(f"Table {table_name!r} not found or has no columns")
        return [
            {
                "name": col["name"],
                "type": normalize_type(str(col["type"])),
                "raw_type": str(col["type"]),
            }
            for col in raw_columns
        ]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd blackrabbit && python -m pytest tests/test_inspector.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add blackrabbit/app/engine/inspector.py blackrabbit/tests/test_inspector.py
git commit -m "feat(blackrabbit): add SchemaInspector for table/column enumeration"
```

---

### Task 4: ColumnProfiler — Single-Pass Aggregate Queries

**Files:**
- Create: `blackrabbit/app/engine/profiler.py`
- Create: `blackrabbit/app/engine/sampling.py`
- Test: `blackrabbit/tests/test_profiler.py`

- [ ] **Step 1: Write the failing test**

```python
# blackrabbit/tests/test_profiler.py
import pytest
from app.engine.profiler import ColumnProfiler
from app.engine.inspector import SchemaInspector


def test_profile_table_returns_all_columns(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    assert result.table_name == "person"
    assert result.row_count == 3
    assert result.column_count == 6
    assert len(result.columns) == 6


def test_profile_null_stats(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    # person_source_value has 1 null out of 3 rows
    psv = next(c for c in result.columns if c.name == "person_source_value")
    assert psv.null_count == 1
    assert psv.non_null_count == 2
    assert abs(psv.null_percentage - 33.33) < 1.0


def test_profile_distinct_count(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    # gender_concept_id has values 8507, 8532 -> 2 distinct
    gc = next(c for c in result.columns if c.name == "gender_concept_id")
    assert gc.distinct_count == 2


def test_profile_top_values(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    gc = next(c for c in result.columns if c.name == "gender_concept_id")
    assert gc.top_values is not None
    # 8507 appears twice, 8532 once
    assert gc.top_values.get("8507", 0) == 2


def test_profile_numeric_extras(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    yob = next(c for c in result.columns if c.name == "year_of_birth")
    assert yob.min_value == 1975
    assert yob.max_value == 1990
    assert yob.mean is not None


def test_profile_string_extras(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    psv = next(c for c in result.columns if c.name == "person_source_value")
    assert psv.min_length is not None
    assert psv.max_length is not None
    assert psv.min_length == 4  # "P001"
    assert psv.max_length == 4  # "P002"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd blackrabbit && python -m pytest tests/test_profiler.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.engine.profiler'`

- [ ] **Step 3: Write sampling.py**

```python
# blackrabbit/app/engine/sampling.py
"""Dialect-aware row sampling strategies."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def get_sample_clause(engine: Engine, table_name: str, schema: str | None, sample_rows: int) -> str:
    """Return a SQL clause for row sampling, or empty string if no sampling needed."""
    dialect_name = engine.dialect.name

    if dialect_name == "postgresql":
        # TABLESAMPLE SYSTEM gives approximate percentage-based sampling.
        # We estimate a percentage from sample_rows / estimated total.
        # For safety, use LIMIT as a backstop.
        return f"TABLESAMPLE SYSTEM (50) LIMIT {sample_rows}"

    if dialect_name in ("mysql", "mariadb"):
        return f"LIMIT {sample_rows}"

    if dialect_name in ("mssql",):
        return f"TABLESAMPLE ({sample_rows} ROWS)"

    # Default: unordered LIMIT (biased but fast)
    return f"LIMIT {sample_rows}"
```

- [ ] **Step 4: Write profiler.py**

```python
# blackrabbit/app/engine/profiler.py
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
            parts.append(f"COUNT(*) - COUNT({q_name}) AS \"{name}__nulls\"")
            parts.append(f"COUNT(DISTINCT {q_name}) AS \"{name}__distinct\"")

            # Numeric extras
            if ctype in NUMERIC_TYPES:
                parts.append(f"MIN({q_name}) AS \"{name}__min\"")
                parts.append(f"MAX({q_name}) AS \"{name}__max\"")
                parts.append(f"AVG(CAST({q_name} AS FLOAT)) AS \"{name}__avg\"")
                # SQLite doesn't have STDDEV — handle gracefully
                if self._engine.dialect.name != "sqlite":
                    parts.append(f"STDDEV({q_name}) AS \"{name}__stddev\"")

            # String extras
            if ctype in STRING_TYPES:
                parts.append(f"MIN(LENGTH({q_name})) AS \"{name}__min_len\"")
                parts.append(f"MAX(LENGTH({q_name})) AS \"{name}__max_len\"")
                parts.append(f"AVG(LENGTH({q_name})) AS \"{name}__avg_len\"")
                parts.append(f"SUM(CASE WHEN {q_name} = '' THEN 1 ELSE 0 END) AS \"{name}__empty_str\"")

            # Date extras (min/max reuse numeric min/max)
            if ctype in DATE_TYPES:
                parts.append(f"MIN({q_name}) AS \"{name}__min\"")
                parts.append(f"MAX({q_name}) AS \"{name}__max\"")

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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd blackrabbit && python -m pytest tests/test_profiler.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add blackrabbit/app/engine/profiler.py blackrabbit/app/engine/sampling.py blackrabbit/tests/test_profiler.py
git commit -m "feat(blackrabbit): add ColumnProfiler with single-pass aggregate queries"
```

---

### Task 5: ResultAssembler

**Files:**
- Create: `blackrabbit/app/engine/assembler.py`
- Test: `blackrabbit/tests/test_assembler.py`

- [ ] **Step 1: Write the failing test**

```python
# blackrabbit/tests/test_assembler.py
import pytest
from app.engine.assembler import ResultAssembler
from app.models import ScanRequest


def test_assemble_full_scan(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert result.status == "ok"
    assert len(result.tables) == 2
    table_names = {t.table_name for t in result.tables}
    assert table_names == {"person", "visit_occurrence"}


def test_assemble_with_table_filter(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
        tables=["person"],
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert len(result.tables) == 1
    assert result.tables[0].table_name == "person"


def test_assemble_includes_scan_time(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert result.scan_time_seconds is not None
    assert result.scan_time_seconds >= 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd blackrabbit && python -m pytest tests/test_assembler.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.engine.assembler'`

- [ ] **Step 3: Write ResultAssembler**

```python
# blackrabbit/app/engine/assembler.py
"""ResultAssembler: orchestrates schema inspection + column profiling into ScanResult."""
from __future__ import annotations

import logging
import time

from sqlalchemy.engine import Engine

from app.engine.inspector import SchemaInspector
from app.engine.profiler import ColumnProfiler
from app.models import ScanRequest, ScanResult, TableProfile, ProgressEvent
from app.scan_store import ScanState

log = logging.getLogger("blackrabbit.assembler")


class ResultAssembler:
    def __init__(
        self,
        engine: Engine,
        schema: str | None,
        request: ScanRequest,
        scan_state: ScanState | None = None,
    ) -> None:
        self._engine = engine
        self._schema = schema
        self._request = request
        self._state = scan_state

    def _publish(self, event: ProgressEvent) -> None:
        if self._state:
            self._state.publish(event)

    def run(self) -> ScanResult:
        start = time.monotonic()
        inspector = SchemaInspector(self._engine, self._schema or "")
        profiler = ColumnProfiler(self._engine, self._schema)

        tables = inspector.list_tables(include=self._request.tables)
        total = len(tables)

        if self._state:
            self._publish(ProgressEvent(
                event="started",
                scan_id=self._state.scan_id,
                total_tables=total,
            ))

        results: list[TableProfile] = []
        errors: list[dict[str, str]] = []

        for idx, table_name in enumerate(tables, 1):
            self._publish(ProgressEvent(
                event="table_started",
                table=table_name,
                index=idx,
                of=total,
            ))

            table_start = time.monotonic()
            try:
                columns = inspector.get_columns(table_name)
                profile = profiler.profile_table(
                    table_name,
                    columns,
                    sample_rows=self._request.rows_per_table,
                    top_n=self._request.max_distinct_values,
                )
                results.append(profile)

                elapsed_ms = int((time.monotonic() - table_start) * 1000)
                self._publish(ProgressEvent(
                    event="table_done",
                    table=table_name,
                    index=idx,
                    of=total,
                    rows=profile.row_count,
                    columns=profile.column_count,
                    elapsed_ms=elapsed_ms,
                ))

            except Exception as e:
                log.warning("Error profiling table %s: %s", table_name, e)
                errors.append({"table": table_name, "message": str(e)})
                self._publish(ProgressEvent(
                    event="error",
                    table=table_name,
                    message=str(e),
                ))

        total_elapsed = round(time.monotonic() - start, 3)

        completion_event = "completed" if not errors else "completed_with_errors"
        self._publish(ProgressEvent(
            event=completion_event,
            tables_count=total,
            columns_count=sum(t.column_count for t in results),
            total_elapsed_ms=int(total_elapsed * 1000),
            succeeded=len(results),
            failed=len(errors),
        ))

        return ScanResult(
            status="ok" if not errors else "partial",
            tables=results,
            scan_time_seconds=total_elapsed,
            errors=errors if errors else None,
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd blackrabbit && python -m pytest tests/test_assembler.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add blackrabbit/app/engine/assembler.py blackrabbit/tests/test_assembler.py
git commit -m "feat(blackrabbit): add ResultAssembler orchestrating inspect + profile"
```

---

### Task 6: FastAPI Routers — Health, Dialects, Scan, SSE Progress

**Files:**
- Create: `blackrabbit/app/routers/health.py`
- Create: `blackrabbit/app/routers/scan.py`
- Create: `blackrabbit/app/main.py`
- Test: `blackrabbit/tests/test_health_api.py`
- Test: `blackrabbit/tests/test_scan_api.py`

- [ ] **Step 1: Write health router**

```python
# blackrabbit/app/routers/health.py
import platform

from fastapi import APIRouter

from app.engine.connection import ConnectionFactory
from app.models import HealthResponse, DialectInfo

router = APIRouter()


@router.get("/health")
def health() -> HealthResponse:
    dialects = ConnectionFactory.available_dialects()
    available = sum(1 for d in dialects if d.installed)
    return HealthResponse(
        status="ok",
        python_version=platform.python_version(),
        dialects_available=available,
    )


@router.get("/dialects")
def dialects() -> list[DialectInfo]:
    return ConnectionFactory.available_dialects()
```

- [ ] **Step 2: Write scan router**

```python
# blackrabbit/app/routers/scan.py
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.engine.assembler import ResultAssembler
from app.engine.connection import ConnectionFactory
from app.models import ScanRequest, ScanStartResponse, ScanResult, ProgressEvent
from app.scan_store import scan_store

router = APIRouter()
log = logging.getLogger("blackrabbit.scan")


def _run_scan(scan_id: str, request: ScanRequest) -> None:
    """Synchronous scan execution — runs in background thread."""
    state = scan_store.get(scan_id)
    if not state:
        return

    try:
        engine = ConnectionFactory.create_engine(
            dbms=request.dbms,
            server=request.server,
            port=request.port,
            user=request.user,
            password=request.password,
            schema=request.schema_name,
        )
        assembler = ResultAssembler(
            engine=engine,
            schema=request.schema_name,
            request=request,
            scan_state=state,
        )
        result = assembler.run()
        state.complete(result)
        engine.dispose()

    except Exception as e:
        log.exception("Scan %s failed", scan_id)
        if state:
            state.fail(str(e))


@router.post("/scan")
async def start_scan(request: ScanRequest, background_tasks: BackgroundTasks) -> ScanStartResponse:
    state = scan_store.create()
    background_tasks.add_task(_run_scan, state.scan_id, request)
    return ScanStartResponse(scan_id=state.scan_id)


@router.get("/scan/{scan_id}")
async def scan_progress(scan_id: str) -> StreamingResponse:
    state = scan_store.get(scan_id)
    if not state:
        raise HTTPException(status_code=404, detail="Scan not found")

    queue = state.subscribe()

    async def event_stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event.model_dump(exclude_none=True))}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/scan/{scan_id}/result")
async def scan_result(scan_id: str) -> ScanResult:
    state = scan_store.get(scan_id)
    if not state:
        raise HTTPException(status_code=410, detail="Scan expired or not found")
    if state.status == "running":
        raise HTTPException(status_code=404, detail="Scan still running")
    if not state.result:
        raise HTTPException(status_code=500, detail="Scan completed but no result available")
    return state.result
```

- [ ] **Step 3: Write main.py**

```python
# blackrabbit/app/main.py
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, scan

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

app = FastAPI(
    title="BlackRabbit Database Profiler",
    description="Native database profiling service replacing WhiteRabbit. "
                "Supports 12 HADES dialects with parallel single-pass profiling.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(scan.router)
```

- [ ] **Step 4: Write health API test**

```python
# blackrabbit/tests/test_health_api.py
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "blackrabbit"
    assert data["version"] == "0.1.0"
    assert "python_version" in data
    assert data["dialects_total"] == 12


def test_dialects_returns_list():
    resp = client.get("/dialects")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 12
    names = {d["name"] for d in data}
    assert "postgresql" in names
    assert "sqlite" in names


def test_dialects_sqlite_is_installed():
    resp = client.get("/dialects")
    data = resp.json()
    sqlite = next(d for d in data if d["name"] == "sqlite")
    assert sqlite["installed"] is True
```

- [ ] **Step 5: Write scan API test**

```python
# blackrabbit/tests/test_scan_api.py
import time

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_scan_sqlite_returns_scan_id():
    resp = client.post("/scan", json={
        "dbms": "sqlite",
        "server": ":memory:",
        "port": 0,
        "user": "",
        "password": "",
        "schema": "main",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "scan_id" in data


def test_scan_result_not_found():
    resp = client.get("/scan/nonexistent/result")
    assert resp.status_code == 410


def test_scan_progress_not_found():
    resp = client.get("/scan/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 6: Run all tests**

```bash
cd blackrabbit && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add blackrabbit/app/routers/ blackrabbit/app/main.py blackrabbit/tests/test_health_api.py blackrabbit/tests/test_scan_api.py
git commit -m "feat(blackrabbit): add FastAPI routers for health, dialects, scan, and SSE progress"
```

---

### Task 7: Dockerfile & Docker Compose Integration

**Files:**
- Create: `blackrabbit/requirements.txt`
- Create: `blackrabbit/requirements-dev.txt`
- Create: `docker/blackrabbit/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `backend/config/services.php`

- [ ] **Step 1: Write requirements.txt**

```
# blackrabbit/requirements.txt
fastapi>=0.115,<1
uvicorn[standard]>=0.34,<1
pydantic>=2.0,<3
pydantic-settings>=2.0,<3
sqlalchemy>=2.0,<3

# Database drivers — 12 HADES dialects
psycopg[binary]>=3.2,<4
pyodbc>=5.1,<6
oracledb>=2.0,<3
PyMySQL>=1.1,<2
cryptography>=44.0  # PyMySQL SHA256 auth
sqlalchemy-bigquery>=1.12,<2
sqlalchemy-redshift>=0.8,<1
snowflake-sqlalchemy>=1.7,<2
databricks-sql-connector>=3.0,<4
duckdb-engine>=0.15,<1
duckdb>=1.0,<2
```

- [ ] **Step 2: Write requirements-dev.txt**

```
# blackrabbit/requirements-dev.txt
-r requirements.txt
pytest>=8.0,<9
httpx>=0.27  # FastAPI TestClient
ruff>=0.7
mypy>=1.13
```

- [ ] **Step 3: Write Dockerfile**

```dockerfile
# docker/blackrabbit/Dockerfile
FROM python:3.12-slim

# System deps for pyodbc (SQL Server/Synapse), oracledb, and health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc-dev gcc g++ curl gnupg2 && rm -rf /var/lib/apt/lists/*

# Microsoft ODBC Driver 17 for SQL Server
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
    > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 && \
    rm -rf /var/lib/apt/lists/*

# Non-root user (HIGHSEC section 4.1)
RUN addgroup --system blackrabbit && \
    adduser --system --ingroup blackrabbit blackrabbit

WORKDIR /app

COPY blackrabbit/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY blackrabbit/app/ ./app/
RUN chown -R blackrabbit:blackrabbit /app

USER blackrabbit
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
```

- [ ] **Step 4: Update docker-compose.yml — replace whiterabbit with blackrabbit**

Find the `whiterabbit:` service block in `docker-compose.yml` and replace it with:

```yaml
  blackrabbit:
    container_name: parthenon-blackrabbit
    image: ghcr.io/sudoshi/parthenon-blackrabbit:latest
    build:
      context: .
      dockerfile: docker/blackrabbit/Dockerfile
    ports:
      - "${WHITERABBIT_PORT:-8090}:8090"
    environment:
      - BLACKRABBIT_SCAN_TIMEOUT_SECONDS=${SCAN_TIMEOUT_SECONDS:-1200}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 2G
    networks:
      - parthenon
    restart: unless-stopped
```

- [ ] **Step 5: Update backend/config/services.php — add blackrabbit URL**

Add to the `services.php` config array:

```php
'blackrabbit' => [
    'url' => env('BLACKRABBIT_URL', env('WHITERABBIT_URL', 'http://blackrabbit:8090')),
],
```

- [ ] **Step 6: Build and verify container starts**

```bash
docker compose build blackrabbit
docker compose up -d blackrabbit
sleep 5
curl -s http://localhost:8090/health | python3 -m json.tool
curl -s http://localhost:8090/dialects | python3 -m json.tool
```

Expected: Health returns `{"status": "ok", ...}`, dialects returns 12-item list

- [ ] **Step 7: Commit**

```bash
git add blackrabbit/requirements.txt blackrabbit/requirements-dev.txt docker/blackrabbit/Dockerfile docker-compose.yml backend/config/services.php
git commit -m "feat(blackrabbit): add Dockerfile, docker-compose service, and config"
```

---

### Task 8: Laravel Backend — SSE Proxy & Service Update

**Files:**
- Modify: `backend/app/Services/Profiler/SourceProfilerService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/SourceProfilerController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Update SourceProfilerService to use async scan + result fetch**

Replace the `scan()` method in `backend/app/Services/Profiler/SourceProfilerService.php`:

```php
<?php
// Change the property name and constructor to use blackrabbit
private string $blackRabbitUrl;

public function __construct(
    private readonly PiiDetectionService $piiDetectionService,
) {
    $this->blackRabbitUrl = rtrim(
        config('services.blackrabbit.url', config('services.whiterabbit.url', 'http://blackrabbit:8090')),
        '/'
    );
}

/**
 * Start a scan and return the scan_id for SSE progress tracking.
 *
 * @param  list<string>|null  $tables
 */
public function startScan(Source $source, ?array $tables = null, int $sampleRows = 100000): string
{
    $source->loadMissing('daimons');

    $hadesSpec = HadesBridgeService::buildSourceSpec($source);
    $payload = [
        'dbms' => $hadesSpec['dbms'] ?? 'postgresql',
        'server' => $hadesSpec['server'] ?? '',
        'port' => (int) ($hadesSpec['port'] ?? 5432),
        'user' => $hadesSpec['user'] ?? '',
        'password' => $hadesSpec['password'] ?? '',
        'schema' => $hadesSpec['cdm_schema'] ?? 'public',
        'rows_per_table' => $sampleRows,
    ];

    if ($tables) {
        $payload['tables'] = $tables;
    }

    Log::info('BlackRabbit scan started', ['source_id' => $source->id]);

    $response = Http::timeout(30)->post("{$this->blackRabbitUrl}/scan", $payload);

    if ($response->failed()) {
        throw new \RuntimeException(
            'BlackRabbit scan failed to start: ' . ($response->json('detail') ?? $response->body())
        );
    }

    return $response->json('scan_id');
}

/**
 * Get the SSE progress stream URL for a scan.
 */
public function progressUrl(string $scanId): string
{
    return "{$this->blackRabbitUrl}/scan/{$scanId}";
}

/**
 * Fetch the completed scan result and persist it.
 */
public function fetchAndPersist(Source $source, string $scanId): SourceProfile
{
    $startTime = microtime(true);

    $response = Http::timeout(1200)->get("{$this->blackRabbitUrl}/scan/{$scanId}/result");

    if ($response->failed()) {
        throw new \RuntimeException(
            'BlackRabbit result fetch failed: ' . ($response->json('detail') ?? $response->body())
        );
    }

    $scanData = $response->json();
    $elapsed = $scanData['scan_time_seconds'] ?? round(microtime(true) - $startTime, 3);

    return $this->persistResults($source, $scanData, $elapsed);
}

/**
 * Legacy synchronous scan (kept for backward compatibility).
 *
 * @param  list<string>|null  $tables
 */
public function scan(Source $source, ?array $tables = null, int $sampleRows = 100000): SourceProfile
{
    $scanId = $this->startScan($source, $tables, $sampleRows);

    // Poll until complete
    $maxWait = 1200;
    $waited = 0;
    while ($waited < $maxWait) {
        usleep(500_000); // 500ms
        $waited += 0.5;

        $response = Http::timeout(10)->get("{$this->blackRabbitUrl}/scan/{$scanId}/result");
        if ($response->status() === 404) {
            continue; // Still running
        }
        if ($response->successful()) {
            $scanData = $response->json();
            $elapsed = $scanData['scan_time_seconds'] ?? $waited;

            return $this->persistResults($source, $scanData, $elapsed);
        }
        if ($response->status() === 410) {
            throw new \RuntimeException('Scan expired before result could be fetched');
        }
    }

    throw new \RuntimeException('Scan timed out after ' . $maxWait . ' seconds');
}
```

- [ ] **Step 2: Add SSE stream endpoint to SourceProfilerController**

Add this method to `backend/app/Http/Controllers/Api/V1/SourceProfilerController.php`:

```php
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * POST /sources/{source}/scan-profiles/scan-async
 *
 * Start a scan and return scan_id for SSE progress tracking.
 */
public function scanAsync(RunScanRequest $request, Source $source): JsonResponse
{
    try {
        $scanId = $this->profilerService->startScan(
            $source,
            $request->input('tables'),
            $request->integer('sample_rows', 100000),
        );

        return response()->json([
            'data' => ['scan_id' => $scanId, 'source_id' => $source->id],
            'message' => 'Scan started.',
        ]);
    } catch (\Throwable $e) {
        Log::error('Profiler async scan request failed', [
            'source_id' => $source->id,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'error' => 'Scan failed to start',
            'message' => $e->getMessage(),
        ], 502);
    }
}

/**
 * GET /sources/{source}/scan-profiles/scan-progress/{scanId}
 *
 * Proxy SSE stream from BlackRabbit to the frontend.
 */
public function scanProgress(Source $source, string $scanId): StreamedResponse
{
    $url = $this->profilerService->progressUrl($scanId);

    return new StreamedResponse(function () use ($url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Accept: text/event-stream'],
            CURLOPT_WRITEFUNCTION => function ($ch, $data) {
                echo $data;
                ob_flush();
                flush();

                return strlen($data);
            },
            CURLOPT_TIMEOUT => 1200,
        ]);
        curl_exec($ch);
        curl_close($ch);
    }, 200, [
        'Content-Type' => 'text/event-stream',
        'Cache-Control' => 'no-cache',
        'Connection' => 'keep-alive',
        'X-Accel-Buffering' => 'no',
    ]);
}

/**
 * POST /sources/{source}/scan-profiles/scan-complete/{scanId}
 *
 * Fetch scan result from BlackRabbit and persist.
 */
public function scanComplete(Request $request, Source $source, string $scanId): JsonResponse
{
    try {
        $profile = $this->profilerService->fetchAndPersist($source, $scanId);

        return response()->json([
            'data' => $profile->only([
                'id', 'source_id', 'overall_grade', 'table_count',
                'column_count', 'total_rows', 'scan_time_seconds', 'summary_json',
            ]),
            'message' => 'Scan completed and saved.',
        ], 201);
    } catch (\Throwable $e) {
        Log::error('Profiler scan complete failed', [
            'source_id' => $source->id,
            'scan_id' => $scanId,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'error' => 'Failed to persist scan results',
            'message' => $e->getMessage(),
        ], 502);
    }
}
```

- [ ] **Step 3: Add routes in backend/routes/api.php**

Inside the existing `sources/{source}/scan-profiles` group, add:

```php
Route::post('/scan-async', [SourceProfilerController::class, 'scanAsync'])
    ->middleware(['permission:profiler.scan', 'throttle:3,10']);
Route::get('/scan-progress/{scanId}', [SourceProfilerController::class, 'scanProgress'])
    ->middleware('permission:profiler.scan');
Route::post('/scan-complete/{scanId}', [SourceProfilerController::class, 'scanComplete'])
    ->middleware('permission:profiler.scan');
```

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Profiler/SourceProfilerService.php backend/app/Http/Controllers/Api/V1/SourceProfilerController.php backend/routes/api.php
git commit -m "feat(blackrabbit): add SSE proxy, async scan, and result fetch to Laravel backend"
```

---

### Task 9: Frontend — SSE Progress Hook & Updated ScanProgressIndicator

**Files:**
- Modify: `frontend/src/features/etl/api.ts`
- Modify: `frontend/src/features/etl/hooks/useProfilerData.ts`
- Modify: `frontend/src/features/etl/components/ScanProgressIndicator.tsx`
- Modify: `frontend/src/features/etl/pages/SourceProfilerPage.tsx`

- [ ] **Step 1: Add SSE types and API functions to api.ts**

Add these types and functions to `frontend/src/features/etl/api.ts`:

```typescript
// --- SSE Progress types ---
export interface ScanProgressEvent {
  event: string;
  scan_id?: string;
  total_tables?: number;
  table?: string;
  index?: number;
  of?: number;
  rows?: number;
  columns?: number;
  elapsed_ms?: number;
  total_elapsed_ms?: number;
  succeeded?: number;
  failed?: number;
  message?: string;
}

export async function startAsyncScan(
  sourceId: number,
  request: { tables?: string[]; sample_rows?: number },
): Promise<{ scan_id: string; source_id: number }> {
  const { data } = await apiClient.post<{ data: { scan_id: string; source_id: number } }>(
    `/sources/${sourceId}/scan-profiles/scan-async`,
    request,
  );
  return data.data;
}

export function subscribeScanProgress(
  sourceId: number,
  scanId: string,
  onEvent: (event: ScanProgressEvent) => void,
  onDone: () => void,
  onError: (error: Event) => void,
): () => void {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  const token = localStorage.getItem("auth_token") ?? "";
  const url = `${baseUrl}/sources/${sourceId}/scan-profiles/scan-progress/${scanId}?token=${token}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const parsed: ScanProgressEvent = JSON.parse(e.data);
      onEvent(parsed);
      if (parsed.event === "completed" || parsed.event === "completed_with_errors") {
        eventSource.close();
        onDone();
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = (e) => {
    eventSource.close();
    onError(e);
  };

  return () => eventSource.close();
}

export async function completeScan(
  sourceId: number,
  scanId: string,
): Promise<ProfileSummary> {
  const { data } = await apiClient.post<{ data: ProfileSummary }>(
    `/sources/${sourceId}/scan-profiles/scan-complete/${scanId}`,
  );
  return data.data;
}
```

- [ ] **Step 2: Add useRunScanWithProgress hook to useProfilerData.ts**

Add to `frontend/src/features/etl/hooks/useProfilerData.ts`:

```typescript
import { useState, useCallback, useRef } from "react";
import {
  // ... existing imports ...
  startAsyncScan,
  subscribeScanProgress,
  completeScan,
  type ScanProgressEvent,
} from "../api";

export interface ScanProgress {
  isScanning: boolean;
  totalTables: number;
  completedTables: number;
  currentTable: string;
  tableResults: Array<{ table: string; rows: number; columns: number; elapsed_ms: number }>;
  errors: Array<{ table: string; message: string }>;
  elapsedMs: number;
}

export function useRunScanWithProgress(sourceId: number) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ScanProgress>({
    isScanning: false,
    totalTables: 0,
    completedTables: 0,
    currentTable: "",
    tableResults: [],
    errors: [],
    elapsedMs: 0,
  });
  const [result, setResult] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const startScan = useCallback(
    async (request: { tables?: string[]; sample_rows?: number }) => {
      setProgress({
        isScanning: true,
        totalTables: 0,
        completedTables: 0,
        currentTable: "Connecting...",
        tableResults: [],
        errors: [],
        elapsedMs: 0,
      });
      setResult(null);
      setError(null);

      try {
        const { scan_id } = await startAsyncScan(sourceId, request);

        unsubRef.current = subscribeScanProgress(
          sourceId,
          scan_id,
          (event: ScanProgressEvent) => {
            setProgress((prev) => {
              switch (event.event) {
                case "started":
                  return { ...prev, totalTables: event.total_tables ?? 0 };
                case "table_started":
                  return { ...prev, currentTable: event.table ?? "" };
                case "table_done":
                  return {
                    ...prev,
                    completedTables: event.index ?? prev.completedTables,
                    elapsedMs: event.elapsed_ms ? prev.elapsedMs + event.elapsed_ms : prev.elapsedMs,
                    tableResults: [
                      ...prev.tableResults,
                      {
                        table: event.table ?? "",
                        rows: event.rows ?? 0,
                        columns: event.columns ?? 0,
                        elapsed_ms: event.elapsed_ms ?? 0,
                      },
                    ],
                  };
                case "error":
                  return {
                    ...prev,
                    errors: [...prev.errors, { table: event.table ?? "", message: event.message ?? "" }],
                  };
                case "completed":
                case "completed_with_errors":
                  return { ...prev, isScanning: false, elapsedMs: event.total_elapsed_ms ?? prev.elapsedMs };
                default:
                  return prev;
              }
            });
          },
          async () => {
            // SSE done — fetch and persist result
            try {
              const profile = await completeScan(sourceId, scan_id);
              setResult(profile);
              queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to persist scan results");
            }
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
          () => {
            setError("Lost connection to scan progress stream");
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start scan");
        setProgress((prev) => ({ ...prev, isScanning: false }));
      }
    },
    [sourceId, queryClient],
  );

  const cancel = useCallback(() => {
    unsubRef.current?.();
    setProgress((prev) => ({ ...prev, isScanning: false }));
  }, []);

  return { startScan, cancel, progress, result, error };
}
```

- [ ] **Step 3: Replace ScanProgressIndicator with real SSE progress**

Replace the entire contents of `frontend/src/features/etl/components/ScanProgressIndicator.tsx`:

```tsx
import { type ScanProgress } from "../hooks/useProfilerData";

interface ScanProgressIndicatorProps {
  progress: ScanProgress;
  onCancel: () => void;
}

export default function ScanProgressIndicator({
  progress,
  onCancel,
}: ScanProgressIndicatorProps) {
  if (!progress.isScanning && progress.totalTables === 0) return null;

  const pct = progress.totalTables > 0
    ? Math.round((progress.completedTables / progress.totalTables) * 100)
    : 0;

  const elapsedSec = Math.round(progress.elapsedMs / 1000);
  const totalRows = progress.tableResults.reduce((sum, t) => sum + t.rows, 0);
  const totalCols = progress.tableResults.reduce((sum, t) => sum + t.columns, 0);

  return (
    <div className="bg-[#0E0E11]/90 backdrop-blur-sm rounded-xl border border-[#2a2a3e] p-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-[#F0EDE8]">
            {progress.isScanning ? progress.currentTable : "Scan complete"}
          </span>
          <span className="text-sm font-mono text-[#8A857D]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#232328] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2DD4BF] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Tables", value: `${progress.completedTables} / ${progress.totalTables}` },
          { label: "Columns", value: totalCols.toLocaleString() },
          { label: "Rows", value: totalRows.toLocaleString() },
          { label: "Elapsed", value: `${elapsedSec}s` },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-sm font-semibold text-[#F0EDE8] font-mono">{s.value}</div>
            <div className="text-xs text-[#5A5650]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completed tables list */}
      {progress.tableResults.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg bg-[#151518] border border-[#232328] mb-4">
          <div className="divide-y divide-[#1E1E23]">
            {progress.tableResults.map((t) => (
              <div key={t.table} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-[#C5C0B8] truncate">{t.table}</span>
                <span className="text-[#5A5650] font-mono shrink-0 ml-2">
                  {t.rows.toLocaleString()} rows &middot; {t.elapsed_ms}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="mb-4 rounded-lg bg-[#E85A6B]/10 border border-[#E85A6B]/30 px-3 py-2">
          <p className="text-xs font-medium text-[#E85A6B] mb-1">
            {progress.errors.length} table(s) failed
          </p>
          {progress.errors.map((e) => (
            <p key={e.table} className="text-xs text-[#E85A6B]/70 truncate">
              {e.table}: {e.message}
            </p>
          ))}
        </div>
      )}

      {/* Cancel button */}
      {progress.isScanning && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[#8A857D] hover:text-[#F0EDE8] border border-[#323238] rounded-md px-4 py-1.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update SourceProfilerPage to use new progress hook**

In `frontend/src/features/etl/pages/SourceProfilerPage.tsx`, replace the `scanMutation` usage with `useRunScanWithProgress`:

Change imports:
```typescript
import { useProfileHistory, useRunScanWithProgress, useDeleteProfile, useComparison } from "../hooks/useProfilerData";
```

Replace `const scanMutation = useRunScan(sourceIdNum);` with:
```typescript
const { startScan, cancel: cancelScan, progress: scanProgress, result: scanResult, error: scanError } = useRunScanWithProgress(sourceIdNum);
```

Update the scan trigger to call `startScan()` instead of `scanMutation.mutate()`.

Update `<ScanProgressIndicator>` props from `isScanning={scanMutation.isPending}` to `progress={scanProgress}`.

Update `onCancel` to use `cancelScan`.

- [ ] **Step 5: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 6: Deploy and verify**

```bash
./deploy.sh --php --frontend
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/etl/api.ts frontend/src/features/etl/hooks/useProfilerData.ts frontend/src/features/etl/components/ScanProgressIndicator.tsx frontend/src/features/etl/pages/SourceProfilerPage.tsx
git commit -m "feat(blackrabbit): add SSE progress hook and real-time scan progress indicator"
```

---

### Task 10: System Health Integration

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php`

- [ ] **Step 1: Add BlackRabbit health check to SystemHealthController**

In the `__construct()` `$this->checkers` array, replace the `'whiterabbit'` entry (if it exists) or add:

```php
'blackrabbit' => fn () => $this->checkBlackRabbit(),
```

Update `getLogsForService` and `getMetricsForService` match statements to include `'blackrabbit'`.

Add the check method:

```php
private function checkBlackRabbit(): array
{
    $url = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

    try {
        $response = Http::timeout(5)->get("{$url}/health");

        if ($response->successful()) {
            $data = $response->json();
            $available = $data['dialects_available'] ?? 0;
            $total = $data['dialects_total'] ?? 12;

            return [
                'name' => 'BlackRabbit',
                'key' => 'blackrabbit',
                'status' => 'healthy',
                'message' => "Python {$data['python_version']}, {$available}/{$total} dialects available.",
            ];
        }

        return [
            'name' => 'BlackRabbit',
            'key' => 'blackrabbit',
            'status' => 'degraded',
            'message' => "BlackRabbit returned HTTP {$response->status()}.",
        ];
    } catch (\Throwable $e) {
        return [
            'name' => 'BlackRabbit',
            'key' => 'blackrabbit',
            'status' => 'down',
            'message' => $e->getMessage(),
        ];
    }
}
```

Add metrics method:

```php
private function getBlackRabbitMetrics(): array
{
    $url = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

    try {
        $healthResp = Http::timeout(5)->get("{$url}/health");
        $dialectsResp = Http::timeout(5)->get("{$url}/dialects");

        $metrics = $healthResp->successful() ? ($healthResp->json() ?? []) : [];

        if ($dialectsResp->successful()) {
            $dialects = $dialectsResp->json() ?? [];
            $metrics['dialects'] = [];
            foreach ($dialects as $d) {
                $metrics['dialects'][$d['name']] = $d['installed'] ? ($d['version'] ?? 'installed') : 'not installed';
            }
        }

        return $metrics;
    } catch (\Throwable) {
        return [];
    }
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Deploy and verify health panel**

```bash
./deploy.sh --php
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/api/v1/admin/system-health/blackrabbit | python3 -m json.tool
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php
git commit -m "feat(blackrabbit): add System Health panel with dialect version display"
```

---

### Task 11: Remove WhiteRabbit & Final Cleanup

**Files:**
- Delete: `docker/whiterabbit/` directory
- Modify: `backend/app/Http/Controllers/Api/V1/WhiteRabbitController.php` — deprecate or redirect
- Modify: `backend/routes/api.php` — update ETL scan routes

- [ ] **Step 1: Remove WhiteRabbit Docker files**

```bash
rm -rf docker/whiterabbit/
```

- [ ] **Step 2: Update WhiteRabbitController to proxy to BlackRabbit**

Update the `$whiteRabbitUrl` in `WhiteRabbitController.php` to read from the blackrabbit config:

```php
$this->whiteRabbitUrl = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');
```

This keeps the legacy `/etl/scan` endpoint working for any external consumers while pointing at the new service.

- [ ] **Step 3: Run all checks**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
cd blackrabbit && python -m pytest tests/ -v
```

- [ ] **Step 4: Deploy full stack**

```bash
./deploy.sh
```

- [ ] **Step 5: Run a scan through the UI to verify end-to-end**

Navigate to ETL Tools > Source Profiler, select a source, click Scan. Verify:
- Real progress bar with table-by-table updates
- Completed tables list with row counts and timing
- Final result persists and appears in scan history

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(blackrabbit): remove WhiteRabbit, redirect legacy endpoints to BlackRabbit"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Models & Config | Pydantic models, settings, scan store, test fixtures |
| 2 | ConnectionFactory | 12-dialect registry, URL builder, engine creation |
| 3 | SchemaInspector | Table/column enumeration via SQLAlchemy reflection |
| 4 | ColumnProfiler | Single-pass aggregate queries with type-specific extras |
| 5 | ResultAssembler | Orchestrates inspect + profile with progress events |
| 6 | FastAPI Routers | /health, /dialects, /scan, SSE progress, /result |
| 7 | Docker & Compose | Dockerfile, docker-compose, Laravel config |
| 8 | Laravel Backend | SSE proxy, async scan start, result fetch + persist |
| 9 | Frontend SSE | Progress hook, real-time indicator, page wiring |
| 10 | System Health | BlackRabbit panel with dialect versions |
| 11 | Cleanup | Remove WhiteRabbit, redirect legacy endpoints |
