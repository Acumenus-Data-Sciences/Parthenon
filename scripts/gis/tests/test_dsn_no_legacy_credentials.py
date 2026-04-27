"""GIS-04 regression guard: NO Phase 19 loader may ship with the legacy
hardcoded DSN. Existing legacy loaders are explicitly grandfathered until
Plan 05 remediation.

The watch-list below covers files that Phase 19 either CREATES (load_ua_county.py,
loader_common.py) or PORTS to env-DSN (load_crosswalk.py, load_geography.py).
Files that don't yet exist SKIP cleanly; this keeps Wave 0 GREEN. Plan 03 adds
load_crosswalk.py / load_geography.py to the watch-list only AFTER porting
them to env-driven DSN. Plan 05 expands the list to the remaining legacy
loaders (load_rucc.py, load_svi.py, load_air_quality.py, load_hospitals.py,
load_all.py, load_real_data.py, fetch_data.py).
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

GIS_DIR = Path(__file__).resolve().parent.parent

# Plan 03 watch-list (Wave 2): all four Phase 19 loaders. ``loader_common.py``
# and ``load_ua_county.py`` are net-new in Plan 03; ``load_crosswalk.py`` and
# ``load_geography.py`` are ported to env-driven DSN in the same plan and
# therefore graduate onto the guard list as soon as they no longer carry the
# legacy ``dbname=ohdsi user=smudoshi password=acumenus`` literals. Plan 05
# expands the list to the remaining legacy loaders (load_rucc.py, load_svi.py,
# load_air_quality.py, load_hospitals.py, load_all.py, load_real_data.py,
# fetch_data.py).
PHASE_19_LOADER_FILES = [
    "load_ua_county.py",
    "loader_common.py",
    "load_crosswalk.py",
    "load_geography.py",
]

LEGACY_PATTERN = re.compile(
    r"dbname=ohdsi|password=acumenus|user=smudoshi", re.IGNORECASE
)


@pytest.mark.phase19
@pytest.mark.parametrize("filename", PHASE_19_LOADER_FILES)
def test_phase19_loader_has_no_legacy_dsn(filename: str) -> None:
    path = GIS_DIR / filename
    if not path.exists():
        pytest.skip(f"{filename} not yet created (Plan 03 RED)")
    content = path.read_text(encoding="utf-8")
    matches = LEGACY_PATTERN.findall(content)
    assert matches == [], (
        f"{filename} contains legacy hardcoded credentials: {matches}. "
        "Use env-driven DSN (PGHOST/PGUSER/PGDATABASE + ~/.pgpass) per GIS-04."
    )
