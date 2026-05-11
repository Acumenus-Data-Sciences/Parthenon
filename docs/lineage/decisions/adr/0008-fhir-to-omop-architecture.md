# ADR 0008 — FHIR→OMOP Architecture and IG Pin

## Status

Accepted, 2026-05-03.

## Context

Devplan T-015 splits the FHIR→OMOP work into three reviewable PRs:

- **PR-A (Plan 5, this slice):** Patient + Encounter + Condition + Observation
- **PR-B (Plan 6):** Procedure + Medication* + Immunization
- **PR-C (Plan 7):** DiagnosticReport + Consent + performance + closeout

This ADR documents the architecture that all three PRs share: per-resource
mapper modules, the IG snapshot file, the staging-map approach to
person_id/visit_occurrence_id resolution, the unmapped-concept queue, and
the IG version pin policy.

## Decision

### 1. Per-resource mapper modules

Each FHIR resource type that maps to an OMOP table gets its own module
under `runtime/fhir_to_omop/`:

- `patient.py` — Patient → PERSON
- `encounter.py` — Encounter → VISIT_OCCURRENCE
- `condition.py` — Condition → CONDITION_OCCURRENCE
- `observation.py` — Observation → MEASUREMENT or OBSERVATION (split)
- (PR-B) `procedure.py`, `medication.py`, `immunization.py`
- (PR-C) `diagnostic_report.py`, `consent.py`

Each module exports a `map_<resource>(fhir_dict, resolver) -> <Row>`
function that returns a Pydantic dataclass. The manifest's PythonNode for
that resource imports the function and applies it row-by-row.

This shape lets us:

- Unit-test mappers in isolation against a sqlite-backed `ConceptResolver`
  (no Postgres needed for the bulk of the test surface).
- Add new resources without touching existing mappers.
- Run the cross-resource referential integrity test
  (`test_fhir_to_omop_referential_integrity.py`) against all mappers
  in-process before any DB write.

### 2. IG snapshot file as authority

`runtime/fhir_to_omop/ig/v0.1.0-parthenon.json` is the single source of
truth for FHIR-system-URI → OMOP-vocabulary_id mappings, the
Encounter.class → visit_concept_id table, and the Observation category
split. The file is pinned to a curated snapshot of the HL7 FHIR-OMOP IG.

Per spec decision Q9: **a single IG version pin across PR-A/B/C**. Bumps
require an ADR amendment (this ADR). Customers running customized IGs need
to fork the snapshot file; we don't ship a per-customer IG selector.

### 3. ConceptResolver: cache + strict mode + vocabulary override

`ConceptResolver` resolves `(system, code) → concept_id` by:

1. Looking up the OMOP `vocabulary_id` for the `system` URI in the IG
   snapshot.
2. Querying `vocab.concept WHERE vocabulary_id = ? AND concept_code = ?
   AND (standard_concept = 'S' OR standard_concept IS NULL)`.
3. Caching the result in-process for the resolver's lifetime.

Misses return 0 (OMOP "no matching concept") in non-strict mode, or raise
`UnmappedConceptError` in strict mode. Strict mode is parameterized at the
manifest level (`strict_concept_resolution`) and defaults to `false` for
PR-A; PR-C may flip the default after profiling.

`resolve_with_vocabulary(vocabulary_id, code)` exists as an explicit
override for cases where the FHIR system URI is ambiguous — the OMB
category OID `urn:oid:2.16.840.1.113883.6.238` is used for both Race AND
Ethnicity codings, so the patient mapper routes by extension URL rather
than system URI for race/ethnicity.

### 4. Staging-map for person_id/visit_occurrence_id

Mappers do NOT resolve `person_id` directly. They emit
`person_source_value` (the FHIR Patient.id string), and the manifest's
`load_to_cdm` PythonNode builds a `{person_source_value → person_id}` map
during PERSON inserts and uses it to fill `person_id` on subsequent
inserts.

Same pattern for `visit_occurrence_id` from `visit_source_value`.

**Rejected alternatives:**

- **JOIN on every INSERT.** Would require subqueries per row; fine for
  hundreds of resources, slow for millions. Plan 7 PR-C will benchmark.
- **Bulk COPY then UPDATE.** Faster but needs idempotency tracking that
  doesn't exist in PR-A scope. Plan 7 follow-up.

### 5. Unmapped-concept queue

When a code fails to resolve and the run is non-strict, PR-B will write a
row to `app.unmapped_concepts_queue` (shipped in Plan 5 Task 6). The
existing Laravel `MappingReviewController` flow surfaces queued rows to a
human reviewer. Phase 1 does NOT call any AI mapping pathway (devplan §6.7).

PR-A logs unmapped codes but does NOT write to the queue — that wiring
happens in PR-B.

### 6. Observation split by category

OMOP CDM splits FHIR Observations into two tables based on what they
measure: MEASUREMENT for vital-signs/labs/imaging/exam (quantitative),
OBSERVATION for social-history/family-history/surveys/notes (qualitative).

The IG snapshot's `observation_split_to_measurement_when_categories` list
encodes this. Resources whose `category[].coding[].code` matches the list
go to MEASUREMENT; everything else (including missing category) goes to
OBSERVATION.

### 7. PR-A scope deferral

PR-A intentionally does NOT cover:

- Procedure (PR-B; needs CPT/HCPCS resolution)
- Medication* (PR-B; needs RxNorm + dose unit resolution)
- Immunization (PR-B; CVX → RxNorm via UMLS, multi-hop)
- DiagnosticReport (PR-C; references Observations + Specimens)
- Consent (PR-C; needs OMOP NOTE table + classification)
- 1M-Observation performance benchmark (PR-C)

Each is documented in the README's Limitations section so customers know
what they're getting in PR-A.

## Consequences

### Positive

- Mappers are pure, testable functions — no DB state, no orchestration glue.
- IG snapshot file is human-readable; bumps are reviewable diffs.
- Staging maps mean the loader is a single sequential pass (no retries on
  FK violations).
- Cross-resource integrity test catches orphaned references before any
  DB write.

### Negative

- In-memory staging maps don't scale beyond ~10M Patients per run.
  Plan 7 will benchmark and decide on a temp-table approach.
- Per-row INSERTs in `load_to_cdm` are a performance bottleneck for the
  1M-Observation target. Plan 7 PR-C will swap in `pyarrow.parquet` →
  Postgres `COPY` if needed.
- The IG snapshot must be updated by hand (or by a Phase 2 IG-update
  script) when the upstream HL7 FHIR-OMOP IG releases a new version.

## Alternatives considered (declined)

- **Single mega-mapper module.** Rejected: 600+ lines of branchy code,
  hard to test piecewise.
- **FHIRPath evaluator for all field extraction.** Rejected: adds runtime
  cost, partial coverage of FHIR R4 in available Python libs. We use
  inline dict-walking instead, which is faster and easier to debug.
- **AI mapping pathway in Phase 1.** Rejected per spec §6.7: surfaces
  unmapped codes to humans via the queue; AI mapping is a Phase 2+ feature
  with its own evaluation harness.
- **Bumping the IG snapshot per-PR.** Rejected: a single Phase 1 pin
  (v0.1.0-parthenon) keeps PR-A/B/C reviewable as a coherent slice.

## References

- Phase 1 design spec:
  `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 5 (this plan):
  `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-5-fhir-to-omop-pra.md`
- HL7 FHIR-OMOP Implementation Guide:
  <https://github.com/HL7/fhir-omop-ig>
- Devplan T-015: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md`

## Amendment — 2026-05-03 (PR-B: Procedure + Medication + Immunization)

### New decisions

- **Distinct `drug_type_concept_id` per FHIR Medication source**. The four
  FHIR resources (MedicationRequest, MedicationStatement,
  MedicationAdministration, Immunization) all map to OMOP DRUG_EXPOSURE,
  but they describe different pharmacological events. We preserve that
  distinction with distinct OMOP standard `drug_type_concept_id` values:
  - 32839 — EHR prescription (Request)
  - 38000179 — Patient self-reported medication (Statement)
  - 38000180 — Inpatient administration (Administration)
  - 581452 — Immunization (Immunization)

  Rationale: collapsing these would lose the request-vs-administration
  distinction that downstream cohort definitions need.

- **`medicationReference` is NOT supported in Phase 1**. FHIR allows a
  Medication-* resource to reference a separate `Medication` resource via
  `medicationReference`. PR-B only handles `medicationCodeableConcept`
  (inline coding). When a resource uses `medicationReference`, the mapper
  returns `drug_concept_id = 0`. PR-C may add `medicationReference`
  resolution if customers need it.

- **CVX added to the IG snapshot.** The pinned `v0.1.0-parthenon` IG
  snapshot was extended with the CVX system → vocabulary mapping during
  Plan 6 Task 5. This is a content-only addition (no schema change) and
  not considered an IG version bump.

- **IG pin unchanged across PR-A and PR-B**. Per spec decision Q9, the
  `v0.1.0-parthenon` pin holds for the entire Phase 1 fhir_to_omop work.
  No bump in PR-B.

### Implementation notes

- All four medication mappers share `_resolve_medication_concept` and
  `_build_row` helpers in `runtime.fhir_to_omop.medication`. The
  Immunization mapper imports `DrugExposureRow` from this module to
  avoid a parallel type.
- The manifest's `map_medications` node concatenates output from all
  three Medication-* upstreams into a single `drug_exposures_meds.json`
  artifact. The `load_to_cdm` node treats meds and immunizations
  uniformly when INSERTing into DRUG_EXPOSURE.

### Testing

- Per-resource unit tests cover the mapping semantics in isolation
  against in-memory SQLite.
- The PR-B E2E test (`tests/e2e/test_fhir_to_omop_prb.py`) covers the
  manifest end-to-end against a Postgres testcontainer with seeded
  vocab.concept rows. Asserts row counts: PERSON=2, VISIT=2, COND=2,
  MEAS=2, OBS=2, PROCEDURE=1, DRUG_EXPOSURE=2.
