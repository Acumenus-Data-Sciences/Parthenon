#!/usr/bin/env python3
"""Load nationwide HUD ZIP-Tract crosswalk into ``gis.location_geography``.

Phase 19 Wave 2 (GIS-02). Iterates the real-geography source allow-list
(``omop``, ``pancreas``, ``irsf`` — D-07) and joins each source's
``<schema>.location`` to the HUD TRACT_ZIP_032020 crosswalk to build a
per-source ``(source_id, location_id, tract_fips)`` row in
``gis.location_geography``. Re-runnable: each source's existing rows are
removed before insert (per-source TRUNCATE-by-source), then UPSERT writes
the fresh allocation.

Finally rebuilds the shared materialized view ``gis.patient_geography``
keyed by ``(source_id, person_id)`` (D-02). The matview body unions all
discovered real-geography sources at runtime — no hardcoded source_id
integers.

Env-driven DSN (GIS-04). DROP+CREATE wipes the GRANT issued by Plan 02,
so the loader re-issues ``GRANT SELECT ON gis.patient_geography TO
parthenon_app`` at the end of the rebuild (W-01).

Run::

    python scripts/gis/load_crosswalk.py

Required env vars (see env.example):

    PGHOST, PGUSER=parthenon_migrator, PGDATABASE=parthenon
    Password resolved via PGPASSFILE / ~/.pgpass.

The dual-export ``iter_real_geography_sources`` and ``get_dsn`` re-exports
exist so that the Plan 01 RED tests in
``test_load_crosswalk_multi_source.py`` (which import them from THIS module)
continue to work without test refactor.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Allow direct invocation: ``python scripts/gis/load_crosswalk.py``.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Re-exports kept for Plan 01 test surface stability:
from scripts.gis.loader_common import (  # noqa: E402,F401  (test surface)
    GisImportTracker,
    REAL_GEOGRAPHY_SOURCES,
    SourceDescriptor,
    emit,
    get_dsn,
    iter_real_geography_sources,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
HUD_PATH = Path(
    os.environ.get(
        "PHASE_19_HUD_CROSSWALK",
        str(REPO_ROOT / "GIS" / "data" / "crosswalk" / "TRACT_ZIP_032020.xlsx"),
    )
)

INSERT_LOCGEO_SQL = """
INSERT INTO gis.location_geography
  (source_id, location_id, zip_code, tract_fips, county_fips,
   tract_allocation_ratio, tract_location_id, county_location_id)
VALUES %s
ON CONFLICT (source_id, location_id, tract_fips) DO UPDATE SET
  zip_code = EXCLUDED.zip_code,
  county_fips = EXCLUDED.county_fips,
  tract_allocation_ratio = EXCLUDED.tract_allocation_ratio,
  tract_location_id = EXCLUDED.tract_location_id,
  county_location_id = EXCLUDED.county_location_id
"""


def load_hud_crosswalk(path: Path) -> pd.DataFrame:
    """Read the nationwide HUD TRACT-ZIP crosswalk."""
    if not path.exists():
        raise FileNotFoundError(f"HUD crosswalk not found: {path}")
    df = pd.read_excel(path)
    df["TRACT"] = df["TRACT"].astype(str).str.zfill(11)
    df["ZIP"] = df["ZIP"].astype(str).str.zfill(5)
    return df


def load_crosswalk_for_source(
    conn,
    src: SourceDescriptor,
    hud: pd.DataFrame,
    tract_map: dict[str, int],
    county_map: dict[str, int],
) -> int:
    """Per-source crosswalk: read schema.location, join HUD, UPSERT."""
    schema = src["cdm_schema"]
    with conn.cursor() as cur:
        # Idempotency: clear this source's existing crosswalk rows before
        # insert. UPSERT below would also work but per-source DELETE+INSERT
        # makes the row-count log line accurate (no carryover from a previous
        # zip that's since been removed from the CDM).
        cur.execute(
            "DELETE FROM gis.location_geography WHERE source_id = %s",
            (src["source_id"],),
        )
        cur.execute(
            f"SELECT location_id, zip FROM {schema}.location "
            "WHERE zip IS NOT NULL AND zip <> '00000' AND length(zip) = 5"
        )
        zip_to_loc = {z: int(loc) for loc, z in cur.fetchall()}

    rows: list[tuple[Any, ...]] = []
    for _, r in hud.iterrows():
        loc_id = zip_to_loc.get(r["ZIP"])
        if loc_id is None:
            continue
        tract = r["TRACT"]
        county = tract[:5]
        # HUD uses RES_RATIO (residential allocation). Fall back to TOT_RATIO,
        # then to 1.0 if neither column is present (Pitfall 4).
        ratio_raw = r.get("RES_RATIO", r.get("TOT_RATIO", 1.0))
        ratio = float(ratio_raw) if pd.notna(ratio_raw) else 1.0
        rows.append(
            (
                src["source_id"], loc_id, r["ZIP"], tract, county,
                ratio, tract_map.get(tract), county_map.get(county),
            )
        )

    if rows:
        with conn.cursor() as cur:
            execute_values(cur, INSERT_LOCGEO_SQL, rows, page_size=1000)
        conn.commit()
    emit(
        "source_loaded",
        source_id=src["source_id"],
        cdm_schema=schema,
        rows=len(rows),
    )
    return len(rows)


def rebuild_patient_geography(conn, sources: list[SourceDescriptor]) -> int:
    """DROP + CREATE the shared ``gis.patient_geography`` matview.

    Body unions all real-geography sources discovered at runtime (no
    hardcoded source_id integers). After CREATE, re-issues the GRANT to
    ``parthenon_app`` (W-01: the Plan 02 grant is wiped by DROP).
    """
    if not sources:
        emit("warn", message="no real-geography sources discovered; matview body empty")
        # Still rebuild as an empty stub for downstream readers.
        union_sql = "SELECT NULL::bigint AS source_id, NULL::bigint AS person_id, " \
            "NULL::integer AS location_id, NULL::varchar AS zip_code, " \
            "NULL::varchar AS tract_fips, NULL::varchar AS county_fips, " \
            "NULL::bigint AS tract_location_id, NULL::bigint AS county_location_id, " \
            "NULL::numeric(6,4) AS tract_allocation_ratio WHERE FALSE"
    else:
        # Pitfall 4 (HUD multi-allocation): a single ZIP can map to multiple
        # tracts via RES_RATIO splits. The matview is keyed by
        # (source_id, person_id), so we deduplicate by selecting the tract with
        # the largest tract_allocation_ratio per person via DISTINCT ON.
        # county_fips is invariant across tracts of the same ZIP (every tract
        # within ZIP X belongs to the same county), so picking the max-ratio
        # tract still yields the canonical county for that person.
        #
        # Each per-source sub-SELECT is wrapped in parentheses so that its
        # ORDER BY (required by DISTINCT ON) does not bleed into the outer
        # UNION ALL parser.
        parts: list[str] = []
        for src in sources:
            parts.append(
                "(SELECT DISTINCT ON ("
                f"{src['source_id']}::BIGINT, p.person_id) "
                f"{src['source_id']}::BIGINT AS source_id, "
                f"p.person_id::BIGINT AS person_id, "
                f"l.location_id::INTEGER AS location_id, "
                f"l.zip::VARCHAR AS zip_code, "
                f"lg.tract_fips, lg.county_fips, "
                f"lg.tract_location_id, lg.county_location_id, "
                f"lg.tract_allocation_ratio "
                f"FROM {src['cdm_schema']}.person p "
                f"JOIN {src['cdm_schema']}.location l "
                f"  ON p.location_id = l.location_id "
                f"JOIN gis.location_geography lg "
                f"  ON lg.source_id = {src['source_id']} "
                f"  AND lg.location_id = l.location_id "
                f"ORDER BY {src['source_id']}::BIGINT, p.person_id, "
                f"  lg.tract_allocation_ratio DESC NULLS LAST, lg.tract_fips)"
            )
        union_sql = " UNION ALL ".join(parts)

    with conn.cursor() as cur:
        cur.execute("DROP MATERIALIZED VIEW IF EXISTS gis.patient_geography")
        cur.execute(f"CREATE MATERIALIZED VIEW gis.patient_geography AS {union_sql}")
        # W-01: DROP wiped the GRANT issued by the Plan 02 migration. Re-issue.
        cur.execute("GRANT SELECT ON gis.patient_geography TO parthenon_app")
        # The unique index also serves as a WITH (storage_parameter) anchor for
        # CONCURRENTLY refresh in future iterations.
        cur.execute(
            "CREATE UNIQUE INDEX idx_pg_source_person "
            "ON gis.patient_geography(source_id, person_id)"
        )
        cur.execute(
            "CREATE INDEX idx_pg_county_fips "
            "ON gis.patient_geography(source_id, county_fips)"
        )
        cur.execute(
            "CREATE INDEX idx_pg_county_location "
            "ON gis.patient_geography(source_id, county_location_id)"
        )
        cur.execute(
            "CREATE INDEX idx_pg_tract_location "
            "ON gis.patient_geography(source_id, tract_location_id)"
        )
        cur.execute("SELECT COUNT(*) FROM gis.patient_geography")
        count = int(cur.fetchone()[0])
    conn.commit()
    return count


def main() -> int:
    emit("start", script="load_crosswalk", scope="nationwide_multi_source")

    hud = load_hud_crosswalk(HUD_PATH)
    emit("hud_loaded", rows=len(hud))

    conn = psycopg2.connect(get_dsn())
    tracker = GisImportTracker(conn, filename="TRACT_ZIP_032020.xlsx")
    try:
        tracker.start()
        tracker.update_progress(10, f"loaded HUD crosswalk ({len(hud)} rows)")

        # Build tract/county location_id maps once.
        with conn.cursor() as cur:
            cur.execute(
                "SELECT geographic_location_id, geographic_code "
                "FROM gis.geographic_location WHERE location_type='census_tract'"
            )
            tract_map = {code: int(lid) for lid, code in cur.fetchall()}
            cur.execute(
                "SELECT geographic_location_id, geographic_code "
                "FROM gis.geographic_location WHERE location_type='county'"
            )
            county_map = {code: int(lid) for lid, code in cur.fetchall()}
        emit("location_maps_built", tracts=len(tract_map), counties=len(county_map))

        sources = list(iter_real_geography_sources(conn))
        emit(
            "sources_discovered",
            count=len(sources),
            schemas=[s["cdm_schema"] for s in sources],
        )
        tracker.update_progress(
            25, f"discovered {len(sources)} real-geography sources"
        )

        per_source_counts: dict[str, int] = {}
        total = 0
        for i, src in enumerate(sources):
            per_source_counts[src["cdm_schema"]] = load_crosswalk_for_source(
                conn, src, hud, tract_map, county_map
            )
            total += per_source_counts[src["cdm_schema"]]
            tracker.update_progress(
                30 + int(50 * (i + 1) / max(1, len(sources))),
                f"loaded {per_source_counts[src['cdm_schema']]} rows for {src['cdm_schema']}",
            )

        tracker.update_progress(85, "rebuilding gis.patient_geography matview")
        pg_count = rebuild_patient_geography(conn, sources)
        emit("matview_rebuilt", patient_geography_rows=pg_count)

        tracker.complete(
            row_count=total,
            summary_snapshot={
                "dataset_slug": "census_ua_2020",
                "scope": "nationwide_multi_source",
                "hud_rows": int(len(hud)),
                "crosswalk_rows": total,
                "patient_geography_rows": pg_count,
                "per_source_counts": per_source_counts,
                "matview_rebuilt": True,
                "matview_grant_reissued": True,
            },
            log_line=f"crosswalk={total} matview={pg_count}",
        )
        emit("complete", crosswalk_rows=total, patient_geography_rows=pg_count)
    except Exception as exc:
        tracker.fail(exc)
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
