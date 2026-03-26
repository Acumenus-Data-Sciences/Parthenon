import pytest
from app.engine.connection import ConnectionFactory, DIALECT_REGISTRY


def test_dialect_registry_has_12_entries():
    assert len(DIALECT_REGISTRY) == 12


def test_build_url_postgresql():
    url = ConnectionFactory.build_url("postgresql", "localhost/mydb", 5432, "user", "pass", "omop")
    assert "postgresql+psycopg" in str(url)
    assert "localhost" in str(url)


def test_build_url_sqlserver():
    url = ConnectionFactory.build_url("sql server", "myhost/mydb", 1433, "sa", "pass", "dbo")
    assert "mssql+pyodbc" in str(url)


def test_build_url_sqlite():
    url = ConnectionFactory.build_url("sqlite", ":memory:", 0, "", "", "main")
    assert "sqlite" in str(url)


def test_build_url_unknown_dialect_raises():
    with pytest.raises(ValueError, match="Unsupported dialect"):
        ConnectionFactory.build_url("nosqldb", "host/db", 0, "", "", "")


def test_create_engine_sqlite(sqlite_engine):
    """Verify the factory can create a working SQLite engine."""
    engine = ConnectionFactory.create_engine("sqlite", ":memory:", 0, "", "", "main")
    assert engine is not None
    engine.dispose()


def test_available_dialects_includes_sqlite():
    dialects = ConnectionFactory.available_dialects()
    sqlite_info = next((d for d in dialects if d.name == "sqlite"), None)
    assert sqlite_info is not None
    assert sqlite_info.installed is True
