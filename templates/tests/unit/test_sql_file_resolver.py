"""SqlFileResolver: read SQL bodies from manifest-relative file:// references.

Phase 3 Plan 0 Task 2 (T-022). The resolver:
* parses ``file://<relative>`` references,
* enforces the resolved path stays inside the manifest dir (traversal guard),
* expands ``${parameters.NAME}`` placeholders against the run's parameters,
* raises :class:`SqlFileReadError` on any I/O or security failure.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.sql_files import SqlFileReadError, SqlFileResolver


def test_resolver_reads_relative_path(tmp_path: Path) -> None:
    manifest_dir = tmp_path / "demo"
    sql = manifest_dir / "sql" / "00_bootstrap.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("SELECT 1;\n", encoding="utf-8")

    resolver = SqlFileResolver(manifest_dir=manifest_dir)
    body = resolver.resolve("file://sql/00_bootstrap.sql", parameters={})

    assert body == "SELECT 1;\n"


def test_resolver_expands_parameters(tmp_path: Path) -> None:
    sql = tmp_path / "sql" / "01.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("CREATE SCHEMA ${parameters.cdm_schema};\n", encoding="utf-8")

    resolver = SqlFileResolver(manifest_dir=tmp_path)
    body = resolver.resolve("file://sql/01.sql", parameters={"cdm_schema": "omop"})

    assert body == "CREATE SCHEMA omop;\n"


def test_resolver_rejects_path_traversal(tmp_path: Path) -> None:
    resolver = SqlFileResolver(manifest_dir=tmp_path)
    with pytest.raises(SqlFileReadError) as exc:
        resolver.resolve("file://../../../etc/passwd", parameters={})
    assert "outside manifest dir" in str(exc.value).lower()


def test_resolver_rejects_absolute_path(tmp_path: Path) -> None:
    resolver = SqlFileResolver(manifest_dir=tmp_path)
    with pytest.raises(SqlFileReadError):
        resolver.resolve("file:///etc/passwd", parameters={})


def test_resolver_rejects_missing_file(tmp_path: Path) -> None:
    resolver = SqlFileResolver(manifest_dir=tmp_path)
    with pytest.raises(SqlFileReadError) as exc:
        resolver.resolve("file://sql/does_not_exist.sql", parameters={})
    assert "not found" in str(exc.value).lower() or "no such" in str(exc.value).lower()


def test_resolver_rejects_unknown_scheme(tmp_path: Path) -> None:
    resolver = SqlFileResolver(manifest_dir=tmp_path)
    with pytest.raises(SqlFileReadError) as exc:
        resolver.resolve("http://example.com/x.sql", parameters={})
    assert "scheme" in str(exc.value).lower()


def test_resolver_keeps_unknown_param_placeholder_unchanged(tmp_path: Path) -> None:
    """Match the materializer's interpolation behavior — unknown params pass through."""
    sql = tmp_path / "x.sql"
    sql.write_text("-- ${parameters.unknown}", encoding="utf-8")

    resolver = SqlFileResolver(manifest_dir=tmp_path)
    body = resolver.resolve("file://x.sql", parameters={})

    assert body == "-- ${parameters.unknown}"


def test_resolver_handles_multiple_placeholders(tmp_path: Path) -> None:
    sql = tmp_path / "multi.sql"
    sql.write_text(
        "INSERT INTO ${parameters.target_schema}.t SELECT * FROM ${parameters.source_schema}.t;",
        encoding="utf-8",
    )

    resolver = SqlFileResolver(manifest_dir=tmp_path)
    body = resolver.resolve(
        "file://multi.sql",
        parameters={"target_schema": "omop", "source_schema": "raw"},
    )

    assert body == "INSERT INTO omop.t SELECT * FROM raw.t;"
