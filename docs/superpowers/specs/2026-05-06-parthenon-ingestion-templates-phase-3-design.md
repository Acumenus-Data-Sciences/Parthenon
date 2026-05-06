# Parthenon Ingestion Templates — Phase 3 Design

**Date:** 2026-05-06
**Status:** Draft — 12 review questions open (§3); awaiting user decisions before per-plan drafting
**Scope:** Phase 3 of `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` — devplan T-021 through T-024
**Owners:** Platform engineer + 2 ETL engineers + 1 ML engineer (concept-mapping) + 1 frontend (T-024 review UI)
**Predecessor:** `docs/superpowers/specs/2026-05-05-parthenon-ingestion-templates-phase-2-design.md` (merged 2026-05-06 as PRs #271–#276)

---

## 1. Goal

Phase 3 ships the **four Parthenon-only differentiator templates** that move the platform ahead of D2E. These are commercial-tier features under Workstream 4's open-core split — the price-premium justification.

Concretely:

- **3 new node types** (T-016 dependents):
  - `X12_837_Reader`, `X12_835_Reader`, `NCPDP_Reader` (claims, T-021)
  - `Hl7v2OruReader` (lab results, T-023)
  - `ConceptMappingSuggesterNode`, `MappingReviewQueueNode` (AI mapping, T-024)
- **4 new templates** (T-021 → T-024):
  - `claims_to_omop` — X12 837/835/NCPDP → DRUG_EXPOSURE / PROCEDURE_OCCURRENCE / COST / CONDITION_OCCURRENCE / VISIT_OCCURRENCE.
  - `registry_to_omop` — NAACCR + STS + NCDR → CONDITION_OCCURRENCE + EPISODE.
  - `lis_lab_to_omop` — HL7 v2.x ORU^R01 + LOINC harmonizer → MEASUREMENT.
  - `ai_assisted_mapping` — embedding-similarity + LLM re-rank concept mapper, batch-review UI.
- **Open-core enforcement layer** — CI lint that blocks community-tier code from importing commercial-tier modules (Workstream 4, §5.5).
- **Carry-over from Phase 2:**
  - sql_node `sql_file://` reader (unblocks the gated Plan 4 + 5 testcontainers E2Es).
  - ARTEMIS full R-package install in the templates Dockerfile (replaces the v0.1 hand-curated 5-regimen library).
  - Llettuce graduation read of the latest eval-CI artifact (`ner-eval`) — apply ADR 0013's +5 pp SNOMED threshold to the most recent run; ship `parthenon_ner_llettuce` only if Llettuce graduates.

Phase 3 is **purely additive** to Phases 0–2. No existing manifest, node, or DB column is changed. The Phase 0 Laravel-side cross-cutting migration (CSV/FHIR ingestion riding the node SDK) stays parked.

## 2. Decision summary (preliminary, pending Q1–Q12)

Phase 3 ships:

1. **6 new nodes** added to `templates/runtime/nodes/`. No node-SDK API changes.
2. **4 new templates**, all commercial-tier under the open-core split.
3. **Open-core CI lint** (Workstream 4, §5.5) preventing community packages from `import`ing commercial-tier modules — enforced at PR time.
4. **Concept-mapping moat:** T-024 brings Llettuce-style retrieval (embedding similarity over `concept_name + concept_synonym`) plus optional LLM re-ranking, with a reviewer UI for batch approval. This is the single largest commercial wedge.
5. **Carry-over follow-ups** complete Phase 2's deferred items: the sql_node `file://` reader, the ARTEMIS full R install, and the Llettuce graduation decision.
6. **PR-shape (preliminary): 7 plans.**
   - **Plan 0 (carry-over):** sql_node `sql_file://` reader + Plan 4/5 testcontainers E2E activation.
   - **Plan 1 (T-021A):** X12 837 reader + COST projection.
   - **Plan 2 (T-021B):** X12 835 remit reconciliation.
   - **Plan 3 (T-021C):** NCPDP pharmacy claims.
   - **Plan 4 (T-022):** `registry_to_omop` triple — NAACCR + STS + NCDR (one PR per sub-template via shared base).
   - **Plan 5 (T-023):** `lis_lab_to_omop` + LOINC harmonizer.
   - **Plan 6 (T-024A):** `ai_assisted_mapping` backend (suggester + queue node).
   - **Plan 7 (T-024B):** review UI (frontend) + Phase 2 ARTEMIS-full R-install + Llettuce graduation decision.
7. **Licensing posture:** Commercial-tier code lives at `templates/runtime/commercial/` and `templates/manifests/_commercial/` (gitignored or behind a separate license-gated submodule). Community-tier CI must not import these paths.

## 3. Decisions log (Q1–Q12, OPEN)

| # | Question | Options | Default |
|---|---|---|---|
| Q1 | **Open-core split — repo layout** | (a) Commercial code in a separate private repo pulled via git submodule; (b) Same repo, gated by file-path naming (`*/commercial/*`); (c) Same repo, gated by package metadata (`license = "Commercial"` in pyproject.toml extras) | (b) — simplest CI gate (path-based ruff/import-linter), no submodule churn |
| Q2 | **Claims parser library** | (a) `pyx12` (BSD-3); (b) `bots` (GPLv3); (c) `pdq` (no obvious license — PyPI lookup); (d) Hand-roll a minimal X12 837/835 parser | (a) `pyx12` — BSD compatible with our commercial tier; bots is GPL which contaminates the commercial-tier compile path |
| Q3 | **AGPLv3 confirmation for community tier** | (a) AGPLv3 (per Workstream 4 doc); (b) Apache 2.0 (relaxes downstream redistribution); (c) BSL (delayed-OSS gradient) | (a) AGPLv3 — the workstream 4 doc is authoritative; revisit if it changes |
| Q4 | **AI-assisted mapping benchmark** | (a) SDO-2024 placeholder; (b) OHDSI USAGI test set; (c) curate our own from CONCEPT + CONCEPT_RELATIONSHIP "Maps to" pairs (3k seed pairs) | (c) — the Plan 3 100-note gold standard pattern worked; we can curate ~3k mapping pairs from `vocab.concept_relationship` deterministically |
| Q5 | **Embedding model for T-024 retrieval** | (a) `BAAI/bge-base-en-v1.5` (open, 768-dim); (b) `all-MiniLM-L6-v2` (open, 384-dim, faster); (c) MedGemma-Embed via Ollama (matches Phase 2 Plan 1 LLM choice) | (a) bge-base — strong baseline on biomedical retrieval, no Ollama coupling; pgvector handles 768 fine |
| Q6 | **HL7 v2 parser** | (a) `hl7apy` (LGPLv2+); (b) `python-hl7` (BSD); (c) `hl7-fhir-converter` (Apache 2.0) | (b) `python-hl7` — BSD aligns with commercial tier; LGPLv2+ is fine but more complex |
| Q7 | **NAACCR ETL — extend or fork?** | (a) Extend the OHDSI Oncology subgroup's existing NAACCR ETL (per devplan); (b) Fork into a Parthenon-owned manifest from scratch | (a) Extend per devplan — pin OHDSI commit SHA, materialize via our template runtime |
| Q8 | **Concept-mapping review UI surface** | (a) New tab in the existing Atlas-replacement UI under `/admin/mapping-review`; (b) Standalone Streamlit/Gradio sidecar for fast iteration; (c) CLI-only TUI | (a) — keep the React shell consistent; Spatie RBAC adds a `mapping-reviewer` role per HIGHSEC §1.1 |
| Q9 | **Llettuce graduation timing** | (a) Read latest `ner-eval` artifact at Plan 7 start, decide before T-024 work begins; (b) Defer until after T-024 ships and re-run on the larger benchmark T-024 builds; (c) Skip — T-024 supersedes Llettuce regardless | (b) — T-024's curated benchmark (Q4) will be a much stronger basis for the +5 pp call than Phase 2's 100-note synthetic set |
| Q10 | **`sql_file://` reader scope** | (a) Inline `sql_file://manifests/<id>/sql/<f>.sql` resolution only; (b) Plus templated parameter expansion (Jinja-style `${parameters.cdm_schema}`); (c) Plus on-disk SQL caching for re-runs | (b) — manifests already use `${parameters.*}` syntax; aligning the reader closes Plan 4 + 5's gating without expanding scope |
| Q11 | **ARTEMIS R-package install — runtime weight** | (a) Hard dep in main `parthenon-templates` Dockerfile (~150 MB); (b) Sidecar image (`parthenon-artemis-extractor`) like SciSpaCy; (c) Build-time-only in a multi-stage Dockerfile so the runtime stays Python-only | (c) — multi-stage matches Phase 2 ADR 0014's "runtime stays pure Python" promise; the R install runs once at build, output JSON is copied into the runtime layer |
| Q12 | **PR-shape — split T-022 (registry) into 3 PRs or ship as one?** | (a) One PR with all three registries (NAACCR + STS + NCDR share `registry_base.yaml`); (b) Three sequential PRs (PR-A NAACCR → PR-B STS → PR-C NCDR per devplan) | (b) — devplan says split; each registry has its own vocabulary load + acceptance gate |

## 4. Architecture (sketch — pending Q answers)

Phase 2's architecture diagram is unchanged. Phase 3 adds:

```
┌─────────────────────────────────────────────────────────────────┐
│  parthenon-templates container (extended)                        │
│  templates/                                                      │
│  ├── runtime/                                                    │
│  │   ├── nodes/                                                  │
│  │   │   ├── (13 nodes from Phase 0 + 1 + 2)                     │
│  │   │   ├── x12_837_reader.py    (NEW — Plan 1)                 │
│  │   │   ├── x12_835_reader.py    (NEW — Plan 2)                 │
│  │   │   ├── ncpdp_reader.py      (NEW — Plan 3)                 │
│  │   │   ├── hl7v2_oru_reader.py  (NEW — Plan 5)                 │
│  │   │   ├── concept_mapper.py    (NEW — Plan 6)                 │
│  │   │   └── mapping_review.py    (NEW — Plan 6)                 │
│  │   ├── commercial/              (NEW — Q1 outcome, gated)      │
│  │   │   ├── claims/              (T-021 logic)                  │
│  │   │   ├── registry/            (T-022 logic)                  │
│  │   │   └── mapping/             (T-024 backend)                │
│  │   └── nlp/                                                    │
│  │       └── (unchanged from Phase 2)                            │
│  ├── manifests/                                                  │
│  │   ├── claims_to_omop/          (NEW — Plans 1-3, commercial)  │
│  │   ├── registry_to_omop/        (NEW — Plan 4, commercial)     │
│  │   ├── lis_lab_to_omop/         (NEW — Plan 5, mixed tier)     │
│  │   └── ai_assisted_mapping/     (NEW — Plans 6-7, commercial)  │
│  ├── tools/                                                      │
│  │   └── lint-import-tier.py      (NEW — Q1 enforcement)         │
│
│  Frontend (NEW)
│  ├── frontend/src/features/mapping-review/ (NEW — Plan 7)        │
│
│  External sidecars (no new ones)
└─────────────────────────────────────────────────────────────────┘
```

## 5. Out of scope for Phase 3

These come up in Phase 4 or later, not here:

- **Federated mapping review** across Parthenon Networks (depends on Hive Networks federated layer).
- **Streaming claims ingestion** (Phase 3 is batch-only; real-time 837 requires an HL7 FHIR Bulk Data front door).
- **PDF / scanned-document ingestion** before structured parse (still assumes structured input).
- **NCDR / STS license negotiation** — the templates accept the data once a customer has it; we don't broker access.
- **DICOM-SR for lab results** — HL7 v2 ORU is canonical.
- **Phase 2 follow-ups beyond the three carry-overs** — e.g., Llettuce package PyPI publish (still upstream's call); ARTEMIS upstream-diff workflow.

## 6. Risks

- **R1 (high):** **Open-core CI lint reliability.** If the Q1 path-based gate has a bypass (relative imports, runtime `importlib`), commercial code leaks into community-tier wheels. Mitigation: import-linter contract test + a CI job that builds the community wheel in isolation and verifies it runs without the commercial path on PYTHONPATH.
- **R2 (high):** **AI-assisted mapping accuracy.** Devplan acceptance is top-1 >60%, top-5 >85% on the SDO-2024 benchmark. If we curate our own benchmark (Q4(c)), the threshold may need recalibration — and we don't know whether our embedding choice + LLM re-ranker clears it without a spike.
- **R3 (medium):** **X12 license assumptions.** Anyone parsing 837/835 in production needs a CMS / payer-specific Implementation Guide. We can't redistribute IGs. Tests use CMS-published example fixtures only; production customers bring their own IG.
- **R4 (medium):** **NAACCR ETL upstream drift.** Pinning a commit SHA decouples us from OHDSI's pace, but means we have to run the upstream-diff workflow ourselves quarterly.
- **R5 (medium):** **HL7 v2 parser maturity.** `python-hl7` is BSD and well-maintained, but ORU^R01 has many trigger-event subtypes. Test corpus needs to cover R01, R30, R31 at minimum.
- **R6 (low):** **Mapping review UI throughput.** The acceptance gate is "domain expert reviews 200 mappings in <30 min." If our UI design makes that >45 min, we miss the gate; mitigation: timeboxed user test with a real reviewer at PR-B time, before the UI is final.

## 7. Reference materials (to read before Plan drafting)

- `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` §4.3 (Phase 3 deliverables)
- Phase 2 spec + ADRs 0010, 0011, 0013, 0014 (carry-over context)
- OHDSI Oncology subgroup NAACCR ETL repo (T-022 base)
- Llettuce paper (Reza et al., 2024) — algorithmic basis for T-024
- USAGI conventions — concept-mapping reviewer-UX precedent
- CMS 837/835 example transactions — fixture source for T-021
- CDISC LZZT (already pulled in Phase 2; reused for parts of T-024 evaluation)

## 8. Process

Same shape as Phase 2:

1. User answers Q1–Q12 in this document (in-place, replacing the **Default** column with the chosen value).
2. Per-plan PLAN.md files drafted (one per plan from §2.6).
3. Plans land sequentially, one PR per plan.
4. ADRs follow the Phase 2 numbering (next free is 0015) for any new decisions that emerge during execution.
5. Each plan ends with a devlog at `docs/devlog/modules/ingestion/templates-phase-3-plan-N-execution.md`.
