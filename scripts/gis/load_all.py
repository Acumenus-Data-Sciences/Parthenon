#!/usr/bin/env python3
"""DEPRECATED — superseded by Phase 19 loaders.

This orchestrator targeted the decommissioned ``ohdsi`` database with hard-
coded ``smudoshi/acumenus`` credentials and ran ``create_schema.sql`` via
``psql -U smudoshi -d ohdsi``. The dormant ``gis.*`` schema is now created
by Laravel migrations against ``parthenon``; the canonical run order lives
in ``scripts/gis/README.md``.

Use these instead:

  - ``scripts/gis/load_geography.py`` — nationwide county rows
  - ``scripts/gis/load_crosswalk.py`` — multi-source HUD ZIP/tract crosswalk
                                        + ``gis.patient_geography`` matview
  - ``scripts/gis/load_ua_county.py`` — Census 2020 UA county exposures
  - ``scripts/gis/load_rucc.py``      — USDA Rural-Urban Continuum (per-source)
  - ``scripts/gis/load_svi.py``       — CDC Social Vulnerability Index
  - ``scripts/gis/load_air_quality.py`` — EPA AQS PM2.5 / Ozone
  - ``scripts/gis/load_hospitals.py`` — CMS hospital catchment / distance

Each loader is env-driven (``loader_common.get_dsn()``) and idempotent.
"""
import sys


def main() -> int:
    print(__doc__, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
