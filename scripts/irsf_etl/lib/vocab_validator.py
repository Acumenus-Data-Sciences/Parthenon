"""Vocabulary validator for OMOP CDM concept validation.

Validates concept_ids and concept_codes against Parthenon's omop.concept table,
follows Maps-to chains for deprecated/non-standard concepts, supports batch
validation, and generates currency reports.

All SQL queries use parameterized queries (no string formatting with user values).
The module connects to PostgreSQL with search_path=omop for schema isolation.
"""

from __future__ import annotations

import enum
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

import psycopg2

if TYPE_CHECKING:
    from psycopg2.extensions import connection as PgConnection

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MAX_MAPS_TO_DEPTH = 5
_BATCH_CHUNK_SIZE = 1000

# ---------------------------------------------------------------------------
# SQL queries (all parameterized)
# ---------------------------------------------------------------------------

_SQL_CONCEPT_BY_ID = (
    "SELECT concept_id, concept_name, domain_id, vocabulary_id, "
    "standard_concept, invalid_reason "
    "FROM concept WHERE concept_id = %s"
)

_SQL_CONCEPT_BY_CODE = (
    "SELECT concept_id, concept_name, domain_id, vocabulary_id, "
    "standard_concept, invalid_reason "
    "FROM concept WHERE concept_code = %s AND vocabulary_id = %s"
)

_SQL_BATCH_BY_ID = (
    "SELECT concept_id, concept_name, vocabulary_id, "
    "standard_concept, invalid_reason "
    "FROM concept WHERE concept_id = ANY(%s)"
)

_SQL_BATCH_BY_CODE = (
    "SELECT concept_id, concept_name, concept_code, vocabulary_id, "
    "standard_concept, invalid_reason "
    "FROM concept WHERE concept_code = ANY(%s) AND vocabulary_id = %s"
)

_SQL_MAPS_TO = (
    "SELECT cr.concept_id_2, c.concept_name, c.standard_concept "
    "FROM concept_relationship cr "
    "JOIN concept c ON cr.concept_id_2 = c.concept_id "
    "WHERE cr.concept_id_1 = %s "
    "AND cr.relationship_id = 'Maps to' "
    "AND cr.invalid_reason IS NULL "
    "AND c.standard_concept = 'S'"
)


# ---------------------------------------------------------------------------
# Enums and dataclasses
# ---------------------------------------------------------------------------


class ConceptStatus(enum.Enum):
    """Status of a concept after validation against the vocabulary."""

    STANDARD = "standard"
    NON_STANDARD = "non_standard"
    DEPRECATED_REMAPPED = "deprecated_remapped"
    DEPRECATED_NO_REPLACEMENT = "deprecated_no_replacement"
    NOT_FOUND = "not_found"


@dataclass(frozen=True)
class ConceptValidationResult:
    """Immutable result of validating a single concept."""

    original_id: int
    resolved_id: int
    status: ConceptStatus
    concept_name: str
    vocabulary_id: str
    message: str


@dataclass(frozen=True)
class CurrencyReport:
    """Immutable summary of vocabulary currency across a set of concepts."""

    current_count: int
    remapped_count: int
    no_replacement_count: int
    non_standard_count: int
    unmapped_count: int
    total: int

    @property
    def coverage_rate(self) -> float:
        """Fraction of concepts that are current or successfully remapped."""
        if self.total == 0:
            return 0.0
        return (self.current_count + self.remapped_count) / self.total

    @property
    def remapped_rate(self) -> float:
        """Fraction of concepts that required remapping."""
        if self.total == 0:
            return 0.0
        return self.remapped_count / self.total


# ---------------------------------------------------------------------------
# VocabularyValidator
# ---------------------------------------------------------------------------


class VocabularyValidator:
    """Validates OMOP concept_ids and concept_codes against the vocabulary.

    Parameters
    ----------
    connection_params : dict
        Parameters passed directly to ``psycopg2.connect()``.
        Should include ``options='-c search_path=omop'`` for schema isolation.
    """

    def __init__(self, connection_params: dict) -> None:
        self._connection_params = connection_params
        self._conn: PgConnection | None = None

    # -- connection management --------------------------------------------------

    def _get_connection(self) -> PgConnection:
        """Return a (lazy-initialized) database connection."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(**self._connection_params)
        return self._conn

    def close(self) -> None:
        """Close the database connection if open."""
        if self._conn is not None and not self._conn.closed:
            self._conn.close()
            self._conn = None

    # -- single concept validation ---------------------------------------------

    def validate_concept_id(self, concept_id: int) -> ConceptValidationResult:
        """Validate a single concept_id against omop.concept.

        Returns the status (standard, non-standard, deprecated, not-found)
        and follows Maps-to chains for non-standard/deprecated concepts.
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(_SQL_CONCEPT_BY_ID, (concept_id,))
        row = cursor.fetchone()

        if row is None:
            return ConceptValidationResult(
                original_id=concept_id,
                resolved_id=0,
                status=ConceptStatus.NOT_FOUND,
                concept_name="",
                vocabulary_id="",
                message=f"Concept {concept_id} not found in vocabulary",
            )

        cid, cname, _domain, vocab_id, standard, invalid_reason = row
        return self._classify_concept(
            original_id=concept_id,
            concept_id=cid,
            concept_name=cname,
            vocabulary_id=vocab_id,
            standard_concept=standard,
            invalid_reason=invalid_reason,
            cursor=cursor,
        )

    def validate_concept_code(
        self, code: str, vocabulary_id: str
    ) -> ConceptValidationResult:
        """Validate a concept_code + vocabulary_id pair.

        Looks up the concept by code and vocabulary, then classifies it.
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(_SQL_CONCEPT_BY_CODE, (code, vocabulary_id))
        row = cursor.fetchone()

        if row is None:
            return ConceptValidationResult(
                original_id=0,
                resolved_id=0,
                status=ConceptStatus.NOT_FOUND,
                concept_name="",
                vocabulary_id=vocabulary_id,
                message=f"Concept code '{code}' not found in {vocabulary_id}",
            )

        cid, cname, _domain, vocab_id, standard, invalid_reason = row
        return self._classify_concept(
            original_id=cid,
            concept_id=cid,
            concept_name=cname,
            vocabulary_id=vocab_id,
            standard_concept=standard,
            invalid_reason=invalid_reason,
            cursor=cursor,
        )

    # -- batch validation -------------------------------------------------------

    def validate_batch(
        self, concept_ids: list[int]
    ) -> dict[int, ConceptValidationResult]:
        """Validate a list of concept_ids in bulk.

        Chunks large lists to avoid PostgreSQL limits.
        Non-standard/deprecated concepts have their Maps-to chains followed.
        """
        results: dict[int, ConceptValidationResult] = {}
        conn = self._get_connection()
        cursor = conn.cursor()

        for chunk in _chunk_list(concept_ids, _BATCH_CHUNK_SIZE):
            cursor.execute(_SQL_BATCH_BY_ID, (chunk,))
            rows = cursor.fetchall()

            found_ids: set[int] = set()
            for cid, cname, vocab_id, standard, invalid_reason in rows:
                found_ids.add(cid)
                results[cid] = self._classify_concept(
                    original_id=cid,
                    concept_id=cid,
                    concept_name=cname,
                    vocabulary_id=vocab_id,
                    standard_concept=standard,
                    invalid_reason=invalid_reason,
                    cursor=cursor,
                )

            # Mark missing concepts as NOT_FOUND
            for cid in chunk:
                if cid not in found_ids:
                    results[cid] = ConceptValidationResult(
                        original_id=cid,
                        resolved_id=0,
                        status=ConceptStatus.NOT_FOUND,
                        concept_name="",
                        vocabulary_id="",
                        message=f"Concept {cid} not found in vocabulary",
                    )

        return results

    def validate_batch_codes(
        self, codes: list[str], vocabulary_id: str
    ) -> dict[str, ConceptValidationResult]:
        """Validate a list of concept_codes for a given vocabulary_id in bulk.

        Returns a dict keyed by concept_code.
        """
        results: dict[str, ConceptValidationResult] = {}
        conn = self._get_connection()
        cursor = conn.cursor()

        for chunk in _chunk_list(codes, _BATCH_CHUNK_SIZE):
            cursor.execute(_SQL_BATCH_BY_CODE, (chunk, vocabulary_id))
            rows = cursor.fetchall()

            found_codes: set[str] = set()
            for cid, cname, ccode, vocab_id, standard, invalid_reason in rows:
                found_codes.add(ccode)
                results[ccode] = self._classify_concept(
                    original_id=cid,
                    concept_id=cid,
                    concept_name=cname,
                    vocabulary_id=vocab_id,
                    standard_concept=standard,
                    invalid_reason=invalid_reason,
                    cursor=cursor,
                )

            # Mark missing codes as NOT_FOUND
            for code in chunk:
                if code not in found_codes:
                    results[code] = ConceptValidationResult(
                        original_id=0,
                        resolved_id=0,
                        status=ConceptStatus.NOT_FOUND,
                        concept_name="",
                        vocabulary_id=vocabulary_id,
                        message=f"Concept code '{code}' not found in {vocabulary_id}",
                    )

        return results

    # -- currency report --------------------------------------------------------

    @staticmethod
    def generate_currency_report(
        results: dict[int | str, ConceptValidationResult],
    ) -> CurrencyReport:
        """Generate a currency report from validation results.

        Counts concepts in each status category.
        """
        current = 0
        remapped = 0
        no_replacement = 0
        non_standard = 0
        unmapped = 0

        for result in results.values():
            if result.status == ConceptStatus.STANDARD:
                current += 1
            elif result.status == ConceptStatus.DEPRECATED_REMAPPED:
                remapped += 1
            elif result.status == ConceptStatus.DEPRECATED_NO_REPLACEMENT:
                no_replacement += 1
            elif result.status == ConceptStatus.NON_STANDARD:
                non_standard += 1
            elif result.status == ConceptStatus.NOT_FOUND:
                unmapped += 1

        return CurrencyReport(
            current_count=current,
            remapped_count=remapped,
            no_replacement_count=no_replacement,
            non_standard_count=non_standard,
            unmapped_count=unmapped,
            total=len(results),
        )

    # -- internal helpers -------------------------------------------------------

    def _classify_concept(
        self,
        *,
        original_id: int,
        concept_id: int,
        concept_name: str,
        vocabulary_id: str,
        standard_concept: str | None,
        invalid_reason: str | None,
        cursor: object,
    ) -> ConceptValidationResult:
        """Classify a concept row into the appropriate status."""
        # Standard concept — accept as-is
        if standard_concept == "S":
            return ConceptValidationResult(
                original_id=original_id,
                resolved_id=concept_id,
                status=ConceptStatus.STANDARD,
                concept_name=concept_name,
                vocabulary_id=vocabulary_id,
                message="Standard concept",
            )

        # Non-standard or deprecated — try Maps-to chain
        maps_to = self._follow_maps_to(concept_id, cursor=cursor)

        if maps_to is not None:
            resolved_id, resolved_name = maps_to
            return ConceptValidationResult(
                original_id=original_id,
                resolved_id=resolved_id,
                status=ConceptStatus.DEPRECATED_REMAPPED,
                concept_name=resolved_name,
                vocabulary_id=vocabulary_id,
                message=(
                    f"Remapped from {concept_id} ({concept_name}) "
                    f"to {resolved_id} ({resolved_name})"
                ),
            )

        # Deprecated with no replacement
        if invalid_reason is not None:
            return ConceptValidationResult(
                original_id=original_id,
                resolved_id=0,
                status=ConceptStatus.DEPRECATED_NO_REPLACEMENT,
                concept_name=concept_name,
                vocabulary_id=vocabulary_id,
                message=f"Deprecated concept {concept_id} with no replacement mapping",
            )

        # Non-standard, no Maps-to (e.g., brand name, classification)
        return ConceptValidationResult(
            original_id=original_id,
            resolved_id=concept_id,
            status=ConceptStatus.NON_STANDARD,
            concept_name=concept_name,
            vocabulary_id=vocabulary_id,
            message=f"Non-standard concept {concept_id} with no standard mapping",
        )

    def _follow_maps_to(
        self,
        concept_id: int,
        *,
        cursor: object,
        max_depth: int = _MAX_MAPS_TO_DEPTH,
    ) -> tuple[int, str] | None:
        """Follow the Maps-to chain up to max_depth hops.

        Returns (resolved_concept_id, resolved_concept_name) or None if no
        standard mapping found.
        """
        current_id = concept_id
        visited: set[int] = {current_id}

        for _depth in range(max_depth):
            cursor.execute(_SQL_MAPS_TO, (current_id,))  # type: ignore[union-attr]
            row = cursor.fetchone()  # type: ignore[union-attr]

            if row is None:
                return None

            target_id, target_name, target_standard = row

            # Self-mapping — stop
            if target_id == current_id or target_id in visited:
                return None

            # Found a standard concept — done
            if target_standard == "S":
                return (target_id, target_name)

            # Non-standard hop — continue chain
            visited.add(target_id)
            current_id = target_id

        logger.warning(
            "Maps-to chain for concept %d exceeded %d hops", concept_id, max_depth
        )
        return None


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _chunk_list(items: list, chunk_size: int) -> list[list]:
    """Split a list into chunks of at most chunk_size."""
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]
