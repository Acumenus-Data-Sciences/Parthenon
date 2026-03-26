"""ConnectionFactory: maps HADES dialect names to SQLAlchemy engine URLs."""
from __future__ import annotations

import importlib
from dataclasses import dataclass

from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.engine import Engine, URL

from app.models import DialectInfo


@dataclass(frozen=True)
class DialectSpec:
    name: str
    scheme: str
    driver_package: str
    default_port: int


DIALECT_REGISTRY: dict[str, DialectSpec] = {
    "postgresql": DialectSpec("postgresql", "postgresql+psycopg", "psycopg", 5432),
    "sql server": DialectSpec("sql server", "mssql+pyodbc", "pyodbc", 1433),
    "oracle": DialectSpec("oracle", "oracle+oracledb", "oracledb", 1521),
    "mysql": DialectSpec("mysql", "mysql+pymysql", "pymysql", 3306),
    "mariadb": DialectSpec("mariadb", "mariadb+pymysql", "pymysql", 3306),
    "bigquery": DialectSpec("bigquery", "bigquery", "sqlalchemy_bigquery", 443),
    "redshift": DialectSpec("redshift", "redshift+redshift_connector", "redshift_connector", 5439),
    "snowflake": DialectSpec("snowflake", "snowflake", "snowflake.sqlalchemy", 443),
    "spark": DialectSpec("spark", "databricks", "databricks.sql", 443),
    "duckdb": DialectSpec("duckdb", "duckdb", "duckdb_engine", 0),
    "sqlite": DialectSpec("sqlite", "sqlite", "sqlite3", 0),
    "synapse": DialectSpec("synapse", "mssql+pyodbc", "pyodbc", 1433),
}


class ConnectionFactory:
    @staticmethod
    def build_url(
        dbms: str,
        server: str,
        port: int,
        user: str,
        password: str,
        schema: str,
    ) -> URL | str:
        key = dbms.lower().strip()
        spec = DIALECT_REGISTRY.get(key)
        if spec is None:
            raise ValueError(
                f"Unsupported dialect: {dbms!r}. "
                f"Supported: {list(DIALECT_REGISTRY.keys())}"
            )

        if key == "sqlite":
            return f"sqlite:///{server}" if server != ":memory:" else "sqlite:///:memory:"

        if key == "bigquery":
            return f"bigquery://{server}"

        # HADES convention: server = "host/database"
        parts = server.split("/", 1)
        host = parts[0]
        database = parts[1] if len(parts) > 1 else ""

        if key in ("sql server", "synapse"):
            driver_str = "ODBC+Driver+17+for+SQL+Server"
            return URL.create(
                drivername=spec.scheme,
                username=user,
                password=password,
                host=host,
                port=port or spec.default_port,
                database=database,
                query={"driver": driver_str},
            )

        return URL.create(
            drivername=spec.scheme,
            username=user,
            password=password,
            host=host,
            port=port or spec.default_port,
            database=database,
        )

    @staticmethod
    def create_engine(
        dbms: str,
        server: str,
        port: int,
        user: str,
        password: str,
        schema: str,
    ) -> Engine:
        url = ConnectionFactory.build_url(dbms, server, port, user, password, schema)
        return sa_create_engine(url, poolclass=None, echo=False)

    @staticmethod
    def available_dialects() -> list[DialectInfo]:
        results: list[DialectInfo] = []
        for spec in DIALECT_REGISTRY.values():
            installed = False
            version = None
            try:
                mod = importlib.import_module(spec.driver_package)
                installed = True
                version = getattr(mod, "__version__", getattr(mod, "version", None))
                if version and not isinstance(version, str):
                    version = str(version)
            except ImportError:
                pass
            results.append(
                DialectInfo(
                    name=spec.name,
                    driver=spec.driver_package,
                    installed=installed,
                    version=version,
                )
            )
        return results
