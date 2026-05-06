"""``MappingReviewQueueNode`` — write-side companion of the suggester node.

Phase 3 Plan 6 Task 11 (T-024A). Persists reviewer-approved (or
auto-approved) concept mappings to ``app.parthenon_concept_map``
(Task 10 schema).

Validation contract:

- ``omop_concept_id`` MUST exist in ``vocab.concept`` with
  ``standard_concept = 'S'`` AND ``invalid_reason IS NULL``. The DB FK
  catches non-existent IDs; the node-level check catches non-standard
  IDs before the INSERT.
- ``reviewer_id`` MUST have the ``mapping-reviewer`` role per HIGHSEC
  §1.1. RBAC enforcement is delegated to a callback (``has_role_check``)
  so the node does not import Laravel internals.
- Re-approval of an existing (source_code, source_vocab) tuple raises
  ``MappingAlreadyExistsError`` with the existing row's metadata so
  the reviewer UI can prompt for an explicit overwrite.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from runtime.commercial.mapping.types import RerankResult
from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

_LOGGER = logging.getLogger(__name__)

ConnectFactory = Callable[[str], Any]
HasRoleCheck = Callable[[int, str], bool]


@runtime_checkable
class _CursorProtocol(Protocol):
    def execute(self, query: str, params: tuple[Any, ...] = ...) -> Any: ...

    def fetchone(self) -> tuple[Any, ...] | None: ...

    def __iter__(self) -> Iterator[tuple[Any, ...]]: ...


class MappingValidationError(ValueError):
    """Validation failure that must be surfaced as a NodeStatus.FAILED result."""


class MappingAlreadyExistsError(ValueError):
    """Raised when (source_code, source_vocab) already has an approved mapping."""

    def __init__(self, source_code: str, source_vocab: str, existing: dict[str, Any]) -> None:
        super().__init__(f"mapping already exists for {source_code}/{source_vocab}")
        self.source_code = source_code
        self.source_vocab = source_vocab
        self.existing = existing


@dataclass(frozen=True)
class ApprovedMapping:
    """Input row for ``MappingReviewQueueNode.write_one``."""

    source_code: str
    source_vocab: str
    source_text: str
    omop_concept_id: int
    confidence: float
    reviewer_id: int | None
    model_version: str
    candidate_ranking: list[dict[str, Any]]


def _validate_concept_is_standard(cursor: _CursorProtocol, omop_concept_id: int) -> None:
    cursor.execute(
        "SELECT standard_concept, invalid_reason FROM vocab.concept WHERE concept_id = %s",
        (omop_concept_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise MappingValidationError(
            f"omop_concept_id {omop_concept_id} does not exist in vocab.concept"
        )
    standard_concept, invalid_reason = row
    if standard_concept != "S":
        raise MappingValidationError(
            f"omop_concept_id {omop_concept_id} is not a standard concept "
            f"(standard_concept={standard_concept!r})"
        )
    if invalid_reason is not None:
        raise MappingValidationError(
            f"omop_concept_id {omop_concept_id} is invalid (reason={invalid_reason!r})"
        )


def _existing_mapping(
    cursor: _CursorProtocol, source_code: str, source_vocab: str
) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT map_id, omop_concept_id, confidence, reviewer_id, reviewed_at, model_version
        FROM app.parthenon_concept_map
        WHERE source_code = %s AND source_vocab = %s
        """,
        (source_code, source_vocab),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return {
        "map_id": int(row[0]),
        "omop_concept_id": int(row[1]),
        "confidence": float(row[2]),
        "reviewer_id": int(row[3]) if row[3] is not None else None,
        "reviewed_at": str(row[4]),
        "model_version": str(row[5]),
    }


class MappingReviewQueueNode(Node):
    """Persist approved concept mappings to ``app.parthenon_concept_map``."""

    type_name = "mapping_review_queue"

    REVIEWER_ROLE = "mapping-reviewer"

    def __init__(
        self,
        connect: ConnectFactory | None = None,
        has_role_check: HasRoleCheck | None = None,
    ) -> None:
        super().__init__()
        self._connect = connect
        # Default no-op: reject every reviewer_id. Production wires a real
        # Spatie permission check via the Laravel API or a direct
        # role_has_permissions read.
        self._has_role = has_role_check or (lambda _user_id, _role: False)

    def write_one(
        self,
        cursor: _CursorProtocol,
        approval: ApprovedMapping,
    ) -> int:
        """Validate and INSERT a single approved mapping. Returns map_id.

        Pure-cursor variant suitable for batch use inside the node's run().
        """
        _validate_concept_is_standard(cursor, approval.omop_concept_id)

        if approval.reviewer_id is not None and not self._has_role(
            approval.reviewer_id, self.REVIEWER_ROLE
        ):
            raise MappingValidationError(
                f"reviewer_id {approval.reviewer_id} does not have role " f"{self.REVIEWER_ROLE!r}"
            )

        existing = _existing_mapping(cursor, approval.source_code, approval.source_vocab)
        if existing is not None:
            raise MappingAlreadyExistsError(approval.source_code, approval.source_vocab, existing)

        cursor.execute(
            """
            INSERT INTO app.parthenon_concept_map (
                source_code, source_vocab, source_text,
                omop_concept_id, confidence, reviewer_id,
                model_version, candidate_ranking_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING map_id
            """,
            (
                approval.source_code,
                approval.source_vocab,
                approval.source_text,
                approval.omop_concept_id,
                approval.confidence,
                approval.reviewer_id,
                approval.model_version,
                json.dumps(approval.candidate_ranking),
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise MappingValidationError("INSERT did not return a map_id")
        return int(row[0])

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        approvals_param = params.get("approvals")
        if not isinstance(approvals_param, list):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="MappingReviewQueueNode: 'approvals' param must be a list",
            )
        if context.db_dsn is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="MappingReviewQueueNode requires context.db_dsn",
            )

        connect = self._connect
        if connect is None:  # pragma: no cover — real PG path
            import psycopg

            connect = psycopg.connect

        approvals = [_coerce_approval(a) for a in approvals_param]
        written: list[int] = []
        skipped: list[dict[str, Any]] = []

        conn = connect(context.db_dsn)
        try:
            with conn.cursor() as cursor:
                for approval in approvals:
                    try:
                        written.append(self.write_one(cursor, approval))
                    except MappingAlreadyExistsError as exc:
                        skipped.append(
                            {
                                "source_code": exc.source_code,
                                "source_vocab": exc.source_vocab,
                                "existing": exc.existing,
                            }
                        )
                    except MappingValidationError as exc:
                        skipped.append(
                            {
                                "source_code": approval.source_code,
                                "source_vocab": approval.source_vocab,
                                "error": str(exc),
                            }
                        )
            conn.commit()
        finally:
            conn.close()

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "approved_count": len(written),
                "skipped_count": len(skipped),
                "approved_map_ids": written,
                "skipped": skipped,
            },
        )


def _coerce_approval(item: Any) -> ApprovedMapping:
    return ApprovedMapping(
        source_code=str(item["source_code"]),
        source_vocab=str(item["source_vocab"]),
        source_text=str(item.get("source_text", "")),
        omop_concept_id=int(item["omop_concept_id"]),
        confidence=float(item["confidence"]),
        reviewer_id=int(item["reviewer_id"]) if item.get("reviewer_id") is not None else None,
        model_version=str(item["model_version"]),
        candidate_ranking=list(item.get("candidate_ranking", [])),
    )


def _approval_from_rerank_result(
    result: RerankResult,
    *,
    omop_concept_id: int,
    reviewer_id: int | None,
    model_version: str,
) -> ApprovedMapping:
    """Helper to build an ApprovedMapping from a RerankResult + selected concept."""
    return ApprovedMapping(
        source_code=result.source_code,
        source_vocab=result.source_vocab,
        source_text=result.source_text,
        omop_concept_id=omop_concept_id,
        confidence=result.confidence,
        reviewer_id=reviewer_id,
        model_version=model_version,
        candidate_ranking=[c.model_dump() for c in result.candidates],
    )


__all__ = [
    "ApprovedMapping",
    "MappingAlreadyExistsError",
    "MappingReviewQueueNode",
    "MappingValidationError",
    "_approval_from_rerank_result",
]
