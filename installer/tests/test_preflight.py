from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer import config, preflight


def test_community_sidecar_env_matches_compose_service_ports():
    cfg = config.build_config_defaults(
        {
            "db_password": "generated-db-password",
            "enable_blackrabbit": True,
            "enable_hecate": True,
            "enable_orthanc": True,
            "blackrabbit_port": 18090,
            "hecate_port": 18088,
            "orthanc_port": 18042,
        }
    )

    root_env = config.build_root_env(cfg)
    backend_env = config.build_backend_env(cfg)

    assert "BLACKRABBIT_PORT=18090" in root_env
    assert "BLACKRABBIT_SCAN_TIMEOUT_SECONDS=1200" in root_env
    assert "HECATE_PORT=18088" in root_env
    assert "HECATE_PG_USER=parthenon" in root_env
    assert "HECATE_PG_PASSWORD=generated-db-password" in root_env
    assert "ORTHANC_PORT=18042" in root_env
    assert "HECATE_URL=http://hecate:8080" in backend_env
    assert "BLACKRABBIT_URL=http://blackrabbit:8090" in backend_env
    assert "ORTHANC_URL=http://orthanc:8042" in backend_env


def test_build_config_defaults_auto_assigns_non_nginx_ports(monkeypatch):
    busy = {5480, 6381, 8002, 8888, 8787, 8983}
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: port not in busy)

    cfg = config.build_config_defaults(
        {
            "enable_solr": True,
            "enable_study_agent": False,
            "enable_blackrabbit": False,
            "enable_fhir_to_cdm": False,
            "enable_hecate": False,
            "enable_orthanc": False,
        }
    )

    assert cfg["nginx_port"] == 8082
    assert cfg["postgres_port"] == 5481
    assert cfg["redis_port"] == 6382
    assert cfg["ai_port"] == 8003
    assert cfg["jupyter_port"] == 8889
    assert cfg["r_port"] == 8788
    assert cfg["solr_port"] == 8984
    assert cfg["enable_hecate"] is False


def test_required_ports_respects_enabled_services_and_custom_mappings():
    ports = preflight.required_ports(
        {
            "nginx_port": 18082,
            "postgres_port": 15480,
            "redis_port": 16381,
            "ai_port": 18002,
            "jupyter_port": 18888,
            "r_port": 18787,
            "enable_solr": False,
            "enable_study_agent": False,
            "enable_blackrabbit": True,
            "blackrabbit_port": 18090,
            "enable_fhir_to_cdm": False,
            "enable_hecate": True,
            "hecate_port": 18088,
            "enable_orthanc": False,
        }
    )

    assert ports == [
        (18082, "NGINX"),
        (15480, "Postgres"),
        (16381, "Redis"),
        (18002, "AI"),
        (18888, "JupyterHub"),
        (18787, "Darkstar"),
        (18090, "BlackRabbit"),
        (18088, "Hecate"),
        (6333, "Qdrant API"),
        (6334, "Qdrant gRPC"),
    ]


def test_run_checks_only_checks_selected_ports(monkeypatch):
    seen_ports = []

    monkeypatch.setattr("installer.preflight.utils.is_port_free", lambda port: seen_ports.append(port) or True)
    monkeypatch.setattr("installer.preflight.utils.docker_version", lambda: "Docker version 24.0.6, build test")
    monkeypatch.setattr("installer.preflight.utils.docker_compose_version", lambda: "Docker Compose version v2.33.0")
    monkeypatch.setattr("installer.preflight.utils.docker_daemon_running", lambda: True)
    monkeypatch.setattr("installer.preflight.utils.os_name", lambda: "Linux")
    monkeypatch.setattr("installer.preflight.utils.user_in_docker_group", lambda: True)
    monkeypatch.setattr("installer.preflight.utils.free_disk_gb", lambda: 50.0)
    monkeypatch.setattr("installer.preflight.utils.container_exists", lambda name: False)
    monkeypatch.setattr("installer.preflight.utils.REPO_ROOT", Path(__file__).resolve().parents[2])

    checks = preflight.run_checks(
        {
            "nginx_port": 8082,
            "postgres_port": 5480,
            "redis_port": 6381,
            "ai_port": 8002,
            "jupyter_port": 8888,
            "r_port": 8787,
            "solr_port": 8983,
            "study_agent_port": 8765,
            "blackrabbit_port": 8090,
            "fhir_to_cdm_port": 8091,
            "hecate_port": 8088,
            "orthanc_port": 8042,
            "enable_solr": False,
            "enable_study_agent": False,
            "enable_blackrabbit": False,
            "enable_fhir_to_cdm": False,
            "enable_hecate": False,
            "enable_orthanc": False,
        }
    )

    assert seen_ports == [8082, 5480, 6381, 8002, 8888, 8787]
    assert not any(check.name == "Port 8983 free" for check in checks)
