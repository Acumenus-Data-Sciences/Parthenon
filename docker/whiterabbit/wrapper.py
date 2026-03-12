#!/usr/bin/env python3
"""
Minimal HTTP wrapper for the WhiteRabbit CLI (OHDSI database profiler).

Exposes two endpoints:
  GET  /health  — liveness probe
  POST /scan    — run a WhiteRabbit source scan and return JSON results

The wrapper writes a temporary INI file, invokes the appassembler-generated
launcher at /app/dist/bin/whiteRabbit, reads the resulting ScanReport.xlsx
with the stdlib zipfile/xml modules (xlsx is a ZIP of XML), and converts the
spreadsheet rows into a structured JSON payload.

No third-party dependencies are required — only the Python 3 standard library.
"""

import csv
import io
import json
import logging
import os
import subprocess
import sys
import tempfile
import traceback
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("whiterabbit-wrapper")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LAUNCHER = "/app/dist/bin/whiteRabbit"
PORT = int(os.environ.get("WRAPPER_PORT", "8090"))
SCAN_REPORT_NAME = "ScanReport.xlsx"

# OOXML namespace used throughout .xlsx XML
_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


# ---------------------------------------------------------------------------
# XLSX parsing (stdlib only — xlsx = ZIP of XML files)
# ---------------------------------------------------------------------------

def _xlsx_cell_value(cell_el: ET.Element, shared_strings: list[str]) -> str:
    """Return the string value of a single <c> element."""
    t = cell_el.get("t", "")          # cell type attribute
    v_el = cell_el.find(f"{{{_NS}}}v")
    f_el = cell_el.find(f"{{{_NS}}}f")

    if v_el is None and f_el is None:
        return ""

    raw = (v_el.text or "") if v_el is not None else ""

    if t == "s":
        # Shared string index
        try:
            return shared_strings[int(raw)]
        except (IndexError, ValueError):
            return raw
    elif t == "b":
        return "TRUE" if raw == "1" else "FALSE"
    elif t == "inlineStr":
        is_el = cell_el.find(f"{{{_NS}}}is")
        if is_el is not None:
            t_el = is_el.find(f"{{{_NS}}}t")
            return (t_el.text or "") if t_el is not None else ""
        return raw
    else:
        return raw


def _parse_xlsx(path: Path) -> dict[str, list[list[str]]]:
    """
    Parse an .xlsx workbook and return a dict of:
        { sheet_name: [[row0_col0, row0_col1, ...], [row1_col0, ...], ...] }
    """
    sheets: dict[str, list[list[str]]] = {}

    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()

        # 1. Shared strings table (optional — not all xlsx have it)
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in names:
            with zf.open("xl/sharedStrings.xml") as fh:
                ss_tree = ET.parse(fh)
            for si in ss_tree.findall(f".//{{{_NS}}}si"):
                # Concatenate all <t> fragments within an <si>
                text = "".join(
                    (t.text or "") for t in si.findall(f".//{{{_NS}}}t")
                )
                shared_strings.append(text)

        # 2. Workbook relationships → map rId to sheet file paths
        rel_map: dict[str, str] = {}
        if "xl/_rels/workbook.xml.rels" in names:
            with zf.open("xl/_rels/workbook.xml.rels") as fh:
                rel_tree = ET.parse(fh)
            rel_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
            for rel in rel_tree.findall(f"{{{rel_ns}}}Relationship"):
                rel_map[rel.get("Id", "")] = rel.get("Target", "")

        # 3. Workbook → sheet names ordered
        with zf.open("xl/workbook.xml") as fh:
            wb_tree = ET.parse(fh)

        wb_ns = _NS
        for sheet_el in wb_tree.findall(f".//{{{wb_ns}}}sheet"):
            sheet_name = sheet_el.get("name", "Sheet")
            r_id = sheet_el.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id",
                "",
            )
            target = rel_map.get(r_id, "")
            if not target:
                continue

            sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
            if sheet_path not in names:
                continue

            with zf.open(sheet_path) as fh:
                sheet_tree = ET.parse(fh)

            rows: list[list[str]] = []
            for row_el in sheet_tree.findall(f".//{{{_NS}}}row"):
                cells = row_el.findall(f"{{{_NS}}}c")
                if not cells:
                    continue
                # Determine the maximum column index in this row so we can fill gaps
                row_data: list[str] = []
                prev_col_idx = -1
                for cell_el in cells:
                    ref = cell_el.get("r", "")          # e.g. "C3"
                    # Parse column letter(s) to 0-based index
                    col_str = "".join(ch for ch in ref if ch.isalpha())
                    col_idx = 0
                    for ch in col_str:
                        col_idx = col_idx * 26 + (ord(ch.upper()) - ord("A") + 1)
                    col_idx -= 1  # 0-based

                    # Fill any skipped columns with empty string
                    while prev_col_idx + 1 < col_idx:
                        row_data.append("")
                        prev_col_idx += 1

                    row_data.append(_xlsx_cell_value(cell_el, shared_strings))
                    prev_col_idx = col_idx

                rows.append(row_data)

            sheets[sheet_name] = rows

    return sheets


# ---------------------------------------------------------------------------
# INI file generation
# ---------------------------------------------------------------------------

def _build_ini(config: dict[str, Any], work_dir: str) -> str:
    """
    Render a WhiteRabbit-compatible INI file from the request payload.

    Expected request keys:
        dbms          str   e.g. "postgresql"
        server        str   host/database  e.g. "host.docker.internal/ohdsi"
        port          int   optional; appended to server if provided
        user          str
        password      str
        schema        str   maps to DATABASE_NAME in INI
        tables        list  table names; use ["*"] to scan all
        scan_values   bool  default True
        min_cell_count     int  default 5
        max_distinct_values int default 1000
        rows_per_table     int default 100000
        calc_numeric_stats bool default False
    """
    # Map our dbms names to WhiteRabbit DATA_TYPE labels
    dbms_map = {
        "postgresql": "PostgreSQL",
        "postgres":   "PostgreSQL",
        "mysql":      "MySQL",
        "mssql":      "SQL Server",
        "sqlserver":  "SQL Server",
        "oracle":     "Oracle",
        "redshift":   "Redshift",
        "azure":      "Azure",
        "bigquery":   "BigQuery",
        "snowflake":  "Snowflake",
        "databricks": "Databricks",
    }

    dbms_raw = str(config.get("dbms", "postgresql")).lower()
    data_type = dbms_map.get(dbms_raw, "PostgreSQL")

    server = str(config.get("server", ""))
    port = config.get("port")
    # For PostgreSQL the SERVER_LOCATION must be host/database, e.g. localhost/ohdsi
    # If port is specified we embed it as host:port/database
    if port and "/" in server:
        host, db_part = server.split("/", 1)
        server = f"{host}:{port}/{db_part}"

    tables = config.get("tables", ["*"])
    if isinstance(tables, list):
        tables_str = ",".join(tables) if tables else "*"
    else:
        tables_str = str(tables)

    scan_values = "yes" if config.get("scan_values", True) else "no"
    min_cell = int(config.get("min_cell_count", 5))
    max_distinct = int(config.get("max_distinct_values", 1000))
    rows_per_table = int(config.get("rows_per_table", 100000))
    calc_numeric = "yes" if config.get("calc_numeric_stats", False) else "no"
    numeric_sampler = int(config.get("numeric_stats_sampler_size", 500))

    ini = (
        f"WORKING_FOLDER = {work_dir}\n"
        f"DATA_TYPE = {data_type}\n"
        f"SERVER_LOCATION = {server}\n"
        f"USER_NAME = {config.get('user', '')}\n"
        f"PASSWORD = {config.get('password', '')}\n"
        f"DATABASE_NAME = {config.get('schema', '')}\n"
        f"TABLES_TO_SCAN = {tables_str}\n"
        f"SCAN_FIELD_VALUES = {scan_values}\n"
        f"MIN_CELL_COUNT = {min_cell}\n"
        f"MAX_DISTINCT_VALUES = {max_distinct}\n"
        f"ROWS_PER_TABLE = {rows_per_table}\n"
        f"CALCULATE_NUMERIC_STATS = {calc_numeric}\n"
        f"NUMERIC_STATS_SAMPLER_SIZE = {numeric_sampler}\n"
    )
    return ini


# ---------------------------------------------------------------------------
# Scan execution
# ---------------------------------------------------------------------------

def run_scan(config: dict[str, Any]) -> dict[str, Any]:
    """
    Execute a WhiteRabbit scan and return structured JSON results.

    Returns:
        {
            "status": "ok",
            "tables": [
                {
                    "name": "person",
                    "row_count": 12345,
                    "columns": [
                        {
                            "name": "person_id",
                            "type": "integer",
                            "fraction_empty": 0.0,
                            "unique_count": 12345,
                            "values": [{"value": "...", "frequency": 42}, ...]
                        },
                        ...
                    ]
                },
                ...
            ],
            "stdout": "...",
            "stderr": "..."
        }
    """
    with tempfile.TemporaryDirectory(prefix="wr_scan_") as work_dir:
        # 1. Write INI
        ini_path = os.path.join(work_dir, "whiterabbit.ini")
        with open(ini_path, "w") as fh:
            fh.write(_build_ini(config, work_dir))

        log.info("Running WhiteRabbit scan with INI: %s", ini_path)

        # 2. Run the launcher
        try:
            result = subprocess.run(
                [LAUNCHER, "-ini", ini_path],
                capture_output=True,
                text=True,
                timeout=int(os.environ.get("SCAN_TIMEOUT_SECONDS", "600")),
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "error": "Scan timed out. Increase SCAN_TIMEOUT_SECONDS or reduce ROWS_PER_TABLE.",
            }
        except FileNotFoundError:
            return {
                "status": "error",
                "error": f"WhiteRabbit launcher not found at {LAUNCHER}",
            }

        stdout = result.stdout or ""
        stderr = result.stderr or ""

        log.info("WhiteRabbit exit code: %d", result.returncode)
        if stdout:
            log.debug("stdout: %s", stdout[:2000])
        if stderr:
            log.warning("stderr: %s", stderr[:2000])

        if result.returncode != 0:
            return {
                "status": "error",
                "error": f"WhiteRabbit exited with code {result.returncode}",
                "stdout": stdout,
                "stderr": stderr,
            }

        # 3. Locate the scan report
        report_path = Path(work_dir) / SCAN_REPORT_NAME
        if not report_path.exists():
            return {
                "status": "error",
                "error": f"{SCAN_REPORT_NAME} not found in working directory.",
                "stdout": stdout,
                "stderr": stderr,
            }

        # 4. Parse the xlsx report into structured JSON
        try:
            tables = _parse_scan_report(report_path)
        except Exception:
            return {
                "status": "error",
                "error": "Failed to parse ScanReport.xlsx",
                "detail": traceback.format_exc(),
                "stdout": stdout,
                "stderr": stderr,
            }

        return {
            "status": "ok",
            "tables": tables,
            "stdout": stdout,
            "stderr": stderr,
        }


# ---------------------------------------------------------------------------
# ScanReport.xlsx → structured data
# ---------------------------------------------------------------------------

def _parse_scan_report(report_path: Path) -> list[dict[str, Any]]:
    """
    WhiteRabbit ScanReport.xlsx layout:
        Sheet "Table Overview" — one row per table with row count and column count
        One sheet per table   — columns as rows: name, type, n_rows, fraction_empty, unique_count, [value, freq, ...]

    Returns a list of table profile dicts.
    """
    sheets = _parse_xlsx(report_path)

    # ---- Table overview sheet ----
    overview_rows: list[list[str]] = sheets.get("Table Overview", [])
    table_meta: dict[str, dict[str, Any]] = {}

    if len(overview_rows) > 1:
        header = [h.strip().lower() for h in overview_rows[0]]
        for row in overview_rows[1:]:
            if not row or not row[0]:
                continue
            padded = row + [""] * (len(header) - len(row))
            entry: dict[str, Any] = dict(zip(header, padded))
            table_name = entry.get("table", entry.get("name", row[0])).strip()
            # Common column names WhiteRabbit uses in the overview sheet
            row_count_raw = (
                entry.get("n_rows", "")
                or entry.get("rows", "")
                or entry.get("row count", "")
            )
            col_count_raw = (
                entry.get("n_fields", "")
                or entry.get("columns", "")
                or entry.get("column count", "")
            )
            table_meta[table_name] = {
                "row_count": _to_int(row_count_raw),
                "column_count": _to_int(col_count_raw),
            }

    # ---- Per-table sheets ----
    # WhiteRabbit uses the table name directly as the sheet name.
    # The layout of each table sheet:
    #   Row 0 (header): Field, Type, Max length, N rows, Fraction empty, Unique count, [values...]
    #   Row 1+: one row per column
    # After the column rows there may be a blank row followed by value frequency rows.
    # The exact layout varies by WR version; we handle both formats gracefully.

    tables: list[dict[str, Any]] = []

    for sheet_name, rows in sheets.items():
        if sheet_name == "Table Overview":
            continue
        if not rows:
            continue

        header_row = [h.strip().lower() for h in rows[0]] if rows else []
        if not header_row:
            continue

        # Identify key column indices (tolerant of variations)
        def _col_idx(candidates: list[str]) -> int:
            for c in candidates:
                for i, h in enumerate(header_row):
                    if c in h:
                        return i
            return -1

        idx_field    = _col_idx(["field", "column", "name"])
        idx_type     = _col_idx(["type"])
        idx_nrows    = _col_idx(["n rows", "nrows", "n_rows", "rows"])
        idx_empty    = _col_idx(["fraction empty", "empty"])
        idx_unique   = _col_idx(["unique count", "unique"])

        columns: list[dict[str, Any]] = []

        for row in rows[1:]:
            if not row or (idx_field >= 0 and not _safe_get(row, idx_field)):
                break  # blank row signals end of column block

            col_name = _safe_get(row, idx_field).strip()
            if not col_name:
                break

            col: dict[str, Any] = {"name": col_name}

            if idx_type >= 0:
                col["type"] = _safe_get(row, idx_type).strip()
            if idx_nrows >= 0:
                col["n_rows"] = _to_int(_safe_get(row, idx_nrows))
            if idx_empty >= 0:
                col["fraction_empty"] = _to_float(_safe_get(row, idx_empty))
            if idx_unique >= 0:
                col["unique_count"] = _to_int(_safe_get(row, idx_unique))

            # Value frequency pairs start after unique_count column
            value_start = max(idx_field, idx_type, idx_nrows, idx_empty, idx_unique) + 1
            values: list[dict[str, Any]] = []
            i = value_start
            while i + 1 < len(row):
                val = _safe_get(row, i).strip()
                freq_raw = _safe_get(row, i + 1).strip()
                if val or freq_raw:
                    values.append({"value": val, "frequency": _to_int(freq_raw)})
                i += 2
            if values:
                col["values"] = values

            columns.append(col)

        meta = table_meta.get(sheet_name, {})
        tables.append(
            {
                "name": sheet_name,
                "row_count": meta.get("row_count"),
                "column_count": meta.get("column_count") or len(columns),
                "columns": columns,
            }
        )

    return tables


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_get(lst: list[str], idx: int) -> str:
    try:
        return lst[idx]
    except IndexError:
        return ""


def _to_int(s: Any) -> int | None:
    if s is None:
        return None
    try:
        return int(float(str(s).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def _to_float(s: Any) -> float | None:
    if s is None:
        return None
    try:
        return float(str(s).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: ANN001
        log.info(fmt, *args)

    def send_json(self, code: int, data: Any) -> None:
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length > 0 else b""

    # ------------------------------------------------------------------
    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "whiterabbit"})
        else:
            self.send_json(404, {"error": "not found"})

    # ------------------------------------------------------------------
    def do_POST(self) -> None:
        if self.path == "/scan":
            raw = self.read_body()
            if not raw:
                self.send_json(400, {"error": "empty request body"})
                return

            try:
                config: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError as exc:
                self.send_json(400, {"error": f"invalid JSON: {exc}"})
                return

            # Validate required fields
            missing = [f for f in ("server", "user", "password", "schema") if not config.get(f)]
            if missing:
                self.send_json(400, {"error": f"missing required fields: {', '.join(missing)}"})
                return

            try:
                result = run_scan(config)
            except Exception:
                log.exception("Unhandled error in run_scan")
                self.send_json(500, {"error": "internal error", "detail": traceback.format_exc()})
                return

            status_code = 200 if result.get("status") == "ok" else 500
            self.send_json(status_code, result)

        else:
            self.send_json(404, {"error": "not found"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    log.info("WhiteRabbit HTTP wrapper starting on port %d", PORT)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    log.info("Listening — endpoints: GET /health  POST /scan")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down.")
        server.server_close()
