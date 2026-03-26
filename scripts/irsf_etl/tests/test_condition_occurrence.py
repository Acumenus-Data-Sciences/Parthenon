"""Tests for condition_occurrence extraction from IRSF-NHS 5211 tables.

Tests SNOMED parsing, all four table extractors, integration behavior
(dedup, deterministic IDs, visit resolution, date fallback).
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.irsf_etl.condition_occurrence import (
    _FRACTURE_SNOMED_MAP,
    _SEIZURE_SNOMED_MAP,
    extract_bone_fractures,
    extract_chronic_diagnoses,
    extract_conditions,
    extract_infections,
    extract_seizures,
    parse_snomed_output,
)
from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def person_registry() -> PersonIdRegistry:
    """Registry with a few test participants."""
    df = pd.DataFrame({
        "participant_id": [1001, 1002, 1003],
        "participant_id5201": [pd.NA, pd.NA, pd.NA],
        "participant_id5211": [1001, 1002, 1003],
    })
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def visit_resolver() -> VisitResolver:
    """Resolver with test visits."""
    df = pd.DataFrame({
        "visit_occurrence_id": [1, 2, 3, 4],
        "person_id": [1001, 1001, 1002, 1003],
        "visit_date": ["2020-01-15", "2021-01-20", "2020-03-10", "2019-06-05"],
        "visit_label": ["Baseline", "1 year", "Baseline", "Baseline"],
        "visit_concept_id": [9202, 9202, 9202, 9202],
    })
    return VisitResolver.from_dataframe(df)


@pytest.fixture()
def config(tmp_path: Path) -> ETLConfig:
    """Test config with tmp_path for source and output."""
    csv_dir = tmp_path / "source" / "5211_Custom_Extracts" / "csv"
    csv_dir.mkdir(parents=True)
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    return ETLConfig(
        source_root=tmp_path / "source",
        output_dir=output_dir,
    )


def _write_csv(config: ETLConfig, filename: str, content: str) -> None:
    """Write CSV content to the test source directory."""
    csv_dir = config.source_custom_extracts / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    (csv_dir / filename).write_text(content)


def _write_staging_maps(config: ETLConfig, registry: PersonIdRegistry, resolver: VisitResolver) -> None:
    """Write person_id_map.csv and visit_id_map.csv to staging."""
    staging = config.staging_dir
    staging.mkdir(parents=True, exist_ok=True)

    # person_id_map
    rows = []
    for rec in registry._records:
        rows.append({
            "participant_id": rec.participant_id,
            "participant_id5201": rec.participant_id5201 if rec.participant_id5201 is not None else "",
            "participant_id5211": rec.participant_id5211 if rec.participant_id5211 is not None else "",
            "person_id": rec.person_id,
        })
    pd.DataFrame(rows).to_csv(staging / "person_id_map.csv", index=False)

    # visit_id_map
    visit_df = pd.DataFrame({
        "visit_occurrence_id": [1, 2, 3, 4],
        "person_id": [1001, 1001, 1002, 1003],
        "visit_date": ["2020-01-15", "2021-01-20", "2020-03-10", "2019-06-05"],
        "visit_label": ["Baseline", "1 year", "Baseline", "Baseline"],
        "visit_concept_id": [9202, 9202, 9202, 9202],
    })
    visit_df.to_csv(staging / "visit_id_map.csv", index=False)


# ---------------------------------------------------------------------------
# SNOMED parsing tests
# ---------------------------------------------------------------------------


class TestParseSnomedOutput:
    """Tests for parse_snomed_output()."""

    def test_standard_format(self) -> None:
        result = parse_snomed_output(
            "Constipation (disorder) code:14760008 100.0 [SNOMED CT]"
        )
        assert result == 14760008

    def test_with_low_confidence(self) -> None:
        result = parse_snomed_output(
            "Gastric reflux (finding) code:225587003 96.4 [SNOMED CT]"
        )
        assert result == 225587003

    def test_none_input(self) -> None:
        assert parse_snomed_output(None) is None

    def test_empty_string(self) -> None:
        assert parse_snomed_output("") is None

    def test_malformed(self) -> None:
        assert parse_snomed_output("no snomed here") is None

    def test_whitespace_only(self) -> None:
        assert parse_snomed_output("   ") is None

    def test_low_confidence_score(self) -> None:
        result = parse_snomed_output(
            "Prolonged QT interval (finding) code:111975006 33.2 [SNOMED CT]"
        )
        assert result == 111975006


# ---------------------------------------------------------------------------
# Chronic diagnoses extraction tests
# ---------------------------------------------------------------------------


class TestExtractChronicDiagnoses:
    """Tests for extract_chronic_diagnoses()."""

    def test_with_snomed(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Constipation,Constipation (disorder) code:14760008 100.0 [SNOMED CT],"
                "Jan,10,2019,,,,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_chronic_diagnoses(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        row = result.iloc[0]
        assert row["person_id"] == 1001
        assert row["condition_concept_id"] == 14760008
        assert row["condition_start_date"] == "2019-01-10"
        assert row["condition_source_value"] == "Constipation"
        assert row["condition_source_concept_id"] == 14760008

    def test_without_snomed(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Some rare condition,,"
                "Feb,5,2020,,,,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_chronic_diagnoses(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_concept_id"] == 0
        assert result.iloc[0]["condition_source_value"] == "Some rare condition"

    def test_not_assessed_skipped(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Constipation,,Jan,10,2019,,,,Yes,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_chronic_diagnoses(config, person_registry, visit_resolver, log)
        assert len(result) == 0

    def test_date_fallback_to_visit_date(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Acne,,,,,,,,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_chronic_diagnoses(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_start_date"] == "2020-01-15"


# ---------------------------------------------------------------------------
# Seizure extraction tests
# ---------------------------------------------------------------------------


class TestExtractSeizures:
    """Tests for extract_seizures()."""

    def test_mapped_types(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "seizures_5211.csv",
            (
                "participant_id,InvestigImpress,"
                "DateStartedMonth,DateStartedDay,DateStartedYear,"
                "DateStoppedMonth,DateStoppedDay,DateStoppedYear,"
                "DateStartedUnknown,visit_date,VisitTimePoint\n"
                "1001,Generalized seizure,Mar,5,2018,,,,,2020-01-15,Baseline\n"
                "1002,Absence seizure,Apr,,2019,,,,,2020-03-10,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_seizures(config, person_registry, visit_resolver, log)
        assert len(result) == 2
        assert result.iloc[0]["condition_concept_id"] == 246545002
        assert result.iloc[0]["condition_source_value"] == "Generalized seizure"
        assert result.iloc[1]["condition_concept_id"] == 230415008

    def test_not_a_seizure_excluded(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "seizures_5211.csv",
            (
                "participant_id,InvestigImpress,"
                "DateStartedMonth,DateStartedDay,DateStartedYear,"
                "DateStoppedMonth,DateStoppedDay,DateStoppedYear,"
                "DateStartedUnknown,visit_date,VisitTimePoint\n"
                "1001,Not a seizure,Jan,1,2020,,,,,2020-01-15,Baseline\n"
                "1001,Generalized seizure,Feb,1,2020,,,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_seizures(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_source_value"] == "Generalized seizure"

    def test_rett_spell_zero_concept(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "seizures_5211.csv",
            (
                "participant_id,InvestigImpress,"
                "DateStartedMonth,DateStartedDay,DateStartedYear,"
                "DateStoppedMonth,DateStoppedDay,DateStoppedYear,"
                "DateStartedUnknown,visit_date,VisitTimePoint\n"
                "1001,Rett spell,Jan,1,2020,,,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_seizures(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_concept_id"] == 0
        assert result.iloc[0]["condition_source_value"] == "Rett spell"


# ---------------------------------------------------------------------------
# Bone fracture extraction tests
# ---------------------------------------------------------------------------


class TestExtractBoneFractures:
    """Tests for extract_bone_fractures()."""

    def test_all_locations(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        # Test a few representative locations
        _write_csv(
            config,
            "Bone_Fracture_5211.csv",
            (
                "participant_id,FractureLocation,OtherFractureLocation,"
                "FracturesDateMonth,FracturesDateDay,FracturesDateYear,"
                "FractureDateUnknown,visit_date,VisitTimePoint\n"
                "1001,upper leg (femur),,Jun,15,2019,,2020-01-15,Baseline\n"
                "1002,ankle,,Mar,,2020,,2020-03-10,Baseline\n"
                "1003,spine/neck,,Jan,5,2019,,2019-06-05,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_bone_fractures(config, person_registry, visit_resolver, log)
        assert len(result) == 3
        assert result.iloc[0]["condition_concept_id"] == 71620000
        assert result.iloc[1]["condition_concept_id"] == 16114001
        assert result.iloc[2]["condition_concept_id"] == 446847008
        # Fractures have no end date
        assert result.iloc[0]["condition_end_date"] is None or pd.isna(result.iloc[0]["condition_end_date"])

    def test_other_with_detail(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Bone_Fracture_5211.csv",
            (
                "participant_id,FractureLocation,OtherFractureLocation,"
                "FracturesDateMonth,FracturesDateDay,FracturesDateYear,"
                "FractureDateUnknown,visit_date,VisitTimePoint\n"
                "1001,other,jaw,Jan,5,2020,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_bone_fractures(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_concept_id"] == 125605004
        assert result.iloc[0]["condition_source_value"] == "other: jaw"


# ---------------------------------------------------------------------------
# Infection extraction tests
# ---------------------------------------------------------------------------


class TestExtractInfections:
    """Tests for extract_infections()."""

    def test_with_snomed(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Infections_5211.csv",
            (
                "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
                "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
                "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n"
                "1001,Bacterial,pneumonia,"
                "Upper respiratory infection (disorder) code:54150009 77.6 [SNOMED CT],"
                "Jan,10,2020,,Yes,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_infections(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        row = result.iloc[0]
        assert row["condition_concept_id"] == 54150009
        assert row["condition_source_value"] == "Bacterial: pneumonia"
        assert row["condition_source_concept_id"] == 54150009

    def test_resolved_metadata(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Infections_5211.csv",
            (
                "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
                "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
                "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n"
                "1001,Viral,flu,,"
                "Feb,15,2020,,No,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_infections(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["stop_reason"] == "No"
        assert result.iloc[0]["condition_concept_id"] == 0

    def test_type_only_source_value(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_csv(
            config,
            "Infections_5211.csv",
            (
                "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
                "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
                "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n"
                "1001,Fungal,,,"
                "Mar,1,2020,,,2020-01-15,Baseline\n"
            ),
        )
        log = RejectionLog("condition_occurrence")
        result = extract_infections(config, person_registry, visit_resolver, log)
        assert len(result) == 1
        assert result.iloc[0]["condition_source_value"] == "Fungal"


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


class TestExtractConditionsIntegration:
    """Integration tests for the extract_conditions orchestrator."""

    def _setup_all_csvs(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        """Write all four source CSVs and staging maps."""
        _write_staging_maps(config, person_registry, visit_resolver)

        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Constipation,Constipation (disorder) code:14760008 100.0 [SNOMED CT],"
                "Jan,10,2019,,,,,,2020-01-15,Baseline\n"
            ),
        )
        _write_csv(
            config,
            "seizures_5211.csv",
            (
                "participant_id,InvestigImpress,"
                "DateStartedMonth,DateStartedDay,DateStartedYear,"
                "DateStoppedMonth,DateStoppedDay,DateStoppedYear,"
                "DateStartedUnknown,visit_date,VisitTimePoint\n"
                "1001,Generalized seizure,Mar,5,2018,,,,,2020-01-15,Baseline\n"
            ),
        )
        _write_csv(
            config,
            "Bone_Fracture_5211.csv",
            (
                "participant_id,FractureLocation,OtherFractureLocation,"
                "FracturesDateMonth,FracturesDateDay,FracturesDateYear,"
                "FractureDateUnknown,visit_date,VisitTimePoint\n"
                "1002,ankle,,Mar,10,2020,,2020-03-10,Baseline\n"
            ),
        )
        _write_csv(
            config,
            "Infections_5211.csv",
            (
                "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
                "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
                "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n"
                "1003,Bacterial,pneumonia,"
                "Pneumonia (disorder) code:233604007 85.0 [SNOMED CT],"
                "Jun,1,2019,,Yes,2019-06-05,Baseline\n"
            ),
        )

    def test_dedup(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_staging_maps(config, person_registry, visit_resolver)

        # Write duplicate chronic diagnoses
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Constipation,Constipation (disorder) code:14760008 100.0 [SNOMED CT],"
                "Jan,10,2019,,,,,,2020-01-15,Baseline\n"
                "1001,Constipation,Constipation (disorder) code:14760008 100.0 [SNOMED CT],"
                "Jan,10,2019,,,,,,2020-01-15,Baseline\n"
            ),
        )
        _write_csv(config, "seizures_5211.csv",
            "participant_id,InvestigImpress,DateStartedMonth,DateStartedDay,DateStartedYear,"
            "DateStoppedMonth,DateStoppedDay,DateStoppedYear,DateStartedUnknown,visit_date,VisitTimePoint\n")
        _write_csv(config, "Bone_Fracture_5211.csv",
            "participant_id,FractureLocation,OtherFractureLocation,"
            "FracturesDateMonth,FracturesDateDay,FracturesDateYear,"
            "FractureDateUnknown,visit_date,VisitTimePoint\n")
        _write_csv(config, "Infections_5211.csv",
            "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
            "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
            "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n")

        result = extract_conditions(config)
        # Two identical rows should be deduped to one
        assert len(result) == 1

    def test_deterministic_ids(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        self._setup_all_csvs(config, person_registry, visit_resolver)
        result = extract_conditions(config)
        assert len(result) == 4
        # IDs should be sequential from 1
        assert list(result["condition_occurrence_id"]) == [1, 2, 3, 4]

    def test_visit_resolution(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        self._setup_all_csvs(config, person_registry, visit_resolver)
        result = extract_conditions(config)
        # All rows should have visit_occurrence_ids resolved
        assert result["visit_occurrence_id"].notna().sum() >= 1

    def test_date_fallback_to_visit_date(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        _write_staging_maps(config, person_registry, visit_resolver)

        # Chronic diagnosis with no date columns -- should fall back to visit_date
        _write_csv(
            config,
            "Chronic_Diagnoses_5211.csv",
            (
                "participant_id,ChronicMedicalDiagnosis,SNOWMEDOutput,"
                "DateMonthStarted,DateDayStarted,DateYearStarted,"
                "DateMonthResolved,DateDayResolved,DateYearResolved,"
                "NotAssessed,datestartedunknown,visit_date,VisitTimePoint\n"
                "1001,Unknown condition,,,,,,,,,Yes,2020-01-15,Baseline\n"
            ),
        )
        _write_csv(config, "seizures_5211.csv",
            "participant_id,InvestigImpress,DateStartedMonth,DateStartedDay,DateStartedYear,"
            "DateStoppedMonth,DateStoppedDay,DateStoppedYear,DateStartedUnknown,visit_date,VisitTimePoint\n")
        _write_csv(config, "Bone_Fracture_5211.csv",
            "participant_id,FractureLocation,OtherFractureLocation,"
            "FracturesDateMonth,FracturesDateDay,FracturesDateYear,"
            "FractureDateUnknown,visit_date,VisitTimePoint\n")
        _write_csv(config, "Infections_5211.csv",
            "participant_id,InfectionType,InfectionSNOMEDInput,InfectionSNOMEDOutput,"
            "InfectionDateMM,InfectionDateDD,InfectionDateYY,"
            "DateOfInfectionUnknown,Resolved,visit_date,VisitTimePoint\n")

        result = extract_conditions(config)
        assert len(result) == 1
        assert result.iloc[0]["condition_start_date"] == "2020-01-15"

    def test_condition_type_always_registry(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        self._setup_all_csvs(config, person_registry, visit_resolver)
        result = extract_conditions(config)
        assert (result["condition_type_concept_id"] == 32879).all()

    def test_output_csv_written(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        self._setup_all_csvs(config, person_registry, visit_resolver)
        extract_conditions(config)
        output_path = config.staging_dir / "condition_occurrence.csv"
        assert output_path.exists()
        loaded = pd.read_csv(output_path)
        assert len(loaded) == 4

    def test_rejection_report_written(
        self,
        config: ETLConfig,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        self._setup_all_csvs(config, person_registry, visit_resolver)
        extract_conditions(config)
        rejection_path = config.reports_dir / "condition_occurrence_rejections.csv"
        assert rejection_path.exists()


# ---------------------------------------------------------------------------
# Seizure and fracture mapping completeness
# ---------------------------------------------------------------------------


class TestMappingCompleteness:
    """Verify hardcoded SNOMED mapping dictionaries are complete."""

    def test_seizure_map_has_expected_types(self) -> None:
        expected = {
            "Generalized seizure",
            "Complex partial seizure",
            "Tonic-clonic seizure",
            "Partial seizure",
            "Infantile spasm",
            "Atonic seizure",
            "Myoclonic seizure",
            "Absence seizure",
            "Rett spell",
        }
        assert set(_SEIZURE_SNOMED_MAP.keys()) == expected

    def test_fracture_map_has_expected_locations(self) -> None:
        expected = {
            "upper leg (femur)",
            "foot/toes",
            "lower leg - front/inside (tibia)",
            "upper arm (humerus)",
            "shoulder/clavicle",
            "ankle",
            "wrist or hand",
            "lower arm - thumb side (radius)",
            "lower leg - back/outside (fibula)",
            "hip",
            "finger(s)",
            "lower arm - pinky side (ulna)",
            "rib(s)",
            "spine/neck",
            "other",
        }
        assert set(_FRACTURE_SNOMED_MAP.keys()) == expected

    def test_all_seizure_snomed_are_positive_or_zero(self) -> None:
        for concept_id in _SEIZURE_SNOMED_MAP.values():
            assert concept_id >= 0

    def test_all_fracture_snomed_are_positive(self) -> None:
        for concept_id in _FRACTURE_SNOMED_MAP.values():
            assert concept_id > 0
