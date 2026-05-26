"""ParthenonAgentService — runs one agent turn and streams events to Reverb.

Phase C/2: write tools for the publish profile are approval-gated via
``can_use_tool``. Reads remain auto-approved (``allowed_tools``).
Session continuity via resume=anthropic_session_id (no idle in-memory clients).

NOTE: The ``can_use_tool`` callback + write-tool gating cannot be live-verified
at time of authorship (Anthropic account credit exhausted). The implementation
follows verified SDK facts (claude_agent_sdk 0.2.86):
  - ``can_use_tool`` fires only for tools NOT in ``allowed_tools``
  - ``permission_mode="default"`` is required (not "dontAsk") for the callback
    to be invoked for non-auto-approved tools
  - ``PermissionResultAllow()`` / ``PermissionResultDeny(message=...)`` are the
    return types
  - ``ctx.tool_use_id`` is a guaranteed non-empty str in a can_use_tool callback
Unit tests mock the full flow.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Literal, Optional, cast

import httpx

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
)

from app.agents.profiles import get_profile
from app.agents.reverb_publisher import ReverbPublisher
from app.agents.tool_base import AgentToolContext
from app.agents.tool_packs import build_tool_pack, write_tools
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
    # pending approval futures: keyed by tool_use_id, set by resolve_approval()
    _pending: dict = field(default_factory=dict, repr=False)


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

    def resolve_approval(self, tool_use_id: str, approved: bool) -> bool:
        """Resolve a pending approval future.

        Returns True if a pending future was found and resolved, False if no
        pending future exists for the given tool_use_id (already resolved,
        timed out, or unknown).
        """
        # Search across all session states for the pending future.
        # In practice each tool_use_id is unique, so the first match wins.
        from app.agents import registry
        for state in list(registry._sessions.values()):
            pending: dict = getattr(state, "_pending", {})
            fut: Optional[asyncio.Future] = pending.get(tool_use_id)
            if fut is not None and not fut.done():
                fut.set_result(approved)
                return True
        return False

    def _make_can_use_tool(
        self, state: "AgentSessionState"
    ) -> "Any":
        """Return an async can_use_tool callback for profiles that have write tools.

        The closure captures the profile's read/write name sets so that:
        - Read tools: defensively allowed (they are also in allowed_tools and
          normally never reach this callback, but fail-open if they somehow do).
        - Write tools: block on a human-approval Future; approve → Allow,
          reject or timeout → Deny. An approval.request event is published so
          the frontend can render an approval card.
        - Unknown tools: fail closed (Deny) — the agent must not call tools
          outside its declared pack.
        """
        tools = build_tool_pack(state.profile_name, state.tool_context)
        writes = write_tools(state.profile_name)
        read_names = {t.name for t in tools if t.name not in writes}
        write_names = {t.name for t in tools if t.name in writes}

        async def _can_use(tool_name: str, input: dict, ctx: Any) -> "PermissionResultAllow | PermissionResultDeny":
            # Strip MCP server prefix if present (CLI may send fully-qualified names)
            bare = tool_name.removeprefix("mcp__parthenon__")

            if bare in read_names:
                # Defensive: reads are auto-approved via allowed_tools and should
                # not normally reach here; allow anyway (fail-open for reads).
                return PermissionResultAllow()

            if bare not in write_names:
                # Unknown tool — fail closed.
                return PermissionResultDeny(message=f"Tool '{bare}' is not permitted for profile '{state.profile_name}'.")

            # Gated write: publish an approval request event and wait for the
            # frontend to call POST /agent/sessions/{id}/approve.
            tool_use_id: str = (
                getattr(ctx, "tool_use_id", None) or f"{state.agent_session_id}:{bare}"
            )

            loop = asyncio.get_event_loop()
            fut: asyncio.Future[bool] = loop.create_future()
            state._pending[tool_use_id] = fut

            self._publisher.publish(
                channel=state.channel,
                event="agent.approval.request",
                data={"tool_use_id": tool_use_id, "tool": bare, "input": input},
            )

            try:
                approved = await asyncio.wait_for(
                    asyncio.shield(fut),
                    timeout=float(settings.agent_approval_timeout_seconds),
                )
            except asyncio.TimeoutError:
                approved = False
            finally:
                state._pending.pop(tool_use_id, None)

            if approved:
                return PermissionResultAllow()

            self._publisher.publish(
                channel=state.channel,
                event="agent.approval.denied",
                data={"tool_use_id": tool_use_id, "tool": bare},
            )
            return PermissionResultDeny(message="The user did not approve this action.")

        return _can_use

    def _options(self, state: AgentSessionState) -> ClaudeAgentOptions:
        profile = get_profile(state.profile_name)
        tools = build_tool_pack(state.profile_name, state.tool_context)
        writes = write_tools(state.profile_name)
        server = create_sdk_mcp_server(name="parthenon", version="1.0.0", tools=tools)

        # Write tools are intentionally EXCLUDED from allowed_tools so that the
        # CLI routes them through the can_use_tool callback (which gates on human
        # approval). Read tools go into allowed_tools for auto-approval.
        # allowed_tools controls auto-approval; tools=[] removes all built-in
        # Claude Code tools (Bash/Read/Edit/Write/etc.) for HIGHSEC lockdown.
        # permission_mode is "default" when a profile has write tools (required
        # for can_use_tool to fire); "dontAsk" otherwise (headless auto-deny for
        # anything not pre-approved, unchanged Phase-1 behavior).
        # Unknown tools always fail closed in the can_use_tool callback.
        # strict_mcp_config blocks stray .mcp.json files from adding servers.
        # setting_sources=[] keeps the dev .claude/ config out of clinical agents.
        allowed = [f"mcp__parthenon__{t.name}" for t in tools if t.name not in writes]
        has_writes = bool(writes) and any(t.name in writes for t in tools)

        kwargs: dict = dict(
            system_prompt=profile.system_prompt,
            model=profile.model,
            effort=cast(EffortLevel, profile.effort),
            mcp_servers={"parthenon": server},
            tools=[],
            allowed_tools=allowed,
            setting_sources=[],
            strict_mcp_config=True,
            max_turns=settings.agent_max_turns,
            max_budget_usd=settings.agent_max_budget_usd,
            resume=state.anthropic_session_id,
        )

        if has_writes:
            kwargs["permission_mode"] = "default"
            kwargs["can_use_tool"] = self._make_can_use_tool(state)
        else:
            kwargs["permission_mode"] = "dontAsk"

        return ClaudeAgentOptions(**kwargs)

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
