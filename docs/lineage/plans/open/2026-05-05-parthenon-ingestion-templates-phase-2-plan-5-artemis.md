# Parthenon Ingestion Templates — Phase 2, Plan 5: ARTEMIS Chemo Regimen Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `artemis_chemo_regimens` template — a chemotherapy regimen extractor that consumes `mimic_iv.note` (clinical text) and `mimic_iv.drug_exposure` (RxNorm-coded administered drugs) from Plan 4 and projects identified regimens into OMOP `omop.episode` + `omop.episode_event` rows. ARTEMIS (HemOnc.org's chemotherapy regimen ontology, accessed via the upstream R package) is the source of regimen patterns. After this plan, customers running MIMIC-IV (or any RxNorm-coded EHR loaded via Plan 4's pattern) get oncology-trial-grade regimen identification: ≥80% of regimens in a held-out chemo-cohort fixture must be correctly identified.

**Architecture:** A Python projection layer wraps the ARTEMIS R package, fetched at `parthenon-templates` Docker build time from a pinned commit SHA on the upstream GitHub repo (decision Q8). At template runtime, the projection layer reads `drug_exposure` rows for a cohort, joins them against ARTEMIS regimen patterns (drug-set + temporal-window matchers), and emits `episode` + `episode_event` rows scoped to the per-source CDM schema (`mimic_iv` by default; parameter-overridable). A new `RegimenMatcherNode` is the orchestration surface; it loads the ARTEMIS pattern library at boot and runs the matcher across batched cohort partitions. The R package is invoked **only at Docker build time** (to materialize the regimen-pattern JSON); at runtime, the matcher is pure Python — no R subprocess in the hot path.

**Tech Stack:** Python 3.12, Phase 0 + Phase 1 + Phase 2 toolchain. New container build deps: R 4.4 (already in `docker/r/Dockerfile` for HADES), `devtools` (for the R package install), the upstream ARTEMIS R package (pinned commit SHA). New Python deps in `templates/pyproject.toml`: none — the matcher uses pandas/polars (already pinned). The build-time step writes a versioned JSON pattern library to `templates/runtime/oncology/artemis/v0.1.0/patterns.json`.

**Depends on:** Phase 2 Plan 4 (PR #265, merged) — specifically the `mimic_iv.note` and `mimic_iv.drug_exposure` tables produced by `load_mimic_iv_omop`. The ARTEMIS template can run against any per-source CDM schema that has these tables, but Plan 4's load is the canonical fixture path.

**Unblocks:** Nothing in Phase 2; this is a leaf in the §8 dependency graph.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands is `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands is `/home/smudoshi/Github/Parthenon`.
- **Working directory** for all `docker compose` commands is `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`).
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Branch model:** sequential commits on the Phase 2 Plan 5 branch.
- **Type names** (stable across all tasks): `RegimenPattern`, `RegimenMatch`, `RegimenMatcher`, `RegimenMatcherNode`, `ArtemisLibraryError`, `EpisodeRow`, `EpisodeEventRow`.
- **ARTEMIS R package pin:** `https://github.com/HemOnc-org/HemOnc/tree/<commit-sha>` — resolve the pin at integration time against the latest ontology release; document the chosen SHA in ADR 0014. (Verify the actual repo path; the upstream may live at HemOnc-org/HemOnc or HemOnc-org/HemOncR — check before pinning.)

---

## Task index (13 tasks)

1. R package install in `parthenon-templates` Docker build (pinned commit SHA)
2. Build-time R script: extract ARTEMIS patterns to JSON
3. `RegimenPattern` typed model + JSON schema for the pattern library
4. `RegimenMatcher` core matcher (drug-set + temporal-window)
5. `RegimenMatch` typed result + episode/episode_event row builders
6. `RegimenMatcherNode` orchestration surface
7. Synthetic chemo-cohort fixture (~20 patients, 5 regimens, gold standard)
8. `omop.episode` + `omop.episode_event` table bootstrap (CDM v5.4 oncology extension)
9. `artemis_chemo_regimens` manifest stitching the pipeline
10. Validation pack — gold-standard CSV + ≥80% recall E2E
11. CI named E2E step in templates.yml
12. PHI/regimen-name HIGHSEC regression guard (no raw note text in episode rows)
13. ADR 0014 — ARTEMIS regimen extraction strategy + R-package pin

---

## Task 1: R package install in `parthenon-templates` Docker build

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/docker/templates/Dockerfile`
- Modify: `/home/smudoshi/Github/Parthenon/docker/templates/install_artemis.R`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_artemis_image_build.py
"""parthenon-templates image carries the ARTEMIS pattern library at runtime."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]


@pytest.mark.integration
def test_dockerfile_pins_artemis_commit_sha() -> None:
    body = (REPO / "docker" / "templates" / "Dockerfile").read_text(encoding="utf-8")
    # The pin must be a 7+ character hex commit SHA, not a branch.
    assert re.search(r"ref\s*=\s*['\"][0-9a-f]{7,}['\"]", body) or \
           re.search(r"@[0-9a-f]{7,}\b", body), "ARTEMIS pin must be a commit SHA"


@pytest.mark.integration
def test_install_script_exists_and_is_idempotent() -> None:
    p = REPO / "docker" / "templates" / "install_artemis.R"
    assert p.is_file()
    body = p.read_text(encoding="utf-8")
    assert "remotes::install_github" in body or "devtools::install_github" in body
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run pytest tests/integration/test_artemis_image_build.py -v -m integration
```

Expected: FAIL — install script + Dockerfile pin missing.

- [ ] **Step 3: Write minimal implementation**

```r
# docker/templates/install_artemis.R
# Build-time install of the ARTEMIS regimen-extraction R package.
# Pinned to a specific commit SHA per ADR 0014 + decision Q8.

install.packages(c("remotes", "jsonlite"), repos = "https://cloud.r-project.org")

# RESOLVE AT INTEGRATION TIME: confirm the upstream repo path + commit SHA.
# Likely: HemOnc-org/HemOnc or HemOnc-org/HemOncR. Pin via `ref = "<sha>"`.
remotes::install_github(
  "HemOnc-org/HemOnc",
  ref = "REPLACE_ME_WITH_REAL_COMMIT_SHA",  # documented in ADR 0014
  upgrade = "never"
)

cat("ARTEMIS package installed at commit ",
    packageVersion("HemOnc"), "\n",
    sep = "")
```

Modify `docker/templates/Dockerfile` to add the R-install layer:

```dockerfile
# After existing apt installs, add R + ARTEMIS:
RUN apt-get update && apt-get install -y --no-install-recommends \
      r-base-core \
      libssl-dev libcurl4-openssl-dev libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY install_artemis.R /tmp/install_artemis.R
RUN Rscript /tmp/install_artemis.R && rm /tmp/install_artemis.R

# Materialize the regimen-pattern JSON (Task 2 fills in the extraction script).
COPY extract_artemis_patterns.R /tmp/extract_artemis_patterns.R
RUN mkdir -p /opt/parthenon/oncology/artemis/v0.1.0 && \
    Rscript /tmp/extract_artemis_patterns.R \
      /opt/parthenon/oncology/artemis/v0.1.0/patterns.json && \
    rm /tmp/extract_artemis_patterns.R
```

- [ ] **Step 4-5:** Run test + gates. **Commit:** `feat(docker): pin ARTEMIS R package + install at parthenon-templates build time (Q8)`.

---

## Task 2: Build-time R script — extract patterns to JSON

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docker/templates/extract_artemis_patterns.R`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/integration/test_artemis_patterns_json.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/integration/test_artemis_patterns_json.py
"""The ARTEMIS pattern library JSON has the expected shape."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

# In CI the patterns.json is materialized at /opt/parthenon/.../patterns.json;
# locally we resolve via PARTHENON_ARTEMIS_PATTERNS env var or a fallback path.

@pytest.fixture
def patterns() -> dict:
    import os
    p = Path(os.environ.get(
        "PARTHENON_ARTEMIS_PATTERNS",
        "/opt/parthenon/oncology/artemis/v0.1.0/patterns.json",
    ))
    if not p.is_file():
        pytest.skip(f"patterns.json not present at {p} (run inside parthenon-templates image)")
    return json.loads(p.read_text(encoding="utf-8"))


@pytest.mark.integration
def test_patterns_top_level_keys(patterns: dict) -> None:
    assert "version" in patterns
    assert "regimens" in patterns
    assert isinstance(patterns["regimens"], list)
    assert len(patterns["regimens"]) > 50  # ARTEMIS has hundreds of regimens


@pytest.mark.integration
def test_each_regimen_has_required_fields(patterns: dict) -> None:
    for r in patterns["regimens"][:20]:
        assert {"regimen_name", "drugs", "phase"} <= set(r)
        assert isinstance(r["drugs"], list)
        for d in r["drugs"]:
            assert {"rxnorm_concept_id", "name"} <= set(d)
```

- [ ] **Step 2-5:** Implement `extract_artemis_patterns.R` to read ARTEMIS regimen tables and emit a JSON of the form:

```json
{
  "version": "v0.1.0",
  "source_commit": "<sha>",
  "regimens": [
    {
      "regimen_name": "FOLFIRINOX",
      "drugs": [
        {"name": "fluorouracil", "rxnorm_concept_id": 1153888},
        {"name": "leucovorin", "rxnorm_concept_id": 1190795},
        {"name": "irinotecan", "rxnorm_concept_id": 1736776},
        {"name": "oxaliplatin", "rxnorm_concept_id": 1736816}
      ],
      "phase": "induction",
      "indication": "pancreatic cancer"
    }
  ]
}
```

The exact shape resolves at integration time when the upstream package is concrete. **Commit:** `feat(docker): extract_artemis_patterns.R materializes regimen pattern library at build time`.

---

## Task 3: `RegimenPattern` typed model + JSON schema

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/__init__.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/types.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/artemis/v0.1.0/patterns.schema.json`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_oncology_types.py`

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_oncology_types.py
"""Pydantic typed models for ARTEMIS regimen patterns."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from runtime.oncology.types import RegimenDrug, RegimenPattern, RegimenMatch


def test_regimen_pattern_validates() -> None:
    pattern = RegimenPattern(
        regimen_name="FOLFIRINOX",
        drugs=[
            RegimenDrug(name="fluorouracil", rxnorm_concept_id=1153888),
            RegimenDrug(name="leucovorin", rxnorm_concept_id=1190795),
            RegimenDrug(name="irinotecan", rxnorm_concept_id=1736776),
            RegimenDrug(name="oxaliplatin", rxnorm_concept_id=1736816),
        ],
        phase="induction",
        indication="pancreatic cancer",
    )
    assert pattern.regimen_name == "FOLFIRINOX"
    assert len(pattern.drugs) == 4


def test_regimen_pattern_rejects_empty_drugs() -> None:
    with pytest.raises(ValidationError):
        RegimenPattern(regimen_name="x", drugs=[], phase="induction", indication="x")
```

- [ ] **Step 2-5:** Implement `RegimenDrug`, `RegimenPattern`, `RegimenMatch` Pydantic models with `extra="forbid"` and `frozen=True` for the immutable ones. Add a JSON schema for the patterns library. **Commit:** `feat(templates): RegimenPattern + RegimenDrug + RegimenMatch typed models`.

---

## Task 4: `RegimenMatcher` core matcher

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/matcher.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/exceptions.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_regimen_matcher.py`

The matcher logic: for each (person_id, day) pair in the input drug_exposure, find the largest subset of pattern.drugs that is co-administered within the regimen's defined temporal window (default ±7 days). If the subset covers ≥75% of the regimen's required drugs, emit a `RegimenMatch` for that person + start_date.

- [ ] **Step 1: Write the failing test**

```python
# templates/tests/unit/test_regimen_matcher.py
"""RegimenMatcher identifies regimens from drug_exposure rows."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from runtime.oncology.matcher import RegimenMatcher
from runtime.oncology.types import RegimenDrug, RegimenPattern


@pytest.fixture
def folfirinox() -> RegimenPattern:
    return RegimenPattern(
        regimen_name="FOLFIRINOX",
        drugs=[
            RegimenDrug(name="fluorouracil", rxnorm_concept_id=1153888),
            RegimenDrug(name="leucovorin", rxnorm_concept_id=1190795),
            RegimenDrug(name="irinotecan", rxnorm_concept_id=1736776),
            RegimenDrug(name="oxaliplatin", rxnorm_concept_id=1736816),
        ],
        phase="induction",
        indication="pancreatic cancer",
    )


def test_matcher_identifies_full_regimen(folfirinox: RegimenPattern) -> None:
    matcher = RegimenMatcher(patterns=[folfirinox])
    drug_exposures = [
        {"person_id": 1, "drug_concept_id": 1153888, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1190795, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1736776, "drug_exposure_start_date": date(2026, 4, 2)},
        {"person_id": 1, "drug_concept_id": 1736816, "drug_exposure_start_date": date(2026, 4, 2)},
    ]
    matches = matcher.match(drug_exposures)
    assert len(matches) == 1
    assert matches[0].regimen_name == "FOLFIRINOX"
    assert matches[0].person_id == 1


def test_matcher_skips_below_threshold(folfirinox: RegimenPattern) -> None:
    """Only 2 of 4 FOLFIRINOX drugs administered → < 75% → no match."""
    matcher = RegimenMatcher(patterns=[folfirinox])
    drug_exposures = [
        {"person_id": 1, "drug_concept_id": 1153888, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1190795, "drug_exposure_start_date": date(2026, 4, 1)},
    ]
    matches = matcher.match(drug_exposures)
    assert matches == []


def test_matcher_respects_temporal_window(folfirinox: RegimenPattern) -> None:
    """If 4 drugs administered but spread over 30 days, NO match (window exceeded)."""
    matcher = RegimenMatcher(patterns=[folfirinox], window_days=7)
    drug_exposures = [
        {"person_id": 1, "drug_concept_id": 1153888, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1190795, "drug_exposure_start_date": date(2026, 4, 1)},
        {"person_id": 1, "drug_concept_id": 1736776, "drug_exposure_start_date": date(2026, 4, 25)},
        {"person_id": 1, "drug_concept_id": 1736816, "drug_exposure_start_date": date(2026, 4, 25)},
    ]
    matches = matcher.match(drug_exposures)
    assert matches == []
```

- [ ] **Step 2-5:** Implement the matcher (sliding-window scan over per-person drug exposures, looking for `coverage >= 0.75` within `window_days`). **Commit:** `feat(templates): RegimenMatcher with drug-set + temporal-window matching`.

---

## Task 5: `RegimenMatch` → episode/episode_event row builders

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/oncology/cdm.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_oncology_cdm_builders.py`

OMOP CDM v5.4 oncology extension shapes:
- `episode`: episode_id, person_id, episode_concept_id (= regimen_concept_id), episode_start_date, episode_end_date, episode_parent_id, episode_object_concept_id, episode_type_concept_id (= 32880 'EHR-derived episode')
- `episode_event`: episode_id, event_id, episode_event_field_concept_id (= 1147127 'drug_exposure_id')

- [ ] **Step 1: Write the failing test + Step 2-5:** Implement. **Commit:** `feat(templates): episode + episode_event row builders for regimen matches`.

---

## Task 6: `RegimenMatcherNode`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/runtime/nodes/regimen_matcher.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_regimen_matcher_node.py`
- Modify: `/home/smudoshi/Github/Parthenon/templates/runtime/registry/materializer.py` (register node type)

- [ ] **Step 1: Write the failing test**

```python
def test_node_type_name() -> None:
    assert RegimenMatcherNode.type_name == "regimen_matcher"


def test_node_loads_patterns_at_init() -> None:
    node = RegimenMatcherNode()
    assert len(node.patterns) > 0  # loaded from packaged patterns.json


def test_node_run_returns_match_count() -> None:
    # Wire the node against an in-memory drug_exposure list; assert it
    # returns a {"regimens_matched": N} dict via run().
    ...
```

- [ ] **Step 2-5:** Implement. The node loads `runtime/oncology/artemis/v0.1.0/patterns.json` at init time, calls into `RegimenMatcher.match()` with the input drug_exposure rows, and emits `episode` + `episode_event` rows via the CDM builders. Output goes to the manifest's downstream `load_to_cdm` step. **Commit:** `feat(templates): RegimenMatcherNode (T-019b) with pattern lib at boot`.

---

## Task 7: Synthetic chemo-cohort fixture + gold standard

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/fixtures/synthetic/build_fixtures.py`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/fixtures/synthetic/cohort.json` (generated)
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/validation/expected/regimens.csv`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_artemis_synthetic_fixture.py`

The synthetic cohort: ~20 patients with known regimens (5 distinct regimens × 4 patients each):
- 4 × FOLFIRINOX (pancreatic cancer)
- 4 × FOLFOX (colorectal)
- 4 × R-CHOP (DLBCL)
- 4 × AC-T (breast cancer)
- 4 × Carboplatin + Paclitaxel (NSCLC)

Each patient gets the right RxNorm-coded drug_exposure rows on the right dates. The gold-standard CSV at `validation/expected/regimens.csv` has the expected regimen_name + person_id + start_date triples.

- [ ] **Step 1-2: Write the failing test + run**

```python
def test_fixture_has_20_patients() -> None:
    cohort = json.loads((FIXTURE_DIR / "cohort.json").read_text())
    assert len({r["person_id"] for r in cohort["drug_exposures"]}) == 20


def test_gold_standard_has_20_regimens() -> None:
    df = pd.read_csv(GOLD_PATH)
    assert len(df) == 20
    assert set(df["regimen_name"]) == {
        "FOLFIRINOX", "FOLFOX", "R-CHOP", "AC-T", "Carboplatin+Paclitaxel"
    }
```

- [ ] **Step 3-5:** Generate the fixture + gold standard. **Commit:** `feat(templates): ARTEMIS synthetic chemo-cohort (20 patients, 5 regimens)`.

---

## Task 8: `omop.episode` + `omop.episode_event` bootstrap

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/sql/00_bootstrap_episode_tables.sql`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_artemis_bootstrap_sql.py`

The OMOP CDM v5.4 oncology extension defines `episode` + `episode_event`. Phase 1 didn't ship them (they're not in the v5.4 base SQL); this plan adds them inline via a `sql_node` bootstrap step.

- [ ] **Step 1-5:** Test + implement. **Commit:** `feat(templates): omop.episode + episode_event bootstrap (CDM v5.4 oncology extension)`.

---

## Task 9: `artemis_chemo_regimens` manifest

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/manifest.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/README.md`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_artemis_manifest.py`

Pipeline:
1. `bootstrap_episode_tables` (sql_node) — creates `omop.episode` + `omop.episode_event` if missing
2. `read_drug_exposures` (sql_node) — pulls drug_exposure rows for the cohort into a temp table
3. `match_regimens` (regimen_matcher node) — runs the ARTEMIS matcher
4. `load_episodes` (sql_node) — INSERTs episode + episode_event rows into the per-source CDM schema
5. `summarize` (sql_node) — counts; recall against gold standard if `validation/expected/regimens.csv` is present

- [ ] **Step 1: Write the failing test**

```python
def test_manifest_loads() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    assert cfg["name"] == "artemis_chemo_regimens"


def test_manifest_requires_rxnorm_atc() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    required = cfg["metadata"]["required_vocabularies"]
    assert "RxNorm" in required
    assert "ATC" in required


def test_manifest_includes_regimen_matcher_node() -> None:
    cfg = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in cfg["nodes"]}
    assert "regimen_matcher" in types
```

- [ ] **Step 2-5:** Implement the manifest, run validate-manifests + gates. **Commit:** `feat(templates): artemis_chemo_regimens manifest (T-019b)`.

---

## Task 10: Validation pack — gold-standard + ≥80% recall E2E

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/manifests/artemis_chemo_regimens/validation/expected/post_conditions.yaml`
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/e2e/test_artemis_chemo_regimens.py`

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.integration
def test_artemis_recovers_at_least_80_pct_of_regimens(monkeypatch: pytest.MonkeyPatch) -> None:
    # Bootstrap omop + vocab + mimic_iv schemas via testcontainers Postgres.
    # Seed the 4 regimens' drugs in vocab.concept (RxNorm Ingredient class).
    # Load the synthetic cohort.json into mimic_iv.drug_exposure.
    # Run the artemis_chemo_regimens template.
    # Compare matched episodes against validation/expected/regimens.csv.
    # Assert recall >= 0.80 (16 of 20 patients correctly identified).
    ...
```

- [ ] **Step 2-5:** Wire the E2E. The 0.80 threshold is the spec §6 acceptance criterion. **Commit:** `test(templates): artemis_chemo_regimens E2E with ≥80% regimen-recall gate`.

---

## Task 11: CI named E2E step in templates.yml

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/.github/workflows/templates.yml`

Add a step after the existing `etl_dicom_metadata E2E`:

```yaml
      - name: artemis_chemo_regimens E2E
        working-directory: templates
        env:
          PARTHENON_ARTEMIS_PATTERNS: ${{ github.workspace }}/templates/runtime/oncology/artemis/v0.1.0/patterns.json
        run: uv run pytest tests/e2e/test_artemis_chemo_regimens.py -v -m integration
```

- [ ] **Step 1-3:** Add + validate YAML + commit. **Note:** the patterns.json is bundled in the templates package (not the customer-facing image only) so CI can run the E2E against a checkout. The customer-facing image still picks it up via the build-time R extraction in Task 1. **Commit:** `ci(templates): artemis_chemo_regimens E2E job`.

---

## Task 12: PHI/regimen-name HIGHSEC regression guard

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/templates/tests/unit/test_artemis_phi_guard.py`

Per HIGHSEC §7: episode rows must NOT carry raw clinical-note text. The regimen_name field carries the pattern's canonical name (e.g., "FOLFIRINOX"), not free-text from notes. This test guards against a regression that copies note text into the episode_source_value field.

- [ ] **Step 1: Write the failing test**

```python
def test_episode_source_value_never_contains_phi() -> None:
    """Synthesize an EpisodeRow from a RegimenMatch and assert source_value is the
    canonical regimen_name, not raw note text."""
    match = RegimenMatch(
        regimen_name="FOLFIRINOX",
        person_id=1,
        episode_start_date=date(2026, 4, 1),
        episode_end_date=date(2026, 6, 1),
        drug_exposure_ids=[101, 102, 103, 104],
    )
    row = build_episode_row(match)
    # Episode source value must be just the canonical regimen name —
    # never raw clinical text that could carry PHI.
    assert row["episode_source_value"] == "FOLFIRINOX"
    assert "Patient" not in row["episode_source_value"]
    assert "DOB" not in row["episode_source_value"]
```

- [ ] **Step 2-5:** Implement test (the current builders should already pass; this is a regression guard for future changes). **Commit:** `test(templates): ARTEMIS PHI HIGHSEC regression guard (§7)`.

---

## Task 13: ADR 0014 — ARTEMIS regimen extraction strategy + R-package pin

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/docs/architecture/adr-0014-artemis-regimen-extraction.md`

ADR 0014 covers:
- **Context:** Phase 2 §1 + Q8 (ARTEMIS R package fetched at Docker build, pinned commit SHA). The ~80% recall acceptance gate.
- **Decision:** Build-time R-script extracts the ARTEMIS regimen patterns to a versioned JSON library bundled in the `parthenon-templates` image. At runtime, the matcher is pure Python — no R subprocess in the hot path. Pin the upstream commit SHA in the Dockerfile + ADR (verify the actual repo path during integration: `HemOnc-org/HemOnc` vs `HemOnc-org/HemOncR`).
- **Consequences:** Runtime image grows by ~150 MB (R 4.4 + ARTEMIS dependencies + extracted JSON). Customers who don't run oncology ETL still pay this cost — acceptable per Q8. Upgrading the regimen library means rebuilding the templates image; document the cadence.
- **Alternatives considered:**
  - Bundle the regimen JSON without the R package (declined; we lose the ability to regenerate the JSON from upstream patches).
  - Ship the R package as a separate sidecar (declined; Q8 — increases ops surface for what is fundamentally a build-time data extract).
  - Customer-supplied regimen JSON (declined; Q8 — ops burden).
- **Open follow-ups:** Per-disease subset extraction (e.g., breast-only, pancreatic-only) for customers with narrow oncology scopes. Quarterly upstream-diff workflow to detect regimen library updates.

- [ ] **Step 1-2:** Draft + run gates. **Commit:** `docs(adr): ADR 0014 — ARTEMIS regimen extraction strategy + R-package pin`.

---

## Done

After Task 13 lands, Plan 5 is complete. The `artemis_chemo_regimens` template runs end-to-end against the synthetic cohort, identifies ≥80% of regimens via ARTEMIS pattern matching, and emits OMOP `episode` + `episode_event` rows scoped to the per-source CDM schema. Phase 2 is complete: 6 plans landed (Plans 1, 4, 6 in main; Plans 2, 3, 5 here pending merge).
