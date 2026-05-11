# ADR 0006 — PRO Instrument Framework Design

## Status

Accepted, 2026-05-03.

## Context

Devplan T-011 calls for a `_shared/pro_base.yaml` partial that future PRO
instrument templates (PHQ-9, GAD-7, PROMIS, KCCQ-12) inherit, with the
acceptance criterion "exercised by at least 2 instruments." Phase 1 ships
EQ-5D-5L (full) and EQ-5D-3L (scaffold) as the two instruments.

The implementation choice — whether the "shared partial" is YAML-with-anchors,
a manifest-loader `extends:` feature, or a Python module — has long-term
implications for who maintains the framework and how new instruments are added.

## Decision

### 1. The shared layer is a Python module, not a YAML partial

`runtime.instruments.pro_base` exposes:

- `ItemMapping`, `ProInstrumentDefinition` Pydantic models.
- `MeasurementRow` frozen dataclass.
- `parse_questionnaire_response(qr, definition) -> Iterator[MeasurementRow]`.

Each instrument template's `python` node imports this module from its
`code:` block and calls `parse_questionnaire_response`. The instrument-specific
data (item codes, concept_ids, VAS handling) is constructed locally in the
node's code from manifest parameters.

**Rejected alternatives:**

- **YAML anchors / merge keys.** The manifest JSON Schema (`template.v1.json`)
  doesn't support YAML's anchor expansion — anchors are resolved by the YAML
  loader before the schema sees them, but that introduces hidden coupling
  between manifest authors and YAML library behavior. Hard to reason about.
- **Manifest-loader `extends:` feature.** Would require new schema fields,
  new loader logic, and a recursive resolution step. Significant architectural
  change for a feature that boils down to "DRY a few node configs."
- **A dedicated PR templating language.** Over-engineered for v1.

The Python-module approach is testable in isolation, has zero schema
implications, and lets each instrument template's code be self-contained
and reviewable.

### 2. Each instrument is a separate manifest

Even though both EQ-5D-5L and EQ-5D-3L share most of their structure, they
ship as **two distinct manifest files** rather than one parameterized
manifest. Reasons:

- Manifest IDs are user-visible (in the Aqueduct UI, in run history). Customers
  selecting "EQ-5D-3L" should see EQ-5D-3L, not "EQ-5D (variant=3L)."
- Per-instrument validation packs differ (item value range 1–5 vs 1–3, value
  set CSV path, expected post-condition counts).
- Each instrument has its own README — separately discoverable and citable.

The duplication cost is low (~50 lines per manifest), and the shared
`pro_base` module ensures the projection logic is single-sourced.

### 3. EuroQol value set is customer-supplied

Per spec decision Q4 / §4.5: Parthenon ships the **mapping logic + a
clearly-marked placeholder value set** but never the real EuroQol-licensed
value set. The placeholder file headers explicitly say:

- "PLACEHOLDER VALUE SET — REPLACE WITH YOUR EUROQOL-LICENSED EQ-5D-5L VALUE SET"
- "DIMENSIONAL PLACEHOLDER DATA only"
- "DO NOT use these values for real clinical analysis"

The customer obtains their licensed value set from EuroQol and drops it at the
path passed via `eq5d_value_set_path`. Parthenon never calls EuroQol APIs and
never relicenses EuroQol IP.

### 4. Utility-index derivation is per-instrument

`pro_base.parse_questionnaire_response` produces item-level rows only.
Computing the utility index (the country-specific weight applied to a
profile string) is instrument-specific and lives in the instrument's
`derive_utility_index` PythonNode. EQ-5D-5L ships full derivation; EQ-5D-3L
ships the parse path and defers utility derivation to Phase 2 (the scaffold's
README is explicit about this).

This split keeps `pro_base` small and instrument-agnostic. Adding PHQ-9 or
PROMIS later means adding a new manifest that imports `pro_base` and supplies
its own scoring function — the shared code doesn't grow per-instrument.

### 5. `person_id` is left NULL on inserted rows

Same posture as ADR 0005 (`etl_dicom_metadata`): cross-mapping the FHIR
`Patient.id` to OMOP `person_id` is a Phase 2 `link_person` template's
responsibility. Inserted rows carry the FHIR patient reference in the QR's
`subject.reference`; downstream linking is an UPDATE step.

### 6. Cross-instrument regression test

`tests/unit/test_pro_pattern_reuse.py` parametrizes over the list of PRO
instrument manifests and asserts each one:

- Imports `runtime.instruments.pro_base` in at least one PythonNode.
- Uses `fhir_resource` for ingestion.
- Declares `eq5d_value_set_path` (or instrument-specific equivalent).
- Filters by `questionnaire_url`.

Adding a new PRO instrument means appending its manifest_id to the test's
`INSTRUMENTS` list — the structural conformance is automatically gated.

## Consequences

### Positive

- New PRO instruments are a manifest + (optionally) a small scoring function;
  no framework change required.
- `pro_base` is testable as plain Python code, unit-tested in isolation.
- Customer-supplied value sets keep Parthenon out of EuroQol licensing.
- Two-instrument acceptance criterion is met today; cross-instrument test
  guards future regressions.

### Negative

- Some duplication across instrument manifests (~50 lines each). Acceptable.
- Customers see two files per instrument (manifest + README) instead of one
  parameterized template. Acceptable: discoverability > minimization.
- The EQ-5D-3L scaffold's deferred utility derivation is technical debt for
  Phase 2. Tracked in the scaffold's README explicitly.

## Alternatives considered (declined)

- **Manifest-level `extends:` feature.** Rejected: too much architectural
  surface for a small DRY win; revisit if 5+ PRO instruments materialize.
- **Single `qr_eq5d_to_measurement` parameterized by `variant: 3L|5L`.**
  Rejected: hides which instrument the user selected; complicates
  validation packs; conflates two licensing surfaces (3L and 5L are
  separate EuroQol value sets).
- **`pro_base` ships ready-made instrument definitions for all four PROs.**
  Rejected: forces a single Python module to evolve every time an instrument
  is added; per-instrument manifests are a cleaner extension point.

## References

- Phase 1 design spec:
  `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 3 (this plan):
  `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-3-pro.md`
- Devplan T-011: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` lines 450–467
- EQ-5D instruments & value sets: <https://euroqol.org/eq-5d-instruments/>
- FHIR `QuestionnaireResponse`:
  <https://hl7.org/fhir/R4/questionnaireresponse.html>
- Phase 0 Materializer (parameter interpolation):
  `templates/runtime/registry/materializer.py`
