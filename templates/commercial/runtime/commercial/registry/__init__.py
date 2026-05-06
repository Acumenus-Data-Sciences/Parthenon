"""Commercial-tier registry ETL templates.

Phase 3 Plan 4A/B/C (T-022A/B/C). Subpackage hosts the NAACCR (cancer),
STS (cardiac surgery), and NCDR (cardiovascular) registry → OMOP
projection logic. Each sub-template lives in its own subpackage:

- ``runtime.commercial.registry.naaccr`` (Plan 4A)
- ``runtime.commercial.registry.sts``    (Plan 4B)
- ``runtime.commercial.registry.ncdr``   (Plan 4C)

All three share the manifest partial at
``templates/commercial/manifests/_partials/registry_base.yaml``
(introduced by Plan 4A) for parameter shapes + post_conditions.
"""

from __future__ import annotations
