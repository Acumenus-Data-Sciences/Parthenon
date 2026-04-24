# installer/engine/phases/solr.py
from __future__ import annotations

import json as _json
import urllib.request

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils


def _solr_num_docs(core: str, port: int = 8983) -> int:
    try:
        url = f"http://localhost:{port}/solr/{core}/select?q=*:*&rows=0&wt=json"
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = _json.loads(resp.read())
            return data["response"]["numFound"]
    except Exception:
        return -1


def _check_index_vocabulary(ctx: Context) -> bool:
    return _solr_num_docs("vocabulary") > 0


def _run_index_vocabulary(ctx: Context) -> None:
    ctx.emit("Indexing vocabulary Solr core…")
    result = utils.exec_php(
        "php artisan solr:index vocabulary --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr vocabulary indexing failed:\n{result.stdout}")
    ctx.emit("Vocabulary core indexed")


def _check_index_cohorts(ctx: Context) -> bool:
    return _solr_num_docs("cohorts") >= 0  # core exists and responds


def _run_index_cohorts(ctx: Context) -> None:
    ctx.emit("Indexing cohorts Solr core…")
    result = utils.exec_php(
        "php artisan solr:index cohorts --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr cohorts indexing failed:\n{result.stdout}")
    ctx.emit("Cohorts core indexed")


def _check_index_analyses(ctx: Context) -> bool:
    return _solr_num_docs("analyses") >= 0


def _run_index_analyses(ctx: Context) -> None:
    ctx.emit("Indexing analyses Solr core…")
    result = utils.exec_php(
        "php artisan solr:index analyses --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr analyses indexing failed:\n{result.stdout}")
    ctx.emit("Analyses core indexed")


PHASE = Phase(
    id="solr",
    name="Solr Indexing",
    steps=[
        Step(id="solr.index_vocabulary", name="Index vocabulary core",
             run=_run_index_vocabulary, check=_check_index_vocabulary),
        Step(id="solr.index_cohorts", name="Index cohorts core",
             run=_run_index_cohorts, check=_check_index_cohorts),
        Step(id="solr.index_analyses", name="Index analyses core",
             run=_run_index_analyses, check=_check_index_analyses),
    ],
)
