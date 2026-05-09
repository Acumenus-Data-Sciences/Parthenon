# Parthenon Ingestion Templates — Phase 4, Plan 1: bge-base per-vocabulary LoRA fine-tune (issue #295)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **GATE — empirical reproduction**: Plan 1 owns the empirical close of Phase 3's open follow-ups (ADR 0019, issue #295). After Task 8, the Plan 6 Gate 2 acceptance run MUST be re-executed against fine-tuned adapters before opening the PR.

**Goal:** Per-vocabulary LoRA fine-tune of `BAAI/bge-base-en-v1.5` so the Plan 6 (Harmonia) retriever recall closes both gates the v0.1 baseline missed: seen top-5 ≥ **0.85** and blind top-5 ≥ **0.75**. Plan 6 Gate 2 proved Sonnet ≈ Haiku on the rerank — the bottleneck is upstream (retrieval recall@50). LoRA is the named ticket per ADR 0019 + issue #295.

**Architecture:**

- **Adapter scope (Q2):** `r=16, alpha=32` per-vocabulary. Five separate adapters: SNOMED, RxNorm, LOINC, ICD10CM, NDC. Adapters live in `templates/commercial/runtime/commercial/mapping/lora/<vocab>/` (gitignored — weights are large; CI publishes via release artifact).
- **Training data (Q1):** Plan 6 curated benchmark only — `templates/tests/eval/data/seen.csv` (1557 rows). Hard negatives sampled from bge-base top-50 retriever output for each positive. NO PHI by construction (Q12).
- **Compute (Q13):** Local 7900XTX via ROCm 6.2 + Python 3.12. Reproducible env at `templates/commercial/scripts/lora_train_env.sh`.
- **Loader integration:** `BgeEmbedder.encode(text, vocabulary_id=None)` accepts an optional `vocabulary_id`. If set and an adapter exists, applies it; otherwise falls back to base bge-base. No breaking change to existing call sites.
- **Acceptance:** re-run `pytest -m mapping_eval` against fine-tuned adapters with the same Haiku 4.5 reranker. Targets: **seen top-5 ≥ 0.85, blind top-5 ≥ 0.75.** Per-vocabulary metrics surfaced in the report.

**Tech Stack:** Python 3.12, sentence-transformers + peft (LoRA), ROCm 6.2 torch, Plan 6's existing acceptance harness.

**Depends on:**
- Phase 3 closed (Plan 6 / Harmonia v0.1 + curated benchmark on main).

**Unblocks:** Plan 3 (auto-approval — needs calibrated cutoffs from Plan 1's blind set), Plan 4 (cross-encoder, only fires if Plan 1 doesn't close top-5 < 0.90), Plan 5 (Llettuce re-eval).

---

## Conventions

- Backend conventions same as prior plans.
- Branch: `feature/phase-4-plan-1-bge-base-lora`.
- Type names: `LoraAdapterRegistry`, `BgeEmbedder.encode(vocabulary_id=...)`.
- All training scripts mark `pytest.mark.training` (off by default; opt-in only).

---

## Task index (10 tasks)

1. **Reproducible training env** — `templates/commercial/scripts/lora_train_env.sh` pins ROCm 6.2 torch + peft + sentence-transformers versions; verifies `python -c "import torch; print(torch.cuda.is_available())"` returns True.
2. **Hard-negative miner** — `mine_hard_negatives.py` runs base bge-base top-50 over `seen.csv`; for each positive, samples 4 hard negatives (same domain, high cosine, different concept_id). Writes `templates/tests/eval/data/training_pairs.parquet`.
3. **Per-vocabulary partition** — split training pairs into `<vocab>.parquet` files (SNOMED/RxNorm/LOINC/ICD10CM/NDC). Tasks 4-6 train one adapter per partition.
4. **Training loop** — `train_lora.py --vocab=SNOMED --r=16 --alpha=32 --epochs=10 --batch_size=64`. Uses `MultipleNegativesRankingLoss`. Saves adapter to `lora/<vocab>/`. Logs recall@50 per epoch on a held-out 10% split.
5. **Per-adapter recall ablation** — for each trained adapter, compute recall@50 lift vs base bge-base on the held-out split. **Acceptance: ≥5 pp lift on each vocabulary** (R1 mitigation per Phase 4 spec).
6. **`LoraAdapterRegistry`** — at startup, scans `lora/` for adapter dirs; maintains `vocabulary_id → adapter_path` map. Exposes `register(vocabulary_id, path)` for tests.
7. **`BgeEmbedder` vocabulary-aware encode** — `encode(text, vocabulary_id=None)` looks up the registry; if an adapter exists, loads it (cached) and applies. Otherwise falls back to base. Add `embeddings_with_adapter` flag to `ConceptCandidate` for traceability.
8. **Re-run Plan 6 Gate 2 acceptance** against fine-tuned adapters — same script `templates/scripts/run_mapping_acceptance.py`, same Haiku 4.5 reranker, full 2078-pair benchmark. **Targets: seen top-5 ≥ 0.85, blind top-5 ≥ 0.75.** Per-vocabulary metrics in the report.
9. **ADR 0019 amendment** — add a "2026-XX-XX Phase 4 Plan 1 acceptance" subsection with the empirical numbers. Mark issue #295 closed.
10. **CI workflow** — `.github/workflows/lora-training.yml` runs Tasks 4 + 5 on workflow_dispatch only (training is heavy; not on every push). Uploads adapter weights as a 90-day artifact.

---

## Done

After Task 10, Plan 1 ships:
- 5 vocabulary adapters, recall@50 ablation report, fine-tuned acceptance numbers
- BgeEmbedder vocabulary-aware encode wired
- ADR 0019 amended with the closing acceptance numbers
- Issue #295 closed

**Pre-PR check-in:** Task 8 acceptance numbers (especially for the blind-set top-5 ≥0.75 gate) MUST be surfaced before opening the PR. If the gate misses, fall back to per-vocabulary partial-graduation: ship adapters that DO clear ≥5 pp recall@50 lift, document which vocabularies still miss, route those to Plan 4 (cross-encoder) or HOLD per Q4 of the Phase 4 spec.
