# installer/engine/phases/datasets.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT


def _check_load_eunomia(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::connection('eunomia')->table('person')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_load_eunomia(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("LOAD_EUNOMIA", True):
        ctx.emit("Eunomia loading skipped by config")
        return
    ctx.emit("Loading GiBleed demo dataset (Eunomia)…")
    result = utils.exec_php(
        "php artisan parthenon:load-eunomia --fresh --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Eunomia load failed:\n{result.stdout}")
    ctx.emit("Eunomia demo dataset loaded")


def _check_load_vocabulary(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::connection('omop')->table('vocab.concept')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 1000
    except ValueError:
        return False


def _run_load_vocabulary(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    vocab_zip = resolved.get("ATHENA_VOCAB_ZIP")
    if not vocab_zip:
        ctx.emit("No Athena vocabulary ZIP configured — skipping vocab load")
        return
    ctx.emit(f"Loading vocabulary from {vocab_zip}…")
    result = utils.exec_php(
        f"php artisan vocabulary:import --zip={vocab_zip} --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Vocabulary import failed:\n{result.stdout}")
    ctx.emit("Vocabulary loaded")


def _check_seed_demo_data(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::table('app.cohort_definitions')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_seed_demo_data(ctx: Context) -> None:
    ctx.emit("Seeding Commons demo data…")
    result = utils.exec_php(
        "php artisan commons:seed-demo --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Demo data seed failed:\n{result.stdout}")
    ctx.emit("Demo data seeded")


PHASE = Phase(
    id="datasets",
    name="Dataset Acquisition",
    steps=[
        Step(id="datasets.load_eunomia", name="Load Eunomia demo dataset",
             run=_run_load_eunomia, check=_check_load_eunomia),
        Step(id="datasets.load_vocabulary", name="Load OMOP vocabulary",
             run=_run_load_vocabulary, check=_check_load_vocabulary),
        Step(id="datasets.seed_demo_data", name="Seed Commons demo data",
             run=_run_seed_demo_data, check=_check_seed_demo_data),
    ],
)
