"""Tests for the medication ETL orchestrator module.

Covers end-to-end orchestration, skip-vocab mode, rejection report writing,
stats population, and CLI subcommand registration.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.drug_exposure_builder import DrugExposureStats


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SOURCE_COLUMNS = [
    "participant_id",
    "MedRxNormCode",
    "MedRxNormInput",
    "DateStartedMonth",
    "DateStartedDay",
    "DateStartedYear",
    "DateStoppedMonth",
    "DateStoppedDay",
    "DateStoppedYear",
    "ReasonForStoppin_Ineffective",
    "ReasonForStoppin_Notneeded",
    "ReasonForStoppin_Sideeffects",
    "visit_date",
]


def _make_source_df(rows: list[dict]) -> pd.DataFrame:
    """Build a source medications DataFrame from row dicts."""
    return pd.DataFrame(rows, columns=_SOURCE_COLUMNS)


def _make_person_id_map_csv(path: Path, person_ids: list[int]) -> None:
    """Write a minimal person_id_map.csv."""
    rows = []
    for pid in person_ids:
        rows.append(
            {
                "person_id": pid,
                "participant_id": pid,
                "participant_id5201": "",
                "participant_id5211": pid,
            }
        )
    pd.DataFrame(rows).to_csv(path, index=False)


def _make_visit_id_map_csv(path: Path) -> None:
    """Write an empty visit_id_map.csv with correct columns."""
    pd.DataFrame(
        columns=[
            "visit_occurrence_id",
            "person_id",
            "visit_date",
            "visit_label",
            "visit_concept_id",
        ]
    ).to_csv(path, index=False)


def _make_medications_csv(path: Path, rows: list[dict]) -> None:
    """Write a source medications CSV."""
    df = _make_source_df(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def _make_config(tmp_path: Path) -> ETLConfig:
    """Build an ETLConfig pointing to tmp_path."""
    source_root = tmp_path / "source" / "IRSF Dataset"
    custom_extracts = source_root / "5211_Custom_Extracts"
    (custom_extracts / "csv").mkdir(parents=True, exist_ok=True)

    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    config = ETLConfig(source_root=source_root, output_dir=output_dir)
    return config


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestRunMedicationEtl:
    """Tests for run_medication_etl orchestrator."""

    def test_run_medication_etl_produces_output(self, tmp_path: Path) -> None:
        """Verify drug_exposure.csv is produced with correct content."""
        config = _make_config(tmp_path)

        # Write prerequisite files
        staging = config.staging_dir
        staging.mkdir(parents=True, exist_ok=True)
        _make_person_id_map_csv(staging / "person_id_map.csv", [100, 200])
        _make_visit_id_map_csv(staging / "visit_id_map.csv")

        # Write source medications
        _make_medications_csv(
            config.source_custom_extracts / "csv" / "Medications_5201_5211.csv",
            [
                {
                    "participant_id": 100,
                    "MedRxNormCode": "code:12345",
                    "MedRxNormInput": "Aspirin",
                    "DateStartedMonth": "1",
                    "DateStartedDay": "15",
                    "DateStartedYear": "2020",
                    "DateStoppedMonth": "",
                    "DateStoppedDay": "",
                    "DateStoppedYear": "",
                    "ReasonForStoppin_Ineffective": "",
                    "ReasonForStoppin_Notneeded": "",
                    "ReasonForStoppin_Sideeffects": "",
                    "visit_date": "01/15/20",
                },
                {
                    "participant_id": 200,
                    "MedRxNormCode": "",
                    "MedRxNormInput": "Ibuprofen 400mg",
                    "DateStartedMonth": "3",
                    "DateStartedDay": "10",
                    "DateStartedYear": "2021",
                    "DateStoppedMonth": "",
                    "DateStoppedDay": "",
                    "DateStoppedYear": "",
                    "ReasonForStoppin_Ineffective": "",
                    "ReasonForStoppin_Notneeded": "",
                    "ReasonForStoppin_Sideeffects": "",
                    "visit_date": "",
                },
            ],
        )

        from scripts.irsf_etl.medication_etl import run_medication_etl

        drug_df, stats = run_medication_etl(config, skip_vocab=True)

        # Output CSV exists
        output_path = staging / "drug_exposure.csv"
        assert output_path.exists()

        # Content checks
        assert len(drug_df) == 2
        assert set(drug_df["person_id"].unique()) == {100, 200}
        assert stats.total_output_rows == 2
        assert stats.total_input_rows == 2

    def test_run_medication_etl_skip_vocab(self, tmp_path: Path) -> None:
        """With skip_vocab=True, all concept_ids are 0 and no DB needed."""
        config = _make_config(tmp_path)

        staging = config.staging_dir
        staging.mkdir(parents=True, exist_ok=True)
        _make_person_id_map_csv(staging / "person_id_map.csv", [100])
        _make_visit_id_map_csv(staging / "visit_id_map.csv")

        _make_medications_csv(
            config.source_custom_extracts / "csv" / "Medications_5201_5211.csv",
            [
                {
                    "participant_id": 100,
                    "MedRxNormCode": "code:99999",
                    "MedRxNormInput": "TestDrug",
                    "DateStartedMonth": "6",
                    "DateStartedDay": "1",
                    "DateStartedYear": "2022",
                    "DateStoppedMonth": "",
                    "DateStoppedDay": "",
                    "DateStoppedYear": "",
                    "ReasonForStoppin_Ineffective": "",
                    "ReasonForStoppin_Notneeded": "",
                    "ReasonForStoppin_Sideeffects": "",
                    "visit_date": "",
                },
            ],
        )

        from scripts.irsf_etl.medication_etl import run_medication_etl

        drug_df, stats = run_medication_etl(config, skip_vocab=True)

        # All concept_ids should be 0 in skip_vocab mode
        assert (drug_df["drug_concept_id"] == 0).all()
        assert stats.mapped_count == 0

    def test_run_medication_etl_rejection_report(self, tmp_path: Path) -> None:
        """Verify rejection CSV is written with entries for unmapped records."""
        config = _make_config(tmp_path)

        staging = config.staging_dir
        staging.mkdir(parents=True, exist_ok=True)
        _make_person_id_map_csv(staging / "person_id_map.csv", [100])
        _make_visit_id_map_csv(staging / "visit_id_map.csv")

        # Row with missing participant_id will be rejected
        rows = [
            {
                "participant_id": "",
                "MedRxNormCode": "code:12345",
                "MedRxNormInput": "Aspirin",
                "DateStartedMonth": "1",
                "DateStartedDay": "15",
                "DateStartedYear": "2020",
                "DateStoppedMonth": "",
                "DateStoppedDay": "",
                "DateStoppedYear": "",
                "ReasonForStoppin_Ineffective": "",
                "ReasonForStoppin_Notneeded": "",
                "ReasonForStoppin_Sideeffects": "",
                "visit_date": "",
            },
            {
                "participant_id": 100,
                "MedRxNormCode": "",
                "MedRxNormInput": "ValidDrug",
                "DateStartedMonth": "5",
                "DateStartedDay": "1",
                "DateStartedYear": "2021",
                "DateStoppedMonth": "",
                "DateStoppedDay": "",
                "DateStoppedYear": "",
                "ReasonForStoppin_Ineffective": "",
                "ReasonForStoppin_Notneeded": "",
                "ReasonForStoppin_Sideeffects": "",
                "visit_date": "",
            },
        ]
        _make_medications_csv(
            config.source_custom_extracts / "csv" / "Medications_5201_5211.csv",
            rows,
        )

        from scripts.irsf_etl.medication_etl import run_medication_etl

        drug_df, stats = run_medication_etl(config, skip_vocab=True)

        # Rejection report exists
        rejection_path = config.reports_dir / "drug_exposure_rejections.csv"
        assert rejection_path.exists()

        # Should have at least 1 rejection (missing participant_id)
        rej_df = pd.read_csv(rejection_path)
        assert len(rej_df) >= 1

        # Only the valid row should be in output
        assert len(drug_df) == 1

    def test_run_medication_etl_stats(self, tmp_path: Path) -> None:
        """Verify stats dataclass fields are populated correctly."""
        config = _make_config(tmp_path)

        staging = config.staging_dir
        staging.mkdir(parents=True, exist_ok=True)
        _make_person_id_map_csv(staging / "person_id_map.csv", [100, 200])
        _make_visit_id_map_csv(staging / "visit_id_map.csv")

        _make_medications_csv(
            config.source_custom_extracts / "csv" / "Medications_5201_5211.csv",
            [
                {
                    "participant_id": 100,
                    "MedRxNormCode": "code:11111",
                    "MedRxNormInput": "DrugA",
                    "DateStartedMonth": "2",
                    "DateStartedDay": "1",
                    "DateStartedYear": "2020",
                    "DateStoppedMonth": "",
                    "DateStoppedDay": "",
                    "DateStoppedYear": "",
                    "ReasonForStoppin_Ineffective": "",
                    "ReasonForStoppin_Notneeded": "",
                    "ReasonForStoppin_Sideeffects": "",
                    "visit_date": "",
                },
                {
                    "participant_id": 200,
                    "MedRxNormCode": "code:22222",
                    "MedRxNormInput": "DrugB",
                    "DateStartedMonth": "4",
                    "DateStartedDay": "15",
                    "DateStartedYear": "2021",
                    "DateStoppedMonth": "",
                    "DateStoppedDay": "",
                    "DateStoppedYear": "",
                    "ReasonForStoppin_Ineffective": "",
                    "ReasonForStoppin_Notneeded": "",
                    "ReasonForStoppin_Sideeffects": "",
                    "visit_date": "",
                },
            ],
        )

        from scripts.irsf_etl.medication_etl import run_medication_etl

        _, stats = run_medication_etl(config, skip_vocab=True)

        assert isinstance(stats, DrugExposureStats)
        assert stats.total_input_rows == 2
        assert stats.total_output_rows == 2
        assert stats.coverage_rate == 0.0  # skip_vocab means no mapping
        assert stats.remapped_count == 0
        assert stats.date_fallback_count == 0

    def test_cli_medications_subcommand(self) -> None:
        """Verify argparse recognizes 'medications' subcommand."""
        from scripts.irsf_etl.__main__ import _build_parser

        parser = _build_parser()

        # Should parse without error
        args = parser.parse_args(["medications"])
        assert args.command == "medications"
        assert args.skip_vocab is False

        # With --skip-vocab flag
        args = parser.parse_args(["medications", "--skip-vocab"])
        assert args.command == "medications"
        assert args.skip_vocab is True
