# Phase 1 — Parthenon Ingestion Templates

**Status:** Engineering-complete (pending sign-off)
**Date span:** 2026-05-03 (single autonomous session)
**Spec:** `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
**Devplan:** §4 T-010 → T-015 (Phase 1 of `PARTHENON_INGESTION_DEVPLAN.md`)

## Goal recap

Phase 1 took the Phase 0 runtime contract (manifests + nodes +
materializer + Prefect backend) and turned it into a usable
ingestion-template suite spanning four data-shape families:

- FHIR R4 ingestion (Bulk Data NDJSON + REST search) — T-010
- DICOM metadata-only ETL (filesystem + DICOMweb backends) — T-013
- Patient-reported outcome instruments (EQ-5D-5L + EQ-5D-3L scaffold) — T-011
- HIPAA Safe Harbor de-identification (native + Microsoft sidecar) — T-014
- FHIR → OMOP CDM projection across 11 FHIR resource types — T-015

Plus the imaging vocabulary loader (T-012) that the DICOM ETL depends
on.

## What shipped

Seven plans, ~130 commits across 8 feature branches, ~50 manifest /
runtime / test files added. Concretely:

- **3 new node types**: `fhir_resource`, `dicom_metadata`, `anonymizer`
- **6 new ingestion templates**:
  - `etl_dicom_metadata` (Plan 2)
  - `load_imaging_vocabulary` (Plan 2)
  - `qr_eq5d5l_to_measurement` (Plan 3)
  - `qr_eq5d3l_to_measurement` (Plan 3 scaffold)
  - `fhir_anonymizer` (Plan 4)
  - `fhir_to_omop` spanning PR-A/B/C (Plans 5/6/7)
- **2 Laravel migrations** under `app.*`:
  - `app.unmapped_concepts_queue` (Plan 5)
  - `app.consent_decisions` (Plan 7)
- **5 ADRs** (0004 Phase 1 nodes, 0005 imaging vocabulary, 0006 PRO
  framework, 0007 fhir_anonymizer, 0008 fhir_to_omop architecture)
- **6 closeout artifacts** (this devlog, security review, DoD
  verification, perf decision, runbook update, sign-off)

## What we learned

### Phase 0's runtime gap was already paid down

The parameter-interpolation + db_dsn-threading work that was patched
mid-Phase-0 (commits across the orchestration factory and SQL node) gave
Phase 1 a runtime that already did the right thing. Plans 5 / 6 / 7
spent zero time on runtime contract issues — the cost lived entirely in
the mapping/projection logic.

### `pyarrow.ParquetWriter` beat `polars.sink_parquet` on the streaming
budget

The 1 GB FHIR Bulk Data ingestion needed <200 MB RSS. polars 1.17's
streaming engine couldn't hit it; we switched to a chunked pyarrow
writer (5K rows per row group, `gc.collect()` after each flush) and
landed at ~85 MB RSS delta. This is documented in ADR 0004.

### The OMB OID is shared across Race AND Ethnicity

The OID `urn:oid:2.16.840.1.113883.6.238` resolves to two OMOP
vocabularies (Race AND Ethnicity). The patient mapper has to route by
us-core extension URL rather than system URI to disambiguate. We added
`ConceptResolver.resolve_with_vocabulary(vocabulary_id, code)` so the
mapper can pick the right vocabulary explicitly. Without this the
patient mapper would silently mis-classify 50% of patients.

### Phase 0's drug_exposure table ships barebones

The Phase 0 `omop` schema bootstrap creates `drug_exposure` without
`SERIAL` or the columns the loader expects. PR-B's E2E test had to drop
and recreate the table inline. PR-C inherits the same pattern.
**Phase 2 follow-up:** factor a richer `omop` bootstrap so per-test DDL
isn't needed for individual templates.

### The PRO instrument framework deliberately doesn't share at the
manifest level

Plan 3 considered Yaml inheritance for the QR templates and rejected it
in favour of a shared Python module (`runtime.instruments.pro_base`).
Templates own their YAML; the parsing + utility-derivation logic lives
in one place. ADR 0006 captures the trade-off. Phase 2's PHQ-9 / GAD-7
will validate the choice.

### The wrapper pattern in `fhir_anonymizer` is an interim trade-off

Plan 4's `fhir_anonymizer` template renames the `anonymize_wrapper` node
back to `anonymize` after summarize, to keep the artifact path stable.
This is documented in ADR 0007 as a wart that Phase 2's cross-node path
resolution work will let us drop.

### Performance: 1M Observations <TBD>s; verdict: **<SHIP|ESCALATE>**

The performance harness (Plan 7 Task 6) is wired and gates on
`elapsed_seconds < 600`. The first nightly run on Darkstar locks the
SHIP/ESCALATE verdict; the perf decision doc records the actual numbers.
Local laptop runs at 10k–100k Observations complete in seconds, and
the implementation hasn't changed since Plan 6 closed except for two
new mappers that emit at most one row per resource — so the expectation
is SHIP, but the paper trail lives in the perf decision doc.

### HIGHSEC posture held throughout

The pixel-absence regression (Plan 1) and PHI-leak regression (Plan 4)
both stayed green across the full Phase 1 commit history. Treat any
future failure as a release blocker; do NOT relax the assertions to
make a refactor land cleaner.

## What's deferred

Phase 2 picks up:

- PHQ-9, GAD-7, PROMIS, KCCQ-12 PRO templates (`pro_base` framework
  already validated by EQ-5D-5L + EQ-5D-3L)
- `medicationReference` resolution in fhir_to_omop
- Cross-node path resolution in the Materializer (lets `fhir_anonymizer`
  drop its wrapper)
- `prepared/` auto-cleanup post-anonymization
- Anonymizer config redaction in run logs
- Auto-track upstream HL7 IG releases
- `parthenon_migrator` Postgres role split (still tracked under Plan 1
  follow-ups)

Phase 3+ picks up:

- DIMSE C-FIND DICOM source
- WADO-RS pixel retrieval template (image-feature extraction)
- mTLS for DICOMweb / Laravel↔Python (deferred until customer ask)
- Claims X12, registries, LIS LOINC harmonizer, AI-assisted mapping

## Acknowledgments

- Devplan author: who shaped T-010 → T-015 with explicit acceptance
  criteria; this Phase 1 closeout is downstream of that clarity.
- Phase 0 contributors: the runtime contract that Phase 1 inherits.
- Orchestrator: claude-flow / Claude Code autonomous loop, which drove
  Plans 1–7 inline through the single 2026-05-03 session.

## What this devlog isn't

Not a CHANGELOG entry. Phase 1 lands as a development milestone; the
customer-facing Parthenon release notes (`backend/resources/changelog.md`)
get a "What's New" entry only when Phase 1 actually ships in a release
build. The Unreleased entry there flags the two new app-schema tables
(`unmapped_concepts_queue`, `consent_decisions`) for ops awareness.
