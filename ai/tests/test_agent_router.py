"""Tests for the generic /agent router (replaces test_study_designer_router.py)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_CREATE_BODY = {
    "profile": "study_design",
    "agent_session_id": 11,
    "subject_id": 7,
    "channel": "private-study-design.session.7",
    "ingest_path": "/api/v1/studies/t2dm/design-sessions/7/agent/sessions/11/ingest",
    "scoped_token": "tok",
    "context": {"study_slug": "t2dm", "design_session_id": 7, "version_id": 3},
}


def test_create_session_registers_state_and_returns_channel(monkeypatch):
    calls = {}

    async def fake_run_turn(self, state, text):
        calls["text"] = text
        calls["subject_id"] = state.subject_id
        calls["channel"] = state.channel
        calls["ingest_path"] = state.ingest_path

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    create = client.post("/agent/sessions", json=_CREATE_BODY)
    assert create.status_code == 200
    body = create.json()
    assert body["agent_session_id"] == 11
    assert body["channel"] == "private-study-design.session.7"

    turn = client.post("/agent/sessions/11/turn", json={"text": "hi", "idempotency_key": "k1"})
    assert turn.status_code == 202

    assert calls.get("subject_id") == 7
    assert calls.get("channel") == "private-study-design.session.7"
    assert calls.get("ingest_path") == "/api/v1/studies/t2dm/design-sessions/7/agent/sessions/11/ingest"


def test_create_session_stores_context_on_tool_context(monkeypatch):
    from app.agents import registry as reg

    async def fake_run_turn(self, state, text):
        pass

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    create = client.post("/agent/sessions", json={**_CREATE_BODY, "agent_session_id": 200})
    assert create.status_code == 200

    state = reg.get(200)
    assert state is not None
    assert state.profile_name == "study_design"
    assert state.subject_id == 7
    assert state.channel == "private-study-design.session.7"
    assert state.tool_context.auth_token == "tok"
    assert state.tool_context.context["study_slug"] == "t2dm"
    reg.drop(200)


def test_turn_on_unknown_session_404():
    resp = client.post("/agent/sessions/99999/turn", json={"text": "hi", "idempotency_key": "k2"})
    assert resp.status_code == 404


def test_approve_unknown_session_404():
    """POST /sessions/{id}/approve returns 404 when the session does not exist."""
    resp = client.post(
        "/agent/sessions/88888/approve",
        json={"tool_use_id": "t-abc", "approved": True},
    )
    assert resp.status_code == 404


def test_approve_no_pending_future_404(monkeypatch):
    """POST /sessions/{id}/approve returns 404 when there is no pending future
    for the given tool_use_id (already resolved, timed-out, or fabricated)."""
    from app.agents import registry as reg
    from app.agents.service import AgentSessionState
    from app.agents.tool_base import AgentToolContext

    async def fake_run_turn(self, state, text):
        pass

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    ctx = AgentToolContext(auth_token="tok", context={"draft_id": 5})
    state = AgentSessionState(
        agent_session_id=77700,
        profile_name="publish",
        subject_id=5,
        channel="private-publish.draft.5",
        ingest_path="/api/v1/publish/drafts/5/agent/sessions/77700/ingest",
        tool_context=ctx,
    )
    reg.put(state)
    try:
        resp = client.post(
            "/agent/sessions/77700/approve",
            json={"tool_use_id": "no-such-future", "approved": True},
        )
        assert resp.status_code == 404
    finally:
        reg.drop(77700)


def test_approve_resolves_pending_future(monkeypatch):
    """POST /sessions/{id}/approve returns 200 and resolves a seeded pending future."""
    import asyncio
    from app.agents import registry as reg
    from app.agents.service import AgentSessionState
    from app.agents.tool_base import AgentToolContext
    from app.routers.agent import _get_service

    async def fake_run_turn(self, state, text):
        pass

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    ctx = AgentToolContext(auth_token="tok", context={"draft_id": 5})
    state = AgentSessionState(
        agent_session_id=77701,
        profile_name="publish",
        subject_id=5,
        channel="private-publish.draft.5",
        ingest_path="/api/v1/publish/drafts/5/agent/sessions/77701/ingest",
        tool_context=ctx,
    )
    reg.put(state)

    # Manually seed a pending future onto the state (simulates a blocked can_use_tool)
    loop = asyncio.new_event_loop()
    fut = loop.create_future()
    state._pending["test-tool-use-id"] = fut

    try:
        resp = client.post(
            "/agent/sessions/77701/approve",
            json={"tool_use_id": "test-tool-use-id", "approved": True},
        )
        assert resp.status_code == 200
        assert resp.json() == {"resolved": True}
        # The future must now be done and resolved to True
        assert fut.done()
        assert fut.result() is True
    finally:
        reg.drop(77701)
        loop.close()


async def test_duplicate_idempotency_key_runs_once(monkeypatch):
    """Second call with the same idempotency key must be deduped — run_turn called exactly once."""
    from app.agents import registry as reg
    from app.routers.agent import _run
    import app.agents.service as svc
    from app.agents.service import AgentSessionState
    from app.agents.tool_base import AgentToolContext

    call_count = 0

    async def fake_run_turn(self, state, text):
        nonlocal call_count
        call_count += 1

    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    ctx = AgentToolContext(
        auth_token="tok",
        context={"study_slug": "t2dm", "design_session_id": 7, "version_id": 3},
    )
    state = AgentSessionState(
        agent_session_id=42,
        profile_name="study_design",
        subject_id=7,
        channel="private-study-design.session.7",
        ingest_path="/api/v1/studies/t2dm/design-sessions/7/agent/sessions/42/ingest",
        tool_context=ctx,
    )
    reg.put(state)

    try:
        await _run(42, "hello", "dupe-key")
        await _run(42, "hello", "dupe-key")
    finally:
        reg.drop(42)

    assert call_count == 1, f"expected run_turn called once, got {call_count}"
