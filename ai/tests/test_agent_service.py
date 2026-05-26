from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

from app.agents.service import ParthenonAgentService, AgentSessionState
from app.agents.study_design_tools import StudyDesignToolContext


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
    ctx = StudyDesignToolContext("t2dm", 7, 3, "tok")
    return AgentSessionState(agent_session_id=11, design_session_id=7, profile_name="study_design", tool_context=ctx, anthropic_session_id=None)


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
