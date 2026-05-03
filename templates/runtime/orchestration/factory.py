"""Choose an OrchestrationBackend implementation from settings."""

from __future__ import annotations

from runtime.orchestration.airflow_backend import AirflowBackend
from runtime.orchestration.dagster_backend import DagsterBackend
from runtime.orchestration.interface import OrchestrationBackend
from runtime.orchestration.prefect_backend import PrefectBackend
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.orchestration.temporal_backend import TemporalBackend
from runtime.settings import get_settings

_BACKENDS: dict[str, type[OrchestrationBackend]] = {
    "prefect": PrefectBackend,
    "temporal": TemporalBackend,
    "dagster": DagsterBackend,
    "airflow": AirflowBackend,
}


def build_backend(*, storage: LocalFilesystemStorage) -> OrchestrationBackend:
    """Return an OrchestrationBackend selected by ``PARTHENON_ORCHESTRATION_BACKEND``."""
    settings = get_settings()
    name = settings.orchestration_backend.lower().strip()
    if name not in _BACKENDS:
        raise ValueError(
            f"unknown orchestration backend {name!r}; expected one of {sorted(_BACKENDS)}"
        )
    cls = _BACKENDS[name]
    if cls is PrefectBackend:
        return PrefectBackend(storage=storage, db_dsn=settings.database_url)
    return cls(storage=storage)  # type: ignore[call-arg]
