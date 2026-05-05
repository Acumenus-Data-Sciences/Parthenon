# Parthenon Ingestion Templates — Phase 2 Design

**Date:** 2026-05-05
**Status:** Approved 2026-05-05 — 11 review questions settled (§3); ready for per-plan drafting
**Scope:** Phase 2 of `docs/architecture/PARTHENON_INGESTION_DEVPLAN.md` (devplan T-016 through T-020)
**Owners:** Platform engineer + 1 ETL engineer + 1 ML engineer (NER backends)
**Predecessor:** `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md` (merged 2026-05-05 as PRs #253–#259)

---

## 1. Goal

Phase 2 closes the gap on **clinical-text NER**, **MIMIC-IV / claims-style EHR ingestion**, **oncology regimen extraction**, and **CDISC SDTM bridge** — four high-customer-pull formats Phase 1 explicitly punted on.

Concretely (per the Q1-Q11 decisions logged in §3):

- **2 new node types** (T-016): `NoteNlpNode` (text-in / NOTE_NLP rows-out, pluggable backend), `SdtmDomainNode` (SAS XPT or Define-XML reader → typed domain DataFrame).
- **5 new templates** (T-017 → T-020):
  - `parthenon_ner_llm` — LLM-backed clinical NER (default backend; uses MedGemma or other configured LLM through the existing AI service).
  - `parthenon_ner_scispacy` — SciSpaCy-backed NER (offline, deterministic; for HIPAA-strict deployments).
  - `load_mimic_iv_omop` — fork/port of the OHDSI MIMIC-IV ETL onto the Parthenon template runtime.
  - `artemis_chemo_regimens` — chemotherapy regimen extraction (RxNav + ARTEMIS R-package logic) projected to OMOP.
  - `sdtm_to_omop_v54` — CDISC SDTM → OMOP CDM v5.4 (LZZT reference dataset for testing).
- **A pluggable NER backend interface** matching the Phase 1 anonymizer pattern: one `NoteNlpNode` ABC with `LlmBackend`, `SciSpacyBackend`, optional `LlettuceBackend` plug-ins.
- **`Llettuce` integration** (TBD scope, Q4) — UCL's clinical concept-mapping library, evaluated as a possible third NER backend for vocabulary mapping accuracy.

This is **purely additive** to Phase 1. No existing Phase 1 manifest, node, or DB column is changed; the Phase 0 cross-cutting migration intent (Laravel CSV/FHIR ingestion riding the node SDK) is **still not** activated — that remains a separate planned cleanup.

## 2. Decision summary (preliminary, pending Q1-Q11)

Phase 2 ships:

1. **Two new nodes** added to `templates/runtime/nodes/` alongside the eleven Phase 0 + Phase 1 nodes. No node-SDK API changes (same posture as Phase 1).
2. **An NER plug-in interface** with two implementations in v1 (LLM + SciSpaCy) and an evaluation slot for Llettuce.
3. **MIMIC-IV ETL strategy** — TBD (Q6): port the OHDSI repo's logic into the Parthenon template runtime, or wrap it as an external invocation. Decision affects whether MIMIC parity is "ours" or "theirs".
4. **ARTEMIS chemo regimen logic** — Phase 2 ships the Python projection layer; the R-package data dependency is TBD (Q8: bundle, fetch at runtime, or customer-supplied).
5. **CDISC SDTM bridge** — uses `pyreadstat` for XPT files; LZZT (CDISC reference) is the test corpus.
6. **PR-shape (preliminary):** **6 plans**. Dependency chain: **Plan 1 (NER node + LLM backend) → Plan 2 (SciSpaCy) → Plan 3 (Llettuce, optional)** in parallel with **Plan 4 (MIMIC ETL) → Plan 5 (ARTEMIS)** and the independent **Plan 6 (SDTM bridge)**.
7. **Licensing posture** carries forward from Phase 1: ship logic + scaffolds, customers obtain heavyweight assets (vocabulary expansions, ARTEMIS R-package, LZZT XPT files) per their licenses.

## 3. Decisions log (Q1–Q11)

| # | Question | Chosen | Declined |
|---|---|---|---|
| Q1 | LLM provider default for `parthenon_ner_llm` | MedGemma via Ollama (local) as default; OpenAI-compatible API behind a feature flag for HIPAA-cleared deployments only | Cloud-only default (BAA/compliance burden); pin to a single non-MedGemma local model (loses domain accuracy) |
| Q2 | Prompt versioning shape | `templates/runtime/nlp/prompts/v0.1.0/*.md` files, manifest pins `metadata.prompt_version` | Inline in manifest YAML (brittle for long prompts); per-template prompt files (duplication) |
| Q3 | SciSpaCy model distribution | Separate `parthenon-scispacy` sidecar image with the model preloaded; main `parthenon-templates` image stays lean | Bundle in main image (~1.5 GB inflation for non-NER customers); fetch on first use (unreliable network egress at runtime) |
| Q4 | Llettuce scope in Phase 2 | Evaluation harness only (compare-mode vs LLM + SciSpaCy on a held-out OMOP mapping benchmark); production integration deferred to Phase 3 if it beats SciSpaCy | Full Phase 2 ship (no measured accuracy yet); defer entirely (loses momentum) |
| Q5 | NOTE_NLP audit retention | Always: token offsets + concept_id mappings + `model_name` + `prompt_version`. Raw input text encrypted in `app.note_nlp_audit` for 30 days then truncated | Store raw text indefinitely (PHI liability); store no raw text (breaks clinical replay/review) |
| Q6 | MIMIC-IV ETL strategy | Port OHDSI MIMIC-IV SQL into a Parthenon template (`load_mimic_iv_omop`) in 5-7 stages mirroring OHDSI's flow; we own upkeep | Wrap OHDSI repo as external sub-process invocation (correctness claim shifts to OHDSI, but loses our test coverage and template-runtime parity) |
| Q7 | Vocabulary baseline additions | HCPCS, ICD-10-PCS, NDC, ATC (chemo regimen), MedDRA (SDTM AE); declared per-template in `metadata.required_vocabularies` | Smaller (misses actual mapping needs); kitchen-sink full UMLS (license + load time impractical) |
| Q8 | ARTEMIS R-package distribution | Fetch from GitHub during `parthenon-templates` Docker build, pinned commit SHA. Image grows ~150 MB | Bundle in image as static blob (locks version forever); runtime fetch (fails offline); customer-supplied (ops burden) |
| Q9 | SDTM domain priority for v1 | DM (demographics), AE (adverse events), CM (concomitant meds), VS (vital signs), LB (labs) — covers ~80% of safety-trial data | Fewer domains (customers ask for missing immediately); ship-all (balloons Phase 2 scope) |
| Q10 | LZZT test fixture distribution | `templates/tests/fixtures/lzzt/` populated by `make fetch-fixtures` target hitting CDISC public URL; CI caches the result | Bundle in repo (bloat + license review); fetch on every CI run (flakes if CDISC down) |
| Q11 | LLM cost-ceiling test infrastructure | `pytest -m llm-live` lane, gated to schedule + workflow_dispatch only (mirrors PR #262 perf-trigger pattern); per-job budget cap of $1 enforced via env var | Mock-only (misses prompt-drift regressions); live-on-every-PR (unaffordable) |

## 4. Architecture (sketch — pending Q answers)

Phase 1's architecture diagram is unchanged. Phase 2 adds:

```
┌─────────────────────────────────────────────────────────────────┐
│  parthenon-templates container (extended)                        │
│  templates/                                                      │
│  ├── runtime/                                                    │
│  │   └── nodes/                                                  │
│  │       ├── (11 nodes from Phase 0 + Phase 1)                   │
│  │       ├── note_nlp.py          (NEW — T-016, plug-in iface)   │
│  │       └── sdtm_domain.py       (NEW — T-016)                  │
│  ├── runtime/                                                    │
│  │   └── nlp/                                                    │
│  │       ├── backends/                                           │
│  │       │   ├── llm.py           (NEW — Plan 1)                 │
│  │       │   ├── scispacy.py      (NEW — Plan 2)                 │
│  │       │   └── llettuce.py      (eval-only — Plan 3)           │
│  │       └── prompts/v0.1.0/      (NEW — Q2 outcome)             │
│  ├── manifests/                                                  │
│  │   ├── parthenon_ner_llm/       (NEW — Plan 1)                 │
│  │   ├── parthenon_ner_scispacy/  (NEW — Plan 2)                 │
│  │   ├── load_mimic_iv_omop/      (NEW — Plan 4)                 │
│  │   ├── artemis_chemo_regimens/  (NEW — Plan 5)                 │
│  │   └── sdtm_to_omop_v54/        (NEW — Plan 6)                 │
│
│  External sidecars (NEW)
│  ├── parthenon-scispacy           (Q3 outcome — model preload)   │
│  └── (no MS Anonymizer-style sidecar for LLM; goes through       │
│       existing parthenon-ai-service)                             │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Out of scope for Phase 2

These come up in Phase 3 or later, not here:

- **Federated NER** across Parthenon Networks (depends on Hive Networks federated layer; tracked separately).
- **Custom LLM fine-tuning** for clinical NER (operationally complex; needs its own ADR).
- **Real-time NER** on streaming clinical notes (Phase 2 is batch-only; streaming requires a Kafka/NATS layer not yet in the stack).
- **WADO/DICOM pixel-level CV** (the DICOM ETL stays metadata-only, same as Phase 1).
- **PDF / scanned-document OCR** before NER (Phase 2 assumes text-already-extracted).
- **Phase 1 follow-ups** that landed on tracked issues during the merge cascade:
  - MS anonymizer sidecar healthcheck investigation (task #34)
  - PR-C consent observation count fix (task #35)
  - Both addressed independently, not bundled into Phase 2 plans.

## 6. Acceptance criteria (target — pending Q answers)

By end of Phase 2:

- [ ] `parthenon_ner_llm` extracts clinical concepts from a 100-note FHIR DocumentReference fixture and writes ≥90% of expected NOTE_NLP rows (gold-standard from Phase 2 §11 reference set, TBD).
- [ ] `parthenon_ner_scispacy` runs offline (no network egress) and processes the same 100-note fixture in <5 min on the reference hardware.
- [ ] `load_mimic_iv_omop` ingests the MIMIC-IV demo subset (100 patients) and produces row counts matching the OHDSI reference within ±2%.
- [ ] `artemis_chemo_regimens` identifies ≥80% of regimens in a held-out chemo-cohort fixture (gold-standard from ARTEMIS validation set).
- [ ] `sdtm_to_omop_v54` ingests CDISC LZZT (DM, AE, CM, VS, LB domains) and produces a populated OMOP database that passes Phase 1's data-quality post-conditions.
- [ ] All Phase 2 templates honor the prompt-version pin and the audit retention policy (Q5 outcome).

## 7. Risks

- **R1 (high)**: LLM clinical NER accuracy varies hugely with prompt and model. Phase 2 needs a held-out gold-standard reference set to compare backends; if we don't curate one, the comparison in Q4 is meaningless.
- **R2 (medium)**: SciSpaCy model is large (~1.5 GB). If Q3 lands on bundled, the templates image inflates significantly.
- **R3 (medium)**: MIMIC-IV ETL is a moving target in OHDSI's repo. Forking (Q6) means we own the upkeep; not forking risks regressions when OHDSI publishes patches.
- **R4 (low)**: ARTEMIS R-package availability — if upstream changes the Github repo path, our Docker build (Q8) breaks. Mitigation: pin commit SHA, not branch.
- **R5 (low)**: LZZT dataset URL stability. CDISC has historically kept this stable but not guaranteed.

## 8. Per-plan PR shape (preliminary)

| # | Plan | Branch suggestion | Depends on |
|---|---|---|---|
| 1 | NER node + LLM backend (T-016 + T-017) | `feature/phase-2-templates-ner-node-llm` | Phase 1 main |
| 2 | SciSpaCy backend (T-018) | `feature/phase-2-templates-ner-scispacy` | Plan 1 |
| 3 | Llettuce evaluation (T-018b) | `feature/phase-2-templates-ner-llettuce-eval` | Plan 1 (parallel with Plan 2) |
| 4 | MIMIC-IV ETL (T-019) | `feature/phase-2-templates-mimic-iv` | Phase 1 main (independent of NER) |
| 5 | ARTEMIS chemo regimens (T-019b) | `feature/phase-2-templates-artemis` | Plan 4 |
| 6 | SDTM → OMOP bridge (T-020) | `feature/phase-2-templates-sdtm` | Phase 1 main (fully independent) |

## 9. Next step

§3 closed 2026-05-05; all 11 questions decided. Per-plan drafting starts now via `/gsd-plan-phase`, one plan per row of §8. Plan dependencies (§8) gate the merge train order; each plan opens its own PR following the Phase 1 stacked pattern.
