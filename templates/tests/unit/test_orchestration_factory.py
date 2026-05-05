"""Backend factory honors PARTHENON_ORCHESTRATION_BACKEND."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.airflow_backend import AirflowBackend
from runtime.orchestration.dagster_backend import DagsterBackend
from runtime.orchestration.factory import build_backend
from runtime.orchestration.prefect_backend import PrefectBackend
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.orchestration.temporal_backend import TemporalBackend
from runtime.settings import get_settings


@pytest.fixture()
def storage(tmp_path: Path) -> LocalFilesystemStorage:
    return LocalFilesystemStorage(root=tmp_path)


def test_default_is_prefect(
    monkeypatch: pytest.MonkeyPatch, storage: LocalFilesystemStorage
) -> None:
    monkeypatch.delenv("PARTHENON_ORCHESTRATION_BACKEND", raising=False)
    get_settings.cache_clear()
    assert isinstance(build_backend(storage=storage), PrefectBackend)


@pytest.mark.parametrize(
    "value,expected",
    [
        ("prefect", PrefectBackend),
        ("temporal", TemporalBackend),
        ("dagster", DagsterBackend),
        ("airflow", AirflowBackend),
    ],
)
def test_backend_selected_by_env(
    monkeypatch: pytest.MonkeyPatch,
    storage: LocalFilesystemStorage,
    value: str,
    expected: type,
) -> None:
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", value)
    get_settings.cache_clear()
    backend = build_backend(storage=storage)
    assert isinstance(backend, expected)


def test_unknown_backend_raises(
    monkeypatch: pytest.MonkeyPatch, storage: LocalFilesystemStorage
) -> None:
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "weird")
    get_settings.cache_clear()
    with pytest.raises(ValueError, match="unknown orchestration backend"):
        build_backend(storage=storage)
