import time

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_scan_sqlite_returns_scan_id():
    resp = client.post("/scan", json={
        "dbms": "sqlite",
        "server": ":memory:",
        "port": 0,
        "user": "",
        "password": "",
        "schema": "main",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "scan_id" in data


def test_scan_result_not_found():
    resp = client.get("/scan/nonexistent/result")
    assert resp.status_code == 410


def test_scan_progress_not_found():
    resp = client.get("/scan/nonexistent")
    assert resp.status_code == 404
