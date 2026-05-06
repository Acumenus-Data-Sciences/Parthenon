# ADR 0013 — Llettuce Evaluation Harness + Phase 3 Graduation Criterion

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q4 (Llettuce eval-only in Phase 2).
**Implements:** Phase 2 Plan 3 (T-018b).

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
