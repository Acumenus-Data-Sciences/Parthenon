"""Profile → tool-pack builder registry.

Each agent profile registers a callable that, given an ``AgentToolContext``,
returns the list of MCP tools for that profile. Profiles are registered at
import time; the generic ``/agent`` router dispatches via ``build_tool_pack``.
"""

from __future__ import annotations

from collections.abc import Callable

from app.agents.tool_base import AgentToolContext
from app.agents import publish_tools, study_design_tools

_BUILDERS: dict[str, Callable[[AgentToolContext], list]] = {
    "study_design": study_design_tools.build_tool_pack,
    "publish": publish_tools.build_tool_pack,
}


def register(profile: str, builder: Callable[[AgentToolContext], list]) -> None:
    """Register (or overwrite) a tool-pack builder for ``profile``."""
    _BUILDERS[profile] = builder


def build_tool_pack(profile: str, ctx: AgentToolContext) -> list:
    """Return the tool list for ``profile``.  Raises ``KeyError`` for unknown profiles."""
    return _BUILDERS[profile](ctx)
