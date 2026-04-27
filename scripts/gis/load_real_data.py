#!/usr/bin/env python3
"""DEPRECATED — superseded by Phase 19 loaders.

This script targeted the decommissioned ``ohdsi`` database with hardcoded
``smudoshi/acumenus`` credentials, hardcoded ``/home/smudoshi/Github/Parthenon/GIS``
CSV paths, hardcoded PA-only (``state_fips='42'``) filtering, and wrote into
``gis.geography_summary`` rather than the per-person ``gis.external_exposure``
shape that Phase 19 services consume. Its ``load_comorbidity()`` step further
joined ``omop.condition_occurrence`` directly (Acumenus-only) instead of the
multi-source ``gis.patient_geography`` matview now built by Plan 03.

Use these instead (env-driven, multi-source, parthenon-targeted):

  - ``scripts/gis/load_geography.py`` — nationwide county rows
  - ``scripts/gis/load_crosswalk.py`` — multi-source HUD ZIP/tract crosswalk
                                        + ``gis.patient_geography`` matview
  - ``scripts/gis/load_ua_county.py`` — Census 2020 UA county exposures
  - ``scripts/gis/load_svi.py``       — CDC Social Vulnerability Index
  - ``scripts/gis/load_rucc.py``      — USDA Rural-Urban Continuum
  - ``scripts/gis/load_air_quality.py`` — EPA AQS PM2.5 / Ozone
  - ``scripts/gis/load_hospitals.py`` — CMS hospital catchment / distance

See ``scripts/gis/README.md`` for the canonical run order.
"""
import sys


def main() -> int:
    print(__doc__, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
