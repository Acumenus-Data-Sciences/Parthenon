"""STS Adult Cardiac Surgery Database ETL — Phase 3 Plan 4B (T-022B).

Projects STS National Database CSV exports to OMOP CDM v5.4
PROCEDURE_OCCURRENCE + CONDITION_OCCURRENCE + EPISODE. No upstream
OHDSI ETL exists for STS; we maintain the column-mapping table
(``column_map.csv``) ourselves against the STS Adult Cardiac Surgery
v4.20.2 spec.

License caveats: STS exports require an STS Participant Agreement
between the customer and the Society of Thoracic Surgeons. Parthenon
does not redistribute STS data; we ingest exports the customer
provides.
"""

from __future__ import annotations
