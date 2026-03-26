"""Tests for ETLConfig database connection settings."""

from __future__ import annotations

from scripts.irsf_etl.config import ETLConfig


class TestETLConfigDBSettings:
    """ETLConfig database attribute tests."""

    def test_has_db_host(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_host")
        assert isinstance(config.db_host, str)
        assert len(config.db_host) > 0

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
        assert isinstance(config.db_username, str)
        assert len(config.db_username) > 0

    def test_has_db_password(self) -> None:
        config = ETLConfig()
        assert hasattr(config, "db_password")
        assert isinstance(config.db_password, str)

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
        assert params["port"] == 5432
        assert params["dbname"] == "parthenon"
        assert params["options"] == "-c search_path=omop"
        # host and user come from .env or env vars
        assert isinstance(params["host"], str)
        assert isinstance(params["user"], str)
