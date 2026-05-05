# Parthenon Ingestion Templates — Phase 2, Plan 1: NER Node + LLM Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `NoteNlpNode` ABC + plug-in interface, the `LlmBackend` first implementation routing to the existing `parthenon-ai-service` (MedGemma via Ollama by default; OpenAI-compatible cloud LLM behind a feature flag), and the `parthenon_ner_llm` template that takes FHIR DocumentReference resources and emits OMOP `NOTE` + `NOTE_NLP` rows. After this plan, the templates runtime can run clinical NER end-to-end with the LLM backend, with a HIPAA-compliant audit trail and a cost-capped CI lane.

**Architecture:** `NoteNlpNode` implements the existing Node ABC (`templates/runtime/nodes/base.py`) and exposes a `NlpBackend` Protocol mirroring Phase 1's `AnonymizerBackend` pattern. Plan 1 ships `LlmBackend`; Plans 2/3 add `SciSpacyBackend` and `LlettuceBackend`. The LLM call goes through the existing `parthenon-ai-service` HTTP API (no new sidecar) — that service already has MedGemma loaded via Ollama. Cloud OpenAI-compat is gated by `OPENAI_LLM_ENABLED=true` env (decision Q1). Prompts live in version-pinned files at `templates/runtime/nlp/prompts/v0.1.0/*.md` and the manifest pins `metadata.prompt_version` (decision Q2). Per-inference audit rows go to a new `app.note_nlp_audit` table with token offsets, concept_id mappings, model name, prompt version, and an encrypted raw_input column with 30-day TTL (decision Q5). The CI live-LLM lane is gated to `schedule` + `workflow_dispatch` events with a `$OPENAI_BUDGET_USD=1.00` per-job cap (decision Q11), mirroring the perf-trigger pattern from PR #262.

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 toolchain (uv, ruff, black --line-length 100, mypy --strict, pytest, pytest-asyncio). New deps: `openai>=1.0.0`, `jsonschema>=4.0`, `cryptography>=42.0`. The `anthropic>=0.39.0` SDK is a soft optional dep behind the cloud feature flag.

**Depends on:** Phase 1 — all 7 plans merged (PRs #253–#259) plus Phase 2 spec (PR #263). Specifically:
- Node SDK ABC at `templates/runtime/nodes/base.py`
- `parthenon-ai-service` reachable from `parthenon-templates` on the docker network
- `vocab.concept` populated with SNOMED + LOINC + RxNorm (Phase 1 baseline)
- Phase 0 audit-table HIGHSEC pattern (encrypted columns + retention prune job) for the new `app.note_nlp_audit` table
- Templates workflow at `.github/workflows/templates.yml` with the `schedule` + `workflow_dispatch` triggers landed in PR #262

**Unblocks:** Phase 2 Plan 2 (SciSpaCy backend) and Plan 3 (Llettuce evaluation) — both inherit the `NlpBackend` Protocol and prompt-versioning conventions defined here.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **Working directory** for all `php artisan` / `vendor/bin` commands is `/home/smudoshi/Github/Parthenon/backend`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`). No `unittest`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on the Phase 2 Plan 1 branch (per `feedback_worktree_sweep_regressions.md`). One task = one commit unless explicitly split.
- **Type names** (stable across all tasks): `NoteNlpNode`, `NlpBackend` (Protocol), `LlmBackend`, `NerInferenceResult`, `NerSpan`, `NerConceptMapping`, `PromptRegistry`, `PromptVersionError`, `NoteNlpAuditWriter`, `LlmBudgetExceeded`, `LlmBackendError`.
- **Pinned versions** (validated against PyPI as of 2026-05-05):
  - `openai>=1.0.0` (cloud-LLM optional path)
  - `jsonschema>=4.0` (LLM structured-output validation)
  - `cryptography>=42.0` (Fernet encryption for raw_input column)
  - `anthropic>=0.39.0` (soft optional, gated by `ANTHROPIC_LLM_ENABLED=true`)
  - All Phase 0 and Phase 1 pins remain unchanged.

---

## Task index (15 tasks)

1. Add `openai`, `jsonschema`, `cryptography` to `pyproject.toml`
2. `app.note_nlp_audit` Laravel migration + Eloquent model
3. `NerSpan` + `NerConceptMapping` + `NerInferenceResult` typed models
4. `NlpBackend` Protocol + `LlmBackendError` + `LlmBudgetExceeded` exceptions
5. `PromptRegistry` (loads `templates/runtime/nlp/prompts/v0.1.0/*.md`, version-pins per manifest)
6. `LlmBackend` — Ollama/MedGemma path (HTTP client to `parthenon-ai-service`)
7. `LlmBackend` — cloud OpenAI-compat path behind `OPENAI_LLM_ENABLED` feature flag
8. `LlmBackend` — per-job budget cap (`OPENAI_BUDGET_USD`) + `LlmBudgetExceeded` raise
9. `NoteNlpAuditWriter` — encrypted raw_input column, 30-day TTL prune job
10. `NoteNlpNode` (selects backend by `params.backend`; orchestrates registry → backend → audit)
11. Clinical NER prompt v0.1.0 + JSON schema for structured output
12. `parthenon_ner_llm` manifest + 100-note FHIR DocumentReference fixture corpus
13. `parthenon_ner_llm` validation pack — gold-standard CSV + ≥90% recall assertion
14. CI live-LLM lane: `pytest -m llm-live` step in templates.yml workflow (schedule + dispatch only)
15. ADR 0009 — Phase 2 NER node design

---

## Task 1: Add `openai`, `jsonschema`, `cryptography` to `pyproject.toml`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/pyproject.toml`

- [ ] **Step 1: Write the failing test**

```python
# /home/smudoshi/Github/Parthenon/templates/tests/test_phase_2_packaging.py
"""Smoke test that Phase 2 Plan 1 deps are pinned in pyproject.toml."""
from __future__ import annotations

from pathlib import Path


def test_pyproject_declares_phase_2_plan_1_pinned_versions() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for required in (
        '"openai>=1.0.0"',
        '"jsonschema>=4.0"',
        '"cryptography>=42.0"',
    ):
        assert required in pyproject, f"missing pinned dep: {required}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_phase_2_packaging.py -v
```

Expected: FAIL with `AssertionError: missing pinned dep: "openai>=1.0.0"`.

- [ ] **Step 3: Write minimal implementation**

Add the three pins to the `dependencies` array in `pyproject.toml`:

```toml
dependencies = [
    # ... existing Phase 0 + Phase 1 pins ...
    "openai>=1.0.0",
    "jsonschema>=4.0",
    "cryptography>=42.0",
]
```

Run `uv sync` to install.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/test_phase_2_packaging.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. The new deps don't add source files yet, so mypy and existing tests should be unchanged. **Commit:** `chore(templates): pin openai + jsonschema + cryptography for Phase 2 NER`.

---

## Task 2: `app.note_nlp_audit` Laravel migration + Eloquent model

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_05_05_120000_create_note_nlp_audit_table.php`
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Models/App/NoteNlpAudit.php`
- Create: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/NoteNlpAuditTest.php`

- [ ] **Step 1: Write the failing test**

```php
// backend/tests/Feature/NoteNlpAuditTest.php
<?php

namespace Tests\Feature;

use App\Models\App\NoteNlpAudit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NoteNlpAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_row_persists_with_encrypted_raw_input(): void
    {
        $audit = NoteNlpAudit::create([
            'note_nlp_id' => 1,
            'model_name' => 'medgemma:7b',
            'prompt_version' => 'v0.1.0',
            'token_offsets' => [['start' => 0, 'end' => 14]],
            'concept_mappings' => [['snomed_concept_id' => 4030518]],
            'raw_input' => 'Patient denies chest pain.',
            'ttl_at' => now()->addDays(30),
        ]);

        $this->assertDatabaseHas('app.note_nlp_audit', [
            'id' => $audit->id,
            'model_name' => 'medgemma:7b',
        ]);
        $this->assertEquals('Patient denies chest pain.', $audit->raw_input);
        $this->assertNotEquals(
            'Patient denies chest pain.',
            \DB::table('app.note_nlp_audit')->where('id', $audit->id)->value('raw_input')
        );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec -T php vendor/bin/pest --filter=NoteNlpAuditTest
```

Expected: FAIL — table does not exist.

- [ ] **Step 3: Write minimal implementation**

Create the migration:

```php
// backend/database/migrations/2026_05_05_120000_create_note_nlp_audit_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('pgsql')->create('app.note_nlp_audit', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('note_nlp_id');
            $table->string('model_name', 128);
            $table->string('prompt_version', 32);
            $table->jsonb('token_offsets');
            $table->jsonb('concept_mappings');
            $table->text('raw_input'); // encrypted via Eloquent cast
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('ttl_at');
            $table->index('note_nlp_id');
            $table->index('ttl_at');
        });
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('app.note_nlp_audit');
    }
};
```

Create the Eloquent model:

```php
// backend/app/Models/App/NoteNlpAudit.php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class NoteNlpAudit extends Model
{
    protected $table = 'app.note_nlp_audit';
    public $timestamps = false;

    protected $fillable = [
        'note_nlp_id', 'model_name', 'prompt_version',
        'token_offsets', 'concept_mappings', 'raw_input', 'ttl_at',
    ];

    protected $casts = [
        'token_offsets' => 'array',
        'concept_mappings' => 'array',
        'raw_input' => 'encrypted',
        'created_at' => 'datetime',
        'ttl_at' => 'datetime',
    ];
}
```

Run migration:

```bash
cd /home/smudoshi/Github/Parthenon
./deploy.sh --db
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec -T php vendor/bin/pest --filter=NoteNlpAuditTest
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse"
docker compose exec -T php vendor/bin/pest
```

Expected: all clean. **Commit:** `feat(backend): add app.note_nlp_audit table for NER inference audit (Q5)`.

---

## Task 3: `NerSpan` + `NerConceptMapping` + `NerInferenceResult` typed models

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/types.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_nlp_types.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_nlp_types.py
"""Pydantic typed models for NER results."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from runtime.nlp.types import NerSpan, NerConceptMapping, NerInferenceResult


def test_ner_span_validates_offsets() -> None:
    span = NerSpan(start=0, end=14, text="chest pain", label="condition")
    assert span.start == 0
    assert span.end == 14


def test_ner_span_rejects_inverted_offsets() -> None:
    with pytest.raises(ValidationError):
        NerSpan(start=14, end=0, text="x", label="condition")


def test_ner_concept_mapping_carries_vocab_name() -> None:
    mapping = NerConceptMapping(
        span_index=0,
        concept_id=4030518,
        vocabulary_id="SNOMED",
        confidence=0.93,
    )
    assert mapping.vocabulary_id == "SNOMED"


def test_ner_inference_result_aggregates() -> None:
    result = NerInferenceResult(
        spans=[NerSpan(start=0, end=14, text="chest pain", label="condition")],
        mappings=[NerConceptMapping(
            span_index=0, concept_id=4030518, vocabulary_id="SNOMED", confidence=0.93
        )],
        model_name="medgemma:7b",
        prompt_version="v0.1.0",
    )
    assert len(result.spans) == 1
    assert result.model_name == "medgemma:7b"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_nlp_types.py -v
```

Expected: FAIL — `ImportError: No module named 'runtime.nlp.types'`.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nlp/__init__.py
"""Phase 2 NER subsystem."""
```

```python
# templates/runtime/nlp/types.py
"""Typed Pydantic models for clinical NER results."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class NerSpan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    start: int = Field(ge=0, description="Character offset, inclusive.")
    end: int = Field(gt=0, description="Character offset, exclusive.")
    text: str
    label: str

    @model_validator(mode="after")
    def _check_offsets(self) -> "NerSpan":
        if self.start >= self.end:
            raise ValueError(f"start ({self.start}) must be < end ({self.end})")
        return self


class NerConceptMapping(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    span_index: int = Field(ge=0)
    concept_id: int
    vocabulary_id: str
    confidence: float = Field(ge=0.0, le=1.0)


class NerInferenceResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spans: list[NerSpan]
    mappings: list[NerConceptMapping]
    model_name: str
    prompt_version: str
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_nlp_types.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): add NER typed models (NerSpan, NerConceptMapping, NerInferenceResult)`.

---

## Task 4: `NlpBackend` Protocol + `LlmBackendError` + `LlmBudgetExceeded`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backend.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/exceptions.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_nlp_backend_protocol.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_nlp_backend_protocol.py
"""NlpBackend Protocol contract."""
from __future__ import annotations

from typing import runtime_checkable

import pytest

from runtime.nlp.backend import NlpBackend
from runtime.nlp.exceptions import LlmBackendError, LlmBudgetExceeded
from runtime.nlp.types import NerInferenceResult, NerSpan


def test_nlp_backend_is_runtime_checkable_protocol() -> None:
    assert runtime_checkable(NlpBackend)


def test_concrete_backend_satisfies_protocol() -> None:
    class FakeBackend:
        def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
            return NerInferenceResult(spans=[], mappings=[], model_name="fake",
                                      prompt_version=prompt_version)

    backend: NlpBackend = FakeBackend()
    result = backend.infer("hi", "v0.1.0")
    assert result.model_name == "fake"


def test_llm_budget_exceeded_is_subclass_of_llm_backend_error() -> None:
    assert issubclass(LlmBudgetExceeded, LlmBackendError)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_nlp_backend_protocol.py -v
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nlp/exceptions.py
"""NLP backend exceptions."""
from __future__ import annotations


class LlmBackendError(RuntimeError):
    """Base for all NLP backend failures."""


class LlmBudgetExceeded(LlmBackendError):
    """Raised when a single inference + accumulated job spend exceeds the budget cap."""


class PromptVersionError(LlmBackendError):
    """Raised when the manifest pins a prompt version that doesn't exist in the registry."""
```

```python
# templates/runtime/nlp/backend.py
"""Pluggable NLP backend protocol — mirrors Phase 1's AnonymizerBackend."""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from runtime.nlp.types import NerInferenceResult


@runtime_checkable
class NlpBackend(Protocol):
    """Contract every NLP backend (LLM, SciSpaCy, Llettuce) must satisfy."""

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        """Run NER inference against `text` and return a typed result."""
        ...
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_nlp_backend_protocol.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): NlpBackend Protocol + exceptions (LlmBackendError, LlmBudgetExceeded, PromptVersionError)`.

---

## Task 5: `PromptRegistry` — version-pinned prompt loader

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/prompts/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/prompts/v0.1.0/clinical_ner_v1.md` (placeholder; full content in Task 11)
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/registry.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_prompt_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_prompt_registry.py
"""PromptRegistry loads version-pinned prompts from disk."""
from __future__ import annotations

import pytest

from runtime.nlp.exceptions import PromptVersionError
from runtime.nlp.registry import PromptRegistry


def test_registry_loads_pinned_version() -> None:
    registry = PromptRegistry()
    prompt = registry.get("clinical_ner_v1", "v0.1.0")
    assert "system:" in prompt.lower() or "you are" in prompt.lower()


def test_registry_rejects_unknown_version() -> None:
    registry = PromptRegistry()
    with pytest.raises(PromptVersionError):
        registry.get("clinical_ner_v1", "v9.9.9")


def test_registry_rejects_unknown_prompt_name() -> None:
    registry = PromptRegistry()
    with pytest.raises(PromptVersionError):
        registry.get("not_a_real_prompt", "v0.1.0")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_prompt_registry.py -v
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```markdown
<!-- templates/runtime/nlp/prompts/v0.1.0/clinical_ner_v1.md -->
You are a clinical NER assistant. Placeholder for Task 11; the full prompt
plus JSON-schema-constrained output is added there.
```

```python
# templates/runtime/nlp/registry.py
"""Version-pinned prompt registry. Decision Q2."""
from __future__ import annotations

from pathlib import Path

from runtime.nlp.exceptions import PromptVersionError

_PROMPTS_ROOT = Path(__file__).parent / "prompts"


class PromptRegistry:
    def get(self, name: str, version: str) -> str:
        path = _PROMPTS_ROOT / version / f"{name}.md"
        if not path.is_file():
            raise PromptVersionError(
                f"prompt {name!r} at version {version!r} not found at {path}"
            )
        return path.read_text(encoding="utf-8")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_prompt_registry.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): PromptRegistry version-pinned prompt loader (Q2)`.

---

## Task 6: `LlmBackend` — Ollama/MedGemma path

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/llm.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_llm_backend_ollama.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_llm_backend_ollama.py
"""LlmBackend default Ollama path against parthenon-ai-service."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backends.llm import LlmBackend
from runtime.nlp.types import NerInferenceResult


def test_llm_backend_default_uses_ollama() -> None:
    backend = LlmBackend()
    assert backend.provider == "ollama"
    assert backend.model_name == "medgemma:7b"


@patch("runtime.nlp.backends.llm.httpx.post")
def test_llm_backend_calls_parthenon_ai_service(mock_post: MagicMock) -> None:
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 0, "end": 10, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = LlmBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")

    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "medgemma:7b"
    assert result.prompt_version == "v0.1.0"
    mock_post.assert_called_once()
    call_url = mock_post.call_args[0][0]
    assert "parthenon-ai-service" in call_url or "ai-service" in call_url
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llm_backend_ollama.py -v
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nlp/backends/__init__.py
```

```python
# templates/runtime/nlp/backends/llm.py
"""LLM backend — Ollama/MedGemma default; cloud OpenAI-compat behind feature flag (Q1)."""
from __future__ import annotations

import os

import httpx

from runtime.nlp.exceptions import LlmBackendError
from runtime.nlp.registry import PromptRegistry
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


class LlmBackend:
    def __init__(
        self,
        registry: PromptRegistry | None = None,
        ai_service_url: str | None = None,
    ) -> None:
        self._registry = registry or PromptRegistry()
        self._ai_service_url = ai_service_url or os.environ.get(
            "PARTHENON_AI_SERVICE_URL", "http://parthenon-ai-service:8002"
        )
        self.provider = "ollama"
        self.model_name = "medgemma:7b"

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        prompt = self._registry.get("clinical_ner_v1", prompt_version)
        try:
            r = httpx.post(
                f"{self._ai_service_url}/v1/ner/infer",
                json={"text": text, "prompt": prompt, "model": self.model_name},
                timeout=120.0,
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise LlmBackendError(f"ollama inference failed: {exc}") from exc

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
uv run pytest tests/unit/test_llm_backend_ollama.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): LlmBackend Ollama/MedGemma path via parthenon-ai-service (Q1)`.

---

## Task 7: `LlmBackend` — cloud OpenAI-compat path

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/llm.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_llm_backend_openai.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_llm_backend_openai.py
"""Cloud OpenAI path is ONLY active when OPENAI_LLM_ENABLED=true."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backends.llm import LlmBackend


def test_cloud_path_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_LLM_ENABLED", raising=False)
    backend = LlmBackend(provider="openai")
    assert backend.provider == "ollama"  # falls back to default


def test_cloud_path_enabled_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    backend = LlmBackend(provider="openai")
    assert backend.provider == "openai"
    assert backend.model_name.startswith("gpt-")


@patch("runtime.nlp.backends.llm.OpenAI")
def test_cloud_path_calls_openai(
    mock_openai: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(
        content='{"spans":[],"mappings":[]}'
    ))]
    mock_openai.return_value.chat.completions.create.return_value = mock_completion

    backend = LlmBackend(provider="openai")
    result = backend.infer("test text", "v0.1.0")
    assert result.model_name.startswith("gpt-")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llm_backend_openai.py -v
```

Expected: FAIL — `LlmBackend.__init__` does not accept `provider` kwarg.

- [ ] **Step 3: Write minimal implementation**

Extend `runtime/nlp/backends/llm.py` to support a cloud branch gated by `OPENAI_LLM_ENABLED=true`. Add a `provider` parameter; if `provider="openai"` AND env flag set AND `OPENAI_API_KEY` present, route through `openai.OpenAI(...).chat.completions.create(...)`. Otherwise fall back to Ollama.

```python
# additions to templates/runtime/nlp/backends/llm.py
import json

from openai import OpenAI


class LlmBackend:
    def __init__(
        self,
        provider: str = "ollama",
        registry: PromptRegistry | None = None,
        ai_service_url: str | None = None,
    ) -> None:
        # ... existing init ...
        self.provider = provider
        if provider == "openai" and os.environ.get("OPENAI_LLM_ENABLED") == "true":
            self.provider = "openai"
            self.model_name = os.environ.get("OPENAI_LLM_MODEL", "gpt-4o-mini")
            self._openai = OpenAI()
        else:
            self.provider = "ollama"
            self.model_name = "medgemma:7b"
            self._openai = None

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        if self.provider == "openai":
            return self._infer_openai(text, prompt_version)
        return self._infer_ollama(text, prompt_version)

    def _infer_openai(self, text: str, prompt_version: str) -> NerInferenceResult:
        prompt = self._registry.get("clinical_ner_v1", prompt_version)
        completion = self._openai.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
        )
        data = json.loads(completion.choices[0].message.content or "{}")
        spans = [NerSpan(**s) for s in data.get("spans", [])]
        mappings = [NerConceptMapping(**m) for m in data.get("mappings", [])]
        return NerInferenceResult(
            spans=spans, mappings=mappings,
            model_name=self.model_name, prompt_version=prompt_version,
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llm_backend_openai.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): LlmBackend cloud OpenAI-compat path behind OPENAI_LLM_ENABLED flag (Q1)`.

---

## Task 8: `LlmBackend` — per-job budget cap

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/backends/llm.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_llm_budget_cap.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_llm_budget_cap.py
"""$OPENAI_BUDGET_USD per-job cap; raises LlmBudgetExceeded once breached. Decision Q11."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backends.llm import LlmBackend
from runtime.nlp.exceptions import LlmBudgetExceeded


@patch("runtime.nlp.backends.llm.OpenAI")
def test_budget_cap_raises_when_exceeded(
    mock_openai: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OPENAI_BUDGET_USD", "0.01")  # 1 cent

    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(
        content='{"spans":[],"mappings":[]}'
    ))]
    mock_completion.usage = MagicMock(prompt_tokens=2_000, completion_tokens=2_000)
    mock_openai.return_value.chat.completions.create.return_value = mock_completion

    backend = LlmBackend(provider="openai")
    # First call: ~$0.005 (under cap)
    backend.infer("text", "v0.1.0")
    # Second call: total ~$0.010 (at cap, allowed)
    backend.infer("text", "v0.1.0")
    # Third call: would exceed → raises
    with pytest.raises(LlmBudgetExceeded):
        backend.infer("text", "v0.1.0")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llm_budget_cap.py -v
```

Expected: FAIL — no budget tracking yet.

- [ ] **Step 3: Write minimal implementation**

Add token-based cost accounting in `runtime/nlp/backends/llm.py`:

```python
# in LlmBackend.__init__
self._budget_usd = float(os.environ.get("OPENAI_BUDGET_USD", "0.0"))
self._spent_usd = 0.0
self._cost_per_1k_prompt = float(os.environ.get("OPENAI_COST_PER_1K_PROMPT", "0.00015"))
self._cost_per_1k_completion = float(os.environ.get("OPENAI_COST_PER_1K_COMPLETION", "0.0006"))


# in _infer_openai before the API call
if self._budget_usd > 0 and self._spent_usd >= self._budget_usd:
    raise LlmBudgetExceeded(
        f"openai job spend ${self._spent_usd:.4f} >= budget ${self._budget_usd:.4f}"
    )

# in _infer_openai after completion
usage = completion.usage
if usage:
    cost = (
        (usage.prompt_tokens or 0) / 1000 * self._cost_per_1k_prompt
        + (usage.completion_tokens or 0) / 1000 * self._cost_per_1k_completion
    )
    self._spent_usd += cost
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_llm_budget_cap.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): LlmBackend per-job budget cap with LlmBudgetExceeded (Q11)`.

---

## Task 9: `NoteNlpAuditWriter` — encrypted raw_input + 30-day TTL

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/audit.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_note_nlp_audit_writer.py`
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Console/Commands/Templates/PruneNoteNlpAuditCommand.php`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_note_nlp_audit_writer.py
"""Audit writer persists encrypted raw_input + sets 30-day TTL. Decision Q5."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from testcontainers.postgres import PostgresContainer

from runtime.nlp.audit import NoteNlpAuditWriter
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


@pytest.fixture(scope="module")
def pg() -> str:
    with PostgresContainer("postgres:16") as ctr:
        engine = create_engine(ctr.get_connection_url())
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA app"))
            conn.execute(text("""
                CREATE TABLE app.note_nlp_audit (
                    id BIGSERIAL PRIMARY KEY,
                    note_nlp_id BIGINT NOT NULL,
                    model_name TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    token_offsets JSONB NOT NULL,
                    concept_mappings JSONB NOT NULL,
                    raw_input TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT now(),
                    ttl_at TIMESTAMP NOT NULL
                )
            """))
        yield ctr.get_connection_url()


@pytest.mark.integration
def test_audit_writer_inserts_and_sets_ttl(pg: str) -> None:
    writer = NoteNlpAuditWriter(dsn=pg, encryption_key=b"0" * 32)
    result = NerInferenceResult(
        spans=[NerSpan(start=0, end=14, text="chest pain", label="condition")],
        mappings=[NerConceptMapping(span_index=0, concept_id=4030518,
                                    vocabulary_id="SNOMED", confidence=0.93)],
        model_name="medgemma:7b",
        prompt_version="v0.1.0",
    )
    audit_id = writer.write(note_nlp_id=42, raw_input="Patient reports chest pain.",
                            result=result)
    assert audit_id > 0

    engine = create_engine(pg)
    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT raw_input, ttl_at, created_at FROM app.note_nlp_audit WHERE id = :id"
        ), {"id": audit_id}).one()

    assert row[0] != "Patient reports chest pain."  # encrypted
    delta = row[1] - row[2]
    assert dt.timedelta(days=29) < delta < dt.timedelta(days=31)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_note_nlp_audit_writer.py -v -m integration
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nlp/audit.py
"""Audit writer for NOTE_NLP inference. Stores encrypted raw_input + 30-day TTL (Q5)."""
from __future__ import annotations

import datetime as dt
import json

from cryptography.fernet import Fernet
from sqlalchemy import create_engine, text

from runtime.nlp.types import NerInferenceResult


class NoteNlpAuditWriter:
    _RETENTION_DAYS = 30

    def __init__(self, dsn: str, encryption_key: bytes) -> None:
        self._engine = create_engine(dsn)
        self._fernet = Fernet(Fernet.generate_key()) if len(encryption_key) != 32 else Fernet(
            __import__("base64").urlsafe_b64encode(encryption_key)
        )

    def write(
        self, *, note_nlp_id: int, raw_input: str, result: NerInferenceResult
    ) -> int:
        encrypted = self._fernet.encrypt(raw_input.encode("utf-8")).decode("ascii")
        ttl_at = dt.datetime.utcnow() + dt.timedelta(days=self._RETENTION_DAYS)
        with self._engine.begin() as conn:
            audit_id = conn.execute(
                text("""
                    INSERT INTO app.note_nlp_audit
                    (note_nlp_id, model_name, prompt_version, token_offsets,
                     concept_mappings, raw_input, ttl_at)
                    VALUES (:nid, :model, :ver, :spans, :maps, :raw, :ttl)
                    RETURNING id
                """),
                {
                    "nid": note_nlp_id,
                    "model": result.model_name,
                    "ver": result.prompt_version,
                    "spans": json.dumps([s.model_dump() for s in result.spans]),
                    "maps": json.dumps([m.model_dump() for m in result.mappings]),
                    "raw": encrypted,
                    "ttl": ttl_at,
                },
            ).scalar_one()
        return int(audit_id)
```

```php
// backend/app/Console/Commands/Templates/PruneNoteNlpAuditCommand.php
<?php

namespace App\Console\Commands\Templates;

use App\Models\App\NoteNlpAudit;
use Illuminate\Console\Command;

class PruneNoteNlpAuditCommand extends Command
{
    protected $signature = 'templates:prune-note-nlp-audit';
    protected $description = 'Truncate raw_input for note_nlp_audit rows past their TTL (Q5).';

    public function handle(): int
    {
        $pruned = NoteNlpAudit::query()
            ->where('ttl_at', '<', now())
            ->whereNotNull('raw_input')
            ->update(['raw_input' => null]);
        $this->info("pruned raw_input on {$pruned} rows");
        return self::SUCCESS;
    }
}
```

Schedule the prune command daily in `app/Console/Kernel.php`:

```php
$schedule->command('templates:prune-note-nlp-audit')->daily();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_note_nlp_audit_writer.py -v -m integration
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
cd /home/smudoshi/Github/Parthenon/backend
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

Expected: all clean. **Commit:** `feat(templates+backend): NoteNlpAuditWriter + 30-day TTL prune command (Q5)`.

---

## Task 10: `NoteNlpNode`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/note_nlp.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_note_nlp_node.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/materializer.py` (register the node type)

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_note_nlp_node.py
"""NoteNlpNode dispatches to backend by params.backend, persists audit row."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from runtime.nodes.note_nlp import NoteNlpNode
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def test_node_dispatches_to_named_backend() -> None:
    backend = MagicMock()
    backend.infer.return_value = NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="cond")],
        mappings=[NerConceptMapping(span_index=0, concept_id=4030518,
                                    vocabulary_id="SNOMED", confidence=0.91)],
        model_name="medgemma:7b", prompt_version="v0.1.0",
    )
    audit = MagicMock()
    audit.write.return_value = 1

    node = NoteNlpNode(backend=backend, audit_writer=audit)
    out = node.run({
        "note_text": "Patient reports chest pain.",
        "note_nlp_id": 42,
        "prompt_version": "v0.1.0",
    })

    assert out["spans"][0]["label"] == "cond"
    backend.infer.assert_called_once()
    audit.write.assert_called_once()


def test_node_rejects_unknown_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError):
        NoteNlpNode.from_config({"backend": "not_a_backend", "prompt_version": "v0.1.0"})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_note_nlp_node.py -v
```

Expected: FAIL — node missing.

- [ ] **Step 3: Write minimal implementation**

```python
# templates/runtime/nodes/note_nlp.py
"""NoteNlpNode — orchestrates a configured NlpBackend + audit writer (T-016)."""
from __future__ import annotations

from typing import Any

from runtime.nlp.audit import NoteNlpAuditWriter
from runtime.nlp.backend import NlpBackend
from runtime.nlp.backends.llm import LlmBackend
from runtime.nodes.base import Node


class NoteNlpNode(Node):
    type_name = "note_nlp"

    def __init__(
        self,
        backend: NlpBackend,
        audit_writer: NoteNlpAuditWriter | None = None,
    ) -> None:
        self._backend = backend
        self._audit = audit_writer

    @classmethod
    def from_config(cls, params: dict[str, Any]) -> "NoteNlpNode":
        which = params.get("backend", "llm")
        if which == "llm":
            backend: NlpBackend = LlmBackend()
        else:
            raise ValueError(f"unknown backend: {which!r}")
        return cls(backend=backend)

    def run(self, inputs: dict[str, Any]) -> dict[str, Any]:
        text = str(inputs["note_text"])
        prompt_version = str(inputs.get("prompt_version", "v0.1.0"))
        result = self._backend.infer(text, prompt_version)
        if self._audit and "note_nlp_id" in inputs:
            self._audit.write(
                note_nlp_id=int(inputs["note_nlp_id"]),
                raw_input=text,
                result=result,
            )
        return {
            "spans": [s.model_dump() for s in result.spans],
            "mappings": [m.model_dump() for m in result.mappings],
            "model_name": result.model_name,
            "prompt_version": result.prompt_version,
        }
```

Register `note_nlp` in `runtime/registry/materializer.py`'s NODE_TYPES dispatch table.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_note_nlp_node.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): NoteNlpNode with backend + audit dispatch (T-016)`.

---

## Task 11: Clinical NER prompt v0.1.0 + JSON schema

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/prompts/v0.1.0/clinical_ner_v1.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nlp/prompts/v0.1.0/clinical_ner_v1.schema.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_clinical_ner_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_clinical_ner_prompt.py
"""Clinical NER prompt + JSON schema both live at v0.1.0; outputs validate."""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema


PROMPT_DIR = Path(__file__).resolve().parents[2] / "runtime" / "nlp" / "prompts" / "v0.1.0"


def test_prompt_has_required_sections() -> None:
    prompt = (PROMPT_DIR / "clinical_ner_v1.md").read_text(encoding="utf-8")
    for required in ("# system", "# instructions", "# output format"):
        assert required.lower() in prompt.lower(), f"prompt missing section: {required}"


def test_prompt_references_omop_vocabularies() -> None:
    prompt = (PROMPT_DIR / "clinical_ner_v1.md").read_text(encoding="utf-8")
    for vocab in ("SNOMED", "RxNorm", "LOINC"):
        assert vocab in prompt, f"prompt should mention vocabulary {vocab}"


def test_json_schema_valid_for_minimal_output() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text())
    jsonschema.validate(
        {"spans": [], "mappings": []},
        schema,
    )


def test_json_schema_rejects_inverted_offsets() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text())
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(
            {"spans": [{"start": 5, "end": 2, "text": "x", "label": "y"}], "mappings": []},
            schema,
        )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_clinical_ner_prompt.py -v
```

Expected: FAIL — prompt is the placeholder; schema file missing.

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder `clinical_ner_v1.md` with a full clinical-NER prompt covering:
- `# system` — role + scope
- `# instructions` — extract Conditions / Drugs / Procedures / Measurements from clinical text
- `# output format` — JSON schema for `{spans: [...], mappings: [...]}`; use SNOMED for conditions/procedures, RxNorm for drugs, LOINC for measurements
- `# constraints` — never fabricate concept_ids; preserve original text offsets exactly

Add `clinical_ner_v1.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["spans", "mappings"],
  "properties": {
    "spans": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["start", "end", "text", "label"],
        "properties": {
          "start": {"type": "integer", "minimum": 0},
          "end": {"type": "integer", "minimum": 1},
          "text": {"type": "string", "minLength": 1},
          "label": {"enum": ["condition", "drug", "procedure", "measurement"]}
        }
      }
    },
    "mappings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["span_index", "concept_id", "vocabulary_id", "confidence"],
        "properties": {
          "span_index": {"type": "integer", "minimum": 0},
          "concept_id": {"type": "integer"},
          "vocabulary_id": {"enum": ["SNOMED", "RxNorm", "LOINC"]},
          "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0}
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_clinical_ner_prompt.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `feat(templates): clinical NER prompt v0.1.0 + JSON schema (Q2)`.

---

## Task 12: `parthenon_ner_llm` manifest + 100-note FHIR DocumentReference fixture

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_llm/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_llm/fixtures/synthetic/build_fixtures.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_llm/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_parthenon_ner_llm_manifest.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_parthenon_ner_llm_manifest.py
"""parthenon_ner_llm manifest is valid + declares prompt_version + required vocabularies."""
from __future__ import annotations

from pathlib import Path

import yaml

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "parthenon_ner_llm" / "manifest.yaml"
)


def test_manifest_loads() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    assert cfg["name"] == "parthenon_ner_llm"


def test_manifest_pins_prompt_version() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    assert cfg["metadata"]["prompt_version"] == "v0.1.0"


def test_manifest_requires_omop_vocabularies() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    required = cfg["metadata"]["required_vocabularies"]
    for v in ("SNOMED", "RxNorm", "LOINC"):
        assert v in required


def test_manifest_declares_note_nlp_node() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in cfg["nodes"]}
    assert "note_nlp" in types
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_parthenon_ner_llm_manifest.py -v
```

Expected: FAIL — manifest does not exist.

- [ ] **Step 3: Write minimal implementation**

Create the manifest. Pipeline stages:
1. `read_documents` (FhirResourceNode reads DocumentReference + dereferences attachments)
2. `extract_text` (sql_node-or-helper to pull document body into NOTE table)
3. `nlp_inference` (NoteNlpNode → spans + mappings + audit)
4. `write_note_nlp` (sql_node — insert into omop.note_nlp)
5. `summarize` (counts)

```yaml
# templates/manifests/parthenon_ner_llm/manifest.yaml
name: parthenon_ner_llm
schema_version: "1.0"
description: |
  Clinical NER over FHIR DocumentReference resources. Extracts conditions,
  drugs, procedures, and measurements; writes OMOP NOTE + NOTE_NLP rows
  with a 30-day encrypted-input audit trail.
metadata:
  cdm_versions: ["5.3", "5.4"]
  prompt_version: v0.1.0
  required_vocabularies:
    - SNOMED
    - RxNorm
    - LOINC
parameters:
  fhir_endpoint:
    type: string
    description: FHIR R4 base URL serving DocumentReference.
    secret: false
  bearer_token:
    type: string
    secret: true
  backend:
    type: string
    default: llm
    enum: [llm]
  prompt_version:
    type: string
    default: v0.1.0
nodes:
  - id: read_documents
    type: fhir_resource
    params:
      endpoint: ${parameters.fhir_endpoint}
      resource_type: DocumentReference
      bearer_token: ${parameters.bearer_token}
  - id: extract_text
    type: sql
    depends_on: [read_documents]
    params:
      sql: file://sql/extract_text.sql
  - id: nlp_inference
    type: note_nlp
    depends_on: [extract_text]
    params:
      backend: ${parameters.backend}
      prompt_version: ${parameters.prompt_version}
  - id: write_note_nlp
    type: sql
    depends_on: [nlp_inference]
    params:
      sql: file://sql/write_note_nlp.sql
  - id: summarize
    type: sql
    depends_on: [write_note_nlp]
    params:
      sql: file://sql/summarize.sql
```

Build the synthetic fixture (~100 FHIR DocumentReference resources, JSON, with realistic clinical-note bodies — written by the `build_fixtures.py` script using a fixed RNG seed).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/unit/test_parthenon_ner_llm_manifest.py -v
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

Expected: all clean. **Commit:** `feat(templates): parthenon_ner_llm manifest + 100-note FHIR fixture (T-017)`.

---

## Task 13: Validation pack — gold standard + ≥90% recall E2E

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_llm/validation/expected/note_nlp_rows.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/parthenon_ner_llm/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_parthenon_ner_llm.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_parthenon_ner_llm.py
"""End-to-end: 100-note fixture → parthenon_ner_llm pipeline → ≥90% recall vs gold."""
from __future__ import annotations

import csv
from pathlib import Path

import pytest

# ... testcontainers + materializer + prefect_backend imports ...


@pytest.mark.integration
def test_parthenon_ner_llm_runs_to_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    # Bootstrap omop + vocab schemas, seed minimal SNOMED/LOINC/RxNorm concepts
    # used in the gold standard, run the pipeline, count rows in omop.note_nlp,
    # compare against gold CSV with ≥90% recall threshold.
    ...
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_parthenon_ner_llm.py -v -m integration
```

Expected: FAIL — manifest pipeline not yet wired against testcontainers.

- [ ] **Step 3: Write minimal implementation**

- Generate the gold-standard CSV from the same fixture script (so the fixture and gold are co-versioned).
- Add `validation/expected/post_conditions.yaml` with row-count ranges.
- Wire the E2E test against testcontainers Postgres + a stubbed `parthenon-ai-service` returning deterministic NER output for the synthetic notes (so the test is reproducible without a live LLM).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_parthenon_ner_llm.py -v -m integration
```

Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
```

Expected: all clean. **Commit:** `test(templates): parthenon_ner_llm E2E with ≥90% recall vs gold standard`.

---

## Task 14: CI live-LLM lane

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/llm_live/test_parthenon_ner_llm_live.py`

- [ ] **Step 1: Write the failing test**

The `llm_live` test calls the real LLM and asserts that the output validates against `clinical_ner_v1.schema.json` for 5 representative notes. Marked `@pytest.mark.llm-live`. By default `pytest -q` skips it.

```python
# templates/tests/llm_live/test_parthenon_ner_llm_live.py
"""Live-LLM canary: 5 notes against the real backend; gated to schedule + dispatch."""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from runtime.nlp.backends.llm import LlmBackend


SCHEMA = json.loads(
    (Path(__file__).resolve().parents[2]
     / "runtime" / "nlp" / "prompts" / "v0.1.0"
     / "clinical_ner_v1.schema.json").read_text(encoding="utf-8")
)


@pytest.mark.llm_live
@pytest.mark.parametrize("note", [
    "Patient reports chest pain radiating to left arm.",
    "Started lisinopril 10mg daily for hypertension.",
    "BP 160/95, HR 88, afebrile.",
    "MRI brain shows no acute infarct.",
    "CBC: Hgb 8.2 (low), WBC 11.5.",
])
def test_live_llm_produces_schema_valid_output(note: str) -> None:
    backend = LlmBackend()
    result = backend.infer(note, "v0.1.0")
    payload = {
        "spans": [s.model_dump() for s in result.spans],
        "mappings": [m.model_dump() for m in result.mappings],
    }
    jsonschema.validate(payload, SCHEMA)
```

- [ ] **Step 2: Add the workflow job**

Add a `ner-live` job to `.github/workflows/templates.yml`, gated to `schedule` + `workflow_dispatch` (mirrors the perf job from PR #262). Set `OPENAI_BUDGET_USD=1.00`. Provide `OPENAI_API_KEY` from a repo secret. Tee output to a build artifact.

```yaml
  ner-live:
    name: NER live-LLM canary (parthenon-templates, slow lane)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: lint-and-test
    env:
      OPENAI_LLM_ENABLED: "true"
      OPENAI_BUDGET_USD: "1.00"
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          version: "0.5.11"
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Sync dependencies
        working-directory: templates
        run: uv sync --all-extras
      - name: Live-LLM canary
        working-directory: templates
        run: |
          mkdir -p _ner_live
          uv run pytest tests/llm_live/ -v -m llm_live --maxfail=1 \
            2>&1 | tee _ner_live/live.log
      - name: Upload canary log
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ner-live-${{ github.run_id }}
          path: templates/_ner_live/live.log
          if-no-files-found: warn
          retention-days: 90
```

- [ ] **Step 3: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
python3 -c "import yaml; yaml.safe_load(open('../.github/workflows/templates.yml'))"
```

Expected: all clean; YAML valid. **Commit:** `ci(templates): NER live-LLM lane gated to schedule + dispatch ($1 budget cap, Q11)`.

---

## Task 15: ADR 0009 — Phase 2 NER node design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0009-phase-2-ner-node-design.md`

- [ ] **Step 1: Draft the ADR**

ADR 0009 covers:
- Context: Phase 2 §1, Q1, Q2, Q5, Q11.
- Decision: Pluggable `NlpBackend` Protocol; `LlmBackend` ships first (Ollama default, OpenAI gated). Prompts version-pinned in `runtime/nlp/prompts/<version>/`. Audit table with encrypted raw_input + 30-day TTL. Live-LLM CI lane in slow-lane only.
- Consequences: Plans 2/3 inherit the ABC + prompt-versioning. NOTE_NLP audit becomes a repository invariant for any clinical-text inference. Live-LLM cost is bounded but introduces a recurring CI charge ($30/month max at $1/job × 30 nights).
- Alternatives considered: cloud-LLM-default (declined for HIPAA posture); inline-prompt-in-manifest (declined for brittleness on long prompts); store-raw-text-forever (declined PHI liability); store-no-raw-text (declined — breaks clinical replay).

- [ ] **Step 2: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon
ls docs/architecture/adr-0009-phase-2-ner-node-design.md
```

Expected: file present + readable.

**Commit:** `docs(adr): ADR 0009 — Phase 2 NER node design`.

---

## Done

After Task 15 lands, Plan 1 is complete. The `parthenon_ner_llm` template is operational with the LLM backend; Plan 2 (SciSpaCy) and Plan 3 (Llettuce eval) can now branch off main and inherit the `NlpBackend` ABC + prompt-versioning conventions.

**Phase 2 progression after this plan:** Plans 2 → 3 (NER chain) parallel with Plans 4 → 5 (MIMIC/ARTEMIS) and Plan 6 (SDTM, fully independent).
