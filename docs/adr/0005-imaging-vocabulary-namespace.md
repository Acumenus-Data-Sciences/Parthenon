# ADR 0005 — Imaging Vocabulary Namespace and DICOM ETL Design

## Status

Accepted, 2026-05-03.

## Context

Phase 1 ships two DICOM-domain templates: `load_imaging_vocabulary` and
`etl_dicom_metadata`. The JAMIA reference (Nagy et al. 2025) provides ~9k
custom concepts as a CSV bundle. Two design questions emerge:

1. **Where do these concept_ids live in `vocab.concept`?** Reusing the
   upstream IDs as-is risks collisions with future Athena releases or
   future JAMIA snapshots. Generating UUIDs breaks OMOP's integer-FK
   convention. Picking an ad-hoc range hides the namespace decision.

2. **How does `etl_dicom_metadata` resolve PHI vs DICOM tags that
   contain it?** DICOM PatientName/PatientID/AccessionNumber routinely
   carry PHI. Phase 1's scope is metadata-only ETL; full PHI handling
   is the `fhir_anonymizer` (Plan 4) flow.

## Decision

### 1. Parthenon-namespaced concept_id range

The Parthenon-Imaging vocabulary occupies `[2_000_000_000, 2_099_999_999]`,
a 100M-row range that is well above:

- OMOP standard concept IDs (≤ ~999M)
- Athena's allocation ceiling for non-standard concepts (well below 2B)

`load_imaging_vocabulary` rebases each row's concept_id at load time:
`new_id = concept_id_start + row_offset`, so the namespace is portable
across deployments. The Parthenon-Imaging concepts are explicitly NOT
declared standard (the `standard_concept` column is NULL); they describe
DICOM attributes, not clinical concepts.

### 2. Idempotent re-load via DELETE-then-INSERT

`load_imaging_vocabulary` is `singleton: true`. Re-running with the same
`source_url` deletes prior `Parthenon-Imaging` rows then re-INSERTs from
the bundle. The DELETE is scoped strictly by `vocabulary_id` so Athena
rows are never touched.

The downside: re-runs are not zero-downtime — there is a brief window
where Parthenon-Imaging rows are absent. Acceptable for a vocabulary
load that runs at most weekly. If that becomes a constraint, a future
ADR can introduce a versioned `Parthenon-Imaging-vN` pattern.

### 3. `person_id` left NULL in image_occurrence

The Phase 1 `etl_dicom_metadata` template does not cross-map DICOM
`PatientID` (a string identifier from the imaging system) to OMOP
`person_id` (an integer). That mapping requires a `link_person`
template (Phase 2) that joins via your MPI / EMPI.

Setting `person_id = NULL` is preferable to:

- A best-guess hash mapping (creates unverifiable phantom persons).
- Failing the run when no mapping exists (most early-deployment customers
  haven't built one yet).

A future Phase 2 template will UPDATE these rows in-place once the
mapping is established.

### 4. Defense in depth: pixel data never copied

The DicomMetadataNode (Plan 1 ADR 0004) already enforces this with
three independent checks. This template inherits that guarantee. The
manifest itself contains no reference to pixel-data tags (verified by
the regression test `test_manifest_does_not_reference_pixel_data`).

### 5. Modality concept resolution by code, not by ID

`project_to_imaging_extension` looks up the Modality concept_id in
`vocab.concept` by `concept_code = '(0008|0060)'`, NOT by hardcoded
concept_id. This shields the template from the namespace decision —
re-running `load_imaging_vocabulary` with a different `concept_id_start`
still yields a working ETL.

When the lookup fails (no Parthenon-Imaging row matches), the row is
inserted with `modality_concept_id = 0` (OMOP's "no matching concept"
sentinel) and a warning logged.

## Consequences

### Positive

- Parthenon-Imaging never collides with Athena.
- Re-running `load_imaging_vocabulary` is safe and bounded in scope.
- `etl_dicom_metadata` works against any deployment that has run the
  vocabulary template, regardless of `concept_id_start`.
- Pixel data invariant is preserved via Phase 0+1 layered defense.

### Negative

- Customers running large numbers of Parthenon-namespaced vocabularies
  (>100M concepts) need a new range allocation; not foreseeable in v1.
- Re-load DELETE/INSERT briefly clears Parthenon-Imaging rows; cohort
  queries during that window may see stale results.
- `person_id NULL` reduces analytical join utility until the Phase 2
  link template runs. Documented in the etl_dicom_metadata README's
  Limitations section.

## Alternatives considered (declined)

- **Reuse upstream JAMIA concept_ids as-is.** Rejected: collision risk
  with future Athena allocations.
- **Generate UUIDs and store in concept_code.** Rejected: breaks OMOP
  integer FK convention and OHDSI-tooling compatibility.
- **Insert PatientID hash as person_id.** Rejected: creates phantom
  persons that no downstream cohort can validate. Better to leave NULL
  and surface the gap.
- **Resolve modality concepts by hardcoded concept_id.** Rejected:
  couples the ETL template to a specific load run's offset; portability
  killer.

## References

- Phase 1 design spec:
  `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 2 (this plan):
  `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-2-dicom.md`
- Phase 0 manifest schema: `templates/runtime/registry/schema/template.v1.json`
- Phase 1 Plan 1 ADR (DicomMetadataNode): `docs/adr/0004-phase-1-node-design.md`
- Nagy P. et al., "Breaking data silos: incorporating the DICOM imaging
  standard into the OMOP CDM," JAMIA 2025
- `paulnagy/DICOM2OMOP`: <https://github.com/paulnagy/DICOM2OMOP>
- OMOP CDM v5.4 imaging extension:
  <https://ohdsi.github.io/CommonDataModel/cdm54.html>
