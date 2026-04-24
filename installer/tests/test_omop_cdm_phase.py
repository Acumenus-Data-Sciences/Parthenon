# installer/tests/test_omop_cdm_phase.py
from __future__ import annotations
import pytest
from unittest.mock import patch, MagicMock
from installer.engine.phases.omop_cdm import (
    _ext_source_key,
    _check_test_connection,
    _check_create_cdm_schema,
    _check_register_source,
    _check_load_vocabulary,
    _check_create_results_schema,
    _check_run_achilles,
    _check_run_dqd,
    PHASE,
)
from installer.engine.registry import Context
from installer.engine.secrets import SecretManager


def _ctx(resolved: dict, tmp_path) -> Context:
    return Context(
        config={"resolved": resolved},
        secrets=SecretManager(tmp_path / "s"),
        emit=lambda msg: None,
    )


MODE3 = "Create local PostgreSQL OMOP database"
MODE1 = "Use an existing OMOP CDM"


class TestExtSourceKey:
    def test_basic(self):
        assert _ext_source_key({"cdm_database": "omop_cdm"}) == "EXT_OMOP_CDM"

    def test_sanitizes_special_chars(self):
        assert _ext_source_key({"cdm_database": "my-db.prod"}) == "EXT_MY_DB_PROD"

    def test_truncates_at_32(self):
        long_db = "a" * 40
        key = _ext_source_key({"cdm_database": long_db})
        assert len(key) <= 32
        assert key.startswith("EXT_")

    def test_uppercase(self):
        assert _ext_source_key({"cdm_database": "lowercase"}) == "EXT_LOWERCASE"


class TestMode3Guard:
    """All check() functions must return True (no-op) for mode 3."""

    def test_test_connection_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_test_connection(ctx) is True

    def test_create_cdm_schema_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_create_cdm_schema(ctx) is True

    def test_register_source_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_register_source(ctx) is True

    def test_load_vocabulary_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_load_vocabulary(ctx) is True

    def test_create_results_schema_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_create_results_schema(ctx) is True

    def test_run_achilles_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_run_achilles(ctx) is True

    def test_run_dqd_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_run_dqd(ctx) is True


class TestOptOutGuards:
    def test_achilles_skips_when_opted_out(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "run_achilles": False, "cdm_database": "x"}, tmp_path)
        assert _check_run_achilles(ctx) is True

    def test_dqd_skips_when_opted_out(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "run_dqd": False, "cdm_database": "x"}, tmp_path)
        assert _check_run_dqd(ctx) is True

    def test_load_vocab_skips_when_existing(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "vocabulary_setup": "Use existing vocabulary",
                    "cdm_database": "x"}, tmp_path)
        assert _check_load_vocabulary(ctx) is True

    def test_load_vocab_skips_when_no_zip(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "vocabulary_setup": "Load Athena vocabulary ZIP",
                    "vocab_zip_path": None, "cdm_database": "x"}, tmp_path)
        assert _check_load_vocabulary(ctx) is True


class TestPhaseStructure:
    def test_phase_has_7_steps(self):
        assert len(PHASE.steps) == 7

    def test_step_ids(self):
        ids = [s.id for s in PHASE.steps]
        assert ids == [
            "omop_cdm.test_connection",
            "omop_cdm.create_cdm_schema",
            "omop_cdm.register_source",
            "omop_cdm.load_vocabulary",
            "omop_cdm.create_results_schema",
            "omop_cdm.run_achilles",
            "omop_cdm.run_dqd",
        ]

    def test_all_steps_have_run_and_check(self):
        for step in PHASE.steps:
            assert callable(step.run), f"{step.id} missing run"
            assert callable(step.check), f"{step.id} missing check"
