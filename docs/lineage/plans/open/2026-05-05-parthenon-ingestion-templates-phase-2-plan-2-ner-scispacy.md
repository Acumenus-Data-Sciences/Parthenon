# Parthenon Ingestion Templates — Phase 2, Plan 2: NER SciSpaCy Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `SciSpacyBackend` plug-in for the `NlpBackend` Protocol shipped in Plan 1, plus the `parthenon_ner_scispacy` template that drives clinical NER through SciSpaCy in a separate `parthenon-scispacy` sidecar container (decision Q3). After this plan, customers running HIPAA-strict deployments (no cloud LLM, no MedGemma host-model footprint) can run offline deterministic NER. The same 100-note FHIR DocumentReference fixture from Plan 1 is the gating corpus; SciSpaCy must process it in <5 minutes on the reference hardware.

**Architecture:** A new `parthenon-scispacy` sidecar Docker image preloads the SciSpaCy model (`en_core_sci_md` ~110 MB or `en_core_sci_lg` ~750 MB depending on vocab pack size). The sidecar exposes an HTTP `/v1/ner/infer` endpoint matching the contract Plan 1's `parthenon-ai-service` already implements, so the templates runtime can swap backends by container, not by code. `SciSpacyBackend` (in `templates/runtime/nlp/backends/scispacy.py`) implements the `NlpBackend` Protocol from Plan 1 and routes to `http://parthenon-scispacy:5101/v1/ner/infer`. The `NoteNlpNode` selects the backend by `params.backend = "scispacy"` (Plan 1 already defines the dispatch surface; Plan 2 adds the case). Prompt versioning (Q2) is reused — the SciSpaCy backend ignores the prompt body but still records `prompt_version` in `app.note_nlp_audit` for replay parity.

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 + Phase 2 Plan 1 toolchain. New container deps inside `parthenon-scispacy/Dockerfile`: `scispacy==0.5.5`, `spacy==3.7.5`, `en_core_sci_md` (or `lg`) wheel from explosion.ai mirror. The templates runtime depends only on `httpx` (already pinned in Phase 1). No new top-level Python deps in `templates/pyproject.toml`.

**Depends on:** Phase 2 Plan 1 (PR #264, merged) — specifically the `NlpBackend` Protocol, `LlmBackendError` hierarchy, `PromptRegistry`, `NoteNlpNode`, and `app.note_nlp_audit` migration. Phase 1 nodes + Phase 0 SDK unchanged.

**Unblocks:** Phase 2 Plan 3 (Llettuce evaluation harness) — Plan 3's compare-mode runs SciSpaCy alongside the LLM backend on the same fixture and computes per-concept agreement metrics. Without `SciSpacyBackend` available, Plan 3's harness has nothing to compare against.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **Working directory** for all `docker compose` commands is `/home/smudoshi/Github/Parthenon` (repo root, where `docker-compose.yml` lives).
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`).
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Branch model:** sequential commits on the Phase 2 Plan 2 branch (`feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** (stable across all tasks): `SciSpacyBackend`, `SciSpacyBackendError`, `SciSpacyHealthError`.
- **Pinned versions** (validated against PyPI as of 2026-05-05):
  - `scispacy==0.5.5` (sidecar image only)
  - `spacy==3.7.5` (sidecar image only)
  - `en_core_sci_md` model wheel from `https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.5/en_core_sci_md-0.5.5.tar.gz`
  - All template-runtime pins unchanged from Phase 0/1/2-Plan-1.

---

## Task index (12 tasks)

1. `parthenon-scispacy` Dockerfile + docker-compose service entry
2. Sidecar HTTP server (FastAPI inside the sidecar; preloads the model at boot)
3. `SciSpacyBackend` Python client (in templates/runtime/nlp/backends/)
4. `NoteNlpNode` dispatch — register `"scispacy"` backend in `from_config`
5. Sidecar health-gated test fixture (skip integration tests if sidecar unreachable)
6. `parthenon_ner_scispacy` manifest + reuse of the 100-note fixture
7. Validation pack — gold-standard CSV reuse + ≥85% recall assertion (relaxed vs LLM)
8. Sidecar wait-for-healthy CI step + named E2E job in templates.yml
9. Backend equivalence integration test (LLM vs SciSpaCy on a 5-note canary)
10. SciSpaCy-specific PHI leak HIGHSEC regression guard
11. Docs: `templates/manifests/parthenon_ner_scispacy/README.md`
12. ADR 0012 — Phase 2 SciSpaCy sidecar + backend selection

---

## Task 1: `parthenon-scispacy` Dockerfile + docker-compose entry

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-scispacy/Dockerfile`
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-scispacy/server.py` (placeholder; full content in Task 2)
- Create: `/home/smudoshi/Github/Parthenon/docker/parthenon-scispacy/requirements.txt`
- Modify: `/home/smudoshi/Github/Parthenon/docker-compose.yml`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_scispacy_sidecar_image.py
"""Sidecar image builds + `docker compose config` includes parthenon-scispacy."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]


@pytest.mark.integration
def test_compose_config_includes_parthenon_scispacy() -> None:
    out = subprocess.check_output(
        ["docker", "compose", "config", "--format", "json"],
        cwd=REPO,
    ).decode("utf-8")
    cfg = json.loads(out)
    assert "parthenon-scispacy" in cfg.get("services", {}), (
        "parthenon-scispacy missing from rendered docker-compose"
    )


@pytest.mark.integration
def test_dockerfile_pins_scispacy_version() -> None:
    body = (REPO / "docker" / "parthenon-scispacy" / "Dockerfile").read_text(encoding="utf-8")
    assert "scispacy==0.5.5" in body
    assert "spacy==3.7.5" in body
    # The model wheel must be pinned to a specific version+release for reproducibility.
    assert "en_core_sci_md-0.5.5" in body or "en_core_sci_lg-0.5.5" in body
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_scispacy_sidecar_image.py -v -m integration
```

Expected: FAIL — Dockerfile and compose entry don't exist.

- [ ] **Step 3: Write minimal implementation**

```dockerfile
# docker/parthenon-scispacy/Dockerfile
# SciSpaCy sidecar — preloads en_core_sci_md at build time so the first request
# does not pay the model-load cost. HIPAA-strict: never reaches out to the
# internet at runtime; all model weights baked into the image.
FROM python:3.12-slim

# Non-root user (HIGHSEC §4.1)
RUN addgroup --system scisvc && adduser --system --ingroup scisvc scisvc

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
      https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.5/en_core_sci_md-0.5.5.tar.gz

# Smoke-load the model so build fails if the wheel is incompatible with the
# spacy version, not a customer who pulls the image.
RUN python -c "import spacy; spacy.load('en_core_sci_md')"

COPY server.py .

USER scisvc

EXPOSE 5101

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5101/health')"

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5101"]
```

```
# docker/parthenon-scispacy/requirements.txt
scispacy==0.5.5
spacy==3.7.5
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic>=2.0
```

```python
# docker/parthenon-scispacy/server.py — placeholder; Task 2 fills in the body
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Add the service to `docker-compose.yml` alongside `parthenon-anonymizer`:

```yaml
  parthenon-scispacy:
    container_name: parthenon-scispacy
    image: ghcr.io/sudoshi/parthenon-scispacy:v0.1.0
    build:
      context: ./docker/parthenon-scispacy
      dockerfile: Dockerfile
    networks:
      - parthenon
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:5101/health')"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_scispacy_sidecar_image.py -v -m integration
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose config --quiet  # validates YAML
cd templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q -m "not slow"
```

Expected: all clean. **Commit:** `feat(docker): parthenon-scispacy sidecar image + compose service (Q3)`.

---

## Task 2: Sidecar HTTP server

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/docker/parthenon-scispacy/server.py`

- [ ] **Step 1: Write the failing test**

The sidecar test runs against a real container, so this is an integration test. Write a smaller unit-style test that exercises the FastAPI app directly via TestClient:

```python
# templates/tests/integration/test_scispacy_sidecar_server.py
"""SciSpaCy sidecar HTTP server smoke + contract tests."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

DOCKER_DIR = Path(__file__).resolve().parents[3] / "docker" / "parthenon-scispacy"


@pytest.fixture
def server_app(monkeypatch: pytest.MonkeyPatch):
    sys.path.insert(0, str(DOCKER_DIR))
    try:
        import server  # type: ignore[import-not-found]
        yield server.app
    finally:
        sys.path.pop(0)


@pytest.mark.integration
def test_health_endpoint_returns_ok(server_app) -> None:
    from fastapi.testclient import TestClient
    client = TestClient(server_app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.integration
def test_infer_returns_spans_and_mappings(server_app) -> None:
    from fastapi.testclient import TestClient
    client = TestClient(server_app)
    r = client.post("/v1/ner/infer", json={
        "text": "Patient reports chest pain and shortness of breath.",
        "model": "en_core_sci_md",
    })
    assert r.status_code == 200
    payload = r.json()
    assert "spans" in payload
    assert "mappings" in payload
    assert isinstance(payload["spans"], list)
    assert all({"start", "end", "text", "label"} <= set(s) for s in payload["spans"])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_scispacy_sidecar_server.py -v -m integration
```

Expected: FAIL — placeholder server doesn't implement `/v1/ner/infer`.

- [ ] **Step 3: Write minimal implementation**

```python
# docker/parthenon-scispacy/server.py
"""SciSpaCy NER sidecar — HTTP shim matching the parthenon-ai-service contract.

Loads en_core_sci_md once at module import time. Each /v1/ner/infer request
runs the loaded NER pipeline against the input text and returns the same
JSON shape the LLM backend produces, so SciSpacyBackend can be a drop-in
plug-in for NlpBackend.
"""
from __future__ import annotations

import os

import spacy
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

_MODEL_NAME = os.environ.get("SCISPACY_MODEL", "en_core_sci_md")
_NLP = spacy.load(_MODEL_NAME)

app = FastAPI(title="parthenon-scispacy")


class InferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    model: str = _MODEL_NAME
    # `prompt` is accepted for contract parity with the LLM backend even
    # though SciSpaCy ignores it. Recorded in the audit trail upstream.
    prompt: str | None = None


class Span(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: int
    end: int
    text: str
    label: str


class Mapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    span_index: int
    concept_id: int
    vocabulary_id: str
    confidence: float


class InferResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spans: list[Span]
    mappings: list[Mapping]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": _MODEL_NAME}


@app.post("/v1/ner/infer", response_model=InferResponse)
def infer(req: InferRequest) -> InferResponse:
    doc = _NLP(req.text)
    spans: list[Span] = []
    for ent in doc.ents:
        spans.append(Span(
            start=int(ent.start_char),
            end=int(ent.end_char),
            text=str(ent.text),
            label=_label_to_omop_domain(ent.label_),
        ))
    # SciSpaCy's en_core_sci_md does not bundle UMLS linker by default; v0.1
    # of the sidecar returns spans without OMOP concept_id mappings. Plan 3
    # (Llettuce eval) compares span-level recall; concept-level mappings are
    # a Phase 3 follow-up via the SciSpaCy UMLS linker pipeline.
    return InferResponse(spans=spans, mappings=[])


def _label_to_omop_domain(label: str) -> str:
    """Map SciSpaCy entity labels to the four labels NoteNlpNode expects."""
    if label in ("DISEASE", "CONDITION"):
        return "condition"
    if label in ("CHEMICAL", "DRUG"):
        return "drug"
    if label in ("PROCEDURE",):
        return "procedure"
    if label in ("TEST", "MEASUREMENT"):
        return "measurement"
    return "condition"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_scispacy_sidecar_server.py -v -m integration
```

Expected: PASS (against the in-process FastAPI TestClient — no docker required for this test).

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q -m "not slow"
```

Expected: all clean. **Commit:** `feat(docker): SciSpaCy sidecar /v1/ner/infer endpoint with span extraction`.

---

## Task 3: `SciSpacyBackend` Python client

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/scispacy.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_scispacy_backend.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/exceptions.py` (add `SciSpacyBackendError`)

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_scispacy_backend.py
"""SciSpacyBackend implements NlpBackend Protocol; routes to sidecar HTTP."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backend import NlpBackend
from runtime.nlp.backends.scispacy import SciSpacyBackend
from runtime.nlp.exceptions import SciSpacyBackendError
from runtime.nlp.types import NerInferenceResult


def test_backend_satisfies_protocol() -> None:
    backend: NlpBackend = SciSpacyBackend()
    assert hasattr(backend, "infer")


def test_backend_default_url() -> None:
    backend = SciSpacyBackend()
    assert "parthenon-scispacy" in backend.sidecar_url


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_backend_sends_text_to_sidecar(mock_post: MagicMock) -> None:
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 0, "end": 10, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = SciSpacyBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")

    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "en_core_sci_md"
    assert result.prompt_version == "v0.1.0"
    assert len(result.spans) == 1
    mock_post.assert_called_once()


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_backend_raises_on_http_error(mock_post: MagicMock) -> None:
    import httpx
    mock_post.side_effect = httpx.HTTPError("boom")
    backend = SciSpacyBackend()
    with pytest.raises(SciSpacyBackendError):
        backend.infer("text", "v0.1.0")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_scispacy_backend.py -v
```

Expected: FAIL — module + exception missing.

- [ ] **Step 3: Write minimal implementation**

Add `SciSpacyBackendError` to `templates/runtime/nlp/exceptions.py`:

```python
class SciSpacyBackendError(LlmBackendError):
    """Raised when the SciSpaCy sidecar HTTP call fails."""
```

```python
# templates/runtime/nlp/backends/scispacy.py
"""SciSpaCy backend — routes NER inference through the parthenon-scispacy sidecar.

Decision Q3: SciSpaCy ships as a separate sidecar container so customers
who don't need NER aren't forced to bundle the ~110-750 MB model in the
main parthenon-templates image. The HTTP contract matches parthenon-ai-service
so backends are interchangeable at the NoteNlpNode dispatch level.
"""
from __future__ import annotations

import os

import httpx

from runtime.nlp.exceptions import SciSpacyBackendError
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


class SciSpacyBackend:
    def __init__(self, sidecar_url: str | None = None) -> None:
        self.sidecar_url = sidecar_url or os.environ.get(
            "PARTHENON_SCISPACY_URL", "http://parthenon-scispacy:5101"
        )
        self.model_name = os.environ.get("SCISPACY_MODEL", "en_core_sci_md")

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        try:
            r = httpx.post(
                f"{self.sidecar_url}/v1/ner/infer",
                json={"text": text, "model": self.model_name},
                timeout=120.0,
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SciSpacyBackendError(f"scispacy inference failed: {exc}") from exc

        spans = [NerSpan(**s) for s in data.get("spans", [])]
        mappings = [NerConceptMapping(**m) for m in data.get("mappings", [])]
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_scispacy_backend.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q -m "not slow"
```

Expected: all clean. **Commit:** `feat(templates): SciSpacyBackend Python client routing to parthenon-scispacy sidecar`.

---

## Task 4: `NoteNlpNode` dispatch — register `"scispacy"` backend

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/note_nlp.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_note_nlp_node.py`

- [ ] **Step 1: Write the failing test**

Extend `test_note_nlp_node.py`:

```python
def test_node_dispatches_to_scispacy() -> None:
    node = NoteNlpNode.from_config({"backend": "scispacy", "prompt_version": "v0.1.0"})
    assert type(node._backend).__name__ == "SciSpacyBackend"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_note_nlp_node.py::test_node_dispatches_to_scispacy -v
```

Expected: FAIL — `from_config` only knows `"llm"`.

- [ ] **Step 3: Write minimal implementation**

Extend the dispatch in `templates/runtime/nodes/note_nlp.py`:

```python
@classmethod
def from_config(cls, params: dict[str, Any]) -> "NoteNlpNode":
    which = params.get("backend", "llm")
    if which == "llm":
        from runtime.nlp.backends.llm import LlmBackend
        backend: NlpBackend = LlmBackend()
    elif which == "scispacy":
        from runtime.nlp.backends.scispacy import SciSpacyBackend
        backend = SciSpacyBackend()
    else:
        raise ValueError(f"unknown backend: {which!r}")
    return cls(backend=backend)
```

- [ ] **Step 4-5:** Run tests + gates. **Commit:** `feat(templates): NoteNlpNode dispatches to SciSpacyBackend by params.backend`.

---

## Task 5: Sidecar health-gated test fixture

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/conftest_scispacy.py` (helper) OR add to existing conftest

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_scispacy_sidecar_e2e.py
"""End-to-end SciSpaCy through the live sidecar; skipped if not reachable."""
from __future__ import annotations

import os

import httpx
import pytest

from runtime.nlp.backends.scispacy import SciSpacyBackend


def _sidecar_reachable() -> bool:
    url = os.environ.get("PARTHENON_SCISPACY_URL", "http://localhost:5101")
    try:
        r = httpx.get(f"{url}/health", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.integration
@pytest.mark.skipif(not _sidecar_reachable(), reason="parthenon-scispacy sidecar not reachable")
def test_scispacy_extracts_clinical_entities() -> None:
    backend = SciSpacyBackend(sidecar_url=os.environ.get("PARTHENON_SCISPACY_URL"))
    result = backend.infer(
        "Patient reports chest pain and shortness of breath. Started lisinopril 10mg.",
        "v0.1.0",
    )
    assert len(result.spans) >= 2, "expected at least 2 entities (chest pain, lisinopril)"
    labels = {s.label for s in result.spans}
    assert {"condition", "drug"} & labels, f"expected clinical labels, got {labels}"
```

- [ ] **Step 2-5:** Run + gates. **Commit:** `test(templates): SciSpacyBackend live-sidecar E2E with health gate`.

---

## Task 6: `parthenon_ner_scispacy` manifest + fixture reuse

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_scispacy/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_scispacy/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_parthenon_ner_scispacy_manifest.py`

- [ ] **Step 1: Write the failing test**

```python
def test_manifest_loads() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    assert cfg["name"] == "parthenon_ner_scispacy"


def test_manifest_pins_backend_to_scispacy() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    nlp_node = next(n for n in cfg["nodes"] if n["type"] == "note_nlp")
    assert nlp_node["params"]["backend"] == "scispacy"


def test_manifest_documents_offline_capability() -> None:
    readme = MANIFEST.parent / "README.md"
    body = readme.read_text(encoding="utf-8")
    assert "offline" in body.lower() or "no network egress" in body.lower()
    assert "HIPAA" in body or "hipaa" in body.lower()
```

- [ ] **Step 2-5:** Implement. The manifest mirrors `parthenon_ner_llm` from Plan 1 but pins `backend: scispacy` (not parameterized — the whole point of this template is the offline backend). Reuses the same FHIR DocumentReference fixture symlink/path. **Commit:** `feat(templates): parthenon_ner_scispacy manifest pinned to SciSpaCy backend`.

---

## Task 7: Validation pack — gold-standard CSV reuse + ≥85% recall

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_scispacy/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_parthenon_ner_scispacy.py`

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.integration
@pytest.mark.skipif(not _sidecar_reachable(), reason="parthenon-scispacy sidecar not reachable")
def test_parthenon_ner_scispacy_meets_recall_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    # Bootstrap omop + vocab; seed minimal SNOMED+RxNorm+LOINC concepts.
    # Run the manifest against the same 100-note FHIR fixture used by
    # parthenon_ner_llm. Compare extracted spans against the gold-standard CSV
    # from Plan 1; require span-level recall >= 0.85 (relaxed from LLM's 0.90
    # because SciSpaCy is rule-bound and lacks the few-shot adaptability of
    # MedGemma).
    ...
```

- [ ] **Step 2-5:** Implement. Reuse the gold-standard CSV from `parthenon_ner_llm/validation/expected/note_nlp_rows.csv` via a relative path (don't duplicate). The recall threshold is 0.85; document that it is lower than the LLM's 0.90 because SciSpaCy is more deterministic but less adaptable. **Commit:** `test(templates): parthenon_ner_scispacy E2E with ≥85% recall against shared gold standard`.

---

## Task 8: CI templates.yml — sidecar wait-for-healthy + named E2E

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

- [ ] **Step 1: Add the workflow steps**

After the existing `fhir_anonymizer MS E2E` block, add:

```yaml
      - name: Build parthenon-scispacy sidecar image
        # Same pattern as parthenon-anonymizer (Plan 1 anonymizer): build locally so
        # the registry-pull path is not the critical path on a fresh CI runner.
        # The model download in the Dockerfile RUN step is the slowest layer
        # (~2 minutes); cache via actions/cache on the buildx layer in v0.2.
        run: docker compose build parthenon-scispacy

      - name: Start parthenon-scispacy sidecar
        run: docker compose up -d parthenon-scispacy

      - name: Wait for scispacy sidecar healthy
        # The model load adds ~30s to the start period; allow up to 5 minutes.
        run: |
          for i in $(seq 1 60); do
            status=$(docker compose ps --format json parthenon-scispacy | jq -r '.[0].Health // .[].Health // empty')
            if [ "$status" = "healthy" ]; then exit 0; fi
            sleep 5
          done
          echo "scispacy sidecar did not become healthy"; exit 1

      - name: parthenon_ner_scispacy E2E
        working-directory: templates
        env:
          PARTHENON_SCISPACY_URL: http://localhost:5101
        run: uv run pytest tests/e2e/test_parthenon_ner_scispacy.py -v -m integration
```

- [ ] **Step 2: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/templates.yml'))"
```

Expected: no errors.

- [ ] **Step 3: Run gates**

Already covered by the workflow step — sidecar build is the slowest part. **Commit:** `ci(templates): build + healthcheck parthenon-scispacy sidecar; named E2E job`.

---

## Task 9: Backend equivalence integration test (LLM vs SciSpaCy)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_ner_backend_equivalence.py`

- [ ] **Step 1: Write the failing test**

```python
"""LLM vs SciSpaCy on a 5-note canary; assert ≥70% span-set Jaccard agreement."""
from __future__ import annotations

import os

import pytest

# imports + sidecar reachability gate as in Task 5

CANARY_NOTES = [
    "Patient reports chest pain.",
    "Started lisinopril 10mg daily for hypertension.",
    "Blood pressure 160/95, heart rate 88, afebrile.",
    "MRI brain shows no acute infarct.",
    "Hemoglobin 8.2, white blood cells 11.5.",
]


@pytest.mark.integration
@pytest.mark.skipif(
    not (_llm_sidecar_reachable() and _scispacy_sidecar_reachable()),
    reason="both NER backends required for equivalence test",
)
def test_llm_and_scispacy_agree_on_canary() -> None:
    llm = LlmBackend()
    sci = SciSpacyBackend()
    agreements: list[float] = []
    for note in CANARY_NOTES:
        l = {(s.start, s.end) for s in llm.infer(note, "v0.1.0").spans}
        s = {(t.start, t.end) for t in sci.infer(note, "v0.1.0").spans}
        if not l and not s:
            continue
        jaccard = len(l & s) / len(l | s)
        agreements.append(jaccard)
    avg = sum(agreements) / max(1, len(agreements))
    assert avg >= 0.70, f"avg span Jaccard {avg:.2f} < 0.70 — backends drift suspect"
```

- [ ] **Step 2-5:** Implement + run. The test SKIPs if either sidecar isn't reachable, so it doesn't gate normal CI; it gates only the slow lane after both `Wait for *-sidecar healthy` succeed. **Commit:** `test(templates): LLM vs SciSpaCy backend equivalence canary (≥70% span Jaccard)`.

---

## Task 10: SciSpaCy-specific PHI leak HIGHSEC regression guard

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_scispacy_phi_leak.py`

- [ ] **Step 1: Write the failing test**

```python
"""Per HIGHSEC §7: NER backends must NEVER write the raw note text into spans.

A backend regression that copies whole-note text into a span (instead of just
the entity slice) would leak PHI into omop.note_nlp.observation_source_value.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backends.scispacy import SciSpacyBackend


@patch("runtime.nlp.backends.scispacy.httpx.post")
def test_span_text_never_contains_full_note(mock_post: MagicMock) -> None:
    note = "Patient John Doe DOB 1959-04-12 reports chest pain at 123 Main St."
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 38, "end": 48, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = SciSpacyBackend()
    result = backend.infer(note, "v0.1.0")
    for span in result.spans:
        assert "John Doe" not in span.text
        assert "DOB" not in span.text
        assert "123 Main St" not in span.text
```

- [ ] **Step 2-5:** Implement test (it will pass against the current backend; the test exists as a regression guard for future code changes that might naively copy `note[0:end]` into the span text). **Commit:** `test(templates): SciSpaCy PHI-leak HIGHSEC regression guard (§7)`.

---

## Task 11: Manifest README

**Files:**
- Create/extend: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_scispacy/README.md`

The README documents:
- Why SciSpaCy is the HIPAA-strict path (offline; no network egress at run time; deterministic).
- Recall trade-off vs LLM (0.85 vs 0.90 on the shared gold standard).
- That `concept_id` mappings are NOT produced in v0.1 — Phase 3 follow-up to add the SciSpaCy UMLS linker.
- How to swap the embedded model (`SCISPACY_MODEL=en_core_sci_lg` for higher recall at 7x model size).
- Operations: `docker compose up -d parthenon-scispacy` then submit a run via the templates API.

- [ ] **Step 1-2: Write the test**

```python
def test_readme_documents_offline_posture() -> None:
    body = README.read_text(encoding="utf-8")
    for term in ("offline", "HIPAA", "deterministic"):
        assert term.lower() in body.lower()


def test_readme_calls_out_concept_mapping_gap() -> None:
    body = README.read_text(encoding="utf-8")
    assert "UMLS linker" in body or "concept_id mapping" in body
    assert "Phase 3" in body or "Phase 3 follow-up" in body
```

- [ ] **Step 3-5:** Implement + run. **Commit:** `docs(templates): parthenon_ner_scispacy README — HIPAA-strict offline posture`.

---

## Task 12: ADR 0012 — Phase 2 SciSpaCy sidecar + backend selection

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0012-scispacy-backend.md`

- [ ] **Step 1: Draft the ADR**

ADR 0012 covers:
- **Context:** Phase 2 §1 + Q3 (SciSpaCy as separate sidecar image). HIPAA-strict customers need offline NER. Plan 1's NlpBackend Protocol is the dispatch surface.
- **Decision:** `SciSpacyBackend` Python client + `parthenon-scispacy` sidecar image with model preloaded at build time. v0.1 ships span extraction only; concept_id mappings deferred to Phase 3 (UMLS linker integration).
- **Consequences:** Two NER sidecars in the stack (`parthenon-ai-service` for LLM, `parthenon-scispacy` for offline). Image bloat is contained to customers who actually deploy the SciSpaCy sidecar. Plan 3's evaluation harness gets a real comparand.
- **Alternatives considered:**
  - Bundle SciSpaCy in the main `parthenon-templates` image (declined; Q3 — bloats every customer's image).
  - Fetch SciSpaCy model at first use (declined; Q3 — runtime network egress is unreliable).
  - Pure-Python in-process spaCy load inside the templates container (declined; long startup time on every node invocation, can't share model across runs).
- **Open follow-ups:** UMLS linker for concept_id mappings (Phase 3); model upgrade `en_core_sci_md` → `en_core_sci_lg` evaluation pending; sidecar build cache via actions/cache@v4 to amortize the 2-min model download.

- [ ] **Step 2: Run gates**

```bash
ls /home/smudoshi/Github/Parthenon/docs/architecture/adr-0012-scispacy-backend.md
```

Expected: file present. **Commit:** `docs(adr): ADR 0012 — Phase 2 SciSpaCy sidecar + backend selection`.

---

## Done

After Task 12 lands, Plan 2 is complete. The `parthenon_ner_scispacy` template runs offline against the shared 100-note fixture; SciSpacyBackend is callable via the same NoteNlpNode dispatch surface as the LlmBackend; the live-sidecar E2E and equivalence canary gate the slow CI lane. Plan 3 (Llettuce evaluation harness) can now branch off main; it consumes both LlmBackend and SciSpacyBackend for compare-mode metrics.
