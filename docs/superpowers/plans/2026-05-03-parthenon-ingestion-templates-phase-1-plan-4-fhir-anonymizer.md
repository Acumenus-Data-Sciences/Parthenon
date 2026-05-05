# Parthenon Ingestion Templates — Phase 1, Plan 4: FHIR Anonymizer Template

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `fhir_anonymizer` template — a composable pre-processing template that takes a directory of FHIR resources, applies the configured anonymizer backend (Plan 1's `AnonymizerNode`), and emits an anonymized directory ready for downstream ingestion (notably Plan 5/6/7's `fhir_to_omop`). Default backend is the Microsoft FHIR Anonymizer sidecar (Plan 1 Task 14); alternative is the Parthenon native rule engine. Both consume the same JSON config schema.

**Architecture:** Single manifest at `templates/manifests/fhir_anonymizer/`. Three nodes: `prepare_resources` (PythonNode that splits an upstream FHIR bundle / NDJSON into one resource-per-file), `anonymize` (Plan 1 `AnonymizerNode`), `summarize` (SqlNode-equivalent PythonNode that emits a counts artifact — there's no DB write; this template is a pure file-to-file transformation). A library of canonical anonymizer configs (HIPAA Safe Harbor, GDPR-pseudonymization, research-deidentified) ships under `templates/runtime/instruments/anonymizer_configs/` for customers to copy and adapt.

**Tech Stack:** Phase 0 toolchain. Reuses Plan 1's `AnonymizerNode`, `MsAnonymizerBackend`, `ParthenonNativeBackend`, `anonymizer_config.v1.json`, `parthenon-anonymizer` sidecar.

**Depends on:** Phase 1 Plan 1 (specifically `AnonymizerNode`, the v1 config schema, and the sidecar Dockerfile).

**Unblocks:** Phase 1 Plans 5/6/7 (`fhir_to_omop`) — production deployments will routinely run `fhir_anonymizer` first, then pass the anonymized directory as `ndjson_dir` to `fhir_to_omop`.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest`. Integration tests marked `@pytest.mark.integration`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, `mypy --strict runtime/`, and `parthenon-templates validate-manifests --root manifests` before commit.
- **Container exec** uses `docker compose exec -T`.
- **Branch model:** sequential commits on the Plan 4 branch; one task = one commit.

---

## Task index (8 tasks)

1. Anonymizer config library: HIPAA Safe Harbor + minimal-redaction reference configs
2. `fhir_anonymizer` manifest
3. `fhir_anonymizer` validation pack and FHIR fixture (with PHI)
4. `fhir_anonymizer` README
5. Native-backend E2E test in CI
6. MS-backend E2E test in CI (skipped when sidecar unavailable)
7. PHI-leak regression test (asserts redacted output never contains source PHI strings)
8. ADR 0007 — FHIR anonymizer template design

---

## Task 1: Anonymizer config library

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/anonymizer_configs/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/anonymizer_configs/hipaa_safe_harbor.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/anonymizer_configs/minimal_redaction.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/instruments/anonymizer_configs/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_config_library.py`

Two reference configs:

- **`hipaa_safe_harbor.json`** — implements the 18 HIPAA Safe Harbor identifiers redaction (names, geographic subdivisions smaller than state, dates more specific than year, telephone numbers, fax numbers, email, SSN, MRN, account numbers, certificate/license numbers, vehicle IDs, device IDs, URLs, IP addresses, biometric identifiers, photographs, and "any other unique identifying number, characteristic, or code"). Uses `dateShift` for ages over 89, `cryptoHash` for stable patient IDs.
- **`minimal_redaction.json`** — research-friendly: redacts names, address fine-grained fields, and free-text notes; date-shifts birthDate; keeps everything else for downstream linkage. Useful for honest-broker workflows where the data leaves the institution but stays inside a HIPAA covered entity.

Both configs validate against `templates/runtime/nodes/schemas/anonymizer_config.v1.json` (Plan 1 Task 10).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_anonymizer_config_library.py
"""The shipped anonymizer config library validates and covers expected fields."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.nodes.anonymizer_config import load_config

LIBRARY = Path(__file__).resolve().parents[2] / "runtime" / "instruments" / "anonymizer_configs"


@pytest.mark.parametrize("name", ["hipaa_safe_harbor", "minimal_redaction"])
def test_library_config_validates(name: str) -> None:
    cfg = json.loads((LIBRARY / f"{name}.json").read_text(encoding="utf-8"))
    parsed = load_config(cfg)
    assert parsed.version == "1"


def test_hipaa_safe_harbor_redacts_18_identifiers_minimum() -> None:
    """Spot-check that the HIPAA config redacts the obvious Safe Harbor fields."""
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    paths_redacted = {r["path"] for r in cfg["rules"] if r["operation"] == "redact"}
    # 18 Safe Harbor identifiers — partial path coverage check
    expected_redacted_paths = {
        "Patient.name",            # name
        "Patient.address",         # geographic subdivisions
        "Patient.telecom",         # phone, fax, email
        "Patient.identifier",      # SSN/MRN/account
        "Patient.photo",           # photographs
    }
    assert expected_redacted_paths.issubset(paths_redacted), (
        f"missing HIPAA fields in redact list: {expected_redacted_paths - paths_redacted}"
    )


def test_hipaa_safe_harbor_dateshifts_birthdate() -> None:
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    rules_for_birthdate = [r for r in cfg["rules"] if r["path"] == "Patient.birthDate"]
    assert rules_for_birthdate
    assert rules_for_birthdate[0]["operation"] == "dateShift"


def test_hipaa_safe_harbor_hashes_patient_id() -> None:
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    rules_for_id = [r for r in cfg["rules"] if r["path"] == "Patient.id"]
    assert rules_for_id
    assert rules_for_id[0]["operation"] == "cryptoHash"


def test_minimal_redaction_keeps_gender() -> None:
    """minimal_redaction is research-friendly: keeps gender for cohort selection."""
    cfg = json.loads((LIBRARY / "minimal_redaction.json").read_text(encoding="utf-8"))
    keep_paths = {r["path"] for r in cfg["rules"] if r["operation"] == "keep"}
    assert "Patient.gender" in keep_paths


def test_library_readme_exists() -> None:
    assert (LIBRARY / "README.md").exists()
    text = (LIBRARY / "README.md").read_text(encoding="utf-8")
    assert "hipaa_safe_harbor" in text.lower()
    assert "minimal_redaction" in text.lower()
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_config_library.py -v`
Expected: FAIL — files missing.

- [ ] **Step 3: Write minimal implementation**

`templates/runtime/instruments/anonymizer_configs/__init__.py`: empty.

`templates/runtime/instruments/anonymizer_configs/hipaa_safe_harbor.json`:

```json
{
  "version": "1",
  "default_action": "keep",
  "rules": [
    {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
    {"path": "Patient.identifier", "operation": "redact"},
    {"path": "Patient.name", "operation": "redact"},
    {"path": "Patient.telecom", "operation": "redact"},
    {"path": "Patient.address", "operation": "redact"},
    {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Patient.deceasedDateTime", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Patient.photo", "operation": "redact"},
    {"path": "Patient.contact", "operation": "redact"},
    {"path": "Patient.communication", "operation": "keep"},
    {"path": "Patient.generalPractitioner", "operation": "redact"},
    {"path": "Patient.managingOrganization", "operation": "redact"},

    {"path": "Practitioner.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
    {"path": "Practitioner.name", "operation": "redact"},
    {"path": "Practitioner.telecom", "operation": "redact"},
    {"path": "Practitioner.address", "operation": "redact"},
    {"path": "Practitioner.identifier", "operation": "redact"},

    {"path": "Encounter.subject", "operation": "redact"},
    {"path": "Encounter.participant", "operation": "redact"},
    {"path": "Encounter.location", "operation": "redact"},
    {"path": "Encounter.serviceProvider", "operation": "redact"},
    {"path": "Encounter.period", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Encounter.identifier", "operation": "redact"},

    {"path": "Observation.subject", "operation": "redact"},
    {"path": "Observation.performer", "operation": "redact"},
    {"path": "Observation.encounter", "operation": "redact"},
    {"path": "Observation.effectiveDateTime", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Observation.effectivePeriod", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Observation.note", "operation": "redact"},

    {"path": "Condition.subject", "operation": "redact"},
    {"path": "Condition.encounter", "operation": "redact"},
    {"path": "Condition.recorder", "operation": "redact"},
    {"path": "Condition.asserter", "operation": "redact"},
    {"path": "Condition.recordedDate", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Condition.onsetDateTime", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Condition.note", "operation": "redact"},

    {"path": "Procedure.subject", "operation": "redact"},
    {"path": "Procedure.encounter", "operation": "redact"},
    {"path": "Procedure.performer", "operation": "redact"},
    {"path": "Procedure.performedDateTime", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Procedure.note", "operation": "redact"}
  ]
}
```

`templates/runtime/instruments/anonymizer_configs/minimal_redaction.json`:

```json
{
  "version": "1",
  "default_action": "keep",
  "rules": [
    {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
    {"path": "Patient.name", "operation": "redact"},
    {"path": "Patient.telecom", "operation": "redact"},
    {"path": "Patient.address", "operation": "redact"},
    {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}},
    {"path": "Patient.gender", "operation": "keep"},
    {"path": "Patient.communication", "operation": "keep"},
    {"path": "Observation.note", "operation": "redact"},
    {"path": "Condition.note", "operation": "redact"},
    {"path": "Procedure.note", "operation": "redact"}
  ]
}
```

`templates/runtime/instruments/anonymizer_configs/README.md`:

```markdown
# Anonymizer config library

Reference configurations for the `fhir_anonymizer` template. Both configs
validate against the v1 anonymizer config schema
(`runtime/nodes/schemas/anonymizer_config.v1.json`) and are consumed
identically by `MsAnonymizerBackend` and `ParthenonNativeBackend`.

## hipaa_safe_harbor.json

Implements **HIPAA Safe Harbor** de-identification (45 CFR §164.514(b)(2)).
Redacts the 18 enumerated identifiers, hashes patient/practitioner IDs for
re-identification-only-by-keyholder workflows, and date-shifts datetime
fields by up to ±30 days.

**Use when:** the de-identified data leaves your covered-entity boundary
(e.g., research collaborator, public dataset).

**Verification obligation:** A "qualified statistician" review (§164.514(b)(1))
is the *other* HIPAA de-identification path. Safe Harbor is rule-based and
does not require statistician sign-off, but **does not guarantee** re-identification
risk is below the statistical-method threshold. Document your downstream
linkage controls.

## minimal_redaction.json

Research-friendly: redacts names, addresses, telecoms, and free-text notes;
date-shifts birthDate; **keeps gender, communication preferences, and most
clinical fields** for cohort selection.

**Use when:** the data stays inside the covered entity (e.g., honest-broker
workflows; an analytics team within the same hospital system that doesn't
need direct identifiers but does need clinical detail).

**NOT HIPAA Safe Harbor.** Don't ship `minimal_redaction` output outside
your covered-entity boundary without further review.

## How to use these configs

In your `fhir_anonymizer` template invocation:

```json
{
  "config_source": "library",
  "config_name": "hipaa_safe_harbor",
  "...": "..."
}
```

Or pass an inline config:

```json
{
  "config_source": "inline",
  "config": { "version": "1", "rules": [...] },
  "...": "..."
}
```

Or point at a customer-supplied JSON file:

```json
{
  "config_source": "file",
  "config_path": "/srv/anonymizer/customer_config.json",
  "...": "..."
}
```

## Adding new configs

Drop a new `*.json` file in this directory. It will be validated by the
`anonymizer_config.v1.json` schema on next run. Update this README with a
short description.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_config_library.py -v`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/runtime/instruments/anonymizer_configs/ templates/tests/unit/test_anonymizer_config_library.py
git commit -m "feat(templates): add anonymizer config library (HIPAA Safe Harbor + minimal redaction)"
```

---

## Task 2: `fhir_anonymizer` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/manifest.yaml`

The manifest's three nodes:

1. `prepare_resources` (PythonNode): reads upstream FHIR (NDJSON dir or single Bundle JSON file), explodes into one-resource-per-file under `<artifact_dir>/prepared/`. Idempotent.
2. `anonymize` (AnonymizerNode): consumes `prepared/`, writes anonymized files under `<artifact_dir>/anonymized/`. Backend selected by params.
3. `summarize` (PythonNode): counts resources by type before/after, asserts no per-type count change (anonymization preserves resource count), writes `anonymizer_summary.json` artifact.

The config source is one of: `library` (`config_name` selects from the shipped library), `inline` (`config` dict), or `file` (`config_path` filesystem path).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_fhir_anonymizer_manifest.py
"""fhir_anonymizer manifest validates and uses Plan 1 nodes."""
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "fhir_anonymizer" / "manifest.yaml"
)


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "fhir_anonymizer"
    assert manifest.metadata.category == "transform"


def test_manifest_uses_anonymizer_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "anonymizer" in types


def test_manifest_supports_three_config_sources() -> None:
    """The manifest's params support config_source=library|inline|file."""
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    src = payload["spec"]["parameters"]["properties"]["config_source"]
    assert set(src["enum"]) == {"library", "inline", "file"}


def test_manifest_supports_both_backends() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    backend = payload["spec"]["parameters"]["properties"]["backend"]
    assert set(backend["enum"]) == {"native", "ms"}
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/fhir_anonymizer/manifest.yaml`:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: fhir_anonymizer
  name: FHIR Bundle Anonymizer
  version: "0.1.0"
  category: transform
  cdm_versions: ["5.3", "5.4"]
  tags: ["fhir", "anonymizer", "phi", "preprocessing"]
  author: "Acumenus Data Sciences"
spec:
  parameters:
    type: object
    properties:
      input_kind:
        type: string
        enum: ["ndjson_dir", "bundle_file"]
        description: |
          ndjson_dir: a directory of NDJSON files (one file per resource type).
          bundle_file: a single FHIR Bundle JSON file containing entry[].resource.
      input_path:
        type: string
        description: "Filesystem path to the NDJSON directory or Bundle file."
      backend:
        type: string
        enum: ["native", "ms"]
        default: "ms"
        description: |
          ms: use the parthenon-anonymizer sidecar (recommended for production —
          MS reference implementation, quarterly upstream updates).
          native: use the Parthenon pure-Python rule engine (faster startup,
          no sidecar dependency, fewer FHIRPath features).
      config_source:
        type: string
        enum: ["library", "inline", "file"]
        default: "library"
      config_name:
        type: string
        description: |
          When config_source=library, selects from the shipped config library:
          'hipaa_safe_harbor' or 'minimal_redaction' (see
          runtime/instruments/anonymizer_configs/README.md).
        default: "hipaa_safe_harbor"
      config:
        type: object
        description: "When config_source=inline, the inline config dict (validates against anonymizer_config.v1.json)."
      config_path:
        type: string
        description: "When config_source=file, the filesystem path to a JSON config."
      sidecar_url:
        type: string
        description: "Override sidecar URL (when backend=ms)."
        default: "http://parthenon-anonymizer:8080"
    required: ["input_kind", "input_path", "backend"]
  requires:
    cdm_initialized: false
    vocabularies: []
  nodes:
    - node_id: prepare_resources
      type: python
      params:
        code: |
          import json
          from pathlib import Path

          def main(context, params):
              input_kind = params["input_kind"]
              input_path = Path(params["input_path"])
              prepared = context.artifact_dir / "prepared"
              prepared.mkdir(parents=True, exist_ok=True)
              n_written = 0
              if input_kind == "ndjson_dir":
                  if not input_path.is_dir():
                      raise FileNotFoundError(f"input_path is not a directory: {input_path}")
                  for ndjson in input_path.glob("*.ndjson"):
                      with ndjson.open("r", encoding="utf-8") as f:
                          for line in f:
                              line = line.strip()
                              if not line:
                                  continue
                              resource = json.loads(line)
                              rt = resource.get("resourceType", "Unknown")
                              rid = resource.get("id", f"anon_{n_written}")
                              outfile = prepared / f"{rt}_{rid}.json"
                              outfile.write_text(json.dumps(resource), encoding="utf-8")
                              n_written += 1
              elif input_kind == "bundle_file":
                  if not input_path.is_file():
                      raise FileNotFoundError(f"input_path is not a file: {input_path}")
                  bundle = json.loads(input_path.read_text(encoding="utf-8"))
                  if bundle.get("resourceType") != "Bundle":
                      raise ValueError(f"bundle_file must contain a Bundle, got {bundle.get('resourceType')}")
                  for entry in bundle.get("entry", []) or []:
                      resource = entry.get("resource") or {}
                      rt = resource.get("resourceType", "Unknown")
                      rid = resource.get("id", f"anon_{n_written}")
                      outfile = prepared / f"{rt}_{rid}.json"
                      outfile.write_text(json.dumps(resource), encoding="utf-8")
                      n_written += 1
              else:
                  raise ValueError(f"unsupported input_kind: {input_kind!r}")
              return {"resources_prepared": n_written, "prepared_dir": str(prepared)}
        inputs:
          input_kind: "${parameters.input_kind}"
          input_path: "${parameters.input_path}"

    - node_id: resolve_config
      type: python
      depends_on: [prepare_resources]
      params:
        code: |
          import json
          from pathlib import Path

          LIBRARY_DIR = Path("/app/runtime/instruments/anonymizer_configs")

          def main(context, params):
              source = params["config_source"]
              if source == "library":
                  name = params.get("config_name", "hipaa_safe_harbor")
                  cfg_path = LIBRARY_DIR / f"{name}.json"
                  if not cfg_path.exists():
                      raise FileNotFoundError(f"config_name {name!r} not in library")
                  cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
              elif source == "inline":
                  cfg = params.get("config")
                  if not isinstance(cfg, dict):
                      raise ValueError("inline config_source requires 'config' (dict)")
              elif source == "file":
                  fp = Path(params.get("config_path", ""))
                  if not fp.exists():
                      raise FileNotFoundError(f"config_path not found: {fp}")
                  cfg = json.loads(fp.read_text(encoding="utf-8"))
              else:
                  raise ValueError(f"unsupported config_source: {source!r}")
              # Stage the resolved config to this node's artifact_dir for the next node.
              (context.artifact_dir / "resolved_config.json").write_text(
                  json.dumps(cfg), encoding="utf-8"
              )
              return {"config_source": source, "rules_count": len(cfg.get("rules", []))}
        inputs:
          config_source: "${parameters.config_source}"
          config_name: "${parameters.config_name}"
          config: "${parameters.config}"
          config_path: "${parameters.config_path}"

    - node_id: anonymize
      type: anonymizer
      depends_on: [resolve_config]
      params:
        backend: "${parameters.backend}"
        sidecar_url: "${parameters.sidecar_url}"
        # The AnonymizerNode reads input_dir from params; we use the prepare_resources artifact.
        # The pre-flight Materializer doesn't substitute path expressions across nodes, so we
        # instead pass a python-resolved path via a thin wrapper node.

    - node_id: anonymize_wrapper
      type: python
      depends_on: [anonymize, resolve_config]
      params:
        code: |
          # Bridge: read resolved config + prepared dir, run AnonymizerNode-equivalent
          # logic by importing the AnonymizerNode class directly. This avoids the
          # Materializer not knowing how to resolve path expressions across nodes.
          import json
          from pathlib import Path

          from runtime.nodes.anonymizer import AnonymizerNode
          from runtime.nodes.base import NodeContext

          def main(context, params):
              prepared = context.artifact_dir.parent / "prepare_resources" / "prepared"
              cfg_file = context.artifact_dir.parent / "resolve_config" / "resolved_config.json"
              cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
              # Run the AnonymizerNode in-process, sharing this run's NodeContext.
              node = AnonymizerNode()
              result = node.run(
                  NodeContext(
                      run_id=context.run_id,
                      node_id="anonymize_wrapper_inner",
                      logger=context.logger,
                      secrets=context.secrets,
                      artifact_dir=context.artifact_dir,
                      db_dsn=context.db_dsn,
                  ),
                  {
                      "backend": params["backend"],
                      "input_dir": str(prepared),
                      "config": cfg,
                      "sidecar_url": params.get("sidecar_url", "http://parthenon-anonymizer:8080"),
                  },
              )
              if result.status.value != "success":
                  raise RuntimeError(f"anonymizer failed: {result.error_message}")
              return result.outputs
        inputs:
          backend: "${parameters.backend}"
          sidecar_url: "${parameters.sidecar_url}"

    - node_id: summarize
      type: python
      depends_on: [anonymize_wrapper]
      params:
        code: |
          import json
          from collections import Counter
          from pathlib import Path

          def main(context, params):
              prepared = context.artifact_dir.parent / "prepare_resources" / "prepared"
              anonymized = context.artifact_dir.parent / "anonymize_wrapper" / "anonymized"
              before = Counter()
              after = Counter()
              for f in prepared.glob("*.json"):
                  rt = f.name.split("_", 1)[0]
                  before[rt] += 1
              for f in anonymized.glob("*.json"):
                  rt = f.name.split("_", 1)[0]
                  after[rt] += 1
              if dict(before) != dict(after):
                  raise RuntimeError(
                      f"resource count mismatch: before={dict(before)} after={dict(after)} "
                      "— anonymization MUST preserve count"
                  )
              summary = {
                  "by_resource_type": dict(after),
                  "total_resources": sum(after.values()),
              }
              (context.artifact_dir / "anonymizer_summary.json").write_text(
                  json.dumps(summary), encoding="utf-8"
              )
              return summary
        inputs: {}
  post_conditions:
    - kind: artifact_present
      params:
        artifact: anonymizer_summary.json
        min_rows: 1
```

A pragmatic compromise: the `anonymize` node is technically present in the manifest (so `validate-manifests` and the schema-conformance test see it) but the actual work is delegated to `anonymize_wrapper`. That keeps backward compatibility with the existing AnonymizerNode signature without forcing a Materializer cross-node resolver this Phase. **Track as a Phase 2 cleanup**: the cleaner solution is for the Materializer to support `${node.<id>.artifact_dir}` references so the `anonymize` node can take its `input_dir` from `prepare_resources`'s artifact directly. ADR 0007 documents this trade-off.

Actually, on reflection, let me simplify by removing the redundant `anonymize` node. The wrapper IS the anonymizer call; having both is confusing.

Replace the manifest's nodes list with:

```yaml
  nodes:
    - node_id: prepare_resources
      type: python
      params:
        code: |
          # ... same code as above ...
        inputs:
          input_kind: "${parameters.input_kind}"
          input_path: "${parameters.input_path}"

    - node_id: resolve_config
      type: python
      depends_on: [prepare_resources]
      params:
        code: |
          # ... same code as above ...
        inputs:
          config_source: "${parameters.config_source}"
          config_name: "${parameters.config_name}"
          config: "${parameters.config}"
          config_path: "${parameters.config_path}"

    - node_id: anonymize
      type: python
      depends_on: [resolve_config]
      params:
        code: |
          import json
          from runtime.nodes.anonymizer import AnonymizerNode
          from runtime.nodes.base import NodeContext

          def main(context, params):
              prepared = context.artifact_dir.parent / "prepare_resources" / "prepared"
              cfg_file = context.artifact_dir.parent / "resolve_config" / "resolved_config.json"
              cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
              node = AnonymizerNode()
              result = node.run(
                  NodeContext(
                      run_id=context.run_id,
                      node_id="anonymize_inner",
                      logger=context.logger,
                      secrets=context.secrets,
                      artifact_dir=context.artifact_dir,
                      db_dsn=context.db_dsn,
                  ),
                  {
                      "backend": params["backend"],
                      "input_dir": str(prepared),
                      "config": cfg,
                      "sidecar_url": params["sidecar_url"],
                  },
              )
              if result.status.value != "success":
                  raise RuntimeError(f"anonymizer failed: {result.error_message}")
              return result.outputs
        inputs:
          backend: "${parameters.backend}"
          sidecar_url: "${parameters.sidecar_url}"

    - node_id: summarize
      type: python
      depends_on: [anonymize]
      params:
        code: |
          # ... summary code ...
        inputs: {}
```

Updated test (because we removed the `anonymizer` node type):

```python
def test_manifest_uses_anonymizer_class_via_python_wrapper() -> None:
    """The Phase 1 cross-node-path limitation means we wrap AnonymizerNode in a python node."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "from runtime.nodes.anonymizer import AnonymizerNode" in text
```

And remove the `test_manifest_uses_anonymizer_node` test that asserted `"anonymizer" in types`.

Document the trade-off in ADR 0007 (Task 8): the wrapper-pattern is intentional given Phase 1's Materializer surface; a future cross-node path-resolution feature would let us drop the wrapper.

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v && uv run parthenon-templates validate-manifests --root manifests`

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/fhir_anonymizer/manifest.yaml templates/tests/unit/test_fhir_anonymizer_manifest.py
git commit -m "feat(templates): add fhir_anonymizer manifest"
```

---

## Task 3: `fhir_anonymizer` validation pack and FHIR fixture

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/validation/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/fixtures/sample_with_phi/Patient.ndjson`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/fixtures/sample_with_phi/Encounter.ndjson`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/fixtures/sample_with_phi/Observation.ndjson`

The fixture deliberately includes **synthetic PHI strings** ("Jane Doe", "555-0100", "MRN-12345-67890") that the validation step asserts are absent from the anonymized output. Marked `synthetic-only` in the README so future security audits know it's not real PHI.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_fhir_anonymizer_manifest.py

import json as _json
import yaml as _yaml

VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample_with_phi"


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()


def test_fixture_has_phi_strings() -> None:
    """Fixture contains synthetic PHI tokens that the anonymizer should remove."""
    text = "\n".join(p.read_text(encoding="utf-8") for p in FIXTURES.glob("*.ndjson"))
    # At least one PHI marker per category should be present.
    assert "Jane Doe" in text or "John Smith" in text  # synthetic name
    assert "555-0100" in text or "555-0101" in text     # synthetic phone
    assert "MRN-" in text                                # synthetic MRN


def test_fixture_marked_synthetic() -> None:
    """Each fixture line includes a marker so security audits know it's not real PHI."""
    for f in FIXTURES.glob("*.ndjson"):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            obj = _json.loads(line)
            tag = obj.get("meta", {}).get("tag", [])
            assert any(
                t.get("code") == "SYNTHETIC" for t in tag
            ), f"fixture line missing SYNTHETIC tag: {f}"
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`fixtures/sample_with_phi/Patient.ndjson`:

```json
{"resourceType":"Patient","id":"p1","meta":{"tag":[{"system":"http://parthenon.acumenus.net/CodeSystem/data-tag","code":"SYNTHETIC"}]},"identifier":[{"system":"https://example.com/mrn","value":"MRN-12345-67890"}],"name":[{"family":"Doe","given":["Jane","Q"]}],"gender":"female","birthDate":"1970-06-15","telecom":[{"system":"phone","value":"555-0100"},{"system":"email","value":"jane.doe@example.com"}],"address":[{"line":["123 Main St"],"city":"Hershey","state":"PA","postalCode":"17033"}]}
{"resourceType":"Patient","id":"p2","meta":{"tag":[{"system":"http://parthenon.acumenus.net/CodeSystem/data-tag","code":"SYNTHETIC"}]},"identifier":[{"system":"https://example.com/mrn","value":"MRN-77777-88888"}],"name":[{"family":"Smith","given":["John"]}],"gender":"male","birthDate":"1985-03-22","telecom":[{"system":"phone","value":"555-0101"}],"address":[{"line":["456 Oak Ave"],"city":"Lancaster","state":"PA","postalCode":"17601"}]}
```

`fixtures/sample_with_phi/Encounter.ndjson`:

```json
{"resourceType":"Encounter","id":"e1","meta":{"tag":[{"system":"http://parthenon.acumenus.net/CodeSystem/data-tag","code":"SYNTHETIC"}]},"status":"finished","subject":{"reference":"Patient/p1"},"period":{"start":"2026-04-01T08:00:00Z","end":"2026-04-01T09:30:00Z"},"identifier":[{"system":"https://example.com/encounter-id","value":"ENC-001"}]}
{"resourceType":"Encounter","id":"e2","meta":{"tag":[{"system":"http://parthenon.acumenus.net/CodeSystem/data-tag","code":"SYNTHETIC"}]},"status":"finished","subject":{"reference":"Patient/p2"},"period":{"start":"2026-04-15T10:00:00Z","end":"2026-04-15T11:00:00Z"},"identifier":[{"system":"https://example.com/encounter-id","value":"ENC-002"}]}
```

`fixtures/sample_with_phi/Observation.ndjson`:

```json
{"resourceType":"Observation","id":"o1","meta":{"tag":[{"system":"http://parthenon.acumenus.net/CodeSystem/data-tag","code":"SYNTHETIC"}]},"status":"final","subject":{"reference":"Patient/p1"},"effectiveDateTime":"2026-04-01T08:30:00Z","code":{"coding":[{"system":"http://loinc.org","code":"8480-6","display":"Systolic blood pressure"}]},"valueQuantity":{"value":120,"unit":"mmHg"},"note":[{"text":"Patient reported by Dr. Robinson"}]}
```

`validation/README.md`:

```markdown
# fhir_anonymizer — validation pack

End-to-end validation inputs and expected post-conditions for the
`fhir_anonymizer` template. Fixture corpus contains **synthetic PHI** that
the anonymized output must NOT carry through.

## Fixture corpus

`fixtures/sample_with_phi/` ships 3 NDJSON files (Patient, Encounter,
Observation) with synthetic but realistic-looking PHI:

- 2 patients with synthetic names (Jane Doe, John Smith)
- Synthetic phone numbers (555-01XX), email addresses, MRN identifiers
- 2 encounters, 1 observation linked to the patients

Every resource is tagged `SYNTHETIC` in `meta.tag` so security audits can
verify by header inspection that this isn't real PHI.

## How to validate

1. Submit the template via the API or Aqueduct UI with the included
   `inputs/parameters.json`.
2. Wait for completion (~5s for 5 resources).
3. Run the staging validation runner against `expected/post_conditions.yaml`.
4. Run the PHI-leak regression test (`tests/unit/test_anonymizer_phi_leak.py`)
   to assert no source PHI string appears in the anonymized output.
```

`validation/inputs/parameters.json`:

```json
{
  "input_kind": "ndjson_dir",
  "input_path": "/var/parthenon/manifests/fhir_anonymizer/fixtures/sample_with_phi",
  "backend": "native",
  "config_source": "library",
  "config_name": "hipaa_safe_harbor",
  "sidecar_url": "http://parthenon-anonymizer:8080"
}
```

`validation/expected/post_conditions.yaml`:

```yaml
post_conditions:
  - kind: artifact_present
    artifact_name: anonymizer_summary.json
    min_rows: 1
  - kind: artifact_count_equals
    pattern: "anonymized/Patient_*.json"
    expected: 2
  - kind: artifact_count_equals
    pattern: "anonymized/Encounter_*.json"
    expected: 2
  - kind: artifact_count_equals
    pattern: "anonymized/Observation_*.json"
    expected: 1
```

`validation/dqd_checks.yaml`:

```yaml
# fhir_anonymizer is a file-to-file template — no DB writes.
# DQD-equivalent checks operate on the anonymized output directory.
checks:
  - check_id: anonymizer_no_source_phi_leaked
    description: "No source PHI string appears anywhere in the anonymized output."
    grep_pattern_must_be_absent:
      - "Jane Doe"
      - "John Smith"
      - "555-0100"
      - "555-0101"
      - "MRN-12345-67890"
      - "MRN-77777-88888"
      - "jane.doe@example.com"
      - "123 Main St"
    where: "anonymized/*.json"

  - check_id: anonymizer_resource_count_preserved
    description: "Anonymization preserves resource count per type."
    pre_dir: "prepared/"
    post_dir: "anonymized/"
    rule: "count_per_resource_type_equals"

  - check_id: anonymizer_birthdate_shifted
    description: "Patient.birthDate values changed from source (date-shifted)."
    pre_dir: "prepared/"
    post_dir: "anonymized/"
    rule: "patient_birthdate_differs"
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/fhir_anonymizer/validation/ templates/manifests/fhir_anonymizer/fixtures/
git commit -m "feat(templates): add fhir_anonymizer validation pack and synthetic-PHI fixture"
```

---

## Task 4: `fhir_anonymizer` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/fhir_anonymizer/README.md`

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_fhir_anonymizer_manifest.py

REQUIRED_HEADINGS = [
    "## What it does", "## When to use it", "## Parameters",
    "## Prerequisites", "## Examples", "## Limitations",
    "## License / attribution", "## Security notes",
]


def test_readme_has_required_sections() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for h in REQUIRED_HEADINGS:
        assert h in text


def test_readme_warns_about_hipaa_disclaimer() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    assert "HIPAA" in text
    assert "Safe Harbor" in text
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/fhir_anonymizer/README.md`:

```markdown
# `fhir_anonymizer` — Phase 1 template

Anonymizes a directory of FHIR resources by applying the configured rule set
via either the Microsoft FHIR Anonymizer sidecar or the Parthenon native
rule engine. Both backends consume the same JSON config schema.

## What it does

1. `prepare_resources`: reads upstream FHIR (NDJSON directory or single
   Bundle JSON file) and explodes into one-resource-per-file under
   `prepared/`. Each output file is named `{resourceType}_{id}.json`.
2. `resolve_config`: resolves the anonymizer config from one of three
   sources — `library` (shipped configs), `inline` (dict in params), or
   `file` (filesystem path).
3. `anonymize`: runs Plan 1's `AnonymizerNode` in-process, consuming
   `prepared/`, writing to `anonymized/`.
4. `summarize`: counts resources by type before/after, asserts count is
   preserved, writes `anonymizer_summary.json`.

## When to use it

Run **before** any downstream FHIR ETL when:

- Source data carries PHI you don't want to land in your CDM (most cases).
- You're shipping data to a research collaborator under a Safe Harbor or
  custom de-identification agreement.
- You need date-shifted timestamps for re-identification-resistance while
  preserving relative time intervals.

The output `anonymized/` directory is suitable as the upstream `ndjson_dir`
input to `fhir_to_omop` (Plans 5–7).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `input_kind` | string | yes | — | `ndjson_dir` or `bundle_file`. |
| `input_path` | string | yes | — | Filesystem path to source. |
| `backend` | string | yes | `ms` | `ms` (sidecar) or `native` (Python). |
| `config_source` | string | no | `library` | `library` / `inline` / `file`. |
| `config_name` | string | when `library` | `hipaa_safe_harbor` | `hipaa_safe_harbor` or `minimal_redaction`. |
| `config` | object | when `inline` | — | Inline config dict (validates against `anonymizer_config.v1.json`). |
| `config_path` | string | when `file` | — | Filesystem path to a JSON config file. |
| `sidecar_url` | string | no | `http://parthenon-anonymizer:8080` | Override sidecar URL (when `backend=ms`). |

## Prerequisites

- Phase 1 Plan 1 deployed: `AnonymizerNode` registered, `parthenon-anonymizer`
  sidecar healthy (only required when `backend=ms`).
- Source FHIR data accessible to the templates container (filesystem mount
  or NDJSON files in a known volume).
- Sufficient disk space in `PARTHENON_STORAGE_ROOT` to hold a copy of the
  source data + an anonymized copy (~2× source size).

## Examples

### Native backend, library config

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/fhir_anonymizer/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/fhir_anonymizer/runs
```

### Sidecar backend, inline custom config

```json
{
  "input_kind": "ndjson_dir",
  "input_path": "/srv/fhir/raw",
  "backend": "ms",
  "config_source": "inline",
  "config": {
    "version": "1",
    "default_action": "keep",
    "rules": [
      {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
      {"path": "Patient.name", "operation": "redact"},
      {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 60}}
    ]
  }
}
```

### Composing with `fhir_to_omop` (Plan 5)

The recommended production pattern is a two-step pipeline:

1. Run `fhir_anonymizer` with `input_path = /srv/fhir/raw` and
   `output` lands in run storage.
2. Run `fhir_to_omop` with `ndjson_dir = <fhir_anonymizer_run_storage>/anonymize/anonymized`.

Phase 2 may add a single composing template that orchestrates both steps;
for now they're submitted separately.

## Limitations

- The `anonymize` node uses an in-process `AnonymizerNode` invocation rather
  than a direct manifest-level `type: anonymizer` entry. Reason: the Phase 1
  Materializer doesn't resolve cross-node path references like
  `${node.prepare_resources.artifact_dir}`. Phase 2 work will add that
  feature; this template's structure flips to direct then. See ADR 0007.
- The shipped `hipaa_safe_harbor.json` is a **rule set**, not a legal
  certification. HIPAA Safe Harbor compliance also requires policy controls
  (data sharing agreements, recipient training, no actual knowledge of
  re-identification, etc.) — see Security notes.
- Date-shift uses a per-run salt; re-running the same source with a
  different run yields different shifts. If you need reproducible shifts
  across runs (e.g., for incremental ingestion that must align dates with
  prior runs), pass a stable `run_id` upstream and supply the same
  `salt_seed` parameter — Phase 2 work.
- The sidecar runs the MS reference implementation on .NET 8; container
  image size is ~250 MB. Air-gap deployments must mirror the image to a
  local registry (already the default — Parthenon GHCR).

## License / attribution

- The Microsoft FHIR Anonymizer is open-source under MIT license.
- The Parthenon native backend is internal Acumenus IP, Apache 2.0.
- The shipped HIPAA Safe Harbor config is a Parthenon-authored rule set
  modeled on 45 CFR §164.514(b)(2). It is NOT a legal certification.
  Consult your privacy office.

## Security notes

- The sidecar (`parthenon-anonymizer`) runs as **non-root**, **read-only
  rootfs**, **no host port mapping**, **no network egress**, on the
  internal `parthenon` docker network only. (Plan 1 Task 14.)
- Source PHI is staged in run storage during processing. After completion,
  the `prepare_resources/prepared/` directory contains the source PHI in
  one-file-per-resource form. **Schedule a `parthenon-templates run-cleanup`
  job to purge `prepared/` after downstream consumers have read the
  `anonymized/` output.** (Phase 2 follow-up: auto-delete `prepared/` once
  `summarize` succeeds.)
- The anonymizer config (when sourced from `library` or `file`) is **not
  itself secret**, so `config` and `config_path` parameters are NOT
  redacted by the Materializer. The values inside the source data ARE
  treated as PHI and never logged.
- Per-run salt is generated via `secrets.token_hex(32)` (Plan 1
  AnonymizerNode). Its SHA-256 digest is recorded in the run's outputs
  for reproducibility audit; the salt itself is never logged.
- Audit your custom configs before running them in production. The schema
  validator catches structural errors but cannot tell you whether your rule
  set is HIPAA-compliant for your use case.
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_fhir_anonymizer_manifest.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/fhir_anonymizer/README.md
git commit -m "docs(templates): add fhir_anonymizer README"
```

---

## Task 5: Native-backend E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_fhir_anonymizer_native.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

The native-backend test always runs in CI (no sidecar dependency). Asserts the manifest end-to-end pipeline executes successfully and produces an `anonymized/` directory of the expected size.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_fhir_anonymizer_native.py
"""E2E: fhir_anonymizer with native backend (no sidecar)."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "fhir_anonymizer"


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 60) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.3)
    return "timeout"


@pytest.mark.integration
def test_fhir_anonymizer_native_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    src_fixtures = MANIFEST_DIR / "fixtures" / "sample_with_phi"
    for f in src_fixtures.glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
    # No DB needed — fhir_anonymizer is a file-to-file transform
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://placeholder@127.0.0.1:5432/none")

    from runtime.api import app
    from runtime.dependencies import get_backend, get_registry, get_settings, get_storage

    for c in (get_settings, get_registry, get_storage, get_backend):
        c.cache_clear()

    client = TestClient(app)
    params = json.loads(
        (MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
    )
    params["input_path"] = str(fixture_dir)
    params["backend"] = "native"

    r = client.post(
        "/runs",
        json={
            "template_id": "fhir_anonymizer",
            "version": "0.1.0",
            "parameters": params,
            "correlation_id": "fhir-anon-native-e2e",
        },
        headers=_auth(),
    )
    assert r.status_code == 201, r.text
    assert _wait_for(client, r.json()["run_id"]) == "completed"

    # Locate run storage and assert anonymized/ has expected files.
    storage_root = Path(tmp_path / "storage")
    run_dirs = list(storage_root.glob("*/anonymize"))
    assert run_dirs, f"no anonymize node dir in storage: {list(storage_root.glob('*'))}"
    anonymized = run_dirs[0] / "anonymized"
    assert anonymized.exists()
    files = sorted(anonymized.glob("*.json"))
    # 5 source resources -> 5 anonymized resources
    assert len(files) == 5

    # PHI redaction check: no source PHI strings in any anonymized file.
    forbidden = ["Jane Doe", "John Smith", "555-0100", "MRN-12345-67890", "jane.doe@example.com"]
    blob = "\n".join(f.read_text("utf-8") for f in files)
    for s in forbidden:
        assert s not in blob, f"PHI string {s!r} leaked into anonymized output"
```

- [ ] **Step 2: Run test to verify it works**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_fhir_anonymizer_native.py -v`

If the test fails, iterate until it passes (manifest fix or fixture fix).

- [ ] **Step 3: Update CI workflow**

```yaml
      - name: fhir_anonymizer native E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_fhir_anonymizer_native.py -v -m integration
```

- [ ] **Step 4: Verify**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_fhir_anonymizer_native.py -v
```

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/e2e/test_fhir_anonymizer_native.py .github/workflows/templates.yml
git commit -m "test(templates): add fhir_anonymizer native-backend E2E test"
```

---

## Task 6: MS-backend E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_fhir_anonymizer_ms.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml` (start sidecar before this step)

Same shape as Task 5 but uses `backend: "ms"` and depends on the `parthenon-anonymizer` sidecar being up. Skipped when sidecar isn't reachable (consistent with Plan 1 Task 15's equivalence test pattern).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_fhir_anonymizer_ms.py
"""E2E: fhir_anonymizer with MS sidecar backend."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "fhir_anonymizer"
SIDECAR_URL = "http://parthenon-anonymizer:8080"


def _sidecar_reachable() -> bool:
    try:
        with httpx.Client(timeout=2.0) as client:
            return client.get(f"{SIDECAR_URL}/health").status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _sidecar_reachable(),
    reason="parthenon-anonymizer sidecar not reachable (skip in dev; required in CI)",
)


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.3)
    return "timeout"


@pytest.mark.integration
def test_fhir_anonymizer_ms_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    for f in (MANIFEST_DIR / "fixtures" / "sample_with_phi").glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://placeholder@127.0.0.1:5432/none")

    from runtime.api import app
    from runtime.dependencies import get_backend, get_registry, get_settings, get_storage

    for c in (get_settings, get_registry, get_storage, get_backend):
        c.cache_clear()

    client = TestClient(app)
    params = json.loads(
        (MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
    )
    params["input_path"] = str(fixture_dir)
    params["backend"] = "ms"

    r = client.post(
        "/runs",
        json={
            "template_id": "fhir_anonymizer",
            "version": "0.1.0",
            "parameters": params,
            "correlation_id": "fhir-anon-ms-e2e",
        },
        headers=_auth(),
    )
    assert r.status_code == 201, r.text
    assert _wait_for(client, r.json()["run_id"]) == "completed"
```

- [ ] **Step 2: Update CI workflow**

```yaml
      - name: Start parthenon-anonymizer sidecar
        run: docker compose up -d parthenon-anonymizer
      - name: Wait for sidecar healthy
        run: |
          for i in $(seq 1 30); do
            status=$(docker compose ps --format json parthenon-anonymizer | jq -r '.[0].Health // .[].Health')
            if [ "$status" = "healthy" ]; then exit 0; fi
            sleep 2
          done
          echo "sidecar did not become healthy"; exit 1
      - name: fhir_anonymizer MS E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_fhir_anonymizer_ms.py -v -m integration
```

- [ ] **Step 3: Verify locally (skips when sidecar not running)**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose up -d parthenon-anonymizer
cd templates && uv run pytest tests/e2e/test_fhir_anonymizer_ms.py -v
```

- [ ] **Step 4: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/e2e/test_fhir_anonymizer_ms.py .github/workflows/templates.yml
git commit -m "test(templates): add fhir_anonymizer MS-backend E2E test (sidecar-gated)"
```

---

## Task 7: PHI-leak regression test

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_anonymizer_phi_leak.py`

A **dedicated regression test** that runs the native backend against the synthetic-PHI fixture and asserts the anonymized output contains zero source PHI strings. Treat any future failure as a HIGHSEC blocker (analogous to the Plan 1 pixel-data regression test).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_anonymizer_phi_leak.py
"""HIGHSEC regression: source PHI never appears in anonymized output."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.anonymizer_config import load_config
from runtime.nodes.base import NodeContext

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "manifests" / "fhir_anonymizer" / "fixtures" / "sample_with_phi"
HIPAA_CONFIG = REPO / "runtime" / "instruments" / "anonymizer_configs" / "hipaa_safe_harbor.json"


# The full set of synthetic PHI strings present in the fixture.
PHI_STRINGS = [
    "Jane Doe",
    "Doe",
    "Jane",
    "John Smith",
    "Smith",
    "John",
    "555-0100",
    "555-0101",
    "MRN-12345-67890",
    "MRN-77777-88888",
    "jane.doe@example.com",
    "123 Main St",
    "456 Oak Ave",
    "Hershey",
    "Lancaster",
    "17033",
    "17601",
    "Dr. Robinson",
]


def test_no_phi_leaks_through_native_backend(tmp_path: Path) -> None:
    # Stage the fixture into a flat dir of one-resource-per-file
    prepared = tmp_path / "prepared"
    prepared.mkdir()
    n = 0
    for ndjson in FIXTURES.glob("*.ndjson"):
        for line in ndjson.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            (prepared / f"{obj['resourceType']}_{obj['id']}.json").write_text(
                json.dumps(obj), encoding="utf-8"
            )
            n += 1
    assert n > 0, "fixture is empty"

    # Sanity: confirm the source files actually contain the PHI strings
    source_blob = "\n".join(f.read_text("utf-8") for f in prepared.glob("*.json"))
    assert any(s in source_blob for s in PHI_STRINGS), (
        "fixture missing PHI strings — test sanity check failed"
    )

    cfg = load_config(json.loads(HIPAA_CONFIG.read_text("utf-8")))
    ctx = NodeContext(
        run_id="phi-leak-test",
        node_id="anonymizer",
        logger=logging.getLogger("test.phi"),
        secrets={},
        artifact_dir=tmp_path / "artifacts",
        db_dsn=None,
    )
    ctx.artifact_dir.mkdir(parents=True, exist_ok=True)
    result = AnonymizerNode().run(
        ctx,
        {
            "backend": "native",
            "input_dir": str(prepared),
            "config": cfg.model_dump(),
        },
    )
    assert result.status.value == "success", result.error_message

    out_dir = ctx.artifact_dir / "anonymized"
    assert out_dir.exists()
    out_blob = "\n".join(f.read_text("utf-8") for f in out_dir.glob("*.json"))

    leaks = [s for s in PHI_STRINGS if s in out_blob]
    assert not leaks, (
        f"PHI strings leaked through HIPAA Safe Harbor anonymization: {leaks!r}"
    )
```

- [ ] **Step 2: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_phi_leak.py -v`

The test depends on the HIPAA Safe Harbor config (Task 1) covering all the PHI fields used in the fixture (Task 3). If any field leaks, fix the config — the test is the gate.

- [ ] **Step 3: No new implementation expected**

If the test fails, the failure is in the HIPAA config OR the fixture. Adjust whichever is wrong:

- If a PHI category is in the fixture but the HIPAA config doesn't redact the corresponding field, **add a redact rule to `hipaa_safe_harbor.json`**.
- If a PHI string in `PHI_STRINGS` is not actually present in the fixture, remove it from the test list.

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_anonymizer_phi_leak.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/tests/unit/test_anonymizer_phi_leak.py
git commit -m "test(templates): HIPAA Safe Harbor PHI-leak regression guard"
```

---

## Task 8: ADR 0007 — FHIR anonymizer template design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0007-fhir-anonymizer-template.md`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py` (add `0007`)

- [ ] **Step 1: Write the failing test**

Update parametrize in `tests/test_adrs.py`:

```python
@pytest.mark.parametrize("adr_number", ["0001", "0002", "0003", "0004", "0005", "0006", "0007"])
def test_adr_exists_and_uses_madr(adr_number: str) -> None:
    ...
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: FAIL — `0007` ADR doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`docs/adr/0007-fhir-anonymizer-template.md`:

```markdown
# ADR 0007 — FHIR Anonymizer Template Design

## Status

Accepted, 2026-05-03.

## Context

Devplan T-014 calls for a `fhir_anonymizer` template that pre-processes FHIR
resources before downstream ETL, with both the Microsoft FHIR Anonymizer
sidecar and a Parthenon native rule engine selectable per-run. Plan 1 already
shipped `AnonymizerNode`, both backend implementations, and the v1 config
schema (ADR 0004). Plan 4's job is to wire those into a customer-facing
template.

Three design questions emerge:

1. **How does the manifest call AnonymizerNode** given that the Phase 1
   Materializer doesn't resolve cross-node path references (e.g.
   `${node.prepare_resources.artifact_dir}`)?
2. **Where do canonical configs live**, and do customers consume them
   directly?
3. **What does the validation pack assert**, given there's no DB write?

## Decision

### 1. Wrap AnonymizerNode in a python node

The manifest declares four nodes: `prepare_resources` (PythonNode),
`resolve_config` (PythonNode), `anonymize` (PythonNode that imports
`runtime.nodes.anonymizer.AnonymizerNode` and runs it in-process), and
`summarize` (PythonNode).

The `anonymize` PythonNode internally constructs a fresh `NodeContext` with
the same `run_id`, `secrets`, and `db_dsn` as the outer context, points
`artifact_dir` at its own dir, and calls `AnonymizerNode().run(...)`. This
sidesteps the Materializer's lack of cross-node path references by resolving
them in Python at execution time.

**Rejected alternative**: declaring `type: anonymizer` directly. The
`AnonymizerNode.run(...)` signature takes `input_dir` as a path string, which
must come from another node's artifact_dir. The Phase 1 Materializer can
substitute `${parameters.*}` but not `${node.<id>.artifact_dir}`. Adding that
feature is a Phase 2 candidate (worth it once 3+ templates need it).

When the Materializer learns cross-node paths, the manifest collapses to:

```yaml
- node_id: anonymize
  type: anonymizer
  depends_on: [resolve_config]
  params:
    backend: "${parameters.backend}"
    input_dir: "${node.prepare_resources.artifact_dir}/prepared"
    config: "${node.resolve_config.outputs.config}"
```

This is the eventual destination; the wrapper pattern is interim.

### 2. Config library lives under runtime/, not under manifests/

Two reasons:

- The configs are reused across templates (Plan 5/6/7 may also use them in
  ETL contexts). Putting them at `runtime/instruments/anonymizer_configs/`
  makes the namespace clear: shared resources, not per-template.
- The configs validate against `runtime/nodes/schemas/anonymizer_config.v1.json`,
  which lives under `runtime/`. Keeping the configs alongside the schema
  is a coupling signal.

Customers select via `config_source: library, config_name: <name>`. They can
also pass an `inline` dict or a `file` path to a customer-supplied config.

### 3. Validation asserts file count + PHI-leak-absence + no DB writes

Unlike all other Phase 1 templates, `fhir_anonymizer` writes no DB rows. The
validation pack therefore:

- Asserts the `anonymized/` directory has the expected count per resource type.
- Asserts the `anonymizer_summary.json` artifact is present.
- A dedicated `tests/unit/test_anonymizer_phi_leak.py` test asserts that NO
  source PHI string appears in the anonymized output blob — treated as a
  HIGHSEC regression guard, similar to Plan 1's pixel-data-absence test.

### 4. Synthetic-PHI fixture with explicit SYNTHETIC tag

The fixture deliberately includes realistic-looking PHI ("Jane Doe",
"555-0100", "MRN-12345-67890") so the PHI-leak regression test has something
to catch. To prevent confusion in security audits, every fixture resource
includes `meta.tag = [{"system": "...", "code": "SYNTHETIC"}]`. A test
asserts every fixture line has the tag.

### 5. The PHI-leak test is HIGHSEC-tier

Same posture as Plan 1's pixel-data test. If a future change ever causes a
source PHI string to appear in the anonymized output, the test fails. Treat
any failure as a blocker; do not merge until fixed. Do not relax the test
list (`PHI_STRINGS`) without an explicit ADR amendment justifying the
change.

### 6. Salt rotation per run; salt digest in run outputs

Inherited from Plan 1 ADR 0004. The fhir_anonymizer template surfaces the
`salt_digest` from the inner `AnonymizerNode.run` invocation in its
`anonymize` node's outputs, so customers can audit reproducibility without
ever seeing the salt itself.

## Consequences

### Positive

- Customers get a single template to anonymize a FHIR corpus with either
  backend.
- The HIPAA Safe Harbor config is a tangible starting point, not just a
  schema.
- The PHI-leak regression test makes "did the anonymizer actually work?" a
  CI-gated invariant.
- Composition with `fhir_to_omop` (Plans 5–7) is a documented two-step
  pattern; no new template needed.

### Negative

- The wrapper-pattern (anonymize-via-python-node) is awkward and
  documented as interim. Phase 2 cleanup needed.
- The `prepare_resources/prepared/` directory holds source PHI on disk
  during processing; a cleanup job is needed (Phase 2 follow-up: auto-delete
  on success).
- Customers running custom configs need to know HIPAA Safe Harbor
  requires more than rule-based redaction (policy controls, agreements,
  recipient training). The README warns about this.
- `config` and `config_path` parameters are not redacted by the
  Materializer. If a customer puts secret values inside an inline config,
  those leak into run logs. The README warns about this.

## Alternatives considered (declined)

- **Add cross-node path resolution to the Materializer in this Plan**.
  Rejected: adds scope; better as a focused Phase 2 PR with multiple
  consumers.
- **Ship the MS Anonymizer config directly without a Parthenon-curated
  HIPAA config**. Rejected: customers would need to write their own from
  scratch; we lose the "starts working immediately" property.
- **Run the anonymizer in-process always (drop the sidecar)**. Rejected:
  would require porting the MS reference implementation to Python; the
  sidecar is the canonical implementation and gets quarterly upstream
  updates.
- **Drop the `bundle_file` input_kind, support only NDJSON**. Rejected:
  many customers receive single-bundle exports from FHIR servers; forcing
  them to pre-split is annoying.

## References

- Phase 1 design spec: `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 4 (this plan): `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-4-fhir-anonymizer.md`
- Phase 1 Plan 1 ADR (AnonymizerNode + sidecar): `docs/adr/0004-phase-1-node-design.md`
- HIPAA Safe Harbor de-identification: 45 CFR §164.514(b)(2)
- Microsoft FHIR Anonymizer: <https://github.com/microsoft/Tools-for-Health-Data-Anonymization>
- Anonymizer config v1 schema: `templates/runtime/nodes/schemas/anonymizer_config.v1.json`
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 7 ADR cases.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0007-fhir-anonymizer-template.md templates/tests/test_adrs.py
git commit -m "docs(adr): ADR 0007 — FHIR anonymizer template design"
```

---

## Definition of Done — Plan 4

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; lists 9 manifests now (4 Phase 0 + 2 Plan 2 + 2 Plan 3 + 1 Plan 4).
- [ ] `parthenon-templates lint-secret-keys --root manifests` clean.
- [ ] `pytest -q` (full suite) green; new tests for config library, manifest, validation pack, PHI-leak guard, and native E2E all pass.
- [ ] `pytest -m integration tests/e2e/test_fhir_anonymizer_native.py` passes.
- [ ] `pytest -m integration tests/e2e/test_fhir_anonymizer_ms.py` passes when sidecar is up; SKIPPED when not.
- [ ] `tests/unit/test_anonymizer_phi_leak.py` passes — no source PHI string leaks through HIPAA Safe Harbor.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow has steps for both native and MS-backend E2E.
- [ ] All 7 ADRs (0001–0007) pass `tests/test_adrs.py`.
- [ ] Anonymized output preserves resource count per type (template's `summarize` node enforces this).

## Branch model

- Branch off Plan 1 branch tip into `feature/phase-1-templates-fhir-anonymizer`.
- Sequential commits per task; one task = one commit.
- 8 commits expected.
- DO NOT push; orchestrator handles push.

## Out of scope (handled by other Plans)

- AnonymizerNode itself, both backend implementations, sidecar Dockerfile,
  v1 config schema (Plan 1)
- Composition with `fhir_to_omop` as a single template (Phase 2)
- Cross-node path resolution in the Materializer (Phase 2)
- Auto-cleanup of `prepared/` after `summarize` succeeds (Phase 2)
- Custom HIPAA-derivative configs for state-specific requirements
  (e.g., California CMIA, NY SHIELD) — Phase 2 if customer-driven
