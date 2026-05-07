# Parthenon Ingestion Templates — Phase 4, Plan 6: HL7 FHIR Bulk Data reader (streaming claims)

> **For agentic workers:** Use `superpowers:subagent-driven-development`. Steps use checkbox tracking.

**Goal:** Add a streaming-ingest path for `claims_to_omop` so customers with FHIR Bulk Data endpoints can feed Parthenon without a batch X12 837 export. Reader-only scope (Q8) — real-time analytics is a separate subproject.

**Architecture:**

- **Reader node:** `FhirBulkClaimsReader` implements the `bulkdata-1.0.0` profile: kickoff request → polling for status → ndjson chunk download → SQL stage hand-off. Lives in `templates/runtime/nodes/fhir_bulk_claims_reader.py` (community-tier shell + commercial impl in `templates/commercial/runtime/commercial/fhir/bulk_claims_reader.py`).
- **Manifest:** `templates/manifests/_commercial/claims_to_omop_streaming/manifest.yaml` chains `FhirBulkClaimsReader` → existing Plan 1 SQL stages.
- **Auth:** SMART-on-FHIR Backend Services (JWT-based); reuses the existing `FhirConnection` model from the Phase 3 FHIR work.
- **Consumed resources:** `Claim`, `ExplanationOfBenefit`, `Coverage`. Maps the same surface as the X12 837 reader to `DRUG_EXPOSURE` / `PROCEDURE_OCCURRENCE` / `COST` / `CONDITION_OCCURRENCE` / `VISIT_OCCURRENCE` per ADR 0016.
- **Test corpus:** Synthea-generated bulk export (already used by other plans); IGs vary by vendor so production customers bring their own profile.

**Tech Stack:** Python (commercial wheel), httpx for async polling, ijson for streaming ndjson, the existing `claims_to_omop` SQL stages.

**Depends on:** Phase 3 closed; `FhirConnection` model from prior FHIR work.

**Unblocks:** Real-time Analytics subproject (separate charter).

---

## Conventions

- Branch: `feature/phase-4-plan-6-fhir-bulk-data-reader`.
- Type names: `FhirBulkClaimsReader`, `BulkExportClient`, `BulkExportPoller`.
- Default poll interval 5s, max wait 4 hours, exponential backoff with jitter.

---

## Task index (10 tasks)

1. **`BulkExportClient`** — async kickoff + polling helpers. `kickoff(group_id, since=None) -> {content_location, ...}`. `poll(content_location) -> StatusResponse` with states `pending` / `in-progress` / `completed` / `error`. Honors `Retry-After`.
2. **`BulkExportPoller`** — wraps `BulkExportClient.poll` with exponential backoff + max-wait. Returns the manifest of ndjson URLs when status is `completed`.
3. **`NdjsonStreamDownloader`** — async download + ijson streaming. Yields parsed FHIR resources one at a time so we don't load multi-GB ndjson into memory.
4. **`FhirBulkClaimsReader` node** — `read(connection_id, group_id, since=None)`: kickoff → poll → stream-download → emit FHIR resources to the next stage. Implements the existing `Node` interface from Phase 1.
5. **Resource → SQL adapter** — `bulk_to_x12_shape.py` projects each FHIR `Claim` / `EOB` / `Coverage` into the same row shape the existing `claims_to_omop` SQL stages expect. Reuses Plan 1's column names so the SQL stages don't change.
6. **Manifest** — `templates/manifests/_commercial/claims_to_omop_streaming/manifest.yaml` chains `FhirBulkClaimsReader` → adapter → existing SQL stages.
7. **Connection wiring** — `app.fhir_connections` already exists; reuse for auth. Reader looks up the connection by `--connection-id` flag; supports SMART-on-FHIR Backend Services JWT.
8. **Synthea fixture E2E** — `templates/tests/e2e/test_claims_to_omop_streaming.py` runs Synthea bulk-export against a recorded fixture (no live network). Asserts the same OMOP row counts as the batch X12 837 path.
9. **HIGHSEC §7 PHI guard** — Bulk export bundles PHI; the reader MUST run inside a customer-controlled environment. Add a `--ack-phi` flag check that requires `PARTHENON_ALLOW_PHI=1` env var. Default behavior aborts with a clear error.
10. **Devlog + ADR 0016 amendment** — extend ADR 0016 (claims_to_omop) with the streaming companion path. Devlog at `docs/devlog/modules/2026-XX-XX-fhir-bulk-data-streaming-claims.md`.

---

## Done

After Task 10: streaming reader + manifest + Synthea E2E + ADR 0016 amendment. Customers with FHIR Bulk Data endpoints can run the streaming companion alongside the batch X12 path.

**Out of scope reminder:** real-time scoring / cohort feedback against the streaming claims is the Real-time Analytics subproject. This plan ships the read path only.
