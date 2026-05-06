"""Plan 3 Task 2: LlettuceBackend implements NlpBackend (mocked upstream)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backend import NlpBackend
from runtime.nlp.exceptions import LlettuceBackendError
from runtime.nlp.types import NerInferenceResult


def test_backend_satisfies_protocol() -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend

    backend: NlpBackend = LlettuceBackend()
    assert hasattr(backend, "infer")


@patch("runtime.nlp.backends.llettuce._lettuce_run")
def test_backend_calls_lettuce(mock_run: MagicMock) -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend

    mock_run.return_value = [
        {
            "start": 0,
            "end": 10,
            "text": "chest pain",
            "label": "condition",
            "concept_id": 4030518,
            "vocabulary_id": "SNOMED",
            "confidence": 0.88,
        },
    ]
    backend = LlettuceBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")
    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "lettuce-omop"
    assert len(result.spans) == 1
    assert len(result.mappings) == 1
    assert result.mappings[0].vocabulary_id == "SNOMED"
    assert result.mappings[0].concept_id == 4030518


@patch("runtime.nlp.backends.llettuce._lettuce_run")
def test_backend_wraps_internal_errors(mock_run: MagicMock) -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend

    mock_run.side_effect = RuntimeError("upstream boom")
    backend = LlettuceBackend()
    with pytest.raises(LlettuceBackendError):
        backend.infer("text", "v0.1.0")


@patch("runtime.nlp.backends.llettuce._lettuce_run")
def test_backend_emits_spans_without_concept_when_mapping_absent(
    mock_run: MagicMock,
) -> None:
    from runtime.nlp.backends.llettuce import LlettuceBackend

    mock_run.return_value = [
        {"start": 0, "end": 4, "text": "pain", "label": "condition"},
    ]
    backend = LlettuceBackend()
    r = backend.infer("pain", "v0.1.0")
    assert len(r.spans) == 1
    assert r.mappings == []
