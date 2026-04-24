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


def _resolved(ctx: Context) -> dict:
    return ctx.config.get("resolved", {})


# ── test_connection ────────────────────────────────────────────────────────────

def _check_test_connection(ctx: Context) -> bool:
    return _is_local(ctx)  # diagnostic step: always re-runs for external CDMs


def _run_test_connection(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    dialect = r.get("cdm_dialect", "postgresql")
    pdo_dialects = {"postgresql", "sqlserver", "synapse", "mysql"}
    if dialect not in pdo_dialects:
        ctx.emit(f"Dialect '{dialect}' uses R runtime path — skipping PHP connection test")
        return
    ctx.emit(f"Testing connection to {r.get('cdm_server')}/{r.get('cdm_database')}…")
    result = utils.exec_php(
        f"php artisan omop:test-connection"
        f" --source-key={key}"
        f" --dialect={dialect}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Connection test failed:\n{result.stdout}")
    ctx.emit("External CDM connection verified")


# ── create_cdm_schema ──────────────────────────────────────────────────────────

def _check_create_cdm_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if r.get("cdm_existing_state") in ("Tables exist", "Vocab loaded", "Complete"):
        return True
    return False  # mode 2: schema needs creation; check via DDL is idempotent


def _run_create_cdm_schema(ctx: Context) -> None:
    r = _resolved(ctx)
    ctx.emit(f"Creating OMOP CDM v5.4 schema '{r.get('cdm_schema', 'omop')}' on {r.get('cdm_server')}…")
    result = utils.exec_php(
        f"php artisan omop:create-cdm-schema"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --cdm-schema={r.get('cdm_schema', 'omop')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"CDM schema creation failed:\n{result.stdout}")
    ctx.emit("OMOP CDM schema created")


# ── register_source ────────────────────────────────────────────────────────────

def _check_register_source(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    key = _ext_source_key(r)
    # Query whether source exists via tinker
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')"
        f"->whereNull('deleted_at')->count();"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_register_source(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    name = f"External CDM ({r.get('cdm_database', key)})"
    ctx.emit(f"Registering source '{key}'…")
    result = utils.exec_php(
        f"php artisan omop:register-source"
        f" --source-key={key}"
        f" --name='{name}'"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --cdm-schema={r.get('cdm_schema', 'omop')}"
        f" --vocab-schema={r.get('vocabulary_schema', 'vocab')}"
        f" --results-schema={r.get('results_schema', 'results')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Source registration failed:\n{result.stdout}")
    ctx.emit(f"Source '{key}' registered")


# ── load_vocabulary ────────────────────────────────────────────────────────────

def _check_load_vocabulary(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if r.get("vocabulary_setup") == "Use existing vocabulary":
        return True
    if not r.get("vocab_zip_path"):
        return True  # no zip configured — user loads manually
    return False


def _run_load_vocabulary(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    zip_path = r.get("vocab_zip_path", "")
    ctx.emit(f"Loading vocabulary from {zip_path}…")
    result = utils.exec_php(
        f"php artisan omop:load-vocabulary"
        f" --source-key={key}"
        f" --zip={zip_path}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Vocabulary load failed:\n{result.stdout}")
    ctx.emit("Vocabulary loaded")


# ── create_results_schema ──────────────────────────────────────────────────────

def _check_create_results_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    results_schema = r.get("results_schema", "results")
    # Check whether achilles_results table exists via tinker
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"try {{"
        f" $pdo = DB::connection('pgsql')->getPdo();"
        f" $stmt = $pdo->query(\\\"SELECT COUNT(*) FROM information_schema.tables"
        f" WHERE table_schema='{results_schema}' AND table_name='achilles_results'\\\");"
        f" echo $stmt->fetchColumn();"
        f"}} catch(\\\\Exception $e) {{ echo 0; }}"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_create_results_schema(ctx: Context) -> None:
    r = _resolved(ctx)
    ctx.emit(f"Creating Achilles results schema '{r.get('results_schema', 'results')}'…")
    result = utils.exec_php(
        f"php artisan omop:create-results-schema"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --results-schema={r.get('results_schema', 'results')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Results schema creation failed:\n{result.stdout}")
    ctx.emit("Results schema created")


# ── run_achilles ───────────────────────────────────────────────────────────────

def _check_run_achilles(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if not r.get("run_achilles", True):
        return True  # opted out
    key = _ext_source_key(r)
    results_schema = r.get("results_schema", "results")
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"try {{"
        f" $pdo = DB::connection('pgsql')->getPdo();"
        f" $stmt = $pdo->query(\\\"SELECT COUNT(*) FROM {results_schema}.achilles_results\\\");"
        f" echo $stmt->fetchColumn();"
        f"}} catch(\\\\Exception $e) {{ echo 0; }}"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_achilles(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    ctx.emit("Looking up source ID for Achilles run…")
    id_result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->value('id') ?? 'not_found';"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    source_id = id_result.stdout.strip()
    if not source_id or source_id == "not_found":
        raise StepError(f"Source '{key}' not found — register_source must complete first")
    ctx.emit(f"Running Achilles on source {source_id} (this may take several minutes)…")
    result = utils.exec_php(
        f"php artisan parthenon:run-achilles {source_id} --sync --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Achilles failed:\n{result.stdout}")
    ctx.emit("Achilles characterization complete")


# ── run_dqd ───────────────────────────────────────────────────────────────────

def _check_run_dqd(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if not r.get("run_dqd", True):
        return True  # opted out
    key = _ext_source_key(r)
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"$src = App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->first();"
        f"echo $src ? App\\\\Models\\\\App\\\\DqdResult::where('source_id',$src->id)->count() : 0;"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_dqd(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    id_result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->value('id') ?? 'not_found';"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    source_id = id_result.stdout.strip()
    if not source_id or source_id == "not_found":
        raise StepError(f"Source '{key}' not found — register_source must complete first")
    ctx.emit(f"Running DQD on source {source_id} (this may take several minutes)…")
    result = utils.exec_php(
        f"php artisan parthenon:run-dqd {source_id} --sync --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"DQD failed:\n{result.stdout}")
    ctx.emit("DQD assessment complete")


# ── Phase registration ─────────────────────────────────────────────────────────

PHASE = Phase(
    id="omop_cdm",
    name="External OMOP CDM Setup",
    steps=[
        Step(id="omop_cdm.test_connection",       name="Test external CDM connection",
             run=_run_test_connection,       check=_check_test_connection),
        Step(id="omop_cdm.create_cdm_schema",     name="Create OMOP CDM schema",
             run=_run_create_cdm_schema,     check=_check_create_cdm_schema),
        Step(id="omop_cdm.register_source",       name="Register external CDM as source",
             run=_run_register_source,       check=_check_register_source),
        Step(id="omop_cdm.load_vocabulary",       name="Load OMOP vocabulary into external DB",
             run=_run_load_vocabulary,       check=_check_load_vocabulary),
        Step(id="omop_cdm.create_results_schema", name="Create Achilles results schema",
             run=_run_create_results_schema, check=_check_create_results_schema),
        Step(id="omop_cdm.run_achilles",          name="Run Achilles characterization",
             run=_run_run_achilles,          check=_check_run_achilles),
        Step(id="omop_cdm.run_dqd",               name="Run Data Quality Dashboard",
             run=_run_run_dqd,               check=_check_run_dqd),
    ],
)
