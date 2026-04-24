# installer/engine/phases/omop_cdm.py
from __future__ import annotations

import re

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT
MODE_LOCAL = "Create local PostgreSQL OMOP database"
MODE_EXISTING_CDM = "Use an existing OMOP CDM"
MODE_EXISTING_SERVER = "Use an existing database server"


def _ext_source_key(resolved: dict) -> str:
    raw = f"EXT_{resolved.get('cdm_database', 'CDM').upper()}"
    return re.sub(r"[^A-Z0-9_]", "_", raw)[:32]


def _is_local(ctx: Context) -> bool:
    return ctx.config.get("resolved", {}).get("cdm_setup_mode") == MODE_LOCAL


def _check_test_connection(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_test_connection(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_create_cdm_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    resolved = ctx.config.get("resolved", {})
    if resolved.get("cdm_existing_state") in ("Tables exist", "Vocab loaded", "Complete"):
        return True
    return False  # implemented fully in Task 7


def _run_create_cdm_schema(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_register_source(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_register_source(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_load_vocabulary(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    resolved = ctx.config.get("resolved", {})
    if resolved.get("vocabulary_setup") == "Use existing vocabulary":
        return True
    if not resolved.get("vocab_zip_path"):
        return True
    return False  # implemented fully in Task 7


def _run_load_vocabulary(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_create_results_schema(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_create_results_schema(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_run_achilles(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    return not ctx.config.get("resolved", {}).get("run_achilles", True)


def _run_run_achilles(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_run_dqd(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    return not ctx.config.get("resolved", {}).get("run_dqd", True)


def _run_run_dqd(ctx: Context) -> None:
    pass  # implemented in Task 7


PHASE = Phase(
    id="omop_cdm",
    name="External OMOP CDM Setup",
    steps=[
        Step(id="omop_cdm.test_connection", name="Test external CDM connection",
             run=_run_test_connection, check=_check_test_connection),
        Step(id="omop_cdm.create_cdm_schema", name="Create OMOP CDM schema",
             run=_run_create_cdm_schema, check=_check_create_cdm_schema),
        Step(id="omop_cdm.register_source", name="Register external CDM as source",
             run=_run_register_source, check=_check_register_source),
        Step(id="omop_cdm.load_vocabulary", name="Load OMOP vocabulary into external DB",
             run=_run_load_vocabulary, check=_check_load_vocabulary),
        Step(id="omop_cdm.create_results_schema", name="Create Achilles results schema",
             run=_run_create_results_schema, check=_check_create_results_schema),
        Step(id="omop_cdm.run_achilles", name="Run Achilles characterization",
             run=_run_run_achilles, check=_check_run_achilles),
        Step(id="omop_cdm.run_dqd", name="Run Data Quality Dashboard",
             run=_run_run_dqd, check=_check_run_dqd),
    ],
)
