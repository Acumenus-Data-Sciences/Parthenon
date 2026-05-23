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
