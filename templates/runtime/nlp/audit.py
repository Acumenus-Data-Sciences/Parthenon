"""Audit writer for NOTE_NLP inference (decision Q5).

Writes one row per inference into ``app.note_nlp_audit`` with:
- token_offsets + concept_mappings (always)
- model_name + prompt_version (always)
- raw_input encrypted at rest, retained 30 days, then truncated to NULL
  by the daily prune command (``php artisan templates:prune-note-nlp-audit``)

Encryption is via Fernet (cryptography). The key must be a 32-byte secret
provided by the caller; Laravel's ``encrypted`` cast handles its own keys
when reading rows back.
"""

from __future__ import annotations

import base64
import datetime as dt
import json

from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from runtime.nlp.types import NerInferenceResult


def _fernet_from_key(raw_key: bytes) -> Fernet:
    """Wrap a 32-byte secret as a Fernet key.

    Fernet keys must be 32 url-safe base64 bytes; we accept the underlying
    32-byte secret and encode it for the caller's convenience.
    """
    if len(raw_key) != 32:
        raise ValueError(f"encryption_key must be exactly 32 bytes, got {len(raw_key)}")
    return Fernet(base64.urlsafe_b64encode(raw_key))


class NoteNlpAuditWriter:
    """Writes NER inference audit rows with encrypted raw_input + 30-day TTL."""

    _RETENTION_DAYS = 30

    def __init__(self, dsn: str, encryption_key: bytes, engine: Engine | None = None) -> None:
        self._engine = engine or create_engine(dsn)
        self._fernet = _fernet_from_key(encryption_key)

    def write(self, *, note_nlp_id: int, raw_input: str, result: NerInferenceResult) -> int:
        encrypted = self._fernet.encrypt(raw_input.encode("utf-8")).decode("ascii")
        ttl_at = dt.datetime.now(dt.UTC) + dt.timedelta(days=self._RETENTION_DAYS)
        with self._engine.begin() as conn:
            audit_id = conn.execute(
                text(
                    "INSERT INTO app.note_nlp_audit "
                    "(note_nlp_id, model_name, prompt_version, token_offsets, "
                    "concept_mappings, raw_input, ttl_at) "
                    "VALUES (:nid, :model, :ver, CAST(:spans AS JSONB), "
                    "CAST(:maps AS JSONB), :raw, :ttl) "
                    "RETURNING id"
                ),
                {
                    "nid": note_nlp_id,
                    "model": result.model_name,
                    "ver": result.prompt_version,
                    "spans": json.dumps([s.model_dump() for s in result.spans]),
                    "maps": json.dumps([m.model_dump() for m in result.mappings]),
                    "raw": encrypted,
                    "ttl": ttl_at,
                },
            ).scalar_one()
        return int(audit_id)
