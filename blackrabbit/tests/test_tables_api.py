from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tables_sqlite_returns_table_list():
    resp = client.post("/tables", json={
        "dbms": "sqlite",
        "server": ":memory:",
        "port": 0,
        "user": "",
        "password": "",
        "schema": "main",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "tables" in data
    assert isinstance(data["tables"], list)


def test_tables_invalid_dialect_returns_400():
    resp = client.post("/tables", json={
        "dbms": "nosql",
        "server": "localhost/db",
        "port": 0,
        "schema": "public",
    })
    assert resp.status_code == 400
