# ADR 0004 — Phase 1 Node Design

## Status

Accepted, 2026-05-03.

## Context

Phase 1 of the Parthenon ingestion templates initiative ships three new node
types that all subsequent Phase 1 templates depend on:

- `fhir_resource` — ingest FHIR R4 resources via Bulk Data NDJSON or paginated search.
- `dicom_metadata` — stream DICOM metadata only (pixels never copied).
- `anonymizer` — anonymize a directory of FHIR resources via a pluggable backend.

The Phase 0 Node SDK (ADR 0001) established the `Node` ABC, `NodeContext`,
`NodeResult`, and the `type_name` registration pattern. Phase 1 must build on
that surface without bending it; if a Phase 1 node forces an SDK change, that
is a deliberate ADR amendment, not a silent extension.

## Decision

### 1. No SDK changes for Phase 1

All three new nodes implement the existing `Node` ABC. They register their
`type_name` in `runtime.orchestration.node_registry.NODE_REGISTRY` and add
their string to the `template.v1.json` schema's `nodes[].type` enum. The ABC
itself is unchanged.

### 2. FHIR streaming via Bulk Data NDJSON, search as fallback

`FhirResourceNode` supports two source modes:

- `source: ndjson` — read a directory of NDJSON files (one resource type per
  file) produced by a FHIR server's `$export` operation. Streams line-by-line
  with chunked pyarrow ParquetWriter row-groups (5K records/chunk + explicit
  `gc.collect`); never buffers more than one chunk's worth in memory. Memory
  ceiling: <200 MB RSS delta on a 1 GB synthetic bundle (acceptance criterion
  + dedicated harness — `tests/integration/test_fhir_resource_memory.py`).
- `source: search` — paginated REST search via `httpx.Client` with
  bearer-token auth, following Bundle `link[relation=next]` hops.

A future Rust-assisted parser is gated behind profiling (spec decision Q6);
not in this plan.

### 3. Pixel data defense in depth (DICOM)

Three independent enforcement points:

1. `pydicom.dcmread(stop_before_pixels=True)` in the filesystem backend.
2. The DICOMweb backend issues only QIDO-RS calls; WADO-RS is never called.
3. A regression test (`tests/unit/test_dicom_metadata_no_pixels.py`) asserts
   the output Parquet has zero columns matching `*pixel*` (case-insensitive)
   and that the artifact size is below the source DICOM file size.

If a future change ever surfaces pixel-related state, the regression test
fails loudly. Treat any failure as a HIGHSEC blocker.

### 4. FHIR profile selector with strict-match opt-in

`FhirResourceNode` accepts a `profile` parameter naming one of the curated
profile packs (`us-core`, `mcode`, `ips`, `mii`). Resources whose
`resourceType` isn't in the pack are skipped, not failed (so unknown
extensions don't kill ingestion).

When `strict_profile_match: true`, the node also inspects each resource's
`meta.profile` URLs and **fails loudly** if they don't fall under the pack's
declared base URL. This implements spec decision Q3 ("fail loudly on
profile conflict") — clinical data integrity > convenience.

### 5. Anonymizer plug-in interface

`AnonymizerNode` selects between two implementations of the
`AnonymizerBackend` Protocol:

- `ParthenonNativeBackend` — pure Python; deterministic per-patient via
  HMAC(salt, patient_id); supports `redact`, `keep`, `dateShift`,
  `cryptoHash`.
- `MsAnonymizerBackend` — HTTP client to the `parthenon-anonymizer` sidecar
  (MS Tools-for-Health-Data-Anonymization wrapped in FastAPI).

Both backends consume the **same JSON config schema**
(`anonymizer_config.v1.json`). Per spec decision Q7, runtime equivalence
between backends is **semantic** (same fields redacted, date-shifts within
tolerance, preserved fields byte-equal), not bit-identical. A dedicated
equivalence integration test runs in CI when the sidecar is up.

### 6. Sidecar from Parthenon GHCR mirror

The `parthenon-anonymizer` sidecar is built from MS
Tools-for-Health-Data-Anonymization v3.2.1 and **mirrored** to
`ghcr.io/acumenus-data-sciences/parthenon-fhir-anonymizer` (per spec decision Q1).
Air-gap-friendly; no `mcr.microsoft.com` runtime dependency.

Container security: non-root user (uid 10101), read-only root filesystem,
`cap_drop: ALL`, `no-new-privileges`, no published host ports, on the
internal `parthenon` docker network only.

### 7. Salt rotation per run

`AnonymizerNode` generates a fresh 256-bit salt per run via
`secrets.token_hex(32)`. The salt is passed to the backend instance for
that run only. The salt's SHA-256 digest is recorded in
`result.outputs.salt_digest` (lets re-runs prove same/different seed
without leaking the seed); the salt itself is **never** logged or persisted.

## Consequences

### Positive

- Phase 1 templates can compose the three new node types without changing
  the SDK.
- Pixel data leakage is a regression-tested invariant.
- Anonymizer backend swap is a parameter change; no manifest rewrite needed.
- Profile selector makes US Core / mCODE / IPS / MII customers first-class.

### Negative

- The 3-tier pixel defense is verbose; a single point of enforcement would
  be simpler but riskier under future refactor.
- Maintaining curated profile packs per FHIR IG version is ongoing work
  (deferred to Phase 2 auto-generation if customers request more profiles).
- The sidecar adds a long-running container to every Parthenon deployment
  that runs FHIR anonymization; customers without anonymization needs can
  disable it.

## Alternatives considered (declined)

- **In-process .NET via Pythonnet** for the MS Anonymizer. Rejected:
  introduces .NET runtime into the Python container, increases blast radius
  for crashes. Sidecar pattern keeps blast radius bounded.
- **Auto-detect FHIR profile from `meta.profile`**. Rejected: resources
  don't always declare profiles; auto-detect is fragile; explicit per-run
  parameter surfaces ambiguity at submission time.
- **Pull MS Anonymizer image from `mcr.microsoft.com`** at deploy time.
  Rejected: breaks air-gap deployments; mirroring to Parthenon GHCR keeps
  supply chain auditable.
- **Single anonymizer backend (native only)**. Rejected: customers with
  established MS Anonymizer config catalogs need that compatibility for
  zero-rewrite onboarding.

## References

- Phase 1 design spec:
  `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 1 (this plan):
  `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-1-nodes.md`
- Phase 0 Node SDK ADR: `docs/adr/0001-node-sdk-design.md`
- HL7 FHIR Bulk Data Access IG: <https://hl7.org/fhir/uv/bulkdata/>
- pydicom `stop_before_pixels`:
  <https://pydicom.github.io/pydicom/stable/reference/generated/pydicom.dcmread.html>
- MS Tools-for-Health-Data-Anonymization:
  <https://github.com/microsoft/Tools-for-Health-Data-Anonymization>
- DICOMweb QIDO-RS:
  <https://www.dicomstandard.org/using/dicomweb/query-qido-rs/>
- Devplan §4 Phase 1: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` lines 429–541
