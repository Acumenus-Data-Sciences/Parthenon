"""NoteNlpNode dispatch + run-shape contract (Task 10)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan
from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.note_nlp import NoteNlpNode, _resolve_backend


def _ctx(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="r1",
        node_id="n1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name_is_note_nlp() -> None:
    assert NoteNlpNode.type_name == "note_nlp"


def test_run_dispatches_to_backend(tmp_path: Path) -> None:
    backend = MagicMock()
    backend.infer.return_value = NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="condition")],
        mappings=[
            NerConceptMapping(
                span_index=0, concept_id=4030518, vocabulary_id="SNOMED", confidence=0.91
            )
        ],
        model_name="medgemma:7b",
        prompt_version="v0.1.0",
    )

    node = NoteNlpNode(backend=backend)
    result = node.run(
        _ctx(tmp_path), {"note_text": "Patient reports chest pain.", "prompt_version": "v0.1.0"}
    )

    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["spans"] == 1
    assert result.outputs["mappings"] == 1
    backend.infer.assert_called_once_with("Patient reports chest pain.", "v0.1.0")

    out_file = tmp_path / "note_nlp_inference.json"
    assert out_file.is_file()
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    assert payload["spans"][0]["label"] == "condition"
    assert payload["mappings"][0]["vocabulary_id"] == "SNOMED"


def test_run_fails_without_note_text(tmp_path: Path) -> None:
    backend = MagicMock()
    node = NoteNlpNode(backend=backend)
    result = node.run(_ctx(tmp_path), {})
    assert result.status == NodeStatus.FAILED
    assert "note_text" in (result.error_message or "")


def test_resolve_backend_default_is_llm() -> None:
    backend = _resolve_backend({})
    assert type(backend).__name__ == "LlmBackend"


def test_resolve_backend_rejects_unknown_name() -> None:
    with pytest.raises(ValueError):
        _resolve_backend({"backend": "not_a_real_backend"})


def test_resolve_backend_warns_on_llettuce(recwarn: pytest.WarningsRecorder) -> None:
    # Llettuce is registered for the eval harness but eval-only in Phase 2 (Q4).
    # Constructing one must raise a RuntimeWarning so a production manifest
    # author sees the signal.
    backend = _resolve_backend({"backend": "llettuce"})
    assert type(backend).__name__ == "LlettuceBackend"
    msgs = [str(w.message) for w in recwarn.list]
    assert any("eval-only" in m.lower() for m in msgs)
    assert any("phase 3" in m.lower() for m in msgs)
