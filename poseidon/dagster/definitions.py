"""Dagster Definitions entry point for Poseidon orchestration.

Wires together:
- dbt CLI resource configured to use the poseidon dbt project
- All dbt models as Software-Defined Assets (via dbt_assets.py)
"""
import os
from pathlib import Path

from dagster import Definitions
from dagster_dbt import DbtCliResource

from poseidon.dagster.assets.dbt_assets import dbt_project, poseidon_dbt_assets

# dbt project directory — uses the writable copy set by the entrypoint,
# falls back to source-relative path for local development.
_DBT_PROJECT_DIR: Path = Path(
    os.environ.get(
        "POSEIDON_DBT_PROJECT_DIR",
        str(Path(__file__).parent.parent / "dbt"),
    )
)

# Profiles directory — default matches DBT_PROFILES_DIR env var set by Docker Compose
_DBT_PROFILES_DIR: str = os.environ.get(
    "DBT_PROFILES_DIR",
    str(_DBT_PROJECT_DIR),
)

defs = Definitions(
    assets=[poseidon_dbt_assets],
    resources={
        "dbt": DbtCliResource(
            project_dir=dbt_project,
            profiles_dir=_DBT_PROFILES_DIR,
        ),
    },
)
