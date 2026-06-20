"""fhir_to_omop manifest validates and uses Plan 5 mappers."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import sqlalchemy
import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "fhir_to_omop" / "manifest.yaml"
VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample"


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "fhir_to_omop"
    assert manifest.metadata.category == "ingestion"


def _manifest_node(node_id: str) -> dict[str, object]:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    return next(n for n in payload["spec"]["nodes"] if n["node_id"] == node_id)


def _run_inline_python_node(node_id: str, artifact_root: Path) -> dict[str, object]:
    node = _manifest_node(node_id)
    namespace: dict[str, object] = {}
    code = str(node["params"]["code"])
    exec(compile(code, f"<{node_id}>", "exec"), namespace)
    context = SimpleNamespace(
        artifact_dir=artifact_root / node_id,
        db_dsn="sqlite:///:memory:",
    )
    context.artifact_dir.mkdir(parents=True)
    params = {
        "vocab_schema": "vocab",
        "permit_concept_id": "4055893",
        "deny_concept_id": "4054745",
    }
    result = namespace["main"](context, params)
    assert isinstance(result, dict)
    return result


def test_manifest_mappers_write_empty_artifacts_when_resources_absent(tmp_path: Path) -> None:
    expected = {
        "map_patients": ({"persons_mapped": 0}, ["patients.json"]),
        "map_encounters": ({"visits_mapped": 0}, ["visits.json"]),
        "map_conditions": ({"conditions_mapped": 0}, ["conditions.json"]),
        "map_observations": (
            {"measurements_mapped": 0, "observations_mapped": 0},
            ["measurements.json", "observations.json"],
        ),
        "map_procedures": ({"procedures_mapped": 0}, ["procedures.json"]),
        "map_medications": (
            {"drug_exposures_meds_mapped": 0},
            ["drug_exposures_meds.json"],
        ),
        "map_immunizations": (
            {"drug_exposures_imm_mapped": 0},
            ["drug_exposures_imm.json"],
        ),
        "map_diagnostic_reports": (
            {"diagnostic_reports_mapped": 0},
            ["diagnostic_reports.json"],
        ),
        "map_consents": (
            {"consents_mapped": 0, "consent_decisions": 0},
            ["consents.json", "consent_decisions.json"],
        ),
    }

    for node_id, (outputs, artifact_names) in expected.items():
        assert _run_inline_python_node(node_id, tmp_path) == outputs
        for artifact_name in artifact_names:
            artifact = tmp_path / node_id / artifact_name
            assert artifact.exists(), f"{node_id} did not write {artifact_name}"
            assert json.loads(artifact.read_text(encoding="utf-8")) == []


def _write_json(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows), encoding="utf-8")


class _FakeConnection:
    def __init__(self) -> None:
        self.executions: list[tuple[str, dict[str, object]]] = []

    def execute(self, statement: object, params: dict[str, object] | None = None) -> None:
        self.executions.append((str(statement), params or {}))


class _FakeBegin:
    def __init__(self, conn: _FakeConnection) -> None:
        self.conn = conn

    def __enter__(self) -> _FakeConnection:
        return self.conn

    def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return False


class _FakeEngine:
    def __init__(self) -> None:
        self.conn = _FakeConnection()

    def begin(self) -> _FakeBegin:
        return _FakeBegin(self.conn)


def test_load_to_cdm_treats_missing_optional_mapper_outputs_as_empty(
    tmp_path: Path, monkeypatch
) -> None:
    fake_engine = _FakeEngine()
    monkeypatch.setattr(sqlalchemy, "create_engine", lambda *args, **kwargs: fake_engine)

    run_dir = tmp_path / "run"
    load_dir = run_dir / "load_to_cdm"
    load_dir.mkdir(parents=True)
    _write_json(
        run_dir / "map_patients" / "patients.json",
        [
            {
                "gender_concept_id": 8507,
                "year_of_birth": 1970,
                "month_of_birth": 6,
                "day_of_birth": 15,
                "birth_datetime": "1970-06-15T00:00:00",
                "race_concept_id": 0,
                "ethnicity_concept_id": 0,
                "person_source_value": "p1",
            }
        ],
    )
    _write_json(
        run_dir / "map_observations" / "measurements.json",
        [
            {
                "person_source_value": "p1",
                "visit_source_value": None,
                "measurement_concept_id": 3004249,
                "measurement_date": "2026-04-01",
                "measurement_datetime": "2026-04-01T08:30:00",
                "measurement_type_concept_id": 32817,
                "value_as_number": 120.0,
                "unit_concept_id": 0,
                "measurement_source_value": "8480-6",
                "measurement_source_concept_id": 3004249,
            }
        ],
    )
    _write_json(run_dir / "map_observations" / "observations.json", [])

    node = _manifest_node("load_to_cdm")
    namespace: dict[str, object] = {}
    exec(compile(str(node["params"]["code"]), "<load_to_cdm>", "exec"), namespace)
    context = SimpleNamespace(artifact_dir=load_dir, db_dsn="postgresql://unused")
    result = namespace["main"](context, {"target_schema": "omop", "app_schema": "app"})

    assert isinstance(result, dict)
    assert result["persons"] == 1
    assert result["measurements"] == 1
    assert result["visits"] == 0
    assert result["conditions"] == 0
    assert result["procedures"] == 0
    assert result["drug_exposures"] == 0
    assert result["diagnostic_reports"] == 0
    assert result["consent_observations"] == 0
    assert result["consent_decisions"] == 0
    assert len(fake_engine.conn.executions) == 2


def test_manifest_imports_pra_mappers() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.patient",
        "runtime.fhir_to_omop.encounter",
        "runtime.fhir_to_omop.condition",
        "runtime.fhir_to_omop.observation",
    ):
        assert module in text


def test_manifest_uses_fhir_resource_for_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_supports_strict_profile_match_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "strict_profile_match" in props


def test_manifest_targets_pr_a_resources() -> None:
    """PR-A scope: Patient, Encounter, Condition, Observation only."""
    text = MANIFEST.read_text(encoding="utf-8")
    for resource in ("Patient", "Encounter", "Condition", "Observation"):
        assert resource in text


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixture_corpus_present() -> None:
    """4 NDJSON files (Patient, Encounter, Condition, Observation)."""
    expected = {
        "Patient.ndjson",
        "Encounter.ndjson",
        "Condition.ndjson",
        "Observation.ndjson",
    }
    actual = {p.name for p in FIXTURES.glob("*.ndjson")}
    assert expected.issubset(actual), f"missing fixture files: {expected - actual}"


def test_fixture_resources_marked_synthetic() -> None:
    """Every fixture line must carry the SYNTHETIC tag."""
    for f in FIXTURES.glob("*.ndjson"):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            obj = json.loads(line)
            tag = obj.get("meta", {}).get("tag", [])
            assert any(
                t.get("code") == "SYNTHETIC" for t in tag
            ), f"missing SYNTHETIC tag in {f.name}"


def test_post_conditions_assert_pra_resource_counts() -> None:
    pc = yaml.safe_load(
        (VAL_ROOT / "expected" / "post_conditions.yaml").read_text(encoding="utf-8")
    )
    # Only consider unfiltered row_count entries — PR-C adds filtered entries
    # (where clause) for the same omop.observation table that we don't want
    # to collide with PR-A's table-wide totals.
    tables = {
        p["table"]: p
        for p in pc["post_conditions"]
        if p["kind"] == "row_count" and "where" not in p
    }
    assert tables["omop.person"]["expected"] == 2
    assert tables["omop.visit_occurrence"]["expected"] == 2
    assert tables["omop.condition_occurrence"]["expected"] == 2
    assert tables["omop.measurement"]["expected"] == 2
    assert tables["omop.observation"]["expected"] == 2


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
    for h in REQUIRED_HEADINGS:
        assert h in text, f"README missing section: {h}"


def test_readme_documents_pr_a_scope_and_pr_b_pr_c_deferral() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    assert "PR-A" in text
    assert "PR-B" in text or "Plan 6" in text
    assert "PR-C" in text or "Plan 7" in text


# --- PR-B (Plan 6) extension tests ---


def test_manifest_pr_b_imports() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.procedure",
        "runtime.fhir_to_omop.medication",
        "runtime.fhir_to_omop.immunization",
    ):
        assert module in text


def test_manifest_pr_b_resource_types_in_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    ingest = next(n for n in payload["spec"]["nodes"] if n["node_id"] == "ingest_fhir")
    rt = ingest["params"]["resource_types"]
    for resource in (
        "Patient",
        "Encounter",
        "Condition",
        "Observation",
        "Procedure",
        "MedicationRequest",
        "MedicationStatement",
        "MedicationAdministration",
        "Immunization",
    ):
        assert resource in rt, f"manifest missing PR-B resource type: {resource}"


def test_manifest_pr_b_load_targets_drug_exposure_and_procedure() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "procedure_occurrence" in text
    assert "drug_exposure" in text


def test_pr_b_fixtures_present() -> None:
    fixtures = MANIFEST.parent / "fixtures" / "sample"
    for f in ("Procedure.ndjson", "MedicationRequest.ndjson", "Immunization.ndjson"):
        assert (fixtures / f).exists(), f"missing PR-B fixture: {f}"


def test_pr_b_post_conditions_added() -> None:
    pc = yaml.safe_load(
        (MANIFEST.parent / "validation" / "expected" / "post_conditions.yaml").read_text("utf-8")
    )
    tables = {p.get("table") for p in pc["post_conditions"]}
    assert any("procedure_occurrence" in str(t) for t in tables)
    assert any("drug_exposure" in str(t) for t in tables)


def test_readme_documents_pr_b_resources() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for resource in ("Procedure", "MedicationRequest", "Immunization"):
        assert resource in text
    for cid in ("32839", "38000179", "38000180", "581452"):
        assert cid in text


def test_adr_0008_has_pr_b_amendment() -> None:
    adr = (
        Path(__file__).resolve().parents[3]
        / "docs"
        / "lineage"
        / "decisions"
        / "adr"
        / "0008-fhir-to-omop-architecture.md"
    )
    text = adr.read_text(encoding="utf-8")
    assert "PR-B" in text
    assert "drug_type_concept_id" in text
    assert "medicationReference" in text
    assert "CVX" in text


# --- PR-C (Plan 7) extension tests ---


def test_manifest_pr_c_imports() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.diagnostic_report",
        "runtime.fhir_to_omop.consent",
    ):
        assert module in text


def test_manifest_pr_c_resource_types_in_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    ingest = next(n for n in payload["spec"]["nodes"] if n["node_id"] == "ingest_fhir")
    rt = ingest["params"]["resource_types"]
    for resource in ("DiagnosticReport", "Consent"):
        assert resource in rt, f"manifest missing PR-C resource type: {resource}"


def test_manifest_pr_c_consent_params() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "consent_permit_concept_id" in props
    assert "consent_deny_concept_id" in props


def test_manifest_pr_c_load_writes_consent_decisions() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "consent_decisions" in text


def test_pr_c_consent_decisions_migration_exists() -> None:
    backend = Path(__file__).resolve().parents[3] / "backend"
    matches = list(backend.glob("database/migrations/*_create_consent_decisions_table.php"))
    assert matches, "Laravel migration for app.consent_decisions not found"


def test_pr_c_fixtures_present() -> None:
    fixtures = MANIFEST.parent / "fixtures" / "sample"
    for f in ("DiagnosticReport.ndjson", "Consent.ndjson"):
        assert (fixtures / f).exists(), f"missing PR-C fixture: {f}"


def test_pr_c_consent_fixtures_marked_synthetic() -> None:
    consent_path = MANIFEST.parent / "fixtures" / "sample" / "Consent.ndjson"
    for line in consent_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        tags = obj.get("meta", {}).get("tag", [])
        assert any(t.get("code") == "SYNTHETIC" for t in tags), "missing SYNTHETIC tag"


def test_pr_c_post_conditions_added() -> None:
    pc = yaml.safe_load(
        (MANIFEST.parent / "validation" / "expected" / "post_conditions.yaml").read_text("utf-8")
    )
    descriptions = " ".join(p.get("description", "") for p in pc["post_conditions"])
    assert "PR-C" in descriptions
    assert any(p.get("table") == "app.consent_decisions" for p in pc["post_conditions"])


def test_pr_c_dqd_check_added() -> None:
    dqd = yaml.safe_load((MANIFEST.parent / "validation" / "dqd_checks.yaml").read_text("utf-8"))
    check_ids = {c["check_id"] for c in dqd["checks"]}
    assert "pr_c_consent_decision_links_back_to_observation" in check_ids


def test_pr_c_validation_parameters_include_consent_concept_ids() -> None:
    params = json.loads(
        (MANIFEST.parent / "validation" / "inputs" / "parameters.json").read_text("utf-8")
    )
    assert params["consent_permit_concept_id"] == 4055893
    assert params["consent_deny_concept_id"] == 4054745
