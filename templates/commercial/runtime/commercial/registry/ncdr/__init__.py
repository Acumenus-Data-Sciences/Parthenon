"""NCDR CathPCI v5.0 ETL — Phase 3 Plan 4C (T-022C).

Projects ACC's National Cardiovascular Data Registry CathPCI v5.0
exports to OMOP CDM v5.4 PROCEDURE_OCCURRENCE + MEASUREMENT (cath
findings) + CONDITION_OCCURRENCE + DEVICE_EXPOSURE (stent UDIs) +
EPISODE.

License: NCDR exports require an ACC NCDR Participant Agreement
between the customer and the American College of Cardiology. Same
shape as STS — Parthenon does not redistribute.

Distinct from Plan 4B (STS): NCDR carries one-to-many lesion + stent
records per PCI, projected to multiple DEVICE_EXPOSURE rows. UDI
codes resolve to OMOP Device concepts via the standard FDA UDI →
SPL → RxNorm-Extension Device path.
"""

from __future__ import annotations
