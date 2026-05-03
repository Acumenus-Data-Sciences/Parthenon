"""Static lints over the Dockerfile and honcho.cfg per HIGHSEC §4.1."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture()
def dockerfile_text() -> str:
    repo = Path(__file__).resolve().parents[2]
    return (repo / "templates" / "Dockerfile").read_text(encoding="utf-8")


@pytest.fixture()
def honcho_cfg() -> str:
    repo = Path(__file__).resolve().parents[2]
    return (repo / "docker" / "templates" / "honcho.cfg").read_text(encoding="utf-8")


def test_dockerfile_runs_as_non_root(dockerfile_text: str) -> None:
    assert "addgroup --system templates" in dockerfile_text
    assert "adduser --system --ingroup templates templates" in dockerfile_text
    assert "USER templates" in dockerfile_text


def test_dockerfile_uses_tini(dockerfile_text: str) -> None:
    assert "tini" in dockerfile_text
    assert 'ENTRYPOINT ["/usr/bin/tini"' in dockerfile_text


def test_dockerfile_uses_python_312(dockerfile_text: str) -> None:
    assert "FROM python:3.12" in dockerfile_text


def test_honcho_supervises_web_and_prefect(honcho_cfg: str) -> None:
    assert "web:" in honcho_cfg
    assert "uvicorn" in honcho_cfg
    assert "prefect:" in honcho_cfg
    assert "prefect server start" in honcho_cfg


def test_dockerfile_invokes_honcho(dockerfile_text: str) -> None:
    assert "honcho" in dockerfile_text
    assert "honcho.cfg" in dockerfile_text
