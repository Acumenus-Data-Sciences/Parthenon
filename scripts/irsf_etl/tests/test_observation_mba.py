"""Tests for MBA observation transformation.

Covers wide-to-long unpivot, NULL filtering, concept mapping,
visit resolution, comment column exclusion, rejection logging,
and pandera schema validation.
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.irsf_vocabulary import IrsfVocabulary
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.observation_mba import (
    _build_mba_column_map,
    _is_comment_column,
    transform_mba_observations,
)
from scripts.irsf_etl.schemas.observation import observation_schema


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def person_registry() -> PersonIdRegistry:
    """Registry with 3 test persons."""
    df = pd.DataFrame({
        "participant_id": [1001, 1002, 1003],
        "participant_id5201": [pd.NA, pd.NA, pd.NA],
        "participant_id5211": [pd.NA, pd.NA, pd.NA],
    })
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def visit_resolver() -> VisitResolver:
    """Resolver with visits for test persons."""
    df = pd.DataFrame({
        "visit_occurrence_id": [101, 102, 103, 104],
        "person_id": [1001, 1001, 1002, 1003],
        "visit_date": ["2006-03-05", "2007-04-01", "2006-10-01", "2008-01-15"],
        "visit_label": ["Baseline", "1 year", "Baseline", "Baseline"],
        "visit_concept_id": [9202, 9202, 9202, 9202],
    })
    return VisitResolver.from_dataframe(df)


@pytest.fixture()
def mba_source_csv() -> str:
    """MBA-shaped CSV with 3 rows, some score columns, and a comment column."""
    return (
        "participant_id,visit_date,GrandTotal,Subtotal1,MotorSkillsRegression,"
        "VerbalSkillsRegression,MotorSkillRegressionComments\n"
        "1001,3/5/06,45,20,3,2,some comment\n"
        "1002,10/1/06,30,,1,,another comment\n"
        "1003,1/15/08,55,25,4,3,\n"
    )


@pytest.fixture()
def mba_source_with_nulls() -> str:
    """MBA CSV with various NULL/empty patterns."""
    return (
        "participant_id,visit_date,GrandTotal,Subtotal1,MotorSkillsRegression,"
        "VerbalSkillsRegression\n"
        "1001,3/5/06,45,,3,\n"
        "1002,10/1/06,,,1,2\n"
        "1003,1/15/08,55,25,,\n"
    )


def _write_fixtures(
    tmp_path: Path,
    mba_csv: str,
    registry: PersonIdRegistry,
    resolver: VisitResolver,
) -> tuple[Path, Path, Path]:
    """Write source CSV, person_id_map, and visit_id_map to tmp_path."""
    # Source CSV
    source_dir = tmp_path / "5211_Custom_Extracts" / "csv"
    source_dir.mkdir(parents=True)
    mba_path = source_dir / "MBA_5201_5211.csv"
    mba_path.write_text(mba_csv)

    # Staging dir
    staging_dir = tmp_path / "staging"
    staging_dir.mkdir(parents=True)

    # Person map
    registry.to_csv(staging_dir / "person_id_map.csv")

    # Visit map -- write from resolver's internal data
    visit_rows = []
    for (pid, date, label), vid in resolver._exact_map.items():
        visit_rows.append({
            "visit_occurrence_id": vid,
            "person_id": pid,
            "visit_date": date,
            "visit_label": label,
            "visit_concept_id": 9202,
        })
    pd.DataFrame(visit_rows).to_csv(staging_dir / "visit_id_map.csv", index=False)

    return source_dir.parent, staging_dir, mba_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMbaColumnMap:
    """Tests for the MBA column-to-concept lookup."""

    def test_map_has_41_entries(self) -> None:
        mba_map = _build_mba_column_map()
        assert len(mba_map) == 41

    def test_grand_total_concept_id(self) -> None:
        mba_map = _build_mba_column_map()
        assert mba_map["GrandTotal"].concept_id == 2_000_002_000

    def test_all_source_columns_unique(self) -> None:
        mba_map = _build_mba_column_map()
        assert len(mba_map) == len(set(mba_map.keys()))


class TestCommentColumnDetection:
    """Tests for comment column filtering."""

    def test_comments_suffix(self) -> None:
        assert _is_comment_column("MotorSkillRegressionComments") is True

    def test_comm_suffix(self) -> None:
        assert _is_comment_column("IrritabilityCryingTantrumsComm") is True

    def test_comme_suffix(self) -> None:
        assert _is_comment_column("StereotypicHandActivitiesComme") is True

    def test_score_column(self) -> None:
        assert _is_comment_column("MotorSkillsRegression") is False

    def test_subtotal(self) -> None:
        assert _is_comment_column("Subtotal1") is False


class TestMbaBasicUnpivot:
    """Test basic MBA wide-to-long transformation."""

    def test_correct_row_count(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        """3 rows with 4 score cols, some NaN -> verify non-NULL count."""
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )

        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(
            source_root=tmp_path,
            output_dir=tmp_path / "output",
        )
        # Staging dir must be set correctly
        assert config.staging_dir == tmp_path / "output" / "staging"
        # Copy staging files to config.staging_dir
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # Row 1: 1001 has 4 non-null scores (GrandTotal=45, Subtotal1=20, Motor=3, Verbal=2)
        # Row 2: 1002 has 2 non-null scores (GrandTotal=30, Motor=1), Subtotal1 and Verbal are empty
        # Row 3: 1003 has 4 non-null scores (GrandTotal=55, Subtotal1=25, Motor=4, Verbal=3)
        assert len(result) == 10

    def test_observation_ids_sequential(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)
        assert list(result["observation_id"]) == list(range(1, len(result) + 1))


class TestMbaNullFiltering:
    """Test that NULL/NaN values are correctly filtered."""

    def test_no_rows_for_null_scores(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_with_nulls: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_with_nulls, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # Row 1: GrandTotal=45, Motor=3 -> 2 rows
        # Row 2: Motor=1, Verbal=2 -> 2 rows
        # Row 3: GrandTotal=55, Subtotal1=25 -> 2 rows
        assert len(result) == 6

        # No NaN values in value_as_number
        assert result["value_as_number"].notna().all()


class TestMbaSourceValuePreservation:
    """Test observation_source_value preserves column names."""

    def test_source_values_match_columns(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        expected_sources = {"GrandTotal", "Subtotal1", "MotorSkillsRegression", "VerbalSkillsRegression"}
        actual_sources = set(result["observation_source_value"].unique())
        assert actual_sources == expected_sources


class TestMbaConceptIdMapping:
    """Test concept_id mapping from IrsfVocabulary."""

    def test_grand_total_concept_id(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        grand_total_rows = result[result["observation_source_value"] == "GrandTotal"]
        assert (grand_total_rows["observation_concept_id"] == 2_000_002_000).all()

    def test_source_concept_equals_observation_concept(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        assert (result["observation_source_concept_id"] == result["observation_concept_id"]).all()


class TestMbaVisitResolution:
    """Test visit_occurrence_id resolution via VisitResolver."""

    def test_visit_ids_populated(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # Person 1001 with date 2006-03-05 should resolve to visit 101
        p1001_rows = result[result["person_id"] == 1001]
        assert (p1001_rows["visit_occurrence_id"] == 101).all()


class TestMbaCommentColumnsExcluded:
    """Test that comment columns are not included in the unpivot."""

    def test_no_comment_observations(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # MotorSkillRegressionComments should NOT appear as observation_source_value
        assert "MotorSkillRegressionComments" not in result["observation_source_value"].values


class TestMbaUnresolvablePersonRejected:
    """Test that unresolvable participant_ids are logged to RejectionLog."""

    def test_unknown_person_rejected(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver,
    ) -> None:
        # CSV with person 9999 who is NOT in the registry
        csv_data = (
            "participant_id,visit_date,GrandTotal,MotorSkillsRegression\n"
            "9999,3/5/06,45,3\n"
            "1001,3/5/06,30,1\n"
        )
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, csv_data, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # Only person 1001 rows should be in the output
        assert (result["person_id"] == 1001).all()
        assert len(result) == 2  # GrandTotal + MotorSkillsRegression for 1001


class TestMbaSchemaValidation:
    """Test output passes pandera schema."""

    def test_output_validates(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)

        # Should not raise
        validated = observation_schema.validate(result)
        assert len(validated) == len(result)


class TestMbaObservationType:
    """Test all rows have observation_type_concept_id = 32883 (Survey)."""

    def test_all_survey_type(
        self, tmp_path: Path, person_registry: PersonIdRegistry,
        visit_resolver: VisitResolver, mba_source_csv: str,
    ) -> None:
        source_dir, staging_dir, _ = _write_fixtures(
            tmp_path, mba_source_csv, person_registry, visit_resolver,
        )
        from scripts.irsf_etl.config import ETLConfig

        config = ETLConfig(source_root=tmp_path, output_dir=tmp_path / "output")
        config.staging_dir.mkdir(parents=True, exist_ok=True)
        for f in staging_dir.iterdir():
            (config.staging_dir / f.name).write_bytes(f.read_bytes())

        result = transform_mba_observations(config)
        assert (result["observation_type_concept_id"] == 32883).all()
