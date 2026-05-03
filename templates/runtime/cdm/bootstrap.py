"""Idempotent ``bootstrap(version, schema, engine)`` for CDM tables.

Phase 0 strategy: prefer running the bundled DDL SQL files for full fidelity,
fall back to ``MetaData.create_all`` if the SQL file is unavailable. Each DDL
statement uses ``IF NOT EXISTS`` so re-running ``bootstrap()`` against an
already-initialized schema is a no-op.
"""

from __future__ import annotations

from importlib.resources import files
from pathlib import Path

from sqlalchemy import MetaData, text
from sqlalchemy.engine import Engine

from runtime.cdm.schema import SUPPORTED_CDM_VERSIONS, Schema

_VERSION_TO_SQL: dict[str, str] = {
    "5.3": "v5_3.sql",
    "5.4": "v5_4.sql",
    "oncology_ext": "oncology_ext.sql",
}


def _load_sql(version: str) -> str | None:
    filename = _VERSION_TO_SQL.get(version)
    if filename is None:
        return None
    try:
        resource = files("runtime.cdm.migrations").joinpath(filename)
    except ModuleNotFoundError:
        return None
    if not resource.is_file():
        return None
    return resource.read_text(encoding="utf-8")


def _split_sql(body: str) -> list[str]:
    """Naively split semicolon-terminated DDL while ignoring single-line SQL comments."""
    cleaned: list[str] = []
    for line in body.splitlines():
        stripped = line.split("--", 1)[0]
        cleaned.append(stripped)
    joined = "\n".join(cleaned)
    return [s.strip() for s in joined.split(";")]


def bootstrap(*, version: str, schema: str, engine: Engine) -> None:
    """Create all CDM tables for ``version`` inside ``schema`` (idempotent)."""
    if version not in SUPPORTED_CDM_VERSIONS:
        raise ValueError(f"unsupported CDM version {version!r}")
    metadata: MetaData = Schema.for_version(version)

    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        conn.execute(text(f'SET search_path TO "{schema}"'))

        sql_body = _load_sql(version)
        if sql_body is not None:
            for statement in _split_sql(sql_body):
                if statement:
                    conn.execute(text(statement))
        else:
            # Fall back to SQLAlchemy MetaData. Re-target every Table at ``schema``.
            target = MetaData(schema=schema)
            for table in metadata.tables.values():
                table.to_metadata(target)
            target.create_all(conn, checkfirst=True)


def cli_path_for(version: str) -> Path:
    """Return the on-disk path of the DDL file for diagnostics."""
    filename = _VERSION_TO_SQL[version]
    return Path(str(files("runtime.cdm.migrations").joinpath(filename)))
