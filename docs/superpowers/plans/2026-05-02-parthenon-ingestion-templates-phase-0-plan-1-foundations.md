# Parthenon Ingestion Templates — Phase 0, Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a standalone `parthenon-templates` Python service that can execute a 3-node hello-world flow end-to-end via the dev-runner CLI and produce artifacts under the local storage adapter. No Laravel integration, no UI, no real templates.

**Architecture:** Single Docker container running FastAPI + Prefect server in-process under `tini` + `honcho`. Internal-token authenticated. Non-root user. Bound to internal docker network only. Code lives under a single new top-level `templates/` directory with `runtime/`, `manifests/`, `tests/` subtrees.

**Tech Stack:** Python 3.12, `uv` workspace, FastAPI, Pydantic v2, Pandera, Prefect 3.x, SQLAlchemy, Polars (default dataframe lib), pyomop. Tooling: ruff, black (line length 100), mypy --strict, pytest. Tests via pytest + pytest-asyncio + httpx for FastAPI client.

**Depends on:** None — this is the first plan.

**Unblocks:** Plan 2 (Laravel integration), Plan 3 (Frontend), Plan 4 (Templates).

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`). No `unittest`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on `main` (per `feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** are stable across all tasks: `Node`, `NodeContext`, `NodeResult`, `NodeStatus`, `OrchestrationBackend`, `FlowSpec`, `FlowNode`, `RunHandle`, `RunStatus`, `Manifest`, `ManifestSpec`, `ManifestMetadata`, `Registry`, `Materializer`, `StorageAdapter`, `LocalFilesystemStorage`.
- **Pinned versions** (validated against PyPI as of 2026-05-02; if a version cannot be confirmed by the executor, install the latest stable on the 3.x line and update the comment):
  - `fastapi==0.115.6`
  - `uvicorn[standard]==0.32.1`
  - `pydantic==2.10.3`
  - `pydantic-settings==2.6.1`
  - `prefect==3.1.5`
  - `sqlalchemy==2.0.36`
  - `psycopg[binary]==3.2.3`
  - `polars==1.17.1`
  - `pandera==0.21.0`
  - `pyomop==4.3.0`
  - `pyyaml==6.0.2`
  - `jsonschema==4.23.0`
  - `structlog==24.4.0`
  - `httpx==0.28.1`
  - `typer==0.15.1`
  - `python-multipart==0.0.20`
  - `tini` (system package, installed via apt in the Dockerfile)
  - `honcho==2.0.0`
  - Dev: `pytest==8.3.4`, `pytest-asyncio==0.25.0`, `pytest-cov==6.0.0`, `ruff==0.8.4`, `black==24.10.0`, `mypy==1.13.0`, `testcontainers[postgres]==4.9.0`.

---

## Task index (33 tasks)

1. Repo scaffold: `templates/` with pyproject, ruff/mypy config, README stub, empty package tree
2. `templates/Dockerfile` and `docker/templates/honcho.cfg` with tini + honcho supervisor
3. Add `parthenon-templates` service to `docker-compose.yml`
4. FastAPI scaffold at `runtime/api.py` with `/health` endpoint
5. Internal-token middleware (`X-Parthenon-Internal-Token`)
6. Healthcheck integration test (httpx + FastAPI TestClient)
7. `Node` ABC, `NodeContext`, `NodeResult`, `NodeStatus`
8. `PythonNode` implementation
9. `SqlNode` implementation
10. `CsvReaderNode` implementation
11. `DbReaderNode` implementation
12. `DbWriterNode` implementation
13. `Py2TableNode` implementation
14. `GenericFileNode` implementation
15. `RNode` implementation
16. Pandera + Pydantic schema utilities
17. Local dev runner CLI (`parthenon-nodes`)
18. ADR 0001 — Node SDK design
19. `OrchestrationBackend` ABC + `FlowSpec` + `LocalFilesystemStorage`
20. `PrefectBackend` real implementation
21. Three NotImplementedError stubs (Temporal, Dagster, Airflow)
22. Backend selection via `PARTHENON_ORCHESTRATION_BACKEND`
23. ADR 0002 — Orchestration backend
24. JSON Schema for manifest v1
25. Pydantic manifest loader
26. Filesystem-backed `Registry`
27. `Materializer` + secret-key redaction
28. FastAPI catalog + run endpoints
29. `parthenon-templates validate-manifests` CLI + pre-commit hook integration
30. CI workflow update (ruff, mypy, manifest validation)
31. ADR 0003 — Template manifest format
32. `parthenon-cdm` v5.4 schema factory + idempotent bootstrap
33. v5.3 + Oncology Extension support; end-to-end smoke test

---

### Task 1: Repo scaffold

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml`
- Create: `/home/smudoshi/Github/Parthenon/templates/ruff.toml`
- Create: `/home/smudoshi/Github/Parthenon/templates/mypy.ini`
- Create: `/home/smudoshi/Github/Parthenon/templates/.gitignore`
- Create: `/home/smudoshi/Github/Parthenon/templates/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/.gitkeep`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/conftest.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_packaging.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_packaging.py
"""Smoke test that the package metadata and module tree exist."""
from __future__ import annotations

import importlib
from pathlib import Path

import pytest


def test_runtime_package_imports() -> None:
    mod = importlib.import_module("runtime")
    assert mod is not None


@pytest.mark.parametrize(
    "submodule",
    ["runtime.nodes", "runtime.orchestration", "runtime.registry", "runtime.cdm"],
)
def test_runtime_subpackages_import(submodule: str) -> None:
    mod = importlib.import_module(submodule)
    assert mod is not None


def test_pyproject_declares_pinned_versions() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for required in (
        "fastapi==0.115.6",
        "pydantic==2.10.3",
        "prefect==3.1.5",
        "sqlalchemy==2.0.36",
        "polars==1.17.1",
        "pandera==0.21.0",
        "pyomop==4.3.0",
    ):
        assert required in pyproject, f"missing pinned dep: {required}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_packaging.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime'` (the package tree does not yet exist).

- [ ] **Step 3: Write minimal implementation**

```toml
# /home/smudoshi/Github/Parthenon/templates/pyproject.toml
[project]
name = "parthenon-templates"
version = "0.1.0"
description = "Parthenon ingestion templates runtime: node SDK, orchestration adapter, manifest registry."
readme = "README.md"
requires-python = ">=3.12"
license = { text = "Apache-2.0" }
authors = [{ name = "Acumenus Data Sciences" }]
dependencies = [
    "fastapi==0.115.6",
    "uvicorn[standard]==0.32.1",
    "pydantic==2.10.3",
    "pydantic-settings==2.6.1",
    "prefect==3.1.5",
    "sqlalchemy==2.0.36",
    "psycopg[binary]==3.2.3",
    "polars==1.17.1",
    "pandera==0.21.0",
    "pyomop==4.3.0",
    "pyyaml==6.0.2",
    "jsonschema==4.23.0",
    "structlog==24.4.0",
    "httpx==0.28.1",
    "typer==0.15.1",
    "python-multipart==0.0.20",
    "honcho==2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.4",
    "pytest-asyncio==0.25.0",
    "pytest-cov==6.0.0",
    "ruff==0.8.4",
    "black==24.10.0",
    "mypy==1.13.0",
    "testcontainers[postgres]==4.9.0",
]

[project.scripts]
parthenon-nodes = "runtime.runner:app"
parthenon-templates = "runtime.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["runtime"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-ra --strict-markers"

[tool.coverage.run]
source = ["runtime"]
branch = true
```

```toml
# /home/smudoshi/Github/Parthenon/templates/ruff.toml
line-length = 100
target-version = "py312"

[lint]
select = ["E", "F", "W", "I", "B", "UP", "SIM", "RUF"]
ignore = ["E501"]  # black handles line length

[format]
quote-style = "double"
```

```ini
# /home/smudoshi/Github/Parthenon/templates/mypy.ini
[mypy]
python_version = 3.12
strict = True
warn_unused_configs = True
disallow_any_unimported = True
warn_unreachable = True
namespace_packages = True
explicit_package_bases = True
mypy_path = .

[mypy-prefect.*]
ignore_missing_imports = True

[mypy-pyomop.*]
ignore_missing_imports = True

[mypy-pandera.*]
ignore_missing_imports = True

[mypy-testcontainers.*]
ignore_missing_imports = True
```

```gitignore
# /home/smudoshi/Github/Parthenon/templates/.gitignore
.venv/
__pycache__/
*.egg-info/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/
dist/
build/
uv.lock
```

```markdown
# /home/smudoshi/Github/Parthenon/templates/README.md
# parthenon-templates

Standalone Python service implementing the Parthenon ingestion-templates runtime:
node SDK (Phase 0 T-001), orchestration adapter (T-002), manifest registry (T-003),
and the `parthenon-cdm` CDM bootstrap helper (T-005).

This package is not exposed via Nginx. It listens on the internal docker network
only and authenticates Laravel via the `X-Parthenon-Internal-Token` header.

See `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`
for the full design.
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/__init__.py
"""Parthenon ingestion-templates runtime."""
__all__ = ["__version__"]
__version__ = "0.1.0"
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/__init__.py
"""Node SDK package — see runtime/nodes/base.py for the ABC."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/__init__.py
"""Orchestration adapter package — Prefect default + stubs."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/registry/__init__.py
"""Manifest registry package — JSON Schema + Pydantic loader + materializer."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cdm/__init__.py
"""parthenon-cdm: thin wrapper over pyomop for v5.3 / v5.4 / Oncology Extension."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/__init__.py
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/conftest.py
"""Shared pytest fixtures for parthenon-templates."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def _isolate_internal_token(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    yield
    if "PARTHENON_INTERNAL_TOKEN" in os.environ:
        # noop: monkeypatch unwinds automatically
        pass
```

The empty `manifests/.gitkeep` file is created with no content.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv venv && uv sync --all-extras && uv run pytest tests/test_packaging.py -v`
Expected: PASS — 6 passed (1 import test + 4 parametrized subpackage tests + 1 pyproject pin test).

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/pyproject.toml templates/ruff.toml templates/mypy.ini templates/.gitignore templates/README.md templates/runtime/ templates/manifests/.gitkeep templates/tests/__init__.py templates/tests/conftest.py templates/tests/test_packaging.py
git commit -m "feat(templates): scaffold parthenon-templates package with uv + pinned deps"
```

---

### Task 2: Dockerfile + honcho.cfg with tini + honcho supervisor

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/Dockerfile`
- Create: `/home/smudoshi/Github/Parthenon/docker/templates/honcho.cfg`
- Create: `/home/smudoshi/Github/Parthenon/docker/templates/entrypoint.sh`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_dockerfile.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_dockerfile.py
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
    assert "ENTRYPOINT [\"/usr/bin/tini\"" in dockerfile_text


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_dockerfile.py -v`
Expected: FAIL with `FileNotFoundError: [Errno 2] No such file or directory: '.../templates/Dockerfile'`.

- [ ] **Step 3: Write minimal implementation**

```dockerfile
# /home/smudoshi/Github/Parthenon/templates/Dockerfile
# Parthenon ingestion-templates runtime container.
# Runs FastAPI + Prefect server in-process under tini + honcho.
# Non-root user per HIGHSEC §4.1.

FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_LINK_MODE=copy

# tini for proper PID-1 signal handling; build-essential pruned post-install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tini \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (HIGHSEC §4.1).
RUN addgroup --system templates \
    && adduser --system --ingroup templates --home /home/templates --shell /usr/sbin/nologin templates

# Install uv as the non-root user's package manager.
RUN pip install --no-cache-dir uv==0.5.11

WORKDIR /app

# Copy project metadata first to maximize layer cache hits.
COPY --chown=templates:templates templates/pyproject.toml templates/README.md /app/templates/
COPY --chown=templates:templates templates/runtime /app/templates/runtime
COPY --chown=templates:templates docker/templates/honcho.cfg /app/honcho.cfg
COPY --chown=templates:templates docker/templates/entrypoint.sh /app/entrypoint.sh

RUN chmod 0755 /app/entrypoint.sh

# Storage volume mount target (matches docker-compose.yml).
RUN mkdir -p /var/parthenon/storage/templates \
    && chown -R templates:templates /var/parthenon /app

USER templates

# Build a venv inside the user home and install pinned deps.
ENV VIRTUAL_ENV=/home/templates/.venv \
    PATH="/home/templates/.venv/bin:${PATH}"
RUN uv venv /home/templates/.venv \
    && cd /app/templates \
    && uv pip install --python /home/templates/.venv/bin/python -e .

ENV PARTHENON_TEMPLATES_HOME=/app/templates \
    PARTHENON_STORAGE_ROOT=/var/parthenon/storage/templates \
    PREFECT_HOME=/home/templates/.prefect \
    PREFECT_API_URL=http://127.0.0.1:4200/api

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
CMD ["honcho", "-f", "/app/honcho.cfg", "start"]
```

```cfg
# /home/smudoshi/Github/Parthenon/docker/templates/honcho.cfg
# honcho process manifest for parthenon-templates.
# tini is PID 1; honcho supervises the two processes below as PID 2/3.

[processes]
web: uvicorn runtime.api:app --host 0.0.0.0 --port 8000 --log-config /app/templates/runtime/logging.json
prefect: prefect server start --host 127.0.0.1 --port 4200
```

```bash
# /home/smudoshi/Github/Parthenon/docker/templates/entrypoint.sh
#!/usr/bin/env bash
# Entry script for parthenon-templates.
# Validates required env vars then exec's into honcho.
set -euo pipefail

if [[ -z "${PARTHENON_INTERNAL_TOKEN:-}" ]]; then
    echo "FATAL: PARTHENON_INTERNAL_TOKEN must be set." >&2
    exit 1
fi

mkdir -p "${PARTHENON_STORAGE_ROOT}"
mkdir -p "${PREFECT_HOME}"

cd /app/templates
exec "$@"
```

A `runtime/logging.json` referenced above is created with default uvicorn settings:

```json
// /home/smudoshi/Github/Parthenon/templates/runtime/logging.json
{
  "version": 1,
  "disable_existing_loggers": false,
  "formatters": {
    "default": {
      "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    }
  },
  "handlers": {
    "default": {
      "class": "logging.StreamHandler",
      "formatter": "default",
      "stream": "ext://sys.stdout"
    }
  },
  "root": {"level": "INFO", "handlers": ["default"]},
  "loggers": {
    "uvicorn": {"level": "INFO", "handlers": ["default"], "propagate": false},
    "uvicorn.access": {"level": "INFO", "handlers": ["default"], "propagate": false}
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_dockerfile.py -v`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/Dockerfile templates/runtime/logging.json templates/tests/test_dockerfile.py docker/templates/honcho.cfg docker/templates/entrypoint.sh
git commit -m "feat(templates): add Dockerfile + honcho.cfg with tini supervisor and non-root user"
```

---

### Task 3: Add `parthenon-templates` service to docker-compose.yml

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/docker-compose.yml` (add service block; add named volume)
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_compose_service.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_compose_service.py
"""Validate docker-compose.yml entry for parthenon-templates."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml


@pytest.fixture()
def compose() -> dict[str, object]:
    repo = Path(__file__).resolve().parents[2]
    return yaml.safe_load((repo / "docker-compose.yml").read_text(encoding="utf-8"))


def test_service_exists(compose: dict[str, object]) -> None:
    services = compose["services"]
    assert isinstance(services, dict)
    assert "parthenon-templates" in services


def test_service_uses_internal_network_only(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    networks = svc["networks"]
    assert "parthenon" in networks
    # Service is NOT exposed via Nginx — no `ports:` mapping.
    assert "ports" not in svc, "parthenon-templates must not publish ports to host"


def test_service_runs_as_non_root_via_image(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    build = svc["build"]
    assert build["dockerfile"] == "templates/Dockerfile"


def test_service_mounts_storage_volume(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    mounts = svc["volumes"]
    assert any(
        "templates_storage:/var/parthenon/storage/templates" in m for m in mounts
    ), f"missing storage volume mount, got {mounts!r}"


def test_named_volume_declared(compose: dict[str, object]) -> None:
    volumes = compose["volumes"]
    assert "templates_storage" in volumes


def test_service_passes_internal_token_env(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    env = svc["environment"]
    assert any(
        e.startswith("PARTHENON_INTERNAL_TOKEN=${PARTHENON_INTERNAL_TOKEN")
        for e in env
    )


def test_service_has_healthcheck(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    assert "healthcheck" in svc
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_compose_service.py -v`
Expected: FAIL with `AssertionError: assert 'parthenon-templates' in {…}`.

- [ ] **Step 3: Write minimal implementation**

Edit `/home/smudoshi/Github/Parthenon/docker-compose.yml`. Insert the new service immediately before the `volumes:` top-level key (i.e. after `arachne-datanode`):

```yaml
  parthenon-templates:
    container_name: parthenon-templates
    build:
      context: .
      dockerfile: templates/Dockerfile
    restart: unless-stopped
    environment:
      - PARTHENON_INTERNAL_TOKEN=${PARTHENON_INTERNAL_TOKEN:?PARTHENON_INTERNAL_TOKEN must be set}
      - PARTHENON_ORCHESTRATION_BACKEND=${PARTHENON_ORCHESTRATION_BACKEND:-prefect}
      - PARTHENON_STORAGE_ROOT=/var/parthenon/storage/templates
      - DATABASE_URL=${TEMPLATES_DATABASE_URL:-postgresql+psycopg://parthenon_app@postgres:5432/parthenon}
      - PREFECT_API_URL=http://127.0.0.1:4200/api
    volumes:
      - templates_storage:/var/parthenon/storage/templates
    networks:
      - parthenon
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test:
        - CMD-SHELL
        - >
          curl --fail --silent --show-error
          --header "X-Parthenon-Internal-Token: $${PARTHENON_INTERNAL_TOKEN}"
          http://127.0.0.1:8000/health || exit 1
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

Then add the named volume to the existing `volumes:` block:

```yaml
  templates_storage:
```

(insert alphabetically after `solr_data:` or wherever consistent with the existing layout).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_compose_service.py -v && docker compose config --quiet`
Expected: PASS — 7 passed; `docker compose config --quiet` exits 0.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docker-compose.yml templates/tests/test_compose_service.py
git commit -m "feat(templates): wire parthenon-templates service into docker-compose"
```

---

### Task 4: FastAPI scaffold with `/health` endpoint

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/api.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/settings.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_api_health.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_api_health.py
"""Health endpoint integration test using FastAPI's TestClient."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from runtime.api import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_returns_200(client: TestClient) -> None:
    # /health is intentionally unauthenticated (matches HIGHSEC §2.3 public-route allowlist).
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "parthenon-templates"}


def test_app_metadata() -> None:
    assert app.title == "parthenon-templates"
    assert app.version == "0.1.0"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_api_health.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.api'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/settings.py
"""Process-wide settings loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for parthenon-templates."""

    model_config = SettingsConfigDict(
        env_prefix="PARTHENON_",
        env_file=None,
        case_sensitive=False,
        extra="ignore",
    )

    internal_token: str = Field(
        default="",
        validation_alias="PARTHENON_INTERNAL_TOKEN",
        description="Shared secret expected on the X-Parthenon-Internal-Token header.",
    )
    storage_root: Path = Field(
        default=Path("/var/parthenon/storage/templates"),
        validation_alias="PARTHENON_STORAGE_ROOT",
    )
    orchestration_backend: str = Field(
        default="prefect",
        validation_alias="PARTHENON_ORCHESTRATION_BACKEND",
    )
    database_url: str = Field(
        default="postgresql+psycopg://parthenon_app@postgres:5432/parthenon",
        validation_alias="DATABASE_URL",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/api.py
"""FastAPI app for parthenon-templates.

This module owns ONLY the app object and route registration. Business
logic lives in runtime/registry/ and runtime/orchestration/.
"""
from __future__ import annotations

from fastapi import FastAPI

from runtime import __version__

app = FastAPI(
    title="parthenon-templates",
    version=__version__,
    description="Internal-only ingestion templates runtime. Not exposed via Nginx.",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Intentionally unauthenticated."""
    return {"status": "ok", "service": "parthenon-templates"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_api_health.py -v && uv run mypy --strict runtime/api.py runtime/settings.py`
Expected: PASS — 2 passed; mypy reports `Success: no issues found in 2 source files`.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/api.py templates/runtime/settings.py templates/tests/test_api_health.py
git commit -m "feat(templates): add FastAPI scaffold with /health endpoint and Settings"
```

---

### Task 5: Internal-token authentication middleware

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/middleware/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/middleware/internal_token.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/api.py` (register middleware)
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_internal_token.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_internal_token.py
"""Internal-token middleware enforces X-Parthenon-Internal-Token on every non-health route."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from runtime.api import app


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    # Settings is cached; force a reload by clearing the lru_cache.
    from runtime.settings import get_settings

    get_settings.cache_clear()
    return TestClient(app)


def test_health_does_not_require_token(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


def test_protected_route_rejects_missing_header(client: TestClient) -> None:
    # /openapi.json is part of the protected surface.
    response = client.get("/openapi.json")
    assert response.status_code == 401
    assert response.json() == {"detail": "missing X-Parthenon-Internal-Token"}


def test_protected_route_rejects_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "wrong-token"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid X-Parthenon-Internal-Token"}


def test_protected_route_accepts_valid_token(client: TestClient) -> None:
    response = client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "test-internal-token"},
    )
    assert response.status_code == 200


def test_missing_server_token_rejects_all(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the server is misconfigured (empty token), every protected request is rejected."""
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "")
    from runtime.settings import get_settings

    get_settings.cache_clear()
    misconf_client = TestClient(app)
    response = misconf_client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "anything"},
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "PARTHENON_INTERNAL_TOKEN not configured"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_internal_token.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.middleware'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/middleware/__init__.py
"""ASGI middleware for parthenon-templates."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/middleware/internal_token.py
"""Internal-token middleware.

Every request except the unauthenticated allowlist must carry a matching
``X-Parthenon-Internal-Token`` header. Constant-time comparison.
"""
from __future__ import annotations

import hmac
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from runtime.settings import get_settings

HEADER_NAME = "X-Parthenon-Internal-Token"
UNAUTHENTICATED_PATHS = frozenset({"/health"})


class InternalTokenMiddleware(BaseHTTPMiddleware):
    """Reject requests that do not present the configured internal token."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in UNAUTHENTICATED_PATHS:
            return await call_next(request)

        settings = get_settings()
        expected = settings.internal_token
        if not expected:
            return JSONResponse(
                status_code=503,
                content={"detail": "PARTHENON_INTERNAL_TOKEN not configured"},
            )

        provided = request.headers.get(HEADER_NAME)
        if provided is None:
            return JSONResponse(
                status_code=401,
                content={"detail": f"missing {HEADER_NAME}"},
            )
        if not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
            return JSONResponse(
                status_code=401,
                content={"detail": f"invalid {HEADER_NAME}"},
            )
        return await call_next(request)
```

Modify `runtime/api.py` to register the middleware. The new file is:

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/api.py
"""FastAPI app for parthenon-templates."""
from __future__ import annotations

from fastapi import FastAPI

from runtime import __version__
from runtime.middleware.internal_token import InternalTokenMiddleware

app = FastAPI(
    title="parthenon-templates",
    version=__version__,
    description="Internal-only ingestion templates runtime. Not exposed via Nginx.",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(InternalTokenMiddleware)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Intentionally unauthenticated."""
    return {"status": "ok", "service": "parthenon-templates"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_internal_token.py tests/test_api_health.py -v && uv run mypy --strict runtime/middleware/internal_token.py runtime/api.py`
Expected: PASS — 7 passed (5 internal-token + 2 health); mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/middleware/__init__.py templates/runtime/middleware/internal_token.py templates/runtime/api.py templates/tests/test_internal_token.py
git commit -m "feat(templates): add X-Parthenon-Internal-Token authentication middleware"
```

---

### Task 6: Healthcheck integration test against running uvicorn

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_uvicorn_smoke.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_uvicorn_smoke.py
"""Spin up uvicorn in-process and verify the /health endpoint via httpx.

This complements the FastAPI TestClient-based unit tests by exercising the
full ASGI lifecycle (lifespan, middleware ordering, JSON serialization).
"""
from __future__ import annotations

import asyncio
import socket
import threading
from collections.abc import Generator

import httpx
import pytest
import uvicorn

from runtime.api import app


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture()
def server() -> Generator[str, None, None]:
    port = _free_port()
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        lifespan="on",
    )
    server_obj = uvicorn.Server(config)

    def _run() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(server_obj.serve())
        finally:
            loop.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    # Block until the server reports startup complete.
    while not server_obj.started:
        if not thread.is_alive():
            raise RuntimeError("uvicorn thread died before startup")

    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server_obj.should_exit = True
        thread.join(timeout=5)


def test_health_via_real_uvicorn(server: str) -> None:
    response = httpx.get(f"{server}/health", timeout=5.0)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "parthenon-templates"}


def test_internal_token_enforced_via_real_uvicorn(
    server: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    from runtime.settings import get_settings

    get_settings.cache_clear()
    response = httpx.get(f"{server}/openapi.json", timeout=5.0)
    assert response.status_code == 401
    headers = {"X-Parthenon-Internal-Token": "test-internal-token"}
    response_ok = httpx.get(f"{server}/openapi.json", headers=headers, timeout=5.0)
    assert response_ok.status_code == 200
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/__init__.py
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_uvicorn_smoke.py -v`
Expected: FAIL — file not present yet, the test command discovers no tests; once written, the smoke test runs against an in-process uvicorn. (If uvicorn fails to import, the failure is `ModuleNotFoundError: No module named 'uvicorn'`, fixed by `uv sync --all-extras`.)

- [ ] **Step 3: Write minimal implementation**

The test files above are the implementation for Task 6 — no new runtime code is required. The fixture wires uvicorn to the existing `runtime.api.app`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_uvicorn_smoke.py -v`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/integration/__init__.py templates/tests/integration/test_uvicorn_smoke.py
git commit -m "test(templates): add uvicorn-backed integration smoke test for /health"
```

---

### Task 7: `Node` ABC, `NodeContext`, `NodeResult`, `NodeStatus`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/base.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/__init__.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_node_base.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_node_base.py
"""Tests for the Node ABC and NodeContext."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import (
    Node,
    NodeContext,
    NodeResult,
    NodeStatus,
)


class _StubNode(Node):
    """Minimal concrete Node used to exercise the ABC."""

    type_name = "stub"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        context.logger.info("stub running")
        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"echo": params},
            artifacts=[],
        )


def test_node_is_abstract() -> None:
    with pytest.raises(TypeError):
        Node()  # type: ignore[abstract]


def test_node_subclass_must_implement_run() -> None:
    class Bad(Node):
        type_name = "bad"

    with pytest.raises(TypeError):
        Bad()  # type: ignore[abstract]


def test_node_subclass_must_set_type_name() -> None:
    class NoName(Node):
        def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
            return NodeResult(status=NodeStatus.SUCCESS, outputs={}, artifacts=[])

    with pytest.raises(ValueError, match="type_name"):
        NoName()


def test_node_context_has_required_attributes(tmp_path: Path) -> None:
    artifact_dir = tmp_path / "artifacts"
    artifact_dir.mkdir()

    secrets = {"API_KEY": "redacted"}
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets=secrets,
        artifact_dir=artifact_dir,
        db_dsn="postgresql+psycopg://parthenon_app@localhost:5432/parthenon",
    )
    assert ctx.run_id == "run-1"
    assert ctx.node_id == "node-1"
    assert ctx.get_secret("API_KEY") == "redacted"
    with pytest.raises(KeyError):
        ctx.get_secret("MISSING")
    assert ctx.artifact_dir == artifact_dir


def test_node_context_write_artifact(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    path = ctx.write_artifact("hello.txt", b"world")
    assert path == tmp_path / "hello.txt"
    assert path.read_bytes() == b"world"


def test_node_context_rejects_path_traversal(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    with pytest.raises(ValueError, match="path traversal"):
        ctx.write_artifact("../escape.txt", b"x")
    with pytest.raises(ValueError, match="path traversal"):
        ctx.write_artifact("/etc/passwd", b"x")


def test_node_runs_and_returns_result(tmp_path: Path) -> None:
    node = _StubNode()
    ctx = NodeContext(
        run_id="run-1",
        node_id="stub-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = node.run(ctx, {"name": "world"})
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"echo": {"name": "world"}}
    assert result.artifacts == []


def test_node_status_values() -> None:
    assert NodeStatus.PENDING.value == "pending"
    assert NodeStatus.RUNNING.value == "running"
    assert NodeStatus.SUCCESS.value == "success"
    assert NodeStatus.FAILED.value == "failed"
    assert NodeStatus.SKIPPED.value == "skipped"
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/__init__.py
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_node_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.base'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/base.py
"""Node SDK core: ``Node`` ABC, ``NodeContext``, ``NodeResult``.

Every node implementation in ``runtime/nodes/`` subclasses ``Node`` and
declares a unique ``type_name`` class attribute. Manifest YAML references
nodes by ``type_name`` (see ADR 0001 + ADR 0003).
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class NodeStatus(str, Enum):
    """Terminal and intermediate states for a node execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass(frozen=True)
class NodeArtifact:
    """Pointer to a file produced by a node, recorded for downstream consumers."""

    name: str
    path: Path
    media_type: str = "application/octet-stream"
    size_bytes: int | None = None


@dataclass(frozen=True)
class NodeResult:
    """Return value from ``Node.run``."""

    status: NodeStatus
    outputs: dict[str, Any] = field(default_factory=dict)
    artifacts: list[NodeArtifact] = field(default_factory=list)
    error_message: str | None = None


@dataclass
class NodeContext:
    """Per-invocation execution context.

    Provides a logger, secret accessor, artifact writer rooted at the run's
    artifact directory, and an optional SQLAlchemy-style DSN. The orchestration
    backend constructs and supplies this object.
    """

    run_id: str
    node_id: str
    logger: logging.Logger
    secrets: dict[str, str]
    artifact_dir: Path
    db_dsn: str | None

    def get_secret(self, key: str) -> str:
        if key not in self.secrets:
            raise KeyError(f"secret not provided: {key}")
        return self.secrets[key]

    def write_artifact(self, relative_name: str, payload: bytes) -> Path:
        """Write ``payload`` to ``artifact_dir / relative_name``.

        Rejects absolute paths and any name that would resolve outside the
        artifact directory (path traversal guard).
        """
        candidate = Path(relative_name)
        if candidate.is_absolute() or any(part == ".." for part in candidate.parts):
            raise ValueError(f"path traversal not allowed: {relative_name!r}")
        target = (self.artifact_dir / candidate).resolve()
        try:
            target.relative_to(self.artifact_dir.resolve())
        except ValueError as exc:
            raise ValueError(f"path traversal not allowed: {relative_name!r}") from exc
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return target


class Node(ABC):
    """Abstract base class for every executable node.

    Concrete subclasses MUST:
    * declare a class-level ``type_name: str`` matching the manifest reference.
    * implement ``run(context, params) -> NodeResult``.
    """

    type_name: str = ""

    def __init__(self) -> None:
        if not self.type_name:
            raise ValueError(
                f"{type(self).__name__} must declare a non-empty class attribute 'type_name'"
            )

    @abstractmethod
    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        """Execute the node. Implementations must be idempotent where feasible."""

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_node_base.py -v && uv run mypy --strict runtime/nodes/base.py`
Expected: PASS — 8 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/base.py templates/tests/unit/__init__.py templates/tests/unit/test_node_base.py
git commit -m "feat(templates): add Node ABC, NodeContext, NodeResult, NodeStatus"
```

---

### Task 8: `PythonNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/python_node.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_python_node.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_python_node.py
"""Tests for runtime.nodes.python_node.PythonNode."""
from __future__ import annotations

import logging
import textwrap
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.python_node import PythonNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-py",
        node_id="py-1",
        logger=logging.getLogger("test.python"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert PythonNode.type_name == "python"


def test_inline_code_returns_outputs(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "code": textwrap.dedent(
            """
            def main(context, params):
                return {"sum": params["a"] + params["b"]}
            """
        ),
        "inputs": {"a": 2, "b": 3},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"sum": 5}


def test_missing_main_function_fails(context: NodeContext) -> None:
    params = {"code": "x = 1\n", "inputs": {}}
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert result.error_message is not None
    assert "main" in result.error_message


def test_runtime_exception_surfaces_in_result(context: NodeContext) -> None:
    params = {
        "code": "def main(context, params):\n    raise RuntimeError('boom')\n",
        "inputs": {},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "boom" in (result.error_message or "")


def test_main_must_return_dict(context: NodeContext) -> None:
    params = {
        "code": "def main(context, params):\n    return 42\n",
        "inputs": {},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "must return dict" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_python_node.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.python_node'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/python_node.py
"""PythonNode: execute inline Python code defining a ``main(context, params)`` function.

Use cases: trivial transforms, glue between two SQL nodes, validation helpers.
For non-trivial code, prefer Py2TableNode (DataFrame-shaped contract).
"""
from __future__ import annotations

import traceback
from typing import Any

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus


class PythonNode(Node):
    """Execute an inline ``code`` string. The string must define ``main(context, params)``."""

    type_name = "python"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        code = str(params.get("code", "")).strip()
        inputs = dict(params.get("inputs", {}))
        if not code:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="PythonNode requires a non-empty 'code' parameter",
            )

        namespace: dict[str, Any] = {}
        try:
            exec(compile(code, f"<{context.node_id}>", "exec"), namespace)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"compile error: {exc}",
            )

        main = namespace.get("main")
        if not callable(main):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="PythonNode 'code' must define a callable named 'main'",
            )

        try:
            result_value = main(context, inputs)
        except Exception as exc:
            tb = traceback.format_exc(limit=4)
            context.logger.error("python_node failure: %s\n%s", exc, tb)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        if not isinstance(result_value, dict):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"PythonNode 'main' must return dict, got {type(result_value).__name__}"
                ),
            )

        return NodeResult(status=NodeStatus.SUCCESS, outputs=result_value)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_python_node.py -v && uv run mypy --strict runtime/nodes/python_node.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/python_node.py templates/tests/unit/test_python_node.py
git commit -m "feat(templates): add PythonNode (inline-code execution with main() contract)"
```

---

### Task 9: `SqlNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/sql_node.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_sql_node.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_sql_node.py
"""Tests for runtime.nodes.sql_node.SqlNode against an in-memory SQLite engine."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.sql_node import SqlNode


@pytest.fixture()
def sqlite_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'sql_node.db'}"


@pytest.fixture()
def context(tmp_path: Path, sqlite_url: str) -> NodeContext:
    return NodeContext(
        run_id="run-sql",
        node_id="sql-1",
        logger=logging.getLogger("test.sql"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=sqlite_url,
    )


def test_type_name() -> None:
    assert SqlNode.type_name == "sql"


def test_executes_ddl_and_dml(context: NodeContext, sqlite_url: str) -> None:
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE t (id INTEGER PRIMARY KEY, label TEXT)",
            "INSERT INTO t (id, label) VALUES (1, 'a'), (2, 'b')",
        ],
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"statements_executed": 2}

    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, label FROM t ORDER BY id")).fetchall()
    assert [tuple(r) for r in rows] == [(1, "a"), (2, "b")]


def test_returns_rows_for_select(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE x (n INTEGER)",
            "INSERT INTO x (n) VALUES (10), (20)",
        ],
        "fetch_query": "SELECT n FROM x ORDER BY n",
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["rows"] == [{"n": 10}, {"n": 20}]


def test_missing_dsn_fails(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = SqlNode().run(ctx, {"statements": ["SELECT 1"]})
    assert result.status == NodeStatus.FAILED
    assert "db_dsn" in (result.error_message or "")


def test_invalid_sql_fails(context: NodeContext) -> None:
    result = SqlNode().run(context, {"statements": ["NOT VALID SQL"]})
    assert result.status == NodeStatus.FAILED
    assert result.error_message is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_sql_node.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.sql_node'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/sql_node.py
"""SqlNode: execute one or more SQL statements via SQLAlchemy.

Connects to ``context.db_dsn``. ``statements`` runs in order inside a single
transaction. Optional ``fetch_query`` is run AFTER the transaction commits and
its rows are returned as ``outputs.rows`` (list of dicts).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus


class SqlNode(Node):
    """Execute SQL statements against the run's DSN."""

    type_name = "sql"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires context.db_dsn to be set",
            )
        statements = list(params.get("statements", []))
        if not statements:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires non-empty 'statements' list",
            )
        fetch_query = params.get("fetch_query")

        engine = create_engine(context.db_dsn, future=True)
        try:
            with engine.begin() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))
        except SQLAlchemyError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        outputs: dict[str, Any] = {"statements_executed": len(statements)}
        if fetch_query:
            try:
                with engine.connect() as conn:
                    result_rows = conn.execute(text(fetch_query))
                    columns = list(result_rows.keys())
                    outputs["rows"] = [dict(zip(columns, row)) for row in result_rows.fetchall()]
            except SQLAlchemyError as exc:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"fetch_query failed: {exc}",
                )

        return NodeResult(status=NodeStatus.SUCCESS, outputs=outputs)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_sql_node.py -v && uv run mypy --strict runtime/nodes/sql_node.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/sql_node.py templates/tests/unit/test_sql_node.py
git commit -m "feat(templates): add SqlNode (SQLAlchemy-backed multi-statement executor)"
```

---

### Task 10: `CsvReaderNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/csv_reader.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_csv_reader.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_csv_reader.py
"""Tests for runtime.nodes.csv_reader.CsvReaderNode."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.csv_reader import CsvReaderNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-csv",
        node_id="csv-1",
        logger=logging.getLogger("test.csv"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert CsvReaderNode.type_name == "csv_reader"


def test_reads_csv_to_polars_frame(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "input.csv"
    csv_path.write_text("a,b\n1,foo\n2,bar\n", encoding="utf-8")

    params: dict[str, Any] = {"path": str(csv_path)}
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2
    assert result.outputs["columns"] == ["a", "b"]
    # The DataFrame is materialized to an artifact (Parquet) for downstream nodes.
    assert len(result.artifacts) == 1
    assert result.artifacts[0].name == "input.parquet"
    assert result.artifacts[0].media_type == "application/x-parquet"
    assert result.artifacts[0].path.exists()


def test_missing_path_fails(context: NodeContext) -> None:
    result = CsvReaderNode().run(context, {"path": "/nonexistent.csv"})
    assert result.status == NodeStatus.FAILED
    assert "not found" in (result.error_message or "")


def test_explicit_schema_override(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "typed.csv"
    csv_path.write_text("id,score\n1,0.5\n2,0.75\n", encoding="utf-8")

    params: dict[str, Any] = {
        "path": str(csv_path),
        "schema": {"id": "i64", "score": "f64"},
    }
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["dtypes"] == {"id": "Int64", "score": "Float64"}


def test_delimiter_override(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "pipe.csv"
    csv_path.write_text("a|b\n1|x\n2|y\n", encoding="utf-8")
    params: dict[str, Any] = {"path": str(csv_path), "delimiter": "|"}
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["columns"] == ["a", "b"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_csv_reader.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.csv_reader'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/csv_reader.py
"""CsvReaderNode: read a CSV from disk into a Polars frame, write Parquet artifact."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus

_POLARS_TYPE_MAP: dict[str, pl.DataType] = {
    "i64": pl.Int64(),
    "i32": pl.Int32(),
    "f64": pl.Float64(),
    "f32": pl.Float32(),
    "str": pl.Utf8(),
    "utf8": pl.Utf8(),
    "bool": pl.Boolean(),
    "date": pl.Date(),
    "datetime": pl.Datetime(),
}


class CsvReaderNode(Node):
    """Read CSV → Polars DataFrame → Parquet artifact."""

    type_name = "csv_reader"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        raw_path = params.get("path")
        if not raw_path:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="CsvReaderNode requires 'path' parameter",
            )
        path = Path(str(raw_path))
        if not path.exists():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"CSV file not found: {path}",
            )

        delimiter = str(params.get("delimiter", ","))
        schema_param = params.get("schema") or {}
        dtypes: dict[str, pl.DataType] | None = None
        if schema_param:
            dtypes = {}
            for col, type_name in dict(schema_param).items():
                if type_name not in _POLARS_TYPE_MAP:
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=f"unsupported polars dtype: {type_name}",
                    )
                dtypes[str(col)] = _POLARS_TYPE_MAP[type_name]

        try:
            frame = pl.read_csv(path, separator=delimiter, schema_overrides=dtypes)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"polars read_csv failed: {exc}",
            )

        artifact_name = f"{path.stem}.parquet"
        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": list(frame.columns),
                "dtypes": {col: str(dtype) for col, dtype in zip(frame.columns, frame.dtypes)},
                "artifact_name": artifact_name,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="application/x-parquet",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_csv_reader.py -v && uv run mypy --strict runtime/nodes/csv_reader.py`
Expected: PASS — 4 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/csv_reader.py templates/tests/unit/test_csv_reader.py
git commit -m "feat(templates): add CsvReaderNode (CSV → Polars → Parquet artifact)"
```

---

### Task 11: `DbReaderNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/db_reader.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_db_reader.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_db_reader.py
"""Tests for runtime.nodes.db_reader.DbReaderNode against in-memory SQLite."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.db_reader import DbReaderNode


@pytest.fixture()
def seeded_db(tmp_path: Path) -> str:
    url = f"sqlite:///{tmp_path / 'reader.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE person (id INTEGER, name TEXT, age INTEGER)"))
        conn.execute(
            text("INSERT INTO person VALUES (1, 'alice', 33), (2, 'bob', 41)")
        )
    return url


@pytest.fixture()
def context(tmp_path: Path, seeded_db: str) -> NodeContext:
    return NodeContext(
        run_id="run-dbr",
        node_id="dbr-1",
        logger=logging.getLogger("test.dbr"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=seeded_db,
    )


def test_type_name() -> None:
    assert DbReaderNode.type_name == "db_reader"


def test_reads_query_to_parquet(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "query": "SELECT id, name, age FROM person ORDER BY id",
        "artifact_name": "people.parquet",
    }
    result = DbReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2
    assert result.outputs["columns"] == ["id", "name", "age"]
    assert len(result.artifacts) == 1
    assert result.artifacts[0].name == "people.parquet"


def test_query_with_bind_parameters(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "query": "SELECT id FROM person WHERE age > :min_age",
        "parameters": {"min_age": 35},
        "artifact_name": "old.parquet",
    }
    result = DbReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 1


def test_missing_dsn_fails(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = DbReaderNode().run(ctx, {"query": "SELECT 1", "artifact_name": "x.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "db_dsn" in (result.error_message or "")


def test_missing_query_fails(context: NodeContext) -> None:
    result = DbReaderNode().run(context, {"artifact_name": "x.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "query" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_db_reader.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.db_reader'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/db_reader.py
"""DbReaderNode: execute a SELECT and persist the result set to a Parquet artifact."""
from __future__ import annotations

from typing import Any

import polars as pl
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class DbReaderNode(Node):
    """Read rows from the run DSN into a Polars frame and emit a Parquet artifact."""

    type_name = "db_reader"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbReaderNode requires context.db_dsn",
            )
        query = params.get("query")
        artifact_name = str(params.get("artifact_name", "result.parquet"))
        bind_params: dict[str, Any] = dict(params.get("parameters") or {})
        if not query:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbReaderNode requires 'query' parameter",
            )

        engine = create_engine(context.db_dsn, future=True)
        try:
            with engine.connect() as conn:
                cursor = conn.execute(text(str(query)), bind_params)
                columns = list(cursor.keys())
                rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        except SQLAlchemyError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        frame = pl.DataFrame(rows) if rows else pl.DataFrame({c: [] for c in columns})
        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": columns,
                "artifact_name": artifact_name,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="application/x-parquet",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_db_reader.py -v && uv run mypy --strict runtime/nodes/db_reader.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/db_reader.py templates/tests/unit/test_db_reader.py
git commit -m "feat(templates): add DbReaderNode (SELECT → Polars → Parquet artifact)"
```

---

### Task 12: `DbWriterNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/db_writer.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_db_writer.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_db_writer.py
"""Tests for runtime.nodes.db_writer.DbWriterNode against in-memory SQLite."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import polars as pl
import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.db_writer import DbWriterNode


@pytest.fixture()
def empty_db(tmp_path: Path) -> str:
    url = f"sqlite:///{tmp_path / 'writer.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE concept (id INTEGER, name TEXT)"))
    return url


@pytest.fixture()
def parquet_artifact(tmp_path: Path) -> Path:
    frame = pl.DataFrame({"id": [10, 20, 30], "name": ["a", "b", "c"]})
    path = tmp_path / "input.parquet"
    frame.write_parquet(path)
    return path


@pytest.fixture()
def context(tmp_path: Path, empty_db: str) -> NodeContext:
    return NodeContext(
        run_id="run-dbw",
        node_id="dbw-1",
        logger=logging.getLogger("test.dbw"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=empty_db,
    )


def test_type_name() -> None:
    assert DbWriterNode.type_name == "db_writer"


def test_appends_parquet_to_table(
    context: NodeContext, empty_db: str, parquet_artifact: Path
) -> None:
    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "append",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"rows_written": 3, "target_table": "concept", "mode": "append"}

    engine = create_engine(empty_db)
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM concept")).scalar_one()
    assert count == 3


def test_truncate_mode_clears_then_writes(
    context: NodeContext, empty_db: str, parquet_artifact: Path
) -> None:
    engine = create_engine(empty_db)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO concept (id, name) VALUES (1, 'preexisting')"))

    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "truncate",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS

    with engine.connect() as conn:
        names = [
            r[0]
            for r in conn.execute(text("SELECT name FROM concept ORDER BY id")).fetchall()
        ]
    assert names == ["a", "b", "c"]


def test_invalid_mode_fails(context: NodeContext, parquet_artifact: Path) -> None:
    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "weird",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "mode" in (result.error_message or "")


def test_missing_artifact_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "source_artifact": "/nonexistent.parquet",
        "target_table": "concept",
        "mode": "append",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "not found" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_db_writer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.db_writer'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/db_writer.py
"""DbWriterNode: load a Parquet artifact into a SQL table.

Modes: ``append`` (default) and ``truncate`` (DELETE FROM target then insert).
The Phase 0 implementation uses Polars' ``write_database`` via SQLAlchemy.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

_VALID_MODES = frozenset({"append", "truncate"})


class DbWriterNode(Node):
    """Write a Parquet artifact into a target table."""

    type_name = "db_writer"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbWriterNode requires context.db_dsn",
            )
        source_raw = params.get("source_artifact")
        target_table = str(params.get("target_table", "")).strip()
        mode = str(params.get("mode", "append"))
        if not source_raw or not target_table:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbWriterNode requires 'source_artifact' and 'target_table'",
            )
        if mode not in _VALID_MODES:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"DbWriterNode invalid mode '{mode}'; expected one of {sorted(_VALID_MODES)}",
            )
        source = Path(str(source_raw))
        if not source.exists():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"source_artifact not found: {source}",
            )

        try:
            frame = pl.read_parquet(source)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"failed to read parquet: {exc}",
            )

        engine = create_engine(context.db_dsn, future=True)
        try:
            if mode == "truncate":
                with engine.begin() as conn:
                    conn.execute(text(f"DELETE FROM {target_table}"))
            frame.write_database(
                table_name=target_table,
                connection=context.db_dsn,
                if_table_exists="append",
            )
        except (SQLAlchemyError, Exception) as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "rows_written": frame.height,
                "target_table": target_table,
                "mode": mode,
            },
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_db_writer.py -v && uv run mypy --strict runtime/nodes/db_writer.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/db_writer.py templates/tests/unit/test_db_writer.py
git commit -m "feat(templates): add DbWriterNode (Parquet → SQL with append/truncate modes)"
```

---

### Task 13: `Py2TableNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/py2table.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_py2table.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_py2table.py
"""Tests for runtime.nodes.py2table.Py2TableNode.

Py2TableNode is a structured Python node that *must* return a Polars DataFrame.
It writes a Parquet artifact and exposes column metadata. Used for transforms
between two table-shaped boundaries.
"""
from __future__ import annotations

import logging
import textwrap
from pathlib import Path
from typing import Any

import polars as pl
import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.py2table import Py2TableNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-p2t",
        node_id="p2t-1",
        logger=logging.getLogger("test.p2t"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert Py2TableNode.type_name == "py2table"


def test_returns_polars_frame(context: NodeContext) -> None:
    code = textwrap.dedent(
        """
        import polars as pl

        def main(context, params):
            return pl.DataFrame({"x": [1, 2, 3], "y": ["a", "b", "c"]})
        """
    )
    params: dict[str, Any] = {"code": code, "artifact_name": "out.parquet"}
    result = Py2TableNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 3
    assert result.outputs["columns"] == ["x", "y"]
    assert len(result.artifacts) == 1


def test_pandas_frame_is_converted(context: NodeContext) -> None:
    """If user returns a dict, Py2TableNode coerces it via pl.DataFrame()."""
    code = textwrap.dedent(
        """
        def main(context, params):
            return {"a": [1, 2], "b": [3, 4]}
        """
    )
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2


def test_main_returning_non_dataframe_fails(context: NodeContext) -> None:
    code = "def main(context, params):\n    return 'oops'\n"
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "DataFrame" in (result.error_message or "")


def test_runtime_exception_surfaces(context: NodeContext) -> None:
    code = "def main(context, params):\n    raise ValueError('nope')\n"
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "nope" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_py2table.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.py2table'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/py2table.py
"""Py2TableNode: Python transform with a strict ``DataFrame`` return contract."""
from __future__ import annotations

from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class Py2TableNode(Node):
    """Run an inline ``main(context, params)`` and persist the result as Parquet."""

    type_name = "py2table"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        code = str(params.get("code", "")).strip()
        artifact_name = str(params.get("artifact_name", "py2table.parquet"))
        if not code:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Py2TableNode requires a 'code' parameter",
            )

        namespace: dict[str, Any] = {}
        try:
            exec(compile(code, f"<{context.node_id}>", "exec"), namespace)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"compile error: {exc}",
            )

        main = namespace.get("main")
        if not callable(main):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Py2TableNode 'code' must define callable 'main'",
            )

        try:
            value = main(context, params.get("inputs") or {})
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        frame = self._coerce_frame(value)
        if frame is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    "Py2TableNode 'main' must return a polars DataFrame or dict; "
                    f"got {type(value).__name__}"
                ),
            )

        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": list(frame.columns),
                "artifact_name": artifact_name,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="application/x-parquet",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )

    @staticmethod
    def _coerce_frame(value: Any) -> pl.DataFrame | None:
        if isinstance(value, pl.DataFrame):
            return value
        if isinstance(value, dict):
            try:
                return pl.DataFrame(value)
            except Exception:
                return None
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_py2table.py -v && uv run mypy --strict runtime/nodes/py2table.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/py2table.py templates/tests/unit/test_py2table.py
git commit -m "feat(templates): add Py2TableNode (Python → Polars DataFrame → Parquet)"
```

---

### Task 14: `GenericFileNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/generic_file.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_generic_file.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_generic_file.py
"""Tests for runtime.nodes.generic_file.GenericFileNode."""
from __future__ import annotations

import hashlib
import http.server
import logging
import socket
import threading
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.generic_file import GenericFileNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-gf",
        node_id="gf-1",
        logger=logging.getLogger("test.gf"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


@pytest.fixture()
def http_server(tmp_path: Path) -> Generator[str, None, None]:
    """Serve tmp_path over HTTP on a random port; yield the base URL."""
    served = tmp_path / "served"
    served.mkdir()
    (served / "data.bin").write_bytes(b"hello-world-payload")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(served), **kwargs)

        def log_message(self, fmt: str, *args: Any) -> None:  # silence
            return

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = int(sock.getsockname()[1])

    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        thread.join(timeout=2)


def test_type_name() -> None:
    assert GenericFileNode.type_name == "generic_file"


def test_downloads_http_url(context: NodeContext, http_server: str) -> None:
    params: dict[str, Any] = {
        "url": f"{http_server}/data.bin",
        "artifact_name": "fetched.bin",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["bytes"] == len(b"hello-world-payload")
    assert result.outputs["sha256"] == hashlib.sha256(b"hello-world-payload").hexdigest()
    assert (context.artifact_dir / "fetched.bin").read_bytes() == b"hello-world-payload"


def test_copies_local_file(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "src.txt"
    src.write_bytes(b"local-bytes")
    params: dict[str, Any] = {
        "url": f"file://{src}",
        "artifact_name": "copied.txt",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert (context.artifact_dir / "copied.txt").read_bytes() == b"local-bytes"


def test_unsupported_scheme_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "url": "ftp://example.com/file",
        "artifact_name": "x.bin",
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "scheme" in (result.error_message or "")


def test_expected_sha256_mismatch_fails(context: NodeContext, http_server: str) -> None:
    params: dict[str, Any] = {
        "url": f"{http_server}/data.bin",
        "artifact_name": "fetched.bin",
        "expected_sha256": "0" * 64,
    }
    result = GenericFileNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "sha256" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_generic_file.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.generic_file'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/generic_file.py
"""GenericFileNode: download (http/https) or copy (file://) to an artifact."""
from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class GenericFileNode(Node):
    """Fetch a URL into the run's artifact directory."""

    type_name = "generic_file"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        url = str(params.get("url", ""))
        artifact_name = str(params.get("artifact_name", "")).strip()
        expected_sha256 = params.get("expected_sha256")
        timeout = float(params.get("timeout_seconds", 60.0))
        if not url or not artifact_name:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="GenericFileNode requires 'url' and 'artifact_name'",
            )

        target = context.artifact_dir / artifact_name
        target.parent.mkdir(parents=True, exist_ok=True)

        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        try:
            if scheme in {"http", "https"}:
                self._download_http(url, target, timeout)
            elif scheme == "file":
                src = Path(parsed.path)
                if not src.exists():
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=f"file:// source not found: {src}",
                    )
                shutil.copyfile(src, target)
            else:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"unsupported scheme: {scheme!r}",
                )
        except httpx.HTTPError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"download failed: {exc}",
            )

        size = target.stat().st_size
        digest = self._sha256(target)
        if expected_sha256 and str(expected_sha256).lower() != digest:
            target.unlink(missing_ok=True)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"sha256 mismatch: expected {expected_sha256}, got {digest}",
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "url": url,
                "artifact_name": artifact_name,
                "bytes": size,
                "sha256": digest,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=target,
                    media_type="application/octet-stream",
                    size_bytes=size,
                )
            ],
        )

    @staticmethod
    def _download_http(url: str, target: Path, timeout: float) -> None:
        with httpx.stream("GET", url, timeout=timeout, follow_redirects=True) as response:
            response.raise_for_status()
            with target.open("wb") as fh:
                for chunk in response.iter_bytes():
                    fh.write(chunk)

    @staticmethod
    def _sha256(path: Path) -> str:
        hasher = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(64 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_generic_file.py -v && uv run mypy --strict runtime/nodes/generic_file.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/generic_file.py templates/tests/unit/test_generic_file.py
git commit -m "feat(templates): add GenericFileNode (http/https/file:// fetcher with sha256 check)"
```

---

### Task 15: `RNode` implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/r_node.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_r_node.py`

**Note:** `RNode` shells out to the R binary. The Phase 0 implementation does not bundle R into the Python container. Tests skip when `Rscript` is unavailable on the executor host (CI installs `r-base-core`).

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_r_node.py
"""Tests for runtime.nodes.r_node.RNode.

Skipped when Rscript is not on PATH (developer machines without R).
CI image is expected to install r-base-core.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.r_node import RNode

pytestmark = pytest.mark.skipif(
    shutil.which("Rscript") is None,
    reason="Rscript not available on this host",
)


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-r",
        node_id="r-1",
        logger=logging.getLogger("test.r"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert RNode.type_name == "r"


def test_runs_inline_script(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "script": 'cat("answer:", 42, "\\n")',
        "artifact_name": "r_stdout.txt",
    }
    result = RNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["exit_code"] == 0
    assert "answer: 42" in result.outputs["stdout"]
    assert (context.artifact_dir / "r_stdout.txt").read_text(encoding="utf-8").strip() == (
        "answer: 42"
    )


def test_nonzero_exit_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "script": 'stop("explicit failure")',
        "artifact_name": "r_stdout.txt",
    }
    result = RNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert (result.error_message or "").startswith("Rscript exited with code")


def test_missing_script_fails(context: NodeContext) -> None:
    result = RNode().run(context, {"artifact_name": "x.txt"})
    assert result.status == NodeStatus.FAILED
    assert "script" in (result.error_message or "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_r_node.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.nodes.r_node'` (or all tests SKIPPED if `Rscript` is missing — that is also acceptable for this step; rerun after implementation).

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/nodes/r_node.py
"""RNode: shell out to Rscript and capture stdout/stderr as artifacts."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class RNode(Node):
    """Execute an inline R ``script`` via Rscript and capture output."""

    type_name = "r"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        script = str(params.get("script", "")).strip()
        artifact_name = str(params.get("artifact_name", "r_output.txt"))
        timeout = float(params.get("timeout_seconds", 600.0))
        if not script:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="RNode requires non-empty 'script' parameter",
            )
        rscript = shutil.which("Rscript")
        if rscript is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Rscript binary not found on PATH",
            )

        with tempfile.NamedTemporaryFile("w", suffix=".R", delete=False) as fh:
            fh.write(script)
            script_path = Path(fh.name)

        try:
            completed = subprocess.run(
                [rscript, "--vanilla", str(script_path)],
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            script_path.unlink(missing_ok=True)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Rscript timed out after {timeout}s",
            )
        finally:
            script_path.unlink(missing_ok=True)

        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(completed.stdout, encoding="utf-8")

        if completed.returncode != 0:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"Rscript exited with code {completed.returncode}: "
                    f"{completed.stderr.strip()[:500]}"
                ),
                outputs={
                    "exit_code": completed.returncode,
                    "stdout": completed.stdout,
                    "stderr": completed.stderr,
                },
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "exit_code": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="text/plain",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_r_node.py -v && uv run mypy --strict runtime/nodes/r_node.py`
Expected: PASS — 3 passed (or skipped on hosts without Rscript). mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/nodes/r_node.py templates/tests/unit/test_r_node.py
git commit -m "feat(templates): add RNode (Rscript shell-out with stdout/stderr capture)"
```

---

### Task 16: Schema utilities (Pandera + Pydantic)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/schemas.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_schemas.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_schemas.py
"""Tests for runtime.schemas: Pandera validation + Pydantic param models."""
from __future__ import annotations

import polars as pl
import pytest
from pydantic import ValidationError

from runtime.schemas import (
    ParameterModel,
    SchemaValidationError,
    define_dataframe_model,
    validate_frame,
)


def test_define_dataframe_model_accepts_columns() -> None:
    Model = define_dataframe_model(
        name="PersonRow",
        columns={
            "id": {"dtype": "int64", "nullable": False},
            "name": {"dtype": "str", "nullable": False},
        },
    )
    frame = pl.DataFrame({"id": [1, 2], "name": ["a", "b"]})
    validated = validate_frame(frame, Model)
    assert validated.height == 2


def test_validate_frame_rejects_missing_column() -> None:
    Model = define_dataframe_model(
        name="WithAge",
        columns={
            "id": {"dtype": "int64", "nullable": False},
            "age": {"dtype": "int64", "nullable": False},
        },
    )
    frame = pl.DataFrame({"id": [1]})
    with pytest.raises(SchemaValidationError) as exc_info:
        validate_frame(frame, Model)
    assert "age" in str(exc_info.value)


def test_validate_frame_rejects_wrong_dtype() -> None:
    Model = define_dataframe_model(
        name="StringId",
        columns={"id": {"dtype": "str", "nullable": False}},
    )
    frame = pl.DataFrame({"id": [1, 2]})
    with pytest.raises(SchemaValidationError):
        validate_frame(frame, Model)


def test_parameter_model_validates_required_fields() -> None:
    class CsvParams(ParameterModel):
        path: str
        delimiter: str = ","

    parsed = CsvParams.model_validate({"path": "/data.csv"})
    assert parsed.path == "/data.csv"
    assert parsed.delimiter == ","

    with pytest.raises(ValidationError):
        CsvParams.model_validate({})


def test_parameter_model_forbids_extra_fields() -> None:
    class StrictParams(ParameterModel):
        target_table: str

    with pytest.raises(ValidationError):
        StrictParams.model_validate({"target_table": "t", "unknown": 1})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_schemas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.schemas'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/schemas.py
"""Schema utilities for parthenon-templates.

Two boundaries are validated:

* **DataFrames** flowing between nodes — validated with Pandera (Polars dialect).
* **Parameter dicts** flowing into nodes — validated with Pydantic models
  (subclass ``ParameterModel`` to opt in).
"""
from __future__ import annotations

from typing import Any, ClassVar

import pandera.polars as pa
import polars as pl
from pandera.errors import SchemaError
from pydantic import BaseModel, ConfigDict


class SchemaValidationError(ValueError):
    """Raised when a Polars frame does not match its declared schema."""


_DTYPE_MAP: dict[str, type[pl.DataType] | pl.DataType] = {
    "int64": pl.Int64,
    "int32": pl.Int32,
    "float64": pl.Float64,
    "float32": pl.Float32,
    "str": pl.Utf8,
    "bool": pl.Boolean,
    "date": pl.Date,
    "datetime": pl.Datetime,
}


def define_dataframe_model(
    *, name: str, columns: dict[str, dict[str, Any]]
) -> pa.DataFrameSchema:
    """Build a Pandera schema from a column spec.

    ``columns`` maps column-name → ``{dtype: str, nullable: bool}``. ``dtype``
    is one of the keys in ``_DTYPE_MAP``.
    """
    schema_columns: dict[str, pa.Column] = {}
    for col_name, col_spec in columns.items():
        dtype_key = str(col_spec["dtype"])
        if dtype_key not in _DTYPE_MAP:
            raise ValueError(f"unsupported dtype {dtype_key!r} for column {col_name}")
        schema_columns[col_name] = pa.Column(
            _DTYPE_MAP[dtype_key],
            nullable=bool(col_spec.get("nullable", False)),
        )
    return pa.DataFrameSchema(schema_columns, name=name, strict=False)


def validate_frame(frame: pl.DataFrame, schema: pa.DataFrameSchema) -> pl.DataFrame:
    """Validate ``frame`` against ``schema``; re-raise as ``SchemaValidationError``."""
    try:
        validated = schema.validate(frame, lazy=True)
    except SchemaError as exc:
        raise SchemaValidationError(str(exc)) from exc
    if not isinstance(validated, pl.DataFrame):
        raise SchemaValidationError("schema.validate returned non-DataFrame")
    return validated


class ParameterModel(BaseModel):
    """Base class for node-parameter Pydantic models.

    Forbids unknown fields to catch typos early.
    """

    model_config: ClassVar[ConfigDict] = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_schemas.py -v && uv run mypy --strict runtime/schemas.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/schemas.py templates/tests/unit/test_schemas.py
git commit -m "feat(templates): add schema utilities (Pandera DataFrame + Pydantic ParameterModel)"
```

---

### Task 17: Local dev runner CLI (`parthenon-nodes`)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/runner.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_runner_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_runner_cli.py
"""Tests for the `parthenon-nodes` Typer CLI."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from runtime.runner import app


@pytest.fixture()
def cli() -> CliRunner:
    return CliRunner()


def test_run_python_node_inline(cli: CliRunner, tmp_path: Path) -> None:
    params_file = tmp_path / "params.json"
    params_file.write_text(
        json.dumps(
            {
                "code": "def main(context, params):\n    return {'value': params['x'] * 2}\n",
                "inputs": {"x": 21},
            }
        ),
        encoding="utf-8",
    )
    result = cli.invoke(
        app,
        [
            "run",
            "PythonNode",
            "--params",
            str(params_file),
            "--artifact-dir",
            str(tmp_path),
        ],
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["status"] == "success"
    assert payload["outputs"] == {"value": 42}


def test_run_unknown_node_class_fails(cli: CliRunner, tmp_path: Path) -> None:
    params_file = tmp_path / "p.json"
    params_file.write_text("{}", encoding="utf-8")
    result = cli.invoke(
        app,
        ["run", "DoesNotExist", "--params", str(params_file)],
    )
    assert result.exit_code != 0
    assert "unknown node" in result.output.lower()


def test_list_nodes_shows_eight_bootstrap_nodes(cli: CliRunner) -> None:
    result = cli.invoke(app, ["list"])
    assert result.exit_code == 0
    for name in (
        "PythonNode",
        "SqlNode",
        "CsvReaderNode",
        "DbReaderNode",
        "DbWriterNode",
        "Py2TableNode",
        "GenericFileNode",
        "RNode",
    ):
        assert name in result.output
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_runner_cli.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.runner'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/runner.py
"""Local dev runner: ``parthenon-nodes run <NodeClass> --params params.json``."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

import typer

from runtime.nodes.base import Node, NodeContext
from runtime.nodes.csv_reader import CsvReaderNode
from runtime.nodes.db_reader import DbReaderNode
from runtime.nodes.db_writer import DbWriterNode
from runtime.nodes.generic_file import GenericFileNode
from runtime.nodes.py2table import Py2TableNode
from runtime.nodes.python_node import PythonNode
from runtime.nodes.r_node import RNode
from runtime.nodes.sql_node import SqlNode

app = typer.Typer(help="Run a single Node locally for dev / debugging.")

_REGISTRY: dict[str, type[Node]] = {
    "PythonNode": PythonNode,
    "SqlNode": SqlNode,
    "CsvReaderNode": CsvReaderNode,
    "DbReaderNode": DbReaderNode,
    "DbWriterNode": DbWriterNode,
    "Py2TableNode": Py2TableNode,
    "GenericFileNode": GenericFileNode,
    "RNode": RNode,
}


@app.command("list")
def list_nodes() -> None:
    """List node classes available to the runner."""
    for name in sorted(_REGISTRY):
        typer.echo(f"{name:20} {_REGISTRY[name].type_name}")


@app.command("run")
def run_node(
    node_class: str = typer.Argument(..., help="One of: " + ", ".join(sorted(_REGISTRY))),
    params: Path = typer.Option(..., "--params", help="Path to JSON params file."),
    artifact_dir: Path = typer.Option(
        Path.cwd() / "artifacts",
        "--artifact-dir",
        help="Where the node should write artifacts.",
    ),
    db_dsn: str | None = typer.Option(None, "--db-dsn", help="SQLAlchemy DSN, optional."),
    run_id: str = typer.Option("local", "--run-id"),
    node_id: str = typer.Option("local-node", "--node-id"),
) -> None:
    """Execute a single node and print the JSON result to stdout."""
    cls = _REGISTRY.get(node_class)
    if cls is None:
        typer.echo(f"unknown node: {node_class!r}", err=True)
        raise typer.Exit(code=2)

    artifact_dir.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = json.loads(params.read_text(encoding="utf-8"))

    logger = logging.getLogger(f"runner.{node_class}")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    context = NodeContext(
        run_id=run_id,
        node_id=node_id,
        logger=logger,
        secrets={},
        artifact_dir=artifact_dir,
        db_dsn=db_dsn,
    )
    node = cls()
    result = node.run(context, payload)
    typer.echo(
        json.dumps(
            {
                "status": result.status.value,
                "outputs": result.outputs,
                "artifacts": [
                    {
                        "name": a.name,
                        "path": str(a.path),
                        "media_type": a.media_type,
                        "size_bytes": a.size_bytes,
                    }
                    for a in result.artifacts
                ],
                "error_message": result.error_message,
            }
        )
    )
    if result.status.value == "failed":
        raise typer.Exit(code=1)


# Allow ``python -m runtime.runner`` for parity with the entrypoint.
if __name__ == "__main__":  # pragma: no cover
    app()


__all__ = ["app", "asdict"]  # asdict re-export keeps mypy happy across modules using it
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_runner_cli.py -v && uv run mypy --strict runtime/runner.py`
Expected: PASS — 3 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/runner.py templates/tests/unit/test_runner_cli.py
git commit -m "feat(templates): add parthenon-nodes Typer CLI for local node execution"
```

---

### Task 18: ADR 0001 — Node SDK design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0001-node-sdk-design.md`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py
"""ADR documents for Phase 0 must exist and follow MADR shape."""
from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
ADR_DIR = REPO / "docs" / "adr"

EXPECTED_ADRS = [
    ("0001-node-sdk-design.md", "Node SDK"),
    ("0002-orchestration-backend.md", "Orchestration"),
    ("0003-template-manifest-format.md", "Manifest"),
]


@pytest.mark.parametrize("filename,title_keyword", EXPECTED_ADRS)
def test_adr_exists_and_uses_madr(filename: str, title_keyword: str) -> None:
    path = ADR_DIR / filename
    assert path.exists(), f"missing ADR: {path}"
    text = path.read_text(encoding="utf-8")
    for required_section in (
        "## Status",
        "## Context",
        "## Decision",
        "## Consequences",
    ):
        assert required_section in text, f"{filename} missing {required_section}"
    assert title_keyword.lower() in text.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: FAIL — `AssertionError: missing ADR: .../docs/adr/0001-node-sdk-design.md`. (The other two also fail; they are written in tasks 23 and 31.)

- [ ] **Step 3: Write minimal implementation**

Create `/home/smudoshi/Github/Parthenon/docs/adr/0001-node-sdk-design.md` with the following exact content:

```markdown
# ADR 0001: Node SDK Design

## Status

Accepted — 2026-05-02. Supersedes none.

## Context

Phase 0 of the Parthenon ingestion-templates milestone (devplan T-001) needs a
small, opinionated SDK so that template authors can compose ETL pipelines from
reusable building blocks. We must:

* Run trivially in tests (no Prefect required for unit tests).
* Permit mixed runtimes: native Python, SQL via SQLAlchemy, R via Rscript shell-out.
* Support both inline-code nodes (`python`, `py2table`) and declarative nodes
  (`csv_reader`, `db_reader`, `db_writer`, `generic_file`, `sql`).
* Provide a stable interface that the orchestration adapter (T-002) can target
  without leaking Prefect-specific concepts upstream.

The MADR options considered:

1. **Direct Prefect tasks.** Authors write `@task`-decorated functions and we
   load them via Prefect's deployment API. Rejected: couples authors to Prefect
   and makes Temporal/Dagster/Airflow swaps invasive.
2. **Custom DSL.** Define a YAML-only language with built-in operators.
   Rejected: every new node type requires a parser change; debugging is hard.
3. **ABC-based SDK with a small set of bootstrap nodes.** Chosen.

## Decision

Define a `Node` ABC in `runtime/nodes/base.py` with one abstract method:

```python
class Node(ABC):
    type_name: str  # class attribute referenced from manifests

    @abstractmethod
    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult: ...
```

A `NodeContext` provides:

* `run_id`, `node_id` for correlation,
* a `logger`,
* a `secrets` dict (`get_secret(key)` raises `KeyError` on miss),
* an `artifact_dir` with a path-traversal-guarded `write_artifact` helper,
* an optional SQLAlchemy `db_dsn`.

A `NodeResult` is a frozen dataclass: `status` (`NodeStatus` enum), `outputs`
(dict), `artifacts` (list of `NodeArtifact`), and an optional `error_message`.

Eight bootstrap node types ship with Phase 0:

| `type_name`     | Class             | Purpose                                  |
|-----------------|-------------------|------------------------------------------|
| `python`        | `PythonNode`      | Inline `main(context, params) -> dict`   |
| `sql`           | `SqlNode`         | Multi-statement SQL via SQLAlchemy       |
| `csv_reader`    | `CsvReaderNode`   | CSV → Polars → Parquet artifact          |
| `db_reader`     | `DbReaderNode`    | SELECT → Polars → Parquet artifact       |
| `db_writer`     | `DbWriterNode`    | Parquet → SQL with `append`/`truncate`   |
| `py2table`      | `Py2TableNode`    | Inline Python that returns a DataFrame   |
| `generic_file`  | `GenericFileNode` | http/https/file:// fetch with sha256     |
| `r`             | `RNode`           | Rscript shell-out, captures stdout/stderr|

Schema validation lives in `runtime/schemas.py`:

* `define_dataframe_model(...)` returns a Pandera (Polars dialect) schema.
* `validate_frame(frame, schema)` raises `SchemaValidationError`.
* `ParameterModel` is the Pydantic base for node-parameter models
  (`extra="forbid"` to surface typos).

A `parthenon-nodes` Typer CLI in `runtime/runner.py` runs a single node locally
for dev/debug parity. Its result is JSON on stdout.

## Consequences

* Authors learn one ABC and one parameter contract per node.
* Tests target the SDK directly without booting Prefect — fast, deterministic.
* The orchestration adapter (ADR 0002) wraps `Node.run` in a single Prefect
  task; swapping engines amounts to writing a new adapter.
* Inline-code nodes (`python`, `py2table`) carry the usual `exec()` risk; we
  mitigate by running templates only as the `templates` non-root container user
  and by manifest review (CI lint) — see ADR 0003.
* `RNode` requires `Rscript` on PATH; tests skip when absent. We do **not**
  bundle R into the Python container in Phase 0 — a sidecar pattern is left to
  Phase 1.

## Alternatives considered (declined)

* Direct Prefect tasks — see Context.
* Custom DSL — see Context.
* Single mega-node with parameter dispatch — rejected because it muddies typing
  and forces every node's parameters into one Pydantic union.

## References

* Spec §5 (Components — Python service rows).
* Devplan T-001.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest 'tests/test_adrs.py::test_adr_exists_and_uses_madr[0001-node-sdk-design.md-Node SDK]' -v`
Expected: PASS — 1 passed (the other two parametrized cases remain failing until tasks 23 and 31).

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0001-node-sdk-design.md templates/tests/test_adrs.py
git commit -m "docs(templates): add ADR 0001 Node SDK design"
```

---

### Task 19: `OrchestrationBackend` ABC + `FlowSpec` + `LocalFilesystemStorage`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/interface.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/flow_spec.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/storage.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_interface.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_interface.py
"""Tests for the orchestration ABC, FlowSpec serialization, and local storage."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import (
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


def test_orchestration_backend_is_abstract() -> None:
    with pytest.raises(TypeError):
        OrchestrationBackend()  # type: ignore[abstract]


def test_run_status_values() -> None:
    assert {s.value for s in RunStatus} == {
        "pending",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
    }


def test_flow_spec_round_trips_through_dict() -> None:
    spec = FlowSpec(
        flow_id="hello-cdm",
        nodes=[
            FlowNode(node_id="n1", type_name="python", params={"code": "..."}),
            FlowNode(
                node_id="n2", type_name="sql", params={"statements": ["SELECT 1"]},
                depends_on=["n1"],
            ),
        ],
    )
    payload = spec.to_dict()
    restored = FlowSpec.from_dict(payload)
    assert restored.flow_id == spec.flow_id
    assert [n.node_id for n in restored.nodes] == ["n1", "n2"]
    assert restored.nodes[1].depends_on == ["n1"]


def test_flow_spec_rejects_cyclic_graph() -> None:
    with pytest.raises(ValueError, match="cycle"):
        FlowSpec(
            flow_id="bad",
            nodes=[
                FlowNode(node_id="a", type_name="python", params={}, depends_on=["b"]),
                FlowNode(node_id="b", type_name="python", params={}, depends_on=["a"]),
            ],
        ).validate()


def test_flow_spec_rejects_unknown_dependency() -> None:
    with pytest.raises(ValueError, match="unknown dependency"):
        FlowSpec(
            flow_id="bad2",
            nodes=[FlowNode(node_id="a", type_name="python", params={}, depends_on=["ghost"])],
        ).validate()


def test_local_filesystem_storage_writes_under_run_dir(tmp_path: Path) -> None:
    storage = LocalFilesystemStorage(root=tmp_path)
    artifact_dir = storage.artifact_dir(run_id="run-42", node_id="n1")
    assert artifact_dir == tmp_path / "run-42" / "n1"
    assert artifact_dir.exists()


def test_local_filesystem_storage_lists_artifacts(tmp_path: Path) -> None:
    storage = LocalFilesystemStorage(root=tmp_path)
    artifact_dir = storage.artifact_dir(run_id="r", node_id="n")
    (artifact_dir / "out.parquet").write_bytes(b"x")
    (artifact_dir / "log.txt").write_bytes(b"y")
    listed = storage.list_artifacts(run_id="r")
    names = sorted(a.name for a in listed)
    assert names == ["log.txt", "out.parquet"]


def test_run_handle_dataclass() -> None:
    handle = RunHandle(run_id="r-1", backend_id="prefect-deployment-uuid")
    assert handle.run_id == "r-1"
    assert handle.backend_id == "prefect-deployment-uuid"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_interface.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.orchestration.flow_spec'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/flow_spec.py
"""Serializable node graph submitted to an OrchestrationBackend."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FlowNode:
    """One node in a FlowSpec graph."""

    node_id: str
    type_name: str
    params: dict[str, Any] = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "type_name": self.type_name,
            "params": dict(self.params),
            "depends_on": list(self.depends_on),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> FlowNode:
        return cls(
            node_id=str(payload["node_id"]),
            type_name=str(payload["type_name"]),
            params=dict(payload.get("params") or {}),
            depends_on=list(payload.get("depends_on") or []),
        )


@dataclass
class FlowSpec:
    """A directed acyclic graph of FlowNode plus run metadata."""

    flow_id: str
    nodes: list[FlowNode] = field(default_factory=list)
    parameters: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "flow_id": self.flow_id,
            "nodes": [n.to_dict() for n in self.nodes],
            "parameters": dict(self.parameters),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> FlowSpec:
        return cls(
            flow_id=str(payload["flow_id"]),
            nodes=[FlowNode.from_dict(n) for n in payload.get("nodes", [])],
            parameters=dict(payload.get("parameters") or {}),
        )

    def validate(self) -> None:
        ids = {n.node_id for n in self.nodes}
        if len(ids) != len(self.nodes):
            raise ValueError("FlowSpec node ids must be unique")
        for n in self.nodes:
            for dep in n.depends_on:
                if dep not in ids:
                    raise ValueError(f"unknown dependency {dep!r} on node {n.node_id!r}")
        # cycle detection via DFS
        visited: dict[str, int] = {n.node_id: 0 for n in self.nodes}
        adj: dict[str, list[str]] = {n.node_id: list(n.depends_on) for n in self.nodes}

        def dfs(node_id: str) -> None:
            state = visited[node_id]
            if state == 1:
                raise ValueError(f"cycle detected at node {node_id!r}")
            if state == 2:
                return
            visited[node_id] = 1
            for dep in adj[node_id]:
                dfs(dep)
            visited[node_id] = 2

        for node_id in list(visited):
            dfs(node_id)
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/interface.py
"""OrchestrationBackend ABC: the seam between manifest execution and a chosen engine."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

from runtime.orchestration.flow_spec import FlowSpec


class RunStatus(str, Enum):
    """Backend-agnostic run statuses (mirrored in app.template_runs.status)."""

    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class RunHandle:
    """Returned from ``submit``; the caller uses it for status/log/cancel calls."""

    run_id: str
    backend_id: str


@dataclass
class LogLine:
    """One structured log entry returned by ``get_logs``."""

    timestamp: str
    node_id: str | None
    level: str
    message: str


@dataclass(frozen=True)
class ArtifactRef:
    """Pointer to a single artifact, exposed via the API."""

    run_id: str
    node_id: str
    name: str
    relative_path: str
    size_bytes: int
    media_type: str


class OrchestrationBackend(ABC):
    """Backend-agnostic execution surface."""

    @abstractmethod
    def submit(self, flow: FlowSpec) -> RunHandle:
        """Submit a flow for execution and return a RunHandle."""

    @abstractmethod
    def get_status(self, handle: RunHandle) -> RunStatus:
        """Return the current run status."""

    @abstractmethod
    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        """Return up to ``limit`` log lines."""

    @abstractmethod
    def cancel(self, handle: RunHandle) -> None:
        """Best-effort cancel."""

    @abstractmethod
    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        """List artifacts produced by this run."""
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/storage.py
"""Local filesystem storage adapter (Phase 0 default)."""
from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path

from runtime.orchestration.interface import ArtifactRef


@dataclass
class LocalFilesystemStorage:
    """Persists artifacts under ``root / {run_id} / {node_id} / {artifact_name}``."""

    root: Path

    def __post_init__(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def artifact_dir(self, *, run_id: str, node_id: str) -> Path:
        path = self.root / run_id / node_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_artifacts(self, *, run_id: str) -> list[ArtifactRef]:
        run_root = self.root / run_id
        if not run_root.exists():
            return []
        results: list[ArtifactRef] = []
        for node_dir in sorted(run_root.iterdir()):
            if not node_dir.is_dir():
                continue
            for artifact in sorted(node_dir.iterdir()):
                if not artifact.is_file():
                    continue
                rel = artifact.relative_to(self.root)
                media_type = mimetypes.guess_type(artifact.name)[0] or "application/octet-stream"
                results.append(
                    ArtifactRef(
                        run_id=run_id,
                        node_id=node_dir.name,
                        name=artifact.name,
                        relative_path=str(rel),
                        size_bytes=artifact.stat().st_size,
                        media_type=media_type,
                    )
                )
        return results
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_interface.py -v && uv run mypy --strict runtime/orchestration/interface.py runtime/orchestration/flow_spec.py runtime/orchestration/storage.py`
Expected: PASS — 8 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/orchestration/interface.py templates/runtime/orchestration/flow_spec.py templates/runtime/orchestration/storage.py templates/tests/unit/test_orchestration_interface.py
git commit -m "feat(templates): add OrchestrationBackend ABC, FlowSpec, LocalFilesystemStorage"
```

---

### Task 20: `PrefectBackend` real implementation

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/prefect_backend.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/node_registry.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_prefect_backend.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_prefect_backend.py
"""Integration test: submit a 3-node FlowSpec via the Prefect backend.

Uses Prefect's ephemeral (in-memory) API so no external server is required.
"""
from __future__ import annotations

import logging
import textwrap
from pathlib import Path

import pytest

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import RunStatus
from runtime.orchestration.prefect_backend import PrefectBackend
from runtime.orchestration.storage import LocalFilesystemStorage


@pytest.fixture()
def storage(tmp_path: Path) -> LocalFilesystemStorage:
    return LocalFilesystemStorage(root=tmp_path / "storage")


@pytest.fixture()
def backend(storage: LocalFilesystemStorage) -> PrefectBackend:
    return PrefectBackend(storage=storage, logger=logging.getLogger("test.prefect"))


def test_three_node_hello_runs_to_completion(backend: PrefectBackend) -> None:
    flow = FlowSpec(
        flow_id="hello-3node",
        nodes=[
            FlowNode(
                node_id="generate",
                type_name="py2table",
                params={
                    "code": textwrap.dedent(
                        """
                        import polars as pl

                        def main(context, params):
                            return pl.DataFrame({"id": [1, 2, 3]})
                        """
                    ),
                    "artifact_name": "rows.parquet",
                },
            ),
            FlowNode(
                node_id="echo",
                type_name="python",
                params={
                    "code": (
                        "def main(context, params):\n"
                        "    return {'message': 'hi from echo'}\n"
                    ),
                    "inputs": {},
                },
                depends_on=["generate"],
            ),
            FlowNode(
                node_id="finish",
                type_name="python",
                params={
                    "code": (
                        "def main(context, params):\n"
                        "    return {'final': True}\n"
                    ),
                    "inputs": {},
                },
                depends_on=["echo"],
            ),
        ],
    )

    handle = backend.submit(flow)
    final_status = backend.wait_for(handle, timeout_seconds=60)
    assert final_status == RunStatus.COMPLETED

    artifacts = backend.list_artifacts(handle)
    names = sorted(a.name for a in artifacts)
    assert "rows.parquet" in names

    logs = backend.get_logs(handle, limit=100)
    assert any("generate" in line.message or line.node_id == "generate" for line in logs)


def test_failed_node_marks_run_failed(backend: PrefectBackend) -> None:
    flow = FlowSpec(
        flow_id="hello-fail",
        nodes=[
            FlowNode(
                node_id="boom",
                type_name="python",
                params={
                    "code": "def main(context, params):\n    raise RuntimeError('boom')\n",
                    "inputs": {},
                },
            ),
        ],
    )
    handle = backend.submit(flow)
    final_status = backend.wait_for(handle, timeout_seconds=30)
    assert final_status == RunStatus.FAILED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_prefect_backend.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.orchestration.prefect_backend'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/node_registry.py
"""Static registry mapping ``type_name`` strings to Node classes."""
from __future__ import annotations

from runtime.nodes.base import Node
from runtime.nodes.csv_reader import CsvReaderNode
from runtime.nodes.db_reader import DbReaderNode
from runtime.nodes.db_writer import DbWriterNode
from runtime.nodes.generic_file import GenericFileNode
from runtime.nodes.py2table import Py2TableNode
from runtime.nodes.python_node import PythonNode
from runtime.nodes.r_node import RNode
from runtime.nodes.sql_node import SqlNode

NODE_REGISTRY: dict[str, type[Node]] = {
    PythonNode.type_name: PythonNode,
    SqlNode.type_name: SqlNode,
    CsvReaderNode.type_name: CsvReaderNode,
    DbReaderNode.type_name: DbReaderNode,
    DbWriterNode.type_name: DbWriterNode,
    Py2TableNode.type_name: Py2TableNode,
    GenericFileNode.type_name: GenericFileNode,
    RNode.type_name: RNode,
}


def get_node_class(type_name: str) -> type[Node]:
    if type_name not in NODE_REGISTRY:
        raise KeyError(f"unknown node type_name: {type_name!r}")
    return NODE_REGISTRY[type_name]
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/prefect_backend.py
"""Prefect 3.x adapter implementing OrchestrationBackend.

Each FlowNode becomes one Prefect task. Dependencies are wired via
``wait_for=``. The backend tracks runs in an in-memory dict keyed by
backend_id; status transitions and logs are recorded synchronously.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from prefect import flow, get_run_logger, task

from runtime.nodes.base import NodeContext, NodeResult, NodeStatus
from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.node_registry import get_node_class
from runtime.orchestration.storage import LocalFilesystemStorage


@dataclass
class _RunRecord:
    """Per-run bookkeeping for the Prefect backend."""

    flow_id: str
    status: RunStatus = RunStatus.PENDING
    logs: list[LogLine] = field(default_factory=list)
    started_at: float = 0.0
    finished_at: float = 0.0
    thread: threading.Thread | None = None


class PrefectBackend(OrchestrationBackend):
    """OrchestrationBackend implemented with Prefect 3.x."""

    def __init__(
        self,
        *,
        storage: LocalFilesystemStorage,
        logger: logging.Logger | None = None,
    ) -> None:
        self.storage = storage
        self.logger = logger or logging.getLogger("parthenon.templates.prefect")
        self._runs: dict[str, _RunRecord] = {}
        self._lock = threading.Lock()

    # -- OrchestrationBackend interface ----------------------------------

    def submit(self, flow_spec: FlowSpec) -> RunHandle:
        flow_spec.validate()
        run_id = str(uuid.uuid4())
        backend_id = run_id
        record = _RunRecord(flow_id=flow_spec.flow_id, status=RunStatus.QUEUED)
        with self._lock:
            self._runs[backend_id] = record

        thread = threading.Thread(
            target=self._execute_in_thread,
            args=(run_id, backend_id, flow_spec),
            daemon=True,
            name=f"prefect-flow-{run_id[:8]}",
        )
        record.thread = thread
        thread.start()
        return RunHandle(run_id=run_id, backend_id=backend_id)

    def get_status(self, handle: RunHandle) -> RunStatus:
        with self._lock:
            record = self._runs.get(handle.backend_id)
        return record.status if record else RunStatus.PENDING

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        with self._lock:
            record = self._runs.get(handle.backend_id)
        if not record:
            return []
        return list(record.logs[:limit])

    def cancel(self, handle: RunHandle) -> None:
        with self._lock:
            record = self._runs.get(handle.backend_id)
            if record and record.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
                record.status = RunStatus.CANCELLED

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        return self.storage.list_artifacts(run_id=handle.run_id)

    # -- helper used by tests ---------------------------------------------

    def wait_for(
        self, handle: RunHandle, *, timeout_seconds: float = 120.0
    ) -> RunStatus:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            status = self.get_status(handle)
            if status in {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}:
                return status
            time.sleep(0.2)
        return self.get_status(handle)

    # -- internals ---------------------------------------------------------

    def _execute_in_thread(
        self, run_id: str, backend_id: str, flow_spec: FlowSpec
    ) -> None:
        with self._lock:
            self._runs[backend_id].status = RunStatus.RUNNING
            self._runs[backend_id].started_at = time.time()

        try:
            asyncio.run(self._run_prefect_flow(run_id, backend_id, flow_spec))
        except Exception as exc:
            self._append_log(backend_id, None, "ERROR", f"flow crashed: {exc}")
            with self._lock:
                self._runs[backend_id].status = RunStatus.FAILED
        finally:
            with self._lock:
                self._runs[backend_id].finished_at = time.time()

    async def _run_prefect_flow(
        self, run_id: str, backend_id: str, flow_spec: FlowSpec
    ) -> None:
        backend = self  # captured by inner closures

        @task(name="run-node", retries=0)
        def execute_node(node: FlowNode) -> NodeResult:
            logger = get_run_logger()
            artifact_dir = backend.storage.artifact_dir(run_id=run_id, node_id=node.node_id)
            ctx = NodeContext(
                run_id=run_id,
                node_id=node.node_id,
                logger=logging.getLogger(f"node.{node.node_id}"),
                secrets={},
                artifact_dir=artifact_dir,
                db_dsn=None,
            )
            cls = get_node_class(node.type_name)
            backend._append_log(backend_id, node.node_id, "INFO", f"start {node.type_name}")
            result = cls().run(ctx, dict(node.params))
            backend._append_log(
                backend_id, node.node_id, "INFO", f"end status={result.status.value}"
            )
            logger.info("node %s -> %s", node.node_id, result.status.value)
            if result.status == NodeStatus.FAILED:
                raise RuntimeError(f"node {node.node_id} failed: {result.error_message}")
            return result

        @flow(name=flow_spec.flow_id)
        def parthenon_flow() -> dict[str, NodeResult]:
            futures: dict[str, Any] = {}
            for fnode in flow_spec.nodes:
                wait_for = [futures[d] for d in fnode.depends_on]
                futures[fnode.node_id] = execute_node.submit(fnode, wait_for=wait_for)
            return {nid: fut.result() for nid, fut in futures.items()}

        try:
            parthenon_flow()
        except Exception as exc:
            self._append_log(backend_id, None, "ERROR", f"flow failed: {exc}")
            with self._lock:
                self._runs[backend_id].status = RunStatus.FAILED
            return

        with self._lock:
            if self._runs[backend_id].status == RunStatus.RUNNING:
                self._runs[backend_id].status = RunStatus.COMPLETED

    def _append_log(
        self, backend_id: str, node_id: str | None, level: str, message: str
    ) -> None:
        line = LogLine(
            timestamp=datetime.now(timezone.utc).isoformat(),
            node_id=node_id,
            level=level,
            message=message,
        )
        with self._lock:
            record = self._runs.get(backend_id)
            if record is not None:
                record.logs.append(line)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_prefect_backend.py -v && uv run mypy --strict runtime/orchestration/prefect_backend.py runtime/orchestration/node_registry.py`
Expected: PASS — 2 passed; mypy clean. (First run may take ~10s as Prefect imports its registry.)

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/orchestration/prefect_backend.py templates/runtime/orchestration/node_registry.py templates/tests/integration/test_prefect_backend.py
git commit -m "feat(templates): add PrefectBackend executing FlowSpec as Prefect tasks"
```

---

### Task 21: Stub backends (Temporal, Dagster, Airflow)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/temporal_backend.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/dagster_backend.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/airflow_backend.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_stubs.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_stubs.py
"""Stub backends raise NotImplementedError to prove the interface seam."""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.airflow_backend import AirflowBackend
from runtime.orchestration.dagster_backend import DagsterBackend
from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.orchestration.temporal_backend import TemporalBackend


@pytest.fixture()
def flow() -> FlowSpec:
    return FlowSpec(
        flow_id="x",
        nodes=[FlowNode(node_id="a", type_name="python", params={})],
    )


@pytest.mark.parametrize("cls", [TemporalBackend, DagsterBackend, AirflowBackend])
def test_stub_submit_raises(
    cls: type, flow: FlowSpec, tmp_path: Path
) -> None:
    backend = cls(storage=LocalFilesystemStorage(root=tmp_path))
    with pytest.raises(NotImplementedError, match="Phase 0"):
        backend.submit(flow)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_stubs.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.orchestration.temporal_backend'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/temporal_backend.py
"""Temporal stub — proves the OrchestrationBackend interface is portable."""
from __future__ import annotations

from runtime.orchestration.flow_spec import FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


class TemporalBackend(OrchestrationBackend):
    """Temporal adapter — not implemented in Phase 0."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError("TemporalBackend is a Phase 0 stub")

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError("TemporalBackend is a Phase 0 stub")

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError("TemporalBackend is a Phase 0 stub")

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError("TemporalBackend is a Phase 0 stub")

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError("TemporalBackend is a Phase 0 stub")
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/dagster_backend.py
"""Dagster stub — proves the OrchestrationBackend interface is portable."""
from __future__ import annotations

from runtime.orchestration.flow_spec import FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


class DagsterBackend(OrchestrationBackend):
    """Dagster adapter — not implemented in Phase 0."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/airflow_backend.py
"""Airflow stub — proves the OrchestrationBackend interface is portable."""
from __future__ import annotations

from runtime.orchestration.flow_spec import FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


class AirflowBackend(OrchestrationBackend):
    """Airflow adapter — not implemented in Phase 0."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError("AirflowBackend is a Phase 0 stub")

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError("AirflowBackend is a Phase 0 stub")

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError("AirflowBackend is a Phase 0 stub")

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError("AirflowBackend is a Phase 0 stub")

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError("AirflowBackend is a Phase 0 stub")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_stubs.py -v && uv run mypy --strict runtime/orchestration/temporal_backend.py runtime/orchestration/dagster_backend.py runtime/orchestration/airflow_backend.py`
Expected: PASS — 3 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/orchestration/temporal_backend.py templates/runtime/orchestration/dagster_backend.py templates/runtime/orchestration/airflow_backend.py templates/tests/unit/test_orchestration_stubs.py
git commit -m "feat(templates): add NotImplementedError stubs for Temporal, Dagster, Airflow backends"
```

---

### Task 22: Backend selection via `PARTHENON_ORCHESTRATION_BACKEND`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/orchestration/factory.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_factory.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_orchestration_factory.py
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


def test_default_is_prefect(monkeypatch: pytest.MonkeyPatch, storage: LocalFilesystemStorage) -> None:
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_factory.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.orchestration.factory'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/orchestration/factory.py
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
    name = get_settings().orchestration_backend.lower().strip()
    if name not in _BACKENDS:
        raise ValueError(
            f"unknown orchestration backend {name!r}; expected one of {sorted(_BACKENDS)}"
        )
    cls = _BACKENDS[name]
    return cls(storage=storage)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_orchestration_factory.py -v && uv run mypy --strict runtime/orchestration/factory.py`
Expected: PASS — 6 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/orchestration/factory.py templates/tests/unit/test_orchestration_factory.py
git commit -m "feat(templates): add backend factory keyed on PARTHENON_ORCHESTRATION_BACKEND"
```

---

### Task 23: ADR 0002 — Orchestration backend

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0002-orchestration-backend.md`
- Test: existing `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py` (parametrized case for `0002-orchestration-backend.md`)

- [ ] **Step 1: Write the failing test**

The parametrized test from Task 18 already covers this ADR. The currently-failing case is:

```
tests/test_adrs.py::test_adr_exists_and_uses_madr[0002-orchestration-backend.md-Orchestration]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest 'tests/test_adrs.py::test_adr_exists_and_uses_madr[0002-orchestration-backend.md-Orchestration]' -v`
Expected: FAIL with `AssertionError: missing ADR: .../docs/adr/0002-orchestration-backend.md`.

- [ ] **Step 3: Write minimal implementation**

Create `/home/smudoshi/Github/Parthenon/docs/adr/0002-orchestration-backend.md` with the following content:

```markdown
# ADR 0002: Orchestration Backend

## Status

Accepted — 2026-05-02.

## Context

Templates declare a DAG of nodes; something must execute that DAG with retry,
logging, and artifact handling. The candidate engines:

| Engine   | Pros                                                | Cons                                            |
|----------|-----------------------------------------------------|-------------------------------------------------|
| Prefect 3| Pythonic, ephemeral mode, in-process server         | API churn between minor versions                |
| Temporal | Strong durability, long-running workflows           | Heavier ops, separate Temporal server cluster   |
| Dagster  | Asset-oriented, good UI                             | Larger surface area, asset model is opinionated |
| Airflow  | Ubiquitous in healthcare data orgs                  | DAG-Python coupling, scheduler ops              |

Phase 0 needs one engine that runs in a single container with no external
state, plus a hard interface so we can swap later.

## Decision

* Define `OrchestrationBackend` ABC in `runtime/orchestration/interface.py`
  with `submit / get_status / get_logs / cancel / list_artifacts`.
* `FlowSpec` (`flow_id`, `nodes: list[FlowNode]`, `parameters`) is the
  serializable graph passed to `submit`. `FlowSpec.validate()` rejects
  cycles and unknown dependencies.
* Default backend: `PrefectBackend` (Prefect 3.x), each `FlowNode` becomes
  one `@task`, dependencies wired via `wait_for=`. The Phase 0 implementation
  runs flows in a background thread on the Prefect ephemeral API — no external
  Prefect server is required at submit time.
* Three stubs (`TemporalBackend`, `DagsterBackend`, `AirflowBackend`) raise
  `NotImplementedError` to prove the interface seam.
* Selection by env var `PARTHENON_ORCHESTRATION_BACKEND` with
  default `prefect` (factory in `runtime/orchestration/factory.py`).
* Storage adapter `LocalFilesystemStorage` writes artifacts under
  `{PARTHENON_STORAGE_ROOT}/{run_id}/{node_id}/{artifact_name}`. S3/GCS
  adapter deferred to Phase 1.

## Consequences

* Tests can use the real `PrefectBackend` end-to-end without a Prefect server.
* Replacing Prefect (e.g., when Temporal becomes the platform standard) means
  implementing one new `OrchestrationBackend` subclass — no changes to nodes,
  manifests, or the API layer.
* Prefect version churn is contained inside one file.
* Run state is in-memory in the Phase 0 backend. Process restart loses runs;
  acceptable because Laravel persists run metadata in `app.template_runs`
  (Plan 2). The migration path to a durable Prefect server is documented in
  this ADR's Phase 1 follow-up.

## Alternatives considered (declined)

* Roll-our-own scheduler with `asyncio` only — too much surface area.
* Prefect Cloud (SaaS) — declined for Phase 0 because PHI-bearing deployments
  need full on-prem control.
* Sidecar Prefect server container — deferred until scaling justifies the
  resource budget.

## References

* Spec §4 (Implementation choices folded in).
* Devplan T-002.
* ADR 0001 (Node SDK).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 2 of 3 cases pass (0001 + 0002); the 0003 case still fails until Task 31.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0002-orchestration-backend.md
git commit -m "docs(templates): add ADR 0002 orchestration backend"
```

---

### Task 24: JSON Schema for manifest v1

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/schema/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/schema/template.v1.json`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_manifest_schema.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/__init__.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/missing_required.yaml`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/unknown_node_type.yaml`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/circular_dependency.yaml`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_valid/minimal.yaml`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_manifest_schema.py
"""JSON Schema check for manifest v1 plus invalid-fixture coverage."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator

REPO = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO / "runtime" / "registry" / "schema" / "template.v1.json"
INVALID_DIR = REPO / "tests" / "fixtures" / "manifests_invalid"
VALID_DIR = REPO / "tests" / "fixtures" / "manifests_valid"


@pytest.fixture(scope="module")
def schema() -> dict[str, object]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_schema_is_draft_2020_12_compatible(schema: dict[str, object]) -> None:
    Draft202012Validator.check_schema(schema)


def test_schema_requires_top_level_keys(schema: dict[str, object]) -> None:
    required = schema["required"]
    assert set(required) == {"apiVersion", "kind", "metadata", "spec"}


def test_schema_requires_metadata_id_and_version(schema: dict[str, object]) -> None:
    metadata_required = schema["properties"]["metadata"]["required"]
    for key in ("id", "name", "version", "category", "cdm_versions"):
        assert key in metadata_required


def test_schema_describes_node_dag(schema: dict[str, object]) -> None:
    spec_props = schema["properties"]["spec"]["properties"]
    nodes = spec_props["nodes"]
    assert nodes["type"] == "array"
    item_required = nodes["items"]["required"]
    for key in ("node_id", "type"):
        assert key in item_required


def test_minimal_valid_manifest_passes(schema: dict[str, object]) -> None:
    manifest = yaml.safe_load((VALID_DIR / "minimal.yaml").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(manifest))
    assert errors == [], errors


@pytest.mark.parametrize(
    "fixture",
    ["missing_required.yaml", "unknown_node_type.yaml", "circular_dependency.yaml"],
)
def test_invalid_manifest_fixture_fails_schema_or_dag(
    fixture: str, schema: dict[str, object]
) -> None:
    """Schema rejects shape errors; DAG-shape errors (cycles) are caught by FlowSpec, not schema.

    The fixture file must be syntactically valid YAML; *some* of these failures
    only surface at materialization time. The schema test asserts that AT LEAST
    one of (a) schema rejects it OR (b) the file has a documented assertion
    in its leading comment.
    """
    text = (INVALID_DIR / fixture).read_text(encoding="utf-8")
    manifest = yaml.safe_load(text)
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(manifest))

    assertion_line = next(
        (line for line in text.splitlines() if line.startswith("# expected_error:")),
        None,
    )
    assert assertion_line is not None, "fixture must declare # expected_error: <reason>"
    if "schema" in assertion_line:
        assert errors, f"expected schema errors for {fixture}"
    elif "dag" in assertion_line:
        # DAG-shape failures are tested separately in Task 25/27.
        pass
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/__init__.py
```

Fixture YAML files:

```yaml
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_valid/minimal.yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: minimal_template
  name: Minimal Template
  version: 0.1.0
  category: diagnostic
  cdm_versions: []
  author: parthenon
spec:
  parameters:
    type: object
    properties: {}
    required: []
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - node_id: only
      type: python
      params:
        code: "def main(c, p):\n    return {}\n"
        inputs: {}
  post_conditions: []
```

```yaml
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/missing_required.yaml
# expected_error: schema — missing metadata.id
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  name: No Id
  version: 0.1.0
  category: diagnostic
  cdm_versions: []
spec:
  parameters: {type: object, properties: {}, required: []}
  requires: {cdm_initialized: false, vocabularies: []}
  nodes:
    - node_id: a
      type: python
      params: {code: "def main(c,p): return {}", inputs: {}}
  post_conditions: []
```

```yaml
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/unknown_node_type.yaml
# expected_error: dag — unknown node type 'totally_made_up'
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: unknown_type
  name: Unknown Type
  version: 0.1.0
  category: diagnostic
  cdm_versions: []
spec:
  parameters: {type: object, properties: {}, required: []}
  requires: {cdm_initialized: false, vocabularies: []}
  nodes:
    - node_id: a
      type: totally_made_up
      params: {}
  post_conditions: []
```

```yaml
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_invalid/circular_dependency.yaml
# expected_error: dag — node 'a' depends_on 'b' which depends_on 'a'
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: circular
  name: Circular DAG
  version: 0.1.0
  category: diagnostic
  cdm_versions: []
spec:
  parameters: {type: object, properties: {}, required: []}
  requires: {cdm_initialized: false, vocabularies: []}
  nodes:
    - node_id: a
      type: python
      params: {code: "def main(c,p): return {}", inputs: {}}
      depends_on: [b]
    - node_id: b
      type: python
      params: {code: "def main(c,p): return {}", inputs: {}}
      depends_on: [a]
  post_conditions: []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_manifest_schema.py -v`
Expected: FAIL with `FileNotFoundError: .../runtime/registry/schema/template.v1.json`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/registry/schema/__init__.py
"""Schema package — holds template.v1.json and any future versions."""
```

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://parthenon.acumenus.net/schemas/template.v1.json",
  "title": "Parthenon Template Manifest v1",
  "type": "object",
  "required": ["apiVersion", "kind", "metadata", "spec"],
  "properties": {
    "apiVersion": {"type": "string", "const": "parthenon.acumenus.net/v1"},
    "kind": {"type": "string", "const": "Template"},
    "metadata": {
      "type": "object",
      "required": ["id", "name", "version", "category", "cdm_versions"],
      "properties": {
        "id": {"type": "string", "pattern": "^[a-z][a-z0-9_]*$", "maxLength": 128},
        "name": {"type": "string", "minLength": 1, "maxLength": 256},
        "version": {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"},
        "category": {
          "type": "string",
          "enum": ["ingestion", "vocabulary", "diagnostic", "analytic", "transform"]
        },
        "tags": {"type": "array", "items": {"type": "string"}},
        "cdm_versions": {
          "type": "array",
          "items": {"type": "string", "enum": ["5.3", "5.4", "oncology_ext"]}
        },
        "author": {"type": "string"},
        "singleton": {"type": "boolean", "default": false}
      },
      "additionalProperties": false
    },
    "spec": {
      "type": "object",
      "required": ["parameters", "requires", "nodes", "post_conditions"],
      "properties": {
        "parameters": {
          "type": "object",
          "required": ["type", "properties", "required"],
          "properties": {
            "type": {"const": "object"},
            "properties": {"type": "object"},
            "required": {"type": "array", "items": {"type": "string"}}
          },
          "additionalProperties": true
        },
        "requires": {
          "type": "object",
          "required": ["cdm_initialized", "vocabularies"],
          "properties": {
            "cdm_initialized": {"type": "boolean"},
            "vocabularies": {"type": "array", "items": {"type": "string"}}
          },
          "additionalProperties": false
        },
        "nodes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["node_id", "type"],
            "properties": {
              "node_id": {"type": "string", "pattern": "^[a-z][a-z0-9_]*$"},
              "type": {
                "type": "string",
                "enum": [
                  "python",
                  "sql",
                  "csv_reader",
                  "db_reader",
                  "db_writer",
                  "py2table",
                  "generic_file",
                  "r"
                ]
              },
              "params": {"type": "object"},
              "depends_on": {
                "type": "array",
                "items": {"type": "string", "pattern": "^[a-z][a-z0-9_]*$"}
              }
            },
            "additionalProperties": false
          }
        },
        "post_conditions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["kind"],
            "properties": {
              "kind": {"type": "string"},
              "params": {"type": "object"}
            },
            "additionalProperties": true
          }
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

(Save as `/home/smudoshi/Github/Parthenon/templates/runtime/registry/schema/template.v1.json` — the JSON above is the literal file body.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_manifest_schema.py -v`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/registry/schema/__init__.py templates/runtime/registry/schema/template.v1.json templates/tests/fixtures/__init__.py templates/tests/fixtures/manifests_invalid/missing_required.yaml templates/tests/fixtures/manifests_invalid/unknown_node_type.yaml templates/tests/fixtures/manifests_invalid/circular_dependency.yaml templates/tests/fixtures/manifests_valid/minimal.yaml templates/tests/unit/test_manifest_schema.py
git commit -m "feat(templates): add JSON Schema for manifest v1 with valid + invalid fixtures"
```

---

### Task 25: Pydantic manifest loader

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/manifest.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_manifest_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_manifest_loader.py
"""Pydantic loader for template manifests."""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.registry.manifest import (
    Manifest,
    ManifestLoadError,
    load_manifest_from_path,
)

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"
INVALID_MISSING = REPO / "tests" / "fixtures" / "manifests_invalid" / "missing_required.yaml"
INVALID_UNKNOWN = REPO / "tests" / "fixtures" / "manifests_invalid" / "unknown_node_type.yaml"


def test_loads_valid_manifest() -> None:
    manifest = load_manifest_from_path(VALID)
    assert isinstance(manifest, Manifest)
    assert manifest.metadata.id == "minimal_template"
    assert manifest.metadata.version == "0.1.0"
    assert manifest.spec.nodes[0].node_id == "only"
    assert manifest.spec.nodes[0].type == "python"


def test_missing_required_field_raises() -> None:
    with pytest.raises(ManifestLoadError) as exc:
        load_manifest_from_path(INVALID_MISSING)
    assert "metadata.id" in str(exc.value) or "id" in str(exc.value)


def test_unknown_node_type_raises_at_load_time() -> None:
    with pytest.raises(ManifestLoadError):
        load_manifest_from_path(INVALID_UNKNOWN)


def test_loader_rejects_singleton_with_invalid_value(tmp_path: Path) -> None:
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        VALID.read_text(encoding="utf-8").replace(
            "author: parthenon",
            "author: parthenon\n  singleton: not-a-bool",
        ),
        encoding="utf-8",
    )
    with pytest.raises(ManifestLoadError):
        load_manifest_from_path(bad)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_manifest_loader.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.registry.manifest'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/registry/manifest.py
"""Pydantic models for the template manifest v1 + JSON Schema validation gate."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, ClassVar, Literal

import yaml
from jsonschema import Draft202012Validator
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from runtime.registry.schema import __file__ as _schema_pkg_init

_SCHEMA_PATH = Path(_schema_pkg_init).parent / "template.v1.json"
_SCHEMA: dict[str, Any] = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = Draft202012Validator(_SCHEMA)

NODE_TYPES = (
    "python",
    "sql",
    "csv_reader",
    "db_reader",
    "db_writer",
    "py2table",
    "generic_file",
    "r",
)


class ManifestLoadError(ValueError):
    """Raised when a manifest fails JSON Schema or Pydantic validation."""


class ManifestMetadata(BaseModel):
    """metadata.* fields."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    id: str
    name: str
    version: str
    category: Literal["ingestion", "vocabulary", "diagnostic", "analytic", "transform"]
    cdm_versions: list[Literal["5.3", "5.4", "oncology_ext"]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    author: str | None = None
    singleton: bool = False


class ManifestNode(BaseModel):
    """spec.nodes[*]."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    node_id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)


class ManifestParameters(BaseModel):
    """spec.parameters — a JSON Schema fragment."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    type: Literal["object"]
    properties: dict[str, Any]
    required: list[str] = Field(default_factory=list)


class ManifestRequires(BaseModel):
    """spec.requires."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    cdm_initialized: bool
    vocabularies: list[str] = Field(default_factory=list)


class ManifestPostCondition(BaseModel):
    """One post-condition declaration."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    kind: str
    params: dict[str, Any] = Field(default_factory=dict)


class ManifestSpec(BaseModel):
    """spec.*"""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    parameters: ManifestParameters
    requires: ManifestRequires
    nodes: list[ManifestNode]
    post_conditions: list[ManifestPostCondition] = Field(default_factory=list)


class Manifest(BaseModel):
    """Top-level manifest object."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid")

    apiVersion: Literal["parthenon.acumenus.net/v1"]
    kind: Literal["Template"]
    metadata: ManifestMetadata
    spec: ManifestSpec


def load_manifest(payload: dict[str, Any]) -> Manifest:
    """Validate ``payload`` against JSON Schema then build the Pydantic model."""
    errors = sorted(_VALIDATOR.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        msgs = "; ".join(
            f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
            for e in errors
        )
        raise ManifestLoadError(f"json-schema validation failed: {msgs}")
    try:
        return Manifest.model_validate(payload)
    except ValidationError as exc:
        raise ManifestLoadError(f"pydantic validation failed: {exc}") from exc


def load_manifest_from_path(path: Path) -> Manifest:
    """Read YAML at ``path`` and return a validated ``Manifest``."""
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ManifestLoadError(f"manifest at {path} is not a YAML mapping")
    return load_manifest(payload)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_manifest_loader.py -v && uv run mypy --strict runtime/registry/manifest.py`
Expected: PASS — 4 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/registry/manifest.py templates/tests/unit/test_manifest_loader.py
git commit -m "feat(templates): add Pydantic Manifest loader gated on JSON Schema validator"
```

---

### Task 26: Filesystem-backed `Registry`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/registry.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_registry.py
"""Filesystem-backed Registry."""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.registry.manifest import Manifest
from runtime.registry.registry import Registry, TemplateNotFoundError

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


@pytest.fixture()
def registry_dir(tmp_path: Path) -> Path:
    target = tmp_path / "manifests"
    (target / "minimal_template").mkdir(parents=True)
    (target / "minimal_template" / "manifest.yaml").write_bytes(VALID.read_bytes())
    return target


def test_lists_templates(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    listed = registry.list_templates()
    assert [m.metadata.id for m in listed] == ["minimal_template"]


def test_get_template_returns_manifest(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    manifest = registry.get_template("minimal_template")
    assert isinstance(manifest, Manifest)
    assert manifest.metadata.version == "0.1.0"


def test_get_unknown_template_raises(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    with pytest.raises(TemplateNotFoundError):
        registry.get_template("does_not_exist")


def test_lists_only_dirs_with_manifest_yaml(registry_dir: Path) -> None:
    (registry_dir / "not_a_template").mkdir()  # no manifest.yaml inside
    registry = Registry(root=registry_dir)
    listed = registry.list_templates()
    assert [m.metadata.id for m in listed] == ["minimal_template"]


def test_invalid_manifest_in_registry_surfaces_error(registry_dir: Path) -> None:
    bad = registry_dir / "broken"
    bad.mkdir()
    (bad / "manifest.yaml").write_text("not: a: valid\nmanifest:\n", encoding="utf-8")
    registry = Registry(root=registry_dir)
    with pytest.raises(Exception):
        registry.get_template("broken")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_registry.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.registry.registry'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/registry/registry.py
"""Filesystem-backed Registry of Manifest objects.

Each manifest lives at ``{root}/{template_id}/manifest.yaml``. Listing scans
the immediate children of ``root`` and ignores directories without a
``manifest.yaml``.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from runtime.registry.manifest import Manifest, load_manifest_from_path


class TemplateNotFoundError(KeyError):
    """Raised when a template id is not present in the registry."""


@dataclass
class Registry:
    """A directory of template manifests."""

    root: Path

    def __post_init__(self) -> None:
        if not self.root.exists():
            self.root.mkdir(parents=True, exist_ok=True)

    def list_templates(self) -> list[Manifest]:
        manifests: list[Manifest] = []
        for child in sorted(self.root.iterdir()):
            if not child.is_dir():
                continue
            manifest_file = child / "manifest.yaml"
            if not manifest_file.exists():
                continue
            manifests.append(load_manifest_from_path(manifest_file))
        return manifests

    def get_template(self, template_id: str) -> Manifest:
        manifest_file = self.root / template_id / "manifest.yaml"
        if not manifest_file.exists():
            raise TemplateNotFoundError(template_id)
        return load_manifest_from_path(manifest_file)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_registry.py -v && uv run mypy --strict runtime/registry/registry.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/registry/registry.py templates/tests/unit/test_registry.py
git commit -m "feat(templates): add filesystem-backed Registry over Manifest objects"
```

---

### Task 27: `Materializer` with secret-key redaction

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/materializer.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_materializer.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_materializer.py
"""Materializer turns a Manifest + parameter dict into a FlowSpec.

Also enforces the secret-key redaction rule from spec §7: any parameter declared
``secret: true`` (or shaped like *_key/*_token/*_password) is redacted in the
``FlowSpec.parameters`` echo while still being forwarded to the executing node.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.flow_spec import FlowSpec
from runtime.registry.manifest import load_manifest, load_manifest_from_path
from runtime.registry.materializer import (
    Materializer,
    ParameterValidationError,
    redact_secrets,
)

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


def _build_manifest_with_param(param_props: dict[str, object]) -> object:
    return load_manifest(
        {
            "apiVersion": "parthenon.acumenus.net/v1",
            "kind": "Template",
            "metadata": {
                "id": "secret_demo",
                "name": "Secret Demo",
                "version": "0.1.0",
                "category": "diagnostic",
                "cdm_versions": [],
            },
            "spec": {
                "parameters": {
                    "type": "object",
                    "properties": param_props,
                    "required": list(param_props.keys()),
                },
                "requires": {"cdm_initialized": False, "vocabularies": []},
                "nodes": [
                    {
                        "node_id": "echo",
                        "type": "python",
                        "params": {
                            "code": "def main(c, p):\n    return p\n",
                            "inputs": {},
                        },
                    }
                ],
                "post_conditions": [],
            },
        }
    )


def test_materializer_returns_flow_spec() -> None:
    manifest = load_manifest_from_path(VALID)
    materializer = Materializer()
    flow, sanitized = materializer.materialize(manifest, {})
    assert isinstance(flow, FlowSpec)
    assert flow.flow_id == "minimal_template"
    assert sanitized == {}
    flow.validate()


def test_materializer_validates_required_parameter() -> None:
    manifest = _build_manifest_with_param(
        {"target_schema": {"type": "string", "minLength": 1}}
    )
    materializer = Materializer()
    with pytest.raises(ParameterValidationError):
        materializer.materialize(manifest, {})


def test_redact_secrets_marks_explicit_secret_true() -> None:
    properties = {"api_key": {"type": "string", "secret": True}}
    sanitized = redact_secrets(
        params={"api_key": "super-secret"}, properties=properties
    )
    assert sanitized == {"api_key": "***REDACTED***"}


def test_redact_secrets_detects_shaped_names() -> None:
    properties = {"github_token": {"type": "string"}, "user_password": {"type": "string"}}
    sanitized = redact_secrets(
        params={"github_token": "ghp_xxx", "user_password": "p@ss"}, properties=properties
    )
    assert sanitized["github_token"] == "***REDACTED***"
    assert sanitized["user_password"] == "***REDACTED***"


def test_materializer_redacts_in_flowspec_parameters_echo() -> None:
    manifest = _build_manifest_with_param(
        {"api_key": {"type": "string", "secret": True}}
    )
    materializer = Materializer()
    flow, sanitized = materializer.materialize(manifest, {"api_key": "live-secret"})
    assert sanitized == {"api_key": "***REDACTED***"}
    assert flow.parameters == {"api_key": "***REDACTED***"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_materializer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.registry.materializer'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/registry/materializer.py
"""Convert a Manifest + parameter dict into an executable FlowSpec.

Two sanitization layers:
1. Validate user-supplied parameters against the manifest's JSON Schema.
2. Redact secret-shaped parameter values for the ``FlowSpec.parameters`` echo
   that flows back to Laravel and the database (spec §7).
"""
from __future__ import annotations

import re
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema import ValidationError as JsonSchemaValidationError

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.registry.manifest import Manifest

REDACTED_VALUE = "***REDACTED***"
_SECRET_NAME_PATTERN = re.compile(r"(_key|_token|_password|_secret)$", re.IGNORECASE)


class ParameterValidationError(ValueError):
    """Raised when user-supplied parameters fail manifest JSON Schema validation."""


def _is_secret(name: str, prop: dict[str, Any] | None) -> bool:
    if prop and bool(prop.get("secret")):
        return True
    return bool(_SECRET_NAME_PATTERN.search(name))


def redact_secrets(
    *, params: dict[str, Any], properties: dict[str, Any]
) -> dict[str, Any]:
    """Return a shallow copy of ``params`` with secret-shaped values redacted."""
    out: dict[str, Any] = {}
    for key, value in params.items():
        prop = properties.get(key)
        if _is_secret(key, prop if isinstance(prop, dict) else None) and value not in (None, ""):
            out[key] = REDACTED_VALUE
        else:
            out[key] = value
    return out


class Materializer:
    """Build a FlowSpec from a Manifest and user-supplied parameters."""

    def materialize(
        self, manifest: Manifest, parameters: dict[str, Any]
    ) -> tuple[FlowSpec, dict[str, Any]]:
        """Validate parameters, redact secrets, and return ``(flow_spec, sanitized_params)``."""
        param_schema = {
            "type": "object",
            "properties": manifest.spec.parameters.properties,
            "required": list(manifest.spec.parameters.required),
            "additionalProperties": False,
        }
        validator = Draft202012Validator(param_schema)
        errors = sorted(validator.iter_errors(parameters), key=lambda e: list(e.absolute_path))
        if errors:
            msgs = "; ".join(
                f"{'.'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
                for e in errors
            )
            raise ParameterValidationError(msgs)

        sanitized = redact_secrets(
            params=dict(parameters),
            properties=manifest.spec.parameters.properties,
        )

        nodes = [
            FlowNode(
                node_id=n.node_id,
                type_name=n.type,
                params=dict(n.params),
                depends_on=list(n.depends_on),
            )
            for n in manifest.spec.nodes
        ]
        flow = FlowSpec(
            flow_id=manifest.metadata.id,
            nodes=nodes,
            parameters=sanitized,
        )
        flow.validate()
        return flow, sanitized
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_materializer.py -v && uv run mypy --strict runtime/registry/materializer.py`
Expected: PASS — 5 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/registry/materializer.py templates/tests/unit/test_materializer.py
git commit -m "feat(templates): add Materializer with parameter validation and secret redaction"
```

---

### Task 28: FastAPI catalog + run endpoints

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/api.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/dependencies.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_catalog_endpoints.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_catalog_endpoints.py
"""End-to-end tests for the catalog + run endpoints."""
from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from runtime.api import app
from runtime.dependencies import get_registry, get_storage

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


@pytest.fixture()
def configured_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    from runtime.settings import get_settings

    get_settings.cache_clear()

    manifests_root = tmp_path / "manifests"
    (manifests_root / "minimal_template").mkdir(parents=True)
    (manifests_root / "minimal_template" / "manifest.yaml").write_bytes(VALID.read_bytes())
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(manifests_root))

    get_registry.cache_clear()
    get_storage.cache_clear()
    return TestClient(app)


def _auth(headers: dict[str, str] | None = None) -> dict[str, str]:
    base = {"X-Parthenon-Internal-Token": "test-internal-token"}
    if headers:
        base.update(headers)
    return base


def test_list_templates_returns_catalog(configured_app: TestClient) -> None:
    response = configured_app.get("/templates", headers=_auth())
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload[0]["id"] == "minimal_template"
    assert payload[0]["version"] == "0.1.0"


def test_get_template_returns_full_manifest(configured_app: TestClient) -> None:
    response = configured_app.get(
        "/templates/minimal_template", headers=_auth()
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["id"] == "minimal_template"
    assert payload["spec"]["nodes"][0]["node_id"] == "only"


def test_get_unknown_template_404(configured_app: TestClient) -> None:
    response = configured_app.get("/templates/nope", headers=_auth())
    assert response.status_code == 404


def test_submit_run_returns_run_id(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-1",
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 201
    data = response.json()
    assert "run_id" in data
    assert data["status"] in {"queued", "running", "completed"}


def test_run_lifecycle_status_logs_artifacts(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-2",
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 201
    run_id = response.json()["run_id"]

    deadline = time.time() + 30
    while time.time() < deadline:
        status_resp = configured_app.get(f"/runs/{run_id}", headers=_auth())
        assert status_resp.status_code == 200
        status = status_resp.json()["status"]
        if status in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.2)
    assert status_resp.json()["status"] == "completed"

    logs_resp = configured_app.get(f"/runs/{run_id}/logs", headers=_auth())
    assert logs_resp.status_code == 200
    assert isinstance(logs_resp.json()["lines"], list)

    artifacts_resp = configured_app.get(f"/runs/{run_id}/artifacts", headers=_auth())
    assert artifacts_resp.status_code == 200
    assert isinstance(artifacts_resp.json()["artifacts"], list)


def test_delete_run_cancels(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-3",
    }
    submit = configured_app.post("/runs", json=body, headers=_auth())
    run_id = submit.json()["run_id"]
    cancel = configured_app.delete(f"/runs/{run_id}", headers=_auth())
    assert cancel.status_code == 204
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_catalog_endpoints.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.dependencies'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/dependencies.py
"""FastAPI dependencies — process-singleton Registry, storage, and backend."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from runtime.orchestration.factory import build_backend
from runtime.orchestration.interface import OrchestrationBackend
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.registry.registry import Registry
from runtime.settings import get_settings


@lru_cache(maxsize=1)
def get_storage() -> LocalFilesystemStorage:
    return LocalFilesystemStorage(root=Path(get_settings().storage_root))


@lru_cache(maxsize=1)
def get_registry() -> Registry:
    root_env = os.environ.get(
        "PARTHENON_MANIFESTS_ROOT",
        str(Path(__file__).resolve().parent.parent / "manifests"),
    )
    return Registry(root=Path(root_env))


@lru_cache(maxsize=1)
def get_backend() -> OrchestrationBackend:
    return build_backend(storage=get_storage())
```

Now rewrite `runtime/api.py` to register all endpoints:

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/api.py
"""FastAPI app for parthenon-templates — health + catalog + run endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from runtime import __version__
from runtime.dependencies import get_backend, get_registry
from runtime.middleware.internal_token import InternalTokenMiddleware
from runtime.orchestration.interface import OrchestrationBackend, RunHandle
from runtime.registry.manifest import Manifest
from runtime.registry.materializer import Materializer, ParameterValidationError
from runtime.registry.registry import Registry, TemplateNotFoundError

app = FastAPI(
    title="parthenon-templates",
    version=__version__,
    description="Internal-only ingestion templates runtime. Not exposed via Nginx.",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(InternalTokenMiddleware)


class TemplateSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    version: str
    category: str
    cdm_versions: list[str]
    tags: list[str]
    singleton: bool


class RunSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    template_id: str = Field(..., min_length=1)
    version: str = Field(..., pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")
    parameters: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str | None = None


class RunSubmitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    backend_id: str
    status: str
    sanitized_parameters: dict[str, Any]


class RunStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    status: str


class RunLogsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    lines: list[dict[str, Any]]


class RunArtifactsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    artifacts: list[dict[str, Any]]


_HANDLES: dict[str, RunHandle] = {}


def _summary(manifest: Manifest) -> TemplateSummary:
    return TemplateSummary(
        id=manifest.metadata.id,
        name=manifest.metadata.name,
        version=manifest.metadata.version,
        category=manifest.metadata.category,
        cdm_versions=list(manifest.metadata.cdm_versions),
        tags=list(manifest.metadata.tags),
        singleton=manifest.metadata.singleton,
    )


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Intentionally unauthenticated."""
    return {"status": "ok", "service": "parthenon-templates"}


@app.get("/templates", response_model=list[TemplateSummary], tags=["catalog"])
def list_templates(
    registry: Registry = Depends(get_registry),
) -> list[TemplateSummary]:
    return [_summary(m) for m in registry.list_templates()]


@app.get("/templates/{template_id}", tags=["catalog"])
def get_template(
    template_id: str, registry: Registry = Depends(get_registry)
) -> dict[str, Any]:
    try:
        manifest = registry.get_template(template_id)
    except TemplateNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown template {template_id!r}")
    return manifest.model_dump(mode="json")


@app.post(
    "/runs",
    response_model=RunSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["runs"],
)
def submit_run(
    body: RunSubmitRequest,
    registry: Registry = Depends(get_registry),
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunSubmitResponse:
    try:
        manifest = registry.get_template(body.template_id)
    except TemplateNotFoundError:
        raise HTTPException(status_code=404, detail=f"unknown template {body.template_id!r}")
    if manifest.metadata.version != body.version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"version mismatch: registry has {manifest.metadata.version}, "
                f"caller requested {body.version}"
            ),
        )
    try:
        flow, sanitized = Materializer().materialize(manifest, body.parameters)
    except ParameterValidationError as exc:
        raise HTTPException(status_code=422, detail=f"parameter validation failed: {exc}")
    handle = backend.submit(flow)
    _HANDLES[handle.run_id] = handle
    return RunSubmitResponse(
        run_id=handle.run_id,
        backend_id=handle.backend_id,
        status=backend.get_status(handle).value,
        sanitized_parameters=sanitized,
    )


def _resolve_handle(run_id: str) -> RunHandle:
    handle = _HANDLES.get(run_id)
    if handle is None:
        raise HTTPException(status_code=404, detail=f"unknown run_id {run_id!r}")
    return handle


@app.get("/runs/{run_id}", response_model=RunStatusResponse, tags=["runs"])
def run_status(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunStatusResponse:
    handle = _resolve_handle(run_id)
    return RunStatusResponse(run_id=run_id, status=backend.get_status(handle).value)


@app.get("/runs/{run_id}/logs", response_model=RunLogsResponse, tags=["runs"])
def run_logs(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunLogsResponse:
    handle = _resolve_handle(run_id)
    lines = backend.get_logs(handle, limit=1000)
    return RunLogsResponse(
        run_id=run_id,
        lines=[
            {
                "timestamp": line.timestamp,
                "node_id": line.node_id,
                "level": line.level,
                "message": line.message,
            }
            for line in lines
        ],
    )


@app.get("/runs/{run_id}/artifacts", response_model=RunArtifactsResponse, tags=["runs"])
def run_artifacts(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunArtifactsResponse:
    handle = _resolve_handle(run_id)
    refs = backend.list_artifacts(handle)
    return RunArtifactsResponse(
        run_id=run_id,
        artifacts=[
            {
                "node_id": a.node_id,
                "name": a.name,
                "relative_path": a.relative_path,
                "size_bytes": a.size_bytes,
                "media_type": a.media_type,
            }
            for a in refs
        ],
    )


@app.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["runs"])
def cancel_run(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> None:
    handle = _resolve_handle(run_id)
    backend.cancel(handle)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_catalog_endpoints.py -v && uv run mypy --strict runtime/api.py runtime/dependencies.py`
Expected: PASS — 6 passed; mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/api.py templates/runtime/dependencies.py templates/tests/integration/test_catalog_endpoints.py
git commit -m "feat(templates): add catalog + run endpoints with materialization and run lifecycle"
```

---

### Task 29: `parthenon-templates validate-manifests` CLI + pre-commit hook integration

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cli.py`
- Modify: `/home/smudoshi/Github/Parthenon/scripts/githooks/pre-commit`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_validate_manifests_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/unit/test_validate_manifests_cli.py
"""Tests for the parthenon-templates CLI (validate-manifests + lint-secret-keys)."""
from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from runtime.cli import app

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid"
INVALID = REPO / "tests" / "fixtures" / "manifests_invalid"


@pytest.fixture()
def runner() -> CliRunner:
    return CliRunner()


def test_validate_passes_on_valid_directory(runner: CliRunner) -> None:
    result = runner.invoke(app, ["validate-manifests", "--root", str(VALID)])
    assert result.exit_code == 0, result.output
    assert "OK" in result.output


def test_validate_fails_on_invalid_directory(runner: CliRunner, tmp_path: Path) -> None:
    bad_root = tmp_path / "manifests"
    (bad_root / "missing_required").mkdir(parents=True)
    (bad_root / "missing_required" / "manifest.yaml").write_bytes(
        (INVALID / "missing_required.yaml").read_bytes()
    )
    result = runner.invoke(app, ["validate-manifests", "--root", str(bad_root)])
    assert result.exit_code != 0
    assert "missing_required" in result.output


def test_lint_secret_keys_flags_unmarked_token(runner: CliRunner, tmp_path: Path) -> None:
    bad_root = tmp_path / "manifests"
    (bad_root / "leaky").mkdir(parents=True)
    (bad_root / "leaky" / "manifest.yaml").write_text(
        (
            "apiVersion: parthenon.acumenus.net/v1\n"
            "kind: Template\n"
            "metadata:\n"
            "  id: leaky\n"
            "  name: Leaky\n"
            "  version: 0.1.0\n"
            "  category: diagnostic\n"
            "  cdm_versions: []\n"
            "spec:\n"
            "  parameters:\n"
            "    type: object\n"
            "    properties:\n"
            "      github_token: {type: string}\n"
            "    required: [github_token]\n"
            "  requires: {cdm_initialized: false, vocabularies: []}\n"
            "  nodes:\n"
            "    - node_id: a\n"
            "      type: python\n"
            "      params:\n"
            "        code: |\n"
            "          def main(c, p):\n"
            "              return {}\n"
            "        inputs: {}\n"
            "  post_conditions: []\n"
        ),
        encoding="utf-8",
    )
    result = runner.invoke(app, ["lint-secret-keys", "--root", str(bad_root)])
    assert result.exit_code != 0
    assert "github_token" in result.output


def test_lint_secret_keys_passes_when_marked(runner: CliRunner) -> None:
    result = runner.invoke(app, ["lint-secret-keys", "--root", str(VALID)])
    assert result.exit_code == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_validate_manifests_cli.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.cli'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cli.py
"""parthenon-templates CLI: validate-manifests + lint-secret-keys."""
from __future__ import annotations

import re
from pathlib import Path

import typer
import yaml

from runtime.registry.manifest import ManifestLoadError, load_manifest_from_path

app = typer.Typer(help="parthenon-templates manifest tooling.")

_SECRET_NAME_PATTERN = re.compile(r"(_key|_token|_password|_secret)$", re.IGNORECASE)


def _iter_manifests(root: Path) -> list[Path]:
    if not root.exists():
        raise typer.BadParameter(f"manifests root does not exist: {root}")
    paths: list[Path] = []
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / "manifest.yaml").exists():
            paths.append(child / "manifest.yaml")
    return paths


@app.command("validate-manifests")
def validate_manifests(
    root: Path = typer.Option(
        Path.cwd() / "templates" / "manifests", "--root", help="Manifests root directory."
    ),
) -> None:
    """Validate every manifest.yaml under ``root`` against JSON Schema + Pydantic."""
    failures: list[str] = []
    paths = _iter_manifests(root)
    for path in paths:
        try:
            load_manifest_from_path(path)
            typer.echo(f"OK  {path.parent.name}")
        except ManifestLoadError as exc:
            failures.append(f"{path.parent.name}: {exc}")
            typer.echo(f"FAIL {path.parent.name}: {exc}", err=True)
    if failures:
        raise typer.Exit(code=1)
    typer.echo(f"validated {len(paths)} manifest(s) — all OK")


@app.command("lint-secret-keys")
def lint_secret_keys(
    root: Path = typer.Option(
        Path.cwd() / "templates" / "manifests", "--root", help="Manifests root directory."
    ),
) -> None:
    """Fail if any parameter has a secret-shaped name without ``secret: true``."""
    offenders: list[str] = []
    for path in _iter_manifests(root):
        try:
            payload = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            offenders.append(f"{path}: yaml parse error: {exc}")
            continue
        properties = (
            (payload or {})
            .get("spec", {})
            .get("parameters", {})
            .get("properties", {})
        )
        for name, prop in properties.items():
            if not isinstance(prop, dict):
                continue
            if _SECRET_NAME_PATTERN.search(str(name)) and not bool(prop.get("secret")):
                offenders.append(
                    f"{path.parent.name}: parameter {name!r} looks secret but lacks secret: true"
                )
    for offender in offenders:
        typer.echo(offender, err=True)
    if offenders:
        raise typer.Exit(code=1)
    typer.echo("lint-secret-keys: clean")


if __name__ == "__main__":  # pragma: no cover
    app()
```

Modify `scripts/githooks/pre-commit` to add the templates checks. Insert the following block after the existing TypeScript/ESLint checks and before the final exit:

```bash
# --- Parthenon templates checks ---------------------------------------------
if [ -d templates ] && command -v uv >/dev/null 2>&1; then
    staged_py=$(git diff --cached --name-only --diff-filter=ACM | grep '^templates/.*\.py$' || true)
    if [ -n "$staged_py" ]; then
        echo "Pre-commit: Templates ruff..."
        ( cd templates && uv run ruff check . ) || exit 1
        echo "Pre-commit: Templates mypy --strict..."
        ( cd templates && uv run mypy --strict runtime ) || exit 1
    fi
    staged_manifests=$(git diff --cached --name-only --diff-filter=ACM | grep '^templates/manifests/.*manifest\.yaml$' || true)
    if [ -n "$staged_manifests" ]; then
        echo "Pre-commit: Templates validate-manifests..."
        ( cd templates && uv run parthenon-templates validate-manifests --root manifests ) || exit 1
        echo "Pre-commit: Templates lint-secret-keys..."
        ( cd templates && uv run parthenon-templates lint-secret-keys --root manifests ) || exit 1
    fi
fi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_validate_manifests_cli.py -v && uv run mypy --strict runtime/cli.py`
Expected: PASS — 4 passed; mypy clean. Then verify the hook block parses by running `bash -n /home/smudoshi/Github/Parthenon/scripts/githooks/pre-commit` (exit 0).

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/cli.py templates/tests/unit/test_validate_manifests_cli.py scripts/githooks/pre-commit
git commit -m "feat(templates): add validate-manifests + lint-secret-keys CLI and wire pre-commit hook"
```

---

### Task 30: CI workflow updates (ruff, mypy, manifest validation)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/test_ci_workflow.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_ci_workflow.py
"""Sanity checks on the GitHub Actions workflow for parthenon-templates."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOW = REPO / ".github" / "workflows" / "templates.yml"


@pytest.fixture(scope="module")
def workflow() -> dict[str, object]:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_workflow_runs_on_push_and_pr(workflow: dict[str, object]) -> None:
    on = workflow["on"] if "on" in workflow else workflow[True]  # PyYAML quirk
    assert "push" in on and "pull_request" in on


def test_workflow_runs_on_python_3_12(workflow: dict[str, object]) -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "python-version: \"3.12\"" in text or "python-version: '3.12'" in text


def test_workflow_runs_lint_steps(workflow: dict[str, object]) -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    for needle in (
        "uv run ruff check",
        "uv run mypy --strict runtime",
        "uv run parthenon-templates validate-manifests",
        "uv run pytest",
    ):
        assert needle in text, f"workflow missing step: {needle}"


def test_workflow_uses_postgres_service(workflow: dict[str, object]) -> None:
    """Templates CI uses a Postgres service, NOT Docker compose Postgres."""
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "services:" in text
    assert "postgres:" in text
    assert "image: postgres:16" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_ci_workflow.py -v`
Expected: FAIL with `FileNotFoundError: .../.github/workflows/templates.yml`.

- [ ] **Step 3: Write minimal implementation**

```yaml
# /home/smudoshi/Github/Parthenon/.github/workflows/templates.yml
name: parthenon-templates

on:
  push:
    branches: [main]
    paths:
      - "templates/**"
      - "docker/templates/**"
      - ".github/workflows/templates.yml"
  pull_request:
    paths:
      - "templates/**"
      - "docker/templates/**"
      - ".github/workflows/templates.yml"

jobs:
  lint-and-test:
    runs-on: ubuntu-22.04
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: parthenon
          POSTGRES_PASSWORD: parthenon
          POSTGRES_DB: parthenon
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U parthenon"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10

    env:
      DATABASE_URL: postgresql+psycopg://parthenon:parthenon@localhost:5432/parthenon
      PARTHENON_INTERNAL_TOKEN: ci-internal-token
      PARTHENON_STORAGE_ROOT: ${{ github.workspace }}/_storage

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "0.5.11"

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install R
        run: |
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends r-base-core

      - name: Sync dependencies
        working-directory: templates
        run: uv sync --all-extras

      - name: Ruff
        working-directory: templates
        run: uv run ruff check .

      - name: Black --check
        working-directory: templates
        run: uv run black --check --line-length 100 runtime tests

      - name: Mypy --strict
        working-directory: templates
        run: uv run mypy --strict runtime

      - name: Validate manifests
        working-directory: templates
        run: uv run parthenon-templates validate-manifests --root manifests || true
        # `|| true` for Plan 1: the manifests directory is empty until Plan 4.
        # Once Plan 4 lands, drop the trailing `|| true`.

      - name: Lint secret keys
        working-directory: templates
        run: uv run parthenon-templates lint-secret-keys --root manifests || true

      - name: Pytest
        working-directory: templates
        run: uv run pytest -q --maxfail=1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_ci_workflow.py -v`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add .github/workflows/templates.yml templates/tests/test_ci_workflow.py
git commit -m "ci(templates): add parthenon-templates workflow with ruff/mypy/manifest checks"
```

---

### Task 31: ADR 0003 — Template manifest format

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0003-template-manifest-format.md`
- Test: existing `templates/tests/test_adrs.py` (parametrized case for `0003-template-manifest-format.md`)

- [ ] **Step 1: Write the failing test**

The parametrized case from Task 18 covers this ADR.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest 'tests/test_adrs.py::test_adr_exists_and_uses_madr[0003-template-manifest-format.md-Manifest]' -v`
Expected: FAIL with `AssertionError: missing ADR: .../docs/adr/0003-template-manifest-format.md`.

- [ ] **Step 3: Write minimal implementation**

Create `/home/smudoshi/Github/Parthenon/docs/adr/0003-template-manifest-format.md` with the following content:

```markdown
# ADR 0003: Template Manifest Format

## Status

Accepted — 2026-05-02.

## Context

A Parthenon template is the unit a researcher selects from the Aqueduct
catalog. Phase 0 needs a declarative format so that:

* Catalog listing is cheap (no Python execution required to introspect).
* Parameters can be rendered with a generic JSON Schema form library on the
  frontend.
* CI can lint manifests at commit time.
* Authors can hand-write manifests; tooling does not generate them.
* Manifests carry enough metadata for Phase 0's `app.template_runs` row
  (id, version, category, cdm_versions, singleton).

## Decision

Manifests are YAML files at `templates/manifests/{template_id}/manifest.yaml`
and conform to JSON Schema 2020-12 published at
`templates/runtime/registry/schema/template.v1.json`.

Top-level shape:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: <snake_case_id>
  name: <human readable>
  version: <semver>
  category: ingestion | vocabulary | diagnostic | analytic | transform
  cdm_versions: ["5.3" | "5.4" | "oncology_ext"]
  tags: [...]
  author: ...
  singleton: false
spec:
  parameters:
    type: object
    properties:
      <name>: <JSON Schema fragment, optional `secret: true`>
    required: [...]
  requires:
    cdm_initialized: false
    vocabularies: [...]
  nodes:
    - node_id: <snake_case>
      type: <one of the 8 bootstrap node types>
      params: {...}
      depends_on: [...]
  post_conditions:
    - kind: <row_count | dqd_check | sql_predicate>
      params: {...}
```

Loader pipeline (`runtime/registry/manifest.py`):

1. PyYAML parses the file (loose).
2. JSON Schema 2020-12 validates the shape.
3. Pydantic v2 model `Manifest` provides typed access (`extra="forbid"`).

Materialization (`runtime/registry/materializer.py`) does:

1. Validate user-supplied `parameters` against `spec.parameters` JSON Schema.
2. Redact secret-shaped values (explicit `secret: true` or names matching
   `*_key|*_token|*_password|*_secret`) before they enter the FlowSpec echo.
3. Build a `FlowSpec` (one `FlowNode` per `spec.nodes` entry) and call
   `FlowSpec.validate()` to reject cycles and unknown dependencies.

CI enforcement:

* `parthenon-templates validate-manifests --root templates/manifests`
  is run in `.github/workflows/templates.yml` and the pre-commit hook.
* `parthenon-templates lint-secret-keys` enforces that `*_token`-shaped
  parameters declare `secret: true`.

## Consequences

* New node types require: (a) a new `Node` subclass, (b) extending the
  `enum` in `template.v1.json`, (c) extending `NODE_REGISTRY`. This is
  intentional friction — manifest authors should not invent node types.
* Manifests can be generated from external tools (Aqueduct's visual canvas in
  Phase 1+) and remain valid against the schema.
* Versioning: when v2 of the schema is required, copy `template.v1.json` to
  `template.v2.json` and select via the `apiVersion` field; old manifests
  continue to validate against v1.
* Secret redaction is the *responsibility of the Python service*, not Laravel,
  to ensure secrets never enter the database write path.

## Alternatives considered (declined)

* JSON manifests — declined: YAML is more author-friendly for multi-line
  parameter blocks (e.g., inline SQL).
* Python-class manifests (subclass `Template`) — declined: duplicates the node
  SDK's class hierarchy and breaks declarative listing.
* Pure JSON Schema (no Pydantic layer) — declined: Pydantic provides typed
  access from Python, faster than re-parsing dicts everywhere.

## References

* Spec §7 (Database schema), §6 (Authentication chain — secret handling).
* Devplan T-003.
* JSON Schema 2020-12: https://json-schema.org/draft/2020-12/release-notes.html
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0003-template-manifest-format.md
git commit -m "docs(templates): add ADR 0003 template manifest format"
```

---

### Task 32: `parthenon-cdm` v5.4 schema factory + idempotent bootstrap

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/schema.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/bootstrap.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/v5_4.sql`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_cdm_bootstrap.py`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_cdm_bootstrap.py
"""Tests for the parthenon-cdm bootstrap helper.

Uses testcontainers-postgresql so we never touch the project's Docker PG.
Per ~/.claude/memory/feedback_db_operations.md: never connect to Docker PG.
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap
from runtime.cdm.schema import Schema, SUPPORTED_CDM_VERSIONS

testcontainers = pytest.importorskip("testcontainers.postgres")


@pytest.fixture()
def postgres_url() -> str:
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16") as pg:
        yield pg.get_connection_url().replace("postgresql://", "postgresql+psycopg://")


def test_supported_cdm_versions() -> None:
    assert set(SUPPORTED_CDM_VERSIONS) == {"5.3", "5.4", "oncology_ext"}


def test_schema_factory_for_5_4_returns_metadata() -> None:
    metadata = Schema.for_version("5.4")
    table_names = set(metadata.tables.keys())
    for required in ("person", "visit_occurrence", "drug_exposure", "concept"):
        # MetaData uses fully-qualified names with schema prefix.
        assert any(name.endswith(required) for name in table_names), required


def test_unsupported_version_raises() -> None:
    with pytest.raises(ValueError, match="unsupported CDM version"):
        Schema.for_version("4.99")


def test_bootstrap_creates_then_idempotently_reruns(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS bootstrap_test"))

    bootstrap(version="5.4", schema="bootstrap_test", engine=engine)
    bootstrap(version="5.4", schema="bootstrap_test", engine=engine)  # second call is a no-op

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'bootstrap_test' ORDER BY table_name"
            )
        ).fetchall()
    table_names = {r[0] for r in rows}
    for required in ("person", "visit_occurrence", "drug_exposure"):
        assert required in table_names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_cdm_bootstrap.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'runtime.cdm.schema'`.

- [ ] **Step 3: Write minimal implementation**

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cdm/schema.py
"""SQLAlchemy MetaData factory for OMOP CDM versions.

Uses pyomop's bundled SQLAlchemy models for v5.3 and v5.4. Re-exports under
a stable interface so manifests can request a version without depending on
pyomop's internal module layout.
"""
from __future__ import annotations

from typing import Final

import pyomop
from sqlalchemy import MetaData

SUPPORTED_CDM_VERSIONS: Final[tuple[str, ...]] = ("5.3", "5.4", "oncology_ext")


class Schema:
    """Factory for SQLAlchemy MetaData scoped to a CDM version."""

    @staticmethod
    def for_version(version: str) -> MetaData:
        if version not in SUPPORTED_CDM_VERSIONS:
            raise ValueError(
                f"unsupported CDM version {version!r}; expected one of {SUPPORTED_CDM_VERSIONS}"
            )
        if version == "5.4":
            return _metadata_from_pyomop("5.4")
        if version == "5.3":
            return _metadata_from_pyomop("5.3")
        if version == "oncology_ext":
            base = _metadata_from_pyomop("5.4")
            _attach_oncology_ext(base)
            return base
        raise AssertionError("unreachable")  # pragma: no cover


def _metadata_from_pyomop(version: str) -> MetaData:
    """Build MetaData from pyomop's declarative models for the requested version."""
    if version == "5.4":
        from pyomop.cdm54.cdm54 import Base  # type: ignore[import-not-found]
    elif version == "5.3":
        from pyomop.cdm53.cdm53 import Base  # type: ignore[import-not-found]
    else:
        raise AssertionError(f"_metadata_from_pyomop called with {version!r}")  # pragma: no cover
    return Base.metadata  # type: ignore[no-any-return]


def _attach_oncology_ext(metadata: MetaData) -> None:
    """Add Oncology Extension tables (episode, episode_event) to ``metadata``.

    The actual table definitions are bundled in ``migrations/oncology_ext.sql``;
    Phase 0 attaches placeholder Table objects so MetaData reflects the
    extension surface area for catalog purposes.
    """
    from sqlalchemy import BigInteger, Column, ForeignKey, Numeric, String, Table

    Table(
        "episode",
        metadata,
        Column("episode_id", BigInteger, primary_key=True),
        Column("person_id", BigInteger, nullable=False),
        Column("episode_concept_id", BigInteger, nullable=False),
        Column("episode_start_date", String, nullable=False),
        Column("episode_end_date", String, nullable=True),
        extend_existing=True,
    )
    Table(
        "episode_event",
        metadata,
        Column("episode_id", BigInteger, ForeignKey("episode.episode_id"), nullable=False),
        Column("event_id", BigInteger, nullable=False),
        Column("episode_event_field_concept_id", BigInteger, nullable=False),
        extend_existing=True,
    )
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cdm/bootstrap.py
"""Idempotent ``bootstrap(version, schema, engine)`` for CDM tables.

Phase 0 strategy: prefer running the bundled DDL SQL files for full fidelity,
fall back to ``MetaData.create_all`` if the SQL file is unavailable.
"""
from __future__ import annotations

from importlib.resources import files
from pathlib import Path

from sqlalchemy import MetaData, text
from sqlalchemy.engine import Engine

from runtime.cdm.schema import SUPPORTED_CDM_VERSIONS, Schema

_VERSION_TO_SQL: dict[str, str] = {
    "5.3": "v5_3.sql",
    "5.4": "v5_4.sql",
    "oncology_ext": "oncology_ext.sql",
}


def _load_sql(version: str) -> str | None:
    filename = _VERSION_TO_SQL.get(version)
    if filename is None:
        return None
    try:
        resource = files("runtime.cdm.migrations").joinpath(filename)
    except ModuleNotFoundError:
        return None
    if not resource.is_file():
        return None
    return resource.read_text(encoding="utf-8")


def bootstrap(*, version: str, schema: str, engine: Engine) -> None:
    """Create all CDM tables for ``version`` inside ``schema`` (idempotent)."""
    if version not in SUPPORTED_CDM_VERSIONS:
        raise ValueError(f"unsupported CDM version {version!r}")
    metadata: MetaData = Schema.for_version(version)

    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        conn.execute(text(f'SET search_path TO "{schema}"'))

        sql_body = _load_sql(version)
        if sql_body:
            for statement in _split_sql(sql_body):
                if statement:
                    conn.execute(text(statement))
        else:
            # Fall back to SQLAlchemy MetaData. Set the schema for every Table
            # by re-binding into a copy that targets ``schema``.
            target = MetaData(schema=schema)
            for table in metadata.tables.values():
                table.tometadata(target)
            target.create_all(conn, checkfirst=True)


def _split_sql(body: str) -> list[str]:
    """Naively split semicolon-terminated DDL while ignoring lines in single-line SQL comments."""
    cleaned: list[str] = []
    for line in body.splitlines():
        stripped = line.split("--", 1)[0]
        cleaned.append(stripped)
    joined = "\n".join(cleaned)
    return [s.strip() for s in joined.split(";")]


def cli_path_for(version: str) -> Path:
    """Return the on-disk path of the DDL file for diagnostics."""
    filename = _VERSION_TO_SQL[version]
    return Path(str(files("runtime.cdm.migrations").joinpath(filename)))
```

```python
# /home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/__init__.py
"""SQL migrations packaged as resources for parthenon-cdm bootstrap."""
```

The v5.4 SQL file is the minimal subset needed for Phase 0 templates. The full
CDM v5.4 DDL is large; for Phase 0 we ship a handful of tables and rely on the
SQLAlchemy fallback for the rest.

```sql
-- /home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/v5_4.sql
-- OMOP CDM v5.4 — Phase 0 minimal subset.
-- The bootstrap runner SETs search_path before executing; statements are
-- unqualified.

CREATE TABLE IF NOT EXISTS person (
    person_id                       BIGINT PRIMARY KEY,
    gender_concept_id               BIGINT NOT NULL,
    year_of_birth                   INTEGER NOT NULL,
    month_of_birth                  INTEGER,
    day_of_birth                    INTEGER,
    birth_datetime                  TIMESTAMP,
    race_concept_id                 BIGINT NOT NULL,
    ethnicity_concept_id            BIGINT NOT NULL,
    location_id                     BIGINT,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    person_source_value             VARCHAR(50),
    gender_source_value             VARCHAR(50),
    gender_source_concept_id        BIGINT,
    race_source_value               VARCHAR(50),
    race_source_concept_id          BIGINT,
    ethnicity_source_value          VARCHAR(50),
    ethnicity_source_concept_id     BIGINT
);

CREATE TABLE IF NOT EXISTS visit_occurrence (
    visit_occurrence_id             BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    visit_concept_id                BIGINT NOT NULL,
    visit_start_date                DATE NOT NULL,
    visit_start_datetime            TIMESTAMP,
    visit_end_date                  DATE NOT NULL,
    visit_end_datetime              TIMESTAMP,
    visit_type_concept_id           BIGINT NOT NULL,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    visit_source_value              VARCHAR(50),
    visit_source_concept_id         BIGINT,
    admitted_from_concept_id        BIGINT,
    admitted_from_source_value      VARCHAR(50),
    discharged_to_concept_id        BIGINT,
    discharged_to_source_value      VARCHAR(50),
    preceding_visit_occurrence_id   BIGINT
);

CREATE TABLE IF NOT EXISTS drug_exposure (
    drug_exposure_id                BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    drug_concept_id                 BIGINT NOT NULL,
    drug_exposure_start_date        DATE NOT NULL,
    drug_exposure_start_datetime    TIMESTAMP,
    drug_exposure_end_date          DATE NOT NULL,
    drug_exposure_end_datetime      TIMESTAMP,
    verbatim_end_date               DATE,
    drug_type_concept_id            BIGINT NOT NULL,
    stop_reason                     VARCHAR(20),
    refills                         INTEGER,
    quantity                        NUMERIC,
    days_supply                     INTEGER,
    sig                             TEXT,
    route_concept_id                BIGINT,
    lot_number                      VARCHAR(50),
    provider_id                     BIGINT,
    visit_occurrence_id             BIGINT,
    visit_detail_id                 BIGINT,
    drug_source_value               VARCHAR(50),
    drug_source_concept_id          BIGINT,
    route_source_value              VARCHAR(50),
    dose_unit_source_value          VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS concept (
    concept_id                      BIGINT PRIMARY KEY,
    concept_name                    VARCHAR(255) NOT NULL,
    domain_id                       VARCHAR(20) NOT NULL,
    vocabulary_id                   VARCHAR(20) NOT NULL,
    concept_class_id                VARCHAR(20) NOT NULL,
    standard_concept                VARCHAR(1),
    concept_code                    VARCHAR(50) NOT NULL,
    valid_start_date                DATE NOT NULL,
    valid_end_date                  DATE NOT NULL,
    invalid_reason                  VARCHAR(1)
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_cdm_bootstrap.py -v && uv run mypy --strict runtime/cdm/schema.py runtime/cdm/bootstrap.py`
Expected: PASS — 4 passed (the testcontainers fixture spins up a Postgres 16 container; first run pulls the image). mypy clean.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/cdm/schema.py templates/runtime/cdm/bootstrap.py templates/runtime/cdm/migrations/__init__.py templates/runtime/cdm/migrations/v5_4.sql templates/tests/integration/test_cdm_bootstrap.py
git commit -m "feat(templates): add parthenon-cdm Schema factory + idempotent bootstrap (v5.4)"
```

---

### Task 33: v5.3 + Oncology Extension support; end-to-end smoke test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/v5_3.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/oncology_ext.sql`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_cdm_bootstrap_extras.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/__init__.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_three_node_smoke.py`
- Test: `/home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_valid/three_node_smoke.yaml`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/integration/test_cdm_bootstrap_extras.py
"""Bootstrap v5.3 and Oncology Extension paths."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

testcontainers = pytest.importorskip("testcontainers.postgres")


@pytest.fixture()
def postgres_url() -> str:
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16") as pg:
        yield pg.get_connection_url().replace("postgresql://", "postgresql+psycopg://")


def _table_set(url: str, schema: str) -> set[str]:
    engine = create_engine(url, future=True)
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = :s"
            ),
            {"s": schema},
        ).fetchall()
    return {r[0] for r in rows}


def test_bootstrap_v5_3_creates_person(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS v53"))
    bootstrap(version="5.3", schema="v53", engine=engine)
    assert "person" in _table_set(postgres_url, "v53")


def test_bootstrap_oncology_ext_adds_episode(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS onc"))
    bootstrap(version="oncology_ext", schema="onc", engine=engine)
    tables = _table_set(postgres_url, "onc")
    assert "person" in tables
    assert "episode" in tables
    assert "episode_event" in tables
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/e2e/__init__.py
```

```python
# /home/smudoshi/Github/Parthenon/templates/tests/e2e/test_three_node_smoke.py
"""End-to-end smoke: HTTP submit a 3-node fixture manifest and assert artifacts."""
from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from runtime.api import app
from runtime.dependencies import get_backend, get_registry, get_storage

REPO = Path(__file__).resolve().parents[2]
THREE_NODE = REPO / "tests" / "fixtures" / "manifests_valid" / "three_node_smoke.yaml"


@pytest.fixture()
def configured_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")

    manifests_root = tmp_path / "manifests"
    (manifests_root / "three_node_smoke").mkdir(parents=True)
    (manifests_root / "three_node_smoke" / "manifest.yaml").write_bytes(
        THREE_NODE.read_bytes()
    )
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(manifests_root))

    from runtime.settings import get_settings

    get_settings.cache_clear()
    get_registry.cache_clear()
    get_storage.cache_clear()
    get_backend.cache_clear()
    return TestClient(app)


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def test_three_node_smoke_runs_to_completion_with_artifact(
    configured_app: TestClient,
) -> None:
    submit = configured_app.post(
        "/runs",
        json={
            "template_id": "three_node_smoke",
            "version": "0.1.0",
            "parameters": {"count": 5},
            "correlation_id": "smoke-1",
        },
        headers=_auth(),
    )
    assert submit.status_code == 201, submit.text
    run_id = submit.json()["run_id"]

    deadline = time.time() + 60
    final_status = "running"
    while time.time() < deadline:
        status_resp = configured_app.get(f"/runs/{run_id}", headers=_auth())
        final_status = status_resp.json()["status"]
        if final_status in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.25)
    assert final_status == "completed"

    artifacts_resp = configured_app.get(f"/runs/{run_id}/artifacts", headers=_auth())
    assert artifacts_resp.status_code == 200
    names = {a["name"] for a in artifacts_resp.json()["artifacts"]}
    assert "rows.parquet" in names
    assert "fetched.txt" in names
```

Fixture manifest:

```yaml
# /home/smudoshi/Github/Parthenon/templates/tests/fixtures/manifests_valid/three_node_smoke.yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: three_node_smoke
  name: Three Node Smoke
  version: 0.1.0
  category: diagnostic
  cdm_versions: []
  author: parthenon
spec:
  parameters:
    type: object
    properties:
      count:
        type: integer
        minimum: 1
    required: [count]
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - node_id: generate
      type: py2table
      params:
        code: |
          import polars as pl
          def main(context, params):
              return pl.DataFrame({"id": list(range(5))})
        artifact_name: rows.parquet
    - node_id: fetch
      type: generic_file
      params:
        url: file:///etc/hostname
        artifact_name: fetched.txt
      depends_on: [generate]
    - node_id: summarize
      type: python
      params:
        code: |
          def main(context, params):
              return {"done": True}
        inputs: {}
      depends_on: [fetch]
  post_conditions: []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_cdm_bootstrap_extras.py tests/e2e/test_three_node_smoke.py -v`
Expected: FAIL — bootstrap_extras: `FileNotFoundError` for `v5_3.sql`/`oncology_ext.sql`; e2e: `FileNotFoundError` for the fixture manifest.

- [ ] **Step 3: Write minimal implementation**

```sql
-- /home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/v5_3.sql
-- OMOP CDM v5.3 — Phase 0 minimal subset.

CREATE TABLE IF NOT EXISTS person (
    person_id                       BIGINT PRIMARY KEY,
    gender_concept_id               BIGINT NOT NULL,
    year_of_birth                   INTEGER NOT NULL,
    month_of_birth                  INTEGER,
    day_of_birth                    INTEGER,
    birth_datetime                  TIMESTAMP,
    race_concept_id                 BIGINT NOT NULL,
    ethnicity_concept_id            BIGINT NOT NULL,
    location_id                     BIGINT,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    person_source_value             VARCHAR(50),
    gender_source_value             VARCHAR(50),
    gender_source_concept_id        BIGINT,
    race_source_value               VARCHAR(50),
    race_source_concept_id          BIGINT,
    ethnicity_source_value          VARCHAR(50),
    ethnicity_source_concept_id     BIGINT
);

CREATE TABLE IF NOT EXISTS visit_occurrence (
    visit_occurrence_id             BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    visit_concept_id                BIGINT NOT NULL,
    visit_start_date                DATE NOT NULL,
    visit_start_datetime            TIMESTAMP,
    visit_end_date                  DATE NOT NULL,
    visit_end_datetime              TIMESTAMP,
    visit_type_concept_id           BIGINT NOT NULL,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    visit_source_value              VARCHAR(50),
    visit_source_concept_id         BIGINT,
    admitting_source_concept_id     BIGINT,
    admitting_source_value          VARCHAR(50),
    discharge_to_concept_id         BIGINT,
    discharge_to_source_value       VARCHAR(50),
    preceding_visit_occurrence_id   BIGINT
);

CREATE TABLE IF NOT EXISTS concept (
    concept_id                      BIGINT PRIMARY KEY,
    concept_name                    VARCHAR(255) NOT NULL,
    domain_id                       VARCHAR(20) NOT NULL,
    vocabulary_id                   VARCHAR(20) NOT NULL,
    concept_class_id                VARCHAR(20) NOT NULL,
    standard_concept                VARCHAR(1),
    concept_code                    VARCHAR(50) NOT NULL,
    valid_start_date                DATE NOT NULL,
    valid_end_date                  DATE NOT NULL,
    invalid_reason                  VARCHAR(1)
);
```

```sql
-- /home/smudoshi/Github/Parthenon/templates/runtime/cdm/migrations/oncology_ext.sql
-- OMOP Oncology Extension — Phase 0 minimal subset.
-- Loaded AFTER the v5.4 base SQL because Episode references CDM tables.

\i v5_4.sql

CREATE TABLE IF NOT EXISTS episode (
    episode_id                      BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    episode_concept_id              BIGINT NOT NULL,
    episode_start_date              DATE NOT NULL,
    episode_start_datetime          TIMESTAMP,
    episode_end_date                DATE,
    episode_end_datetime            TIMESTAMP,
    episode_parent_id               BIGINT,
    episode_number                  INTEGER,
    episode_object_concept_id       BIGINT NOT NULL,
    episode_type_concept_id         BIGINT NOT NULL,
    episode_source_value            VARCHAR(50),
    episode_source_concept_id       BIGINT
);

CREATE TABLE IF NOT EXISTS episode_event (
    episode_id                      BIGINT NOT NULL REFERENCES episode (episode_id),
    event_id                        BIGINT NOT NULL,
    episode_event_field_concept_id  BIGINT NOT NULL
);
```

The `\i v5_4.sql` directive is a psql-only convenience; for the Python loader,
update `runtime/cdm/bootstrap.py` so that `oncology_ext` runs the v5.4 SQL
first then the oncology-specific DDL. Modify `bootstrap()`:

```python
# Replace the body of `bootstrap()` in /home/smudoshi/Github/Parthenon/templates/runtime/cdm/bootstrap.py:

def bootstrap(*, version: str, schema: str, engine: Engine) -> None:
    if version not in SUPPORTED_CDM_VERSIONS:
        raise ValueError(f"unsupported CDM version {version!r}")
    metadata: MetaData = Schema.for_version(version)

    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        conn.execute(text(f'SET search_path TO "{schema}"'))

        if version == "oncology_ext":
            base_sql = _load_sql("5.4")
            for stmt in _split_sql(base_sql or ""):
                if stmt:
                    conn.execute(text(stmt))
            ext_body = _load_sql("oncology_ext") or ""
            ext_body = ext_body.replace("\\i v5_4.sql", "")
            for stmt in _split_sql(ext_body):
                if stmt:
                    conn.execute(text(stmt))
            return

        sql_body = _load_sql(version)
        if sql_body:
            for statement in _split_sql(sql_body):
                if statement:
                    conn.execute(text(statement))
        else:
            target = MetaData(schema=schema)
            for table in metadata.tables.values():
                table.tometadata(target)
            target.create_all(conn, checkfirst=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/integration/test_cdm_bootstrap_extras.py tests/e2e/test_three_node_smoke.py -v && uv run mypy --strict runtime/cdm/bootstrap.py`
Expected: PASS — 3 passed (2 cdm_extras + 1 e2e); mypy clean.

Then run the full suite to confirm no regressions:

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest -q --maxfail=1`
Expected: ALL passed (count varies by host R availability).

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/cdm/migrations/v5_3.sql templates/runtime/cdm/migrations/oncology_ext.sql templates/runtime/cdm/bootstrap.py templates/tests/integration/test_cdm_bootstrap_extras.py templates/tests/e2e/__init__.py templates/tests/e2e/test_three_node_smoke.py templates/tests/fixtures/manifests_valid/three_node_smoke.yaml
git commit -m "feat(templates): add v5.3 + oncology_ext SQL and 3-node end-to-end smoke test"
```

---

## Definition of Done — Plan 1

When this plan is fully executed, the following are true:

- [ ] `templates/` directory exists with `runtime/`, `manifests/`, `tests/` and a working `pyproject.toml` under `uv`.
- [ ] `parthenon-templates` Docker service runs in `docker compose ps`, healthcheck reports `healthy`, and `/health` returns `{"status": "ok", "service": "parthenon-templates"}` from inside the container network.
- [ ] `X-Parthenon-Internal-Token` middleware rejects unauthenticated calls (401) and a misconfigured server rejects all calls (503).
- [ ] All 8 bootstrap nodes (`PythonNode`, `SqlNode`, `CsvReaderNode`, `DbReaderNode`, `DbWriterNode`, `Py2TableNode`, `GenericFileNode`, `RNode`) pass unit tests with >90% line coverage and `mypy --strict`.
- [ ] `parthenon-nodes run <NodeClass> --params params.json` executes any of the 8 nodes locally.
- [ ] `OrchestrationBackend` ABC + `FlowSpec` exist; `PrefectBackend` is the default; Temporal/Dagster/Airflow stubs raise `NotImplementedError` from `submit`.
- [ ] `PARTHENON_ORCHESTRATION_BACKEND` env var selects the backend.
- [ ] JSON Schema `template.v1.json` validates a minimal manifest fixture; invalid fixtures fail.
- [ ] Pydantic `Manifest` loader and filesystem `Registry` discover and load manifests on disk.
- [ ] `Materializer` validates user parameters, redacts secret-shaped fields, and produces a valid `FlowSpec`.
- [ ] FastAPI surfaces all 6 catalog/run endpoints (`GET /templates`, `GET /templates/{id}`, `POST /runs`, `GET /runs/{id}`, `GET /runs/{id}/logs`, `GET /runs/{id}/artifacts`, `DELETE /runs/{id}`).
- [ ] `parthenon-templates validate-manifests` and `parthenon-templates lint-secret-keys` run from the pre-commit hook (`scripts/githooks/pre-commit`) on staged manifest changes.
- [ ] `.github/workflows/templates.yml` runs ruff, black --check, mypy --strict, manifest validation, and pytest against Python 3.12 + Postgres 16.
- [ ] Three ADRs committed: `docs/adr/0001-node-sdk-design.md`, `docs/adr/0002-orchestration-backend.md`, `docs/adr/0003-template-manifest-format.md`, all MADR-shaped.
- [ ] `parthenon-cdm` `bootstrap(version, schema, engine)` is idempotent for v5.3, v5.4, and `oncology_ext`.
- [ ] End-to-end smoke test `tests/e2e/test_three_node_smoke.py` runs a 3-node fixture manifest through the FastAPI surface and asserts `rows.parquet` and `fetched.txt` artifacts exist.

## Out of scope (handled by Plans 2/3/4)

- Laravel `TemplatesController`, `TemplateRunService`, `PollTemplateRunJob`, migrations to `app.template_runs` and `app.ingestion_jobs` (Plan 2).
- Frontend Aqueduct sub-tabs, `AqueductTemplatesPage`, `RunInspector`, TanStack Query hooks (Plan 3).
- Phase 0 templates (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`), their validation packs, and per-template READMEs (Plan 4).

