# Parthenon Ingestion Templates — Phase 3, Plan 1: T-021A — X12 837 Reader + COST Projection

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First slice of T-021 (`claims_to_omop`). Lands the X12 837 (institutional + professional + dental) reader, projects to OMOP `VISIT_OCCURRENCE` + `PROCEDURE_OCCURRENCE` + `CONDITION_OCCURRENCE` + `COST`. Commercial-tier per Phase 3 spec §2 + Q1=(b′). Uses `pyx12` (Phase 3 Q2=(a)).

**Architecture:** New commercial-tier node `X12_837_Reader` reads loop-segmented 837P/I/D files, normalizes to a canonical claim line table, and projects to OMOP CDM tables. The reader lives at `templates/runtime/commercial/claims/readers/x12_837.py`; the manifest at `templates/manifests/_commercial/claims_to_omop/`. Uses `pyx12` (BSD-3) for parsing — composes with both AGPL community and proprietary commercial wheels. The projection logic includes the COST table (charged/paid/allowed amounts), which is the Parthenon-specific value-add (D2E doesn't ship this).

**Tech Stack:** Python 3.12, Phase 0–2 toolchain. New deps:
- `pyx12==2.4.5` (or latest BSD-3 release; pin the commit on PyPI as of 2026-05-06)

**Depends on:**
- Phase 3 Plan 0 (sql_file:// reader merged) — manifests reference `sql_file://sql/*.sql`.
- Phase 0 `sql_node`, `csv_reader`, `db_writer`.
- Phase 1 `parthenon-templates-commercial` wheel scaffolding (NEW — Q1 outcome; sets up `templates/commercial/pyproject.toml`, `import-linter` contract, isolated-install CI job).

**Unblocks:**
- Phase 3 Plan 2 (T-021B, X12 835 remit reconciliation) — joins on `claim_id` from this reader's output.
- Phase 3 Plan 3 (T-021C, NCPDP) — shares the COST projection helper.

---

## Conventions used throughout this plan

- **Working directory** for `uv run`: `/home/smudoshi/Github/Parthenon/templates`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`).
- **All code must pass** `ruff check`, `black --check --line-length 100`, `mypy --strict` against `templates/runtime/` AND `templates/commercial/`.
- **`import-linter` contract** must hold: nothing under `runtime/` may import `runtime.commercial.*`.
- **Branch model:** sequential commits on `feature/phase-3-plan-1-x12-837`.
- **Type names:** `X12_837_Reader`, `X12_837_Claim`, `X12_837_ClaimLine`, `X12ParseError`, `CostProjector`.

---

## Task index (12 tasks)

1. Bootstrap commercial-tier wheel + `import-linter` contract + CI isolated-install job
2. Pin `pyx12==2.4.5` (community wheel — pyx12 is BSD, available everywhere)
3. `X12_837_Claim` + `X12_837_ClaimLine` typed Pydantic models
4. `X12_837_Reader` reader core (parses 837P/I/D segment loops via pyx12)
5. `CostProjector` — charged/paid/allowed amounts → COST table rows
6. Synthetic 837 fixtures (CMS public examples, attribution in README)
7. `claims_to_omop` manifest scaffold (commercial-tier)
8. SQL bootstrap — claims source schema (`fmt_837_claim`, `fmt_837_line`)
9. Mappers: 837 → VISIT_OCCURRENCE / PROCEDURE_OCCURRENCE / CONDITION_OCCURRENCE / COST
10. Validation pack — 100k-line synthetic claim file → recall + cost-amount sentinel
11. HIGHSEC PHI guard — provider NPIs and patient identifiers never leak to logs
12. ADR 0016 — claims_to_omop COST projection convention

---

## Task 1: Commercial-tier wheel scaffold

**Files:**
- Create: `templates/commercial/pyproject.toml`
- Create: `templates/commercial/README.md`
- Create: `templates/commercial/runtime/__init__.py`
- Create: `templates/commercial/manifests/.gitkeep`
- Create: `templates/.importlinter`
- Modify: `.github/workflows/templates.yml` (add `community-wheel-isolation` job)
- Modify: `templates/pyproject.toml` (split off `templates/runtime/commercial/` to the new wheel)

- [ ] **Step 1 — failing test:**

```python
def test_community_wheel_does_not_import_commercial(tmp_path: Path) -> None:
    """Build the community wheel only, verify imports work without commercial path."""
    # Sub-process build: uv build --wheel templates/
    # Then sub-process install + import smoke-test:
    #   uv pip install dist/parthenon_templates-*.whl
    #   python -c "from runtime.nodes.note_nlp import NoteNlpNode"
    # Must succeed with NO templates/commercial/ on PYTHONPATH.
    ...


def test_import_linter_contract_holds() -> None:
    # subprocess.run(["uv", "run", "lint-imports"]) → exit 0
    ...
```

- [ ] **Steps 2–5:** Implement the two-wheel split:
  - `templates/pyproject.toml` keeps `[project.name = "parthenon-templates"]`, AGPLv3, packages = `["runtime"]` (excluding `runtime.commercial`).
  - New `templates/commercial/pyproject.toml`: `[project.name = "parthenon-templates-commercial"]`, license = "Proprietary", packages = `["runtime.commercial"]`.
  - `.importlinter` config: `forbidden` contract, source modules `runtime.*` (not `.commercial`), forbidden `runtime.commercial.*`.
  - CI job builds community wheel only, installs into a clean venv, runs `pytest -m smoke` (a new marker for the smoke set) without any commercial path on `PYTHONPATH`.
  - **Commit:** `chore(templates): commercial-tier wheel scaffold + import-linter contract + CI isolation job`.

---

## Task 2: Pin `pyx12`

**Files:**
- Modify: `templates/commercial/pyproject.toml` (add `pyx12==2.4.5` to deps)
- Create: `templates/tests/unit/test_pyx12_packaging.py` (commercial-only test)

- [ ] **Steps 1–5:** Pin, verify import smoke. **Commit:** `chore(templates): pin pyx12==2.4.5 (BSD-3) for X12 837/835`.

---

## Task 3: Typed claim models

**Files:**
- Create: `templates/commercial/runtime/commercial/claims/types.py`
- Create: `templates/commercial/runtime/commercial/claims/exceptions.py`
- Create: `templates/tests/unit/commercial/test_x12_837_types.py`

```python
class X12_837_Claim(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    claim_id: str = Field(min_length=1)
    payer_id: str
    submitter_id: str
    receiver_id: str
    subscriber_id: str
    patient_id: str  # de-identified or hashed; HIGHSEC §7
    claim_type: Literal["P", "I", "D"]  # Professional / Institutional / Dental
    statement_date: date
    total_charged: Decimal
    total_paid: Decimal | None = None
    diagnosis_codes: list[str] = Field(default_factory=list)  # ICD-10
    place_of_service: str | None = None


class X12_837_ClaimLine(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    claim_id: str
    line_number: int = Field(ge=1)
    procedure_code: str  # CPT/HCPCS
    procedure_modifiers: list[str] = Field(default_factory=list)
    service_date_from: date
    service_date_to: date
    units: Decimal = Field(ge=0)
    charged_amount: Decimal = Field(ge=0)
    allowed_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    diagnosis_pointers: list[int] = Field(default_factory=list)
```

- [ ] Tests assert: extra="forbid", frozen=True, field constraints fire on bad input. **Commit:** `feat(templates/commercial): X12_837_Claim + X12_837_ClaimLine typed models`.

---

## Task 4: Reader core

**Files:**
- Create: `templates/commercial/runtime/commercial/claims/readers/x12_837.py`
- Create: `templates/tests/unit/commercial/test_x12_837_reader.py`

The reader iterates pyx12 segment loops, materializing one `X12_837_Claim` per CLM-rooted loop and one `X12_837_ClaimLine` per SV1/SV2/SV3 loop. Test against a tiny in-memory 837 transaction (no fixture file).

**Commit:** `feat(templates/commercial): X12_837_Reader core (P/I/D segment-loop walker)`.

---

## Task 5: COST projection

**Files:**
- Create: `templates/commercial/runtime/commercial/claims/cost_projector.py`
- Create: `templates/tests/unit/commercial/test_cost_projector.py`

Maps `(charged_amount, allowed_amount, paid_amount)` from claim line → `cost.cost` rows with the OMOP CDM v5.4 columns: `cost_event_id`, `cost_event_field_concept_id` (procedure_occurrence/visit_occurrence), `cost_concept_id`, `cost`, `currency_concept_id` (USD = 44818668), `revenue_code_concept_id`, `payer_plan_period_id`. Reference: OMOP CDM v5.4 spec §COST.

**Commit:** `feat(templates/commercial): CostProjector — 837 amounts → COST rows`.

---

## Task 6: Synthetic fixtures

**Files:**
- Create: `templates/commercial/manifests/claims_to_omop/fixtures/synthetic/build_837_corpus.py`
- Create: `templates/commercial/manifests/claims_to_omop/fixtures/synthetic/cms_837p_example.txt`
- Create: `templates/commercial/manifests/claims_to_omop/fixtures/synthetic/cms_837i_example.txt`
- Create: `templates/commercial/manifests/claims_to_omop/fixtures/synthetic/cms_837d_example.txt`

CMS publishes example 837 transactions for testing — public domain, no PHI. Fixture builder produces a 100-claim synthetic corpus deterministically (seed=42) for the validation E2E.

**Commit:** `feat(templates/commercial): synthetic 837 P/I/D fixtures + 100-claim corpus builder`.

---

## Task 7: Manifest

**Files:**
- Create: `templates/commercial/manifests/claims_to_omop/manifest.yaml`
- Create: `templates/commercial/manifests/claims_to_omop/README.md`

12-stage pipeline: bootstrap source schema → load 837 → bootstrap CDM → map per-domain → COST projection → summarize → validate.

**Commit:** `feat(templates/commercial): claims_to_omop manifest scaffold (12 stages)`.

---

## Task 8: SQL bootstrap

**Files:**
- Create: `templates/commercial/manifests/claims_to_omop/sql/00_bootstrap_source_schema.sql`
- Create: `templates/commercial/manifests/claims_to_omop/sql/01_load_source_csv.sql`

`fmt_837_claim` + `fmt_837_line` tables in `${parameters.source_schema}` (default `claims_source`).

**Commit:** `feat(templates/commercial): claims_to_omop bootstrap SQL`.

---

## Task 9: Mappers

**Files:**
- Create: `templates/commercial/manifests/claims_to_omop/sql/02a_map_visit_occurrence.sql`
- Create: `templates/commercial/manifests/claims_to_omop/sql/02b_map_procedure_occurrence.sql`
- Create: `templates/commercial/manifests/claims_to_omop/sql/02c_map_condition_occurrence.sql`
- Create: `templates/commercial/manifests/claims_to_omop/sql/02d_project_cost.sql`

Each mapper joins `fmt_837_*` against `vocab.concept` + `vocab.concept_relationship 'Maps to'` and inserts into `${parameters.cdm_schema}.<table>`.

**Commit:** `feat(templates/commercial): claims_to_omop per-domain mappers + COST projection`.

---

## Task 10: Validation pack

**Files:**
- Create: `templates/commercial/manifests/claims_to_omop/validation/expected/post_conditions.yaml`
- Create: `templates/commercial/manifests/claims_to_omop/validation/expected/cost_sentinels.csv`
- Create: `templates/tests/e2e/commercial/test_claims_to_omop_837.py`

Acceptance: 100k-line synthetic claim file processed in <30 minutes (devplan T-021 perf budget); cost sentinel row counts match expected ±2%; no orphan `procedure_occurrence` without `cost`.

**Commit:** `test(templates/commercial): claims_to_omop 100k-line E2E with cost sentinels`.

---

## Task 11: HIGHSEC PHI guard

**Files:**
- Modify: `templates/commercial/runtime/commercial/claims/readers/x12_837.py` (sanitize logs)
- Create: `templates/tests/unit/commercial/test_x12_837_phi_guard.py`

Per HIGHSEC §7: provider NPI + patient subscriber ID are PHI-adjacent. Reader logs MUST never include them; assert via a regression test that captures stderr during a known parse and greps for representative test values.

**Commit:** `feat(templates/commercial): HIGHSEC PHI guard for 837 reader`.

---

## Task 12: ADR 0016

**Files:**
- Create: `docs/architecture/adr-0016-claims-to-omop-cost-projection.md`

ADR records:
- **Context:** D2E does not project COST; Parthenon claims_to_omop ships it as the primary commercial wedge per devplan T-021 §"why this matters".
- **Decision:** Use OMOP CDM v5.4 COST table; map charged/paid/allowed from 837 SV1/SV2/SV3 + 835 amounts (Plan 2 wires the 835 reconciliation). Currency hard-coded to USD = 44818668 in v0.1 (multi-currency is a Phase 4 follow-up).
- **Consequences:** Customers running `claims_to_omop` can answer cost-effectiveness research questions D2E can't. The `parthenon-templates-commercial` wheel becomes a hard dependency for any analytics that joins `cost`.
- **Alternatives considered:** Custom `parthenon_cost` table (loses OMOP interop); pull cost from 835 only (loses charged-amount visibility for unpaid claims).
- **Open follow-ups:** Multi-currency support (Phase 4); `payer_plan_period` table population (depends on member-eligibility data, not in 837); reversal/voided-claim handling (Plan 2's 835 reconciliation surfaces this).

**Commit:** `docs(adr): ADR 0016 — claims_to_omop COST projection (Parthenon commercial wedge)`.

---

## Done

After Task 12 lands, Plan 1 is complete. The X12 837 reader + COST projector ship as the first commercial-tier template. Plan 2 (835 remit reconciliation) joins onto this output via `claim_id`.
