# Parthenon Ingestion Templates — Phase 1 Design

**Date:** 2026-05-03
**Status:** Approved 2026-05-03 — 9 review questions settled (§11); ready for per-plan drafting
**Scope:** Phase 1 of `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` (devplan T-010 through T-015)
**Owners:** Platform engineer + 1 ETL engineer (per devplan §4)
**Predecessor:** `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`

---

## 1. Goal

Phase 1 hits **D2E parity on the highest-customer-pull source formats** — FHIR EHR data, DICOM imaging metadata, and patient-reported outcome (PRO) instruments — on top of the foundations Phase 0 just shipped.

Quoting devplan §4 (Phase 1 header) verbatim:

> **Goal:** Hit D2E parity on the highest-customer-pull source formats: FHIR, DICOM, and PRO instruments. By end of phase, customers can ingest FHIR EHR data, DICOM metadata, and EQ-5D-5L questionnaires.

By end of phase Parthenon answers "yes" to the three most common ingestion asks we hear in pre-sales: *"Can it eat our FHIR feed?"*, *"Can it index our DICOM archive without copying pixels?"*, *"Can it map EQ-5D-5L results into the CDM?"*

Concretely, Phase 1 delivers:

- **3 new node types** (T-010): `FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode`. These are the building blocks that every Phase 1 template stands on.
- **5 new templates** (T-011 → T-015):
  - `qr_eq5d5l_to_measurement` (PRO; introduces the shared `pro_base.yaml` partial)
  - `etl_dicom_metadata` (DICOM metadata → OMOP imaging extension)
  - `load_imaging_vocabulary` (custom imaging concepts; precondition for `etl_dicom_metadata`)
  - `fhir_anonymizer` (pre-processing; pluggable backends)
  - `fhir_to_omop` (Patient/Encounter/Condition/Observation/Procedure/Medication/Immunization/DiagnosticReport/Consent → OMOP), split across **3 PRs (A/B/C)**.
- **A shared PRO instrument framework** — `manifests/_shared/pro_base.yaml`. Phase 1 ships one consumer (EQ-5D-5L) plus a scaffold proof for EQ-5D-3L; PHQ-9, GAD-7, PROMIS, KCCQ-12 inherit it in Phase 2.
- **Pluggable anonymization** — both Microsoft FHIR Anonymizer (sidecar `.NET` container) and a Parthenon-native Python redactor, behind one `AnonymizerNode` interface, with a portable rule-config format.

This is **purely additive** to Phase 0. No existing Phase 0 code, manifest, or DB column is changed; the migration intent recorded in Phase 0 §10 (Laravel CSV/FHIR ingestion eventually riding the node SDK) is **not** activated yet — that's a separate cross-cutting concern revisited at the end of Phase 1.

## 2. Decision summary

Phase 1 ships:

1. **Three new nodes** added to `templates/runtime/nodes/` alongside the eight Phase 0 bootstrap nodes. No node-SDK API changes — the existing `Node` ABC and `NodeContext` (devplan T-001, ADR-0001) are sufficient. Adding nodes is exercising the contract, not changing it.
2. **A new shared sub-graph idiom** — `manifests/_shared/pro_base.yaml` — proving the manifest registry's already-supported reusable-partial pattern (devplan T-003, ADR-0003). Phase 0 left `manifests/_shared/` empty as a placeholder; Phase 1 fills it with its first real entry.
3. **An anonymizer plug-in interface** with two implementations:
   - **MS FHIR Anonymizer backend** as a long-running sidecar container (`docker/fhir-anonymizer/`), reachable from `parthenon-templates` over the docker network. The .NET dependency stays containerized; the Python runtime never imports .NET tooling.
   - **Parthenon native backend**, pure Python, reads the same JSON rule-config format MS Anonymizer uses (path-based rules + value transformers), so customers can move between them without rewriting configs.
4. **An FHIR profile selector** — every FHIR-touching template accepts `profile: us-core | mcode | ips | mii` as a parameter. Profile registry is loaded from `fhir.resources` typed models plus a small Parthenon-maintained `profile_packs/` directory bundled in the container image.
5. **CDM v5.3 + v5.4 dual targeting** — every Phase 1 template declares both in `metadata.cdm_versions`, matching the `parthenon-cdm` capability shipped in Phase 0 (T-005).
6. **PR-shape:** **7 plans** (orchestrator-approved), with `T-015` deliberately fanned across plans 5/6/7 to keep each PR reviewable. The dependency chain is **Plan 1 → {2, 3, 4} → 5 → 6 → 7**.
7. **Licensing posture is opt-in throughout.** EQ-5D ships **mapping logic + placeholder value set only**; customers obtain the EuroQol value set themselves (devplan T-011, §9 Q8). MS FHIR Anonymizer is MIT-licensed but its container image must be built/pulled by the customer, not redistributed by Parthenon. FHIR Bulk Data implementations require server-side configuration we cannot ship.

## 3. Decisions log (Q1–Q9)

| # | Question | Chosen | Declined |
|---|---|---|---|
| 1 | Scope of this spec | Phase 1 only (T-010 → T-015) | All remaining phases (too large); just the nodes (T-010) (under-scoped) |
| 2 | Node-SDK changes? | None — existing ABC sufficient; add 3 node implementations only | Bump SDK version to add streaming-source primitive (premature; FHIR streaming is a method on `FhirResourceNode`, not on `Node`) |
| 3 | Where MS Anonymizer runs | Long-running sidecar container, internal docker network | In-process .NET via Pythonnet (introduces .NET runtime into Python container — rejected); ad-hoc shell-out per node call (cold-start cost + crash blast radius) |
| 4 | FHIR profile selection | Per-run parameter; 4 profiles in v1 (US Core, mCODE, IPS, MII) | Hardcode US Core (won't satisfy mCODE/MII customers); auto-detect from bundle (fragile; resources don't always declare meta.profile) |
| 5 | Streaming strategy for FHIR | NDJSON line-iter for `$export`; HTTP page-iter for search | Load entire bundle into memory (devplan acceptance criterion explicitly forbids); Rust-assisted parser in PR-A (premature — defer to PR-C if profiling shows need) |
| 6 | EQ-5D value set distribution | Ship placeholder + mapping logic; document customer obligation in README | Ship a redistributable subset (legally unsafe given EuroQol terms); refuse to ship anything (defeats purpose of the template) |
| 7 | T-015 PR shape | 3 PRs by resource family (A: visit-spine, B: meds-procs, C: reports + perf) | Single PR (~3,500 LoC, unreviewable); per-resource (10+ PRs, too granular) |
| 8 | DICOM ingestion source backends | Filesystem + DICOMweb (QIDO-RS); skip WADO retrieval (metadata-only) | DIMSE C-FIND (legacy, complex auth); single-source (filesystem only — leaves DICOMweb customers stranded) |
| 9 | Imaging vocabulary namespace | Parthenon-namespaced `concept_id` range, pinned upstream version | Reuse Athena `concept_id` allocations (collision risk with future Athena releases); generate UUIDs (breaks OMOP integer FK convention) |

## 4. Architecture

Phase 0's architecture diagram is unchanged. Phase 1 adds:

```
┌─────────────────────────────────────────────────────────────────┐
│  parthenon-templates container (extended)                        │
│  templates/                                                      │
│  ├── runtime/                                                    │
│  │   └── nodes/                                                  │
│  │       ├── (8 bootstrap nodes from Phase 0)                    │
│  │       ├── fhir_resource.py     (NEW — T-010)                  │
│  │       ├── dicom_metadata.py    (NEW — T-010)                  │
│  │       └── anonymizer.py        (NEW — T-010, plug-in iface)   │
│  ├── manifests/                                                  │
│  │   ├── _shared/                                                │
│  │   │   └── pro_base.yaml        (NEW — T-011)                  │
│  │   ├── (4 Phase 0 templates, untouched)                        │
│  │   ├── qr_eq5d5l_to_measurement/  (NEW — T-011)                │
│  │   ├── etl_dicom_metadata/        (NEW — T-012)                │
│  │   ├── load_imaging_vocabulary/   (NEW — T-013)                │
│  │   ├── fhir_anonymizer/           (NEW — T-014)                │
│  │   └── fhir_to_omop/              (NEW — T-015)                │
│  └── profile_packs/                  (NEW — Plan 1)              │
│      ├── us-core.json                                            │
│      ├── mcode.json                                              │
│      ├── ips.json                                                │
│      └── mii.json                                                │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP (anonymizer requests)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  fhir-anonymizer sidecar container (NEW)                         │
│  - MS FHIR Anonymizer (.NET 8, official MS image)                │
│  - Non-root, no network egress (Plan 4 acceptance criterion)     │
│  - Internal docker network only — Laravel cannot reach it        │
└─────────────────────────────────────────────────────────────────┘
```

External integrations introduced in Phase 1:

- **HAPI FHIR test server** — used in CI for the FHIR `$export` integration test (T-010 acceptance criterion). Public test instance pinned by version; ephemeral container preferred where feasible.
- **dcm4chee test instance** — used in CI for the DICOMweb path of `etl_dicom_metadata` (T-012 acceptance criterion). Containerized, ephemeral.

### Key nodal contracts

Each new node honors the Node ABC defined in Phase 0 ADR-0001:

- `FhirResourceNode.execute(ctx)` returns an iterator of typed `fhir.resources` models. Internally chooses between `$export` NDJSON streaming and resource-by-resource search based on `params.source.kind`. Memory profile: streams; never materializes the whole bundle (T-010 acceptance criterion).
- `DicomMetadataNode.execute(ctx)` yields `pydicom.Dataset` instances with `pixel_data` stripped. Source backends: `filesystem` (recursive scan) or `dicomweb` (QIDO-RS). **The pixel-data attribute is dropped before the dataset leaves the node.** This is a defense-in-depth choice on top of "we never request WADO-RS in the first place."
- `AnonymizerNode.execute(ctx)` reads upstream resource stream, applies anonymization via the configured backend, emits transformed resources. The `backend` parameter selects implementation (`ms-anonymizer` | `parthenon-native`). Backend-side rule-config schema is shared.

### New manifest pattern: `_shared` partials

Devplan T-003 and ADR-0003 already permit reusable sub-graphs via the `extends` and `include` manifest keywords. Phase 0 left `_shared/` empty. Phase 1 introduces:

```yaml
# manifests/_shared/pro_base.yaml — quote-skeleton
name: pro_base
description: Reusable PRO instrument projection skeleton — FHIR QuestionnaireResponse → OMOP MEASUREMENT/OBSERVATION.
parameters:
  instrument_oid: { type: string, required: true }
  measurement_concept_id_for_total: { type: integer, required: false }
  value_set_path: { type: string, required: true }
  cdm_version: { type: string, enum: ["5.3", "5.4"], default: "5.4" }
nodes:
  - id: read_qr
    type: fhir-resource
    params:
      resource_type: QuestionnaireResponse
      filter: { questionnaire: "${instrument_oid}" }
  - id: project_items
    type: python
    inputs: [read_qr]
    params:
      script: pro/project_items.py
      value_set_path: "${value_set_path}"
  - id: write_measurement
    type: db-writer
    inputs: [project_items]
    params:
      schema: "${target_schema}"
      table: measurement
```

`qr_eq5d5l_to_measurement/manifest.yaml` then `extends: _shared/pro_base.yaml` and supplies the EQ-5D-5L specifics (instrument OID, value set path, derived utility-index node, EQ-VAS node).

The pattern proves the registry's `extends` capability under load and gives PHQ-9/GAD-7/PROMIS/KCCQ-12 a recipe to follow in Phase 2 (devplan §4 Phase 2).

### Licensing & secrets considerations

| Concern | Spec position |
|---|---|
| **EQ-5D / EuroQol** | Phase 1 ships **mapping logic only**. The shipped value-set table in `qr_eq5d5l_to_measurement/value_sets/eq5d5l_placeholder.csv` is dimensional placeholder data with explicit "Replace with your EuroQol-licensed value set" header rows. README documents the customer's obligation to register with EuroQol. `EUROQOL_LICENSE_KEY` (already enumerated in devplan §5.1) is **not** required by the template at runtime — the template reads from a file the customer drops in. We never call EuroQol APIs. (Open Question 8 in devplan §9 — "confirm shipping mapping logic without value set is consistent with EuroQol terms" — surfaces in Plan 3's PR description.) |
| **FHIR Bulk Data API** | No secrets shipped. Customer provides `bulk_export_endpoint`, `bearer_token` (or `client_credentials`) via standard Parthenon secrets-manager indirection. Already covered by the secrets framework in devplan §5.1. |
| **MS FHIR Anonymizer** | MIT-licensed but distributed via Microsoft's container registry. Parthenon **does not bundle** the image; `docker-compose.yml` references the upstream image tag, customers pull on first start. ADR notes the supply-chain implication. |
| **DICOM imaging vocabulary** | Custom-namespaced concept IDs avoid collision with future Athena. README explicitly states this is **not** a vendor-blessed Athena release — Parthenon-published, derived from Nagy et al. JAMIA 2025. |
| **`PHYSIONET_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`** | Not used in Phase 1. Reserved for Phase 2 (MIMIC, NER). Reference devplan §5.1 — do not redefine. |

### Container security posture

Per HIGHSEC §4.1 (non-root execution mandatory) and devplan T-014 acceptance criteria:

- New `fhir-anonymizer` sidecar runs as non-root user `anonymizer` (UID 1000 in container).
- The sidecar's docker-compose entry sets `network_mode` to the existing internal `parthenon-internal` docker network only — no port published, not reachable from outside the docker network, no outbound egress required (rule configs come in via mounted volume).
- The Parthenon-native anonymizer is a Python module loaded into the existing `parthenon-templates` container — no new privileges.
- DICOM and FHIR nodes need outbound HTTP only to user-configured endpoints; egress is not blanket-blocked but logged.

## 5. Plan breakdown

The orchestrator pre-approved this 7-plan structure. Each plan corresponds to a single PR (with `fhir_to_omop` deliberately fanned across Plans 5/6/7).

| Plan | Scope | Devplan refs | Depends on | Effort |
|---|---|---|---|---|
| **1** | Phase 1 nodes: `FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode` (interface + both backends) + `profile_packs/` registry | T-010 | Phase 0 | M |
| **2** | DICOM stack: `etl_dicom_metadata` template + `load_imaging_vocabulary` template (vocabulary loaded first; ETL template runs against it) | T-012, T-013 | Plan 1, Phase 0 T-008 | M+S |
| **3** | PRO instrument framework: `qr_eq5d5l_to_measurement` template + `_shared/pro_base.yaml` partial + EQ-5D-3L scaffold proof | T-011 | Plan 1 | S |
| **4** | FHIR anonymizer template: `fhir_anonymizer` exposing both backends behind one manifest, with config-format compatibility tests | T-014 | Plan 1 | M |
| **5** | `fhir_to_omop` PR-A: Patient, Encounter, Condition, Observation → PERSON, VISIT_OCCURRENCE, CONDITION_OCCURRENCE, MEASUREMENT/OBSERVATION | T-015 PR-A | Plan 1, Plan 4 | L |
| **6** | `fhir_to_omop` PR-B: Procedure, MedicationStatement, MedicationAdministration, Immunization → PROCEDURE_OCCURRENCE, DRUG_EXPOSURE | T-015 PR-B | Plan 5 | L |
| **7** | `fhir_to_omop` PR-C: DiagnosticReport, Consent, performance path (Rust-assisted bulk-export ingestion **only if** profiling shows Python is the bottleneck) + Phase 1 closeout | T-015 PR-C | Plan 6 | L |

### Dependency graph

```
                ┌─→ Plan 2 (DICOM)
                │
Phase 0 ──→ Plan 1 (nodes) ──┼─→ Plan 3 (PRO/EQ-5D)
                │
                └─→ Plan 4 (FHIR anonymizer) ──→ Plan 5 (fhir_to_omop A) ──→ Plan 6 (B) ──→ Plan 7 (C + closeout)
```

Plans 2, 3, and 4 fan out from Plan 1 and can run in parallel. The `fhir_to_omop` chain (5→6→7) is strictly sequential because each PR builds shared mapping infrastructure the next consumes.

### Per-plan acceptance criteria

Every plan must satisfy:

- **Tests at unit AND integration level**, with `testcontainers` used for any external dependency (Postgres, HAPI, dcm4chee, the anonymizer sidecar).
- **DQD-equivalent post-conditions** for any template that produces CDM rows. The `validation/dqd_checks.yaml` file is non-empty and exercised by E2E.
- **Security non-regressions** verified by HIGHSEC §8 checklist: route protection, non-root containers, no plaintext secrets in logs/JSONB, no new public routes, parameters JSONB redacts secret-shaped fields.
- **Manifest schema v1 compliance** — `parthenon-templates validate-manifests` passes locally and in CI.
- **README per template** covers: what it does, when to use it, parameters, prerequisites, examples, performance budget, license/attribution. Mandatory per devplan §8.
- **Phase 0 DoD §8 items honored** for every new template (validation pack, README, ADR pointer where relevant).

Plan-specific extra acceptance:

| Plan | Extra acceptance criteria |
|---|---|
| 1 | FHIR node memory profile under 200MB on a 1GB synthetic bundle; DICOM node never reads pixel_data attribute (assert via mock); both anonymizer backends produce byte-identical output on a canonical 10-resource fixture. |
| 2 | DICOM fixture (~50 files, 3 modalities) produces correct `image_occurrence` / `image_feature` rows; QIDO-RS path tested against ephemeral dcm4chee container; vocabulary load count matches Nagy et al. expected (5,183 + 3,628 ± fixture variation). |
| 3 | EQ-5D-5L fixture round-trips; `_shared/pro_base.yaml` is exercised by both EQ-5D-5L (real) and EQ-5D-3L (scaffold) — proving reusability per devplan T-011 acceptance. |
| 4 | Both backends produce equivalent output on the test corpus (canonical anonymization config + 100 synthetic patients, devplan T-014 acceptance); container security verified (non-root, no egress). |
| 5 | HL7 FHIR-OMOP IG conformance examples for resource families A round-trip; profile selector tested on both US Core and German MII fixtures; Achilles-equivalent summary passes. |
| 6 | Resource families B added; cumulative conformance suite green; medication mapping validated against RxNorm vocabulary already present in `vocab` schema. |
| 7 | All resource families pass; performance budget hit (1M Observation resources <10 min on 8 vCPU / 32GB reference hardware) — devplan T-015 acceptance criterion; Phase 1 closeout devlog written; OMOP CDM Achilles characterization runs cleanly on the resulting CDM. |

## 6. Key design decisions

### 6.1 No node-SDK changes

The Phase 0 `Node` ABC and `NodeContext` (ADR-0001) provide everything Phase 1 needs: typed input/output, a logger, secrets accessor, db connection factory, artifact writer. Streaming for FHIR is achieved by the node's `execute()` returning an iterator — already supported. Adding nodes is **exercising** the SDK contract under more rigorous load, not changing it. **If a Phase 1 node forces an ABC change, that's a signal to revisit ADR-0001 — flag it as a Phase 1 finding, don't silently bend the contract.**

### 6.2 Pixel data is never copied — defense in depth

Devplan T-010 asserts: *"Pixel data stays in PACS/VNA — never copied."*

We enforce this **three** ways:
1. `DicomMetadataNode` source backends only call QIDO-RS (metadata) and filesystem-stat-style scans, never WADO-RS (pixel retrieval).
2. After `pydicom.dcmread()`, the node calls `del ds.PixelData` / `ds.pop(0x7FE00010, None)` before yielding the dataset. This is belt-and-suspenders against future maintainer accidentally adding a WADO call.
3. Unit test asserts the resulting object never has a `PixelData` attribute, even when given an input file that includes one.

### 6.3 FHIR streaming via Bulk Data, search as fallback

Memory profile is a hard acceptance criterion (devplan T-010: *"FHIR node streams; doesn't load entire bundle into memory"*). The node:

- Prefers FHIR `$export` (Bulk Data API) — server returns NDJSON URLs, node iterates lines, parses one resource at a time. This is what scales to real EHRs.
- Falls back to `_search` with `_count` paging when the source doesn't expose Bulk Data — slower but compatible with smaller deployments.
- Never `json.loads()` an entire bundle file into memory.

### 6.4 Anonymizer plug-in interface

```python
class AnonymizerBackend(ABC):
    @abstractmethod
    def anonymize_resource(self, resource: dict, rule_config: dict) -> dict: ...
```

Two implementations:

- `MsAnonymizerBackend` — POSTs the resource as JSON to the sidecar's `/anonymize` endpoint, awaits the transformed resource. The sidecar exposes the official MS Anonymizer config schema verbatim.
- `ParthenonNativeBackend` — pure Python; reads the same JSON config, walks resource paths, applies value transforms (redact, hash, generalize, shift-date, encrypt). Subset of MS Anonymizer's transformer set; the README enumerates exactly which transformers are supported.

The plug-in interface lets Phase 2 add a third backend (e.g., a federated-DP anonymizer) without changing `AnonymizerNode` or any consuming template.

### 6.5 FHIR profile selector (US Core / mCODE / IPS / MII)

`profile_packs/` ships with four hand-curated JSON files describing per-resource extension/slice rules for the four named profiles. The materializer rejects parameter combinations where the configured profile isn't supported for the resource (e.g., trying to use mCODE rules on `Patient` resources from a German MII bundle would raise validation error).

This is a **selector**, not a profile **validator** — the `fhir.resources` lib already validates structural conformance. The pack tells `fhir_to_omop` which extensions to harvest into OMOP `*_ext`/`*_supplemental` columns and which to drop.

**v1 limitation:** the profile packs are Parthenon-curated, not auto-generated from FHIR ImplementationGuides. Auto-generation deferred to Phase 2 if customers request additional profiles.

### 6.6 CDM v5.3 + v5.4 dual targeting

Every Phase 1 template declares `metadata.cdm_versions: ["5.3", "5.4"]`. The materializer fetches the right DDL from `parthenon-cdm` (Phase 0 T-005) per `cdm_version` parameter. v6.x is explicitly out (devplan §5.4 — "community uptake too low to justify yet"; revisit deferred decision).

Per-template overrides:

| Template | v5.3 | v5.4 | Notes |
|---|---|---|---|
| `qr_eq5d5l_to_measurement` | ✓ | ✓ | MEASUREMENT/OBSERVATION present in both |
| `etl_dicom_metadata` | ✓ | ✓ | Imaging extension is custom; same loader for both core CDM versions |
| `load_imaging_vocabulary` | ✓ | ✓ | Concept tables identical between v5.3 and v5.4 |
| `fhir_anonymizer` | n/a | n/a | Doesn't touch CDM; runs upstream of any ETL |
| `fhir_to_omop` | ✓ | ✓ | Some columns (e.g., `episode` table in v5.4) are guarded by version |

### 6.7 NER is **explicitly out of scope** for Phase 1

Devplan §4 Phase 1 is "Source-format breadth." Devplan §4 Phase 2 (T-019, T-020) is where pluggable NER backends (LLM, SciSpaCy, Llettuce) land. **Phase 1's `fhir_to_omop` does NOT do free-text concept mapping.** Free-text-derived `Observation` and `Condition` resources whose `code` is unmapped fall to the existing `MappingReviewController` flow (Phase 0 untouched), or are dropped with an audit log entry — same as today. Customers who need NER wait for Phase 2. This is a **scope discipline** decision; surface it in PR descriptions to forestall "while we're in there…" creep.

## 7. Out of scope

Explicit non-goals for Phase 1, captured so reviewers and PR authors can push back hard on creep:

| Domain | Status | Why |
|---|---|---|
| **NER backends** (LLM/SciSpaCy/Llettuce) | Phase 2 (T-019, T-020) | Pluggable NER is its own architectural surface; merging it into `fhir_to_omop` couples concerns. |
| **MIMIC ingestion** | Phase 2 (T-022) | Requires PhysioNet credentialed-access flow design — separable from generic FHIR. |
| **ARTEMIS / oncology trial extensions** | Phase 2 / 3 | Different ontology surface; oncology mCODE is partially covered by the Phase 1 profile selector but full oncology extension is later. |
| **SDTM (CDISC)** | Phase 2 (T-023) | Different source format and lifecycle; doesn't share infrastructure with FHIR/DICOM. |
| **Claims data (X12 837/835, NCPDP)** | Phase 3 (T-021) | License-restricted parser landscape (`pyx12` BSD, `bots` GPL); separate ADR. |
| **Patient registries** | Phase 3 | Vertical-specific; deferred until horizontal pieces are sturdy. |
| **LIS / LOINC nuance ingestion** | Phase 3 | LOINC mapping at scale needs Phase 2 NER. |
| **AI-assisted concept mapping integration into templates** | Phase 3 (T-024) | Existing `MappingReviewController` flow continues to handle this; templates don't call into AI mapping in Phase 1. |
| **mTLS Laravel ↔ Python** | Phase 1+ (revisit at end of phase) | Internal token continues to suffice for Phase 1's blast radius. |
| **S3/GCS/Azure storage adapter** | Phase 1+ (revisit at end of phase) | Local volume continues to suffice; adapter design lands when first cloud customer commits. |
| **Webhook-based run notifications** | Phase 1+ | Polling continues; webhook adds delivery-semantics complexity. |
| **OMOP CDM v6.x targets** | Indefinitely deferred (devplan §5.4) | Community uptake too low. |
| **Aqueduct canvas changes** | Phase 1+ | Canvas remains untouched, as in Phase 0. The "custom template emitted from canvas" idea (Phase 0 §10) stays in Phase 1+. |
| **Laravel ingestion migration onto node SDK** | Phase 1+ (Phase 0 §10 migration intent) | Activate after Phase 1 closeout when we have empirical confidence in the SDK at FHIR/DICOM scale. |

## 8. Dependencies on Phase 0

Phase 1 stands on these Phase 0 deliverables. **None of them are modified** — Phase 1 only consumes them. If a Phase 1 plan needs to change a Phase 0 artifact, treat it as an unplanned cross-cutting risk and surface in the plan's PR description.

| Phase 0 artifact | What Phase 1 uses it for |
|---|---|
| **Node SDK ABC** (`templates/runtime/nodes/base.py`, ADR-0001) | New nodes (`FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode`) extend `Node`, take a `NodeContext`. |
| **8 bootstrap nodes** | DICOM template uses `DbWriterNode`, `SqlNode`, `GenericFileNode`. PRO template uses `PythonNode` and `DbWriterNode`. FHIR templates use `DbWriterNode` extensively. |
| **Materializer + Manifest schema v1** (T-003, ADR-0003) | Phase 1 manifests are v1; the new `_shared/pro_base.yaml` exercises the `extends` keyword for the first time. |
| **Prefect backend** (T-002, ADR-0002) | `fhir_to_omop` will exercise long-running flows (>1M resources) — first real load test of the Prefect adapter. |
| **`parthenon-cdm` package** (T-005) | Every CDM-touching Phase 1 template asks `parthenon-cdm` for v5.3 or v5.4 DDL on bootstrap. |
| **`parthenon-templates` Docker container** | Phase 1 adds files inside the existing image; Plan 4 adds a *new sibling* sidecar (`fhir-anonymizer`) — it's **not** an edit to the templates container itself. |
| **Laravel `/api/v1/ingestion/templates/*` endpoints** | Phase 1 templates appear in the catalog automatically — no Laravel code changes required. The catalog sync (`php artisan templates:sync`) picks them up. |
| **`app.template_runs` table** | Phase 1 runs persist here. No schema changes required for Phase 1 templates. |
| **Aqueduct UI sub-tabs** (Mappings / Templates / Runs) | Phase 1 templates render via the existing `AqueductTemplatesPage`. Parameter forms are JSON-Schema-driven, no new React components needed for the standard parameter shapes. |
| **Internal-token auth** (Laravel ↔ Python) | Reused; mTLS upgrade still deferred. |
| **Pre-commit hook + manifest validation CLI** | Extended with `parthenon-templates lint-fhir-profiles` to validate `profile_packs/*.json` shape, but the existing manifest validator handles the new manifests as-is. |
| **Feature flag `ingestion.templates_enabled`** | New templates ship behind the existing flag — toggling is atomic across Phase 0 and Phase 1 templates. **No per-template flag** unless a customer explicitly asks; revisit if anonymizer gets gated separately for compliance reasons. |

### Anti-coupling guardrails

- **Phase 1 plans must not edit Phase 0 manifests** (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`). If a refactor surfaces, raise it as an out-of-scope finding and ship the Phase 1 work first.
- **Phase 1 plans must not edit Phase 0 nodes** (the 8 bootstrap nodes). New nodes only. Same rationale.
- **Phase 1 plans must not change `app.template_runs` or `app.ingestion_jobs`** schema. New columns are a Phase-1-end design decision, not mid-phase scope.

## 9. Rollout

### Milestone shape (~12 weeks)

| Week | Plan | Deliverable |
|---|---|---|
| 1–3 | Plan 1 | `FhirResourceNode`, `DicomMetadataNode`, `AnonymizerNode` (both backends) merged. Profile packs registered. Unit + integration tests against HAPI / dcm4chee / `fhir-anonymizer` ephemerals green in CI. |
| 4–5 | Plans 2, 3, 4 in parallel | DICOM stack, PRO/EQ-5D, FHIR anonymizer template merged. `_shared/pro_base.yaml` shipped. |
| 5–8 | Plan 5 | `fhir_to_omop` PR-A — Patient/Encounter/Condition/Observation. HL7 FHIR-OMOP IG conformance suite green for these resource families. |
| 7–10 | Plan 6 | `fhir_to_omop` PR-B — Procedure/Medication/Immunization. Cumulative conformance suite green. |
| 9–12 | Plan 7 | `fhir_to_omop` PR-C — DiagnosticReport/Consent + performance path. Achilles-equivalent characterization green on resulting CDM. Phase 1 closeout devlog. |

Critical-path sequencing rule: Plans 2/3/4 are explicitly parallel; Plans 5/6/7 are explicitly serial. **Do not** start Plan 5 until Plan 4 lands — `fhir_to_omop` PR-A's tests assume the anonymizer is composable upstream.

### Definition of Done for Phase 1

The milestone is DONE when **all** of the following are true:

- [ ] All 5 new templates (`qr_eq5d5l_to_measurement`, `etl_dicom_metadata`, `load_imaging_vocabulary`, `fhir_anonymizer`, `fhir_to_omop`) appear in the catalog and render parameter forms.
- [ ] Each template runs end-to-end against fixture sources (devplan §6.2 redistributable fixtures only) on a clean Postgres instance.
- [ ] Each template has a validation pack (`templates/<id>/validation/`) and the pack runs green per devplan §6.4.
- [ ] Each template has a `README.md` covering: what it does, when to use it, parameters, prerequisites, examples, **performance budget**, limitations, license/attribution.
- [ ] All 3 new nodes have unit tests with >90% line coverage and pass `mypy --strict`.
- [ ] FHIR profile selector tested on both US Core and German MII fixtures (devplan T-015 acceptance).
- [ ] `fhir_to_omop` performance budget met: 1M Observation resources in <10 minutes on reference hardware (8 vCPU, 32GB).
- [ ] HL7 FHIR-OMOP IG conformance examples round-trip correctly across all resource families.
- [ ] DICOM template ingests a fixture directory (~50 files, 3 modalities) and produces correct imaging-extension rows that resolve to `concept_id`s loaded by `load_imaging_vocabulary`.
- [ ] Both anonymizer backends produce equivalent output on the canonical test corpus (100 synthetic patients).
- [ ] `_shared/pro_base.yaml` is exercised by ≥2 instruments (EQ-5D-5L real + EQ-5D-3L scaffold).
- [ ] Anonymizer sidecar runs non-root, no network egress (verified by docker-compose config inspection).
- [ ] DICOM pixel data never copied (verified by unit test asserting absent `PixelData` attribute).
- [ ] FHIR Bulk Data path memory-profiled: <200MB RSS for a 1GB synthetic NDJSON bundle.
- [ ] Phase 0 templates still pass their validation packs (regression check).
- [ ] Security review passes (HIGHSEC §8): three-layer route protection, all containers non-root, secrets never logged, parameters JSONB redacts secret-shaped fields.
- [ ] Devlog written under `docs/devlog/modules/ingestion/templates-phase-1.md`.
- [ ] Reviewed by ≥1 platform engineer + ≥1 ETL engineer per Plan.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| **HAPI test server flake in CI** | Pin specific HAPI image tag; testcontainers retry policy; fall back to vendored HAPI fixture bundle (Synthea-derived) if HAPI unavailable. |
| **MS FHIR Anonymizer image cold-start latency** in CI | Sidecar container starts at job init, kept warm across tests. Health-check before first test. |
| **EQ-5D licensing surprise** (EuroQol pushback on shipped mapping logic) | Spec position is "logic only, no value set" (devplan §9 Q8). PR description explicitly asks for legal sign-off before merge. |
| **`fhir_to_omop` performance budget miss** | Plan 7 includes Rust-assisted bulk-export ingestion as a contingency. Profile early in Plan 5 to surface bottlenecks before Plan 6 stacks on top. |
| **Profile pack drift** between Parthenon-curated and upstream FHIR IGs | ADR documents the manual curation; CI lints `profile_packs/*.json` shape; Phase 2 follow-up auto-generates from official IGs. |
| **DICOM tag set drift** vs. Nagy et al. JAMIA reference | Pin upstream version; bumping is a deliberate manifest update (devplan T-013 acceptance). |
| **Plan 5/6/7 PR review fatigue** | PR template includes "what changed since previous PR" section; reviewer rotation across A/B/C. |
| **Worktree-based mechanical sweeps clobbering new code** | Per `feedback_worktree_sweep_regressions.md` and `.claude/rules/common/agents.md` Worktree Agent Protocol — rebase any sweep onto main before merge; sequential commits preferred over long-lived worktrees. |
| **Phase 1 plans editing Phase 0 artifacts under pressure** | Anti-coupling guardrails in §8; PR template asks "does this PR touch any Phase 0 file?" with a justification field. |

## 10. Deferred decisions / V2 candidates

Captured for future iteration. Each was actively considered and ruled out for Phase 1.

### Architecture

- **mTLS between Laravel and Python.** Already deferred from Phase 0; revisit at Phase 1 closeout.
- **S3/GCS/Azure storage adapter.** Already deferred from Phase 0; revisit at Phase 1 closeout when first cloud customer commits.
- **Webhook-based run notifications.** Polling continues to suffice; revisit when poll volume becomes a CPU/network concern.
- **Sidecar Prefect server.** Phase 0 deferred; Phase 1 doesn't change this — single-container Prefect continues. Revisit when scaling justifies independent Prefect resource budgets.
- **In-process .NET via Pythonnet for anonymizer.** Considered; rejected (Decision Q3). Revisit only if sidecar IPC overhead becomes a measured bottleneck.
- **Auto-generated profile packs** from official FHIR ImplementationGuides. Phase 2 candidate; only justified if customers request profiles outside the v1 set of four.

### Templates

- **More PRO instruments** (PHQ-9, GAD-7, PROMIS, KCCQ-12). All scaffolded by `_shared/pro_base.yaml` in Phase 1; Phase 2 implements the full set.
- **DIMSE C-FIND** as a third DICOM source backend. Filesystem + DICOMweb covers most modern customers; legacy DIMSE is Phase 3 if asked.
- **WADO-RS pixel retrieval** for image-feature templates. Explicitly out per "pixels never copied" — a separate "image-feature extraction" template line is a Phase 3+ topic that would make WADO use a deliberate, audited choice.
- **OMOP CDM v6.x targets.** Indefinitely deferred (devplan §5.4).

### Data model

- **Per-template feature flags.** Phase 1 reuses the existing `ingestion.templates_enabled` master flag. Per-template flags revisit if anonymizer needs separate compliance gating.
- **`app.template_runs.fhir_profile` first-class column.** Currently lives in `parameters` JSONB. Revisit if dashboard filters by profile become common.

### Testing

- **Conformance suite as a published library.** Phase 1 ships HL7 FHIR-OMOP IG conformance examples in-repo. Revisit if the suite becomes valuable to external authors (Workstream 4 Parthenon-Certified).
- **Synthea-larger fixtures** beyond the 1GB synthetic bundle. Revisit if customer-scale profiling reveals scaling cliffs.

### Licensing

- **EuroQol-licensed value set distribution mechanism.** Currently customer-supplied via mounted file. Revisit if a "managed value-set service" customer ask emerges.
- **Parthenon-Certified template author program.** Already a Workstream 4 deferred item; Phase 1 doesn't change posture.

## 11. Review questions — settled (2026-05-03)

The 9 review questions surfaced during spec drafting were settled by the orchestrator (Dr. Udoshi). Devplan §9 questions still apply (esp. Q8 EuroQol, Q3 orchestration default — those are Phase-0/2-level and not relitigated here).

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | MS FHIR Anonymizer image distribution | **Mirror to Parthenon GHCR.** | Air-gap-friendly per project posture; no external dependency on `mcr.microsoft.com` at deploy time. |
| 2 | Profile pack curation cadence | **Pin per Phase.** Phase 1 ships US Core / mCODE / IPS / MII at fixed versions. | Bumps are deliberate plan items (matches Plan 1's pyomop pinning pattern). |
| 3 | `fhir_to_omop` profile-conflict behavior | **Fail loudly.** | Clinical-data integrity > convenience. Silent coercion is a footgun; customers should know when their profile assumption breaks. Aligns with global rule "fail loudly in dev." |
| 4 | EQ-5D-3L scaffold proof in Phase 1 | **Include in Plan 3.** | Devplan T-011 acceptance criterion explicitly requires "at least 2 instruments exercising `_shared/pro_base.yaml`." Cheap once the framework is being built. |
| 5 | Performance reference hardware | **"8 vCPU / 32 GB RAM, NVMe-class disk"** as the generic target; benchmarks run on the Parthenon CI runner / n8n test VM (Darkstar). | Don't pin a cloud SKU — keeps the spec portable. Footnote the actual benchmark target. |
| 6 | Plan 7 Rust-assisted bulk-export | **Conditional on profiling.** Python with `httpx.stream` + multiprocessing is the default; switch to Rust only if profiling shows otherwise during PR-C execution. | Avoid premature optimization. If escalated, becomes a separate plan, not a Plan 7 surprise. |
| 7 | Anonymizer config-format equivalence | **Semantic equivalence.** | Date-shift uses per-patient pseudo-random offsets; bit-identical is impossible without sharing the seed. Comparison oracle: (a) same fields redacted, (b) shifted dates within tolerance, (c) preserved fields byte-equal. |
| 8 | DICOMweb auth model | **Bearer token only in Phase 1.** | Covers dcm4chee + token and Orthanc + token (the two real-world cases). mTLS deferred until first customer ask. |
| 9 | HL7 FHIR-OMOP IG version pin | **Single Phase 1 pin.** All 3 `fhir_to_omop` PRs target the same IG version. | Atomic. Prevents PR-B from re-mapping fields PR-A established. Bumps are a dedicated plan item if needed. |

These decisions are now binding for the per-plan drafters.

## 12. References

### Standards & specifications

- HL7 FHIR R4 — https://hl7.org/fhir/R4/
- HL7 FHIR Bulk Data Access (Flat FHIR) IG — https://hl7.org/fhir/uv/bulkdata/
- HL7 FHIR-OMOP IG (canonical mapping reference) — https://github.com/HL7/fhir-omop-ig
- US Core Implementation Guide — https://hl7.org/fhir/us/core/
- mCODE (Minimal Common Oncology Data Elements) — https://hl7.org/fhir/us/mcode/
- IPS (International Patient Summary) — https://hl7.org/fhir/uv/ips/
- German MII (Medical Informatics Initiative) — https://www.medizininformatik-initiative.de/

### Tooling

- `pydicom` — https://pydicom.github.io/
- `fhir.resources` Python lib — https://github.com/nazrulworld/fhir.resources
- Microsoft FHIR Anonymizer — https://github.com/microsoft/Tools-for-Health-Data-Anonymization
- Prefect 3.x — https://docs.prefect.io/

### Reference implementations (study, do not port)

- `paulnagy/DICOM2OMOP` — https://github.com/paulnagy/DICOM2OMOP
- `NACHC-CAD/fhir-to-omop` (Java) — https://github.com/NACHC-CAD/fhir-to-omop
- `OHDSI/FhirToCdm` (.NET) — https://github.com/OHDSI/FhirToCdm
- `OHDSI/ETL-German-FHIR-Core` (Java/Spring, German MII) — https://github.com/OHDSI/ETL-German-FHIR-Core

### Clinical instruments

- EQ-5D-5L instrument & EuroQol value sets — https://euroqol.org/eq-5d-instruments/
- Nagy et al., "Breaking data silos: incorporating the DICOM imaging standard into the OMOP CDM," **JAMIA** 2025

### Parthenon internal

- Source devplan: `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` (esp. §4 Phase 1 lines 429–541, §5.1 Secrets, §5.4 CDM versioning, §6.4 Validation packs, §8 Definition of Done)
- Phase 0 design spec: `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`
- Phase 0 ADRs: `docs/adr/0001-node-sdk-design.md`, `docs/adr/0002-orchestration-backend.md`, `docs/adr/0003-template-manifest-format.md`
- HIGHSEC: `.claude/rules/HIGHSEC.spec.md` (esp. §3 Model Security, §4 Container Security, §8 Deployment Verification)
- PG role model: `~/.claude/memory/project_parthenon_pg_roles.md`
- Worktree sweep regressions: `~/.claude/memory/feedback_worktree_sweep_regressions.md`
- Migration safety: `~/.claude/memory/feedback_never_migrate_force.md`, `~/.claude/memory/feedback_deploy_migration_guard.md`
