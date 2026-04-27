#!/usr/bin/env python3
"""Load Census 2020 Urban Area county dataset into ``gis.external_exposure``.

Phase 19 Wave 2 (GIS-02). Reads the main ``2020_UA_COUNTY`` sheet (3,234
rows; ``CT_2022`` is skipped per D-06), builds a 5-character FIPS lookup,
and for each real-geography source (D-07: omop, pancreas, irsf) joins
``gis.patient_geography`` to the UA lookup and emits 5 exposure rows per
matched person via UPSERT (D-05).

The five exposure types:

==================  ================  ====================  ===============
exposure_type       column in xlsx     unit                  notes
==================  ================  ====================  ===============
urban_pct           POPPCT_URB         fraction (0..1)       D-03: continuous
rural_pct           POPPCT_RUR         fraction (0..1)       D-03: continuous
urban_pop_density   POPDEN_URB         people_per_sqmi       per Census Bureau
rural_pop_density   POPDEN_RUR         people_per_sqmi       per Census Bureau
aland_pct_urban     ALAND_PCT_URB      fraction (0..1)       D-03: continuous
==================  ================  ====================  ===============

The xlsx already stores POPPCT_URB / POPPCT_RUR / ALAND_PCT_URB as
fractions in [0, 1] (verified via the FieldDescriptions sheet and live
inspection — DC has POPPCT_URB=1.0, the rural Wyoming counties show
POPPCT_URB ≈ 0.0). The loader does NOT re-divide by 100.

Idempotent: re-runs use ``ON CONFLICT (source_id, person_id, exposure_type,
exposure_date) DO UPDATE`` (D-05) so subsequent invocations produce the
same row count with no duplicate-key errors.

D-08: rows for the ``pancreas`` schema are tagged
``source_dataset='census_ua_2020:pancreas:limited_geography'`` so
downstream consumers can warn researchers about the 4-zip Philadelphia
care-site coverage.

Run::

    python scripts/gis/load_ua_county.py

Required env vars (see env.example):

    PGHOST, PGUSER=parthenon_migrator, PGDATABASE=parthenon
    Password resolved via PGPASSFILE / ~/.pgpass.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Allow direct invocation: ``python scripts/gis/load_ua_county.py``.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Re-exports kept for Plan 01 test surface stability:
from scripts.gis.loader_common import (  # noqa: E402,F401  (test surface)
    GisImportTracker,
    REAL_GEOGRAPHY_SOURCES,
    SourceDescriptor,
    UPSERT_SQL_external_exposure as UPSERT_SQL,
    emit,
    get_dsn,
    iter_real_geography_sources,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
UA_XLSX_PATH = Path(
    os.environ.get("PHASE_19_UA_XLSX_PATH", str(REPO_ROOT / "2020_UA_COUNTY.xlsx"))
)

DATASET_TAG = "census_ua_2020"
EXPOSURE_DATE = "2020-04-01"  # Census Day 2020 (D-09)

# (column-in-xlsx, divisor-to-normalize, unit). The divisor is 1.0 across
# the board because the source xlsx already stores percent fields as
# fractions in [0, 1]. Density fields are people-per-sq-mi as published.
EXPOSURE_COLUMNS: dict[str, tuple[str, float, str]] = {
    "urban_pct":         ("POPPCT_URB",     1.0, "fraction"),
    "rural_pct":         ("POPPCT_RUR",     1.0, "fraction"),
    "urban_pop_density": ("POPDEN_URB",     1.0, "people_per_sqmi"),
    "rural_pop_density": ("POPDEN_RUR",     1.0, "people_per_sqmi"),
    "aland_pct_urban":   ("ALAND_PCT_URB",  1.0, "fraction"),
}


def read_ua_xlsx(path: Path) -> pd.DataFrame:
    """Read the main ``2020_UA_COUNTY`` sheet — skip ``CT_2022`` per D-06.

    Returns a DataFrame with exactly 3,234 county rows and the percent /
    density columns documented above.
    """
    if not path.exists():
        raise FileNotFoundError(f"UA xlsx not found: {path}")
    df = pd.read_excel(
        path, sheet_name="2020_UA_COUNTY", dtype={"STATE": int, "COUNTY": int}
    )
    if len(df) != 3234:
        emit("warn", message=f"Expected 3,234 rows, got {len(df)}")
    return df


def build_county_fips_lookup(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Build ``{fips5: {urban_pct, rural_pct, ...}}`` keyed on 5-char FIPS.

    Lancaster County PA (42071) MUST be present — the Plan 01 test
    ``test_fips_concat`` asserts this.
    """
    lookup: dict[str, dict[str, Any]] = {}
    for _, r in df.iterrows():
        state = str(int(r["STATE"])).zfill(2)
        county = str(int(r["COUNTY"])).zfill(3)
        fips = state + county
        record: dict[str, Any] = {}
        for exposure_type, (col, divisor, _unit) in EXPOSURE_COLUMNS.items():
            raw = r.get(col)
            if raw is None or pd.isna(raw):
                continue
            try:
                value = float(raw)
            except (TypeError, ValueError):
                continue
            record[exposure_type] = value / divisor if divisor != 1.0 else value
        lookup[fips] = record
    return lookup


def fanout_for_source(
    conn,
    src: SourceDescriptor,
    ua_lookup: dict[str, dict[str, Any]],
    county_loc_map: dict[str, int],
) -> tuple[int, int]:
    """Emit 5 exposure rows per matched person for one source.

    Returns ``(rows_written, persons_matched)``.
    """
    cdm_schema = src["cdm_schema"]
    # D-08: pancreas is tagged ``limited_geography`` so the UI can warn
    # researchers that PANCREAS' geographic spread is 4 PA care-site zips.
    source_dataset = (
        f"{DATASET_TAG}:{cdm_schema}:limited_geography"
        if cdm_schema == "pancreas"
        else f"{DATASET_TAG}:{cdm_schema}"
    )

    with conn.cursor() as cur:
        cur.execute(
            "SELECT person_id, county_fips "
            "FROM gis.patient_geography "
            "WHERE source_id = %s AND county_fips IS NOT NULL",
            (src["source_id"],),
        )
        patient_county = cur.fetchall()

    rows: list[tuple[Any, ...]] = []
    persons_matched = 0
    for person_id, county_fips in patient_county:
        ua = ua_lookup.get(county_fips)
        if not ua:
            continue
        persons_matched += 1
        county_loc_id = county_loc_map.get(county_fips)
        for exposure_type, (_col, _div, unit) in EXPOSURE_COLUMNS.items():
            value = ua.get(exposure_type)
            if value is None:
                continue
            rows.append(
                (
                    src["source_id"], int(person_id), exposure_type, EXPOSURE_DATE,
                    float(value), None, None, unit,
                    county_loc_id, source_dataset,
                )
            )

    if rows:
        with conn.cursor() as cur:
            execute_values(cur, UPSERT_SQL, rows, page_size=10_000)
        conn.commit()
    emit(
        "source_done",
        source_id=src["source_id"],
        cdm_schema=cdm_schema,
        persons_matched=persons_matched,
        rows_written=len(rows),
    )
    return (len(rows), persons_matched)


def update_dataset_status(conn, status: str) -> None:
    """Flip ``app.gis_datasets[slug='census_ua_2020']`` status."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE app.gis_datasets SET status=%s, loaded_at=NOW(), updated_at=NOW() "
            "WHERE slug=%s",
            (status, DATASET_TAG),
        )
    conn.commit()


def main() -> int:
    emit("start", script="load_ua_county", dataset=DATASET_TAG)
    if not UA_XLSX_PATH.exists():
        emit("error", message=f"UA xlsx missing: {UA_XLSX_PATH}")
        return 1

    df = read_ua_xlsx(UA_XLSX_PATH)
    ua_lookup = build_county_fips_lookup(df)
    emit("xlsx_parsed", county_count=len(ua_lookup))

    conn = psycopg2.connect(get_dsn())
    tracker = GisImportTracker(conn, filename="2020_UA_COUNTY.xlsx")
    try:
        tracker.start()
        tracker.update_progress(10, f"parsed {len(ua_lookup)} county rows")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT geographic_location_id, geographic_code "
                "FROM gis.geographic_location WHERE location_type='county'"
            )
            county_loc_map = {code: int(lid) for lid, code in cur.fetchall()}
        emit("county_map_built", count=len(county_loc_map))
        tracker.update_progress(20, f"built county_loc_map ({len(county_loc_map)} entries)")

        sources = list(iter_real_geography_sources(conn))
        emit(
            "sources",
            count=len(sources),
            schemas=[s["cdm_schema"] for s in sources],
        )
        tracker.update_progress(
            25, f"discovered {len(sources)} real-geography sources"
        )

        per_source_counts: dict[str, dict[str, int]] = {}
        total_rows = 0
        total_persons = 0
        for i, src in enumerate(sources):
            r, p = fanout_for_source(conn, src, ua_lookup, county_loc_map)
            per_source_counts[src["cdm_schema"]] = {
                "rows_written": r,
                "persons_matched": p,
            }
            total_rows += r
            total_persons += p
            tracker.update_progress(
                30 + int(50 * (i + 1) / max(1, len(sources))),
                f"loaded {r} rows for {src['cdm_schema']} ({p} persons matched)",
            )

        # W-02: VACUUM ANALYZE cannot run inside a transaction. Toggle
        # autocommit, run, then restore the previous setting.
        old_autocommit = conn.autocommit
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute("VACUUM ANALYZE gis.external_exposure")
            emit("vacuum_done", table="gis.external_exposure")
        finally:
            conn.autocommit = old_autocommit
        tracker.update_progress(95, "VACUUM ANALYZE gis.external_exposure complete")

        update_dataset_status(conn, "loaded")
        emit("dataset_status_updated", slug=DATASET_TAG, status="loaded")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM app.gis_datasets WHERE slug = %s", (DATASET_TAG,)
            )
            row = cur.fetchone()
            dataset_id = int(row[0]) if row else None

        tracker.complete(
            row_count=total_rows,
            summary_snapshot={
                "dataset_slug": DATASET_TAG,
                "dataset_id": dataset_id,
                "source_file": "2020_UA_COUNTY.xlsx",
                "counties_loaded": len(ua_lookup),
                "ct_2022_skipped": True,
                "exposure_types": list(EXPOSURE_COLUMNS.keys()),
                "exposure_date": EXPOSURE_DATE,
                "persons_matched": total_persons,
                "per_source_counts": per_source_counts,
                "synthetic_sources_excluded": ["synpuf", "eunomia"],
            },
            log_line=(
                f"loaded {total_rows} exposure rows across "
                f"{len(per_source_counts)} sources "
                f"({total_persons} persons matched)"
            ),
        )
        emit(
            "complete",
            rows_written=total_rows,
            persons_matched=total_persons,
        )
    except Exception as exc:
        tracker.fail(exc)
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
