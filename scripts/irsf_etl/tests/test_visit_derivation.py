"""Tests for visit derivation module.

Covers study visit collection (5211 + 5201), hospitalization visits,
deduplication, deterministic ID assignment, schema validation, and edge cases.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.schemas.visit_occurrence import visit_occurrence_schema
from scripts.irsf_etl.visit_derivation import (
    collect_hospitalization_visits,
    collect_study_visits_5201,
    collect_study_visits_5211,
    derive_visits,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_registry(rows: list[dict]) -> PersonIdRegistry:
    """Build a PersonIdRegistry from a list of row dicts."""
    df = pd.DataFrame(rows)
    return PersonIdRegistry.from_dataframe(df)


def _simple_registry() -> PersonIdRegistry:
    """Registry with 3 test patients."""
    return _make_registry([
        {"participant_id": 1001, "participant_id5201": None, "participant_id5211": 1001},
        {"participant_id": 1002, "participant_id5201": None, "participant_id5211": 1002},
        {"participant_id": 1003, "participant_id5201": 1003, "participant_id5211": None},
    ])


def _simple_registry_with_both() -> PersonIdRegistry:
    """Registry with patients in both protocols."""
    return _make_registry([
        {"participant_id": 1001, "participant_id5201": 1001, "participant_id5211": 1001},
        {"participant_id": 1002, "participant_id5201": None, "participant_id5211": 1002},
        {"participant_id": 1003, "participant_id5201": 1003, "participant_id5211": None},
    ])


def _make_config(tmp_path: Path) -> ETLConfig:
    """Build an ETLConfig pointing at tmp_path-based directories.

    Expected layout under tmp_path:
        source/5201/csv/         -- 5201 clinical tables
        source/5211/             -- 5211 raw data
        source/5211_Custom_Extracts/csv/ -- custom extracts (LogMasterForm, Hospitalizations)
        output/staging/          -- staging output directory
        output/reports/          -- rejection reports
    """
    return ETLConfig(
        source_root=tmp_path / "source",
        output_dir=tmp_path / "output",
    )


def _setup_source_dirs(tmp_path: Path) -> None:
    """Create the directory structure expected by ETLConfig."""
    (tmp_path / "source" / "5201" / "csv").mkdir(parents=True)
    (tmp_path / "source" / "5211").mkdir(parents=True)
    (tmp_path / "source" / "5211_Custom_Extracts" / "csv").mkdir(parents=True)
    (tmp_path / "output" / "staging").mkdir(parents=True)
    (tmp_path / "output" / "reports").mkdir(parents=True)


# ---------------------------------------------------------------------------
# Test: collect_study_visits_5211
# ---------------------------------------------------------------------------


class TestCollectStudyVisits5211:
    """Tests for collect_study_visits_5211."""

    def test_basic(self, tmp_path: Path) -> None:
        """Mock LogMasterForm CSV with 3 visits for 2 patients."""
        _setup_source_dirs(tmp_path)
        csv_data = (
            "participant_id,visit,visit_date\n"
            "1001,Baseline,12/13/16\n"
            "1001,1 year,12/10/17\n"
            "1002,Baseline,03/05/18\n"
        )
        (tmp_path / "source" / "5211_Custom_Extracts" / "csv" / "LogMasterForm_5211.csv").write_text(csv_data)

        config = _make_config(tmp_path)
        registry = _simple_registry()
        log = RejectionLog("test")

        result = collect_study_visits_5211(config, registry, log)

        assert len(result) == 3
        assert set(result["person_id"]) == {1001, 1002}
        assert all(result["visit_concept_id"] == 9202)
        assert result.iloc[0]["visit_date"] == "2016-12-13"

    def test_empty_label_maps_to_unscheduled(self, tmp_path: Path) -> None:
        """Empty Visit label maps to 'Unscheduled'."""
        _setup_source_dirs(tmp_path)
        csv_data = (
            "participant_id,visit,visit_date\n"
            "1001,,12/13/16\n"
        )
        (tmp_path / "source" / "5211_Custom_Extracts" / "csv" / "LogMasterForm_5211.csv").write_text(csv_data)

        config = _make_config(tmp_path)
        registry = _simple_registry()
        log = RejectionLog("test")

        result = collect_study_visits_5211(config, registry, log)

        assert len(result) == 1
        assert result.iloc[0]["visit_label"] == "Unscheduled"


# ---------------------------------------------------------------------------
# Test: collect_study_visits_5201
# ---------------------------------------------------------------------------


class TestCollectStudyVisits5201:
    """Tests for collect_study_visits_5201."""

    def test_only_5201_patients(self, tmp_path: Path) -> None:
        """5201-only patients' visits extracted from ClinicalAssessment."""
        _setup_source_dirs(tmp_path)
        ca_data = (
            "Participant_ID,Visit,Visit_Date\n"
            "1003,Baseline,03/04/2006\n"
            "1003,12 months,03/05/2007\n"
            "1001,Baseline,01/01/2006\n"
        )
        (tmp_path / "source" / "5201" / "csv" / "ClinicalAssessment.csv").write_text(ca_data)
        (tmp_path / "source" / "5201" / "csv" / "Measurements.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )

        config = _make_config(tmp_path)
        registry = _simple_registry_with_both()
        log = RejectionLog("test")

        result = collect_study_visits_5201(config, registry, log)

        # Only patient 1003 (5201-only) should be included
        assert len(result) == 2
        assert set(result["person_id"]) == {1003}
        assert all(result["visit_concept_id"] == 9202)


# ---------------------------------------------------------------------------
# Test: collect_hospitalization_visits
# ---------------------------------------------------------------------------


class TestCollectHospitalizationVisits:
    """Tests for collect_hospitalization_visits."""

    def test_basic(self, tmp_path: Path) -> None:
        """Mock Hospitalizations CSV with Hospital and ER rows."""
        _setup_source_dirs(tmp_path)
        csv_data = (
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
            "1001,11/07/16,Hospital,Sep,,2017,\n"
            "1002,11/07/16,ER,Jan,15,2018,\n"
        )
        (tmp_path / "source" / "5211_Custom_Extracts" / "csv" / "Hospitalizations_5211.csv").write_text(csv_data)

        config = _make_config(tmp_path)
        registry = _simple_registry()
        log = RejectionLog("test")

        result = collect_hospitalization_visits(config, registry, log)

        assert len(result) == 2
        hospital_row = result[result["visit_label"] == "Hospital"].iloc[0]
        er_row = result[result["visit_label"] == "ER"].iloc[0]
        assert hospital_row["visit_concept_id"] == 9201
        assert er_row["visit_concept_id"] == 9203

    def test_date_unknown_skipped(self, tmp_path: Path) -> None:
        """DateUnknown rows with null date components are skipped."""
        _setup_source_dirs(tmp_path)
        csv_data = (
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
            "1001,11/07/16,Hospital,,,,Yes\n"
        )
        (tmp_path / "source" / "5211_Custom_Extracts" / "csv" / "Hospitalizations_5211.csv").write_text(csv_data)

        config = _make_config(tmp_path)
        registry = _simple_registry()
        log = RejectionLog("test")

        result = collect_hospitalization_visits(config, registry, log)

        assert len(result) == 0
        assert len(log.entries) > 0

    def test_date_assembly(self, tmp_path: Path) -> None:
        """Split-date columns assembled correctly via date_assembler."""
        _setup_source_dirs(tmp_path)
        csv_data = (
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
            "1001,11/07/16,Hospital,Mar,15,2019,\n"
        )
        (tmp_path / "source" / "5211_Custom_Extracts" / "csv" / "Hospitalizations_5211.csv").write_text(csv_data)

        config = _make_config(tmp_path)
        registry = _simple_registry()
        log = RejectionLog("test")

        result = collect_hospitalization_visits(config, registry, log)

        assert len(result) == 1
        assert result.iloc[0]["visit_date"] == "2019-03-15"


# ---------------------------------------------------------------------------
# Test: derive_visits (integration)
# ---------------------------------------------------------------------------


class TestDeriveVisits:
    """Integration tests for derive_visits."""

    def _setup_test_data(self, tmp_path: Path) -> ETLConfig:
        """Create test source files, staging directory, and return config."""
        _setup_source_dirs(tmp_path)

        # person_id_map.csv
        staging = tmp_path / "output" / "staging"
        pd.DataFrame({
            "person_id": [1001, 1002, 1003],
            "participant_id": [1001, 1002, 1003],
            "participant_id5201": [1001, None, 1003],
            "participant_id5211": [1001, 1002, None],
        }).to_csv(staging / "person_id_map.csv", index=False)

        custom_csv = tmp_path / "source" / "5211_Custom_Extracts" / "csv"
        (custom_csv / "LogMasterForm_5211.csv").write_text(
            "participant_id,visit,visit_date\n"
            "1001,Baseline,12/13/16\n"
            "1001,1 year,12/10/17\n"
            "1002,Baseline,03/05/18\n"
        )
        (custom_csv / "Hospitalizations_5211.csv").write_text(
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
            "1001,12/13/16,Hospital,Sep,,2017,\n"
            "1002,03/05/18,ER,Jan,15,2018,\n"
        )

        src_5201_csv = tmp_path / "source" / "5201" / "csv"
        (src_5201_csv / "ClinicalAssessment.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
            "1003,Baseline,03/04/2006\n"
        )
        (src_5201_csv / "Measurements.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )

        return _make_config(tmp_path)

    def test_deduplication(self, tmp_path: Path) -> None:
        """Same (person_id, visit_date, visit_concept_id) deduplicates to one row."""
        _setup_source_dirs(tmp_path)
        staging = tmp_path / "output" / "staging"
        pd.DataFrame({
            "person_id": [1001],
            "participant_id": [1001],
            "participant_id5201": [None],
            "participant_id5211": [1001],
        }).to_csv(staging / "person_id_map.csv", index=False)

        custom_csv = tmp_path / "source" / "5211_Custom_Extracts" / "csv"
        (custom_csv / "LogMasterForm_5211.csv").write_text(
            "participant_id,visit,visit_date\n"
            "1001,Baseline,12/13/16\n"
            "1001,Baseline,12/13/16\n"
        )
        (custom_csv / "Hospitalizations_5211.csv").write_text(
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
        )
        src_5201_csv = tmp_path / "source" / "5201" / "csv"
        (src_5201_csv / "ClinicalAssessment.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )
        (src_5201_csv / "Measurements.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )

        config = _make_config(tmp_path)
        visit_occ, visit_map = derive_visits(config)

        assert len(visit_occ) == 1

    def test_same_date_different_type(self, tmp_path: Path) -> None:
        """Study visit (9202) and hospitalization (9201) on same date produce TWO records."""
        _setup_source_dirs(tmp_path)
        staging = tmp_path / "output" / "staging"
        pd.DataFrame({
            "person_id": [1001],
            "participant_id": [1001],
            "participant_id5201": [None],
            "participant_id5211": [1001],
        }).to_csv(staging / "person_id_map.csv", index=False)

        custom_csv = tmp_path / "source" / "5211_Custom_Extracts" / "csv"
        (custom_csv / "LogMasterForm_5211.csv").write_text(
            "participant_id,visit,visit_date\n"
            "1001,Baseline,01/15/17\n"
        )
        (custom_csv / "Hospitalizations_5211.csv").write_text(
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
            "1001,01/15/17,Hospital,Jan,15,2017,\n"
        )
        src_5201_csv = tmp_path / "source" / "5201" / "csv"
        (src_5201_csv / "ClinicalAssessment.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )
        (src_5201_csv / "Measurements.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )

        config = _make_config(tmp_path)
        visit_occ, visit_map = derive_visits(config)

        assert len(visit_occ) == 2
        assert set(visit_occ["visit_concept_id"]) == {9201, 9202}

    def test_deterministic_ids(self, tmp_path: Path) -> None:
        """Running derive_visits twice produces identical visit_occurrence_ids."""
        config = self._setup_test_data(tmp_path)

        visit_occ1, _ = derive_visits(config)
        visit_occ2, _ = derive_visits(config)

        pd.testing.assert_frame_equal(
            visit_occ1[["visit_occurrence_id", "person_id", "visit_start_date"]].reset_index(drop=True),
            visit_occ2[["visit_occurrence_id", "person_id", "visit_start_date"]].reset_index(drop=True),
        )

    def test_schema_validation(self, tmp_path: Path) -> None:
        """Output passes pandera schema."""
        config = self._setup_test_data(tmp_path)

        visit_occ, _ = derive_visits(config)

        # Should not raise
        visit_occurrence_schema.validate(visit_occ)

    def test_visit_id_map_completeness(self, tmp_path: Path) -> None:
        """Every visit_occurrence_id in visit_occurrence.csv appears in visit_id_map.csv."""
        config = self._setup_test_data(tmp_path)

        visit_occ, visit_map = derive_visits(config)

        occ_ids = set(visit_occ["visit_occurrence_id"])
        map_ids = set(visit_map["visit_occurrence_id"])
        assert occ_ids == map_ids

    def test_unresolved_person_id_rejected(self, tmp_path: Path) -> None:
        """Rows with unknown participant_id are logged to rejection_log."""
        _setup_source_dirs(tmp_path)
        staging = tmp_path / "output" / "staging"
        pd.DataFrame({
            "person_id": [1001],
            "participant_id": [1001],
            "participant_id5201": [None],
            "participant_id5211": [1001],
        }).to_csv(staging / "person_id_map.csv", index=False)

        custom_csv = tmp_path / "source" / "5211_Custom_Extracts" / "csv"
        (custom_csv / "LogMasterForm_5211.csv").write_text(
            "participant_id,visit,visit_date\n"
            "9999,Baseline,12/13/16\n"
            "1001,Baseline,12/13/16\n"
        )
        (custom_csv / "Hospitalizations_5211.csv").write_text(
            "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
            "YearDateVisit,DateUnknown\n"
        )
        src_5201_csv = tmp_path / "source" / "5201" / "csv"
        (src_5201_csv / "ClinicalAssessment.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )
        (src_5201_csv / "Measurements.csv").write_text(
            "Participant_ID,Visit,Visit_Date\n"
        )

        config = _make_config(tmp_path)
        visit_occ, _ = derive_visits(config)

        assert len(visit_occ) == 1
        assert visit_occ.iloc[0]["person_id"] == 1001

        # Check rejection report was written
        rejections_path = tmp_path / "output" / "reports" / "visit_derivation_rejections.csv"
        assert rejections_path.exists()
        rej_df = pd.read_csv(rejections_path)
        assert len(rej_df) > 0
        assert any("Unresolved" in str(m) for m in rej_df["message"])
