"""Process-wide settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for parthenon-templates."""

    model_config = SettingsConfigDict(
        env_prefix="PARTHENON_",
        env_file=None,
        case_sensitive=False,
        extra="ignore",
    )

    internal_token: str = Field(
        default="",
        validation_alias="PARTHENON_INTERNAL_TOKEN",
        description="Shared secret expected on the X-Parthenon-Internal-Token header.",
    )
    storage_root: Path = Field(
        default=Path("/var/parthenon/storage/templates"),
        validation_alias="PARTHENON_STORAGE_ROOT",
    )
    orchestration_backend: str = Field(
        default="prefect",
        validation_alias="PARTHENON_ORCHESTRATION_BACKEND",
    )
    database_url: str = Field(
        default="postgresql+psycopg://parthenon_app@postgres:5432/parthenon",
        validation_alias="DATABASE_URL",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
