"""Phase 3 Plan 6 Task 14 (T-024A): three-place node-type registration."""

from __future__ import annotations

import pytest

from runtime.commercial.mapping.review_queue_node import MappingReviewQueueNode
from runtime.commercial.mapping.suggester_node import ConceptMappingSuggesterNode
from runtime.commercial.orchestration.node_registry import (
    COMMERCIAL_NODE_REGISTRY,
    get_commercial_node_class,
)
from runtime.orchestration.node_registry import NODE_REGISTRY as COMMUNITY_NODE_REGISTRY
from runtime.registry.manifest import NODE_TYPES


@pytest.mark.parametrize("type_name", ["concept_mapping_suggester", "mapping_review_queue"])
def test_node_type_in_pyproject_node_types_tuple(type_name: str) -> None:
    """Place 1: NODE_TYPES tuple in runtime.registry.manifest."""
    assert type_name in NODE_TYPES


@pytest.mark.parametrize("type_name", ["concept_mapping_suggester", "mapping_review_queue"])
def test_node_type_in_schema_enum(type_name: str) -> None:
    """Place 2: JSON schema enum in template.v1.json."""
    import json
    from pathlib import Path

    schema_path = (
        Path(__file__).resolve().parents[4] / "runtime" / "registry" / "schema" / "template.v1.json"
    )
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    nodes = schema["properties"]["spec"]["properties"]["nodes"]
    enum = nodes["items"]["properties"]["type"]["enum"]
    assert type_name in enum


def test_commercial_registry_has_concept_mapping_suggester() -> None:
    """Place 3: COMMERCIAL_NODE_REGISTRY in runtime.commercial.orchestration."""
    assert "concept_mapping_suggester" in COMMERCIAL_NODE_REGISTRY
    assert COMMERCIAL_NODE_REGISTRY["concept_mapping_suggester"] is ConceptMappingSuggesterNode


def test_commercial_registry_has_mapping_review_queue() -> None:
    assert "mapping_review_queue" in COMMERCIAL_NODE_REGISTRY
    assert COMMERCIAL_NODE_REGISTRY["mapping_review_queue"] is MappingReviewQueueNode


def test_commercial_node_types_NOT_in_community_registry() -> None:
    """The wedge: community wheel must not be able to instantiate these nodes."""
    assert "concept_mapping_suggester" not in COMMUNITY_NODE_REGISTRY
    assert "mapping_review_queue" not in COMMUNITY_NODE_REGISTRY


def test_get_commercial_node_class_returns_class() -> None:
    cls = get_commercial_node_class("concept_mapping_suggester")
    assert cls is ConceptMappingSuggesterNode


def test_get_commercial_node_class_unknown_raises() -> None:
    with pytest.raises(KeyError, match="unknown commercial node"):
        get_commercial_node_class("does_not_exist")
