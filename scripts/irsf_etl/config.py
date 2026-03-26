"""ETL configuration using Pydantic Settings.

Centralizes all path configuration for the IRSF ETL pipeline.
Source data paths contain spaces (e.g., "2023 IRSF", "IRSF Dataset"),
so pathlib.Path is used throughout.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root is 2 levels up from this file (scripts/irsf_etl/config.py -> project root)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class ETLConfig(BaseSettings):
    """Configuration for the IRSF ETL pipeline.

    All paths are relative to the project root by default.
    Override via environment variables with IRSF_ETL_ prefix.
    """

    model_config = SettingsConfigDict(
        env_prefix="IRSF_ETL_",
        case_sensitive=False,
    )

    source_root: Path = _PROJECT_ROOT / "external" / "2023 IRSF" / "OMOP" / "IRSF Dataset"
    output_dir: Path = _PROJECT_ROOT / "scripts" / "irsf_etl" / "output"

    # Database connection settings (Parthenon PostgreSQL with omop schema)
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_database: str = "parthenon"
    db_username: str = "parthenon"
    db_password: str = ""

    @property
    def source_5201(self) -> Path:
        """Path to Study 5201 source data."""
        return self.source_root / "5201"

    @property
    def source_5211(self) -> Path:
        """Path to Study 5211 source data."""
        return self.source_root / "5211"

    @property
    def source_custom_extracts(self) -> Path:
        """Path to custom extract source data (CSVs inside csv/ subdir)."""
        return self.source_root / "5211_Custom_Extracts"

    @property
    def db_connection_params(self) -> dict[str, str | int]:
        """Return connection parameters dict for psycopg2.connect().

        Sets search_path to omop, matching Parthenon's schema isolation.
        """
        return {
            "host": self.db_host,
            "port": self.db_port,
            "dbname": self.db_database,
            "user": self.db_username,
            "password": self.db_password,
            "options": "-c search_path=omop",
        }

    @property
    def profiles_dir(self) -> Path:
        """Output directory for profiling reports."""
        return self.output_dir / "profiles"

    @property
    def staging_dir(self) -> Path:
        """Output directory for staging/intermediate data."""
        return self.output_dir / "staging"

    @property
    def reports_dir(self) -> Path:
        """Output directory for final reports."""
        return self.output_dir / "reports"
