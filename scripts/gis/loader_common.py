"""Shared infrastructure for Phase 19 GIS loaders.

Provides:
  * ``get_dsn()``           — env-driven DSN (D-04, GIS-04)
  * ``REAL_GEOGRAPHY_SOURCES`` — D-07 allow-list (omop, pancreas, irsf)
  * ``iter_real_geography_sources([conn])`` — per-source descriptor generator
  * ``UPSERT_SQL_external_exposure`` — D-05 ON CONFLICT template
  * ``GisImportTracker``    — app.gis_imports panel reconciliation
  * ``emit()``              — structured JSON line on stdout
  * ``open_conn()``         — psycopg2 connection helper

Required env vars (see ``env.example``):

    PGHOST, PGPORT, PGDATABASE=parthenon, PGUSER=parthenon_migrator
    Password is resolved via PGPASSFILE / ~/.pgpass — NEVER passed in DSN.

Security
--------
GIS-04 regression guard: this module MUST NOT contain the legacy hardcoded
DSN literals (the database, user, and password values formerly hardcoded by
the pre-Phase-19 GIS loaders). The parametrized pytest in
``scripts/gis/tests/test_dsn_no_legacy_credentials.py`` fails the build if
any of those literals leak in.

DB role
-------
The default user is ``parthenon_migrator`` because Phase 19 loaders perform
DDL-adjacent writes to ``gis.*`` (DROP MATERIALIZED VIEW, CREATE INDEX) which
``parthenon_app`` is intentionally not allowed to perform per the
HIGHSEC role split.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Iterator, Optional, TypedDict

import psycopg2
from psycopg2.extras import Json

logger = logging.getLogger("scripts.gis.loader_common")

# D-07 — exact allow-list. Synthetic-zip CDMs (synpuf, eunomia) and raw
# schemas without OMOP location tables (mimiciv, atlantic_health) are
# excluded. Order is deterministic for repeatable test output.
REAL_GEOGRAPHY_SOURCES: list[str] = ["omop", "pancreas", "irsf"]


class SourceDescriptor(TypedDict):
    source_id: int
    cdm_schema: str
    source_key: str  # B-01: app.sources column is `source_key`, not `source_code`
    source_code: str  # alias kept for Wave 0 test_load_crosswalk_multi_source.py


def get_dsn(search_path: str = "gis,public,vocab,app,topology") -> str:
    """Build a libpq DSN from environment variables.

    Reads ``PGHOST`` / ``PGPORT`` / ``PGDATABASE`` / ``PGUSER`` (with
    parthenon-friendly defaults). The DB password is **never** placed in
    the DSN — libpq resolves it from ``PGPASSFILE`` or ``~/.pgpass``.

    GIS-04 regression guard: this function MUST NOT emit the legacy
    pre-Phase-19 hardcoded DSN literals.
    """
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5432")
    db = os.environ.get("PGDATABASE", "parthenon")
    user = os.environ.get("PGUSER", "parthenon_migrator")
    return (
        f"host={host} port={port} dbname={db} user={user} "
        f"options='-c search_path={search_path}'"
    )


def open_conn(autocommit: bool = False):
    """Open a psycopg2 connection using the env-driven DSN.

    Caller is responsible for ``conn.close()``. Use a context manager
    when possible.
    """
    conn = psycopg2.connect(get_dsn())
    conn.autocommit = autocommit
    return conn


def iter_real_geography_sources(conn=None) -> Iterator[SourceDescriptor]:
    """Yield ``SourceDescriptor`` for every real-geography source.

    Joins ``app.sources`` to ``app.source_daimons`` filtered to
    ``daimon_type = 'cdm'`` (lowercase per ``DaimonType::CDM`` backing
    value — B-02) and the :data:`REAL_GEOGRAPHY_SOURCES` allow-list.
    Synthetic and raw-schema sources are silently skipped.

    The function may be called with or without a pre-opened connection:
    when ``conn`` is ``None`` a short-lived connection is opened from
    :func:`get_dsn` and closed before returning. This dual signature
    matches both the Wave 0 test stub (no-arg call) and the production
    Plan 03 loaders (shared connection).

    Each descriptor exposes both ``source_key`` (canonical column name in
    ``app.sources``) and ``source_code`` as an alias to keep the older
    test surface stable.
    """
    own = False
    if conn is None:
        conn = psycopg2.connect(get_dsn())
        own = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, sd.table_qualifier, s.source_key
                FROM app.sources s
                JOIN app.source_daimons sd ON sd.source_id = s.id
                WHERE s.deleted_at IS NULL
                  AND sd.daimon_type = 'cdm'   -- B-02: DaimonType::CDM backing value is lowercase
                  AND sd.table_qualifier = ANY(%s)
                ORDER BY s.id
                """,
                (REAL_GEOGRAPHY_SOURCES,),
            )
            results = cur.fetchall()
        for source_id, cdm_schema, source_key in results:
            yield {
                "source_id": int(source_id),
                "cdm_schema": str(cdm_schema),
                "source_key": str(source_key),
                "source_code": str(source_key),
            }
    finally:
        if own:
            conn.close()


# D-05 UPSERT template — single source of truth for the gis.external_exposure
# fanout. Imported by every loader that writes exposures.
UPSERT_SQL_external_exposure: str = """
INSERT INTO gis.external_exposure
  (source_id, person_id, exposure_type, exposure_date,
   value_as_number, value_as_string, value_as_integer, unit,
   geographic_location_id, source_dataset)
VALUES %s
ON CONFLICT (source_id, person_id, exposure_type, exposure_date) DO UPDATE SET
  value_as_number = EXCLUDED.value_as_number,
  value_as_string = EXCLUDED.value_as_string,
  value_as_integer = EXCLUDED.value_as_integer,
  unit = EXCLUDED.unit,
  geographic_location_id = EXCLUDED.geographic_location_id,
  source_dataset = EXCLUDED.source_dataset,
  updated_at = NOW()
"""


def emit(event: str, **kwargs: Any) -> None:
    """Emit a structured JSON line to stdout for traceability.

    Aggregate counts only — never per-person identifiers (T-19-13).
    """
    payload = {"event": event, "ts": datetime.now(timezone.utc).isoformat(), **kwargs}
    print(json.dumps(payload, default=str), flush=True)


# ---------------------------------------------------------------------------
# GisImportTracker — app.gis_imports panel reconciliation
# ---------------------------------------------------------------------------

# Default loader user — admin@acumenus.net (id=117) per project convention.
# Override via PARTHENON_LOADER_USER_ID for CI envs.
DEFAULT_LOADER_USER_ID = 117


def _loader_user_id() -> int:
    raw = os.environ.get("PARTHENON_LOADER_USER_ID")
    if raw is None or raw == "":
        return DEFAULT_LOADER_USER_ID
    try:
        return int(raw)
    except ValueError:
        logger.warning(
            "PARTHENON_LOADER_USER_ID=%r is not an integer; falling back to %d",
            raw,
            DEFAULT_LOADER_USER_ID,
        )
        return DEFAULT_LOADER_USER_ID


class GisImportTracker:
    """Track a single CLI loader run as a row in ``app.gis_imports``.

    Mirrors the behavior of the Laravel ``GisImportController::run`` panel
    (status='running' → 'completed' / 'failed', progress_percentage,
    log_output append, summary_snapshot JSONB). One stable row per
    ``(filename, import_mode='cli_loader')`` so that re-runs update in
    place rather than fragmenting the panel's history view.

    The table has no unique constraint on ``(filename, import_mode)`` yet
    (see Wave 4 follow-up). Until then we use SELECT-then-INSERT-or-UPDATE
    inside an explicit transaction to avoid race-conditions between
    parallel runs of the same loader.
    """

    def __init__(self, conn, filename: str, *, import_mode: str = "cli_loader"):
        self.conn = conn
        self.filename = filename
        self.import_mode = import_mode
        self.user_id = _loader_user_id()
        self.row_id: Optional[int] = None

    # ---- lifecycle --------------------------------------------------------

    def start(self) -> int:
        """Create or reset the gis_imports row and mark it ``running``."""
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM app.gis_imports
                WHERE filename = %s AND import_mode = %s
                ORDER BY id DESC LIMIT 1
                """,
                (self.filename, self.import_mode),
            )
            existing = cur.fetchone()

            if existing is None:
                cur.execute(
                    """
                    INSERT INTO app.gis_imports
                      (user_id, filename, import_mode, status,
                       column_mapping, abby_suggestions, config,
                       summary_snapshot, error_log,
                       progress_percentage, log_output,
                       started_at, created_at, updated_at)
                    VALUES (%s, %s, %s, 'running',
                            %s, %s, %s,
                            %s, %s,
                            0, %s,
                            now(), now(), now())
                    RETURNING id
                    """,
                    (
                        self.user_id,
                        self.filename,
                        self.import_mode,
                        Json({}),
                        Json({}),
                        Json({}),
                        Json({}),
                        Json([]),
                        f"[{self._ts()}] loader started\n",
                    ),
                )
                self.row_id = int(cur.fetchone()[0])
            else:
                self.row_id = int(existing[0])
                cur.execute(
                    """
                    UPDATE app.gis_imports
                    SET status = 'running',
                        progress_percentage = 0,
                        started_at = now(),
                        completed_at = NULL,
                        log_output = COALESCE(log_output, '') || %s,
                        error_log = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (
                        f"[{self._ts()}] loader restarted\n",
                        Json([]),
                        self.row_id,
                    ),
                )
        self.conn.commit()
        emit(
            "gis_import_started",
            gis_import_id=self.row_id,
            filename=self.filename,
            import_mode=self.import_mode,
        )
        return self.row_id

    def update_progress(self, progress_percentage: int, log_line: str = "") -> None:
        """Update progress_percentage and append a log line."""
        if self.row_id is None:
            self.start()
        clamped = max(0, min(100, int(progress_percentage)))
        suffix = f"[{self._ts()}] {log_line}\n" if log_line else ""
        with self.conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.gis_imports
                SET progress_percentage = %s,
                    log_output = COALESCE(log_output, '') || %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (clamped, suffix, self.row_id),
            )
        self.conn.commit()

    def complete(
        self,
        row_count: int,
        summary_snapshot: dict[str, Any],
        log_line: str = "completed",
    ) -> None:
        if self.row_id is None:
            self.start()
        with self.conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.gis_imports
                SET status = 'completed',
                    progress_percentage = 100,
                    row_count = %s,
                    summary_snapshot = %s,
                    completed_at = now(),
                    log_output = COALESCE(log_output, '') || %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (
                    int(row_count),
                    Json(summary_snapshot),
                    f"[{self._ts()}] {log_line}\n",
                    self.row_id,
                ),
            )
        self.conn.commit()
        emit(
            "gis_import_completed",
            gis_import_id=self.row_id,
            filename=self.filename,
            row_count=row_count,
        )

    def fail(self, exc: BaseException) -> None:
        if self.row_id is None:
            self.start()
        message = f"{type(exc).__name__}: {exc}"
        with self.conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.gis_imports
                SET status = 'failed',
                    completed_at = now(),
                    error_log = error_log || %s::jsonb,
                    log_output = COALESCE(log_output, '') || %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (
                    Json([{"ts": self._ts(), "message": message}]),
                    f"[{self._ts()}] FAILED: {message}\n",
                    self.row_id,
                ),
            )
        self.conn.commit()
        emit(
            "gis_import_failed",
            gis_import_id=self.row_id,
            filename=self.filename,
            error=message,
        )

    # ---- helpers ----------------------------------------------------------

    @staticmethod
    def _ts() -> str:
        return datetime.now().strftime("%H:%M:%S")


__all__ = [
    "REAL_GEOGRAPHY_SOURCES",
    "SourceDescriptor",
    "UPSERT_SQL_external_exposure",
    "GisImportTracker",
    "emit",
    "get_dsn",
    "iter_real_geography_sources",
    "open_conn",
]


def _self_check() -> int:
    """Smoke check: print DSN (no secrets) and exit 0."""
    dsn = get_dsn()
    print(json.dumps({"dsn": dsn, "real_geography_sources": REAL_GEOGRAPHY_SOURCES}))
    return 0


if __name__ == "__main__":
    sys.exit(_self_check())
