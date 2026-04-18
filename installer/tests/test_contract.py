from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer import contract, docker_ops


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
