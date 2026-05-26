"""ParthenonAgentService — runs one agent turn and streams events to Reverb.

Phase 1: read/draft tools only, auto-approved (no can_use_tool gate yet).
Session continuity via resume=anthropic_session_id (no idle in-memory clients).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, Optional, cast

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
from app.agents.tool_base import AgentToolContext
from app.agents.tool_packs import build_tool_pack
from app.config import settings

logger = logging.getLogger(__name__)

# ClaudeAgentOptions.effort is a Literal; settings/profiles carry it as a plain str.
EffortLevel = Literal["low", "medium", "high", "xhigh", "max"]


@dataclass
class AgentSessionState:
    agent_session_id: int
    profile_name: str
    subject_id: int          # Reverb routing key (was design_session_id)
    channel: str             # full "private-<domain>.<subject>.{id}" from Laravel
    ingest_path: str         # absolute "/api/v1/.../ingest" path Laravel supplied
    tool_context: AgentToolContext
    anthropic_session_id: Optional[str] = None
    last_idempotency_key: Optional[str] = None


class LaravelPersister:
    """Persists agent turn results back to Laravel (fail-open)."""

    async def persist(self, state: "AgentSessionState", *, status: str, cost_usd: float, tokens_in: int, tokens_out: int) -> None:
        url = f"{settings.agency_api_base_url.rstrip('/')}{state.ingest_path}"
        headers = {
            "Authorization": f"Bearer {state.tool_context.auth_token}",
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
        tools = build_tool_pack(state.profile_name, state.tool_context)
        server = create_sdk_mcp_server(name="parthenon", version="1.0.0", tools=tools)
        allowed = [f"mcp__parthenon__{t.name}" for t in tools]
        return ClaudeAgentOptions(
            system_prompt=profile.system_prompt,
            model=profile.model,
            effort=cast(EffortLevel, profile.effort),
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
        def emit(event: str, data: dict) -> None:
            self._publisher.publish(channel=state.channel, event=event, data=data)

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
                        tokens_in = int(usage.get("input_tokens", 0) or 0)
                        tokens_out = int(usage.get("output_tokens", 0) or 0)
                        # Laravel's agent_sessions row is the authoritative running total
                        # (ingest increments). We send PER-TURN deltas only; do not also
                        # accumulate in memory (would invite a double-count).
                        emit("agent.turn.done", {
                            "cost_usd": cost,
                            "tokens_in": tokens_in,
                            "tokens_out": tokens_out,
                            "anthropic_session_id": state.anthropic_session_id,
                        })
                        await self._persister.persist(
                            state,
                            status="active",
                            cost_usd=cost,
                            tokens_in=tokens_in,
                            tokens_out=tokens_out,
                        )
        except Exception as exc:  # noqa: BLE001
            logger.exception("agent turn failed")
            emit("agent.error", {"message": str(exc)[:500]})
            try:
                await self._persister.persist(state, status="error", cost_usd=0.0, tokens_in=0, tokens_out=0)
            except Exception:  # noqa: BLE001
                logger.warning("agent persistence failed during error handling")
