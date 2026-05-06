# `registry_to_omop_ncdr`

Phase 3 Plan 4C (T-022C). Commercial-tier template that ingests
**ACC's National Cardiovascular Data Registry (NCDR) CathPCI v5.0**
CSV exports and projects to OMOP CDM v5.4 PROCEDURE_OCCURRENCE +
MEASUREMENT + DEVICE_EXPOSURE + CONDITION_OCCURRENCE + EPISODE.

This is the **first commercial-tier template** to populate the OMOP
DEVICE_EXPOSURE table — stent UDI codes resolve to standard Device
concepts via the FDA UDI → SPL → RxNorm-Extension Device path.

## License + access notes

NCDR data is gated behind an **ACC NCDR Participant Agreement**
between the customer and the American College of Cardiology.
Parthenon does NOT redistribute NCDR data, fixtures, or column-spec
excerpts beyond what the manifest test fixtures synthesize.

## Spec version

This template targets **NCDR CathPCI v5.0** column shapes. v4.4 is
out of v0.1 scope — column-map deltas would be a Phase 4 follow-up.

## Vocabulary prerequisites

- `ICD10CM` (pre-op diagnoses)
- `CPT4` / `HCPCS` (procedure codes)
- `SNOMED` (target standard for procedures + conditions)
- `LOINC` (hemodynamic measurements)
- `FDA_UDI` (stent UDI source codes — required for DEVICE_EXPOSURE
  resolution; unmapped UDIs emit `device_concept_id = 0` and preserve
  the source UDI for downstream review)

## UDI → Device concept lookup

The mapping pipeline joins `fmt_ncdr_pci.stent_udis` against
`vocab.concept` (`vocabulary_id = 'FDA_UDI'`) and follows
`concept_relationship 'Maps to'` to a standard Device concept. UDIs
not present in the vocabulary fall back to `device_concept_id = 0`
with the source UDI preserved in `device_source_value`.

## Stent UDI / type list invariant

The reader requires `StentUDIs` and `StentTypes` to be parallel
semicolon-delimited lists of equal length. The DB enforces the same
via a `CHECK (cardinality(stent_udis) = cardinality(stent_types))`
constraint on `fmt_ncdr_pci`.

## Acceptance gates (validation E2E)

- 100% of CSV rows produce typed NCDRRecords (or fail-closed on
  parallel-list mismatch / invalid date / out-of-range field).
- Every PCI with `stent_count > 0` produces ≥ stent_count
  DEVICE_EXPOSURE rows.
- Pre-op + postop conditions both populated.
- One MEASUREMENT row per (patient, EF) and (patient, cardiac index).

## See also

- ADR 0017 — `registry_to_omop` strategy
- `column_map.csv` — NCDR field → OMOP destination
- Plan 4B (STS) — sister sub-template
