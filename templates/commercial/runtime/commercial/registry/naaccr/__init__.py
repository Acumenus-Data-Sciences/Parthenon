"""NAACCR cancer-registry ETL — Phase 3 Plan 4A (T-022A).

Extends the OHDSI Oncology subgroup's NAACCR ETL (Q7=(a)) by porting
their per-domain SQL into Parthenon's ``sql_file://`` stages, pinned
to a specific upstream commit. See ``ohdsi_pin.txt`` for the pinned
SHA and the upstream-diff workflow at
``.github/workflows/ohdsi-naaccr-diff.yml`` (Plan 4A Task 9).

This v0.1 ships a curated ~80-column subset of NAACCR's 700+ items,
focused on the items that drive OMOP CONDITION_OCCURRENCE + EPISODE +
EPISODE_EVENT projection (per ADR 0017).
"""

from __future__ import annotations
