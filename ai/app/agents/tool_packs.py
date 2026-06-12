"""Profile → tool-pack builder registry.

Each agent profile registers a callable that, given an ``AgentToolContext``,
returns the list of MCP tools for that profile. Profiles are registered at
import time; the generic ``/agent`` router dispatches via ``build_tool_pack``.

``_WRITE_TOOLS`` declares which tools in each profile are gated writes (require
human approval before execution). Tools NOT listed are treated as reads and
placed in ``allowed_tools`` (auto-approved). Write tools are intentionally
excluded from ``allowed_tools`` so the Claude Agent SDK CLI routes them through
the ``can_use_tool`` callback, which blocks on a human-approval future.
"""

from __future__ import annotations

from collections.abc import Callable

from app.agents.tool_base import AgentToolContext
from app.agents import abby_tools, publish_tools, study_design_tools

_BUILDERS: dict[str, Callable[[AgentToolContext], list]] = {
    "study_design": study_design_tools.build_tool_pack,
    "publish": publish_tools.build_tool_pack,
    "abby": abby_tools.build_tool_pack,
}

# Per-profile set of tool names that require explicit human approval before
# execution (write tools). An empty set means all tools are auto-approved reads.
_WRITE_TOOLS: dict[str, set[str]] = {
    "study_design": set(),
    "publish": {"update_draft", "create_snapshot"},
    "abby": {"evaluate_gates", "reproject_results", "build_study_package", "open_in_publisher"},
}


def write_tools(profile: str) -> set[str]:
    """Return the set of write-tool names for ``profile`` (empty set if none)."""
    return set(_WRITE_TOOLS.get(profile, set()))


def register(profile: str, builder: Callable[[AgentToolContext], list]) -> None:
    """Register (or overwrite) a tool-pack builder for ``profile``."""
    _BUILDERS[profile] = builder


def build_tool_pack(profile: str, ctx: AgentToolContext) -> list:
    """Return the tool list for ``profile``.  Raises ``KeyError`` for unknown profiles."""
    return _BUILDERS[profile](ctx)
