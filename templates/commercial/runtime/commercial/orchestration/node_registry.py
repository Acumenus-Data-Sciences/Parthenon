"""Commercial-tier NODE_REGISTRY overlay.

Phase 3 Plan 6 Task 14 (T-024A). Maps commercial-tier ``type_name``
strings to their Node classes. Mirrors the community
``runtime.orchestration.node_registry.NODE_REGISTRY`` shape but lives
in the proprietary wheel so the community wheel cannot resolve these
node types and the import-linter contract continues to ban
community -> commercial imports.

Plan 6 introduces:

- ``concept_mapping_suggester`` -> ``ConceptMappingSuggesterNode`` (Task 9)
- ``mapping_review_queue`` -> ``MappingReviewQueueNode`` (Task 11)

Customers running only the community wheel get a manifest validation
error if they reference these type names because the community
NODE_REGISTRY does not include them; the schema enum (Task 14)
accepts the names so commercial manifests parse, but the runtime
lookup fails closed.
"""

from __future__ import annotations

from runtime.commercial.mapping.review_queue_node import MappingReviewQueueNode
from runtime.commercial.mapping.suggester_node import ConceptMappingSuggesterNode
from runtime.nodes.base import Node

COMMERCIAL_NODE_REGISTRY: dict[str, type[Node]] = {
    ConceptMappingSuggesterNode.type_name: ConceptMappingSuggesterNode,
    MappingReviewQueueNode.type_name: MappingReviewQueueNode,
}


def get_commercial_node_class(type_name: str) -> type[Node]:
    if type_name not in COMMERCIAL_NODE_REGISTRY:
        raise KeyError(
            f"unknown commercial node type_name: {type_name!r}; "
            f"known: {sorted(COMMERCIAL_NODE_REGISTRY)}"
        )
    return COMMERCIAL_NODE_REGISTRY[type_name]


__all__ = ["COMMERCIAL_NODE_REGISTRY", "get_commercial_node_class"]
