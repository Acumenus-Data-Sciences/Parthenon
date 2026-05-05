# Phase 1 Security Review — Ingestion Templates

**Reviewer:** _(fill in name + date at sign-off)_
**Status:** Draft
**Scope:** All Phase 1 components introduced by Plans 1–7 of the
parthenon-ingestion-templates milestone (spec:
`docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`).

This review extends the Phase 0 security review
(`templates-phase-0-security.md`) with the new attack surfaces that
Phase 1 introduced. Phase 0 invariants (non-root templates container,
constant-time internal-token comparison, RO manifests mount) are
unchanged and re-verified in CI on every Phase 1 commit.

## Phase 1 surfaces and their guards

### Plan 1 — `AnonymizerNode` + sidecar (T-014 prework)

| Concern | Mitigation | Verified by |
|---|---|---|
| Sidecar must not run as root | Dockerfile USER directive; container security regression test | `docker/parthenon-anonymizer/Dockerfile`; `templates/tests/integration/test_anonymizer_sidecar.py::test_anonymizer_runs_non_root` |
| Sidecar must not need host network | No host port mapping in `docker-compose.yml`; sidecar reachable only from the templates network | `docker-compose.yml` `parthenon-anonymizer` service definition |
| Sidecar must not touch the docker socket | Confirmed by mount inventory | `docker-compose.yml` (no `/var/run/docker.sock`, no `privileged: true`) |
| Read-only rootfs for the sidecar | `read_only: true` + named tmpfs volume for `/tmp` | `docker-compose.yml` |

### Plan 1 — `DicomMetadataNode` (defense in depth: never request pixels)

| Concern | Mitigation | Verified by |
|---|---|---|
| Pixel data must never land in the metadata artifact | Output schema asserts no column matches `*pixel*` regex | `templates/tests/unit/test_dicom_metadata.py::test_artifact_has_no_pixel_columns` |
| QIDO-RS only — no WADO-RS calls | Backend wrapper never constructs WADO URLs | `templates/runtime/nodes/dicom_metadata.py`; `tests/unit/test_dicom_metadata.py::test_dicomweb_never_calls_wado` |
| Filesystem backend ignores PixelData (7FE0,0010) | pydicom dataset traversal whitelists tags | `templates/runtime/nodes/dicom_metadata.py::_filesystem_backend` |

### Plan 1 + Plan 5 — FHIR profile fail-loud (spec Q3)

| Concern | Mitigation | Verified by |
|---|---|---|
| Resource declares `meta.profile` URL outside the run's profile pack -> hard fail | `strict_profile_match=true` raises `ProfileConflictError` | `templates/tests/unit/test_fhir_resource_ndjson.py::test_resource_with_unknown_profile_in_meta_fails_loudly` |

### Plan 2 — Imaging vocabulary namespace (Athena collision-free)

| Concern | Mitigation | Verified by |
|---|---|---|
| Parthenon imaging concepts must not collide with Athena ranges | `concept_id` allocated from `[2_000_000_000, 2_099_999_999]` | `templates/runtime/imaging/vocabulary.py`; ADR 0005 |

### Plan 3 — EuroQol licensing (customer obligation)

| Concern | Mitigation | Verified by |
|---|---|---|
| EQ-5D-5L value set is licensed; we cannot redistribute | Ship a placeholder value set clearly marked PLACEHOLDER; readme + ADR 0006 say customers must supply real data | `templates/runtime/instruments/value_sets/eq5d5l_placeholder.csv` (header banner); `docs/adr/0006-pro-instrument-framework.md` |

### Plan 4 — HIPAA Safe Harbor PHI-leak guard (HIGHSEC regression)

| Concern | Mitigation | Verified by |
|---|---|---|
| No source PHI string survives in anonymized output | `test_no_phi_leaks_through_native_backend` byte-scans every output file for the source PHI tokens | `templates/tests/unit/test_anonymizer_phi_leak.py` |
| dateShift handles FHIR Period (dict) without crashing | `_shift_value` recursively descends dicts/lists | `templates/runtime/nodes/anonymizer_backends/native.py::_shift_value`; tests in `test_native_anonymizer.py` |
| Anonymizer config secrets are surfaced as run failures, not silent fallbacks | Native backend fails closed on missing config; ms backend surfaces SidecarUnavailable | `templates/runtime/nodes/anonymizer_backends/{native,ms}.py` |

### Plan 4 — Anonymizer config redaction (documented limitation)

ADR 0007 documents that the anonymizer config (passed via `parameters`)
is NOT redacted in run logs. Customers are warned in the README; the
operations runbook flags this for ops staff. Resolution is deferred to
Phase 2.

### Plan 5 — `unmapped_concepts_queue` instead of silent fallback

Concept resolution misses route to `app.unmapped_concepts_queue` so
clinical analyses are honest about coverage gaps. The queue is reviewed
through the existing Laravel `MappingReviewController` flow. Phase 1
explicitly does NOT call any AI mapping pathway (devplan §6.7).

### Plan 5 — OMB OID disambiguation (race vs ethnicity)

| Concern | Mitigation | Verified by |
|---|---|---|
| `urn:oid:2.16.840.1.113883.6.238` is shared across Race AND Ethnicity in OMOP | Patient mapper routes by extension URL (us-core race vs us-core ethnicity) and calls `resolve_with_vocabulary(vocabulary_id, code)` to disambiguate | `templates/runtime/fhir_to_omop/patient.py`; `tests/unit/test_fhir_to_omop_patient.py` |

### Plan 6 — Distinct `drug_type_concept_id` per FHIR Medication source

| Concern | Mitigation | Verified by |
|---|---|---|
| Collapsing MedicationRequest / Statement / Administration / Immunization into one DRUG_EXPOSURE row hides the request-vs-administration distinction | Each mapper emits a distinct standard `drug_type_concept_id` (32839 / 38000179 / 38000180 / 581452) | `templates/runtime/fhir_to_omop/{medication,immunization}.py`; ADR 0008 amendment |
| `medicationReference` is silently mapped to a fake concept | NOT supported in Phase 1 — drug_concept_id is set to 0 (sentinel) so cohort definitions can detect the gap | ADR 0008; `templates/runtime/fhir_to_omop/medication.py::_resolve_medication_concept` |

### Plan 7 — Consent never silently dropped

| Concern | Mitigation | Verified by |
|---|---|---|
| A malformed Consent dropped from the ETL is a clinical/legal hazard | Mapper raises `MalformedConsentError` on missing patient, missing provision.type, or unknown provision.type | `templates/runtime/fhir_to_omop/consent.py`; `tests/unit/test_fhir_to_omop_consent.py` |
| Denied consents must be recoverable downstream | Side-channel `ConsentDecision` rows write to `app.consent_decisions`; partial index on `decision='deny'` keeps the cohort-export filter fast | `backend/database/migrations/2026_05_03_130000_create_consent_decisions_table.php` |

### Phase 0 inheritance — three-layer route protection

Plans 5/6/7 all run under the existing Laravel
`auth:sanctum + permission:ingestion.{view,run,delete}` stack. No new
HTTP surface added; no relaxation of HIGHSEC §2 invariants.

### Phase 0 inheritance — Materializer secret-key redaction

Inherited from Phase 0; tested in
`templates/tests/unit/test_materializer.py`. New PR-C parameters
(`consent_permit_concept_id`, `consent_deny_concept_id`) are integers,
not secrets — the secret-key linter (`parthenon-templates
lint-secret-keys --root manifests`) is clean.

### Phase 0 inheritance — DICOMweb auth model

Bearer-token only; mTLS deferred per spec Q8.

## Penetration-style tests on the gate path

The following tests run on every PR; if any of them fails, the security
posture has regressed:

- `tests/unit/test_anonymizer_phi_leak.py` (HIGHSEC PHI invariant)
- `tests/unit/test_dicom_metadata.py::test_artifact_has_no_pixel_columns`
  (HIGHSEC pixel-absence invariant)
- `tests/unit/test_fhir_resource_ndjson.py::test_resource_with_unknown_profile_in_meta_fails_loudly`
  (spec Q3 fail-loud invariant)
- `tests/unit/test_fhir_to_omop_consent.py::test_map_consent_missing_provision_type_raises`
  (Plan 7 never-silently-drop invariant)
- `tests/integration/test_anonymizer_sidecar.py::test_anonymizer_runs_non_root`
  (Plan 1 non-root invariant)
- `tests/unit/test_internal_token.py::test_internal_token_constant_time_compare`
  (Phase 0 timing-safe compare invariant)

## Open issues (carried into Phase 2)

- `medicationReference` resolution is deferred (Phase 2 if customer-driven).
- mTLS for DICOMweb and Laravel↔Python is deferred until customer ask.
- Anonymizer config redaction in run logs is deferred per ADR 0007.
- `prepared/` auto-cleanup post-anonymization is deferred to Phase 2.
- `parthenon_migrator` Postgres role split is still tracked under Plan 1
  follow-ups (deferred — same posture as Phase 0).

## Sign-off block

When the reviewer signs, paste the output of:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q --maxfail=1
uv run parthenon-templates validate-manifests --root manifests
uv run parthenon-templates lint-secret-keys --root manifests
```

and the run summary of the four invariant tests above.
