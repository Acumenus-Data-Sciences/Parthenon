# Phase 1 — Definition-of-Done Verification

**Reviewer:** _(fill in name + date at sign-off)_
**Status:** Draft
**Scope:** Devplan T-010 → T-015 acceptance criteria, mapped to the
implementations shipped by Plans 1–7 of the
parthenon-ingestion-templates milestone.

Each row cites the test name proving the criterion is met. Commit SHAs
land at sign-off (currently `<commit>` placeholders) by running:

```bash
git log --oneline feature/phase-1-templates-fhir-to-omop-prb..HEAD --reverse \
    > /tmp/phase-1-prc-shas.txt
```

and pasting the resulting SHAs into the table. The pre-PR-C history
(Plans 1–6) has its own SHAs already attached on the merged branches
(`feature/phase-1-templates-{nodes,dicom,pro,fhir-anonymizer,fhir-to-omop-pra,fhir-to-omop-prb}`).

## Acceptance criteria

| Criterion (devplan §) | Implementation | Verifying test | Commit |
|---|---|---|---|
| Three new node types registered (T-010) | `runtime.nodes.{fhir_resource,dicom_metadata,anonymizer}` registered in `NODE_REGISTRY` | `tests/unit/test_orchestration_factory.py::test_phase_1_nodes_registered` | `<commit>` |
| FHIR Bulk Data NDJSON streaming (T-010) | `FhirResourceNode` chunked pyarrow writer (5K rows / chunk + gc) | `tests/unit/test_fhir_resource_ndjson.py::test_streams_ndjson_to_parquet` | `<commit>` |
| FHIR search fallback (T-010) | `FhirResourceNode` REST search backend | `tests/unit/test_fhir_resource_search.py::test_search_paginates_through_bundle` | `<commit>` |
| FHIR profile fail-loud (T-010, spec Q3) | `strict_profile_match=true` raises `ProfileConflictError` | `tests/unit/test_fhir_resource_ndjson.py::test_resource_with_unknown_profile_in_meta_fails_loudly` | `<commit>` |
| FHIR streaming memory budget (T-010) | <200 MB RSS on 1 GB bundle | `tests/integration/test_fhir_resource_memory.py::test_streams_1gb_bundle_under_200mb_rss` | `<commit>` |
| DICOM metadata-only, no pixels (T-013) | Output schema asserts no `*pixel*` columns + 2 layered enforcement tests | `tests/unit/test_dicom_metadata.py::test_artifact_has_no_pixel_columns` | `<commit>` |
| DICOMweb QIDO-RS, no WADO (T-013) | Backend wrapper never calls WADO endpoints | `tests/unit/test_dicom_metadata.py::test_dicomweb_never_calls_wado` | `<commit>` |
| Anonymizer sidecar non-root (T-014) | Dockerfile `USER` directive | `tests/integration/test_anonymizer_sidecar.py::test_anonymizer_runs_non_root` | `<commit>` |
| Anonymizer config v1 schema (T-014) | Pydantic v2 schema with 8 invariants | `tests/unit/test_anonymizer_config.py::test_load_minimal_config` (+7) | `<commit>` |
| Anonymizer backend semantic equivalence (T-014) | Native + MS backends produce equivalent rows on the canonical Patient fixture | `tests/integration/test_anonymizer_backends.py::test_semantic_equivalence_on_patient` | `<commit>` |
| HIPAA Safe Harbor PHI-leak guard (T-014, HIGHSEC) | Byte-scan asserts source PHI tokens absent from output | `tests/unit/test_anonymizer_phi_leak.py::test_no_phi_leaks_through_native_backend` | `<commit>` |
| Imaging vocabulary loads (T-012) | `load_imaging_vocabulary` template runs to completion against testcontainers Postgres | `tests/e2e/test_load_imaging_vocabulary.py::test_load_imaging_vocabulary_runs_to_completion` | `<commit>` |
| DICOM ETL produces image_occurrence (T-013) | `etl_dicom_metadata` template emits ≥3 rows | `tests/e2e/test_etl_dicom_metadata.py::test_etl_dicom_metadata_runs_to_completion` | `<commit>` |
| EQ-5D-5L round-trip + utility (T-011) | `qr_eq5d5l_to_measurement` produces 10 item + 2 VAS + 2 utility rows | `tests/e2e/test_qr_eq5d5l_to_measurement.py::test_eq5d5l_runs_and_derives_utility` | `<commit>` |
| pro_base reuse (T-011) | EQ-5D-5L + EQ-5D-3L scaffold both use shared `pro_base.parse_questionnaire_response` | `tests/unit/test_pro_pattern_reuse.py` (parametrized) | `<commit>` |
| FHIR→OMOP PR-A E2E (T-015 PR-A) | Patient/Encounter/Condition/Observation → CDM rows | `tests/e2e/test_fhir_to_omop_pra.py::test_fhir_to_omop_pra_runs_to_completion` | `<commit>` |
| FHIR→OMOP PR-B E2E (T-015 PR-B) | + Procedure/Medication/Immunization → DRUG_EXPOSURE / PROCEDURE_OCCURRENCE | `tests/e2e/test_fhir_to_omop_prb.py::test_fhir_to_omop_prb_runs_to_completion` | `<commit>` |
| FHIR→OMOP PR-C E2E (T-015 PR-C) | + DiagnosticReport/Consent → OBSERVATION + `app.consent_decisions` | `tests/e2e/test_fhir_to_omop_prc.py::test_fhir_to_omop_prc_runs_to_completion` | `<commit>` |
| 1M Observations < 10 min (T-015) | Performance harness + decision doc | `tests/performance/test_fhir_to_omop_throughput.py::test_1m_observations_under_10_minutes`; `docs/devlog/modules/ingestion/templates-phase-1-perf-decision.md` | `<commit>` |
| Consent never silently dropped (T-015 PR-C, HIGHSEC) | `MalformedConsentError` raised on missing patient / missing or unknown provision.type | `tests/unit/test_fhir_to_omop_consent.py::test_map_consent_missing_provision_type_raises` | `<commit>` |
| All Phase 1 ADRs (0004–0008) present | 5 ADRs accepted | `tests/unit/test_adrs.py` (or `ls docs/adr/000{4,5,6,7,8}-*.md`) | `<commit>` |
| All `parthenon-templates validate-manifests` exit 0 | CI workflow gates the templates job on a clean validate | `.github/workflows/templates.yml` Validate manifests step | n/a (CI) |

## Plan-by-plan summary

- **Plan 1 (T-010):** 3 new node types (`fhir_resource`, `dicom_metadata`, `anonymizer`) shipped; ADR 0004 documents the design. Inherits Phase 0's runtime contract.
- **Plan 2 (T-012, T-013):** `load_imaging_vocabulary` + `etl_dicom_metadata` templates; ADR 0005 fixes the imaging vocabulary namespace allocation.
- **Plan 3 (T-011):** `qr_eq5d5l_to_measurement` template + `qr_eq5d3l_to_measurement` scaffold using a shared `pro_base` module. ADR 0006 documents the framework.
- **Plan 4 (T-014):** `fhir_anonymizer` template with native + MS sidecar backends. ADR 0007 documents the trade-off.
- **Plan 5 (T-015 PR-A):** `fhir_to_omop` PR-A — Patient / Encounter / Condition / Observation. ADR 0008 documents the architecture.
- **Plan 6 (T-015 PR-B):** Procedure / Medication / Immunization mappers added. ADR 0008 amendment captures the four distinct `drug_type_concept_id` values + `medicationReference` deferral.
- **Plan 7 (T-015 PR-C):** DiagnosticReport / Consent mappers, performance harness, performance decision doc, and Phase 1 closeout artifacts (this document, security review, devlog narrative, runbook update, sign-off).

## Open findings (carried into the closeout sign-off)

- 1M-observation perf number lands at the first nightly run on Darkstar.
  Until then the perf decision doc (Task 7) holds a provisional SHIP.
- `medicationReference` resolution is deferred (Phase 2 if customer-driven).
- mTLS for DICOMweb / Laravel↔Python is deferred until customer ask.
- Anonymizer config redaction in run logs is deferred per ADR 0007.
- `prepared/` auto-cleanup post-anonymization deferred to Phase 2.

## Commit-SHA fill-in script

```bash
cd /home/smudoshi/Github/Parthenon
for plan in nodes dicom pro fhir-anonymizer fhir-to-omop-pra fhir-to-omop-prb; do
    echo "=== feature/phase-1-templates-$plan ==="
    git log --oneline feature/phase-1-templates-$plan
done
echo "=== feature/phase-1-templates-fhir-to-omop-prc-and-closeout ==="
git log --oneline feature/phase-1-templates-fhir-to-omop-prb..HEAD --reverse
```

Paste the relevant SHAs into the `<commit>` cells before sign-off.
