"""ParthenonAgentService — runs one agent turn and streams events to Reverb.

Phase 1: read/draft tools only, auto-approved (no can_use_tool gate yet).
Session continuity via resume=anthropic_session_id (no idle in-memory clients).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
)

from app.agents.profiles import get_profile
from app.agents.reverb_publisher import ReverbPublisher
from app.agents.study_design_tools import StudyDesignToolContext, build_tool_pack
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AgentSessionState:
    agent_session_id: int
    design_session_id: int
    profile_name: str
    tool_context: StudyDesignToolContext
    anthropic_session_id: Optional[str] = None
    cost_usd: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    _busy: bool = field(default=False, repr=False)


class LaravelPersister:
    """Persists agent turn results back to Laravel (fail-open)."""

    async def persist(self, state: "AgentSessionState", *, status: str, cost_usd: float, tokens_in: int, tokens_out: int) -> None:
        ctx = state.tool_context
        url = (
            f"{settings.agency_api_base_url.rstrip('/')}/api/v1/"
            f"studies/{ctx.study_slug}/design-sessions/{ctx.design_session_id}"
            f"/agent/sessions/{state.agent_session_id}/ingest"
        )
        headers = {
            "Authorization": f"Bearer {ctx.auth_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        payload = {
            "anthropic_session_id": state.anthropic_session_id,
            "cost_usd": cost_usd,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "status": status,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:  # fail-open: persistence must not break the turn
            logger.warning("agent persistence failed: %s", exc)


class ParthenonAgentService:
    def __init__(self, publisher: Optional[ReverbPublisher] = None, persister: Optional["LaravelPersister"] = None) -> None:
        self._publisher = publisher or ReverbPublisher()
        self._persister = persister or LaravelPersister()

    def _options(self, state: AgentSessionState) -> ClaudeAgentOptions:
        profile = get_profile(state.profile_name)
        tools = build_tool_pack(state.tool_context)
        server = create_sdk_mcp_server(name="parthenon", version="1.0.0", tools=tools)
        allowed = [f"mcp__parthenon__{t.name}" for t in tools]
        return ClaudeAgentOptions(
            system_prompt=profile.system_prompt,
            model=profile.model,
            effort=profile.effort,
            mcp_servers={"parthenon": server},
            # HIGHSEC lockdown: tools=[] → CLI `--tools ""` removes ALL built-in
            # tools (Bash/Read/Edit/Write/Glob/Grep/WebSearch/WebFetch); only our
            # in-process MCP tools (via mcp_servers + allowed_tools) remain reachable.
            # allowed_tools alone only controls auto-approval, not availability.
            # dontAsk denies anything not pre-approved (headless server, no prompt).
            # strict_mcp_config blocks any stray project .mcp.json from adding servers.
            # setting_sources=[] keeps the dev .claude/ out of a clinical agent.
            tools=[],
            allowed_tools=allowed,
            setting_sources=[],
            strict_mcp_config=True,
            permission_mode="dontAsk",
            max_turns=settings.agent_max_turns,
            max_budget_usd=settings.agent_max_budget_usd,
            resume=state.anthropic_session_id,
        )

    async def run_turn(self, state: AgentSessionState, text: str) -> None:
        sid = state.design_session_id

        def emit(event: str, data: dict) -> None:
            self._publisher.publish(session_id=sid, event=event, data=data)

        emit("agent.turn.start", {"agent_session_id": state.agent_session_id})
        try:
            async with ClaudeSDKClient(options=self._options(state)) as client:
                await client.query(text)
                async for message in client.receive_response():
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                emit("agent.text.delta", {"text": block.text})
                            elif isinstance(block, ToolUseBlock):
                                emit("agent.tool.start", {"name": block.name, "input": block.input})
                    elif isinstance(message, ResultMessage):
                        state.anthropic_session_id = getattr(message, "session_id", state.anthropic_session_id)
                        cost = float(getattr(message, "total_cost_usd", 0.0) or 0.0)
                        usage = getattr(message, "usage", {}) or {}
                        state.cost_usd += cost
                        state.tokens_in += int(usage.get("input_tokens", 0) or 0)
                        state.tokens_out += int(usage.get("output_tokens", 0) or 0)
                        emit("agent.turn.done", {
                            "cost_usd": cost,
                            "tokens_in": usage.get("input_tokens", 0),
                            "tokens_out": usage.get("output_tokens", 0),
                            "anthropic_session_id": state.anthropic_session_id,
                        })
                        await self._persister.persist(
                            state,
                            status="active",
                            cost_usd=cost,
                            tokens_in=int(usage.get("input_tokens", 0) or 0),
                            tokens_out=int(usage.get("output_tokens", 0) or 0),
                        )
        except Exception as exc:  # noqa: BLE001
            logger.exception("agent turn failed")
            emit("agent.error", {"message": str(exc)[:500]})
            try:
                await self._persister.persist(state, status="error", cost_usd=0.0, tokens_in=0, tokens_out=0)
            except Exception:  # noqa: BLE001
                logger.warning("agent persistence failed during error handling")
