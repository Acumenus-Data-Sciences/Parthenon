"""NER backend evaluation harness (Phase 2 Plan 3 / T-018b; Q4).

Compares LlmBackend, SciSpacyBackend, and LlettuceBackend against a
held-out 100-note OMOP concept-mapping benchmark. Produces a markdown
report at ``templates/_eval/ner_backend_comparison.md`` with per-vocab
recall/precision/F1 + concept_match_rate. Phase 3 reads this report to
decide whether to graduate Llettuce to a production backend.

Legacy ``compute_recall`` / ``load_gold_standard`` from Plan 1 live at
``runtime.nlp.eval.recall`` and are re-exported here for backwards
compatibility with existing E2E tests.
"""

from __future__ import annotations

from runtime.nlp.eval.recall import (
    GoldRow,
    RecallReport,
    compute_recall,
    load_gold_standard,
)

__all__ = ["GoldRow", "RecallReport", "compute_recall", "load_gold_standard"]
