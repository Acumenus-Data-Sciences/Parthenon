"""Dagster dbt assets — auto-load all dbt models as Software-Defined Assets."""
import os
from pathlib import Path

from dagster import AssetExecutionContext
from dagster_dbt import DbtCliResource, DbtProject, dbt_assets

# Use the writable dbt project directory set by the entrypoint.
# The entrypoint copies /app/poseidon/dbt to $DAGSTER_HOME/dbt_work because
# the source volume mount is read-only for the container user.
# Falls back to the source-relative path for local development.
_DBT_PROJECT_DIR = Path(
    os.environ.get(
        "POSEIDON_DBT_PROJECT_DIR",
        str(Path(__file__).parent.parent.parent / "dbt"),
    )
)

dbt_project = DbtProject(project_dir=_DBT_PROJECT_DIR)


@dbt_assets(manifest=dbt_project.manifest_path)
def poseidon_dbt_assets(
    context: AssetExecutionContext,
    dbt: DbtCliResource,
) -> None:
    """All dbt models exposed as Dagster assets with full dependency tracking.

    Dagster reads the dbt manifest at startup to discover models and their
    upstream/downstream relationships. Running this asset executes dbt build
    (run + test) for all models in topological order.
    """
    yield from dbt.cli(["build"], context=context).stream()
