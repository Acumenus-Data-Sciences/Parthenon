"""ADR documents for Phase 0 must exist, follow MADR shape, AND remain in
sync with the shipped implementation.

This guards three Architecture Decision Records that anchor Phase 0 of the
parthenon-templates milestone:

* 0001 — Node SDK design (T-001).
* 0002 — Orchestration backend (Task 23).
* 0003 — Template manifest format (Task 31).

The MADR-shape tests run unconditionally. The "decision text matches
implementation" tests cite specific files in ``runtime/`` so the ADRs
cannot drift from the shipped code without breaking the suite (Plan 4
Task 21).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
ADR_DIR = REPO / "docs" / "adr"
RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"

# Each entry: (filename, title_keyword). Add the next ADR with a one-line
# extension when it lands.
EXPECTED_ADRS = [
    pytest.param("0001-node-sdk-design.md", "Node SDK", id="0001"),
    pytest.param("0002-orchestration-backend.md", "Orchestration", id="0002"),
    pytest.param("0003-template-manifest-format.md", "Manifest", id="0003"),
    pytest.param("0004-phase-1-node-design.md", "Phase 1 Node", id="0004"),
    pytest.param("0005-imaging-vocabulary-namespace.md", "Imaging Vocabulary", id="0005"),
    pytest.param("0006-pro-instrument-framework.md", "PRO Instrument", id="0006"),
    pytest.param("0007-fhir-anonymizer-template.md", "FHIR Anonymizer", id="0007"),
    pytest.param("0008-fhir-to-omop-architecture.md", "FHIR", id="0008"),
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


# --- Decision-text-vs-implementation guards (Plan 4 Task 21) -----------------


def _adr_text(filename: str) -> str:
    return (ADR_DIR / filename).read_text(encoding="utf-8")


# ADR 0001: every claimed bootstrap node must exist as a module under
# ``runtime/nodes/``. The ADR's table lists 8 type_names; the test below
# asserts each has a corresponding source file (no scaffolds, no stubs).
ADR_0001_EXPECTED_NODE_FILES = {
    "python": "python_node.py",
    "sql": "sql_node.py",
    "csv_reader": "csv_reader.py",
    "db_reader": "db_reader.py",
    "db_writer": "db_writer.py",
    "py2table": "py2table.py",
    "generic_file": "generic_file.py",
    "r": "r_node.py",
}


@pytest.mark.parametrize(
    "type_name,filename",
    sorted(ADR_0001_EXPECTED_NODE_FILES.items()),
)
def test_adr_0001_node_module_exists(type_name: str, filename: str) -> None:
    """Every bootstrap node ADR 0001 names must have a runtime module."""
    text = _adr_text("0001-node-sdk-design.md")
    assert f"`{type_name}`" in text, f"ADR 0001 does not mention type_name `{type_name}`"
    module = RUNTIME_DIR / "nodes" / filename
    assert module.exists(), f"ADR 0001 promises {type_name} ({filename}) — module is missing"


def test_adr_0001_node_abc_lives_in_base_module() -> None:
    """ADR 0001 promises the Node ABC lives at runtime/nodes/base.py."""
    text = _adr_text("0001-node-sdk-design.md")
    assert "runtime/nodes/base.py" in text
    assert (RUNTIME_DIR / "nodes" / "base.py").exists()


# ADR 0002: orchestration backend selection by env var, default prefect,
# stubs for temporal/dagster/airflow, factory in runtime/orchestration/factory.py.
ADR_0002_EXPECTED_BACKEND_FILES = [
    "interface.py",
    "factory.py",
    "flow_spec.py",
    "prefect_backend.py",
    "temporal_backend.py",
    "dagster_backend.py",
    "airflow_backend.py",
    "storage.py",
]


@pytest.mark.parametrize("filename", ADR_0002_EXPECTED_BACKEND_FILES)
def test_adr_0002_orchestration_module_exists(filename: str) -> None:
    """Every orchestration component ADR 0002 names must exist."""
    text = _adr_text("0002-orchestration-backend.md")
    module = RUNTIME_DIR / "orchestration" / filename
    assert module.exists(), f"ADR 0002 references {filename} — module is missing"
    if filename == "factory.py":
        assert "runtime/orchestration/factory.py" in text


def test_adr_0002_default_backend_env_var() -> None:
    """ADR 0002 declares ``PARTHENON_ORCHESTRATION_BACKEND`` as the selector."""
    text = _adr_text("0002-orchestration-backend.md")
    assert "PARTHENON_ORCHESTRATION_BACKEND" in text
    factory_text = (RUNTIME_DIR / "orchestration" / "factory.py").read_text(encoding="utf-8")
    assert "PARTHENON_ORCHESTRATION_BACKEND" in factory_text


# ADR 0003: manifest schema lives at template.v1.json and pins the
# bootstrap node-type enum to the same 8 types ADR 0001 names.
def test_adr_0003_schema_path_exists() -> None:
    text = _adr_text("0003-template-manifest-format.md")
    schema_path = RUNTIME_DIR / "registry" / "schema" / "template.v1.json"
    assert schema_path.exists()
    assert "templates/runtime/registry/schema/template.v1.json" in text


def test_adr_0003_node_type_enum_includes_adr_0001() -> None:
    """The schema's node-type enum must contain every node ADR 0001 promises.

    Phase 1 (ADR 0004) extends the set with fhir_resource, dicom_metadata,
    anonymizer; the assertion is therefore a *superset*, not equality. The
    Phase-1-specific guard lives in ``test_adr_0004_*`` below.
    """
    schema_path = RUNTIME_DIR / "registry" / "schema" / "template.v1.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    enum = schema["properties"]["spec"]["properties"]["nodes"]["items"]["properties"]["type"][
        "enum"
    ]
    missing = set(ADR_0001_EXPECTED_NODE_FILES.keys()) - set(enum)
    assert not missing, f"schema enum drifted from ADR 0001 — missing: {sorted(missing)}"


def test_adr_0003_materializer_redacts_secrets() -> None:
    """ADR 0003 promises secret redaction at the registry layer."""
    text = _adr_text("0003-template-manifest-format.md")
    assert "redact" in text.lower()
    materializer = (RUNTIME_DIR / "registry" / "materializer.py").read_text(encoding="utf-8")
    assert "redact_secrets" in materializer
    assert "REDACTED" in materializer


# ADR 0004: every Phase 1 node ADR 0004 names must exist as a runtime module
# AND be wired into the orchestrator's NODE_REGISTRY. Decision-text-vs-code
# guards mirror the ADR-0001 pattern.
ADR_0004_EXPECTED_NODE_FILES = {
    "fhir_resource": "fhir_resource.py",
    "dicom_metadata": "dicom_metadata.py",
    "anonymizer": "anonymizer.py",
}


@pytest.mark.parametrize("type_name,filename", sorted(ADR_0004_EXPECTED_NODE_FILES.items()))
def test_adr_0004_phase_1_node_module_exists(type_name: str, filename: str) -> None:
    text = _adr_text("0004-phase-1-node-design.md")
    assert f"`{type_name}`" in text, f"ADR 0004 does not mention type_name `{type_name}`"
    module = RUNTIME_DIR / "nodes" / filename
    assert module.exists(), f"ADR 0004 promises {type_name} ({filename}) — module is missing"


def test_adr_0004_anonymizer_config_schema_exists() -> None:
    """ADR 0004 §5 promises a v1 anonymizer config JSON Schema."""
    text = _adr_text("0004-phase-1-node-design.md")
    assert "anonymizer_config.v1.json" in text
    schema_path = RUNTIME_DIR / "nodes" / "schemas" / "anonymizer_config.v1.json"
    assert schema_path.exists()


def test_adr_0004_sidecar_image_path_exists() -> None:
    """ADR 0004 §6 promises a parthenon-anonymizer Dockerfile under docker/."""
    text = _adr_text("0004-phase-1-node-design.md")
    assert "parthenon-anonymizer" in text
    assert "ghcr.io/acumenus-data-sciences/parthenon-fhir-anonymizer" in text
    dockerfile = REPO / "docker" / "parthenon-anonymizer" / "Dockerfile"
    assert dockerfile.exists()


def test_adr_0004_phase_1_nodes_in_schema_enum() -> None:
    """ADR 0004 §1 says the new types are added to the manifest schema enum."""
    schema_path = RUNTIME_DIR / "registry" / "schema" / "template.v1.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    enum = schema["properties"]["spec"]["properties"]["nodes"]["items"]["properties"]["type"][
        "enum"
    ]
    for type_name in ADR_0004_EXPECTED_NODE_FILES:
        assert type_name in enum, f"ADR 0004 promises {type_name!r} in the manifest enum"


# ADR 0005: Phase 1 DICOM stack — both manifests exist, the imaging
# vocabulary uses the Parthenon-namespaced concept_id range, and the
# etl_dicom_metadata template requires the Parthenon-Imaging vocabulary.
ADR_0005_EXPECTED_MANIFESTS = (
    "load_imaging_vocabulary",
    "etl_dicom_metadata",
)


@pytest.mark.parametrize("template_id", ADR_0005_EXPECTED_MANIFESTS)
def test_adr_0005_manifest_exists(template_id: str) -> None:
    """Both DICOM-stack manifests promised by ADR 0005 must ship."""
    text = _adr_text("0005-imaging-vocabulary-namespace.md")
    assert template_id in text, f"ADR 0005 does not mention {template_id}"
    manifest = REPO / "templates" / "manifests" / template_id / "manifest.yaml"
    assert manifest.exists(), f"ADR 0005 promises {template_id}, manifest is missing"


def test_adr_0005_concept_id_range_documented_and_used() -> None:
    """ADR 0005 §1 promises [2_000_000_000, 2_099_999_999]; manifest must use it."""
    text = _adr_text("0005-imaging-vocabulary-namespace.md")
    assert "2_000_000_000" in text or "2000000000" in text
    assert "2_099_999_999" in text or "2099999999" in text
    manifest = (
        REPO / "templates" / "manifests" / "load_imaging_vocabulary" / "manifest.yaml"
    ).read_text(encoding="utf-8")
    assert "2000000000" in manifest, "load_imaging_vocabulary manifest doesn't use the namespace"


def test_adr_0005_etl_requires_parthenon_imaging_vocabulary() -> None:
    """ADR 0005 §5 says etl resolves Modality via Parthenon-Imaging — manifest must require it."""
    import yaml

    manifest_text = (
        REPO / "templates" / "manifests" / "etl_dicom_metadata" / "manifest.yaml"
    ).read_text(encoding="utf-8")
    payload = yaml.safe_load(manifest_text)
    requires = payload["spec"]["requires"]
    assert "Parthenon-Imaging" in requires["vocabularies"]


# ADR 0006: PRO instrument framework — pro_base module exists, both EQ-5D
# variants ship as separate manifests, customer-supplied EuroQol value sets.
ADR_0006_EXPECTED_MANIFESTS = (
    "qr_eq5d5l_to_measurement",
    "qr_eq5d3l_to_measurement",
)


def test_adr_0006_pro_base_module_exists() -> None:
    """ADR 0006 §1 promises a runtime.instruments.pro_base Python module."""
    text = _adr_text("0006-pro-instrument-framework.md")
    assert "runtime.instruments.pro_base" in text
    module = RUNTIME_DIR / "instruments" / "pro_base.py"
    assert module.exists()


@pytest.mark.parametrize("template_id", ADR_0006_EXPECTED_MANIFESTS)
def test_adr_0006_each_pro_instrument_is_separate_manifest(template_id: str) -> None:
    """ADR 0006 §2 promises each instrument is a separate manifest file."""
    text = _adr_text("0006-pro-instrument-framework.md")
    assert template_id in text or "EQ-5D" in text, f"ADR 0006 doesn't reference {template_id}"
    manifest = REPO / "templates" / "manifests" / template_id / "manifest.yaml"
    assert manifest.exists(), f"ADR 0006 promises {template_id}, manifest is missing"


def test_adr_0006_placeholder_value_set_marked_as_placeholder() -> None:
    """ADR 0006 §3 promises customer-supplied value set; placeholder must be loud."""
    text = _adr_text("0006-pro-instrument-framework.md")
    assert "PLACEHOLDER" in text.upper()
    assert "EUROQOL" in text.upper()
    csv = RUNTIME_DIR / "instruments" / "value_sets" / "eq5d5l_placeholder.csv"
    assert csv.exists()
    csv_text = csv.read_text(encoding="utf-8")
    assert "PLACEHOLDER" in csv_text.upper()


def test_adr_0006_cross_instrument_test_exists() -> None:
    """ADR 0006 §6 promises a cross-instrument regression test."""
    test_path = Path(__file__).resolve().parents[1] / "tests" / "unit" / "test_pro_pattern_reuse.py"
    assert test_path.exists()


# ADR 0007: fhir_anonymizer template — manifest exists, config library
# under runtime/, PHI-leak HIGHSEC regression test exists.
def test_adr_0007_fhir_anonymizer_manifest_exists() -> None:
    text = _adr_text("0007-fhir-anonymizer-template.md")
    assert "fhir_anonymizer" in text
    manifest = REPO / "templates" / "manifests" / "fhir_anonymizer" / "manifest.yaml"
    assert manifest.exists()


def test_adr_0007_config_library_under_runtime() -> None:
    """ADR 0007 §2 places the config library under runtime/, not under manifests/."""
    text = _adr_text("0007-fhir-anonymizer-template.md")
    assert "runtime/instruments/anonymizer_configs/" in text
    library_dir = RUNTIME_DIR / "instruments" / "anonymizer_configs"
    assert library_dir.exists()
    assert (library_dir / "hipaa_safe_harbor.json").exists()
    assert (library_dir / "minimal_redaction.json").exists()


def test_adr_0007_phi_leak_test_exists() -> None:
    """ADR 0007 §5 promises a HIGHSEC PHI-leak regression test."""
    text = _adr_text("0007-fhir-anonymizer-template.md")
    assert "test_anonymizer_phi_leak.py" in text
    test_path = (
        Path(__file__).resolve().parents[1] / "tests" / "unit" / "test_anonymizer_phi_leak.py"
    )
    assert test_path.exists()


def test_adr_0007_native_backend_handles_period() -> None:
    """ADR 0007 §7 promises Period-aware dateShift in the native backend."""
    text = _adr_text("0007-fhir-anonymizer-template.md")
    assert "_shift_value" in text
    native = (RUNTIME_DIR / "nodes" / "anonymizer_backends" / "native.py").read_text(
        encoding="utf-8"
    )
    assert "_shift_value" in native


# ADR 0008: fhir_to_omop architecture — per-resource mappers, IG snapshot
# pin, ConceptResolver, staging-map approach, observation split.
ADR_0008_EXPECTED_MAPPER_FILES = [
    "patient.py",
    "encounter.py",
    "condition.py",
    "observation.py",
]


@pytest.mark.parametrize("filename", ADR_0008_EXPECTED_MAPPER_FILES)
def test_adr_0008_per_resource_mapper_module_exists(filename: str) -> None:
    """ADR 0008 §1 promises a mapper module per FHIR resource type (PR-A scope)."""
    text = _adr_text("0008-fhir-to-omop-architecture.md")
    assert filename in text, f"ADR 0008 doesn't reference {filename}"
    module = RUNTIME_DIR / "fhir_to_omop" / filename
    assert module.exists(), f"ADR 0008 promises {filename} — module is missing"


def test_adr_0008_ig_snapshot_pinned() -> None:
    """ADR 0008 §2 promises a single IG version pin (v0.1.0-parthenon)."""
    text = _adr_text("0008-fhir-to-omop-architecture.md")
    assert "v0.1.0-parthenon" in text
    ig_path = RUNTIME_DIR / "fhir_to_omop" / "ig" / "v0.1.0-parthenon.json"
    assert ig_path.exists()


def test_adr_0008_concept_resolver_module_exists() -> None:
    """ADR 0008 §3 promises a ConceptResolver class with cache + strict mode."""
    text = _adr_text("0008-fhir-to-omop-architecture.md")
    assert "ConceptResolver" in text
    resolver = (RUNTIME_DIR / "fhir_to_omop" / "concept_resolver.py").read_text(encoding="utf-8")
    assert "class ConceptResolver" in resolver
    assert "resolve_with_vocabulary" in resolver  # OID-disambiguation method


def test_adr_0008_unmapped_queue_table_migrated() -> None:
    """ADR 0008 §5 promises app.unmapped_concepts_queue (shipped in Plan 5 Task 6)."""
    text = _adr_text("0008-fhir-to-omop-architecture.md")
    assert "unmapped_concepts_queue" in text
    migration = (
        REPO
        / "backend"
        / "database"
        / "migrations"
        / "2026_05_03_120000_create_unmapped_concepts_queue_table.php"
    )
    assert migration.exists()


def test_adr_0008_pra_manifest_exists() -> None:
    """ADR 0008 §7 promises a fhir_to_omop manifest scoped to PR-A."""
    manifest = REPO / "templates" / "manifests" / "fhir_to_omop" / "manifest.yaml"
    assert manifest.exists()
    text = _adr_text("0008-fhir-to-omop-architecture.md")
    assert "PR-A" in text and "PR-B" in text and "PR-C" in text
