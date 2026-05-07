# ADR 0013 — Llettuce Evaluation Harness + Phase 3 Graduation Criterion

**Status:** Amended 2026-05-07 — Llettuce HOLD; remains eval-only.
**Original status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q4 (Llettuce eval-only in Phase 2);
Phase 3 Plan 7 Section C (Llettuce graduation decision).
**Implements:** Phase 2 Plan 3 (T-018b); Phase 3 Plan 7 Tasks 16-18.

## Context

Phase 2's NER pipeline ships two production backends behind the
`NlpBackend` Protocol: `LlmBackend` (Plan 1, OpenAI/Ollama) and
`SciSpacyBackend` (Plan 2, sidecar). The third candidate — UCL's
[Llettuce](https://github.com/Health-Informatics-UoN/lettuce) — is a
clinical concept-mapping library with a different shape (vector-search
over OMOP concept embeddings) and isn't yet on PyPI.

Per Q4, Phase 2 does NOT graduate Llettuce to a production backend
without measured evidence. We need a comparison harness that quantifies
each backend's accuracy on the same gold standard so Phase 3 can decide
on the merits.

## Decision

**Ship `LlettuceBackend` as eval-only in Phase 2.** The backend
implements the `NlpBackend` Protocol and is reachable via the
`NoteNlpNode` dispatch (so the `NerEvalRunner` can construct it
uniformly), but the dispatch path emits a `RuntimeWarning` flagging
"eval-only — Phase 3 graduation gated to ADR 0013". Production manifests
must NOT use it.

**Build a 100-note gold-standard benchmark + 3-backend comparison
harness.** The harness lives at `templates/runtime/nlp/eval/` and:

1. Generates `notes.ndjson` (100 synthetic clinical notes) and
   `gold_standard.csv` (~400 OMOP concept mappings) via
   `build_gold_standard.py` (deterministic, seed=42).
2. Runs every configured backend through every note, computing
   span-level precision/recall/F1 + concept-match rate.
3. Aggregates per-vocabulary concept-match rates (SNOMED / RxNorm /
   LOINC) — these are the metrics that drive the graduation decision.
4. Renders a Jinja2 markdown report at `_eval/ner_backend_comparison.md`
   with a "Phase 3 graduation criterion" callout block.

**Phase 3 graduation criterion:** Llettuce graduates to a production
backend if its **SNOMED concept_match_rate** beats SciSpaCy's by **≥ +5
percentage points** on this benchmark. The verdict (`GRADUATE` /
`HOLD`) is computed inside the report template so anyone reading the
artifact sees the answer at the bottom.

The eval lane is gated to `schedule` + `workflow_dispatch` only — it's
slow, costs LLM tokens, and isn't part of normal CI gating. CI uploads
the rendered report as a build artifact for trend tracking.

## Consequences

- **Phase 2 ends with a measured comparison.** No more
  reasoning-from-architecture about which NER backend is best for OMOP
  concept mapping — the report is the answer.
- **The harness is reusable.** Any future LLM prompt change, vocabulary
  refresh, or new backend candidate runs through the same gold standard
  and surfaces as a delta in the report.
- **No production exposure.** The `RuntimeWarning` on the
  `NoteNlpNode` dispatch path means a customer who wires `backend:
  llettuce` into a manifest gets a noisy stderr signal pointing at this
  ADR.
- **Llettuce package availability is a Phase 3 problem.** Upstream
  (UCL) hasn't published to PyPI, so we document the manual install in
  `pyproject.toml` and lazy-import the package. The `LlettuceBackend`
  raises `LlettuceBackendError` cleanly if the package isn't installed,
  which the runner records as the backend's "error" cell in the report.

## Alternatives considered

- **Ship Llettuce as a third production backend now.** Declined — Q4
  explicitly defers this to a measured Phase 3 decision. Without the
  comparison, we'd be picking based on architecture preferences, not
  accuracy.
- **Skip Llettuce entirely; Phase 2 ends with two backends.** Declined
  — building the comparison harness is cheap, and the eval report is
  reusable for Phase 3+ regression detection regardless of the Llettuce
  verdict.
- **Use UMLS REST API instead of Llettuce for concept mapping.**
  Declined — UMLS licensing complicates redistribution. Llettuce is
  Apache-2.0 and OMOP-native, both of which match Parthenon's
  distribution model.
- **Run the eval against the 1M-row throughput benchmark.** Declined —
  100 notes is enough for accuracy stats; throughput is already
  exercised by the perf job. Different gates for different signals.

## Open follow-ups

- **Phase 3 decision (T-022 prep work):** read the latest scheduled
  `ner-eval` artifact, apply the +5 pp SNOMED threshold, and either
  ship `parthenon_ner_llettuce` (mirror of `parthenon_ner_scispacy`)
  or document the rejection.
- **Real Llettuce package install in CI.** Once UCL publishes to PyPI,
  pin the version + drop the comment-block scaffolding from
  `pyproject.toml`.
- **Expand the gold standard to ≥1,000 mappings.** 400 is enough to
  separate "broken" from "working"; 1k+ would tighten the confidence
  intervals around the +5 pp threshold.
- **Add a `parthenon_ner_eval` template manifest** that wires the
  runner to a customer's NOTE table for benchmarking against their own
  corpus (not just synthetic). Phase 3+.

---

## 2026-05-07 Amendment — Phase 3 Plan 7 Section C: HOLD verdict

**Verdict: HOLD.** Llettuce remains an eval-only artifact. Production
NER manifests continue to use `parthenon_ner_llm` and
`parthenon_ner_scispacy`; the canonical concept-mapping path moves to
T-024 (Harmonia) per Phase 3 Plan 6.

### Numbers

The graduation eval (`tests/eval/
test_llettuce_graduation_against_curated_benchmark.py`, gated to
`pytest -m mapping_eval`) was wired up in Plan 7 Tasks 16-17 but could
not produce a head-to-head SNOMED `concept_match_rate` delta because
the prerequisites are not all simultaneously satisfiable in this
environment:

- The Plan 6 curated benchmark (`commercial/runtime/commercial/
  mapping/benchmark/v0.1.0/seen.csv`) is gitignored; it is generated
  per-customer against a real `vocab.concept_relationship`.
- The SciSpaCy backend reaches the `parthenon-scispacy:5101` sidecar,
  whose model wheel (`en_core_sci_md`) is currently 404 at upstream
  (tracked as a Phase 2 Plan 2 follow-up).
- The Llettuce upstream package (UCL `lettuce`) is not yet published
  on PyPI; the runtime backend lazy-imports it and skips when absent.

The graduation test SKIPs cleanly under all three conditions, so the
eval ships ready-to-run but the empirical delta is **deferred to the
nightly slow lane** once the SciSpaCy sidecar wheel + Llettuce PyPI
package both become reachable.

In the meantime, the qualitative case for HOLD is strong enough to
move forward on it as the verdict.

### Rationale

**The concept-mapping niche Llettuce was supposed to fill is now
covered by Harmonia (Plan 6, T-024A).** Plan 6 ships
`runtime/commercial/mapping/` — BAAI/bge-base-en-v1.5 retrieval over
`vocab.concept_embedding_bge` plus an LLM rerank stage —
which is purpose-built for `(source_text, source_vocab) -> standard
OMOP concept_id` and meets the seen.csv top-1/top-5 acceptance gates
(60%/85%) and blind.csv gates (50%/75%). Llettuce's strength is
precisely that vector-search-over-OMOP-embeddings shape. With Harmonia
already in place and integrated into the Phase 3 mapping-review UI
(Plan 7 Section A, T-024B), adding a second vector-mapping backend
duplicates capability without a clear differentiator.

**The Sonnet 4.6 vs Haiku 4.5 ablation on Plan 6 Gate 2 acceptance
landed both models above gates** — both passed the 60%/85% top-1/top-5
seen.csv gates. That signal says the rerank stage is doing real work
and the bge-base retriever has enough recall that the LLM choice
within reasonable bounds doesn't move the headline number much. By
extension, swapping the entire retriever for Llettuce is unlikely to
produce a SNOMED `concept_match_rate` delta of +5 pp without a
matching domain-specific fine-tune of the encoder.

**The right time to re-open this decision is after issue #295
(per-vocabulary fine-tune of bge-base) lands.** That work targets the
exact failure mode where Llettuce might still win — RxNorm and LOINC
concept_match_rate, where the generic English encoder underperforms
on standardized clinical naming conventions. Once #295 retrains the
embedder against per-vocabulary contrastive pairs, re-running the
graduation eval (which is now permanently wired) against an apples-
to-apples updated `seen.csv` will produce the head-to-head delta this
ADR was designed to gate on.

### Consequences of HOLD

- `parthenon_ner_llettuce` is **NOT** shipped. No new manifest, no
  NODE_TYPES entry, no schema change.
- Llettuce stays reachable via the `NoteNlpNode` dispatch (with the
  `RuntimeWarning` from Phase 2 still firing) so the eval lane keeps
  running. The harness exists primarily as a prompt-drift / encoder-
  drift regression detector now: Plan 7's verdict markdown will
  surface a delta change before any future graduation re-decision.
- T-024 (Harmonia) is the canonical concept-mapping path. Customer-
  facing language in the docs site should point Plan 6 first; Llettuce
  is an internal R&D artifact, not a customer-installable backend.
- The `mapping_eval` lane now uploads
  `_eval/llettuce_graduation_{report,verdict}.md` alongside the
  existing `ner_backend_comparison.md` (90-day retention) so future
  re-evaluations have a stable artifact lineage.

### Phase 4 reconsideration trigger

Re-open this ADR when **any** of the following land:

1. Issue #295 (per-vocabulary bge-base fine-tune).
2. UCL publishes Llettuce to PyPI with stable APIs.
3. A customer-furnished benchmark shows >= +5 pp SNOMED edge for
   Llettuce against Harmonia on their corpus (the eval lane is
   designed to accept arbitrary `seen.csv`).
