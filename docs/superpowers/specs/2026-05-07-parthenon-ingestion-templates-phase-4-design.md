# Parthenon Ingestion Templates — Phase 4 Design

**Date:** 2026-05-07
**Status:** Approved 2026-05-07 — Q1–Q14 settled with the recommended picks; ready for per-plan drafting
**Scope:** Phase 4 of `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` — closes out the templates subproject. Picks up every deferred item from Phases 0–3.
**Owners:** ML engineer (concept-mapping, Plan 1) + frontend (Plan 2 timed-user-test) + platform engineer (Plans 3, 5, 7) + ETL engineer (Plans 6, 8)
**Predecessor:** `docs/superpowers/specs/2026-05-06-parthenon-ingestion-templates-phase-3-design.md` (closed 2026-05-07 as PRs #283, #287–#293)

---

## 1. Goal

**Close out the ingestion-templates subproject.** Phase 3 shipped the four commercial-tier differentiator templates (T-021 claims, T-022 registries, T-023 lab, T-024 mapping). Phase 4 ships every Phase 3 deferred follow-up plus the carry-overs none of the prior phases closed, then declares the subproject complete.

Concretely:

- **Tighten the Harmonia (T-024) loop:**
  - Per-vocabulary LoRA fine-tune of `BAAI/bge-base-en-v1.5` so seen-set top-5 reaches **0.85** and blind-set top-5 reaches **0.75** (Plan 6 Gate 2 acceptance gates that the v0.1 retriever-baseline missed).
  - Auto-approval policy with confidence calibration (skips reviewer for high-confidence rows).
  - Conditional cross-encoder rerank if the LoRA fine-tune still leaves a top-5 plateau below 0.90.
  - Llettuce graduation re-evaluation (ADR 0013 explicit reconsideration trigger).
- **Close Plan 7 (T-024B) reviewer-UI gate:**
  - Seed harness so a domain expert can review 200 real-shape mappings; record wall-clock time; surface verdict against the **<30 min** acceptance gate.
- **Make the templates subproject self-maintaining:**
  - ARTEMIS quarterly upstream-diff workflow (auto-PR on regimen changes).
  - NAACCR upstream-diff workflow (quarterly per ADR 0017).
  - HL7 v2 ORU trigger event coverage beyond R01 (R30 lab order, R31 lab change).
- **Close the streaming-ingest opening:**
  - HL7 FHIR Bulk Data front door (real-time `claims_to_omop` companion to the Phase 3 batch path).
- **Open the federated-mapping path (capability spike, not productionization):**
  - Federated mapping review across Parthenon Networks — depends on Hive Networks federated layer (out-of-tree dependency tracked).

Phase 4 is **purely additive and finalizing.** No existing manifest, node, or DB column changes. Phase 4 is the LAST phase of this subproject.

## 2. Decision summary

Phase 4 ships:

1. **9 plans** organized in three lanes (mapping-loop, subproject-maintenance, frontier). Lanes are independent — internal Plan ordering matches dependencies, but Plans across lanes can land in parallel.
2. **No new commercial-tier templates.** Plan 1 LoRA + Plan 3 auto-approval extend the existing commercial T-024 wheel (`templates/commercial/runtime/commercial/mapping/`).
3. **Llettuce graduation is data-driven** — re-runs against fine-tuned bge-base + Plan 6's curated benchmark. ADR 0013 amended with verdict.
4. **Reviewer-UI Task 12 lands as the single deliverable of Plan 2.** Seed harness + harness fixtures + timed user test record + ADR amendment to Plan 7 closeout doc.
5. **Federated mapping review is exploratory.** Plan 7 produces a working spike + design memo; productionization is gated on Hive Networks Phase N (out-of-scope for templates subproject).
6. **PR-shape:** 9 plans × 1 PR each. No splits. Plan 1 (LoRA) has the longest tail (training compute + benchmark re-runs) and is the critical path.

## 3. Decisions log (Q1–Q14, settled 2026-05-07)

| # | Question | Chosen | Declined |
|---|---|---|---|
| Q1 | **LoRA training data scope** — what corpus does Plan 1 fine-tune on? | **(a) Plan 6 curated benchmark only** (2078 rows: 1557 seen + 521 blind) — the canonical ground truth that already drives the acceptance gate. | (b) curated + customer-furnished mappings (license complications); (c) bootstrap from `vocab.concept_relationship 'Maps to'` corpus-wide (overfits to the retrieval target) |
| Q2 | **LoRA target adapter rank** — what `r` and `alpha`? | **(a) `r=16, alpha=32` per-vocabulary**, with separate adapters for SNOMED / RxNorm / LOINC / ICD10CM / NDC. Mainstream sentence-transformers LoRA defaults; cheap to retrain quarterly. | (b) Single corpus-wide adapter (loses per-vocab specialization); (c) `r=32+` (training cost ↑, marginal gain) |
| Q3 | **Auto-approval threshold source** — where does the cutoff come from? | **(a) Calibration plot on Plan 1's held-out blind set** — pick the threshold where top-1 precision ≥ 0.99 (zero-tolerance for bad auto-approvals on production CDM data). Surface the calibration plot in the reviewer UI. | (b) Hard-coded 0.95 cutoff (no defensible derivation); (c) Reviewer-tunable per-source (premature; calibrate first, expose later if needed) |
| Q4 | **Cross-encoder rerank — fire-conditional or unconditional?** | **(b) Conditional**: ship cross-encoder ONLY if Plan 1 LoRA leaves top-5 plateau **<0.90** after re-acceptance. Adds latency + heavier model — no good reason to ship if LoRA already clears. | (a) Always ship (premature; Plan 6 Gate 2 already showed rerank LLM ≥ retrieval); (c) Defer to Phase 5 (we said Phase 4 closes the subproject) |
| Q5 | **Reviewer-UI seed harness data source** | **(a) Synthesize realistic rows from anonymized customer LIS exports** — same shape as Plan 5 unmapped queue, no PHI. Reviewer evaluates the UX, not the underlying clinical data. | (b) Live customer ingestion (HIPAA blocker); (c) Random fixtures (not realistic enough to validate <30 min throughput) |
| Q6 | **Timed user test — domain expert sourcing** | **(a) Single in-house reviewer** (Dr. Udoshi / clinical informaticist). Record wall-clock + per-row decision. Single-reviewer gate is per Plan 7 spec; multi-reviewer is Phase 5+. | (b) Multi-reviewer panel (overkill for a v0.1 acceptance gate); (c) External clinician (vendor risk + scheduling drag) |
| Q7 | **Llettuce graduation — when to re-run?** | **(a) After Plan 1 lands, before Plan 4 decision** — fine-tuned bge-base may close the +5 pp SNOMED edge that Llettuce had vs vanilla SciSpaCy. ADR 0013 reconsideration trigger explicitly names this sequence. | (b) Independently in parallel (loses the LoRA benefit signal); (c) Skip and lock HOLD (gives up on a deferred eval too easily) |
| Q8 | **Streaming claims (FHIR Bulk Data) — scope** | **(b) Reader node + manifest only**, no real-time scoring/cohort feedback (those belong to a separate "Real-time Analytics" subproject). Producer = `FhirBulkClaimsReader`; consumer = existing `claims_to_omop` SQL stages. | (a) Full real-time pipeline (subproject creep); (c) Streaming + Real-time Analytics co-design (entangles two subprojects) |
| Q9 | **HL7 v2 trigger event coverage** | **(b) Add R30 + R31 in one plan** — they share the python-hl7 parser; small marginal cost. Beyond R01 the trigger surface flattens (R31 covers most lab-correction flows). | (a) R01-only forever (incomplete coverage); (c) Full v2 trigger catalog (yagni — most are non-lab) |
| Q10 | **Upstream-diff automation cadence** | **(a) Quarterly** for both ARTEMIS (HemOnc) and NAACCR (OHDSI Oncology subgroup). Cron `0 4 1 */3 *` (1st of every 3rd month at 04:00 UTC). Auto-PR with diff in body; merge requires human review. | (b) Monthly (noisy); (c) On-demand only (reverts to the manual problem we're solving) |
| Q11 | **Federated mapping review — depth in Phase 4** | **(b) Spike + design memo only**. Working POC over 2 networks using Plan 7 reviewer UI + Hive Networks federated query layer. Production lift moves to Hive Networks Phase N. | (a) Full productionization (out of templates-subproject scope); (c) Defer entirely (loses momentum on the largest commercial wedge expansion) |
| Q12 | **PHI scrubbing for fine-tune training data** | **(a) Plan 1 training corpus is `vocab.concept_relationship 'Maps to'` — pure vocabulary, no PHI by construction.** Augmentation negatives sampled from corpus too. No PII risk. | n/a — only safe option |
| Q13 | **GPU vs CPU training for LoRA** | **(a) Local 7900XTX via ROCm 6.2** (proven on Plan 6 — 85× faster than CPU). Reproducible setup; doesn't burn cloud credits. | (b) Cloud GPU (cost + secret-handling); (c) CPU fallback (12+ hr training per adapter — productivity blocker) |
| Q14 | **Phase 4 closing artifact** | **(a) Subproject closeout doc** at `docs/superpowers/specs/2026-05-XX-parthenon-ingestion-templates-CLOSEOUT.md` summarizing all 4 phases + every shipped template + every deferred-and-closed item. Mirrors how the milestone audit worked for Phase 2. | (b) No closeout (loses institutional memory); (c) Per-plan summary only (fragmented) |

## 4. Architecture

### 4.1 Mapping-loop lane (Plans 1, 3, 4, 5)

```
                     ┌───────────────────────────────────────────────┐
                     │   Plan 1: bge-base LoRA fine-tune (issue #295)│
                     │   Per-vocab adapters (SNOMED/RxNorm/LOINC/    │
                     │   ICD10CM/NDC); ROCm on 7900XTX              │
                     └────────────┬──────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
   │ Plan 5: Llettuce   │ │ Plan 3: auto-      │ │ Plan 4: cross-     │
   │   graduation       │ │ approval policy +  │ │ encoder rerank     │
   │   re-evaluation    │ │ confidence         │ │ (CONDITIONAL on    │
   │   (ADR 0013        │ │ calibration        │ │ top-5 < 0.90 after │
   │   reconsideration) │ │                    │ │ Plan 1)            │
   └────────────────────┘ └────────────────────┘ └────────────────────┘
```

`templates/commercial/runtime/commercial/mapping/` gains:
- `lora/` — adapter weights + loader; `BgeEmbedder.encode()` accepts an optional `vocabulary_id` and applies the matching adapter.
- `auto_approver.py` — a policy-only node that consumes `parthenon_mapping_review_queue` and writes auto-approved rows to `parthenon_concept_map` when `top1.confidence >= calibrated_cutoff`.
- `cross_encoder_reranker.py` — only built if Q4 fires; consumes Plan 1 retriever output, optional second-stage rerank.

### 4.2 Subproject-maintenance lane (Plans 2, 8, 9)

```
   Plan 2: Reviewer-UI timed user test (closes Plan 7 Task 12)
     └─ harmonia:seed-review-queue --rows=200 (Artisan command)
     └─ run timed test, capture wall-clock + per-row decision
     └─ amend ADR 0019 + Plan 7 spec with verdict

   Plan 8: Quarterly upstream-diff workflows
     └─ ARTEMIS (HemOnc) — extends existing artemis-pattern-update.yml
     └─ NAACCR (OHDSI Oncology subgroup) — new workflow
     └─ Both: auto-PR with diff in body; human merge required

   Plan 9: HL7 v2 ORU trigger event coverage
     └─ R30 (lab order) + R31 (lab order change)
     └─ Shares python-hl7 parser with Plan 5's R01 reader
     └─ Adds fixture corpus from CDISC + LZZT
```

### 4.3 Frontier lane (Plans 6, 7)

```
   Plan 6: HL7 FHIR Bulk Data reader (streaming claims)
     └─ FhirBulkClaimsReader node (community-tier shell + commercial impl)
     └─ Manifest: claims_to_omop_streaming (consumes existing SQL stages)
     └─ Bulk Data spec compliance: ndjson group export, async polling

   Plan 7: Federated mapping review spike
     └─ POC over 2 networks via Hive Networks federated query layer
     └─ Plan 7 reviewer UI extension: cross-network candidate visibility
     └─ Design memo: production lift gated on Hive Networks Phase N
     └─ NO ADR — exploratory; produces a Phase 5+ ticket if/when Hive lands
```

## 5. Out of scope for Phase 4 (NOT planned for this subproject ever)

These items were considered and explicitly declined:

- **DICOM-SR for lab results** — HL7 v2 ORU is the canonical path. Resolved at Phase 3 spec §5.
- **PDF / scanned-document OCR ingestion** — out-of-tree problem; the Imaging subproject's Hecate handles unstructured. The templates subproject assumes structured input.
- **NCDR / STS license negotiation** — vendor relationship, not engineering. Customer brings their own IG.
- **Llettuce PyPI publication** — upstream's call. Watching their tracker; not blocking on it.
- **Multi-reviewer mapping panels** — single-reviewer satisfies T-024 acceptance. Multi-reviewer is a Phase 5+ scoping question for a different subproject (collaborative-curation).
- **Reviewer-tunable confidence cutoffs per source** — calibrate first (Q3); expose later if real customer feedback demands it. Don't ship configurability without evidence.
- **Real-time analytics on streaming claims** — Plan 6 ships the reader, not a real-time analytics fabric. Real-time scoring belongs to a separate subproject.
- **Productionizing the federated-review spike** — gated on Hive Networks. Templates subproject closes with the spike as deliverable; production is Hive's charter.

## 6. Risks

- **R1 (high) — LoRA training does not move retrieval recall.** Plan 6 Gate 2 showed Sonnet ≈ Haiku → bge-base recall is the bottleneck. If LoRA doesn't lift recall@50, the whole mapping-loop lane stalls. Mitigation: per-vocabulary adapters (Q2) — even a 5 pp lift on SNOMED alone is sufficient for the seen top-5 ≥ 0.85 gate. Run a recall-only ablation BEFORE the full re-acceptance.
- **R2 (high) — Auto-approval calibration is unforgiving.** A 1% bad-auto-approval rate at corpus scale = thousands of silently wrong CDM rows. Mitigation: Q3 picks top-1 precision ≥ 0.99 cutoff; reviewer UI shows recently auto-approved with a "challenge" button so they can claw back if downstream analytics surface anomalies.
- **R3 (medium) — Reviewer-UI timed user test depends on Dr. Udoshi's availability.** If scheduling slips, Plan 2 blocks the closeout. Mitigation: pre-seed the queue, schedule the time-boxed session, and treat <30 min as a soft gate (60 min is still acceptable for the v0.1 surface).
- **R4 (medium) — FHIR Bulk Data spec drift.** The spec moved from STU3 to STU4 mid-2026; vendors implement subsets. Mitigation: target the `bulkdata-1.0.0` profile (most stable). Test against Synthea-generated bulk export (same fixture layer Plan 5 uses).
- **R5 (low) — HemOnc / NAACCR upstream changes break extractor scripts.** Quarterly cadence is a feature here — humans review every diff before merge.
- **R6 (low) — Federated spike reveals an unsolvable problem.** Mitigation: Q11 says spike + design memo only. If the spike fails, the design memo documents the failure modes; templates subproject still closes cleanly.

## 7. Reference materials (read before per-plan drafting)

- ADR 0019 (Harmonia) — Phase 4 follow-ups section is the seed for Plans 1, 3, 4.
- ADR 0013 (Llettuce HOLD) — reconsideration triggers section is the seed for Plan 5.
- ADR 0017 (registry_to_omop) — quarterly upstream-diff is named here; Plan 8 implements.
- ADR 0018 (lis_lab_to_omop) — Phase 4 candidate trigger events is the seed for Plan 9.
- Phase 3 spec §5 — out-of-scope items + Phase 4 candidates.
- Issue #295 — bge-base LoRA fine-tune (named ticket, becomes Plan 1).
- `templates/commercial/runtime/commercial/mapping/` — package root for Plans 1, 3, 4 extensions.
- HL7 FHIR Bulk Data IG (`hl7.fhir.uv.bulkdata-1.0.0`) — Plan 6 reference.
- Hive Networks federated query layer status — Plan 7 dependency check.

## 8. Process

| Plan | Owner | Estimated weeks | Depends on | Unblocks |
|---|---|---|---|---|
| 1 — bge-base LoRA fine-tune (issue #295) | ML engineer | 4–6 | Phase 3 closed | Plans 3, 4, 5 |
| 2 — Reviewer-UI seed harness + timed user test | Frontend + Dr. Udoshi | 1–2 | Phase 3 closed | Closeout artifact |
| 3 — Auto-approval policy + calibration | ML engineer | 2 | Plan 1 | Auto-approve in production |
| 4 — Cross-encoder rerank (CONDITIONAL) | ML engineer | 2 | Plan 1 + acceptance run | — |
| 5 — Llettuce graduation re-evaluation | ML engineer | 1 | Plan 1 | ADR 0013 final verdict |
| 6 — FHIR Bulk Data reader (streaming claims) | ETL engineer | 3 | Phase 3 closed | Real-time Analytics subproject |
| 7 — Federated mapping review spike | Platform engineer | 2–3 | Hive Networks federated layer (out-of-tree) | Hive Networks Phase N |
| 8 — Quarterly upstream-diff (ARTEMIS + NAACCR) | Platform engineer | 1 | Phase 3 closed | Self-maintaining templates |
| 9 — HL7 v2 trigger event coverage (R30 + R31) | ETL engineer | 2 | Phase 3 closed | Trigger-event completeness |

**Critical path:** Plan 1 is the long pole; Plans 3, 4, 5 stack behind it. Plans 2, 6, 7, 8, 9 can run in parallel from week 1.

**Gate review cadence:** weekly check-in on Plan 1 training metrics (recall@50 lift per vocabulary). Plans 2 + 8 + 9 are TDD-style with Plan 7 spec's acceptance criteria as gates.

**Closeout:** when all 9 plans land, write `docs/superpowers/specs/2026-XX-XX-parthenon-ingestion-templates-CLOSEOUT.md` summarizing all 4 phases. Update `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` to status "completed".

---

## Plan summaries (one paragraph each — full PLAN.md drafted after Q1–Q14 settle)

### Plan 1 — bge-base per-vocabulary LoRA fine-tune (issue #295)

Train per-vocabulary LoRA adapters on `BAAI/bge-base-en-v1.5` using the Plan 6 curated benchmark (Q1) with rank `r=16, alpha=32` (Q2). Five adapters (SNOMED/RxNorm/LOINC/ICD10CM/NDC). ROCm on the 7900XTX (Q13). Acceptance: re-run Plan 6 Gate 2 against fine-tuned adapters; seen top-5 ≥0.85, blind top-5 ≥0.75 with the same Haiku 4.5 reranker. Ships LoRA loader + `BgeEmbedder` vocabulary-aware adapter selection. Ties off the largest open follow-up from Phase 3.

### Plan 2 — Reviewer-UI seed harness + timed user test

Adds Artisan command `harmonia:seed-review-queue --rows=200 --vocab=ICD10CM,NDC,LOCAL_LIS` that synthesizes realistic queue rows from anonymized LIS exports (Q5). Dr. Udoshi runs the timed test (Q6), records wall-clock + per-row decision. Closes Plan 7 Task 12. ADR 0019 amended with verdict against the <30 min gate.

### Plan 3 — Auto-approval policy + confidence calibration

Picks the calibrated cutoff (Q3 — top-1 precision ≥0.99 on Plan 1's blind set), surfaces the calibration plot in the reviewer UI, ships `auto_approver.py` policy node. Reviewer UI gains a "Recently auto-approved" tab with a `Challenge` button so reviewers can claw back if downstream analytics surface anomalies (R2 mitigation).

### Plan 4 — Cross-encoder rerank (CONDITIONAL)

Fires only if Plan 1 LoRA + Plan 6 reranker leave top-5 below 0.90 after re-acceptance (Q4). Wraps `cross-encoder/ms-marco-MiniLM-L-6-v2` as second-stage rerank over the top-50 retriever output. Ships only if needed.

### Plan 5 — Llettuce graduation re-evaluation

Re-runs `pytest -m mapping_eval` against fine-tuned bge-base + Plan 6 benchmark (Q7). Applies ADR 0013's `+5 pp SNOMED concept_match_rate` threshold. Verdict: GRADUATE → ship `parthenon_ner_llettuce` template; HOLD-FINAL → ADR 0013 amended with closing rationale; in either case, the eval-only artifact stays as a prompt-drift detector.

### Plan 6 — HL7 FHIR Bulk Data reader (streaming claims)

`FhirBulkClaimsReader` node + `claims_to_omop_streaming` manifest. Reader node implements the `bulkdata-1.0.0` profile: kickoff → polling → ndjson chunk download → SQL stage hand-off (Q8). Test corpus = Synthea bulk export. No real-time analytics; that's a separate subproject.

### Plan 7 — Federated mapping review spike

POC over 2 networks via Hive Networks federated query layer (Q11). Plan 7 reviewer UI extension: cross-network candidate visibility (`X reviewers across N networks have approved this concept`). Spike + design memo deliverables only. NO ADR. Production lift gated on Hive Networks Phase N.

### Plan 8 — Quarterly upstream-diff workflows (ARTEMIS + NAACCR)

Two GitHub Actions workflows on cron `0 4 1 */3 *` (Q10). ARTEMIS extends `artemis-pattern-update.yml`; NAACCR is new at `naaccr-pin-update.yml`. Both: re-run extractor, diff against committed pin, auto-PR with diff in body, human merge required.

### Plan 9 — HL7 v2 ORU trigger event coverage (R30 + R31)

Adds R30 (lab order) and R31 (lab order change) parser support to the Phase 3 Plan 5 reader (Q9). Same python-hl7 backend; new ORU subtype dispatch. Test corpus extension from CDISC + LZZT. Closes the trigger-event gap.

---

## Closeout artifact (after all 9 plans)

When all plans land, write `docs/superpowers/specs/2026-XX-XX-parthenon-ingestion-templates-CLOSEOUT.md`:
- All 4 phases + every shipped template + every deferred-and-closed item
- All ADRs in numerical order with status (Accepted / Superseded / Reconsidered)
- Final acceptance numbers across the lifecycle
- Open items that move to other subprojects (federated review → Hive Networks; real-time analytics → Real-time Analytics subproject)
- Update `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` to status: completed
