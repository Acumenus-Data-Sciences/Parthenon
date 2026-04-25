"""Tests for installer.health module."""
from __future__ import annotations

from unittest.mock import patch
from urllib.error import URLError

from installer import health


def test_probe_returns_ready_when_endpoint_returns_200():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (200, "")
        result = health.probe("http://localhost:8082", attempt=1)
    assert result == {"ready": True, "attempt": 1, "last_status": 200}


def test_probe_returns_not_ready_when_endpoint_returns_502():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (502, "")
        result = health.probe("http://localhost:8082", attempt=3)
    assert result == {"ready": False, "attempt": 3, "last_status": 502}


def test_probe_returns_not_ready_on_connection_refused():
    with patch("installer.health._http_get") as mock_get:
        mock_get.side_effect = URLError("Connection refused")
        result = health.probe("http://localhost:8082", attempt=2)
    assert result == {"ready": False, "attempt": 2, "last_status": 0}


def test_probe_strips_trailing_slash_from_url():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (200, "")
        result = health.probe("http://localhost:8082/", attempt=1)
    mock_get.assert_called_once_with("http://localhost:8082/api/v1/health")
    assert result == {"ready": True, "attempt": 1, "last_status": 200}


def test_http_get_translates_httperror_to_status_code():
    """Confirm the production code path returns the real HTTP status, not a connection-failure 0."""
    from io import BytesIO
    from urllib.error import HTTPError

    fake_error = HTTPError(
        url="http://localhost:8082/api/v1/health",
        code=502,
        msg="Bad Gateway",
        hdrs=None,  # type: ignore[arg-type]
        fp=BytesIO(b"upstream nginx returned 502"),
    )

    # Exercise _http_get directly — NOT the seam mock — to verify the real urlopen path.
    with patch("installer.health.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = fake_error
        status, body = health._http_get("http://localhost:8082/api/v1/health")

    assert status == 502
    assert "upstream nginx" in body
