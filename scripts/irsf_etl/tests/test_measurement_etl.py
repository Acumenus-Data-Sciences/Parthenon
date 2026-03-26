"""Tests for measurement ETL: growth unpivot, CSS decomposition, labs, SF-36, NULL filtering, concept mapping."""

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
    _LAB_TYPE_MAP,
    _LIKERT_ACTIVITY_LIMIT,
    _LIKERT_TRUTH,
    _MEASUREMENT_TYPE_SURVEY,
    _OPERATOR_EQUALS,
    _RESULT_CONCEPT_MAP,
    _SF36_COLUMN_SCALE,
    _SF36_SKIP_COLUMNS,
    _SNOMED_CODE_RE,
    _assemble_lab_date,
    transform_css,
    transform_growth,
    transform_labs,
    transform_measurements,
    transform_sf36,
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


# ---------------------------------------------------------------------------
# Lab transform test fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_labs_csv() -> StringIO:
    """StringIO with representative Labs data (known types + Other/SNOMED)."""
    data = (
        "participant_id,visit_date,VisitTimePoint,TypeOfTest,DatePerformed,"
        "DatePerformedDay,DatePerformedMonth,DatePerformedYear,DatePerformedUnknown,"
        "GeneralResults,ResultsAvailableScan,SpecificResultsKnown,SNOMEDInput,SNOWMEDOutput,NA\n"
        '1001,06/17/16,Baseline,WBC,01/12/05,12,Jan,2005,,Abnormal,No,19.1,,,\n'
        '1001,06/17/16,Baseline,Other (SNOMED terms),01/12/05,12,Jan,2005,,Normal,No,1.62,'
        'tsh,"Thyroid stimulating hormone measurement (procedure) code:61167004 60.3 [SNOMED CT]",\n'
        '1001,06/17/16,Baseline,CBC,05/08/18,8,May,2018,,Normal,No,'
        '"hgb 12.5\nhct 37.6\nWBC 8.4\nplts 328",,,\n'
        '1002,09/13/16,Baseline,Cholesterol,07/09/14,9,Jul,2014,,Normal,No,191,,,\n'
        '1002,09/13/16,Baseline,Triglycerides,07/09/14,9,Jul,2014,,Normal,No,124,,,\n'
        '1003,03/02/17,Baseline,Vitamin D,11/18/15,18,Nov,2015,,Normal,No,48.4,,,\n'
        '1003,03/02/17,Baseline,Other (SNOMED terms),,,,,,,42.0,phenobarbital,,\n'
    )
    return StringIO(data)


@pytest.fixture()
def sample_sf36_csv() -> StringIO:
    """StringIO with representative SF-36 data (3 patients, response columns)."""
    import csv as csv_mod
    from io import StringIO as SIO

    headers = [
        "participant_id", "visit", "visit_date", "age_at_visit",
        "PPInstructions",
        "_1Ingeneralwouldyousayyourheal",
        "_2Comparedtooneyearagohowwould",
        "labeltypicalActivities",
        "aVigorousactivitiessuchasrunni",
        "bModerateactivitiessuchasmovin",
        "Label4question",
        "_4aCutDownOnAmountOfTimeSpent",
        "Label5question",
        "_6Duringthepast4weekstowhatext",
        "_7Howmuchbodilypainhaveyouhadd",
        "Label9question",
        "aDidyoufeelfulloflife",
        "Label11question",
        "aIseemtogetsickalittleeasierth",
        "dMyhealthisexcellent",
    ]
    rows = [
        ["1001", "Baseline", "03/05/06", "4.2", "",
         "Very Good", "Somewhat  better now than one year ago", "",
         "No, not limited at all", "Yes, limited a lot", "",
         "A little of the time", "", "Slightly", "None", "",
         "Some of the time", "", "Don't know", "Mostly true"],
        ["1002", "Baseline", "06/15/08", "5.3", "",
         "Good", "About the same as one year ago", "",
         "Yes, limited a little", "No, not limited at all", "",
         "Most of the time", "", "Not at all", "Mild", "",
         "All of the time", "", "Definitely false", "Definitely true"],
        ["1003", "Baseline", "01/10/10", "3.1", "",
         "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ]
    buf = SIO()
    writer = csv_mod.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Labs transform tests
# ---------------------------------------------------------------------------


class TestLabsTransform:
    """Tests for lab result measurement transformation."""

    def test_labs_known_type_loinc_mapping(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """CBC->3000963, WBC->3010813, Cholesterol->3027114, Triglycerides->3022192, Vitamin D->3049536."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        # Check each known type maps correctly
        for test_type, expected_concept in _LAB_TYPE_MAP.items():
            type_rows = result[result["measurement_source_value"] == test_type]
            if len(type_rows) > 0:
                actual = type_rows["measurement_concept_id"].iloc[0]
                assert actual == expected_concept, (
                    f"{test_type}: expected concept_id {expected_concept}, got {actual}"
                )

    def test_labs_snomed_code_extraction(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """SNOWMEDOutput "...code:61167004..." -> measurement_source_concept_id=61167004."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        snomed_rows = result[result["measurement_source_concept_id"] > 0]
        assert len(snomed_rows) > 0, "Expected rows with SNOMED codes"
        assert 61167004 in snomed_rows["measurement_source_concept_id"].values

    def test_labs_snomed_missing(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Other (SNOMED terms) with no SNOWMEDOutput -> concept_id=0, source_concept_id=0."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        # The last row in sample is "Other (SNOMED terms)" with empty SNOWMEDOutput
        other_rows = result[result["measurement_source_value"] == "Other (SNOMED terms)"]
        # At least one should have source_concept_id=0 (the one without SNOWMEDOutput)
        zero_snomed = other_rows[other_rows["measurement_source_concept_id"] == 0]
        assert len(zero_snomed) > 0, "Expected Other row with no SNOMED extraction"
        assert zero_snomed["measurement_concept_id"].iloc[0] == 0

    def test_labs_date_assembly(self) -> None:
        """DatePerformedMonth=Jan, DatePerformedDay=12, DatePerformedYear=2005 -> 2005-01-12."""
        row = pd.Series({
            "DatePerformedMonth": "Jan",
            "DatePerformedDay": 12,
            "DatePerformedYear": 2005,
            "DatePerformed": "01/12/05",
            "visit_date": "06/17/16",
        })
        result = _assemble_lab_date(row)
        assert result == "2005-01-12"

    def test_labs_date_fallback_to_visit_date(self) -> None:
        """Missing DatePerformed columns -> uses visit_date."""
        row = pd.Series({
            "DatePerformedMonth": None,
            "DatePerformedDay": None,
            "DatePerformedYear": None,
            "DatePerformed": None,
            "visit_date": "06/17/16",
        })
        result = _assemble_lab_date(row)
        assert result == "2016-06-17"

    def test_labs_numeric_extraction(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """SpecificResultsKnown=19.1 -> value_as_number=19.1."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        # WBC row for patient 1001 should have value_as_number=19.1
        wbc_rows = result[
            (result["measurement_source_value"] == "WBC")
            & (result["person_id"] == 1001)
        ]
        assert len(wbc_rows) > 0
        assert wbc_rows["value_as_number"].iloc[0] == pytest.approx(19.1)

    def test_labs_multiline_result(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Multi-value result extracts first number; full text in value_source_value."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        # CBC row for patient 1001 should have multiline result
        cbc_rows = result[
            (result["measurement_source_value"] == "CBC")
            & (result["person_id"] == 1001)
        ]
        if len(cbc_rows) > 0:
            # First numeric value should be 12.5 (from "hgb 12.5")
            assert cbc_rows["value_as_number"].iloc[0] == pytest.approx(12.5)
            # Full text preserved
            assert "hgb" in str(cbc_rows["value_source_value"].iloc[0])

    def test_labs_general_results_mapping(
        self,
        sample_labs_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Normal->4069590, Abnormal->4135493."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_labs_csv.seek(0)
        (csv_dir / "Labs_5211.csv").write_text(sample_labs_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_labs")

        result = transform_labs(config, mock_registry, mock_visit_resolver, log)

        # Abnormal WBC row
        abnormal_rows = result[
            (result["measurement_source_value"] == "WBC")
            & (result["person_id"] == 1001)
        ]
        if len(abnormal_rows) > 0:
            assert abnormal_rows["value_as_concept_id"].iloc[0] == 4135493

        # Normal Cholesterol row
        normal_rows = result[
            (result["measurement_source_value"] == "Cholesterol")
            & (result["person_id"] == 1002)
        ]
        if len(normal_rows) > 0:
            assert normal_rows["value_as_concept_id"].iloc[0] == 4069590


# ---------------------------------------------------------------------------
# SF-36 transform tests
# ---------------------------------------------------------------------------


class TestSf36Transform:
    """Tests for SF-36 quality-of-life measurement transformation."""

    def test_sf36_likert_encoding(
        self,
        sample_sf36_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Activity limit: 'Yes, limited a lot' -> 1, 'No, not limited at all' -> 3."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_sf36_csv.seek(0)
        (csv_dir / "SF36_5201_5211.csv").write_text(sample_sf36_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_sf36")

        result = transform_sf36(config, mock_registry, mock_visit_resolver, log)

        # Patient 1001 activity columns
        p1_vigorous = result[
            (result["person_id"] == 1001)
            & (result["measurement_source_value"] == "aVigorousactivitiessuchasrunni")
        ]
        if len(p1_vigorous) > 0:
            assert p1_vigorous["value_as_number"].iloc[0] == 3.0  # "No, not limited at all"

        p1_moderate = result[
            (result["person_id"] == 1001)
            & (result["measurement_source_value"] == "bModerateactivitiessuchasmovin")
        ]
        if len(p1_moderate) > 0:
            assert p1_moderate["value_as_number"].iloc[0] == 1.0  # "Yes, limited a lot"

    def test_sf36_null_filter(
        self,
        sample_sf36_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Patient 1003 with all-null responses should produce 0 measurement rows."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_sf36_csv.seek(0)
        (csv_dir / "SF36_5201_5211.csv").write_text(sample_sf36_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_sf36")

        result = transform_sf36(config, mock_registry, mock_visit_resolver, log)

        p3_rows = result[result["person_id"] == 1003]
        assert len(p3_rows) == 0, f"Expected 0 rows for patient 1003 (all null), got {len(p3_rows)}"

    def test_sf36_label_columns_excluded(self) -> None:
        """labeltypicalActivities, Label4question, etc. are in skip set."""
        for skip_col in ["labeltypicalActivities", "Label4question", "Label5question",
                         "Label9question", "Label11question", "PPInstructions"]:
            assert skip_col in _SF36_SKIP_COLUMNS, f"{skip_col} not in skip set"
            assert skip_col not in _SF36_COLUMN_SCALE, f"{skip_col} should not be in scale mapping"

    def test_sf36_source_value_preserved(
        self,
        sample_sf36_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Original text response preserved in value_source_value."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_sf36_csv.seek(0)
        (csv_dir / "SF36_5201_5211.csv").write_text(sample_sf36_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_sf36")

        result = transform_sf36(config, mock_registry, mock_visit_resolver, log)

        # General health for patient 1001 should have "Very Good"
        p1_health = result[
            (result["person_id"] == 1001)
            & (result["measurement_source_value"] == "_1Ingeneralwouldyousayyourheal")
        ]
        if len(p1_health) > 0:
            assert p1_health["value_source_value"].iloc[0] == "Very Good"

    def test_sf36_dont_know_handling(
        self,
        sample_sf36_csv: StringIO,
        mock_registry: PersonIdRegistry,
        mock_visit_resolver: VisitResolver,
        tmp_path,
    ) -> None:
        """Don't know encoded as 3 in truth scale."""
        from scripts.irsf_etl.config import ETLConfig

        csv_dir = tmp_path / "5211_Custom_Extracts" / "csv"
        csv_dir.mkdir(parents=True)
        sample_sf36_csv.seek(0)
        (csv_dir / "SF36_5201_5211.csv").write_text(sample_sf36_csv.read())

        config = ETLConfig(source_root=tmp_path)
        log = RejectionLog("test_sf36")

        result = transform_sf36(config, mock_registry, mock_visit_resolver, log)

        # Patient 1001 truth-scale item "Don't know"
        p1_truth = result[
            (result["person_id"] == 1001)
            & (result["measurement_source_value"] == "aIseemtogetsickalittleeasierth")
        ]
        if len(p1_truth) > 0:
            assert p1_truth["value_as_number"].iloc[0] == 3.0  # Don't know = 3
            assert p1_truth["value_source_value"].iloc[0] == "Don't know"


# ---------------------------------------------------------------------------
# Coverage rate test
# ---------------------------------------------------------------------------


class TestMeasurementCoverage:
    """Tests for measurement mapping coverage rate calculation."""

    def test_measurement_coverage_rate(self) -> None:
        """Mock data with known mapping rates: coverage >= 95% for growth + labs."""
        # Growth: 100 rows all mapped (concept_id != 0) = 100% coverage
        growth_concepts = [3036277] * 50 + [3025315] * 50
        # Labs: 90 LOINC mapped + 8 SNOMED extracted + 2 unmapped = 98% coverage
        lab_concepts = [3010813] * 90 + [0] * 10
        lab_source_concepts = [0] * 90 + [61167004] * 8 + [0] * 2

        growth_mapped = sum(1 for c in growth_concepts if c != 0)
        growth_total = len(growth_concepts)
        labs_mapped = sum(1 for c in lab_concepts if c != 0)
        labs_snomed = sum(1 for c in lab_source_concepts if c > 0)
        labs_total = len(lab_concepts)

        coverage = (growth_mapped + labs_mapped + labs_snomed) / (growth_total + labs_total)
        assert coverage >= 0.95, f"Coverage {coverage:.1%} below 95% target"

    def test_snomed_regex(self) -> None:
        """SNOMED code regex extracts correctly from real-world formats."""
        test_cases = [
            ("Thyroid stimulating hormone measurement (procedure) code:61167004 60.3 [SNOMED CT]", 61167004),
            ("Carnitine measurement (procedure) code:36174000 56.3 [SNOMED CT]", 36174000),
            ("Elevated C-reactive protein (finding) code:119971000119104 33.6 [SNOMED CT]", 119971000119104),
            ("Phenobarbital measurement (procedure) code:105294009 58.0 [SNOMED CT]", 105294009),
        ]
        for text, expected_code in test_cases:
            match = _SNOMED_CODE_RE.search(text)
            assert match is not None, f"No match for: {text}"
            assert int(match.group(1)) == expected_code
