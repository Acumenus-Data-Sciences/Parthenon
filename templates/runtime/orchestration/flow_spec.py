"""Serializable node graph submitted to an OrchestrationBackend."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FlowNode:
    """One node in a FlowSpec graph."""

    node_id: str
    type_name: str
    params: dict[str, Any] = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "type_name": self.type_name,
            "params": dict(self.params),
            "depends_on": list(self.depends_on),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> FlowNode:
        return cls(
            node_id=str(payload["node_id"]),
            type_name=str(payload["type_name"]),
            params=dict(payload.get("params") or {}),
            depends_on=list(payload.get("depends_on") or []),
        )


@dataclass
class FlowSpec:
    """A directed acyclic graph of FlowNode plus run metadata."""

    flow_id: str
    nodes: list[FlowNode] = field(default_factory=list)
    parameters: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "flow_id": self.flow_id,
            "nodes": [n.to_dict() for n in self.nodes],
            "parameters": dict(self.parameters),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> FlowSpec:
        return cls(
            flow_id=str(payload["flow_id"]),
            nodes=[FlowNode.from_dict(n) for n in payload.get("nodes", [])],
            parameters=dict(payload.get("parameters") or {}),
        )

    def validate(self) -> None:
        ids = {n.node_id for n in self.nodes}
        if len(ids) != len(self.nodes):
            raise ValueError("FlowSpec node ids must be unique")
        for n in self.nodes:
            for dep in n.depends_on:
                if dep not in ids:
                    raise ValueError(f"unknown dependency {dep!r} on node {n.node_id!r}")
        # cycle detection via DFS
        visited: dict[str, int] = {n.node_id: 0 for n in self.nodes}
        adj: dict[str, list[str]] = {n.node_id: list(n.depends_on) for n in self.nodes}

        def dfs(node_id: str) -> None:
            state = visited[node_id]
            if state == 1:
                raise ValueError(f"cycle detected at node {node_id!r}")
            if state == 2:
                return
            visited[node_id] = 1
            for dep in adj[node_id]:
                dfs(dep)
            visited[node_id] = 2

        for node_id in list(visited):
            dfs(node_id)
