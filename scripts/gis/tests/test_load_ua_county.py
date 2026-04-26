"""Phase 19 Wave 0 RED — pytest stubs for scripts/gis/load_ua_county.py.

The module under test (`scripts.gis.load_ua_county`) does NOT yet exist.
Plan 03 will create it. Until then, every test below raises
ModuleNotFoundError at import time — that is the intentional RED signal.

Decisions enforced (all from 19-RESEARCH.md Open Questions):
  D-05  UPSERT marker (ON CONFLICT DO UPDATE) — no DELETE/INSERT pattern.
  D-06  CT_2022 sheet of 2020_UA_COUNTY.xlsx is SKIPPED in v1.
  D-07  Real-geography source allow-list = ['omop', 'pancreas', 'irsf'];
        synpuf and eunomia are EXCLUDED.

Loaders MUST read DSN from env vars (PGHOST/PGUSER/PGDATABASE/PGPORT plus
~/.pgpass for the password). NO hardcoded `dbname=ohdsi`,
`password=acumenus`, or `user=smudoshi` literal anywhere.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest


@pytest.mark.phase19
@pytest.mark.ua_county
def test_parses_main_sheet(ua_xlsx_path: Path) -> None:
    """Main sheet of 2020_UA_COUNTY.xlsx parses to a DataFrame with 3,234
    county rows and the expected percent / density columns."""
    from scripts.gis import load_ua_county  # type: ignore[import-not-found]

    df = load_ua_county.read_ua_xlsx(ua_xlsx_path)
    assert len(df) == 3234, f"expected 3234 county rows, got {len(df)}"
    expected_cols = {
        "STATE",
        "COUNTY",
        "POPPCT_URB",
        "POPPCT_RUR",
        "POPDEN_URB",
        "POPDEN_RUR",
        "ALAND_PCT_URB",
    }
    missing = expected_cols - set(df.columns)
    assert not missing, f"main sheet missing columns: {missing}"


@pytest.mark.phase19
@pytest.mark.ua_county
def test_fips_concat(ua_xlsx_path: Path) -> None:
    """STATE||COUNTY zero-fill produces a 5-digit FIPS string for every
    row, and Lancaster County PA (42071) is present."""
    from scripts.gis import load_ua_county  # type: ignore[import-not-found]

    df = load_ua_county.read_ua_xlsx(ua_xlsx_path)
    fips_lookup = load_ua_county.build_county_fips_lookup(df)
    assert len(fips_lookup) == 3234
    fips_re = re.compile(r"^\d{5}$")
    for fips in fips_lookup.keys():
        assert fips_re.match(fips), f"non-5-digit FIPS encountered: {fips!r}"
    assert "42071" in fips_lookup, "Lancaster County PA (42071) missing"


@pytest.mark.phase19
@pytest.mark.ua_county
def test_skips_ct_2022(ua_xlsx_path: Path) -> None:
    """v1 reads only the original-CT-county rows; CT_2022 planning regions
    (STATE=9, COUNTY in {110..190 by 10}) MUST be absent. Old CT counties
    (STATE=9, COUNTY in {1..15 by 2}) MUST be present."""
    from scripts.gis import load_ua_county  # type: ignore[import-not-found]

    df = load_ua_county.read_ua_xlsx(ua_xlsx_path)
    new_ct_codes = {110, 120, 130, 140, 150, 160, 170, 180, 190}
    new_ct_mask = (df["STATE"] == 9) & (df["COUNTY"].isin(new_ct_codes))
    assert new_ct_mask.sum() == 0, "CT_2022 planning regions must be skipped (D-06)"

    old_ct_codes = {1, 3, 5, 7, 9, 11, 13, 15}
    old_ct_mask = (df["STATE"] == 9) & (df["COUNTY"].isin(old_ct_codes))
    assert old_ct_mask.sum() > 0, "original CT counties must be present"


@pytest.mark.phase19
@pytest.mark.ua_county
def test_excludes_synthetic_sources() -> None:
    """REAL_GEOGRAPHY_SOURCES allow-list excludes synpuf/eunomia (D-07)."""
    from scripts.gis.load_ua_county import REAL_GEOGRAPHY_SOURCES  # type: ignore[import-not-found]

    assert REAL_GEOGRAPHY_SOURCES == ["omop", "pancreas", "irsf"]
    assert "synpuf" not in REAL_GEOGRAPHY_SOURCES
    assert "eunomia" not in REAL_GEOGRAPHY_SOURCES


@pytest.mark.phase19
@pytest.mark.ua_county
def test_get_dsn_uses_env(env_dsn: None) -> None:
    """get_dsn() reads from PGHOST/PGUSER/PGDATABASE — never the legacy
    `dbname=ohdsi user=smudoshi password=acumenus` triple (GIS-04)."""
    from scripts.gis.load_ua_county import get_dsn  # type: ignore[import-not-found]

    dsn = get_dsn()
    assert "dbname=parthenon" in dsn
    assert "user=parthenon_migrator" in dsn
    forbidden = ["dbname=ohdsi", "password=acumenus", "user=smudoshi"]
    for needle in forbidden:
        assert needle not in dsn, f"DSN contains forbidden literal: {needle}"


@pytest.mark.phase19
@pytest.mark.ua_county
def test_upsert_idempotency_marker() -> None:
    """UPSERT_SQL string contains the D-05 ON CONFLICT clause keyed by
    (source_id, person_id, exposure_type, exposure_date)."""
    from scripts.gis.load_ua_county import UPSERT_SQL  # type: ignore[import-not-found]

    expected = (
        "ON CONFLICT (source_id, person_id, exposure_type, exposure_date) "
        "DO UPDATE SET"
    )
    assert expected in UPSERT_SQL, (
        "UPSERT_SQL must use D-05 conflict target — not DELETE WHERE exposure_type=..."
    )
