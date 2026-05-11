# Parthenon Ingestion Templates — Phase 4, Plan 5: Llettuce graduation re-evaluation

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

> **GATE — ADR 0013 reconsideration trigger**: Plan 1 LoRA fine-tune is the explicit reconsideration trigger. Re-run AFTER Plan 1 lands, BEFORE Plan 4 decision (Q7).

**Goal:** Re-run the Phase 3 Plan 7 Section C eval against fine-tuned bge-base (Plan 1) + Plan 6 curated benchmark and apply ADR 0013's `+5 pp SNOMED concept_match_rate` threshold. Verdict: GRADUATE or HOLD-FINAL.

**Architecture:**

- **Eval harness:** existing `templates/tests/eval/test_llettuce_graduation_against_curated_benchmark.py` (gated `pytest -m mapping_eval`). No code changes — Plan 1's `BgeEmbedder` adapter changes flow through transparently.
- **Pre-conditions:** Plan 1 acceptance run completed; fine-tuned adapters available locally.
- **Decision rule:** `delta_snomed = let_snomed_rate - sci_snomed_rate (with adapters)`. If `delta_snomed >= 0.05` → **GRADUATE**, ship `parthenon_ner_llettuce` template. Else → **HOLD-FINAL**, Llettuce stays an eval-only artifact for prompt-drift detection forever.

**Tech Stack:** Existing eval harness; no new code beyond the verdict.

**Depends on:** Plan 1 (fine-tuned bge-base adapters available).

**Unblocks:** Phase 4 closeout artifact (Llettuce status finalized).

---

## Conventions

- Backend conventions same as prior plans.
- Branch: `feature/phase-4-plan-5-llettuce-reeval`.
- Type names: if GRADUATE, `parthenon_ner_llettuce` mirrors `parthenon_ner_scispacy` shape.

---

## Task index (4 tasks)

1. **Run the gated eval** — `pytest -m mapping_eval templates/tests/eval/test_llettuce_graduation_against_curated_benchmark.py` against Plan 1 adapters. Writes `_eval/llettuce_graduation_report.md` with per-vocab `concept_match_rate`.
2. **Apply threshold + write verdict** — `_eval/llettuce_graduation_verdict.md` with one of:
   - `**Verdict: GRADUATE**` — `delta_snomed >= 0.05`. Document the lift number. Branch into Task 3.
   - `**Verdict: HOLD-FINAL**` — `delta_snomed < 0.05`. Document the actual delta. Branch into Task 4.
3. **GRADUATE branch (only if verdict is GRADUATE):** ship `templates/runtime/nlp/parthenon_ner_llettuce/` mirroring `parthenon_ner_scispacy` shape. Update Phase 2 ADR 0013 status from "HOLD" to "Graduated to production". Add NODE_TYPES + schema entry. Frontend NER backend dropdown gains "Llettuce" option.
4. **HOLD-FINAL branch (only if verdict is HOLD-FINAL):** amend ADR 0013 status from "HOLD" to "HOLD-FINAL — re-evaluation against Plan 1 LoRA-tuned bge-base did not move the threshold". Lock the eval-only role. The harness keeps running quarterly to catch prompt drift.

---

## Done

After Task 3 OR 4: ADR 0013 has the closing verdict; Llettuce status is final for the lifetime of the templates subproject.
