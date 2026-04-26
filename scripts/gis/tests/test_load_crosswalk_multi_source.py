"""Phase 19 Wave 0 RED — pytest stubs for the multi-source HUD crosswalk
loader (`scripts/gis/load_crosswalk.py`).

Plan 03 ports load_crosswalk.py to:
  - Read DSN from env vars (no `dbname=ohdsi`).
  - Iterate the real-geography source allow-list (omop, pancreas, irsf)
    rather than only Acumenus/PA.

Both functions referenced below do not yet exist; ModuleNotFoundError or
ImportError is the intentional RED signal.
"""
from __future__ import annotations

import pytest


@pytest.mark.phase19
def test_crosswalk_per_source_loop_exists() -> None:
    """iter_real_geography_sources() yields per-source dicts with
    source_id, cdm_schema, and source_code keys; 'omop' must appear in
    cdm_schema values (GIS-02 / D-07)."""
    from scripts.gis.load_crosswalk import iter_real_geography_sources  # type: ignore[import-not-found]

    sources = list(iter_real_geography_sources())
    assert len(sources) >= 1, "iter_real_geography_sources must yield at least one source"
    for entry in sources:
        assert "source_id" in entry
        assert "cdm_schema" in entry
        assert "source_code" in entry

    cdm_schemas = {entry["cdm_schema"] for entry in sources}
    assert "omop" in cdm_schemas, "real-geography loop must include 'omop' schema"


@pytest.mark.phase19
def test_crosswalk_get_dsn_env_driven() -> None:
    """get_dsn() in load_crosswalk MUST be env-driven (GIS-04)."""
    from scripts.gis.load_crosswalk import get_dsn  # type: ignore[import-not-found]

    dsn = get_dsn()
    assert "dbname=ohdsi" not in dsn, "legacy dbname=ohdsi must not appear"
    assert "password=acumenus" not in dsn, "legacy password=acumenus must not appear"
