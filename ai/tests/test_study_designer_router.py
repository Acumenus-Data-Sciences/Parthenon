from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_session_then_turn(monkeypatch):
    calls = {}

    async def fake_run_turn(self, state, text):
        calls["text"] = text
        calls["session"] = state.design_session_id

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    create = client.post("/study-designer/sessions", json={
        "profile": "study_design",
        "agent_session_id": 11,
        "study_slug": "t2dm",
        "design_session_id": 7,
        "version_id": 3,
        "scoped_token": "tok",
        "channel": "private-study-design.session.7",
    })
    assert create.status_code == 200
    assert create.json()["agent_session_id"] == 11

    turn = client.post("/study-designer/sessions/11/turn", json={"text": "hi", "idempotency_key": "k1"})
    assert turn.status_code == 202

    assert calls.get("session") == 7


def test_turn_on_unknown_session_404():
    resp = client.post("/study-designer/sessions/99999/turn", json={"text": "hi", "idempotency_key": "k2"})
    assert resp.status_code == 404


async def test_duplicate_idempotency_key_runs_once(monkeypatch):
    """Second call with the same idempotency key must be deduped — run_turn called exactly once."""
    from app.agents import registry as reg
    from app.routers.study_designer import _run
    import app.agents.service as svc

    call_count = 0

    async def fake_run_turn(self, state, text):
        nonlocal call_count
        call_count += 1

    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    # Register a fresh session
    from app.agents.service import AgentSessionState
    from app.agents.study_design_tools import StudyDesignToolContext
    ctx = StudyDesignToolContext("t2dm", 7, 3, "tok")
    state = AgentSessionState(agent_session_id=42, design_session_id=7, profile_name="study_design", tool_context=ctx)
    reg.put(state)

    try:
        await _run(42, "hello", "dupe-key")
        await _run(42, "hello", "dupe-key")
    finally:
        reg.drop(42)

    assert call_count == 1, f"expected run_turn called once, got {call_count}"
