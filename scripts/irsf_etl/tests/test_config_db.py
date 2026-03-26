"""Tests for ETLConfig database connection settings."""

from __future__ import annotations

import os

from scripts.irsf_etl.config import ETLConfig


class TestETLConfigDBSettings:
    """ETLConfig database attribute tests."""

    def test_has_db_host(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_host")
        assert config.db_host == "127.0.0.1"

    def test_has_db_port(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_port")
        assert config.db_port == 5432

    def test_has_db_database(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_database")
        assert config.db_database == "parthenon"

    def test_has_db_username(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_username")
        assert config.db_username == "parthenon"

    def test_has_db_password(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_password")
        assert config.db_password == ""

    def test_db_host_overridable_via_env(self, monkeypatch: object) -> None:
        import pytest

        mp = pytest.MonkeyPatch()
        mp.setenv("IRSF_ETL_DB_HOST", "10.0.0.5")
        try:
            config = ETLConfig()
            assert config.db_host == "10.0.0.5"
        finally:
            mp.undo()

    def test_db_port_overridable_via_env(self, monkeypatch: object) -> None:
        import pytest

        mp = pytest.MonkeyPatch()
        mp.setenv("IRSF_ETL_DB_PORT", "5433")
        try:
            config = ETLConfig()
            assert config.db_port == 5433
        finally:
            mp.undo()

    def test_db_connection_params_returns_dict(self) -> None:
        config = ETLConfig()
        params = config.db_connection_params
        assert isinstance(params, dict)
        assert "host" in params
        assert "port" in params
        assert "dbname" in params
        assert "user" in params
        assert "password" in params
        assert "options" in params

    def test_db_connection_params_has_omop_search_path(self) -> None:
        config = ETLConfig()
        params = config.db_connection_params
        assert "omop" in params["options"]

    def test_db_connection_params_values(self) -> None:
        config = ETLConfig()
        params = config.db_connection_params
        assert params["host"] == "127.0.0.1"
        assert params["port"] == 5432
        assert params["dbname"] == "parthenon"
        assert params["user"] == "parthenon"
        assert params["options"] == "-c search_path=omop"
