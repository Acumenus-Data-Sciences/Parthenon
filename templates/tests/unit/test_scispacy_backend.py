"""SciSpacyBackend Python client (Plan 2 Tasks 3-4 + 10).

Covers:
- Backend satisfies NlpBackend Protocol
- Default sidecar URL routes through parthenon-scispacy
- HTTP errors wrap as SciSpacyBackendError
- NoteNlpNode dispatch registers "scispacy"
- HIGHSEC PHI guard: span text never contains full note (Task 10)
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backend import NlpBackend
from runtime.nlp.backends.scispacy import SciSpacyBackend
from runtime.nlp.exceptions import SciSpacyBackendError
from runtime.nlp.types import NerInferenceResult
from runtime.nodes.note_nlp import _resolve_backend


def test_backend_satisfies_protocol() -> None:
    backend: NlpBackend = SciSpacyBackend()
    assert hasattr(backend, "infer")


def test_backend_default_url_routes_to_parthenon_scispacy() -> None:
    backend = SciSpacyBackend()
    assert "parthenon-scispacy" in backend.sidecar_url


def test_backend_default_model_is_en_core_sci_md() -> None:
    backend = SciSpacyBackend()
    assert backend.model_name == "en_core_sci_md"


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_backend_sends_text_to_sidecar(mock_post: MagicMock) -> None:
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 0, "end": 10, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = SciSpacyBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")

    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "en_core_sci_md"
    assert result.prompt_version == "v0.1.0"
    assert len(result.spans) == 1
    mock_post.assert_called_once()


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_backend_raises_on_http_error(mock_post: MagicMock) -> None:
    import httpx

    mock_post.side_effect = httpx.HTTPError("boom")
    backend = SciSpacyBackend()
    with pytest.raises(SciSpacyBackendError):
        backend.infer("text", "v0.1.0")


def test_dispatch_registers_scispacy_backend() -> None:
    """NoteNlpNode dispatch maps backend='scispacy' to SciSpacyBackend (Task 4)."""
    backend = _resolve_backend({"backend": "scispacy"})
    assert type(backend).__name__ == "SciSpacyBackend"


# --- HIGHSEC PHI guard (Task 10) -------------------------------------------


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_span_text_never_contains_full_note(mock_post: MagicMock) -> None:
    """Per HIGHSEC §7: NER backends must NEVER copy the whole note text into a span.

    Regression guard for a bug where a backend naively copies note[0:end] into the
    span text — that would leak PHI (patient names, DOBs) into
    omop.note_nlp.observation_source_value.
    """
    note = "Patient John Doe DOB 1959-04-12 reports chest pain at 123 Main St."
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 38, "end": 48, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = SciSpacyBackend()
    result = backend.infer(note, "v0.1.0")
    for span in result.spans:
        assert "John Doe" not in span.text
        assert "DOB" not in span.text
        assert "123 Main St" not in span.text
