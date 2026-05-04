"""Resolve FHIR (system, code) pairs to OMOP concept_id via the vocab.concept table.

Caches lookups in-process for the lifetime of the resolver instance. Misses
return 0 (OMOP "no matching concept") in non-strict mode, or raise
UnmappedConceptError in strict mode.

The mapping from FHIR system URIs to OMOP vocabulary_id values comes from the
pinned IG snapshot (templates/runtime/fhir_to_omop/ig/v0.1.0-parthenon.json).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from runtime.fhir_to_omop.errors import UnmappedConceptError

_IG_PATH = Path(__file__).resolve().parent / "ig" / "v0.1.0-parthenon.json"


@lru_cache(maxsize=1)
def _ig_snapshot() -> dict[str, Any]:
    return dict(json.loads(_IG_PATH.read_text(encoding="utf-8")))


class ConceptResolver:
    """OMOP concept_id resolver for FHIR (system, code) pairs."""

    def __init__(
        self,
        *,
        engine: Engine,
        vocab_schema: str,
        strict: bool = False,
    ) -> None:
        self.engine = engine
        self.vocab_schema = vocab_schema
        self.strict = strict
        self._cache: dict[tuple[str, str], int] = {}
        self._system_to_vocab: dict[str, str] = dict(_ig_snapshot().get("system_to_vocabulary", {}))

    def resolve(self, *, system: str, code: str) -> int:
        """Return the OMOP standard concept_id, 0 on miss (non-strict)."""
        key = (system, code)
        if key in self._cache:
            return self._cache[key]

        vocab = self._system_to_vocab.get(system)
        if vocab is None:
            if self.strict:
                raise UnmappedConceptError(f"system {system!r} not in pinned IG snapshot")
            self._cache[key] = 0
            return 0

        qual = "concept" if self.vocab_schema in {"main", ""} else f"{self.vocab_schema}.concept"
        with self.engine.connect() as conn:
            row = conn.execute(
                text(
                    f"SELECT concept_id FROM {qual} "
                    "WHERE vocabulary_id = :vocab AND concept_code = :code "
                    "  AND (standard_concept = 'S' OR standard_concept IS NULL) "
                    "LIMIT 1"
                ),
                {"vocab": vocab, "code": code},
            ).fetchone()

        if row is None:
            if self.strict:
                raise UnmappedConceptError(
                    f"no OMOP concept for ({system}, {code}) in vocabulary {vocab!r}"
                )
            self._cache[key] = 0
            return 0

        cid = int(row[0])
        self._cache[key] = cid
        return cid

    def vocabulary_for_system(self, system: str) -> str | None:
        """Return the OMOP vocabulary_id for a FHIR system URI, or None."""
        return self._system_to_vocab.get(system)

    def resolve_with_vocabulary(self, *, vocabulary_id: str, code: str) -> int:
        """Resolve a code against a known-good OMOP vocabulary_id.

        Used when the FHIR system URI is ambiguous — the OMB category
        OID (urn:oid:2.16.840.1.113883.6.238), for instance, is used
        for both Race and Ethnicity codings. Callers know which they
        intend; this method bypasses system_to_vocabulary and goes
        straight to the explicit vocabulary.
        """
        key = (f"vocab:{vocabulary_id}", code)
        if key in self._cache:
            return self._cache[key]

        qual = "concept" if self.vocab_schema in {"main", ""} else f"{self.vocab_schema}.concept"
        with self.engine.connect() as conn:
            row = conn.execute(
                text(
                    f"SELECT concept_id FROM {qual} "
                    "WHERE vocabulary_id = :vocab AND concept_code = :code "
                    "  AND (standard_concept = 'S' OR standard_concept IS NULL) "
                    "LIMIT 1"
                ),
                {"vocab": vocabulary_id, "code": code},
            ).fetchone()

        if row is None:
            if self.strict:
                raise UnmappedConceptError(f"no OMOP concept for ({vocabulary_id}, {code})")
            self._cache[key] = 0
            return 0

        cid = int(row[0])
        self._cache[key] = cid
        return cid
