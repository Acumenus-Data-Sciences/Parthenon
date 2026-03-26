"""Tests for categorical observation transformations.

Covers all 6 source files: Rett Features, DevHx, Clinical Assessment,
Allergies, Nutrition, and Abnormal Movements. Validates filtering logic,
date assembly, SNOMED mapping, source value preservation, and schema conformance.
"""

from __future__ import annotations

import logging
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.observation_categorical import (
    RETT_FEATURE_SNOMED_MAP,
    _build_observation_row,
    _is_truthy,
    _parse_snomed_code,
    _safe_int,
    transform_abnormal_movements,
    transform_allergies,
    transform_categorical_observations,
    transform_clinical_assessment,
    transform_devhx,
    transform_nutrition,
    transform_rett_features,
)
from scripts.irsf_etl.schemas.observation import observation_schema


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def person_registry() -> PersonIdRegistry:
    """Registry with 3 test persons."""
    df = pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003],
            "participant_id5201": [pd.NA, pd.NA, pd.NA],
            "participant_id5211": [pd.NA, pd.NA, pd.NA],
        }
    )
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def visit_resolver(tmp_path: Path) -> VisitResolver:
    """Visit resolver with sample visits."""
    visit_csv = tmp_path / "visit_id_map.csv"
    visit_csv.write_text(
        "person_id,visit_date,visit_occurrence_id\n"
        "1001,2020-01-15,100\n"
        "1002,2020-06-20,200\n"
        "1003,2019-03-10,300\n"
    )
    return VisitResolver.from_csv(visit_csv)


@pytest.fixture()
def rejection_log() -> RejectionLog:
    return RejectionLog("test")


@pytest.fixture()
def mock_config(tmp_path: Path) -> MagicMock:
    """Mock ETLConfig pointing to temp directories."""
    config = MagicMock()
    config.source_custom_extracts = tmp_path / "source"
    config.staging_dir = tmp_path / "staging"
    config.reports_dir = tmp_path / "reports"
    (config.source_custom_extracts / "csv").mkdir(parents=True, exist_ok=True)
    config.staging_dir.mkdir(parents=True, exist_ok=True)
    config.reports_dir.mkdir(parents=True, exist_ok=True)
    return config


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestSafeInt:
    def test_integer(self) -> None:
        assert _safe_int(1) == 1

    def test_float(self) -> None:
        assert _safe_int(1.0) == 1

    def test_string_int(self) -> None:
        assert _safe_int("42") == 42

    def test_none(self) -> None:
        assert _safe_int(None) is None

    def test_nan(self) -> None:
        assert _safe_int(float("nan")) is None

    def test_empty_string(self) -> None:
        assert _safe_int("") is None


class TestIsTruthy:
    def test_one(self) -> None:
        assert _is_truthy(1) is True

    def test_y(self) -> None:
        assert _is_truthy("Y") is True

    def test_yes(self) -> None:
        assert _is_truthy("yes") is True

    def test_zero(self) -> None:
        assert _is_truthy(0) is False

    def test_none(self) -> None:
        assert _is_truthy(None) is False

    def test_empty(self) -> None:
        assert _is_truthy("") is False


class TestParseSnomedCode:
    def test_numeric_string(self) -> None:
        assert _parse_snomed_code("4133756") == 4133756

    def test_float_string(self) -> None:
        assert _parse_snomed_code("4133756.0") == 4133756

    def test_embedded_code(self) -> None:
        assert _parse_snomed_code("SNOMED: 4133756 (Bruxism)") == 4133756

    def test_none(self) -> None:
        assert _parse_snomed_code(None) == 0

    def test_empty(self) -> None:
        assert _parse_snomed_code("") == 0

    def test_non_numeric(self) -> None:
        assert _parse_snomed_code("abc") == 0


# ---------------------------------------------------------------------------
# Rett Features tests
# ---------------------------------------------------------------------------


class TestRettFeatures:
    def _make_rett_df(self) -> pd.DataFrame:
        """Create sample Rett Features data."""
        return pd.DataFrame(
            {
                "participant_id": [1001, 1002, 1003],
                "visit_date": ["01/15/2020", "06/20/2020", "03/10/2019"],
                "BruxismEveroccurred": [1, 0, 1],
                "BruxismStartDtMM": ["Jan", None, "Mar"],
                "BruxismStartDtDD": [5, None, None],
                "BruxismStartDtYY": [2018, None, 2017],
                "BruxismStartDtUnkn": [0, 0, 1],
                "BruxismAtBaseline": [1, 0, 0],
                "BruxismAt1Y": [1, 0, 1],
                "BruxismAt2Y": [0, 0, 0],
                "BruxismAt3Y": [0, 0, 0],
                "BruxismAt4Y": [0, 0, 0],
                "BruxismAt5Y": [0, 0, 0],
                "ScoliosisEveroccurred": [1, 1, 0],
                "ScoliosisStartDtMM": ["Jun", "Feb", None],
                "ScoliosisStartDtDD": [15, 10, None],
                "ScoliosisStartDtYY": [2019, 2020, None],
                "ScoliosisStartDtUnkn": [0, 0, 0],
                "ScoliosisAtBaseline": [0, 1, 0],
                "ScoliosisAt1Y": [0, 0, 0],
                "ScoliosisAt2Y": [0, 0, 0],
                "ScoliosisAt3Y": [0, 0, 0],
                "ScoliosisAt4Y": [0, 0, 0],
                "ScoliosisAt5Y": [0, 0, 0],
            }
        )

    def test_rett_features_everoccurred_filter(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Only features with Everoccurred=1 emit observations."""
        df = self._make_rett_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Rett_Features_5211.csv"
        df.to_csv(csv_path, index=False)

        with patch(
            "scripts.irsf_etl.observation_categorical.PersonIdRegistry.from_csv",
            return_value=person_registry,
        ):
            result = transform_rett_features(
                mock_config, person_registry, visit_resolver, rejection_log
            )

        # Person 1001: Bruxism + Scoliosis Everoccurred + timepoints
        # Person 1002: Scoliosis Everoccurred only + timepoints
        # Person 1003: Bruxism Everoccurred only + timepoints
        everoccurred_rows = result[
            result["observation_source_value"].str.endswith("Everoccurred")
        ]
        # 4 Everoccurred rows: 1001-Bruxism, 1001-Scoliosis, 1002-Scoliosis, 1003-Bruxism
        assert len(everoccurred_rows) == 4

    def test_rett_features_date_assembly(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Split date columns assembled correctly."""
        df = self._make_rett_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Rett_Features_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_rett_features(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        # Person 1001 Bruxism should have date 2018-01-05 (assembled from split)
        bruxism_1001 = result[
            (result["person_id"] == 1001)
            & (result["observation_source_value"] == "BruxismEveroccurred")
        ]
        assert len(bruxism_1001) == 1
        assert bruxism_1001.iloc[0]["observation_date"] == "2018-01-05"

    def test_rett_features_snomed_mapping(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Known features map to correct SNOMED concept_ids."""
        df = self._make_rett_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Rett_Features_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_rett_features(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        bruxism_rows = result[
            result["observation_source_value"] == "BruxismEveroccurred"
        ]
        for _, row in bruxism_rows.iterrows():
            assert row["observation_concept_id"] == 4133756

        scoliosis_rows = result[
            result["observation_source_value"] == "ScoliosisEveroccurred"
        ]
        for _, row in scoliosis_rows.iterrows():
            assert row["observation_concept_id"] == 4141678

    def test_rett_features_source_value(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """observation_source_value preserves feature name."""
        df = self._make_rett_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Rett_Features_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_rett_features(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        source_values = result["observation_source_value"].unique()
        # All should contain the feature name
        assert any("Bruxism" in sv for sv in source_values)
        assert any("Scoliosis" in sv for sv in source_values)


# ---------------------------------------------------------------------------
# DevHx tests
# ---------------------------------------------------------------------------


class TestDevHx:
    def _make_devhx_df(self) -> pd.DataFrame:
        """Create sample DevHx data."""
        return pd.DataFrame(
            {
                "participant_id": [1001, 1002],
                "ChildsDOB": ["01/15/2010", "06/20/2012"],
                "CrawledLearnedYN": ["Y", "Y"],
                "CrawledLearnedAge": [10, 8],
                "CrawledLearnedAgeUnkn": [0, 0],
                "CrawledLost": ["Y", 0],
                "CrawledLostAge": [24, None],
                "CrawledLostAgeUnkn": [0, 0],
                "CrawledRelearned": [0, 0],
                "CrawledRelearnedAge": [None, None],
                "CrawledRelearnedAgeUnkn": [0, 0],
                "BabbledLearned": ["Y", "Y"],
                "BabbledLearnedAge": [6, 7],
                "BabbledLearnedAgeUnkn": [0, 0],
                "BabbledLost": ["Y", 0],
                "BabbledLostAge": [18, None],
                "BabbledLostAgeUnkn": [0, 0],
                "BabbledRelearned": [0, 0],
                "BabbledRelearnedAge": [None, None],
                "BabbledRelearnedAgeUnkn": [0, 0],
                "HowSuddenGRMotorFuncLoss": ["Sudden", "Gradual"],
                "RegressSameTimeIllness": [1, 0],
            }
        )

    def test_devhx_learned_lost_relearned(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        rejection_log: RejectionLog,
    ) -> None:
        """Three states produce separate observation rows."""
        df = self._make_devhx_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "DevHx_5201_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_devhx(mock_config, person_registry, rejection_log)

        # Person 1001 Crawled: Learned + Lost = 2 rows
        crawled_1001 = result[
            (result["person_id"] == 1001)
            & (result["observation_source_value"].str.startswith("Crawled"))
        ]
        source_values = set(crawled_1001["observation_source_value"])
        assert "CrawledLearned" in source_values
        assert "CrawledLost" in source_values

    def test_devhx_age_in_months(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        rejection_log: RejectionLog,
    ) -> None:
        """value_as_number correctly stores age in months."""
        df = self._make_devhx_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "DevHx_5201_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_devhx(mock_config, person_registry, rejection_log)

        crawled_learned_1001 = result[
            (result["person_id"] == 1001)
            & (result["observation_source_value"] == "CrawledLearned")
        ]
        assert len(crawled_learned_1001) == 1
        assert crawled_learned_1001.iloc[0]["value_as_number"] == 10.0

    def test_devhx_unknown_age_handling(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        rejection_log: RejectionLog,
    ) -> None:
        """Unknown age still emits observation with None value_as_number."""
        df = pd.DataFrame(
            {
                "participant_id": [1001],
                "ChildsDOB": ["01/15/2010"],
                "CrawledLearnedYN": ["Y"],
                "CrawledLearnedAge": [None],
                "CrawledLearnedAgeUnkn": [1],
                "CrawledLost": [0],
                "CrawledLostAge": [None],
                "CrawledLostAgeUnkn": [0],
                "CrawledRelearned": [0],
                "CrawledRelearnedAge": [None],
                "CrawledRelearnedAgeUnkn": [0],
            }
        )
        csv_path = mock_config.source_custom_extracts / "csv" / "DevHx_5201_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_devhx(mock_config, person_registry, rejection_log)

        learned = result[result["observation_source_value"] == "CrawledLearned"]
        assert len(learned) == 1
        assert pd.isna(learned.iloc[0]["value_as_number"])


# ---------------------------------------------------------------------------
# Clinical Assessment tests
# ---------------------------------------------------------------------------


class TestClinicalAssessment:
    def _make_clinical_df(self) -> pd.DataFrame:
        """Create sample ClinicalAssessment data."""
        return pd.DataFrame(
            {
                "participant_id": [1001, 1002],
                "visit_date": ["01/15/2020", "06/20/2020"],
                "DysmorphicCB_broadforehead": [1, 0],
                "DysmorphicCB_higharchedpalate": [1, 1],
                "DysmorphicCB_none": [0, 0],
                "Alertness": ["Alert", "Drowsy"],
                "WeightTextBox": [45.5, 50.0],
                "HeightTextBox": [120.0, 130.0],
                "BMIbyCalc": [25.0, 23.0],
            }
        )

    def test_clinical_dysmorphic_booleans(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """DysmorphicCB_* value=1 rows emit observations."""
        df = self._make_clinical_df()
        csv_path = (
            mock_config.source_custom_extracts / "csv" / "ClinicalAssessment_5211.csv"
        )
        df.to_csv(csv_path, index=False)

        result = transform_clinical_assessment(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        dysm_rows = result[
            result["observation_source_value"].str.startswith("DysmorphicCB_")
        ]
        # Person 1001: broadforehead + higharchedpalate = 2
        # Person 1002: higharchedpalate = 1
        # DysmorphicCB_none excluded
        assert len(dysm_rows) == 3

    def test_clinical_measurement_columns_excluded(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Weight/Height/BMI columns not in output."""
        df = self._make_clinical_df()
        csv_path = (
            mock_config.source_custom_extracts / "csv" / "ClinicalAssessment_5211.csv"
        )
        df.to_csv(csv_path, index=False)

        result = transform_clinical_assessment(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        source_values = set(result["observation_source_value"])
        assert "WeightTextBox" not in source_values
        assert "HeightTextBox" not in source_values
        assert "BMIbyCalc" not in source_values


# ---------------------------------------------------------------------------
# Allergies tests
# ---------------------------------------------------------------------------


class TestAllergies:
    def _make_allergies_df(self) -> pd.DataFrame:
        """Create sample Allergies data."""
        return pd.DataFrame(
            {
                "participant_id": [1001, 1001, 1002],
                "visit_date": ["01/15/2020", "01/15/2020", "06/20/2020"],
                "Allergies_reported": [1, 1, 0],
                "DateStartedMM": ["Jan", "Mar", None],
                "DateStartedDD": [10, 5, None],
                "DateStartedYY": [2019, 2020, None],
                "DateUnkn": [0, 0, 0],
                "AllergenSNOMEDInput": ["Peanut", "Milk", "Dust"],
                "AllergenSNOMEDOutput": ["91935009", "3718001", None],
                "Reaction_Rash": [1, 0, 0],
                "Reaction_Vomiting": [0, 1, 0],
                "Reaction_Diarrhea": [0, 1, 0],
                "Reaction_Other": [0, 0, 0],
                "Reaction_Respiratorydistress": [0, 0, 0],
            }
        )

    def test_allergies_snomed_mapping(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """AllergenSNOMEDOutput used as observation_concept_id."""
        df = self._make_allergies_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Allergies_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_allergies(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        # Only 2 rows emitted (Allergies_reported=1 for persons 1001x2)
        assert len(result) == 2
        concept_ids = set(result["observation_concept_id"])
        assert 91935009 in concept_ids
        assert 3718001 in concept_ids

    def test_allergies_reaction_in_value(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Reaction types stored in value_as_string."""
        df = self._make_allergies_df()
        csv_path = mock_config.source_custom_extracts / "csv" / "Allergies_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_allergies(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        peanut_row = result[result["observation_source_value"] == "Peanut"]
        assert len(peanut_row) == 1
        assert "Rash" in peanut_row.iloc[0]["value_as_string"]

        milk_row = result[result["observation_source_value"] == "Milk"]
        assert len(milk_row) == 1
        value_str = milk_row.iloc[0]["value_as_string"]
        assert "Vomiting" in value_str
        assert "Diarrhea" in value_str


# ---------------------------------------------------------------------------
# Nutrition tests
# ---------------------------------------------------------------------------


class TestNutrition:
    def test_nutrition_route_and_food(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Route and TypeOfFood appear in value_as_string."""
        df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "nutrition_reported": [1],
                "Route": ["Oral"],
                "TypeOfFood": ["Pureed"],
                "Modification": ["Thickened"],
                "DateStartedMonth": ["Jan"],
                "DateStartedDay": [1],
                "DateStartedYear": [2019],
                "DateStartedUnknown": [0],
            }
        )
        csv_path = mock_config.source_custom_extracts / "csv" / "Nutrition_5211.csv"
        df.to_csv(csv_path, index=False)

        result = transform_nutrition(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        assert len(result) == 1
        row = result.iloc[0]
        assert "Oral" in row["value_as_string"]
        assert "Pureed" in row["value_as_string"]
        assert row["observation_source_value"] == "Nutrition:Oral:Pureed"


# ---------------------------------------------------------------------------
# Abnormal Movements tests
# ---------------------------------------------------------------------------


class TestAbnormalMovements:
    def test_abnormal_movements_description(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """Description preserved in value_as_string."""
        df = pd.DataFrame(
            {
                "participant_id": [1001, 1002],
                "visit_date": ["01/15/2020", "06/20/2020"],
                "Abnormal_Movements_reported": [1, 1],
                "Description": ["Rhythmic hand movements", "Head bobbing"],
                "InvestigatorsImpression": ["Stereotypy", "Tremor"],
                "DateStartedMonth": ["Jan", "Mar"],
                "DateStartedDay": [5, 10],
                "DateStartedYear": [2019, 2020],
                "DateStartedUnknown": [0, 0],
            }
        )
        csv_path = (
            mock_config.source_custom_extracts / "csv" / "Abnormal_Movements_5211.csv"
        )
        df.to_csv(csv_path, index=False)

        result = transform_abnormal_movements(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        assert len(result) == 2
        # Check descriptions preserved
        values = set(result["value_as_string"])
        assert "Rhythmic hand movements" in values
        assert "Head bobbing" in values

        # Check source_value contains impression
        source_values = set(result["observation_source_value"])
        assert "AbnormalMovement:Stereotypy" in source_values
        assert "AbnormalMovement:Tremor" in source_values


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


class TestCategoricalMerge:
    def test_categorical_merge(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        tmp_path: Path,
    ) -> None:
        """All sub-transformers merge correctly."""
        # Create minimal source files
        rett_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "BruxismEveroccurred": [1],
                "BruxismStartDtMM": ["Jan"],
                "BruxismStartDtDD": [5],
                "BruxismStartDtYY": [2018],
                "BruxismStartDtUnkn": [0],
                "BruxismAtBaseline": [0],
                "BruxismAt1Y": [0],
                "BruxismAt2Y": [0],
                "BruxismAt3Y": [0],
                "BruxismAt4Y": [0],
                "BruxismAt5Y": [0],
            }
        )
        devhx_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "ChildsDOB": ["01/15/2010"],
                "BabbledLearned": ["Y"],
                "BabbledLearnedAge": [6],
                "BabbledLearnedAgeUnkn": [0],
                "BabbledLost": [0],
                "BabbledLostAge": [None],
                "BabbledLostAgeUnkn": [0],
                "BabbledRelearned": [0],
                "BabbledRelearnedAge": [None],
                "BabbledRelearnedAgeUnkn": [0],
            }
        )
        clinical_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "DysmorphicCB_broadforehead": [1],
                "Alertness": ["Alert"],
            }
        )
        allergies_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "Allergies_reported": [1],
                "DateStartedMM": ["Jan"],
                "DateStartedDD": [10],
                "DateStartedYY": [2019],
                "AllergenSNOMEDInput": ["Peanut"],
                "AllergenSNOMEDOutput": ["91935009"],
                "Reaction_Rash": [1],
            }
        )
        nutrition_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "nutrition_reported": [1],
                "Route": ["Oral"],
                "TypeOfFood": ["Regular"],
                "Modification": ["None"],
                "DateStartedMonth": ["Jan"],
                "DateStartedDay": [1],
                "DateStartedYear": [2019],
            }
        )
        abnormal_df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "Abnormal_Movements_reported": [1],
                "Description": ["Hand wringing"],
                "InvestigatorsImpression": ["Stereotypy"],
                "DateStartedMonth": ["Feb"],
                "DateStartedDay": [1],
                "DateStartedYear": [2019],
            }
        )

        csv_dir = mock_config.source_custom_extracts / "csv"
        rett_df.to_csv(csv_dir / "Rett_Features_5211.csv", index=False)
        devhx_df.to_csv(csv_dir / "DevHx_5201_5211.csv", index=False)
        clinical_df.to_csv(csv_dir / "ClinicalAssessment_5211.csv", index=False)
        allergies_df.to_csv(csv_dir / "Allergies_5211.csv", index=False)
        nutrition_df.to_csv(csv_dir / "Nutrition_5211.csv", index=False)
        abnormal_df.to_csv(csv_dir / "Abnormal_Movements_5211.csv", index=False)

        # Write person_id_map and visit_id_map
        person_map = pd.DataFrame(
            {
                "participant_id": [1001],
                "participant_id5201": [pd.NA],
                "participant_id5211": [pd.NA],
            }
        )
        person_map.to_csv(mock_config.staging_dir / "person_id_map.csv", index=False)

        visit_map = pd.DataFrame(
            {
                "person_id": [1001],
                "visit_date": ["2020-01-15"],
                "visit_occurrence_id": [100],
            }
        )
        visit_map.to_csv(mock_config.staging_dir / "visit_id_map.csv", index=False)

        result = transform_categorical_observations(mock_config)

        assert len(result) > 0
        # Should have sequential observation_ids
        assert result["observation_id"].is_unique
        assert result["observation_id"].min() == 1

    def test_categorical_schema_validation(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        """Merged output from single source passes pandera schema."""
        # Create minimal single-source data
        df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "Abnormal_Movements_reported": [1],
                "Description": ["Tremor"],
                "InvestigatorsImpression": ["Tremor"],
                "DateStartedMonth": ["Jan"],
                "DateStartedDay": [5],
                "DateStartedYear": [2019],
            }
        )
        csv_path = (
            mock_config.source_custom_extracts / "csv" / "Abnormal_Movements_5211.csv"
        )
        df.to_csv(csv_path, index=False)

        rejection_log = RejectionLog("test")
        result = transform_abnormal_movements(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        assert not result.empty
        # Add required columns for schema validation
        result["observation_id"] = range(1, len(result) + 1)
        for col in ("value_as_concept_id", "visit_occurrence_id"):
            if col in result.columns:
                result[col] = pd.array(result[col].values, dtype=pd.Int64Dtype())
            else:
                result[col] = pd.array([pd.NA] * len(result), dtype=pd.Int64Dtype())

        output_cols = [c for c in observation_schema.columns]
        for col in output_cols:
            if col not in result.columns:
                result[col] = pd.NA

        validated = observation_schema.validate(result[output_cols])
        assert len(validated) == len(result)

    def test_categorical_source_value_not_empty(
        self,
        mock_config: MagicMock,
        person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
        rejection_log: RejectionLog,
    ) -> None:
        """No row has empty observation_source_value."""
        df = pd.DataFrame(
            {
                "participant_id": [1001],
                "visit_date": ["01/15/2020"],
                "DysmorphicCB_broadforehead": [1],
                "Alertness": ["Alert"],
            }
        )
        csv_path = (
            mock_config.source_custom_extracts / "csv" / "ClinicalAssessment_5211.csv"
        )
        df.to_csv(csv_path, index=False)

        result = transform_clinical_assessment(
            mock_config, person_registry, visit_resolver, rejection_log
        )

        assert not result.empty
        assert (result["observation_source_value"].str.len() > 0).all()
