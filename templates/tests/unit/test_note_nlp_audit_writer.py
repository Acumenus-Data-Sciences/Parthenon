"""NoteNlpAuditWriter — encrypted raw_input + 30-day TTL semantics.

The DB-touching path is covered by the broader E2E in Task 13; this unit
test just verifies encryption + key validation + payload construction
through a mock engine.
"""

from __future__ import annotations

import datetime as dt
from unittest.mock import MagicMock

import pytest

from runtime.nlp.audit import NoteNlpAuditWriter, _fernet_from_key
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def test_fernet_from_key_rejects_wrong_length() -> None:
    with pytest.raises(ValueError):
        _fernet_from_key(b"too_short")


def test_fernet_round_trip() -> None:
    fernet = _fernet_from_key(b"0" * 32)
    blob = fernet.encrypt(b"Patient reports chest pain.")
    assert fernet.decrypt(blob) == b"Patient reports chest pain."


def _result() -> NerInferenceResult:
    return NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="condition")],
        mappings=[
            NerConceptMapping(
                span_index=0, concept_id=4030518, vocabulary_id="SNOMED", confidence=0.9
            )
        ],
        model_name="medgemma:7b",
        prompt_version="v0.1.0",
    )


def test_write_encrypts_raw_input_and_sets_ttl() -> None:
    fake_engine = MagicMock()
    fake_conn = MagicMock()
    fake_engine.begin.return_value.__enter__.return_value = fake_conn
    fake_conn.execute.return_value.scalar_one.return_value = 42

    writer = NoteNlpAuditWriter(dsn="postgresql://x", encryption_key=b"0" * 32, engine=fake_engine)
    audit_id = writer.write(
        note_nlp_id=1, raw_input="Patient reports chest pain.", result=_result()
    )

    assert audit_id == 42

    # Inspect the parameters bound to the INSERT — raw is encrypted, ttl is +30 days.
    call_kwargs = fake_conn.execute.call_args[0][1]
    assert call_kwargs["raw"] != "Patient reports chest pain."  # encrypted
    assert call_kwargs["raw"]  # non-empty
    delta = call_kwargs["ttl"] - dt.datetime.now(dt.UTC)
    assert dt.timedelta(days=29) < delta < dt.timedelta(days=31)
