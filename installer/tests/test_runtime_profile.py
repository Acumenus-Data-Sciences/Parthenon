from __future__ import annotations

import importlib

from installer import utils


def test_release_runtime_profile_selects_community_compose(monkeypatch) -> None:
    monkeypatch.delenv("COMPOSE_FILE", raising=False)
    monkeypatch.delenv("PARTHENON_COMPOSE_FILE", raising=False)
    monkeypatch.setenv("PARTHENON_RUNTIME_PROFILE", "community-release")

    importlib.reload(utils)

    assert utils.release_runtime_enabled() is True
    assert utils.active_compose_file() == "docker-compose.community.yml"
    assert utils.os.environ["COMPOSE_FILE"] == "docker-compose.community.yml"


def test_source_runtime_uses_default_compose(monkeypatch) -> None:
    monkeypatch.delenv("COMPOSE_FILE", raising=False)
    monkeypatch.delenv("PARTHENON_COMPOSE_FILE", raising=False)
    monkeypatch.delenv("PARTHENON_RUNTIME_PROFILE", raising=False)

    importlib.reload(utils)

    assert utils.release_runtime_enabled() is False
    assert utils.active_compose_file() == "docker-compose.yml"
    assert "COMPOSE_FILE" not in utils.os.environ
