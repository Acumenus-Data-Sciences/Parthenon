from pathlib import Path
import subprocess
import sys
import tarfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer import bundle_manifest, contract, docker_ops


def extract_test_archive(archive: tarfile.TarFile, target: Path) -> None:
    try:
        archive.extractall(target, filter="data")
    except TypeError:
        archive.extractall(target)


def test_community_contract_defaults_and_plan(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "plan",
        community=True,
        overrides={"admin_email": "admin@test.local"},
    )

    cfg = payload["config"]
    plan = payload["plan"]

    assert cfg["experience"] == "Beginner"
    assert cfg["edition"] == "Community Edition"
    assert cfg["modules"] == ["research", "ai_knowledge", "infrastructure"]
    assert cfg["datasets"] == ["eunomia", "phenotype-library"]
    assert cfg["enable_solr"] is True
    assert cfg["enable_hecate"] is True
    assert cfg["enable_qdrant"] is True
    assert cfg["enable_blackrabbit"] is False
    assert cfg["enable_fhir_to_cdm"] is False
    assert cfg["enable_authentik"] is False
    assert cfg["enable_superset"] is False

    assert plan["compose_services"] == docker_ops.compose_service_names(cfg)
    assert "solr" in plan["compose_services"]
    assert "hecate" in plan["compose_services"]
    assert "qdrant" in plan["compose_services"]
    assert "blackrabbit" not in plan["compose_services"]
    assert plan["datasets"] == ["eunomia", "phenotype-library"]
    assert plan["data_setup"]["mode"] == "Create local PostgreSQL OMOP database"
    assert plan["data_setup"]["dbms"] == "PostgreSQL"
    assert plan["data_setup"]["schemas"]["cdm"] == "omop"
    assert any(phase["name"] == "Install OMOP CDM DDL" for phase in plan["data_setup"]["phases"])


def test_contract_redacts_secrets(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "defaults",
        community=True,
        overrides={
            "admin_password": "super-secret",
            "cdm_password": "cdm-secret",
            "db_password": "db-secret",
            "umls_api_key": "umls-secret",
        },
        redacted=True,
    )

    assert payload["admin_password"] == "[redacted]"
    assert payload["cdm_password"] == "[redacted]"
    assert payload["db_password"] == "[redacted]"
    assert payload["umls_api_key"] == "[redacted]"


def test_contract_plans_existing_database_server_setup(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "plan",
        community=True,
        overrides={
            "cdm_setup_mode": "Use an existing database server",
            "cdm_existing_state": "OMOP tables exist but vocabulary is missing",
            "cdm_dialect": "Snowflake",
            "cdm_server": "acme.snowflakecomputing.com",
            "cdm_database": "RESEARCH",
            "cdm_user": "parthenon_loader",
            "vocabulary_setup": "Load later",
            "cdm_schema": "CDM",
            "vocabulary_schema": "VOCAB",
            "results_schema": "RESULTS",
            "temp_schema": "SCRATCH",
        },
    )

    setup = payload["plan"]["data_setup"]
    assert setup["target"] == "Existing database server"
    assert setup["dbms"] == "Snowflake"
    assert setup["requires_connection_details"] is True
    assert setup["schemas"] == {
        "cdm": "CDM",
        "vocabulary": "VOCAB",
        "results": "RESULTS",
        "temp": "SCRATCH",
    }
    assert [phase["name"] for phase in setup["phases"]] == [
        "Connect to existing database server",
        "Prepare OMOP target",
        "Install missing OMOP CDM DDL",
        "Defer vocabulary loading",
        "Register Parthenon data source",
    ]


def test_contract_preflight_payload_shape(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    monkeypatch.setattr("installer.preflight.utils.is_port_free", lambda port: True)
    monkeypatch.setattr("installer.preflight.utils.docker_version", lambda: "Docker version 24.0.6, build test")
    monkeypatch.setattr("installer.preflight.utils.docker_compose_version", lambda: "Docker Compose version v2.33.0")
    monkeypatch.setattr("installer.preflight.utils.docker_daemon_running", lambda: True)
    monkeypatch.setattr("installer.preflight.utils.os_name", lambda: "Linux")
    monkeypatch.setattr("installer.preflight.utils.user_in_docker_group", lambda: True)
    monkeypatch.setattr("installer.preflight.utils.free_disk_gb", lambda: 50.0)
    monkeypatch.setattr("installer.preflight.utils.container_exists", lambda name: False)

    payload = contract.build_payload(
        "preflight",
        community=True,
        overrides={"enable_hecate": False},
        repo_root=str(Path(__file__).resolve().parents[2]),
    )

    assert payload["preflight"]["failures"] == 0
    assert any(check["name"] == "Docker daemon" for check in payload["preflight"]["checks"])


def test_contract_data_check_payload_for_local_postgres(monkeypatch, tmp_path):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    monkeypatch.setattr("installer.data_probe.shutil.which", lambda name: None)

    payload = contract.build_payload(
        "data-check",
        community=True,
        overrides={"enable_hecate": False},
        repo_root=str(tmp_path),
    )

    data_check = payload["data_check"]
    names = {check["name"]: check for check in data_check["checks"]}
    assert data_check["repo_root"] == str(tmp_path)
    assert names["OMOP data path"]["status"] == "ok"
    assert names["OMOP connection details"]["status"] == "ok"
    assert names["Local PostgreSQL service"]["status"] == "warn"


def test_contract_data_check_flags_missing_existing_db_target(monkeypatch, tmp_path):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "data-check",
        community=True,
        overrides={
            "cdm_setup_mode": "Use an existing database server",
            "cdm_dialect": "Snowflake",
            "cdm_server": "",
            "cdm_database": "",
            "vocabulary_setup": "Load later",
        },
        repo_root=str(tmp_path),
    )

    data_check = payload["data_check"]
    names = {check["name"]: check for check in data_check["checks"]}
    assert data_check["failures"] == 1
    assert names["OMOP connection details"]["status"] == "fail"
    assert "server" in names["OMOP connection details"]["detail"]
    assert names["HADES connection helper"]["status"] == "warn"


def test_contract_data_check_fails_incomplete_existing_postgres_cdm(monkeypatch, tmp_path):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    monkeypatch.setattr("installer.data_probe.shutil.which", lambda name: "/usr/bin/psql")
    monkeypatch.setattr(
        "installer.data_probe.subprocess.run",
        lambda *args, **kwargs: subprocess.CompletedProcess(args[0], 0, "f|f|f|f|f\n", ""),
    )

    payload = contract.build_payload(
        "data-check",
        community=True,
        overrides={
            "cdm_setup_mode": "Use an existing OMOP CDM",
            "cdm_dialect": "PostgreSQL",
            "cdm_server": "db.example.org:5432",
            "cdm_database": "research",
            "cdm_user": "reader",
            "vocabulary_setup": "Use existing vocabulary",
        },
        repo_root=str(tmp_path),
    )

    names = {check["name"]: check for check in payload["data_check"]["checks"]}
    assert names["PostgreSQL connection probe"]["status"] == "ok"
    assert names["PostgreSQL OMOP tables"]["status"] == "fail"
    assert names["PostgreSQL work schemas"]["status"] == "fail"


def test_bundle_manifest_expands_files_with_checksums():
    root = Path(__file__).resolve().parents[2]

    manifest = bundle_manifest.build_manifest(repo_root=root)

    files = {file["path"]: file for file in manifest["files"]}
    assert manifest["schema_version"] == 1
    assert manifest["checksum_algorithm"] == "sha256"
    assert manifest["file_count"] == len(manifest["files"])
    assert manifest["bundle_digest"]
    assert "install.py" in files
    assert "docker-compose.yml" in files
    assert "installer/data_probe.py" in files
    assert "installer/installer_manifest.json" in files
    assert "installer/test_cosmo_compat.py" not in files
    assert len(files["install.py"]["sha256"]) == 64
    assert files["install.py"]["size"] > 0

    checks = bundle_manifest.validate_manifest(manifest, repo_root=root)
    assert checks
    assert all(check["status"] == "ok" for check in checks)


def test_contract_bundle_manifest_payload_shape():
    root = Path(__file__).resolve().parents[2]

    payload = contract.build_payload(
        "bundle-manifest",
        community=True,
        repo_root=str(root),
    )

    manifest = payload["manifest"]
    file_paths = {file["path"] for file in manifest["files"]}
    assert manifest["repo_root"] == str(root)
    assert manifest["bundle_name"] == "parthenon-community-bootstrap"
    assert manifest["validation"]["failures"] == 0
    assert "install.py" in file_paths
    assert "installer/web/app.js" in file_paths


def test_bundle_archive_extracts_and_validates(tmp_path):
    root = Path(__file__).resolve().parents[2]

    bundle = bundle_manifest.create_bundle(output_dir=tmp_path, repo_root=root)
    archive_path = Path(bundle["path"])

    assert archive_path.exists()
    assert bundle["sha256"]
    assert bundle["manifest_path"] == bundle_manifest.BUNDLE_MANIFEST_NAME

    extract_root = tmp_path / "extract"
    extract_root.mkdir()
    with tarfile.open(archive_path, "r:gz") as archive:
        extract_test_archive(archive, extract_root)

    saved_manifest = bundle_manifest.load_manifest(
        extract_root / bundle_manifest.BUNDLE_MANIFEST_NAME
    )
    checks = bundle_manifest.validate_manifest(saved_manifest, repo_root=extract_root)

    assert saved_manifest["repo_root"] == "."
    assert all(check["status"] == "ok" for check in checks)


def test_bundle_manifest_validation_detects_tampering(tmp_path):
    root = Path(__file__).resolve().parents[2]
    bundle = bundle_manifest.create_bundle(output_dir=tmp_path, repo_root=root)
    extract_root = tmp_path / "extract"
    extract_root.mkdir()
    with tarfile.open(bundle["path"], "r:gz") as archive:
        extract_test_archive(archive, extract_root)

    (extract_root / "install.py").write_text("# tampered\n")
    saved_manifest = bundle_manifest.load_manifest(
        extract_root / bundle_manifest.BUNDLE_MANIFEST_NAME
    )
    checks = bundle_manifest.validate_manifest(saved_manifest, repo_root=extract_root)
    names = {check["name"]: check for check in checks}

    assert names["install.py"]["status"] == "fail"
    assert names["install.py"]["detail"] == "checksum mismatch"
