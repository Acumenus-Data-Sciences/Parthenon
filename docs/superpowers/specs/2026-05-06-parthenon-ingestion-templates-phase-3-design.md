# Parthenon Ingestion Templates — Phase 3 Design

**Date:** 2026-05-06
**Status:** Approved 2026-05-06 — 12 review questions settled (§3); ready for per-plan drafting
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

## 2. Decision summary

Phase 3 ships:

1. **6 new nodes** added to `templates/runtime/nodes/` (community-tier shells where applicable). No node-SDK API changes.
2. **4 new templates**, all commercial-tier under the open-core split.
3. **Two-wheel monorepo** (Q1 = b′): `parthenon-templates` (AGPLv3) + `parthenon-templates-commercial` (proprietary), built from one source tree via two `pyproject.toml` files. CI builds the community wheel in isolation and asserts no commercial path is reachable.
4. **Concept-mapping moat:** T-024 brings retrieval (BAAI/bge-base-en-v1.5 embeddings over `concept_name + concept_synonym`) plus optional LLM re-ranking, with a reviewer UI for batch approval. This is the single largest commercial wedge.
5. **Carry-over follow-ups** complete Phase 2's deferred items: the `sql_node` `sql_file://` reader (Q10 = b, with `${parameters.*}` expansion), the ARTEMIS R install via multi-stage Dockerfile (Q11 = c, runtime stays Python-only), and the Llettuce graduation decision (Q9 = b, deferred to post-T-024 against the larger curated benchmark).
6. **PR-shape: 10 plans** (T-022 splits into 3 sub-PRs per Q12 = b, devplan-mandated).
   - **Plan 0 (carry-over):** `sql_node` `sql_file://` reader + Plan 4/5 testcontainers E2E activation.
   - **Plan 1 (T-021A):** X12 837 reader + COST projection.
   - **Plan 2 (T-021B):** X12 835 remit reconciliation.
   - **Plan 3 (T-021C):** NCPDP pharmacy claims.
   - **Plan 4A (T-022A):** `registry_to_omop` — NAACCR (extend OHDSI Oncology subgroup ETL per Q7 = a).
   - **Plan 4B (T-022B):** `registry_to_omop` — STS National Database.
   - **Plan 4C (T-022C):** `registry_to_omop` — NCDR.
   - **Plan 5 (T-023):** `lis_lab_to_omop` + LOINC harmonizer (python-hl7 per Q6 = b).
   - **Plan 6 (T-024A):** `ai_assisted_mapping` backend — `ConceptMappingSuggesterNode` + `MappingReviewQueueNode`. Curated benchmark (Q4 = c) drives the acceptance test.
   - **Plan 7 (T-024B):** review UI in the React shell (Q8 = a) + ARTEMIS full R-install + Llettuce graduation decision.
7. **Licensing posture:** Community wheel = AGPLv3 (Q3 = a). Commercial wheel = proprietary. Source layout: `templates/runtime/` and `templates/manifests/<id>/` are AGPL; `templates/runtime/commercial/` and `templates/manifests/_commercial/<id>/` are commercial. `import-linter` contract bans community→commercial imports; CI isolated-install job verifies the community wheel runs without the commercial path on `PYTHONPATH`.

## 3. Decisions log (Q1–Q12, settled 2026-05-06)

| # | Question | Chosen | Declined |
|---|---|---|---|
| Q1 | **Open-core split — repo layout** | **(b′) Monorepo, two wheels** — `parthenon-templates` (AGPL) + `parthenon-templates-commercial` (proprietary). Two `pyproject.toml` files, non-overlapping `packages = [...]`. CI uses `import-linter` contract + an isolated-install job that verifies the community wheel runs without the commercial path on `PYTHONPATH`. Pattern matches GitLab CE/EE, Sentry OSS/Cloud, Mattermost. | (a) Submodule (operational drag for a same-team monorepo); (b) Single wheel + path gate (would propagate AGPL to commercial code); (c) Extras (same propagation problem) |
| Q2 | **Claims parser library** | **(a) `pyx12`** — BSD-3 composes cleanly with both AGPL community + proprietary commercial tier; mature library used in healthcare X12 production environments | (b) `bots` (GPLv3 contaminates commercial); (c) `pdq` (license unknown); (d) Hand-rolled (multi-week reinvention) |
| Q3 | **Community-tier license** | **(a) AGPLv3** — Workstream 4 authoritative; revisiting belongs in a Workstream 4 ADR, not on Phase 3's path | (b) Apache 2.0; (c) BSL |
| Q4 | **AI-assisted mapping benchmark** | **(c) Curate from `vocab.concept_relationship`** — ~3k "Maps to" pairs across SNOMED↔ICD10CM, RxNorm↔NDC, LOINC↔SNOMED. Deterministic seed pattern matches Phase 2 Plan 3 (100% recall on 100-note benchmark). Reports `top_1_concept_match` + `top_1_blind_match` (held-out vocabulary subset) so the model can't shortcut via memorization. | (a) SDO-2024 (existence/license risk); (b) USAGI (smaller, lexical-bias) |
| Q5 | **Embedding model for T-024 retrieval** | **(a) `BAAI/bge-base-en-v1.5`** — 768-dim, MIT-licensed, strong biomedical retrieval; pgvector handles 768 fine | (b) MiniLM (weaker on long medical phrases); (c) MedGemma-Embed (couples T-024 to Ollama unnecessarily) |
| Q6 | **HL7 v2 parser** | **(b) `python-hl7`** — BSD aligns with both tiers; mature ORU^R01 parser | (a) `hl7apy` (LGPLv2+ adds compatibility note); (c) `hl7-fhir-converter` (wrong abstraction) |
| Q7 | **NAACCR ETL — extend or fork?** | **(a) Extend OHDSI Oncology subgroup ETL** — pin commit SHA; reuse the ARTEMIS-style upstream-diff workflow from Phase 2 ADR 0014 | (b) Fork from scratch (multi-month reinvention; NAACCR has 700+ items + annual code-set updates) |
| Q8 | **Concept-mapping review UI surface** | **(a) React shell tab** at `/admin/mapping-review` — Spatie RBAC `mapping-reviewer` role per HIGHSEC §1.1; consistent with rest of Parthenon UX; meets the "200 mappings in <30 min" acceptance gate | (b) Streamlit/Gradio sidecar (second auth + deploy surface); (c) CLI/TUI (fails acceptance gate) |
| Q9 | **Llettuce graduation timing** | **(b) Defer to post-T-024** — apply ADR 0013's +5 pp SNOMED threshold against Q4's curated 3k-pair benchmark, which is larger and more representative than Phase 2's 100-note synthetic set. Phase 2's `ner-eval` artifact stays parked as a prompt-drift regression detector. | (a) Decide at Plan 7 start (small benchmark); (c) Skip (forfeits the eval investment) |
| Q10 | **`sql_file://` reader scope** | **(b) Inline + `${parameters.*}` expansion** — closes Plan 4 + 5 testcontainers E2E gating without scope expansion. Phase 4 problem: SQL caching for re-runs. | (a) Resolution only (manifests already use `${parameters.*}`); (c) On-disk caching (premature) |
| Q11 | **ARTEMIS R-package install** | **(c) Multi-stage Dockerfile, build-time only** — R install runs once during the build, materialized JSON gets copied into the Python-only runtime layer. Honors Phase 2 ADR 0014's "runtime stays pure Python" promise. | (a) Hard runtime dep (~150 MB); (b) Sidecar image (over-engineered) |
| Q12 | **PR-shape — split T-022?** | **(b) Three sequential PRs** — PR-A NAACCR → PR-B STS → PR-C NCDR. Each registry has its own vocabulary load + acceptance gate; devplan-mandated. | (a) Single PR (loses per-registry verification gate) |

## 4. Architecture

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
