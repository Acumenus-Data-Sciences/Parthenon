# Phase 2 Plan 3 — Llettuce Eval Harness Execution Devlog

**Branch:** `feature/phase-2-plan-3-impl-llettuce`
**Plan:** `docs/superpowers/plans/2026-05-05-parthenon-ingestion-templates-phase-2-plan-3-ner-llettuce-eval.md`
**Started:** 2026-05-05

## Task progress (10/10)

- [x] Task 1: Pin `lettuce-omop` + `jinja2`
- [x] Task 2: `LlettuceBackend` + `LlettuceBackendError`
- [x] Task 3: `NoteNlpNode` dispatch — `"llettuce"` is eval-only (warns)
- [x] Task 4: Gold-standard benchmark fixture (100 notes / 407 mappings)
- [x] Task 5: `NerEvalRunner` + per-backend metrics
- [x] Task 6: `NerEvalReport` Jinja2 markdown template
- [x] Task 7: Eval-mode pytest lane (`-m ner_eval`)
- [x] Task 8: CI templates.yml `ner-eval` job (slow lane)
- [x] Task 9: Phase 3 graduation verdict callout in the report
- [x] Task 10: ADR 0013 — Llettuce evaluation findings + graduation criterion

## Pragmatic shortcut

Llettuce upstream isn't on PyPI yet (it's a uv workspace at
`Health-Informatics-UoN/lettuce`). Per ADR 0013, we ship a comment-block
"pin" in `pyproject.toml` documenting the manual install, and the
`LlettuceBackend` lazy-imports the package. The runner records "package
not installed" as the backend's error cell in the eval report rather
than aborting the whole run. Phase 3 replaces the comment-block with a
real PyPI pin once UCL publishes.

## Verification

- 4 LlettuceBackend tests + 5 metrics tests + 5 gold-standard tests + 4
  runner tests + 2 packaging tests = **20 new tests, all green.**
- The added `test_resolve_backend_warns_on_llettuce` test confirms the
  RuntimeWarning fires on the `"llettuce"` dispatch path.
- The eval-mode lane test (`-m ner_eval`) renders the comparison report
  end-to-end against stub backends.

## Notes

- The 100-note gold standard uses 28 curated OMOP standard concepts
  across SNOMED (10 conditions, 4 procedures), RxNorm (8 drugs), and
  LOINC (6 measurements). Deterministic via RNG seed 42. 407 gold rows
  total (3-5 spans per note).
- The Jinja2 report template includes per-vocabulary `concept_match_rate`
  tables and a "Phase 3 graduation criterion" callout that prints
  GRADUATE/HOLD based on the +5 pp SNOMED threshold.
- The CI `ner-eval` job is gated to `schedule` + `workflow_dispatch`
  only (mirrors the `ner-live` and `perf` slow lanes). The rendered
  report uploads as a 90-day-retention artifact for trend tracking.
