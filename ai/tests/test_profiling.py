"""Tests for the CSV profiling endpoint."""

import os
import tempfile

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _write_csv(content: str) -> str:
    """Write CSV content to a temporary file and return its path."""
    fd, path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, "w") as f:
        f.write(content)
    return path


# ------------------------------------------------------------------ #
#  Valid CSV returns column profiles
# ------------------------------------------------------------------ #


def test_profile_csv_returns_column_profiles() -> None:
    """POST /profiling/profile-csv with a valid CSV returns column profiles."""
    csv = "id,name,age\n1,Alice,30\n2,Bob,25\n3,Carol,35\n"
    path = _write_csv(csv)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "row_count" in data
        assert len(data["columns"]) == 3
        col_names = [c["column_name"] for c in data["columns"]]
        assert "id" in col_names
        assert "name" in col_names
        assert "age" in col_names
    finally:
        os.unlink(path)


# ------------------------------------------------------------------ #
#  row_count matches CSV data
# ------------------------------------------------------------------ #


def test_profile_csv_row_count_matches() -> None:
    """row_count should equal the number of data rows in the CSV."""
    csv = "x,y\n1,a\n2,b\n3,c\n4,d\n5,e\n"
    path = _write_csv(csv)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 200
        assert response.json()["row_count"] == 5
    finally:
        os.unlink(path)


# ------------------------------------------------------------------ #
#  Integer column type inference
# ------------------------------------------------------------------ #


def test_profile_csv_infers_integer_type() -> None:
    """Integer columns should be inferred as 'integer'."""
    csv = "count\n10\n20\n30\n40\n50\n"
    path = _write_csv(csv)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 200
        col = response.json()["columns"][0]
        assert col["inferred_type"] == "integer"
    finally:
        os.unlink(path)


# ------------------------------------------------------------------ #
#  Date column type inference
# ------------------------------------------------------------------ #


def test_profile_csv_infers_date_type() -> None:
    """Date columns should be inferred as 'date'."""
    csv = "event_date\n2023-01-01\n2023-02-15\n2023-03-20\n2023-04-10\n2023-05-05\n"
    path = _write_csv(csv)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 200
        col = response.json()["columns"][0]
        assert col["inferred_type"] == "date"
    finally:
        os.unlink(path)


# ------------------------------------------------------------------ #
#  PII detection in column names
# ------------------------------------------------------------------ #


def test_profile_csv_detects_pii_columns() -> None:
    """Columns named 'ssn', 'email', 'phone' should be flagged as PII."""
    csv = "ssn,email,phone,score\n123-45-6789,a@b.com,555-1234,99\n"
    path = _write_csv(csv)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 200
        columns = {c["column_name"]: c for c in response.json()["columns"]}

        assert columns["ssn"]["is_potential_pii"] is True
        assert columns["ssn"]["pii_type"] == "ssn"

        assert columns["email"]["is_potential_pii"] is True
        assert columns["email"]["pii_type"] == "email"

        assert columns["phone"]["is_potential_pii"] is True
        assert columns["phone"]["pii_type"] == "phone"

        # 'score' should NOT be PII
        assert columns["score"]["is_potential_pii"] is False
    finally:
        os.unlink(path)


# ------------------------------------------------------------------ #
#  404 for non-existent file
# ------------------------------------------------------------------ #


def test_profile_csv_returns_404_for_missing_file() -> None:
    """Should return 404 when the file does not exist."""
    response = client.post(
        "/profiling/profile-csv",
        json={"file_path": "/tmp/nonexistent_file_abc123.csv"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ------------------------------------------------------------------ #
#  500 for malformed CSV
# ------------------------------------------------------------------ #


def test_profile_csv_returns_500_for_malformed_csv() -> None:
    """Should return 500 when the CSV is malformed / unparseable."""
    # Write binary garbage that pandas cannot parse as CSV
    fd, path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, "wb") as f:
        f.write(b"\x00\x01\x02\xff\xfe" * 200)
    try:
        response = client.post(
            "/profiling/profile-csv", json={"file_path": path}
        )
        assert response.status_code == 500
    finally:
        os.unlink(path)
