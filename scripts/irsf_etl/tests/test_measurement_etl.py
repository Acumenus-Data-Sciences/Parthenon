"""Tests for measurement ETL: growth unpivot, CSS decomposition, NULL filtering, concept mapping."""

from __future__ import annotations

from io import StringIO
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.irsf_vocabulary import _CSS_CONCEPTS
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.measurement_etl import (
    _CSS_MEASURE_SPECS,
    _GROWTH_MEASURES,
    _MEASUREMENT_TYPE_SURVEY,
    _OPERATOR_EQUALS,
    transform_css,
    transform_growth,
    transform_measurements,
    unpivot_wide_to_long,
)
from scripts.irsf_etl.schemas.measurement import measurement_schema


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_growth_csv() -> StringIO:
    """StringIO with representative growth data (3 patients, 2 visits, some nulls)."""
    data = (
        "participant_id,participant_id5201,participant_id5211,visit,visit_date,"
        "HeightCm,HeightMeasurementPosition,WeightKg,FOCCm,BMI\n"
        "1001,1001,1001,Baseline,03/05/06,94.60,standing,15.000,48.50,16.76\n"
        "1001,1001,1001,1 year,03/10/07,100.20,standing,17.500,,19.10\n"
        "1002,1002,1002,Baseline,06/15/08,88.00,supine,12.000,46.00,15.50\n"
        "1002,1002,1002,1 year,06/20/09,,,45.50,\n"
        "1003,1003,1003,Baseline,01/10/10,75.50,,10.500,44.00,14.20\n"
        "1003,1003,1003,1 year,01/15/11,80.00,standing,12.000,45.00,\n"
    )
    return StringIO(data)


@pytest.fixture()
def mock_registry() -> PersonIdRegistry:
    """Registry with persons 1001, 1002, 1003."""
    df = pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003],
            "participant_id5201": [1001, 1002, 1003],
            "participant_id5211": [1001, 1002, 1003],
        }
    )
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def mock_visit_resolver() -> VisitResolver:
    """Simple resolver mapping known person+date combos to visit IDs."""
    df = pd.DataFrame(
        {
            "visit_occurrence_id": [101, 102, 103, 104, 105, 106],
            "person_id": [1001, 1001, 1002, 1002, 1003, 1003],
            "visit_date": [
                "2006-03-05",
                "2007-03-10",
                "2008-06-15",
                "2009-06-20",
                "2010-01-10",
                "2011-01-15",
            ],
            "visit_label": ["Baseline", "1 year", "Baseline", "1 year", "Baseline", "1 year"],
            "visit_concept_id": [9202, 9202, 9202, 9202, 9202, 9202],
        }
    )
    return VisitResolver.from_dataframe(df)


# ---------------------------------------------------------------------------
# unpivot_wide_to_long tests
# ---------------------------------------------------------------------------


class TestUnpivotNullFilter:
    """Test that NULL values are filtered during unpivot."""

    def test_unpivot_null_filter(self, mock_visit_resolver: VisitResolver) -> None:
        """DataFrame with 3 rows, 2 measure columns; one value null -> 5 rows not 6."""
        df = pd.DataFrame(
            {
                "ColA": [10.0, 20.0, None],
                "ColB": [1.5, 2.5, 3.5],
            }
        )
        person_ids = pd.Series(pd.array([1001, 1002, 1003], dtype=pd.Int64Dtype()))
        visit_dates = pd.Series(["2006-03-05", "2008-06-15", "2010-01-10"])
        specs: list[tuple[str, int, int, str]] = [
            ("ColA", 100, 200, "unit_a"),
            ("ColB", 101, 201, "unit_b"),
        ]
        log = RejectionLog("test")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates,
            measure_specs=specs,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        # 3 rows * 2 cols = 6, minus 1 null = 5
        assert len(rows) == 5

    def test_unpivot_all_null_row(self, mock_visit_resolver: VisitResolver) -> None:
        """Row where all measure columns are null -> 0 rows for that row."""
        df = pd.DataFrame(
            {
                "ColA": [10.0, None],
                "ColB": [1.5, None],
            }
        )
        person_ids = pd.Series(pd.array([1001, 1002], dtype=pd.Int64Dtype()))
        visit_dates = pd.Series(["2006-03-05", "2008-06-15"])
        specs: list[tuple[str, int, int, str]] = [
            ("ColA", 100, 200, "unit_a"),
            ("ColB", 101, 201, "unit_b"),
        ]
        log = RejectionLog("test")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates,
            measure_specs=specs,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        # Row 0: 2 values, Row 1: 0 values (all null)
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# Growth transform tests
# ---------------------------------------------------------------------------


class TestGrowthTransform:
    """Tests for growth measurement transformation."""

    def test_growth_loinc_mapping(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """Verify HeightCm->3036277, WeightKg->3025315, BMI->3038553, FOCCm->3036832."""
        df = pd.read_csv(sample_growth_csv)
        log = RejectionLog("test_growth")
        log.set_processed_count(len(df))

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_GROWTH_MEASURES,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        result = pd.DataFrame(rows)
        concept_ids = set(result["measurement_concept_id"].unique())
        assert concept_ids == {3036277, 3025315, 3038553, 3036832}

    def test_growth_unit_mapping(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """Verify unit_concept_id: Height/FOC->8582, Weight->9529, BMI->9531."""
        df = pd.read_csv(sample_growth_csv)
        log = RejectionLog("test_growth")
        log.set_processed_count(len(df))

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_GROWTH_MEASURES,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        result = pd.DataFrame(rows)

        # Height rows (concept 3036277) should have unit 8582
        height_units = result.loc[
            result["measurement_concept_id"] == 3036277, "unit_concept_id"
        ].unique()
        assert set(height_units) == {8582}

        # Weight rows (concept 3025315) should have unit 9529
        weight_units = result.loc[
            result["measurement_concept_id"] == 3025315, "unit_concept_id"
        ].unique()
        assert set(weight_units) == {9529}

        # BMI rows (concept 3038553) should have unit 9531
        bmi_units = result.loc[
            result["measurement_concept_id"] == 3038553, "unit_concept_id"
        ].unique()
        assert set(bmi_units) == {9531}

        # FOC rows (concept 3036832) should have unit 8582
        foc_units = result.loc[
            result["measurement_concept_id"] == 3036832, "unit_concept_id"
        ].unique()
        assert set(foc_units) == {8582}

    def test_growth_height_position_qualifier(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """HeightMeasurementPosition appears in measurement_source_value for height rows."""
        from scripts.irsf_etl.config import ETLConfig

        # Write sample CSV to tmp
        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)

        height_rows = result[result["measurement_concept_id"] == 3036277]
        # At least some height rows should have position qualifier
        source_values = height_rows["measurement_source_value"].tolist()
        has_position = [sv for sv in source_values if "standing" in str(sv) or "supine" in str(sv)]
        assert len(has_position) > 0, "Expected HeightMeasurementPosition in source_value"

    def test_growth_visit_resolution(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Mock VisitResolver returns visit_occurrence_id; verify it appears in output."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)

        # At least some rows should have resolved visit_occurrence_ids
        resolved = result["visit_occurrence_id"].dropna()
        assert len(resolved) > 0, "Expected some resolved visit_occurrence_ids"
        # Check known visit IDs are present
        resolved_set = set(resolved.astype(int).tolist())
        assert resolved_set & {101, 102, 103, 104, 105, 106}

    def test_growth_unresolved_person_rejected(
        self,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """Unknown participant_id logged to rejection_log."""
        df = pd.DataFrame(
            {
                "HeightCm": [100.0],
                "WeightKg": [50.0],
                "BMI": [20.0],
                "FOCCm": [45.0],
            }
        )
        # person_id is NA (unresolved)
        person_ids = pd.Series(pd.array([pd.NA], dtype=pd.Int64Dtype()))
        visit_dates = pd.Series(["2006-03-05"])
        log = RejectionLog("test")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates,
            measure_specs=_GROWTH_MEASURES,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        assert len(rows) == 0
        assert len(log.entries) == 1
        assert log.entries[0].column == "person_id"

    def test_growth_unparseable_date_rejected(
        self,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """Invalid visit_date logged to rejection_log."""
        df = pd.DataFrame(
            {
                "HeightCm": [100.0],
                "WeightKg": [50.0],
                "BMI": [20.0],
                "FOCCm": [45.0],
            }
        )
        person_ids = pd.Series(pd.array([1001], dtype=pd.Int64Dtype()))
        # NaT from failed date parse -> strftime produces "NaT"
        visit_dates = pd.Series(["NaT"])
        log = RejectionLog("test")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates,
            measure_specs=_GROWTH_MEASURES,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test.csv",
        )

        assert len(rows) == 0
        assert len(log.entries) == 1
        assert log.entries[0].column == "visit_date"


# ---------------------------------------------------------------------------
# Schema and output validation tests
# ---------------------------------------------------------------------------


class TestMeasurementOutput:
    """Tests for measurement output format and schema compliance."""

    def test_measurement_schema_validation(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Output passes Pandera schema."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)
        result["measurement_id"] = range(1, len(result) + 1)

        # Should not raise
        validated = measurement_schema.validate(result)
        assert len(validated) == len(result)

    def test_measurement_id_sequential(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """measurement_ids are 1,2,3,...,N with no gaps."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)
        result = result.copy()
        result["measurement_id"] = range(1, len(result) + 1)

        ids = result["measurement_id"].tolist()
        assert ids == list(range(1, len(ids) + 1))

    def test_growth_value_as_number_type(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """value_as_number is float, not string."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)

        for val in result["value_as_number"].dropna():
            assert isinstance(val, float), f"Expected float, got {type(val)}: {val}"

    def test_growth_source_value_preserved(
        self,
        sample_growth_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """measurement_source_value contains original column name."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        csv_path = csv_dir / "GROWTH_5201_5211.csv"
        sample_growth_csv.seek(0)
        csv_path.write_text(sample_growth_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_growth")

        result = transform_growth(config, mock_registry, mock_visit_resolver, log)

        source_values = set(result["measurement_source_value"].tolist())
        # Should contain base column names (possibly with position qualifier for HeightCm)
        has_height = any("HeightCm" in str(sv) for sv in source_values)
        has_weight = "WeightKg" in source_values
        has_bmi = "BMI" in source_values
        has_foc = "FOCCm" in source_values

        assert has_height, f"Expected HeightCm in source_values: {source_values}"
        assert has_weight, f"Expected WeightKg in source_values: {source_values}"
        assert has_bmi, f"Expected BMI in source_values: {source_values}"
        assert has_foc, f"Expected FOCCm in source_values: {source_values}"


# ---------------------------------------------------------------------------
# CSS transform tests
# ---------------------------------------------------------------------------


class TestCssTransform:
    """Tests for CSS (Clinical Severity Scale) measurement transformation."""

    def test_css_concept_mapping(
        self,
        sample_css_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """Verify TotalScore->2000001000, AgeOfOnsetOfRegression->2000001001, etc."""
        df = pd.read_csv(sample_css_csv)
        log = RejectionLog("test_css")
        log.set_processed_count(len(df))

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        result = pd.DataFrame(rows)
        concept_ids = set(result["measurement_concept_id"].unique())

        # All 14 CSS concept_ids should be present
        expected_ids = {c.concept_id for c in _CSS_CONCEPTS}
        assert concept_ids == expected_ids, (
            f"Expected {expected_ids}, got {concept_ids}"
        )

    def test_css_all_14_columns_unpivoted(
        self,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """One complete CSS row (all values non-null) produces exactly 14 rows."""
        data = (
            "participant_id,visit,visit_date,"
            "TotalScore,AgeOfOnsetOfRegression,OnsetOfStereotypes,HeadGrowth,"
            "SomaticGrowthAtThisVisit,IndependentSittingAtThisVisitB,"
            "AmbulationAtThisVisitByExam,HandUse,Scoliosis,"
            "LanguageAtThisVisitByExam,NonverbalCommunicationAtThisVi,"
            "RespiratoryDysfunctionAtThisVi,AutonomicSymptomsAtThisVisitBy,"
            "EpilepsySeizuresAtThisVisit\n"
            "1001,Baseline,03/05/06,25,3,2,1,2,3,4,3,2,1,2,1,0,1\n"
        )
        df = pd.read_csv(StringIO(data))
        log = RejectionLog("test_css")

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        assert len(rows) == 14, f"Expected 14 rows, got {len(rows)}"

    def test_css_null_filter(
        self,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """CSS row with 2 null score columns produces 12 measurement rows, not 14."""
        data = (
            "participant_id,visit,visit_date,"
            "TotalScore,AgeOfOnsetOfRegression,OnsetOfStereotypes,HeadGrowth,"
            "SomaticGrowthAtThisVisit,IndependentSittingAtThisVisitB,"
            "AmbulationAtThisVisitByExam,HandUse,Scoliosis,"
            "LanguageAtThisVisitByExam,NonverbalCommunicationAtThisVi,"
            "RespiratoryDysfunctionAtThisVi,AutonomicSymptomsAtThisVisitBy,"
            "EpilepsySeizuresAtThisVisit\n"
            "1002,1 year,06/20/09,22,2,1,1,2,3,3,,1,,1,1,1,3\n"
        )
        df = pd.read_csv(StringIO(data))
        log = RejectionLog("test_css")

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        # 14 columns - 2 nulls = 12
        assert len(rows) == 12, f"Expected 12 rows (2 nulls), got {len(rows)}"

    def test_css_values_are_integer_scores(
        self,
        sample_css_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """value_as_number contains integer values (0-5 for items, 0-52 for total)."""
        df = pd.read_csv(sample_css_csv)
        log = RejectionLog("test_css")

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        result = pd.DataFrame(rows)
        for val in result["value_as_number"]:
            assert float(val) == int(val), f"CSS score should be integer, got {val}"
            assert 0 <= val <= 52, f"CSS score out of range: {val}"

    def test_css_unit_concept_is_zero(
        self,
        sample_css_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """All CSS measurements have unit_concept_id=0 (scores, not physical units)."""
        df = pd.read_csv(sample_css_csv)
        log = RejectionLog("test_css")

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        result = pd.DataFrame(rows)
        unique_units = set(result["unit_concept_id"].unique())
        assert unique_units == {0}, f"Expected all unit_concept_id=0, got {unique_units}"

    def test_css_source_column_driven(self) -> None:
        """Verify that source_column from _CSS_CONCEPTS matches actual measure_specs."""
        expected_columns = {c.source_column for c in _CSS_CONCEPTS}
        spec_columns = {spec[0] for spec in _CSS_MEASURE_SPECS}
        assert expected_columns == spec_columns, (
            f"Mismatch: _CSS_CONCEPTS source_columns {expected_columns} "
            f"vs _CSS_MEASURE_SPECS columns {spec_columns}"
        )

    def test_css_measurement_source_value(
        self,
        sample_css_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
    ) -> None:
        """measurement_source_value = original column name (e.g., TotalScore, HandUse)."""
        df = pd.read_csv(sample_css_csv)
        log = RejectionLog("test_css")

        person_ids = mock_registry.resolve_series(df["participant_id"])
        visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
        visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

        rows = unpivot_wide_to_long(
            df=df,
            person_ids=person_ids,
            visit_dates=visit_dates_str,
            measure_specs=_CSS_MEASURE_SPECS,
            visit_resolver=mock_visit_resolver,
            log=log,
            source_file="test_css.csv",
        )

        result = pd.DataFrame(rows)
        source_values = set(result["measurement_source_value"].unique())
        expected_names = {c.source_column for c in _CSS_CONCEPTS}
        assert source_values == expected_names, (
            f"Expected {expected_names}, got {source_values}"
        )

    def test_combined_growth_and_css(
        self,
        sample_growth_csv: StringIO,
        sample_css_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Both growth and CSS rows appear in combined output with distinct concept_id ranges."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)

        # Write growth CSV
        sample_growth_csv.seek(0)
        (csv_dir / "GROWTH_5201_5211.csv").write_text(sample_growth_csv.read())

        # Write CSS CSV
        sample_css_csv.seek(0)
        (csv_dir / "CSS_5201_5211.csv").write_text(sample_css_csv.read())

        config = ETLConfig(source_root=tmp_path)
        growth_log = RejectionLog("test_growth")
        css_log = RejectionLog("test_css")

        growth_df = transform_growth(config, mock_registry, mock_visit_resolver, growth_log)
        css_df = transform_css(config, mock_registry, mock_visit_resolver, css_log)

        combined = pd.concat([growth_df, css_df], ignore_index=True)

        # Growth concepts are in LOINC range (3M+)
        growth_concepts = set(combined.loc[
            combined["measurement_concept_id"] < 2_000_000_000,
            "measurement_concept_id",
        ].unique())
        # CSS concepts are in IRSF custom range (2B+)
        css_concepts = set(combined.loc[
            combined["measurement_concept_id"] >= 2_000_000_000,
            "measurement_concept_id",
        ].unique())

        assert len(growth_concepts) > 0, "Expected growth concept_ids"
        assert len(css_concepts) > 0, "Expected CSS concept_ids"
        # No overlap
        assert growth_concepts.isdisjoint(css_concepts)
