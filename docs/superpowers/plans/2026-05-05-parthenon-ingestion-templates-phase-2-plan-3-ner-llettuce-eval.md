# Parthenon Ingestion Templates — Phase 2, Plan 3: Llettuce Evaluation Harness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land an evaluation harness that compares three NER backends — `LlmBackend` (Plan 1), `SciSpacyBackend` (Plan 2), and a new `LlettuceBackend` (this plan) — against a held-out OMOP concept-mapping benchmark, and produces a markdown report measuring per-vocabulary recall, precision, F1, and pairwise span Jaccard. **This is an evaluation deliverable, not a production ship** (decision Q4): the harness exists so Phase 3 can decide whether to graduate Llettuce to a third production backend on the merits of measured accuracy.

**Architecture:** A new `LlettuceBackend` (`templates/runtime/nlp/backends/llettuce.py`) implements the `NlpBackend` Protocol from Plan 1. Llettuce is UCL's clinical concept-mapping library (https://github.com/Health-Informatics-UoN/lettuce); it operates as a Python package (no sidecar). `LlettuceBackend` calls into the package directly, mapping spans to OMOP concept_ids via Llettuce's vector-search index. A new evaluation harness (`templates/runtime/nlp/eval/`) loads the OMOP gold-standard benchmark, runs all three backends, computes metrics, and renders a comparison report at `templates/_eval/ner_backend_comparison.md`. A new pytest lane (`-m ner-eval`) gates the harness to schedule + workflow_dispatch only — it's slow, costs money via the LLM live path, and isn't part of normal CI gating. The harness is **not** plumbed into a production manifest; `NoteNlpNode` retains its existing 2-backend dispatch (`llm`, `scispacy`).

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 + Phase 2 Plan 1/2 toolchain. New deps: `lettuce-omop>=0.4.0` (UCL Llettuce; pin against PyPI as of 2026-05-05; if package name differs check the upstream repo). The evaluation harness uses `pandas`/`polars` (already pinned in Phase 0) for the benchmark loader and `jinja2>=3.1` for the report template.

**Depends on:** Phase 2 Plan 1 (PR #264, merged) for `NlpBackend` Protocol + `NerInferenceResult`; Phase 2 Plan 2 (PR #268, pending merge) for `SciSpacyBackend` (the harness needs all 3 backends available). If Plan 2 hasn't merged yet, the harness can be authored against the Protocol and run mock-mode; the live integration test gates Plan 2's merge.

**Unblocks:** Phase 3 decision on Llettuce production integration. Phase 2 ends without a production Llettuce template; the report from this harness is the input to that Phase 3 decision.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`).
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Branch model:** sequential commits on the Phase 2 Plan 3 branch (`feedback_worktree_sweep_regressions.md`).
- **Type names** (stable across all tasks): `LlettuceBackend`, `LlettuceBackendError`, `NerEvalReport`, `BackendMetrics`, `GoldStandardEntry`, `NerEvalRunner`.
- **Pinned versions** (validated as of 2026-05-05; verify against the upstream repo at integration time):
  - `lettuce-omop>=0.4.0` (or upstream-equivalent name; resolve at packaging step)
  - `jinja2>=3.1` (report rendering)
  - All other deps unchanged from Phase 0/1/2-Plan-1/2-Plan-2.

---

## Task index (10 tasks)

1. Pin `lettuce-omop` + `jinja2` in `pyproject.toml`
2. `LlettuceBackend` + `LlettuceBackendError`
3. `NoteNlpNode` dispatch — register `"llettuce"` for evaluation only (warn-mode)
4. Gold-standard benchmark fixture: 100-note FHIR + per-note concept mappings CSV
5. `NerEvalRunner` — runs all 3 backends + computes per-vocab metrics
6. `NerEvalReport` Jinja2 markdown template
7. Eval-mode pytest lane (`-m ner-eval`) gated to schedule + workflow_dispatch
8. Workflow job in templates.yml — depends on lint-and-test, parallel to perf
9. Llettuce-vs-SciSpaCy concept-mapping accuracy comparison (the headline metric)
10. ADR 0013 — Llettuce evaluation findings + Phase 3 graduation criterion

---

## Task 1: Pin `lettuce-omop` + `jinja2`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/test_phase_2_plan_3_packaging.py
"""Smoke test that Phase 2 Plan 3 deps are pinned."""
from __future__ import annotations

from pathlib import Path


def test_pyproject_pins_llettuce_and_jinja() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    # The exact package name may differ at upstream; confirm at integration time.
    assert ('"lettuce-omop' in pyproject) or ('"lettuce' in pyproject)
    assert '"jinja2>=3.1"' in pyproject
```

- [ ] **Step 2-5:** Add the pins, run gates. **Commit:** `chore(templates): pin lettuce-omop + jinja2 for Phase 2 Plan 3 eval harness`.

**Note for executor:** if `lettuce-omop` is not the canonical name on PyPI, check the upstream repo (https://github.com/Health-Informatics-UoN/lettuce) for the correct package name and update the pin. The test should match whatever name resolves.

---

## Task 2: `LlettuceBackend`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/llettuce.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_llettuce_backend.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/exceptions.py` (add `LlettuceBackendError`)

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_llettuce_backend.py
"""LlettuceBackend implements NlpBackend; mocks the upstream package surface."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backend import NlpBackend
from runtime.nlp.exceptions import LlettuceBackendError
from runtime.nlp.types import NerInferenceResult


def test_backend_satisfies_protocol() -> None:
    # Construct without touching the upstream package (lazy import inside infer).
    from runtime.nlp.backends.llettuce import LlettuceBackend
    backend: NlpBackend = LlettuceBackend()
    assert hasattr(backend, "infer")


@patch("runtime.nlp.backends.llettuce._lettuce_run")
def test_backend_calls_lettuce(mock_run: MagicMock) -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend
    mock_run.return_value = [
        # Backend-internal shape, normalized inside infer
        {"start": 0, "end": 10, "text": "chest pain", "label": "condition",
         "concept_id": 4030518, "vocabulary_id": "SNOMED", "confidence": 0.88},
    ]
    backend = LlettuceBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")
    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "lettuce-omop"
    assert len(result.spans) == 1
    assert len(result.mappings) == 1
    assert result.mappings[0].vocabulary_id == "SNOMED"


@patch("runtime.nlp.backends.llettuce._lettuce_run")
def test_backend_wraps_internal_errors(mock_run: MagicMock) -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend
    mock_run.side_effect = RuntimeError("upstream boom")
    backend = LlettuceBackend()
    with pytest.raises(LlettuceBackendError):
        backend.infer("text", "v0.1.0")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llettuce_backend.py -v
```

Expected: FAIL — module + exception missing.

- [ ] **Step 3: Write minimal implementation**

Add `LlettuceBackendError` to `templates/runtime/nlp/exceptions.py`:

```python
class LlettuceBackendError(LlmBackendError):
    """Raised when the Llettuce upstream package fails."""
```

```python
# templates/runtime/nlp/backends/llettuce.py
"""Llettuce backend — UCL's clinical concept-mapping library.

Phase 2 ships this as an EVALUATION-ONLY backend (decision Q4): used by
the NerEvalRunner for compare-mode metrics, NOT registered for production
manifests. Phase 3 will decide whether to graduate Llettuce to a third
production backend based on the report this harness produces.

The upstream package is imported lazily so customers who don't run the
eval harness don't pay the import cost.
"""
from __future__ import annotations

from typing import Any

from runtime.nlp.exceptions import LlettuceBackendError
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def _lettuce_run(text: str) -> list[dict[str, Any]]:
    """Indirection over the upstream package call.

    Implemented as a module-level function so unit tests can `patch` it
    without standing up the real Llettuce index. The real implementation
    imports the package lazily and runs the configured pipeline.
    """
    try:
        # Resolve the actual upstream API at integration time. Placeholder:
        from lettuce_omop import run as _run  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise LlettuceBackendError(
            "lettuce-omop package not installed; pin it in pyproject.toml first"
        ) from exc
    return list(_run(text))


class LlettuceBackend:
    def __init__(self) -> None:
        self.model_name = "lettuce-omop"

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        try:
            raw = _lettuce_run(text)
        except LlettuceBackendError:
            raise
        except Exception as exc:
            raise LlettuceBackendError(f"lettuce inference failed: {exc}") from exc

        spans: list[NerSpan] = []
        mappings: list[NerConceptMapping] = []
        for i, item in enumerate(raw):
            spans.append(NerSpan(
                start=int(item["start"]),
                end=int(item["end"]),
                text=str(item["text"]),
                label=str(item["label"]),
            ))
            if "concept_id" in item:
                mappings.append(NerConceptMapping(
                    span_index=i,
                    concept_id=int(item["concept_id"]),
                    vocabulary_id=str(item["vocabulary_id"]),
                    confidence=float(item["confidence"]),
                ))
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )
```

- [ ] **Step 4-5:** Run test + gates. **Commit:** `feat(templates): LlettuceBackend (eval-only; Q4)`.

---

## Task 3: `NoteNlpNode` dispatch — `"llettuce"` is eval-only

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/note_nlp.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_note_nlp_node.py`

Per Q4, Llettuce is NOT a production backend in Phase 2. We register `"llettuce"` in `from_config` so the eval harness can construct the node uniformly, but emit a one-time `RuntimeWarning` when this path is used so that anyone wiring it into a production manifest sees the signal.

- [ ] **Step 1: Write the failing test**

```python
def test_node_warns_on_llettuce_backend(recwarn: pytest.WarningsRecorder) -> None:
    NoteNlpNode.from_config({"backend": "llettuce", "prompt_version": "v0.1.0"})
    msgs = [str(w.message) for w in recwarn.list]
    assert any("eval-only" in m.lower() for m in msgs)
    assert any("phase 3" in m.lower() for m in msgs)
```

- [ ] **Step 2-5:** Implement. Wire the dispatch + warning. **Commit:** `feat(templates): NoteNlpNode registers Llettuce as eval-only (warns) — Q4`.

---

## Task 4: Gold-standard benchmark fixture

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/gold_standard.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/notes.ndjson`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_eval_gold_standard.py`

The benchmark is a **superset** of Plan 1's `parthenon_ner_llm/validation/expected/note_nlp_rows.csv` — same 100 notes, but with curated concept_id mappings for every span in the gold CSV. This lets the harness measure both span-level recall and concept-mapping accuracy.

- [ ] **Step 1: Write the failing test**

```python
def test_gold_standard_csv_exists() -> None:
    p = Path(__file__).resolve().parents[2] / "runtime" / "nlp" / "eval" / "gold_standard.csv"
    assert p.is_file()


def test_gold_standard_has_required_columns() -> None:
    import pandas as pd
    p = Path(...) / "gold_standard.csv"
    df = pd.read_csv(p)
    expected = {"note_id", "start", "end", "text", "label",
                "concept_id", "vocabulary_id"}
    assert expected <= set(df.columns)


def test_notes_ndjson_has_100_entries() -> None:
    p = Path(...) / "notes.ndjson"
    lines = [ln for ln in p.read_text().splitlines() if ln.strip()]
    assert len(lines) == 100
```

- [ ] **Step 2-5:** Generate the gold standard. The 100 notes can be the same synthetic corpus used by Plan 1 (linked or copied with attribution). The CSV column shape: `note_id,start,end,text,label,concept_id,vocabulary_id`. Curate ~3-5 entries per note → ~400 rows. **Commit:** `feat(templates): NER eval gold-standard benchmark (100 notes + ~400 concept mappings)`.

---

## Task 5: `NerEvalRunner`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/runner.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/metrics.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_eval_metrics.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_eval_runner.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_eval_metrics.py
"""Per-backend metrics: span-level precision/recall/F1 and concept-mapping accuracy."""
from __future__ import annotations

from runtime.nlp.eval.metrics import BackendMetrics, compute_metrics
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def test_perfect_match_yields_f1_one() -> None:
    gold = [{"start": 0, "end": 10, "text": "chest pain", "label": "condition",
             "concept_id": 4030518, "vocabulary_id": "SNOMED"}]
    pred = NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="condition")],
        mappings=[NerConceptMapping(span_index=0, concept_id=4030518,
                                    vocabulary_id="SNOMED", confidence=0.9)],
        model_name="x", prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_f1 == 1.0
    assert m.concept_match_rate == 1.0


def test_no_overlap_yields_f1_zero() -> None:
    gold = [{"start": 0, "end": 10, "text": "chest pain", "label": "condition",
             "concept_id": 4030518, "vocabulary_id": "SNOMED"}]
    pred = NerInferenceResult(
        spans=[NerSpan(start=20, end=30, text="other", label="condition")],
        mappings=[], model_name="x", prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_f1 == 0.0
```

- [ ] **Step 2-5:** Implement metric computation (span-level precision/recall/F1 with offset-overlap matching; concept-mapping accuracy = fraction of matched spans where predicted concept_id == gold concept_id). The runner iterates the 100 notes through each backend and aggregates per-vocabulary metrics. **Commit:** `feat(templates): NerEvalRunner + per-backend span/concept metrics`.

---

## Task 6: `NerEvalReport` Jinja2 markdown template

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/report.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/eval/report_template.md.j2`

The report renders a side-by-side table of LlmBackend / SciSpacyBackend / LlettuceBackend metrics: span F1, concept-mapping accuracy per vocabulary (SNOMED, RxNorm, LOINC), per-note runtime, and pairwise span-set Jaccard.

- [ ] **Step 1: Write the failing test**

```python
def test_report_renders_with_three_backends(tmp_path: Path) -> None:
    metrics = {
        "llm": BackendMetrics(span_f1=0.91, concept_match_rate=0.86, ...),
        "scispacy": BackendMetrics(span_f1=0.83, concept_match_rate=0.0, ...),
        "llettuce": BackendMetrics(span_f1=0.87, concept_match_rate=0.81, ...),
    }
    out = render_report(metrics, out_dir=tmp_path)
    assert out.is_file()
    body = out.read_text(encoding="utf-8")
    assert "## NER Backend Comparison" in body
    assert "LlmBackend" in body
    assert "SciSpacyBackend" in body
    assert "LlettuceBackend" in body
```

- [ ] **Step 2-5:** Implement the renderer + template. Output goes to `templates/_eval/ner_backend_comparison.md` by default; CI uploads it as an artifact. **Commit:** `feat(templates): NerEvalReport Jinja2 markdown renderer`.

---

## Task 7: Eval-mode pytest lane

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml` (register `ner_eval` marker)
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/eval/test_ner_backend_comparison.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/eval/test_ner_backend_comparison.py
"""Slow lane: run all 3 NER backends through the gold standard, write report.

Marked `ner_eval`; default `pytest -q` skips it. Run explicitly:

    uv run pytest tests/eval/ -v -m ner_eval
"""
from __future__ import annotations

from pathlib import Path

import pytest


@pytest.mark.ner_eval
def test_three_backend_report_renders(tmp_path_factory: pytest.TempPathFactory) -> None:
    from runtime.nlp.eval.runner import NerEvalRunner
    out_dir = tmp_path_factory.mktemp("eval_out")
    runner = NerEvalRunner(out_dir=out_dir)
    runner.run_all_backends()
    report = out_dir / "ner_backend_comparison.md"
    assert report.is_file()
    body = report.read_text(encoding="utf-8")
    assert "LlmBackend" in body
    assert "SciSpacyBackend" in body
    assert "LlettuceBackend" in body
```

- [ ] **Step 2-5:** Register the marker in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = [
    "integration: integration tests against testcontainers Postgres",
    "slow: slow throughput perf tests",
    "ner_eval: NER backend evaluation harness (slow + costs LLM tokens)",
    # ... existing markers ...
]
```

**Commit:** `test(templates): NER eval pytest lane (-m ner_eval); gated to scheduled CI`.

---

## Task 8: CI templates.yml — `ner-eval` job

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

Add a new job mirroring the `perf` job pattern from PR #262:

```yaml
  ner-eval:
    name: NER backend comparison (parthenon-templates, slow lane)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 90
    needs: lint-and-test
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: parthenon
          POSTGRES_PASSWORD: parthenon
          POSTGRES_DB: parthenon
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U parthenon"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql+psycopg://parthenon:parthenon@localhost:5432/parthenon
      OPENAI_LLM_ENABLED: "true"
      OPENAI_BUDGET_USD: "1.00"
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          version: "0.5.11"
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Sync dependencies
        working-directory: templates
        run: uv sync --all-extras
      - name: Build + start parthenon-scispacy sidecar
        run: |
          docker compose build parthenon-scispacy
          docker compose up -d parthenon-scispacy
          for i in $(seq 1 60); do
            status=$(docker compose ps --format json parthenon-scispacy | jq -r '.[0].Health // .[].Health // empty')
            if [ "$status" = "healthy" ]; then exit 0; fi
            sleep 5
          done
          echo "scispacy did not become healthy"; exit 1
      - name: NER backend comparison
        working-directory: templates
        env:
          PARTHENON_SCISPACY_URL: http://localhost:5101
        run: |
          mkdir -p _eval
          uv run pytest tests/eval/ -v -m ner_eval --maxfail=1 2>&1 | tee _eval/run.log
      - name: Upload eval report + log
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ner-eval-${{ github.run_id }}
          path: |
            templates/_eval/ner_backend_comparison.md
            templates/_eval/run.log
          if-no-files-found: warn
          retention-days: 90
```

- [ ] **Step 1-3:** Add the job + validate YAML + commit. **Commit:** `ci(templates): NER backend comparison job (slow lane; nightly + dispatch)`.

---

## Task 9: Llettuce-vs-SciSpaCy concept-mapping accuracy comparison

This is the **headline metric** that drives the Phase 3 graduation decision (Q4). The eval report must surface a single number per backend per vocabulary: "concept_match_rate" — the fraction of gold-standard spans where the backend produced the correct concept_id. If Llettuce beats SciSpaCy by ≥ +5 percentage points on SNOMED concept-mapping, Phase 3 graduates Llettuce; else Phase 3 sticks with the LLM as the only concept-mapping path.

- [ ] **Step 1: Add the explicit headline assertion to the report**

The Jinja2 template must include a "Phase 3 graduation criterion" callout block:

```markdown
## Phase 3 graduation criterion

**Llettuce graduates to a production backend if** SNOMED concept_match_rate
exceeds SciSpaCy's by ≥ +5 percentage points on this 100-note benchmark.

Current run:
- LlmBackend SNOMED concept_match_rate: {{ metrics.llm.snomed_match_rate * 100 }}%
- SciSpacyBackend SNOMED concept_match_rate: {{ metrics.scispacy.snomed_match_rate * 100 }}%
- LlettuceBackend SNOMED concept_match_rate: {{ metrics.llettuce.snomed_match_rate * 100 }}%

**Verdict:** {% if (metrics.llettuce.snomed_match_rate - metrics.scispacy.snomed_match_rate) >= 0.05 %}GRADUATE — Llettuce beats SciSpaCy by ≥ 5 pp{% else %}HOLD — Llettuce does not clear the +5 pp threshold{% endif %}
```

- [ ] **Step 2-5:** Implement, run, gates. **Commit:** `feat(templates): NER eval report includes Phase 3 graduation verdict`.

---

## Task 10: ADR 0013 — Llettuce evaluation findings + Phase 3 graduation criterion

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0013-llettuce-eval-and-graduation.md`

ADR 0013 covers:
- **Context:** Phase 2 §1 + Q4 (Llettuce eval-only in Phase 2). The +5 pp SNOMED graduation threshold is the load-bearing criterion.
- **Decision:** Ship `LlettuceBackend` as eval-only; gate production graduation to Phase 3 based on the headline SNOMED concept-mapping metric measured by `tests/eval/test_ner_backend_comparison.py`. The ADR records the threshold, the benchmark used (100-note FHIR DocumentReference fixture, ~400 mappings), and the metric definition (concept_match_rate = correct concept_id / matched spans).
- **Consequences:** Phase 2 ends with a measured comparison and a defensible Phase 3 plan. The eval harness becomes a recurring CI artifact — useful for any future LLM-prompt change or vocabulary update to detect regressions.
- **Open follow-ups:** If Llettuce graduates in Phase 3, add a `parthenon_ner_llettuce` template manifest mirroring `parthenon_ner_scispacy`'s shape; if it doesn't, document why and consider a different approach (e.g., SciSpaCy + UMLS linker plug-in).

- [ ] **Step 1-2:** Draft + run gates. **Commit:** `docs(adr): ADR 0013 — Llettuce evaluation findings + Phase 3 graduation criterion`.

---

## Done

After Task 10 lands, Plan 3 is complete. The NER eval harness compares all three backends on the held-out gold standard and produces a markdown report with a Phase 3 graduation verdict. No production manifest is shipped (per Q4); the harness is the deliverable. Phase 3 picks up the verdict and either graduates Llettuce or revises the strategy.
