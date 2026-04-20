"""Safe OMOP data target readiness checks for installer shells."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from . import utils


LOCAL_POSTGRES_MODE = "Create local PostgreSQL OMOP database"
EXISTING_CDM_MODE = "Use an existing OMOP CDM"
UNKNOWN_DBMS = "Not sure yet / will configure later"

POSTGRES_TABLE_PROBES = {
    "person": "OMOP person table",
    "concept": "OMOP vocabulary concept table",
    "vocabulary": "OMOP vocabulary table",
}


def _check(name: str, status: str, detail: str) -> dict[str, str]:
    return {"name": name, "status": status, "detail": detail}


def _repo_root(path: str | None) -> Path:
    if path:
        return Path(path).expanduser().resolve()
    return Path(__file__).resolve().parents[1]


def _setting(cfg: dict[str, Any], key: str, default: str = "") -> str:
    value = cfg.get(key)
    if value is None:
        return default
    return str(value).strip()


def run_checks(cfg: dict[str, Any], *, repo_root: str | None = None) -> dict[str, Any]:
    """Return non-destructive checks for the selected OMOP data setup path."""
    root = _repo_root(repo_root)
    mode = _setting(cfg, "cdm_setup_mode", LOCAL_POSTGRES_MODE)
    dbms = _setting(cfg, "cdm_dialect", "PostgreSQL")
    checks: list[dict[str, str]] = []

    checks.append(_check("OMOP data path", "ok", f"{mode} using {dbms}"))
    checks.extend(_schema_checks(cfg))
    checks.extend(_connection_detail_checks(cfg))
    checks.extend(_vocabulary_checks(cfg))

    if mode == LOCAL_POSTGRES_MODE and dbms != "PostgreSQL":
        checks.append(_check(
            "Local PostgreSQL platform",
            "fail",
            "Local OMOP provisioning uses PostgreSQL. Choose PostgreSQL or select an existing database target.",
        ))
    elif dbms == UNKNOWN_DBMS:
        checks.append(_check(
            "OMOP database platform",
            "warn",
            "Choose the DBMS before the installer can test a connection or prepare OMOP DDL.",
        ))
    elif dbms == "PostgreSQL":
        checks.extend(_postgres_checks(cfg, repo_root=root))
    else:
        checks.append(_check(
            "HADES connection helper",
            "warn",
            f"{dbms} connection testing will run through the HADES DatabaseConnector helper container in the next implementation phase.",
        ))

    return {
        "repo_root": str(root),
        "failures": sum(1 for check in checks if check["status"] == "fail"),
        "warnings": sum(1 for check in checks if check["status"] == "warn"),
        "checks": checks,
    }


def _schema_checks(cfg: dict[str, Any]) -> list[dict[str, str]]:
    required = {
        "cdm_schema": "CDM schema",
        "vocabulary_schema": "Vocabulary schema",
        "results_schema": "Results schema",
        "temp_schema": "Temp schema",
    }
    missing = [label for key, label in required.items() if not _setting(cfg, key)]
    if missing:
        return [_check("OMOP schema names", "fail", f"Missing: {', '.join(missing)}")]
    return [_check(
        "OMOP schema names",
        "ok",
        "CDM, vocabulary, results, and temp schemas are named.",
    )]


def _connection_detail_checks(cfg: dict[str, Any]) -> list[dict[str, str]]:
    mode = _setting(cfg, "cdm_setup_mode", LOCAL_POSTGRES_MODE)
    if mode == LOCAL_POSTGRES_MODE:
        return [_check(
            "OMOP connection details",
            "ok",
            "Local PostgreSQL will be provisioned by the installer.",
        )]

    missing = []
    if not _setting(cfg, "cdm_server"):
        missing.append("server")
    if not _setting(cfg, "cdm_database"):
        missing.append("database")
    if missing:
        return [_check(
            "OMOP connection details",
            "fail",
            f"Existing database targets require: {', '.join(missing)}.",
        )]

    checks = [_check(
        "OMOP connection details",
        "ok",
        "Server and database are present.",
    )]
    if not _setting(cfg, "cdm_user"):
        checks.append(_check(
            "OMOP database user",
            "warn",
            "No user was supplied. Some cloud/IAM flows can defer this, but password-based tests need a username.",
        ))
    return checks


def _vocabulary_checks(cfg: dict[str, Any]) -> list[dict[str, str]]:
    setup = _setting(cfg, "vocabulary_setup", "Use demo starter data")
    if setup == "Load Athena vocabulary ZIP":
        path = _setting(cfg, "vocab_zip_path")
        if not path:
            return [_check(
                "Athena vocabulary ZIP",
                "fail",
                "Select the Athena ZIP downloaded by the user from Athena.",
            )]
        zip_path = Path(path).expanduser()
        if not zip_path.exists():
            return [_check("Athena vocabulary ZIP", "fail", f"File not found: {zip_path}")]
        if zip_path.suffix.lower() != ".zip":
            return [_check("Athena vocabulary ZIP", "fail", "The vocabulary package must be a .zip file.")]
        return [_check("Athena vocabulary ZIP", "ok", f"Found {zip_path}")]

    if setup == "Use existing vocabulary":
        return [_check(
            "Vocabulary setup",
            "ok",
            "Installer will validate the configured vocabulary schema.",
        )]
    if setup == "Load later":
        return [_check(
            "Vocabulary setup",
            "warn",
            "Parthenon can be installed now; vocabulary-backed workflows stay limited until Athena vocabulary is loaded.",
        )]
    return [_check(
        "Vocabulary setup",
        "ok",
        "Installer will use demo starter data where selected.",
    )]


def _postgres_checks(cfg: dict[str, Any], *, repo_root: Path) -> list[dict[str, str]]:
    mode = _setting(cfg, "cdm_setup_mode", LOCAL_POSTGRES_MODE)
    if mode == LOCAL_POSTGRES_MODE:
        checks = [_local_postgres_check(repo_root)]
        if checks[0]["status"] == "ok":
            checks.extend(_local_postgres_schema_probe(cfg, repo_root))
        return checks
    return _external_postgres_probe(cfg, expects_complete_cdm=mode == EXISTING_CDM_MODE)


def _local_postgres_check(repo_root: Path) -> dict[str, str]:
    compose_name = utils.active_compose_file()
    compose_file = repo_root / compose_name
    if not compose_file.exists():
        return _check(
            "Local PostgreSQL service",
            "warn",
            f"{compose_name} was not found; bundle download will need to provide the local database service.",
        )
    if shutil.which("docker") is None:
        return _check(
            "Local PostgreSQL service",
            "warn",
            "Docker was not found. Preflight will block installation until Docker is installed.",
        )

    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--status", "running", "postgres"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return _check("Local PostgreSQL service", "warn", f"Could not inspect Docker Compose: {exc}")

    output = "\n".join([result.stdout.strip(), result.stderr.strip()]).strip()
    if result.returncode == 0 and "postgres" in output.lower():
        return _check("Local PostgreSQL service", "ok", "PostgreSQL service is running.")
    return _check(
        "Local PostgreSQL service",
        "warn",
        "PostgreSQL is not running yet; the installer will start and configure it.",
    )


def _local_postgres_schema_probe(cfg: dict[str, Any], repo_root: Path) -> list[dict[str, str]]:
    query = _postgres_probe_query(cfg)
    result = _run_command(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "parthenon",
            "-d",
            "parthenon",
            "-X",
            "-qAt",
            "-F",
            "|",
            "-c",
            query,
        ],
        cwd=repo_root,
        timeout=8,
    )
    if result.returncode != 0:
        return [_check(
            "Local OMOP schema probe",
            "warn",
            "PostgreSQL is running, but the OMOP schema probe did not complete yet.",
        )]
    return _postgres_probe_checks(result.stdout, expects_complete_cdm=False)


def _external_postgres_probe(cfg: dict[str, Any], *, expects_complete_cdm: bool) -> list[dict[str, str]]:
    if shutil.which("psql") is None:
        return [_check(
            "PostgreSQL connection probe",
            "warn",
            "psql was not found. The installer will use the HADES helper container for packaged connection tests.",
        )]

    server = _setting(cfg, "cdm_server")
    database = _setting(cfg, "cdm_database")
    user = _setting(cfg, "cdm_user")
    if not (server and database and user):
        return [_check(
            "PostgreSQL connection probe",
            "warn",
            "Connection probe needs server, database, and user.",
        )]

    host, port, database_from_server = _split_postgres_server(server)
    database = database or database_from_server
    command = ["psql", "-h", host, "-d", database, "-U", user, "-X", "-qAt", "-F", "|", "-c", _postgres_probe_query(cfg)]
    if port:
        command[1:1] = ["-p", port]
    env = {
        **os.environ,
        "PGCONNECT_TIMEOUT": "8",
        "PGPASSWORD": _setting(cfg, "cdm_password"),
    }

    result = _run_command(command, env=env, timeout=10)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Connection failed").strip().splitlines()[-1]
        return [_check("PostgreSQL connection probe", "warn", detail)]

    checks = [_check("PostgreSQL connection probe", "ok", "Connected to the target database.")]
    checks.extend(_postgres_probe_checks(result.stdout, expects_complete_cdm=expects_complete_cdm))
    return checks


def _run_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return subprocess.CompletedProcess(command, 1, "", str(exc))


def _split_postgres_server(server: str) -> tuple[str, str | None, str]:
    database = ""
    host = server.strip()
    if "/" in host:
        host, database = host.split("/", 1)
    port = None
    if ":" in host:
        maybe_host, maybe_port = host.rsplit(":", 1)
        if maybe_port.isdigit():
            host = maybe_host
            port = maybe_port
    return host, port, database


def _postgres_probe_query(cfg: dict[str, Any]) -> str:
    cdm_schema = _setting(cfg, "cdm_schema", "omop")
    vocab_schema = _setting(cfg, "vocabulary_schema", "vocab")
    results_schema = _setting(cfg, "results_schema", "results")
    temp_schema = _setting(cfg, "temp_schema", "scratch")
    expressions = [
        _regclass_exists(cdm_schema, "person"),
        _regclass_exists(vocab_schema, "concept"),
        _regclass_exists(vocab_schema, "vocabulary"),
        _namespace_exists(results_schema),
        _namespace_exists(temp_schema),
    ]
    return "SELECT " + ", ".join(expressions) + ";"


def _postgres_probe_checks(stdout: str, *, expects_complete_cdm: bool) -> list[dict[str, str]]:
    values = (stdout or "").strip().splitlines()
    fields = values[-1].split("|") if values else []
    while len(fields) < 5:
        fields.append("")
    person, concept, vocabulary, results_schema, temp_schema = [field == "t" for field in fields[:5]]

    table_detail = []
    for present, label in [
        (person, POSTGRES_TABLE_PROBES["person"]),
        (concept, POSTGRES_TABLE_PROBES["concept"]),
        (vocabulary, POSTGRES_TABLE_PROBES["vocabulary"]),
    ]:
        table_detail.append(f"{label}: {'present' if present else 'missing'}")

    missing_required_tables = not (person and concept and vocabulary)
    missing_work_schemas = not (results_schema and temp_schema)
    if expects_complete_cdm:
        table_status = "fail" if missing_required_tables else "ok"
        schema_status = "fail" if missing_work_schemas else "ok"
    else:
        table_status = "warn" if missing_required_tables else "ok"
        schema_status = "warn" if missing_work_schemas else "ok"

    return [
        _check("PostgreSQL OMOP tables", table_status, "; ".join(table_detail)),
        _check(
            "PostgreSQL work schemas",
            schema_status,
            f"results schema: {'present' if results_schema else 'missing'}; temp schema: {'present' if temp_schema else 'missing'}",
        ),
    ]


def _regclass_exists(schema: str, table: str) -> str:
    return f"to_regclass({_sql_literal(_quote_identifier(schema) + '.' + _quote_identifier(table))}) IS NOT NULL"


def _namespace_exists(schema: str) -> str:
    return f"to_regnamespace({_sql_literal(_quote_identifier(schema))}) IS NOT NULL"


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"
