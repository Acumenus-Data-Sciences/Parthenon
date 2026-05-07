"""Phase 3 Plan 6 Task 11 (T-024A): MappingReviewQueueNode."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.commercial.mapping.review_queue_node import (
    ApprovedMapping,
    MappingAlreadyExistsError,
    MappingReviewQueueNode,
    MappingValidationError,
)
from runtime.nodes.base import NodeContext, NodeStatus


class _ScriptedCursor:
    """Cursor that returns a programmable sequence of fetchone() rows."""

    def __init__(self, fetchone_responses: list[Any] | None = None) -> None:
        self._fetchone = list(fetchone_responses or [])
        self.executes: list[tuple[str, tuple[Any, ...]]] = []
        self._next_response: Any = None

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self.executes.append((query, params))
        if self._fetchone:
            self._next_response = self._fetchone.pop(0)
        else:
            self._next_response = None

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._next_response

    def __iter__(self) -> Any:
        return iter([])

    def __enter__(self) -> _ScriptedCursor:
        return self

    def __exit__(self, *args: Any) -> None:
        return None


class _FakeConn:
    def __init__(self, cursor: _ScriptedCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self) -> _ScriptedCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def close(self) -> None:
        self.closed = True


def _make_context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="test-run",
        node_id="rq-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn="postgresql://stub",
    )


def _approval(**overrides: Any) -> ApprovedMapping:
    base: dict[str, Any] = {
        "source_code": "FAC-GLU",
        "source_vocab": "L",
        "source_text": "Facility glucose",
        "omop_concept_id": 4193704,
        "confidence": 0.92,
        "reviewer_id": 1,
        "model_version": "bge-base@v0.1.0",
        "candidate_ranking": [{"concept_id": 4193704, "score": 0.95}],
    }
    base.update(overrides)
    return ApprovedMapping(**base)


# ---------- write_one (cursor-level) ----------


def test_write_one_happy_path() -> None:
    cursor = _ScriptedCursor(
        fetchone_responses=[
            ("S", None),  # _validate_concept_is_standard
            None,  # _existing_mapping (no row)
            (42,),  # INSERT ... RETURNING map_id
        ]
    )
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    map_id = node.write_one(cursor, _approval())
    assert map_id == 42


def test_write_one_rejects_non_standard_concept() -> None:
    cursor = _ScriptedCursor(fetchone_responses=[("C", None)])  # classification, not standard
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    with pytest.raises(MappingValidationError, match="not a standard concept"):
        node.write_one(cursor, _approval())


def test_write_one_rejects_invalid_concept() -> None:
    cursor = _ScriptedCursor(fetchone_responses=[("S", "deprecated")])
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    with pytest.raises(MappingValidationError, match="invalid"):
        node.write_one(cursor, _approval())


def test_write_one_rejects_missing_concept_id() -> None:
    cursor = _ScriptedCursor(fetchone_responses=[None])
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    with pytest.raises(MappingValidationError, match="does not exist"):
        node.write_one(cursor, _approval())


def test_write_one_rejects_reviewer_without_role() -> None:
    cursor = _ScriptedCursor(fetchone_responses=[("S", None)])
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: False)
    with pytest.raises(MappingValidationError, match="mapping-reviewer"):
        node.write_one(cursor, _approval(reviewer_id=99))


def test_write_one_allows_null_reviewer_id_for_auto_approve() -> None:
    """``reviewer_id=None`` represents auto-approval; skip the role check."""
    cursor = _ScriptedCursor(
        fetchone_responses=[
            ("S", None),
            None,
            (7,),
        ]
    )
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: False)
    map_id = node.write_one(cursor, _approval(reviewer_id=None))
    assert map_id == 7


def test_write_one_raises_already_exists() -> None:
    existing_row = (10, 4193704, 0.91, 1, "2026-05-06T10:00:00Z", "v0.1")
    cursor = _ScriptedCursor(
        fetchone_responses=[
            ("S", None),
            existing_row,
        ]
    )
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    with pytest.raises(MappingAlreadyExistsError) as excinfo:
        node.write_one(cursor, _approval())
    assert excinfo.value.source_code == "FAC-GLU"
    assert excinfo.value.existing["map_id"] == 10


def test_write_one_insert_carries_jsonb_ranking() -> None:
    cursor = _ScriptedCursor(fetchone_responses=[("S", None), None, (1,)])
    node = MappingReviewQueueNode(has_role_check=lambda uid, role: True)
    node.write_one(cursor, _approval())
    insert_query, insert_params = cursor.executes[-1]
    assert "INSERT INTO app.parthenon_concept_map" in insert_query
    assert "::jsonb" in insert_query
    # Last param is the JSON string-encoded ranking.
    assert "concept_id" in insert_params[-1]


# ---------- run() ----------


def test_run_persists_multiple_approvals(tmp_path: Path) -> None:
    cursor = _ScriptedCursor(
        fetchone_responses=[
            ("S", None),
            None,
            (1,),  # approval 1
            ("S", None),
            None,
            (2,),  # approval 2
        ]
    )
    conn = _FakeConn(cursor)
    node = MappingReviewQueueNode(
        connect=lambda _dsn: conn,
        has_role_check=lambda uid, role: True,
    )
    res = node.run(
        _make_context(tmp_path),
        {
            "approvals": [
                {
                    "source_code": "FAC-GLU",
                    "source_vocab": "L",
                    "source_text": "Glu",
                    "omop_concept_id": 4193704,
                    "confidence": 0.9,
                    "reviewer_id": 1,
                    "model_version": "v0.1",
                    "candidate_ranking": [],
                },
                {
                    "source_code": "FAC-K",
                    "source_vocab": "L",
                    "source_text": "K",
                    "omop_concept_id": 4193705,
                    "confidence": 0.8,
                    "reviewer_id": 1,
                    "model_version": "v0.1",
                    "candidate_ranking": [],
                },
            ]
        },
    )
    assert res.status is NodeStatus.SUCCESS
    assert res.outputs["approved_count"] == 2
    assert res.outputs["approved_map_ids"] == [1, 2]
    assert conn.committed
    assert conn.closed


def test_run_skips_already_existing_without_aborting(tmp_path: Path) -> None:
    cursor = _ScriptedCursor(
        fetchone_responses=[
            ("S", None),  # approval 1: validate
            (5, 4193704, 0.9, 1, "2026-05-06T10:00:00Z", "v0.1"),  # already exists
            ("S", None),
            None,
            (6,),  # approval 2: ok
        ]
    )
    conn = _FakeConn(cursor)
    node = MappingReviewQueueNode(
        connect=lambda _dsn: conn,
        has_role_check=lambda uid, role: True,
    )
    res = node.run(
        _make_context(tmp_path),
        {
            "approvals": [
                {
                    "source_code": "DUP",
                    "source_vocab": "L",
                    "source_text": "x",
                    "omop_concept_id": 4193704,
                    "confidence": 0.5,
                    "reviewer_id": 1,
                    "model_version": "v0.1",
                    "candidate_ranking": [],
                },
                {
                    "source_code": "NEW",
                    "source_vocab": "L",
                    "source_text": "y",
                    "omop_concept_id": 4193705,
                    "confidence": 0.5,
                    "reviewer_id": 1,
                    "model_version": "v0.1",
                    "candidate_ranking": [],
                },
            ]
        },
    )
    assert res.status is NodeStatus.SUCCESS
    assert res.outputs["approved_count"] == 1
    assert res.outputs["skipped_count"] == 1


def test_run_invalid_approvals_param_fails(tmp_path: Path) -> None:
    node = MappingReviewQueueNode(
        connect=lambda _dsn: _FakeConn(_ScriptedCursor()),
        has_role_check=lambda uid, role: True,
    )
    res = node.run(_make_context(tmp_path), {"approvals": "not a list"})
    assert res.status is NodeStatus.FAILED


def test_run_no_db_dsn_fails(tmp_path: Path) -> None:
    ctx = _make_context(tmp_path)
    ctx.db_dsn = None
    node = MappingReviewQueueNode(
        connect=lambda _dsn: _FakeConn(_ScriptedCursor()),
        has_role_check=lambda uid, role: True,
    )
    res = node.run(ctx, {"approvals": []})
    assert res.status is NodeStatus.FAILED


def test_node_type_name_is_mapping_review_queue() -> None:
    assert MappingReviewQueueNode.type_name == "mapping_review_queue"


def test_reviewer_role_constant_is_mapping_reviewer() -> None:
    """HIGHSEC §1.1 already lists this role; do not rename without coordination."""
    assert MappingReviewQueueNode.REVIEWER_ROLE == "mapping-reviewer"
