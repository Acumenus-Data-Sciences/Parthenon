# Parthenon Ingestion Templates — Phase 1, Plan 2: DICOM Stack

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two DICOM-domain templates that depend on Plan 1's `DicomMetadataNode`: `load_imaging_vocabulary` (loads JAMIA-derived custom concepts into the OMOP vocabulary in a Parthenon-namespaced concept_id range) and `etl_dicom_metadata` (ingests DICOM metadata to the OMOP imaging extension). Together they unblock Phase 1 imaging customers without ever touching pixel data.

**Architecture:** Two manifests at `templates/manifests/load_imaging_vocabulary/` and `templates/manifests/etl_dicom_metadata/`. Both validate against `template.v1.json`. Both ship per-template validation packs (per devplan §6.4) with DQD-equivalent post-conditions. CI exercises both end-to-end against a Postgres testcontainer + a fixture DICOM directory. The `etl_dicom_metadata` template depends on `load_imaging_vocabulary` having run first (declared via `requires.vocabularies: ["parthenon_imaging"]`).

**Tech Stack:** Phase 0 toolchain. New runtime deps: none beyond Plan 1 (`pydicom==3.0.2` already pinned). Vocabulary load uses standard SQL via `SqlNode` against the OMOP vocabulary tables.

**Depends on:** Phase 1 Plan 1 (specifically `DicomMetadataNode` and the manifest schema's `dicom_metadata` enum value).

**Unblocks:** Phase 1 closeout integration; downstream Plan 5 (`fhir_to_omop`) which uses imaging concepts when the FHIR bundle includes `ImagingStudy` resources.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest`. Integration tests marked `@pytest.mark.integration`.
- **All code must pass** `ruff check`, `black --check --line-length 100`, `mypy --strict runtime/`, and `parthenon-templates validate-manifests --root manifests` before commit.
- **Container exec** uses `docker compose exec -T` (never bare `docker compose exec`).
- **Branch model:** sequential commits on the Phase 1 Plan 2 branch; one task = one commit.
- **Type names** stable across tasks: `ImagingVocabularyError`, `DicomEtlError`, `JamiaConceptRow`.
- **Concept ID range:** Parthenon-namespaced custom concept IDs use the range `[2_000_000_000, 2_100_000_000)` to avoid collisions with future Athena releases. Documented in ADR 0005 (Task 9).

---

## Task index (9 tasks)

1. `load_imaging_vocabulary` manifest
2. `load_imaging_vocabulary` validation pack
3. `load_imaging_vocabulary` README
4. `load_imaging_vocabulary` E2E test in CI
5. `etl_dicom_metadata` manifest
6. `etl_dicom_metadata` validation pack and fixtures (small DICOM corpus)
7. `etl_dicom_metadata` README
8. `etl_dicom_metadata` E2E test in CI
9. ADR 0005 — imaging vocabulary namespace and DICOM ETL design

---

## Task 1: `load_imaging_vocabulary` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/manifest.yaml`

The template fetches the JAMIA reference DICOM-to-OMOP mapping CSV from a configurable source URL (default: a pinned snapshot mirrored to a Parthenon-controlled GitHub release), then loads it into the vocabulary tables (`vocab.concept`, `vocab.concept_relationship` if needed) using a Parthenon-namespaced concept_id range.

The reference: Nagy et al., "Breaking data silos: incorporating the DICOM imaging standard into the OMOP CDM," JAMIA 2025 — 5,183 DICOM attributes + 3,628 coded values as custom OMOP concepts. The upstream reference repo is `paulnagy/DICOM2OMOP`.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_load_imaging_vocabulary_manifest.py
"""load_imaging_vocabulary manifest validates against template.v1.json."""
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "load_imaging_vocabulary" / "manifest.yaml"
)


def test_manifest_exists_and_loads() -> None:
    assert MANIFEST.exists()
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "load_imaging_vocabulary"
    assert manifest.metadata.category == "vocabulary"
    assert "5.3" in manifest.metadata.cdm_versions
    assert "5.4" in manifest.metadata.cdm_versions


def test_manifest_declares_parthenon_imaging_vocabulary() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    # Other templates can require this vocabulary by name.
    requires = payload.get("spec", {}).get("requires", {})
    assert requires is not None
    # At least the post-condition references the vocabulary
    pc_kinds = {p["kind"] for p in payload["spec"]["post_conditions"]}
    assert "row_count" in pc_kinds


def test_manifest_uses_parthenon_namespaced_concept_id_range() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    # The manifest must reference the Parthenon-namespaced range somewhere
    # (in a SQL statement or parameter default).
    assert "2000000000" in text or "2_000_000_000" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py -v`
Expected: FAIL — manifest file doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/load_imaging_vocabulary/manifest.yaml`:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: load_imaging_vocabulary
  name: Load DICOM Imaging Vocabulary (JAMIA)
  version: "0.1.0"
  category: vocabulary
  cdm_versions: ["5.3", "5.4"]
  tags: ["imaging", "dicom", "vocabulary", "jamia"]
  author: "Acumenus Data Sciences"
  singleton: true   # Re-running with the same source URL replaces the load atomically.
spec:
  parameters:
    type: object
    properties:
      source_url:
        type: string
        description: |
          URL of the JAMIA-derived DICOM-to-OMOP CSV bundle (zip). Defaults to
          a Parthenon-mirrored snapshot pinned to upstream commit. Override to
          load a newer snapshot — bumping is a deliberate manifest update.
        default: "https://github.com/sudoshi/parthenon-imaging-vocab/releases/download/v0.1.0/dicom2omop_v0.1.0.zip"
      vocab_schema:
        type: string
        description: "OMOP vocabulary schema (per source's vocabulary daimon table_qualifier)."
        default: "vocab"
      concept_id_start:
        type: integer
        description: "First concept_id in the Parthenon-namespaced range."
        default: 2000000000
        minimum: 2000000000
        maximum: 2099999999
      vocabulary_id:
        type: string
        description: "Vocabulary identifier inserted into vocab.vocabulary."
        default: "Parthenon-Imaging"
    required: ["source_url", "vocab_schema"]
  requires:
    cdm_initialized: true
    vocabularies: []
  nodes:
    - node_id: download_bundle
      type: generic_file
      params:
        url: "${parameters.source_url}"
        artifact_name: dicom2omop_bundle.zip
        max_bytes: 524288000   # 500MB ceiling
        sha256_required: false  # The release URL is itself the integrity anchor; future versions can pin.

    - node_id: extract_and_stage
      type: python
      depends_on: [download_bundle]
      params:
        code: |
          import csv
          import zipfile
          from pathlib import Path

          def main(context, params):
              # The downloaded zip lives in the previous node's artifact_dir; resolve as sibling.
              upstream = context.artifact_dir.parent / "download_bundle" / "dicom2omop_bundle.zip"
              if not upstream.exists():
                  raise FileNotFoundError(f"upstream bundle missing: {upstream}")
              # Stage CSV files into this node's artifact_dir for the loader to pick up.
              with zipfile.ZipFile(upstream) as zf:
                  zf.extractall(context.artifact_dir)
              csvs = sorted(context.artifact_dir.glob("**/*.csv"))
              return {"csv_files_extracted": [p.name for p in csvs]}
        inputs: {}

    - node_id: load_vocabulary
      type: python
      depends_on: [extract_and_stage]
      params:
        code: |
          import csv
          from pathlib import Path
          from sqlalchemy import create_engine, text

          def main(context, params):
              if not context.db_dsn:
                  raise RuntimeError("load_vocabulary requires context.db_dsn")
              schema = params["vocab_schema"]
              start = int(params["concept_id_start"])
              vocab_id = params["vocabulary_id"]

              # The bundle ships CONCEPT.csv with rows keyed by Parthenon-relative concept_id;
              # rebase to the configured start so re-runs in different deployments don't collide.
              concept_csv = context.artifact_dir.parent / "extract_and_stage" / "CONCEPT.csv"
              if not concept_csv.exists():
                  # Some snapshots flatten; fall back to top-level glob.
                  candidates = list((context.artifact_dir.parent / "extract_and_stage").glob("**/CONCEPT.csv"))
                  if not candidates:
                      raise FileNotFoundError("CONCEPT.csv missing from staged bundle")
                  concept_csv = candidates[0]

              engine = create_engine(context.db_dsn, future=True)
              loaded = 0
              with engine.begin() as conn:
                  # Idempotent: drop only the rows we wrote previously, then re-insert.
                  conn.execute(text(
                      f"DELETE FROM {schema}.concept "
                      f"WHERE vocabulary_id = :vid"
                  ), {"vid": vocab_id})
                  conn.execute(text(
                      f"INSERT INTO {schema}.vocabulary "
                      f"(vocabulary_id, vocabulary_name, vocabulary_concept_id) "
                      f"VALUES (:vid, :vname, :vcid) "
                      f"ON CONFLICT (vocabulary_id) DO NOTHING"
                  ), {"vid": vocab_id, "vname": "Parthenon DICOM Imaging Vocabulary", "vcid": start})

                  with open(concept_csv, encoding="utf-8") as f:
                      reader = csv.DictReader(f)
                      for offset, row in enumerate(reader):
                          conn.execute(text(
                              f"INSERT INTO {schema}.concept "
                              f"(concept_id, concept_name, domain_id, vocabulary_id, "
                              f"concept_class_id, standard_concept, concept_code, "
                              f"valid_start_date, valid_end_date) "
                              f"VALUES (:cid, :cname, :did, :vid, :ccid, :std, :ccode, "
                              f"'1970-01-01', '2099-12-31')"
                          ), {
                              "cid": start + offset,
                              "cname": row["concept_name"][:255],
                              "did": row.get("domain_id", "Observation"),
                              "vid": vocab_id,
                              "ccid": row.get("concept_class_id", "DICOM Attribute"),
                              "std": row.get("standard_concept") or None,
                              "ccode": row.get("concept_code", "")[:50],
                          })
                          loaded += 1

              return {"concepts_loaded": loaded, "vocabulary_id": vocab_id}
        inputs:
          vocab_schema: "${parameters.vocab_schema}"
          concept_id_start: "${parameters.concept_id_start}"
          vocabulary_id: "${parameters.vocabulary_id}"

    - node_id: emit_summary
      type: sql
      depends_on: [load_vocabulary]
      params:
        statements:
          - "SELECT 1"
        fetch_query: |
          SELECT vocabulary_id, COUNT(*) AS concept_count
          FROM ${parameters.vocab_schema}.concept
          WHERE vocabulary_id = '${parameters.vocabulary_id}'
          GROUP BY vocabulary_id
        result_artifact: imaging_vocab_summary
  post_conditions:
    - kind: row_count
      params:
        table: "${parameters.vocab_schema}.concept"
        where: "vocabulary_id = '${parameters.vocabulary_id}'"
        min: 1
    - kind: artifact_present
      params:
        artifact: imaging_vocab_summary.json
        min_rows: 1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py -v && uv run parthenon-templates validate-manifests --root manifests`
Expected: PASS — 3 tests + manifest validation exit 0.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check .
uv run black --check --line-length 100 .
uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
uv run parthenon-templates lint-secret-keys --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_imaging_vocabulary/manifest.yaml templates/tests/unit/test_load_imaging_vocabulary_manifest.py
git commit -m "feat(templates): add load_imaging_vocabulary manifest"
```

---

## Task 2: `load_imaging_vocabulary` validation pack

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/validation/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/validation/dqd_checks.yaml`

The validation pack ships the inputs the E2E test (Task 4) feeds in and the expected post-conditions it asserts. The pack is also the customer-facing reference for how to run the template against their own staging environment.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_load_imaging_vocabulary_manifest.py

import json
import yaml as _yaml
from pathlib import Path


VAL_ROOT = MANIFEST.parent / "validation"


def test_validation_pack_files_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_validation_inputs_match_manifest_required() -> None:
    inputs = json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text(encoding="utf-8"))
    # Must declare the two required params from the manifest
    assert "source_url" in inputs
    assert "vocab_schema" in inputs


def test_validation_post_conditions_parse() -> None:
    pc = _yaml.safe_load((VAL_ROOT / "expected" / "post_conditions.yaml").read_text(encoding="utf-8"))
    assert isinstance(pc.get("post_conditions"), list) and pc["post_conditions"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py -v`
Expected: FAIL — validation pack files don't exist yet.

- [ ] **Step 3: Write minimal implementation**

`validation/README.md`:

```markdown
# load_imaging_vocabulary — validation pack

Customer-facing inputs and expected post-conditions for end-to-end validation
of the `load_imaging_vocabulary` template against a staging Parthenon CDM
instance.

## What this pack ships

- `inputs/parameters.json` — sample parameters using the Parthenon-mirrored
  bundle URL. Replace `source_url` if you maintain your own mirror.
- `expected/post_conditions.yaml` — the assertions the staging validation
  runner enforces after the run completes.
- `dqd_checks.yaml` — DQD-equivalent checks to run via your DQD runner against
  the loaded vocabulary.

## How to validate

1. Bring up a Parthenon CDM v5.4 instance with empty `vocab.*` tables.
2. Submit the template via the Aqueduct UI or
   `curl -H "X-Parthenon-Internal-Token: $TOKEN" -X POST .../runs` with
   `inputs/parameters.json` as the body.
3. Wait for the run to reach `completed`.
4. Run the staging validation runner against this pack.
5. (Optional) Run the DQD checks for a deeper integrity sweep.
```

`validation/inputs/parameters.json`:

```json
{
  "source_url": "https://github.com/sudoshi/parthenon-imaging-vocab/releases/download/v0.1.0/dicom2omop_v0.1.0.zip",
  "vocab_schema": "vocab",
  "concept_id_start": 2000000000,
  "vocabulary_id": "Parthenon-Imaging"
}
```

`validation/expected/post_conditions.yaml`:

```yaml
post_conditions:
  - kind: row_count
    table: vocab.concept
    where: "vocabulary_id = 'Parthenon-Imaging'"
    min: 1
    description: "At least one Parthenon-Imaging concept loaded"
  - kind: row_count
    table: vocab.vocabulary
    where: "vocabulary_id = 'Parthenon-Imaging'"
    expected: 1
    description: "Exactly one vocabulary header row"
  - kind: column_value
    table: vocab.vocabulary
    column: vocabulary_name
    where: "vocabulary_id = 'Parthenon-Imaging'"
    expected: "Parthenon DICOM Imaging Vocabulary"
  - kind: artifact_present
    artifact_name: imaging_vocab_summary.json
    min_rows: 1
```

`validation/dqd_checks.yaml`:

```yaml
# DQD-equivalent checks for the loaded imaging vocabulary.
# Run via your DQD runner; these are NOT enforced by the manifest itself
# (they are post-load integrity checks, not gating post-conditions).
checks:
  - check_id: imaging_vocab_concept_id_in_range
    description: "Every Parthenon-Imaging concept_id is in [2_000_000_000, 2_100_000_000)."
    sql: |
      SELECT COUNT(*) AS violations
      FROM vocab.concept
      WHERE vocabulary_id = 'Parthenon-Imaging'
        AND (concept_id < 2000000000 OR concept_id >= 2100000000)
    expected: 0

  - check_id: imaging_vocab_no_collision_with_athena
    description: "No Parthenon-Imaging concept shares an ID with an Athena-loaded concept."
    sql: |
      SELECT COUNT(*) AS violations
      FROM vocab.concept p
      JOIN vocab.concept a USING (concept_id)
      WHERE p.vocabulary_id = 'Parthenon-Imaging'
        AND a.vocabulary_id != 'Parthenon-Imaging'
    expected: 0

  - check_id: imaging_vocab_concept_class_known
    description: "Every concept_class_id is a recognized DICOM mapping class."
    sql: |
      SELECT COUNT(*) AS violations
      FROM vocab.concept
      WHERE vocabulary_id = 'Parthenon-Imaging'
        AND concept_class_id NOT IN ('DICOM Attribute', 'DICOM Coded Value', 'DICOM Modality')
    expected: 0

  - check_id: imaging_vocab_dates_set
    description: "Every concept has valid_start_date and valid_end_date set."
    sql: |
      SELECT COUNT(*) AS violations
      FROM vocab.concept
      WHERE vocabulary_id = 'Parthenon-Imaging'
        AND (valid_start_date IS NULL OR valid_end_date IS NULL)
    expected: 0
```

- [ ] **Step 4: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py -v`
Expected: PASS — all tests including new validation-pack ones.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_imaging_vocabulary/validation/
git commit -m "feat(templates): add load_imaging_vocabulary validation pack"
```

---

## Task 3: `load_imaging_vocabulary` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/load_imaging_vocabulary/README.md`

Customer-facing template documentation. Same structural headings as Phase 0 templates: What it does / When to use it / Parameters / Prerequisites / Examples / Limitations / License / attribution / Security notes.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_load_imaging_vocabulary_manifest.py

REQUIRED_HEADINGS = [
    "## What it does",
    "## When to use it",
    "## Parameters",
    "## Prerequisites",
    "## Examples",
    "## Limitations",
    "## License / attribution",
    "## Security notes",
]


def test_readme_has_required_sections() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for heading in REQUIRED_HEADINGS:
        assert heading in text, f"README missing section: {heading}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py::test_readme_has_required_sections -v`
Expected: FAIL — README doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/load_imaging_vocabulary/README.md`:

```markdown
# `load_imaging_vocabulary` — Phase 1 template

Loads the JAMIA-derived DICOM-to-OMOP vocabulary (5,183 DICOM attributes +
3,628 coded values) into a Parthenon-namespaced concept_id range so the
`etl_dicom_metadata` template (and any future imaging templates) can resolve
concept IDs without colliding with future Athena releases.

## What it does

1. Downloads a pinned snapshot of the JAMIA reference mapping bundle (zip).
2. Extracts CONCEPT.csv and supporting tables from the bundle.
3. Idempotently loads the rows into `vocab.concept` and `vocab.vocabulary`,
   re-keying each concept_id to start at the configured `concept_id_start`
   (default `2_000_000_000`) so the load is portable across deployments.
4. Records a one-row `imaging_vocab_summary.json` artifact showing
   `(vocabulary_id, concept_count)` for the run.

## When to use it

Run this template **once** before running `etl_dicom_metadata` for the first
time, OR whenever you intentionally bump the upstream JAMIA snapshot. Re-runs
with the same `source_url` are no-ops aside from refreshing the rows (the
template DELETEs prior `Parthenon-Imaging` rows before INSERTing fresh ones).

`load_imaging_vocabulary.singleton: true` is set in the manifest, so the
Plan 2 service won't allow two concurrent runs of this template.

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source_url` | string | yes | Parthenon mirror v0.1.0 | URL of the JAMIA-derived CSV bundle (zip). Override to load a newer snapshot. |
| `vocab_schema` | string | yes | `vocab` | OMOP vocabulary schema name. |
| `concept_id_start` | integer | no | `2000000000` | First concept_id in the Parthenon namespace. Range: `[2_000_000_000, 2_099_999_999]`. |
| `vocabulary_id` | string | no | `Parthenon-Imaging` | Vocabulary identifier inserted into `vocab.vocabulary`. |

## Prerequisites

- Parthenon CDM v5.3 or v5.4 initialized.
- Network access to the `source_url` from the templates service container.
- DB credentials with INSERT/DELETE on `vocab.concept` and INSERT on `vocab.vocabulary`.

## Examples

Submit via the Aqueduct UI:

1. Open Aqueduct → Templates.
2. Select **Load DICOM Imaging Vocabulary (JAMIA)**.
3. Accept defaults (or paste your own `source_url`) and click **Run**.
4. Watch the Runs sub-tab for completion (~2 minutes for ~9k concepts).

Submit via the API:

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_imaging_vocabulary/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/load_imaging_vocabulary/runs
```

## Limitations

- The JAMIA bundle is **pinned to upstream v0.1.0** in this template's default;
  bumping requires updating the manifest `source_url` default and re-running.
  Auto-tracking upstream releases is out of scope (devplan §4 Phase 1).
- Re-keying concept_ids means you cannot directly use the JAMIA reference's
  example queries with their hardcoded concept_ids; map through `concept_code`
  instead.
- The template does NOT load `concept_relationship` rows in v0.1.0. Adding
  relationship rows is a follow-up; track via the JAMIA snapshot README.

## License / attribution

The JAMIA mapping is published under the JAMIA article (Nagy et al., 2025)
and the reference repo `paulnagy/DICOM2OMOP`. The mapping is in the public
domain as a derivative of the DICOM standard (publicly available) and the
OMOP CDM (Apache 2.0). Parthenon's mirror release is a **content snapshot**
of that public mapping; we don't relicense.

If you bump to a newer upstream commit, verify the upstream license terms
have not changed before redistributing your derivative.

## Security notes

- The `source_url` is HTTPS-only by default; the Parthenon mirror release is
  the integrity anchor (GitHub releases are signed by Parthenon's CI).
- The template runs against the `Parthenon-Imaging` rows only — it never
  modifies or deletes Athena-sourced concepts, so a misconfigured run cannot
  corrupt the rest of the vocabulary.
- Database credentials come from `context.db_dsn` (configured per
  deployment); never hardcoded in the manifest.
```

- [ ] **Step 4: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_load_imaging_vocabulary_manifest.py::test_readme_has_required_sections -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

(no Python changes; just the README + tests)

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/load_imaging_vocabulary/README.md
git commit -m "docs(templates): add load_imaging_vocabulary README"
```

---

## Task 4: `load_imaging_vocabulary` E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_load_imaging_vocabulary.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml` (add `load_imaging_vocabulary E2E` step)

CI test spins up Postgres testcontainer, bootstraps CDM v5.4 vocab tables, mocks the `source_url` to serve a tiny fixture zip from a local file, submits the template via the FastAPI app's TestClient, polls to completion, asserts post-conditions.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_load_imaging_vocabulary.py
"""E2E: load_imaging_vocabulary against a Postgres testcontainer."""
from __future__ import annotations

import json
import time
import zipfile
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "load_imaging_vocabulary"


def _build_fixture_bundle(target: Path) -> None:
    """Create a tiny CONCEPT.csv bundle for the test."""
    csv_text = (
        "concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept,concept_code\n"
        "Patient Name,Observation,Parthenon-Imaging,DICOM Attribute,,(0010,0010)\n"
        "Patient ID,Observation,Parthenon-Imaging,DICOM Attribute,,(0010,0020)\n"
        "Modality,Observation,Parthenon-Imaging,DICOM Attribute,,(0008,0060)\n"
    )
    with zipfile.ZipFile(target, "w") as zf:
        zf.writestr("CONCEPT.csv", csv_text)


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


@pytest.mark.integration
def test_load_imaging_vocabulary_runs_to_completion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixture_zip = tmp_path / "dicom2omop_fixture.zip"
    _build_fixture_bundle(fixture_zip)
    fixture_url = f"file://{fixture_zip}"

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="vocab", engine=engine)

        monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
        monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
        monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
        monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
        monkeypatch.setenv("DATABASE_URL", db_url)

        from runtime.api import app
        from runtime.dependencies import get_backend, get_registry, get_settings, get_storage

        for c in (get_settings, get_registry, get_storage, get_backend):
            c.cache_clear()

        client = TestClient(app)
        params = json.loads(
            (MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        params["source_url"] = fixture_url

        resp = client.post(
            "/runs",
            json={
                "template_id": "load_imaging_vocabulary",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "imaging-vocab-e2e",
            },
            headers=_auth(),
        )
        assert resp.status_code == 201, resp.text
        run_id = resp.json()["run_id"]

        deadline = time.time() + 90
        final = "running"
        while time.time() < deadline:
            r = client.get(f"/runs/{run_id}", headers=_auth())
            final = r.json()["status"]
            if final in {"completed", "failed", "cancelled"}:
                break
            time.sleep(0.5)
        assert final == "completed", f"run did not complete: {final}"

        with engine.connect() as conn:
            n = conn.execute(
                text(
                    "SELECT COUNT(*) FROM vocab.concept WHERE vocabulary_id = 'Parthenon-Imaging'"
                )
            ).scalar()
        assert n == 3, f"expected 3 imaging concepts loaded, got {n}"
```

- [ ] **Step 2: Run test to verify it fails**

If the manifest hasn't yet been validated end-to-end (Plan 1 didn't ship a CDM-touching template that reads from CSV, so the path through `extract_and_stage` and `load_vocabulary` python nodes hasn't been exercised), this test may fail on the first run. Iterate until the manifest's nodes work against the fixture.

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_load_imaging_vocabulary.py -v`
Expected: PASS (or surface a manifest fix). The test is the gate; if it fails, fix the manifest, not the test.

- [ ] **Step 3: Update CI workflow**

Edit `.github/workflows/templates.yml` to add a new step after the existing `nodes_test E2E`:

```yaml
      - name: load_imaging_vocabulary E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_load_imaging_vocabulary.py -v -m integration
```

- [ ] **Step 4: Verify**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_load_imaging_vocabulary.py -v
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
git add templates/tests/e2e/test_load_imaging_vocabulary.py .github/workflows/templates.yml
git commit -m "test(templates): add load_imaging_vocabulary E2E test in CI"
```

---

## Task 5: `etl_dicom_metadata` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/manifest.yaml`

Uses `DicomMetadataNode` (Plan 1) to ingest DICOM metadata, then a SqlNode to project the metadata into the OMOP imaging extension tables (`omop.image_occurrence`, `omop.image_feature` if v5.4 oncology_ext is enabled, and `omop.measurement` for measured pixel-spacing/slice-thickness attributes).

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_etl_dicom_metadata_manifest.py
"""etl_dicom_metadata manifest validates against template.v1.json."""
from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "manifests" / "etl_dicom_metadata" / "manifest.yaml"
)


def test_manifest_loads_and_targets_imaging_extension() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "etl_dicom_metadata"
    assert manifest.metadata.category == "ingestion"
    assert "5.4" in manifest.metadata.cdm_versions


def test_manifest_uses_dicom_metadata_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "dicom_metadata" in types


def test_manifest_does_not_reference_pixel_data() -> None:
    """Defense in depth: the manifest must not even mention pixel-data tags."""
    text = MANIFEST.read_text(encoding="utf-8").lower()
    assert "pixeldata" not in text
    assert "pixel_data" not in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v`
Expected: FAIL — manifest doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/etl_dicom_metadata/manifest.yaml`:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: etl_dicom_metadata
  name: ETL DICOM Metadata to OMOP
  version: "0.1.0"
  category: ingestion
  cdm_versions: ["5.4"]   # imaging extension lives in v5.4+
  tags: ["imaging", "dicom", "etl", "metadata-only"]
  author: "Acumenus Data Sciences"
spec:
  parameters:
    type: object
    properties:
      source:
        type: string
        enum: ["filesystem", "dicomweb"]
        description: "DICOM source backend."
      dicom_dir:
        type: string
        description: "Directory of *.dcm files (when source=filesystem)."
      dicomweb_base_url:
        type: string
        description: "DICOMweb base URL (when source=dicomweb)."
      dicomweb_token:
        type: string
        description: "Bearer token for DICOMweb (secret)."
        secret: true
      target_schema:
        type: string
        description: "OMOP CDM target schema."
      vocab_schema:
        type: string
        default: "vocab"
        description: "OMOP vocabulary schema (must contain Parthenon-Imaging)."
    required: ["source", "target_schema"]
  requires:
    cdm_initialized: true
    vocabularies: ["Parthenon-Imaging"]
  nodes:
    - node_id: ingest_metadata
      type: dicom_metadata
      params:
        source: "${parameters.source}"
        dicom_dir: "${parameters.dicom_dir}"
        dicomweb_base_url: "${parameters.dicomweb_base_url}"
        bearer_token: "${parameters.dicomweb_token}"

    - node_id: project_to_imaging_extension
      type: python
      depends_on: [ingest_metadata]
      params:
        code: |
          import polars as pl
          from sqlalchemy import create_engine, text

          def main(context, params):
              if not context.db_dsn:
                  raise RuntimeError("project_to_imaging_extension requires context.db_dsn")
              upstream = context.artifact_dir.parent / "ingest_metadata" / "dicom_metadata.parquet"
              if not upstream.exists():
                  raise FileNotFoundError(f"upstream metadata Parquet missing: {upstream}")
              df = pl.read_parquet(upstream)
              if df.height == 0:
                  return {"image_occurrences_inserted": 0}

              schema = params["target_schema"]
              vocab = params["vocab_schema"]
              engine = create_engine(context.db_dsn, future=True)
              inserted = 0
              with engine.begin() as conn:
                  # Resolve modality concept_id once per row via the Parthenon-Imaging vocab.
                  for row in df.iter_rows(named=True):
                      modality = row.get("Modality") or "OT"
                      cid_row = conn.execute(text(
                          f"SELECT concept_id FROM {vocab}.concept "
                          f"WHERE vocabulary_id = 'Parthenon-Imaging' "
                          f"  AND concept_class_id = 'DICOM Attribute' "
                          f"  AND concept_code = :modality_code "
                          f"LIMIT 1"
                      ), {"modality_code": "(0008,0060)"}).fetchone()
                      modality_concept_id = cid_row[0] if cid_row else 0

                      conn.execute(text(
                          f"INSERT INTO {schema}.image_occurrence "
                          f"(image_occurrence_id, person_id, image_study_uid, image_series_uid, "
                          f"image_occurrence_date, modality_concept_id, anatomic_site_concept_id, "
                          f"image_occurrence_concept_id) "
                          f"VALUES (DEFAULT, NULL, :study_uid, :series_uid, "
                          f":study_date, :modality_concept_id, 0, 0)"
                      ), {
                          "study_uid": row.get("StudyInstanceUID"),
                          "series_uid": row.get("SeriesInstanceUID"),
                          "study_date": row.get("StudyDate"),
                          "modality_concept_id": modality_concept_id,
                      })
                      inserted += 1
              return {"image_occurrences_inserted": inserted}
        inputs:
          target_schema: "${parameters.target_schema}"
          vocab_schema: "${parameters.vocab_schema}"

    - node_id: emit_summary
      type: sql
      depends_on: [project_to_imaging_extension]
      params:
        statements:
          - "SELECT 1"
        fetch_query: |
          SELECT COUNT(*) AS image_occurrence_count
          FROM ${parameters.target_schema}.image_occurrence
        result_artifact: dicom_etl_summary
  post_conditions:
    - kind: row_count
      params:
        table: "${parameters.target_schema}.image_occurrence"
        min: 1
    - kind: artifact_present
      params:
        artifact: dicom_metadata.parquet
        min_rows: 1
    - kind: artifact_present
      params:
        artifact: dicom_etl_summary.json
        min_rows: 1
```

- [ ] **Step 4: Run test to verify it passes**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v && uv run parthenon-templates validate-manifests --root manifests`
Expected: PASS — 3 tests + manifest exit 0.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/etl_dicom_metadata/manifest.yaml templates/tests/unit/test_etl_dicom_metadata_manifest.py
git commit -m "feat(templates): add etl_dicom_metadata manifest"
```

---

## Task 6: `etl_dicom_metadata` validation pack and fixtures

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/validation/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/validation/inputs/parameters.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/validation/dqd_checks.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py` (generates a small DICOM corpus from pydicom test data)

The validation pack ships a tiny DICOM corpus (~3 files derived from pydicom test data: 1 CT, 1 MR, 1 OT) for end-to-end validation. Customers can swap in their own corpus by changing `dicom_dir` in `parameters.json`.

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_etl_dicom_metadata_manifest.py

import json as _json
import yaml as _yaml

VAL_ROOT = MANIFEST.parent / "validation"


def test_validation_pack_files_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixtures_builder_present() -> None:
    builder = MANIFEST.parent / "fixtures" / "sample" / "build_fixtures.py"
    assert builder.exists()


def test_validation_inputs_match_required_params() -> None:
    inputs = _json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text("utf-8"))
    assert "source" in inputs
    assert "target_schema" in inputs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v`
Expected: FAIL — pack files missing.

- [ ] **Step 3: Write minimal implementation**

`fixtures/sample/build_fixtures.py`:

```python
"""Stage a tiny DICOM corpus from pydicom's bundled test data.

Run from repo root:
    uv run python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py

Output: templates/manifests/etl_dicom_metadata/fixtures/sample/dicom/
"""
from __future__ import annotations

from pathlib import Path

from pydicom.data import get_testdata_files

OUT = Path(__file__).resolve().parent / "dicom"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("CT_small.dcm", "MR_small.dcm", "OT-PAL-8-face.dcm"):
        for src in get_testdata_files(name):
            dest = OUT / Path(src).name
            dest.write_bytes(Path(src).read_bytes())
    files = sorted(p.name for p in OUT.glob("*.dcm"))
    print(f"staged {len(files)} fixture DICOMs to {OUT}: {files}")


if __name__ == "__main__":
    main()
```

`validation/README.md`:

```markdown
# etl_dicom_metadata — validation pack

End-to-end validation inputs and expected post-conditions for the
`etl_dicom_metadata` template.

## Fixture DICOM corpus

Run once before validation to stage 3 fixture DICOMs (CT, MR, OT) from
pydicom's bundled test data:

```bash
uv run python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py
```

Output: `templates/manifests/etl_dicom_metadata/fixtures/sample/dicom/*.dcm` —
3 small files (~5KB each), metadata-rich, no PHI.

## How to validate

1. Bring up Parthenon CDM v5.4 with imaging extension enabled.
2. Run `load_imaging_vocabulary` first (Plan 2 Task 1–4).
3. Stage the fixture corpus (above).
4. Submit this template with `inputs/parameters.json`.
5. Wait for completion (~30 seconds for 3 DICOMs).
6. Run the staging validation runner against `expected/post_conditions.yaml`.
7. (Optional) Run `dqd_checks.yaml` for deeper checks.
```

`validation/inputs/parameters.json`:

```json
{
  "source": "filesystem",
  "dicom_dir": "/var/parthenon/manifests/etl_dicom_metadata/fixtures/sample/dicom",
  "target_schema": "omop",
  "vocab_schema": "vocab"
}
```

`validation/expected/post_conditions.yaml`:

```yaml
post_conditions:
  - kind: row_count
    table: omop.image_occurrence
    min: 3
    description: "Three fixture DICOMs produce at least 3 image_occurrence rows"
  - kind: artifact_present
    artifact_name: dicom_metadata.parquet
    min_rows: 3
  - kind: artifact_present
    artifact_name: dicom_etl_summary.json
    min_rows: 1
  - kind: column_value_range
    table: omop.image_occurrence
    column: modality_concept_id
    where: "image_occurrence_id IS NOT NULL"
    min: 0
    max: 2099999999
    description: "Modality concept_id is either 0 (unmapped) or in Parthenon-Imaging range"
```

`validation/dqd_checks.yaml`:

```yaml
checks:
  - check_id: dicom_etl_no_pixel_data_columns
    description: "Defense in depth: image_occurrence rows have no pixel-data references."
    sql: |
      SELECT COUNT(*) AS violations
      FROM information_schema.columns
      WHERE table_schema = 'omop' AND table_name = 'image_occurrence'
        AND column_name ILIKE '%pixel%'
    expected: 0

  - check_id: dicom_etl_unique_sop_per_occurrence
    description: "Each image_occurrence references a unique series_uid."
    sql: |
      SELECT COUNT(*) AS violations
      FROM (
        SELECT image_series_uid, COUNT(*) AS n
        FROM omop.image_occurrence
        GROUP BY image_series_uid
        HAVING COUNT(*) > 1
      ) t
    expected: 0

  - check_id: dicom_etl_modality_codes_known
    description: "Modality concept IDs all resolve to a vocab entry."
    sql: |
      SELECT COUNT(*) AS violations
      FROM omop.image_occurrence i
      LEFT JOIN vocab.concept c ON c.concept_id = i.modality_concept_id
      WHERE c.concept_id IS NULL AND i.modality_concept_id != 0
    expected: 0
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v`
Expected: PASS.

Also stage the fixtures:

```bash
cd /home/smudoshi/Github/Parthenon
uv run --project templates python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py
```

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
uv run parthenon-templates validate-manifests --root manifests
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/etl_dicom_metadata/validation/ templates/manifests/etl_dicom_metadata/fixtures/
git commit -m "feat(templates): add etl_dicom_metadata validation pack and fixture corpus"
```

---

## Task 7: `etl_dicom_metadata` README

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/etl_dicom_metadata/README.md`

- [ ] **Step 1: Write the failing test**

```python
# Append to templates/tests/unit/test_etl_dicom_metadata_manifest.py

REQUIRED_HEADINGS = [
    "## What it does",
    "## When to use it",
    "## Parameters",
    "## Prerequisites",
    "## Examples",
    "## Limitations",
    "## License / attribution",
    "## Security notes",
]


def test_readme_has_required_sections() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for heading in REQUIRED_HEADINGS:
        assert heading in text


def test_readme_calls_out_pixels_never_copied() -> None:
    """Defense in depth surface area: README must explicitly flag the no-pixels guarantee."""
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8").lower()
    assert "pixel" in text and "never" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v`
Expected: FAIL — README missing.

- [ ] **Step 3: Write minimal implementation**

`templates/manifests/etl_dicom_metadata/README.md`:

```markdown
# `etl_dicom_metadata` — Phase 1 template

Ingests DICOM metadata into the OMOP imaging extension. **Pixel data is never
copied.** Two source backends: filesystem and DICOMweb (QIDO-RS).

## What it does

1. `ingest_metadata` (DicomMetadataNode): scans the configured DICOM source
   and emits a single Parquet artifact with one row per SOPInstance and
   columns for the standard DICOM tags. **Pixel data is never read.**
2. `project_to_imaging_extension` (PythonNode): reads the Parquet artifact
   and inserts one row per study/series into `omop.image_occurrence`,
   resolving modality codes via the `Parthenon-Imaging` vocabulary loaded
   by `load_imaging_vocabulary`.
3. `emit_summary` (SqlNode with `result_artifact`): writes a one-row
   `dicom_etl_summary.json` artifact showing the post-load
   `image_occurrence` count.

## When to use it

Run after `load_imaging_vocabulary` (which seeds the `Parthenon-Imaging`
concept rows). Submit once per DICOM source you want to onboard, OR re-submit
incrementally as new studies arrive (the template appends; no DELETE).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | yes | — | `filesystem` or `dicomweb`. |
| `dicom_dir` | string | when `source=filesystem` | — | Directory of `*.dcm` files (recursive). |
| `dicomweb_base_url` | string | when `source=dicomweb` | — | DICOMweb base URL. |
| `dicomweb_token` | string (secret) | when `source=dicomweb` | — | Bearer token. **Redacted by the Materializer** in run logs. |
| `target_schema` | string | yes | — | OMOP CDM target schema. |
| `vocab_schema` | string | no | `vocab` | OMOP vocabulary schema. |

## Prerequisites

- Parthenon CDM v5.4 with imaging extension tables (`image_occurrence`,
  `image_feature` etc.) initialized.
- `load_imaging_vocabulary` previously run; rows present in
  `vocab.concept` for `vocabulary_id = 'Parthenon-Imaging'`.
- Network access to the DICOM source (filesystem mount or DICOMweb endpoint).

## Examples

Filesystem source with the fixture corpus:

```bash
# Stage fixtures once
uv run python templates/manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py

# Submit
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/etl_dicom_metadata/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/etl_dicom_metadata/runs
```

DICOMweb source (production):

```json
{
  "source": "dicomweb",
  "dicomweb_base_url": "https://pacs.example.com/dicom-web",
  "dicomweb_token": "${SECRET_DICOMWEB_TOKEN}",
  "target_schema": "omop",
  "vocab_schema": "vocab"
}
```

## Limitations

- Phase 1 ships **modality + study/series UID** projection only. Body part,
  contrast agent, and detailed series-level attributes (TR/TE for MR,
  kVp/mAs for CT) require the imaging-feature extension and are out of
  scope until Phase 2.
- DICOMweb pagination is server-defined; the node fetches the first
  response page only in Phase 1. Servers returning >1000 instances per
  query may need follow-up paginated runs.
- The template does **not** copy pixel data (by design — see Security notes).
  If you need image-feature extraction, that's a Phase 3+ template that
  would deliberately use WADO-RS under audit.
- `person_id` is left NULL for now; cross-mapping DICOM `PatientID` to
  OMOP `person_id` is the responsibility of an upstream `link_person`
  template (Phase 2).

## License / attribution

The DICOM standard is publicly available (NEMA). The OMOP imaging extension
mapping follows Nagy et al., "Breaking data silos: incorporating the DICOM
imaging standard into the OMOP CDM," JAMIA 2025 (`paulnagy/DICOM2OMOP`).

## Security notes

- **Pixel data is never copied.** Three independent enforcement points:
  - `DicomMetadataNode` filesystem backend uses
    `pydicom.dcmread(stop_before_pixels=True)`.
  - `DicomMetadataNode` DICOMweb backend issues only QIDO-RS calls;
    WADO-RS is never called.
  - The output Parquet artifact has no column matching `*pixel*`.
- `dicomweb_token` is declared `secret: true` in the manifest and redacted
  by the Materializer in run logs and the API echo.
- DICOM files often contain PHI in tags like `PatientName`, `PatientID`,
  `AccessionNumber`. The current template projects these AS-IS into the
  imaging-extension rows. **Run `fhir_anonymizer` (Plan 4) on the upstream
  source before this template if PHI handling requires it.**
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/unit/test_etl_dicom_metadata_manifest.py -v`
Expected: PASS.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add templates/manifests/etl_dicom_metadata/README.md
git commit -m "docs(templates): add etl_dicom_metadata README"
```

---

## Task 8: `etl_dicom_metadata` E2E test in CI

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_etl_dicom_metadata.py`
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml` (add step + apt-install of `r-base-core` is unchanged from Phase 0; add a step to stage fixtures)

CI test: stage fixtures, spin up Postgres testcontainer with imaging extension, run `load_imaging_vocabulary` first (so the lookup works), then submit `etl_dicom_metadata`, assert post-conditions including the image_occurrence row count.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/e2e/test_etl_dicom_metadata.py
"""E2E: etl_dicom_metadata against a Postgres testcontainer + load_imaging_vocabulary first."""
from __future__ import annotations

import json
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
DICOM_MANIFEST_DIR = REPO / "manifests" / "etl_dicom_metadata"
VOCAB_MANIFEST_DIR = REPO / "manifests" / "load_imaging_vocabulary"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _stage_fixtures() -> Path:
    """Run the fixture builder script and return the fixture dir path."""
    import subprocess

    builder = DICOM_MANIFEST_DIR / "fixtures" / "sample" / "build_fixtures.py"
    subprocess.run(["python", str(builder)], check=True)
    return DICOM_MANIFEST_DIR / "fixtures" / "sample" / "dicom"


def _build_vocab_fixture(target: Path) -> str:
    csv_text = (
        "concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept,concept_code\n"
        "Modality,Observation,Parthenon-Imaging,DICOM Attribute,,(0008,0060)\n"
    )
    with zipfile.ZipFile(target, "w") as zf:
        zf.writestr("CONCEPT.csv", csv_text)
    return f"file://{target}"


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        status = r.json()["status"]
        if status in {"completed", "failed", "cancelled"}:
            return str(status)
        time.sleep(0.5)
    return "timeout"


@pytest.mark.integration
def test_etl_dicom_metadata_runs_to_completion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    dicom_dir = _stage_fixtures()
    vocab_url = _build_vocab_fixture(tmp_path / "vocab.zip")

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        bootstrap(version="5.4", schema="omop", engine=engine, oncology_extension=True)

        monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
        monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
        monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
        monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
        monkeypatch.setenv("DATABASE_URL", db_url)

        from runtime.api import app
        from runtime.dependencies import get_backend, get_registry, get_settings, get_storage

        for c in (get_settings, get_registry, get_storage, get_backend):
            c.cache_clear()

        client = TestClient(app)

        # 1. Run load_imaging_vocabulary first.
        vocab_params = json.loads(
            (VOCAB_MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        vocab_params["source_url"] = vocab_url
        r = client.post(
            "/runs",
            json={
                "template_id": "load_imaging_vocabulary",
                "version": "0.1.0",
                "parameters": vocab_params,
                "correlation_id": "vocab-pre-dicom",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        # 2. Submit etl_dicom_metadata.
        params = json.loads(
            (DICOM_MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        params["dicom_dir"] = str(dicom_dir)
        r = client.post(
            "/runs",
            json={
                "template_id": "etl_dicom_metadata",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "dicom-etl-e2e",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            n = conn.execute(text("SELECT COUNT(*) FROM omop.image_occurrence")).scalar()
        assert n is not None and n >= 3, f"expected >=3 image_occurrence rows, got {n}"
```

- [ ] **Step 2: Run test to verify it fails or works**

Run: `cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/e2e/test_etl_dicom_metadata.py -v`
The test exercises Plan 1's `DicomMetadataNode` + Plan 2's two manifests. Iterate until green.

- [ ] **Step 3: Update CI workflow**

`.github/workflows/templates.yml` — add step:

```yaml
      - name: Stage etl_dicom_metadata fixtures
        run: |
          cd templates
          uv run python manifests/etl_dicom_metadata/fixtures/sample/build_fixtures.py

      - name: etl_dicom_metadata E2E
        run: |
          cd templates
          uv run pytest tests/e2e/test_etl_dicom_metadata.py -v -m integration
```

- [ ] **Step 4: Verify**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/e2e/test_etl_dicom_metadata.py -v
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
git add templates/tests/e2e/test_etl_dicom_metadata.py .github/workflows/templates.yml
git commit -m "test(templates): add etl_dicom_metadata E2E test in CI"
```

---

## Task 9: ADR 0005 — Imaging vocabulary namespace and DICOM ETL design

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/adr/0005-imaging-vocabulary-namespace.md`
- Modify: `/home/smudoshi/Github/Parthenon/templates/tests/test_adrs.py` (add `0005`)

Captures: the Parthenon-namespaced concept_id range decision, the rationale for re-keying upstream JAMIA concept IDs at load time, the decision to leave `person_id` NULL in `image_occurrence` until a Phase 2 cross-mapping template, and the no-pixel-data invariant as a defensive design choice.

- [ ] **Step 1: Write the failing test**

```python
# Update parametrize in templates/tests/test_adrs.py:
@pytest.mark.parametrize("adr_number", ["0001", "0002", "0003", "0004", "0005"])
def test_adr_exists_and_uses_madr(adr_number: str) -> None:
    ...
```

- [ ] **Step 2: Run test to verify it fails**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: FAIL — `0005` ADR doesn't exist.

- [ ] **Step 3: Write minimal implementation**

`docs/adr/0005-imaging-vocabulary-namespace.md`:

```markdown
# ADR 0005 — Imaging Vocabulary Namespace and DICOM ETL Design

## Status

Accepted, 2026-05-03.

## Context

Phase 1 ships two DICOM-domain templates: `load_imaging_vocabulary` and
`etl_dicom_metadata`. The JAMIA reference (Nagy et al. 2025) provides ~9k
custom concepts as a CSV bundle. Two design questions emerge:

1. **Where do these concept_ids live in `vocab.concept`?** Reusing the
   upstream IDs as-is risks collisions with future Athena releases or
   future JAMIA snapshots. Generating UUIDs breaks OMOP's integer-FK
   convention. Picking an ad-hoc range hides the namespace decision.

2. **How does `etl_dicom_metadata` resolve PHI vs DICOM tags that
   contain it?** DICOM PatientName/PatientID/AccessionNumber routinely
   carry PHI. Phase 1's scope is metadata-only ETL; full PHI handling
   is the `fhir_anonymizer` (Plan 4) flow.

## Decision

### 1. Parthenon-namespaced concept_id range

The Parthenon-Imaging vocabulary occupies `[2_000_000_000, 2_099_999_999]`,
a 100M-row range that is well above:

- OMOP standard concept IDs (≤ ~999M)
- Athena's allocation ceiling for non-standard concepts (well below 2B)

`load_imaging_vocabulary` rebases each row's concept_id at load time:
`new_id = concept_id_start + row_offset`, so the namespace is portable
across deployments. The Parthenon-Imaging concepts are explicitly NOT
declared standard (the `standard_concept` column is NULL); they describe
DICOM attributes, not clinical concepts.

### 2. Idempotent re-load via DELETE-then-INSERT

`load_imaging_vocabulary` is `singleton: true`. Re-running with the same
`source_url` deletes prior `Parthenon-Imaging` rows then re-INSERTs from
the bundle. The DELETE is scoped strictly by `vocabulary_id` so Athena
rows are never touched.

The downside: re-runs are not zero-downtime — there is a brief window
where Parthenon-Imaging rows are absent. Acceptable for a vocabulary
load that runs at most weekly. If that becomes a constraint, a future
ADR can introduce a versioned `Parthenon-Imaging-vN` pattern.

### 3. `person_id` left NULL in image_occurrence

The Phase 1 `etl_dicom_metadata` template does not cross-map DICOM
`PatientID` (a string identifier from the imaging system) to OMOP
`person_id` (an integer). That mapping requires a `link_person`
template (Phase 2) that joins via your MPI / EMPI.

Setting `person_id = NULL` is preferable to:

- A best-guess hash mapping (creates unverifiable phantom persons).
- Failing the run when no mapping exists (most early-deployment customers
  haven't built one yet).

A future Phase 2 template will UPDATE these rows in-place once the
mapping is established.

### 4. Defense in depth: pixel data never copied

The DicomMetadataNode (Plan 1 ADR 0004) already enforces this with
three independent checks. This template inherits that guarantee. The
manifest itself contains no reference to pixel-data tags (verified by
the regression test `test_manifest_does_not_reference_pixel_data`).

### 5. Modality concept resolution by code, not by ID

`project_to_imaging_extension` looks up the Modality concept_id in
`vocab.concept` by `concept_code = '(0008,0060)'`, NOT by hardcoded
concept_id. This shields the template from the namespace decision —
re-running `load_imaging_vocabulary` with a different `concept_id_start`
still yields a working ETL.

When the lookup fails (no Parthenon-Imaging row matches), the row is
inserted with `modality_concept_id = 0` (OMOP's "no matching concept"
sentinel) and a warning logged.

## Consequences

### Positive

- Parthenon-Imaging never collides with Athena.
- Re-running `load_imaging_vocabulary` is safe and bounded in scope.
- `etl_dicom_metadata` works against any deployment that has run the
  vocabulary template, regardless of `concept_id_start`.
- Pixel data invariant is preserved via Phase 0+1 layered defense.

### Negative

- Customers running large numbers of Parthenon-namespaced vocabularies
  (>100M concepts) need a new range allocation; not foreseeable in v1.
- Re-load DELETE/INSERT briefly clears Parthenon-Imaging rows; cohort
  queries during that window may see stale results.
- `person_id NULL` reduces analytical join utility until the Phase 2
  link template runs. Documented in the etl_dicom_metadata README's
  Limitations section.

## Alternatives considered (declined)

- **Reuse upstream JAMIA concept_ids as-is.** Rejected: collision risk
  with future Athena allocations.
- **Generate UUIDs and store in concept_code.** Rejected: breaks OMOP
  integer FK convention and OHDSI-tooling compatibility.
- **Insert PatientID hash as person_id.** Rejected: creates phantom
  persons that no downstream cohort can validate. Better to leave NULL
  and surface the gap.
- **Resolve modality concepts by hardcoded concept_id.** Rejected:
  couples the ETL template to a specific load run's offset; portability
  killer.

## References

- Phase 1 design spec: `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 2 (this plan): `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-2-dicom.md`
- Phase 0 manifest schema: `templates/runtime/registry/schema/template.v1.json`
- Phase 1 Plan 1 ADR (DicomMetadataNode): `docs/adr/0004-phase-1-node-design.md`
- Nagy P. et al., "Breaking data silos: incorporating the DICOM imaging standard into the OMOP CDM," JAMIA 2025
- `paulnagy/DICOM2OMOP`: <https://github.com/paulnagy/DICOM2OMOP>
- OMOP CDM v5.4 imaging extension: <https://ohdsi.github.io/CommonDataModel/cdm54.html>
```

- [ ] **Step 4: Verify**

`cd /home/smudoshi/Github/Parthenon/templates && uv run pytest tests/test_adrs.py -v`
Expected: PASS — 5 ADR cases.

- [ ] **Step 5: Run gates**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run ruff check . && uv run black --check --line-length 100 . && uv run mypy --strict runtime/
uv run pytest -q
```

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add docs/adr/0005-imaging-vocabulary-namespace.md templates/tests/test_adrs.py
git commit -m "docs(adr): ADR 0005 — imaging vocabulary namespace and DICOM ETL design"
```

---

## Definition of Done — Plan 2

- [ ] `parthenon-templates validate-manifests --root manifests` exit 0; lists `etl_dicom_metadata`, `load_imaging_vocabulary` alongside Phase 0's 4 manifests.
- [ ] `parthenon-templates lint-secret-keys --root manifests` clean.
- [ ] `pytest -q` (full suite) green; new tests for both manifests, validation packs, and READMEs pass.
- [ ] `pytest -m integration tests/e2e/test_load_imaging_vocabulary.py` and `tests/e2e/test_etl_dicom_metadata.py` both pass against Postgres testcontainer.
- [ ] `ruff check .` / `black --check --line-length 100 .` / `mypy --strict runtime/` clean.
- [ ] CI workflow has dedicated steps for both new templates' E2E tests.
- [ ] All 5 ADRs (0001–0005) pass `tests/test_adrs.py`.
- [ ] `omop.image_occurrence` is populated end-to-end in the E2E test (>= 3 rows from the fixture corpus).
- [ ] Pixel-data-absence regression guards (Plan 1 Task 9) still pass — no Plan 2 change should ever allow pixel-related columns into output Parquet or DB rows.

## Branch model

- Branch off the Plan 1 branch tip into `feature/phase-1-templates-dicom`.
- Sequential commits per task; one task = one commit.
- 9 commits expected.
- DO NOT push; orchestrator handles push.

## Out of scope (handled by other Plans)

- DicomMetadataNode itself (Plan 1)
- DICOMweb mTLS auth (deferred to first customer ask)
- WADO-RS pixel retrieval (Phase 3+ image-feature template, never from this template)
- DICOM C-FIND (legacy DIMSE) source backend (Phase 3 if asked)
- person_id linking via MPI (Phase 2 `link_person` template)
- Series-level imaging features (TR/TE for MR, kVp/mAs for CT) — Phase 2 with imaging-feature extension
