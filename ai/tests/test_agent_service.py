from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

from app.agents.service import ParthenonAgentService, AgentSessionState
from app.agents.tool_base import AgentToolContext


@dataclass
class _FakeTextBlock:
    text: str


@dataclass
class _FakeAssistantMessage:
    content: list


@dataclass
class _FakeResultMessage:
    total_cost_usd: float
    session_id: str
    usage: dict


class _FakeClient:
    def __init__(self, *args, **kwargs):
        self.options = kwargs.get("options")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def query(self, prompt):
        self._prompt = prompt

    async def receive_response(self):
        yield _FakeAssistantMessage(content=[_FakeTextBlock(text="Here are the concepts.")])
        yield _FakeResultMessage(total_cost_usd=0.12, session_id="sess-abc", usage={"input_tokens": 100, "output_tokens": 40})


def _state() -> AgentSessionState:
    ctx = AgentToolContext(
        auth_token="tok",
        context={"study_slug": "t2dm", "design_session_id": 7, "version_id": 3},
    )
    return AgentSessionState(
        agent_session_id=11,
        profile_name="study_design",
        subject_id=7,
        channel="private-study-design.session.7",
        ingest_path="/api/v1/studies/t2dm/design-sessions/7/agent/sessions/11/ingest",
        tool_context=ctx,
        anthropic_session_id=None,
    )


async def test_run_turn_publishes_text_and_done(monkeypatch):
    publisher = MagicMock()
    import app.agents.service as svc
    monkeypatch.setattr(svc, "ClaudeSDKClient", _FakeClient)
    monkeypatch.setattr(svc, "AssistantMessage", _FakeAssistantMessage)
    monkeypatch.setattr(svc, "TextBlock", _FakeTextBlock)
    monkeypatch.setattr(svc, "ResultMessage", _FakeResultMessage)

    service = ParthenonAgentService(publisher=publisher)
    state = _state()
    await service.run_turn(state, "find diabetes concept sets")

    events = [c.kwargs["event"] for c in publisher.publish.call_args_list]
    assert "agent.text.delta" in events
    assert "agent.turn.done" in events
    assert state.anthropic_session_id == "sess-abc"
    done = next(c for c in publisher.publish.call_args_list if c.kwargs["event"] == "agent.turn.done")
    assert done.kwargs["data"]["cost_usd"] == 0.12
    # Verify publish was called with the channel keyword argument
    for call in publisher.publish.call_args_list:
        assert call.kwargs["channel"] == "private-study-design.session.7"


async def test_run_turn_calls_persister_on_done(monkeypatch):
    publisher = MagicMock()
    persister = AsyncMock()
    import app.agents.service as svc
    monkeypatch.setattr(svc, "ClaudeSDKClient", _FakeClient)
    monkeypatch.setattr(svc, "AssistantMessage", _FakeAssistantMessage)
    monkeypatch.setattr(svc, "TextBlock", _FakeTextBlock)
    monkeypatch.setattr(svc, "ResultMessage", _FakeResultMessage)

    service = ParthenonAgentService(publisher=publisher, persister=persister)
    state = _state()
    await service.run_turn(state, "find diabetes concept sets")

    persister.persist.assert_awaited_once()
    call_kwargs = persister.persist.call_args.kwargs
    assert call_kwargs["status"] == "active"
    assert call_kwargs["cost_usd"] == 0.12


async def test_persister_uses_ingest_path(monkeypatch):
    """LaravelPersister must POST to the ingest_path Laravel supplied, not a hard-coded URL."""
    import httpx
    import respx

    state = _state()
    expected_url = f"http://nginx:80{state.ingest_path}"

    with respx.mock:
        route = respx.post(expected_url).mock(return_value=httpx.Response(200, json={}))
        from app.agents.service import LaravelPersister
        persister = LaravelPersister()
        await persister.persist(state, status="active", cost_usd=0.05, tokens_in=10, tokens_out=5)

    assert route.called


def _publish_state() -> AgentSessionState:
    ctx = AgentToolContext(
        auth_token="tok",
        context={"draft_id": 5, "study_id": 9},
    )
    return AgentSessionState(
        agent_session_id=99,
        profile_name="publish",
        subject_id=5,
        channel="private-publish.draft.5",
        ingest_path="/api/v1/publish/drafts/5/agent/sessions/99/ingest",
        tool_context=ctx,
        anthropic_session_id=None,
    )


async def test_run_turn_calls_persister_with_error_status_on_exception(monkeypatch):
    publisher = MagicMock()
    persister = AsyncMock()
    import app.agents.service as svc

    class _BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def query(self, prompt):
            raise RuntimeError("sdk exploded")

        async def receive_response(self):
            return
            yield  # make it a generator

    monkeypatch.setattr(svc, "ClaudeSDKClient", _BoomClient)
    monkeypatch.setattr(svc, "AssistantMessage", _FakeAssistantMessage)
    monkeypatch.setattr(svc, "TextBlock", _FakeTextBlock)
    monkeypatch.setattr(svc, "ResultMessage", _FakeResultMessage)

    service = ParthenonAgentService(publisher=publisher, persister=persister)
    state = _state()
    await service.run_turn(state, "trigger error")

    persister.persist.assert_awaited_once()
    call_kwargs = persister.persist.call_args.kwargs
    assert call_kwargs["status"] == "error"
    assert call_kwargs["cost_usd"] == 0.0


# ---------------------------------------------------------------------------
# Approval-gate tests (Phase C/2)
# ---------------------------------------------------------------------------

import asyncio
import types as _types


def _make_fake_ctx(tool_use_id: str = "t1"):
    """Minimal ToolPermissionContext stub with just tool_use_id."""
    return _types.SimpleNamespace(tool_use_id=tool_use_id)


async def test_can_use_tool_read_returns_allow():
    """For a read tool, can_use_tool should return PermissionResultAllow immediately."""
    from claude_agent_sdk import PermissionResultAllow
    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _publish_state()

    fn = service._make_can_use_tool(state)
    result = await fn("get_draft", {}, _make_fake_ctx("t-read"))

    assert isinstance(result, PermissionResultAllow)
    # No approval.request event should have been published for a read tool
    for call in publisher.publish.call_args_list:
        assert call.kwargs.get("event") != "agent.approval.request"


async def test_can_use_tool_unknown_tool_returns_deny():
    """For a tool not in the pack, can_use_tool should return PermissionResultDeny (fail closed)."""
    from claude_agent_sdk import PermissionResultDeny
    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _publish_state()

    fn = service._make_can_use_tool(state)
    result = await fn("some_unknown_tool", {}, _make_fake_ctx("t-unk"))

    assert isinstance(result, PermissionResultDeny)


async def test_can_use_tool_write_approved_returns_allow():
    """For a write tool that the user approves, can_use_tool returns PermissionResultAllow."""
    from claude_agent_sdk import PermissionResultAllow
    from app.agents import registry as reg

    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _publish_state()
    # Register the state so resolve_approval can find it via registry._sessions
    reg.put(state)

    try:
        fn = service._make_can_use_tool(state)

        # Start the coroutine as a task so it can block on the future
        task = asyncio.ensure_future(fn("update_draft", {"title": "New"}, _make_fake_ctx("t-write-approve")))

        # Let the task run until it publishes the approval.request event and blocks
        await asyncio.sleep(0)

        # Find the tool_use_id that was published
        approval_calls = [
            c for c in publisher.publish.call_args_list
            if c.kwargs.get("event") == "agent.approval.request"
        ]
        assert len(approval_calls) == 1
        published_tool_use_id = approval_calls[0].kwargs["data"]["tool_use_id"]
        assert approval_calls[0].kwargs["data"]["tool"] == "update_draft"

        # Resolve the approval (simulates the frontend clicking "Accept")
        resolved = service.resolve_approval(published_tool_use_id, True)
        assert resolved is True

        result = await task
        assert isinstance(result, PermissionResultAllow)

        # No denial event should have been published
        denial_calls = [
            c for c in publisher.publish.call_args_list
            if c.kwargs.get("event") == "agent.approval.denied"
        ]
        assert len(denial_calls) == 0
    finally:
        reg.drop(state.agent_session_id)


async def test_can_use_tool_write_rejected_returns_deny():
    """For a write tool that the user rejects, can_use_tool returns PermissionResultDeny
    and publishes an agent.approval.denied event."""
    from claude_agent_sdk import PermissionResultDeny
    from app.agents import registry as reg

    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _publish_state()
    # Register the state so resolve_approval can find it via registry._sessions
    reg.put(state)

    try:
        fn = service._make_can_use_tool(state)

        task = asyncio.ensure_future(fn("create_snapshot", {"label": "v1"}, _make_fake_ctx("t-write-reject")))

        # Let the task publish the approval.request and block
        await asyncio.sleep(0)

        approval_calls = [
            c for c in publisher.publish.call_args_list
            if c.kwargs.get("event") == "agent.approval.request"
        ]
        assert len(approval_calls) == 1
        published_tool_use_id = approval_calls[0].kwargs["data"]["tool_use_id"]

        # Reject the approval
        resolved = service.resolve_approval(published_tool_use_id, False)
        assert resolved is True

        result = await task
        assert isinstance(result, PermissionResultDeny)

        # A denial event must have been published
        denial_calls = [
            c for c in publisher.publish.call_args_list
            if c.kwargs.get("event") == "agent.approval.denied"
        ]
        assert len(denial_calls) == 1
        assert denial_calls[0].kwargs["data"]["tool"] == "create_snapshot"
        assert denial_calls[0].kwargs["channel"] == "private-publish.draft.5"
    finally:
        reg.drop(state.agent_session_id)


async def test_options_publish_excludes_write_tools_from_allowed():
    """_options for 'publish' must exclude write tools from allowed_tools
    and use permission_mode='default'."""
    from app.agents.tool_packs import write_tools as wt
    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _publish_state()

    opts = service._options(state)

    writes = wt("publish")
    allowed = set(opts.allowed_tools or [])
    # No write tool name should appear in allowed_tools
    for write_name in writes:
        assert f"mcp__parthenon__{write_name}" not in allowed, (
            f"Write tool '{write_name}' must not be in allowed_tools"
        )
    # Read tools must still be allowed
    assert "mcp__parthenon__get_draft" in allowed
    assert "mcp__parthenon__list_studies_for_publish" in allowed
    # permission_mode must be "default" so can_use_tool fires
    assert opts.permission_mode == "default"
    # can_use_tool callback must be set
    assert opts.can_use_tool is not None


async def test_options_study_design_all_tools_allowed_dontask():
    """_options for 'study_design' must keep all tools in allowed_tools
    and use permission_mode='dontAsk' (unchanged Phase-1 behavior)."""
    publisher = MagicMock()
    service = ParthenonAgentService(publisher=publisher)
    state = _state()  # study_design state

    opts = service._options(state)

    allowed = set(opts.allowed_tools or [])
    # All four study_design tools must be in allowed_tools
    for name in ("search_concepts", "get_guidance", "recommend_phenotypes", "draft_concept_sets"):
        assert f"mcp__parthenon__{name}" in allowed, (
            f"study_design tool '{name}' must be in allowed_tools"
        )
    assert opts.permission_mode == "dontAsk"
    # can_use_tool must NOT be set for a profile with no write tools
    assert not hasattr(opts, "can_use_tool") or opts.can_use_tool is None


async def test_resolve_approval_returns_false_for_unknown_tool_use_id():
    """resolve_approval should return False when no pending future matches."""
    service = ParthenonAgentService(publisher=MagicMock())
    result = service.resolve_approval("nonexistent-tool-use-id", True)
    assert result is False
