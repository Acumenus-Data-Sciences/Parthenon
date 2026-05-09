# Parthenon Ingestion Templates — Phase 4, Plan 4 (CONDITIONAL): Cross-encoder rerank

> **For agentic workers:** Use `superpowers:executing-plans`. **DO NOT EXECUTE THIS PLAN until Plan 1's acceptance numbers are surfaced.** Plan 4 fires only if Plan 1 LoRA + Plan 6 reranker leave seen top-5 OR blind top-5 below **0.90**. Otherwise this plan is HOLD-FINAL.

**Goal (conditional):** Add a second-stage cross-encoder rerank above the LLM rerank to close any residual top-5 gap that LoRA fine-tune did not close. Phase 4 spec Q4: ship only if needed.

**Architecture:**

- **Model:** `cross-encoder/ms-marco-MiniLM-L-6-v2` (MIT, ~80MB, CPU-friendly). Cross-encoder scores `(query, candidate_concept_name)` pairs; we rerank the bge-base top-50.
- **Pipeline:** retriever → cross-encoder rerank top-50 → LLM rerank top-5 (existing). Cross-encoder takes ~2-5ms per pair on CPU; ~250ms total per query → acceptable for batch reviewer flow, marginal for sync UI.
- **Tier:** Commercial-only. Lives in `templates/commercial/runtime/commercial/mapping/cross_encoder_reranker.py`.
- **Gating:** new feature flag `cross_encoder_enabled` (default false). Customers toggle on/off; default is off so the latency hit is opt-in.
- **Acceptance:** re-run Plan 6 Gate 2 acceptance with cross-encoder enabled. Targets: lift seen OR blind top-5 by **≥3 pp** vs Plan 1 numbers; if not, HOLD this plan and document the failure mode.

**Tech Stack:** sentence-transformers cross-encoder, existing acceptance harness.

**Depends on:** Plan 1 acceptance numbers (HARD GATE — only execute if top-5 < 0.90 on either set).

**Unblocks:** Final acceptance close-out for the mapping-loop lane.

---

## Conventions

- Backend conventions same as prior plans.
- Branch: `feature/phase-4-plan-4-cross-encoder-rerank`.
- Type names: `CrossEncoderReranker`, `CrossEncoderRerankerNode`.

---

## Task index (5 tasks)

1. **Conditional gate check** — open a checklist comment on the parent Phase 4 PR confirming Plan 1 surfaced numbers below the 0.90 threshold. **If Plan 1 cleared 0.90, mark this plan HOLD-FINAL and skip to Task 5 ADR amendment only.**
2. **CrossEncoderReranker** — `cross_encoder_reranker.py`: lazy-loads `ms-marco-MiniLM-L-6-v2`, scores `(query, concept_name)` pairs, returns reordered top-K. Accepts an optional `BgeCandidate[]` and returns the same list reordered.
3. **Pipeline wiring** — `ConceptMappingSuggesterNode` adds an optional `cross_encoder: CrossEncoderReranker | None` constructor param. If set, applies between bge top-50 and LLM rerank to top-5. Feature flag check happens in `Node.from_settings()`.
4. **Acceptance re-run** — re-execute `pytest -m mapping_eval` with cross-encoder enabled. Numbers in `_eval/cross_encoder_acceptance.md`. Per-vocabulary breakdown so we can see which vocabularies actually benefited.
5. **ADR amendment + verdict commit** — amend ADR 0019:
   - **GRADUATE branch** (≥3 pp lift): merge the plan, default `cross_encoder_enabled = false` for opt-in, document latency cost.
   - **HOLD-FINAL branch** (<3 pp lift OR Plan 1 already cleared): document the verdict in ADR 0019, do not ship the runtime node, archive the spike code in `templates/commercial/spikes/cross_encoder/`.

---

## Done

After Task 5: ADR 0019 has the cross-encoder verdict (GRADUATE or HOLD-FINAL); if GRADUATE, the runtime node + feature flag are wired.
