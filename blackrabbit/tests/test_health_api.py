from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "blackrabbit"
    assert data["version"] == "0.1.0"
    assert "python_version" in data
    assert data["dialects_total"] == 12


def test_dialects_returns_list():
    resp = client.get("/dialects")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 12
    names = {d["name"] for d in data}
    assert "postgresql" in names
    assert "sqlite" in names


def test_dialects_sqlite_is_installed():
    resp = client.get("/dialects")
    data = resp.json()
    sqlite = next(d for d in data if d["name"] == "sqlite")
    assert sqlite["installed"] is True
