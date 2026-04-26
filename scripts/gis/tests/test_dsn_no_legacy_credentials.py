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

# Wave 0 watch-list: only files that Phase 19 CREATES net-new. Loaders being
# PORTED (load_crosswalk.py, load_geography.py) are added to this list by
# Plan 03 once they are env-DSN compliant — adding them in Wave 0 would
# trip on the existing pre-remediation literals. Plan 05 expands to the
# rest of scripts/gis/load_*.py.
PHASE_19_LOADER_FILES = [
    "load_ua_county.py",
    "loader_common.py",
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
