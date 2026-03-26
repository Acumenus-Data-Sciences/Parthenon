# BlackRabbit — Database Profiling Service Design

**Date:** 2026-03-26
**Status:** Approved
**Replaces:** WhiteRabbit (Java CLI + Python wrapper)

## Overview

BlackRabbit is a purpose-built Python database profiling service that replaces the OHDSI WhiteRabbit Java CLI. It eliminates the Maven build, JVM overhead, and XLSX-to-JSON conversion pipeline by connecting directly to source databases via SQLAlchemy and returning structured JSON over a FastAPI HTTP interface.

The name follows the Darkstar precedent — a native Parthenon service replacing a wrapped external tool, maintaining compatibility while dramatically improving performance, build simplicity, and observability.

## Motivation

- **Build fragility:** WhiteRabbit requires a multi-stage Dockerfile that clones a GitHub repo, runs Maven with mirror workarounds, and bundles a JRE. Build failures from transient Maven repository issues are common.
- **Performance:** Sequential single-column profiling through a Java CLI that writes XLSX to disk, then a Python wrapper parses it. A 50-table schema takes 4+ minutes.
- **No progress visibility:** The frontend fakes progress with timed phases. No real telemetry from the scan engine.

## Architecture

```
BlackRabbit (Docker @ :8090)
+----- FastAPI HTTP layer
|   GET  /health          -- liveness + dialect availability
|   POST /scan            -- kick off database profile, returns scan_id
|   GET  /scan/{id}       -- SSE progress stream
|   GET  /scan/{id}/result -- final JSON result
|   GET  /dialects        -- list supported dialects + driver status
|
+----- Profiling engine
|   ConnectionFactory     -- builds SQLAlchemy engines per dialect
|   SchemaInspector       -- enumerates tables/columns via reflection
|   ColumnProfiler        -- runs profiling queries per column type
|   ResultAssembler       -- structures output JSON
|
+----- SQLAlchemy dialect drivers (12 HADES dialects)
```

### HTTP Contract

**POST /scan** — Kicks off a scan. Returns immediately with a `scan_id`.

Request payload (identical to current WhiteRabbit wrapper):
```json
{
  "dbms": "postgresql",
  "server": "host/database",
  "port": 5432,
  "user": "username",
  "password": "password",
  "schema": "omop",
  "tables": ["person", "visit_occurrence"],
  "scan_values": true,
  "min_cell_count": 5,
  "max_distinct_values": 1000,
  "rows_per_table": 100000,
  "concurrency": 4
}
```

Response:
```json
{"scan_id": "abc123"}
```

**GET /scan/{id}** — Server-Sent Events progress stream.

Events:
```json
{"event": "started", "total_tables": 47, "scan_id": "abc123"}
{"event": "table_started", "table": "person", "index": 1, "of": 47}
{"event": "table_done", "table": "person", "index": 1, "of": 47, "rows": 1089382, "columns": 18, "elapsed_ms": 820}
{"event": "error", "table": "note_nlp", "message": "permission denied for relation note_nlp"}
{"event": "completed", "tables": 47, "columns": 512, "total_elapsed_ms": 38200}
```

On partial failure:
```json
{"event": "completed_with_errors", "tables": 47, "succeeded": 45, "failed": 2}
```

**GET /scan/{id}/result** — Final JSON result. Available after `completed` or `completed_with_errors` event. Returns 404 if scan is still running, 410 if result has expired (results held in memory for 30 minutes).

**GET /health** — Liveness probe. Returns service version, Python version, available dialects.

**GET /dialects** — Lists all 12 supported dialects with driver import status (installed/missing).

### Backend Integration

The Laravel `SourceProfilerService` changes minimally:

1. `POST /scan` to BlackRabbit, receive `scan_id`
2. Proxy SSE stream from `GET /scan/{id}` to frontend via `StreamedResponse`
3. On completion, fetch `GET /scan/{id}/result` and persist to `source_profiles` / `field_profiles`

The `SourceProfilerController` adds a new endpoint for the SSE proxy. All existing endpoints (history, show, compare, delete) are unchanged.

### Frontend Integration

The `ScanProgressIndicator` component is replaced with a real progress display:

- Subscribes to SSE stream via `EventSource`
- Real progress bar: `index / total_tables` percentage
- Live table list showing scanned tables with row counts and per-table timing
- Current table name displayed during scan
- Running totals of columns and rows profiled
- Error count badge for failed tables (scan continues)
- Real elapsed time

The rest of the `SourceProfilerPage` is unchanged — it receives the same result shape.

## Dialect Support

All 12 HADES dialects:

| HADES Dialect | SQLAlchemy URL Scheme | Python Driver |
|---|---|---|
| PostgreSQL | `postgresql+psycopg` | psycopg3 |
| SQL Server | `mssql+pyodbc` | pyodbc |
| Oracle | `oracle+oracledb` | python-oracledb |
| MySQL | `mysql+pymysql` | PyMySQL |
| MariaDB | `mariadb+pymysql` | PyMySQL |
| BigQuery | `bigquery://` | sqlalchemy-bigquery |
| Redshift | `redshift+psycopg2` | sqlalchemy-redshift |
| Snowflake | `snowflake://` | snowflake-sqlalchemy |
| Spark / Databricks | `databricks://` | databricks-sql-connector |
| DuckDB | `duckdb:///` | duckdb-engine |
| SQLite | `sqlite:///` | stdlib (built-in) |
| Synapse | `mssql+pyodbc` | pyodbc (same driver, different connection string) |

The `ConnectionFactory` maps the `dbms` string from the request payload to the appropriate SQLAlchemy URL scheme and builds an engine. Connection pooling is disabled — each scan creates a connection, profiles, and disposes.

The `/dialects` endpoint reports which drivers are installed and importable, allowing the frontend to grey out unavailable options.

## Profiling Output

### All columns (WhiteRabbit parity)
- `row_count`, `non_null_count`, `null_count`, `null_percentage`
- `distinct_count`, `distinct_percentage`
- `inferred_type` — normalized to: string, integer, float, decimal, boolean, date, datetime, timestamp, binary, unknown
- `top_values` — top N most frequent values with counts (default 20, configurable)
- `sample_values` — random sample for display

### Numeric columns (new)
- `min`, `max`, `mean`, `median`, `stddev`

### String columns (new)
- `min_length`, `max_length`, `avg_length`
- `empty_string_count` (distinct from null)

### Date/datetime columns (new)
- `min_date`, `max_date`
- `date_span_days`

New fields are additional keys on the column object. The existing `field_profiles` table ignores unknown fields until migrations add the new columns. Day-one deployment is a drop-in swap.

## Scan Execution

### Per-table parallelism
Multiple tables scanned concurrently using `asyncio` with `run_in_executor` for sync-only drivers. Default concurrency: 4 tables, configurable via `concurrency` parameter.

### Single-query-per-table core stats
One aggregate query per table computes all column statistics in a single pass:

```sql
SELECT
  COUNT(*) AS row_count,
  COUNT(*) - COUNT(col_a) AS col_a_nulls,
  COUNT(DISTINCT col_a) AS col_a_distinct,
  MIN(col_a), MAX(col_a),
  AVG(col_b), STDDEV(col_b),
  MIN(LENGTH(col_c)), MAX(LENGTH(col_c)), AVG(LENGTH(col_c))
FROM schema.table_name
```

Top-N value frequencies require separate `GROUP BY` queries per column, run in parallel within each table's task.

### Row sampling
For large tables, uses `TABLESAMPLE SYSTEM` on PostgreSQL (and dialect equivalents) rather than `ORDER BY RANDOM()`. Dialects without native sampling fall back to unordered `LIMIT` with a warning in the response.

### Expected performance
Parallel single-pass SQL vs sequential single-column Java CLI + XLSX + JSON pipeline: ~5-10x improvement. A 50-table schema scan drops from ~4 minutes to under 1 minute.

### Timeouts
- Container-level: 1200s (docker-compose `SCAN_TIMEOUT_SECONDS`)
- Per-table: 300s default, configurable
- Results held in memory: 30 minutes, then discarded

## Dockerfile

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc-dev gcc g++ curl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system blackrabbit && \
    adduser --system --ingroup blackrabbit blackrabbit

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY blackrabbit/ .
RUN chown -R blackrabbit:blackrabbit /app

USER blackrabbit
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8090/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
```

No Maven, no JDK, no external repo clones. Build time: ~30 seconds vs ~5 minutes.

## Docker Compose

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
    - SCAN_TIMEOUT_SECONDS=${SCAN_TIMEOUT_SECONDS:-1200}
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

Memory limit drops from 4G to 2G (no JVM heap). Same port, same env vars — the `whiterabbit` service in docker-compose.yml is replaced by `blackrabbit`.

## Migration Path

1. Build and deploy BlackRabbit alongside WhiteRabbit (different container name, same port on a different host port for testing)
2. Verify scan parity — run the same scan against both, compare output
3. Swap docker-compose service: rename `whiterabbit` to `blackrabbit`, point to new Dockerfile
4. Update `WHITERABBIT_URL` env var (or add `BLACKRABBIT_URL` and update `services.php`)
5. Remove `docker/whiterabbit/` directory
6. Update `ScanProgressIndicator` to use SSE
7. Add new stat columns to `field_profiles` migration
8. Update frontend to display new stats

Steps 1-5 are the drop-in swap (zero frontend/backend code changes). Steps 6-8 are follow-up enhancements.

## System Health Integration

BlackRabbit gets a panel in the System Health admin page, replacing the current WhiteRabbit entry:
- Service name: "BlackRabbit"
- Key: `blackrabbit`
- Health check shows: service version, Python version, available dialect count
- Detail page shows: all 12 dialects with driver versions and install status

## File Structure

```
blackrabbit/
  app/
    main.py              -- FastAPI app, endpoints
    config.py            -- Settings (timeouts, defaults)
    models.py            -- Pydantic request/response models
    engine/
      connection.py      -- ConnectionFactory (dbms -> SQLAlchemy engine)
      inspector.py       -- SchemaInspector (table/column enumeration)
      profiler.py        -- ColumnProfiler (stat queries by type)
      assembler.py       -- ResultAssembler (structures JSON output)
      sampling.py        -- Dialect-aware row sampling strategies
    dialects/
      __init__.py        -- Dialect registry
      postgresql.py      -- PG-specific optimizations (TABLESAMPLE, etc.)
      sqlserver.py       -- SQL Server specifics
      ...                -- One file per dialect where needed
  requirements.txt
  Dockerfile             -- (also at docker/blackrabbit/Dockerfile)
```

## What Does NOT Change

- `SourceProfilerController` endpoints (history, show, compare, delete)
- `SourceProfilerService` persistence logic
- `PiiDetectionService` (runs after scan, same as today)
- `ScanComparisonService` (compares persisted profiles, same as today)
- `source_profiles` and `field_profiles` table schemas (new columns added, none removed)
- Frontend `SourceProfilerPage` layout and all visualization components
- RBAC permissions (`profiler.view`, `profiler.scan`, `profiler.delete`)
- Rate limiting on scan endpoint
