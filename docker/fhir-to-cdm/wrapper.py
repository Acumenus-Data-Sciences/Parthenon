#!/usr/bin/env python3
"""
Minimal HTTP wrapper for the OHDSI FhirToCdm CLI tool.

Exposes:
  GET  /health   — liveness probe
  POST /ingest   — accepts a FHIR R4 Bundle (JSON), converts to OMOP CDM records
  POST /batch    — accepts FHIR NDJSON (one resource per line), processes each entry
"""

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("fhir-to-cdm")

# ---------------------------------------------------------------------------
# Configuration (from environment variables)
# ---------------------------------------------------------------------------
HOST = os.environ.get("WRAPPER_HOST", "0.0.0.0")
PORT = int(os.environ.get("WRAPPER_PORT", "8091"))

PG_HOST = os.environ.get("PG_HOST", "host.docker.internal")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_DATABASE = os.environ.get("PG_DATABASE", "ohdsi")
PG_USER = os.environ.get("PG_USER", "smudoshi")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "")

CDM_SCHEMA = os.environ.get("CDM_SCHEMA", "cdm")
VOCAB_SCHEMA = os.environ.get("VOCAB_SCHEMA", "omop")

# Absolute path to the published .NET CLI binary
DOTNET_BINARY = os.environ.get("FHIR_CDM_BINARY", "/app/dotnet/FHIRtoCDM")

# Directories for transient file I/O (tmpfs-friendly)
FHIR_INPUT_DIR = Path(os.environ.get("FHIR_INPUT_DIR", "/tmp/fhir_input"))
CDM_OUTPUT_DIR = Path(os.environ.get("CDM_OUTPUT_DIR", "/tmp/cdm_output"))

FHIR_INPUT_DIR.mkdir(parents=True, exist_ok=True)
CDM_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Timeout for a single FhirToCdm invocation (seconds)
PROCESS_TIMEOUT = int(os.environ.get("FHIR_CDM_TIMEOUT", "300"))

# Start time for uptime reporting
_START_TIME = time.time()


# ---------------------------------------------------------------------------
# FhirToCdm invocation helpers
# ---------------------------------------------------------------------------

def _build_connection_string() -> str:
    """Build a PostgreSQL connection string from environment variables."""
    pw_part = f":{PG_PASSWORD}" if PG_PASSWORD else ""
    return (
        f"Server={PG_HOST};Port={PG_PORT};"
        f"Database={PG_DATABASE};"
        f"User Id={PG_USER};Password={PG_PASSWORD};"
        f"SearchPath={CDM_SCHEMA}"
    )


def _run_fhir_to_cdm(input_dir: Path, output_dir: Path) -> dict[str, Any]:
    """
    Invoke the FhirToCdm .NET CLI with the given input/output directories.

    FhirToCdm CLI arguments (from OHDSI/FhirToCdm README):
      --input-dir   <path>    Directory containing FHIR JSON files
      --output-dir  <path>    Directory for CDM CSV output (or directly to PG)
      --cdm-schema  <schema>
      --vocab-schema <schema>
      --connection-string <pg-conn>

    Returns a summary dict with stdout/stderr and record counts.
    """
    cmd = [
        DOTNET_BINARY,
        "--input-dir", str(input_dir),
        "--output-dir", str(output_dir),
        "--cdm-schema", CDM_SCHEMA,
        "--vocab-schema", VOCAB_SCHEMA,
        "--connection-string", _build_connection_string(),
    ]

    log.info("Invoking FhirToCdm: %s", " ".join(cmd[:-1] + ["--connection-string", "<redacted>"]))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=PROCESS_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"FhirToCdm timed out after {PROCESS_TIMEOUT}s",
            "stdout": "",
            "stderr": "",
            "records": {},
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": f"FhirToCdm binary not found at {DOTNET_BINARY}",
            "stdout": "",
            "stderr": "",
            "records": {},
        }

    success = result.returncode == 0
    records = _parse_output_records(output_dir)

    return {
        "success": success,
        "return_code": result.returncode,
        "stdout": result.stdout[-4096:] if result.stdout else "",
        "stderr": result.stderr[-4096:] if result.stderr else "",
        "records": records,
    }


def _parse_output_records(output_dir: Path) -> dict[str, int]:
    """
    Count rows in any CSV files written to output_dir by FhirToCdm.
    Each CSV corresponds to one OMOP CDM table.
    """
    counts: dict[str, int] = {}
    for csv_path in output_dir.glob("*.csv"):
        table_name = csv_path.stem.lower()
        try:
            with csv_path.open() as fh:
                # Subtract 1 for the header row; guard against empty files
                line_count = sum(1 for _ in fh) - 1
                counts[table_name] = max(line_count, 0)
        except OSError:
            counts[table_name] = -1
    return counts


def _write_bundle_to_dir(bundle: dict[str, Any], work_dir: Path) -> int:
    """
    Write individual FHIR resources from a Bundle to separate JSON files.
    Returns the number of resources written.
    """
    entries = bundle.get("entry", [])
    written = 0
    for entry in entries:
        resource = entry.get("resource")
        if not resource:
            continue
        resource_type = resource.get("resourceType", "Unknown")
        resource_id = resource.get("id", str(uuid.uuid4()))
        filename = work_dir / f"{resource_type}_{resource_id}.json"
        filename.write_text(json.dumps(resource, indent=2))
        written += 1
    return written


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

class FhirCdmHandler(BaseHTTPRequestHandler):
    """Minimal HTTP/1.1 handler — no framework dependency."""

    # Silence default request logging (we use our own)
    def log_message(self, fmt: str, *args: Any) -> None:  # type: ignore[override]
        log.debug("HTTP %s", fmt % args)

    # ------------------------------------------------------------------
    # Routing
    # ------------------------------------------------------------------

    def do_GET(self) -> None:
        if self.path == "/health":
            self._handle_health()
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path == "/ingest":
            self._handle_ingest()
        elif self.path == "/batch":
            self._handle_batch()
        else:
            self._send_json(404, {"error": "Not found"})

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    def _handle_health(self) -> None:
        binary_ok = Path(DOTNET_BINARY).exists()
        self._send_json(200 if binary_ok else 503, {
            "status": "ok" if binary_ok else "degraded",
            "service": "fhir-to-cdm",
            "binary": DOTNET_BINARY,
            "binary_exists": binary_ok,
            "uptime_seconds": round(time.time() - _START_TIME, 1),
            "config": {
                "pg_host": PG_HOST,
                "pg_port": PG_PORT,
                "pg_database": PG_DATABASE,
                "cdm_schema": CDM_SCHEMA,
                "vocab_schema": VOCAB_SCHEMA,
            },
        })

    def _handle_ingest(self) -> None:
        """
        POST /ingest

        Body: FHIR R4 Bundle (application/json or application/fhir+json)

        1. Parse the Bundle.
        2. Write each entry.resource to a temp directory.
        3. Run FhirToCdm against that directory.
        4. Return the run summary including per-table record counts.
        """
        body = self._read_body()
        if body is None:
            return

        try:
            bundle = json.loads(body)
        except json.JSONDecodeError as exc:
            self._send_json(400, {"error": f"Invalid JSON: {exc}"})
            return

        if bundle.get("resourceType") != "Bundle":
            self._send_json(400, {
                "error": "Expected a FHIR Bundle resource (resourceType='Bundle')"
            })
            return

        run_id = str(uuid.uuid4())
        input_dir = FHIR_INPUT_DIR / run_id
        output_dir = CDM_OUTPUT_DIR / run_id
        input_dir.mkdir(parents=True)
        output_dir.mkdir(parents=True)

        try:
            resource_count = _write_bundle_to_dir(bundle, input_dir)
            log.info("[%s] wrote %d resource files to %s", run_id, resource_count, input_dir)

            result = _run_fhir_to_cdm(input_dir, output_dir)
            result["run_id"] = run_id
            result["resources_submitted"] = resource_count

            status = 200 if result["success"] else 500
            self._send_json(status, result)
        finally:
            _cleanup_dir(input_dir)
            _cleanup_dir(output_dir)

    def _handle_batch(self) -> None:
        """
        POST /batch

        Body: FHIR NDJSON — one FHIR resource JSON object per line.

        Wraps all resources in a synthetic Bundle and delegates to the same
        FhirToCdm pipeline used by /ingest.
        """
        body = self._read_body()
        if body is None:
            return

        resources: list[dict[str, Any]] = []
        errors: list[str] = []
        for line_num, raw_line in enumerate(body.decode().splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                resources.append(json.loads(line))
            except json.JSONDecodeError as exc:
                errors.append(f"Line {line_num}: {exc}")

        if errors:
            self._send_json(400, {"error": "NDJSON parse errors", "details": errors})
            return

        if not resources:
            self._send_json(400, {"error": "No resources found in NDJSON body"})
            return

        # Wrap in a synthetic Bundle
        bundle: dict[str, Any] = {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [{"resource": r} for r in resources],
        }

        run_id = str(uuid.uuid4())
        input_dir = FHIR_INPUT_DIR / run_id
        output_dir = CDM_OUTPUT_DIR / run_id
        input_dir.mkdir(parents=True)
        output_dir.mkdir(parents=True)

        try:
            resource_count = _write_bundle_to_dir(bundle, input_dir)
            log.info("[%s] batch: wrote %d resource files", run_id, resource_count)

            result = _run_fhir_to_cdm(input_dir, output_dir)
            result["run_id"] = run_id
            result["resources_submitted"] = resource_count

            status = 200 if result["success"] else 500
            self._send_json(status, result)
        finally:
            _cleanup_dir(input_dir)
            _cleanup_dir(output_dir)

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def _read_body(self) -> bytes | None:
        """Read the full request body; return None and send 400 on error."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self._send_json(400, {"error": "Content-Length required"})
            return None
        return self.rfile.read(content_length)

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, indent=2).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


# ---------------------------------------------------------------------------
# Directory cleanup helper
# ---------------------------------------------------------------------------

def _cleanup_dir(path: Path) -> None:
    """Remove a directory tree, ignoring errors."""
    import shutil
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("FhirToCdm wrapper starting on %s:%d", HOST, PORT)
    log.info(
        "Config — PG: %s:%s/%s  CDM: %s  VOCAB: %s",
        PG_HOST, PG_PORT, PG_DATABASE, CDM_SCHEMA, VOCAB_SCHEMA,
    )
    if not Path(DOTNET_BINARY).exists():
        log.warning(
            "FhirToCdm binary not found at %s — /health will report 'degraded'",
            DOTNET_BINARY,
        )

    server = HTTPServer((HOST, PORT), FhirCdmHandler)
    log.info("Listening — http://%s:%d", HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
