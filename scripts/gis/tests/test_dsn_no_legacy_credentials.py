"""GIS-04 regression guard: NO Phase 19 loader may ship with the legacy
hardcoded DSN.

The watch-list below covers EVERY Python file in ``scripts/gis/`` that has
ever held the legacy ``ohdsi/smudoshi/acumenus`` triplet, plus the catch-all
``test_no_unlisted_python_files_with_legacy_dsn`` test that fails if any
NEW (or forgotten) ``scripts/gis/*.py`` file ships with the same literals.

Wave 0 (Plan 01) seeded the watch-list with 2 files (``load_ua_county.py``
+ ``loader_common.py``). Plan 03 grew it to 4 (added ``load_crosswalk.py``
and ``load_geography.py`` after porting them to env-DSN). Plan 05 (this
file) closes GIS-04 by remediating the 4 remaining active legacy loaders
(``load_rucc.py``, ``load_svi.py``, ``load_air_quality.py``,
``load_hospitals.py``), explicitly DEPRECATING 2 obsolete ones
(``load_all.py``, ``load_real_data.py``), and leaving ``fetch_data.py`` —
a pure HTTP downloader with no DB credentials — on the watch-list as a
documented green-today regression guard. After Plan 05, ALL nine watch-
list entries pass.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

GIS_DIR = Path(__file__).resolve().parent.parent

# Plan 05 watch-list (Wave 4). Order:
#   - Phase 19 loaders authored by Plan 03 (loader_common, ua_county,
#     crosswalk, geography).
#   - Active legacy loaders ported to env-DSN by Plan 05 (rucc, svi,
#     air_quality, hospitals).
#   - Obsolete loaders explicitly DEPRECATED with a stub by Plan 05
#     (load_all, load_real_data).
#   - HTTP-only utility with no DB credentials (fetch_data) — kept on the
#     guard so any future regression that re-introduces a hardcoded DSN
#     here would fail loudly.
PHASE_19_LOADER_FILES = [
    # Phase 19 net-new (Plan 03)
    "loader_common.py",
    "load_ua_county.py",
    "load_geography.py",
    "load_crosswalk.py",
    # Active legacy loaders ported by Plan 05
    "load_rucc.py",
    "load_svi.py",
    "load_air_quality.py",
    "load_hospitals.py",
    # Deprecated stubs (Plan 05)
    "load_all.py",
    "load_real_data.py",
    # Pure HTTP downloader (no DB credentials)
    "fetch_data.py",
]

LEGACY_PATTERN = re.compile(
    r"dbname=ohdsi|password=acumenus|user=smudoshi", re.IGNORECASE
)


@pytest.mark.phase19
@pytest.mark.parametrize("filename", PHASE_19_LOADER_FILES)
def test_phase19_loader_has_no_legacy_dsn(filename: str) -> None:
    path = GIS_DIR / filename
    if not path.exists():
        pytest.skip(f"{filename} not yet created")
    content = path.read_text(encoding="utf-8")
    matches = LEGACY_PATTERN.findall(content)
    assert matches == [], (
        f"{filename} contains legacy hardcoded credentials: {matches}. "
        "Use env-driven DSN (PGHOST/PGUSER/PGDATABASE + ~/.pgpass) per GIS-04."
    )


@pytest.mark.phase19
def test_no_unlisted_python_files_with_legacy_dsn() -> None:
    """Catch any future ``scripts/gis/*.py`` that bypasses the watch-list.

    The grandfather list above is hand-maintained. If a new loader is added
    that contains the legacy credentials AND the author forgets to add it
    to ``PHASE_19_LOADER_FILES``, this test fails — covering the gap.
    """
    listed = set(PHASE_19_LOADER_FILES)
    for path in sorted(GIS_DIR.glob("*.py")):
        if path.name in listed or path.name == "__init__.py":
            continue
        content = path.read_text(encoding="utf-8")
        matches = LEGACY_PATTERN.findall(content)
        assert matches == [], (
            f"{path.name} is not in PHASE_19_LOADER_FILES but contains "
            f"legacy credentials: {matches}. Add it to the grandfather list "
            "AND remediate (env-DSN port OR explicit DEPRECATED stub)."
        )
