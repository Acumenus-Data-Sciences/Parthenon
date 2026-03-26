"""Tests for drug exposure builder module.

Covers date assembly, vocabulary validation, stop reasons, source values,
visit resolution, person ID resolution, and stats computation.
"""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pandas as pd
import pytest

from scripts.irsf_etl.lib.drug_exposure_builder import (
    DrugExposureStats,
    build_drug_exposures,
)
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.vocab_validator import (
    ConceptStatus,
    ConceptValidationResult,
)
from scripts.irsf_etl.lib.visit_resolver import VisitResolver


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_registry(person_ids: dict[int, int]) -> PersonIdRegistry:
    """Build a PersonIdRegistry from a {participant_id: person_id} dict."""
    rows = [
        {
            "participant_id": pid,
            "participant_id5201": None,
            "participant_id5211": None,
        }
        for pid in person_ids
    ]
    df = pd.DataFrame(rows)
    return PersonIdRegistry.from_dataframe(df)


def _make_visit_resolver(
    mappings: dict[tuple[int, str], int] | None = None,
) -> VisitResolver:
    """Build a VisitResolver from a {(person_id, date_str): visit_occ_id} dict."""
    if not mappings:
        return VisitResolver.from_dataframe(
            pd.DataFrame(columns=[
                "visit_occurrence_id",
                "person_id",
                "visit_date",
                "visit_label",
                "visit_concept_id",
            ])
        )
    rows = [
        {
            "visit_occurrence_id": vid,
            "person_id": pid,
            "visit_date": vdate,
            "visit_label": "",
            "visit_concept_id": 9202,
        }
        for (pid, vdate), vid in mappings.items()
    ]
    return VisitResolver.from_dataframe(pd.DataFrame(rows))


def _make_vocab_validator(
    code_results: dict[str, ConceptValidationResult],
) -> MagicMock:
    """Build a mock VocabularyValidator returning predefined results."""
    mock = MagicMock()
    mock.validate_batch_codes.return_value = code_results
    return mock


def _base_row(**overrides: object) -> dict:
    """Return a base medication row with all expected columns."""
    base = {
        "participant_id": "1001",
        "MedRxNormCode": "Levetiracetam [CUI code:187832 100.0 [RxNorm]",
        "MedRxNormInput": "Levetiracetam",
        "DateStartedMonth": "Jan",
        "DateStartedDay": 15,
        "DateStartedYear": 2020,
        "DateStoppedMonth": None,
        "DateStoppedDay": None,
        "DateStoppedYear": None,
        "ReasonForStoppin_Ineffective": "",
        "ReasonForStoppin_Notneeded": "",
        "ReasonForStoppin_Sideeffects": "",
        "visit_date": "01/15/20",
    }
    base.update(overrides)
    return base


@pytest.fixture()
def registry() -> PersonIdRegistry:
    """Registry with participant_ids 1001-1003."""
    return _make_registry({1001: 1001, 1002: 1002, 1003: 1003})


@pytest.fixture()
def visit_resolver() -> VisitResolver:
    """Resolver with known visit for person 1001 on 2020-01-15."""
    return _make_visit_resolver({(1001, "2020-01-15"): 5001})


@pytest.fixture()
def rejection_log() -> RejectionLog:
    return RejectionLog("drug_exposure")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestBuildBasicMappedRecord:
    """test_build_basic_mapped_record -- Single row with valid RxNorm code."""

    def test_produces_correct_drug_exposure_row(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        validator = _make_vocab_validator({
            "187832": ConceptValidationResult(
                original_id=187832,
                resolved_id=187832,
                status=ConceptStatus.STANDARD,
                concept_name="Levetiracetam",
                vocabulary_id="RxNorm",
                message="Standard concept",
            ),
        })
        df = pd.DataFrame([_base_row()])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, validator, rejection_log
        )

        assert len(result_df) == 1
        row = result_df.iloc[0]
        assert row["person_id"] == 1001
        assert row["drug_concept_id"] == 187832
        assert row["drug_source_concept_id"] == 187832
        assert row["drug_exposure_start_date"] == "2020-01-15"
        assert row["drug_type_concept_id"] == 32882
        assert stats.mapped_count == 1
        assert stats.unmapped_count == 0


class TestBuildUnmappedCode:
    """test_build_unmapped_code -- Row with empty MedRxNormCode."""

    def test_gets_concept_id_zero_and_input_as_source(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            MedRxNormCode="",
            MedRxNormInput="Some Drug Name",
        )])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 1
        row = result_df.iloc[0]
        assert row["drug_concept_id"] == 0
        assert row["drug_source_value"] == "Some Drug Name"
        assert stats.unmapped_count == 1


class TestBuildDeprecatedRemapped:
    """test_build_deprecated_remapped -- Deprecated code gets remapped."""

    def test_remapped_concept_ids(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        validator = _make_vocab_validator({
            "99999": ConceptValidationResult(
                original_id=99999,
                resolved_id=88888,
                status=ConceptStatus.DEPRECATED_REMAPPED,
                concept_name="Remapped Drug",
                vocabulary_id="RxNorm",
                message="Remapped from 99999 to 88888",
            ),
        })
        df = pd.DataFrame([_base_row(MedRxNormCode="99999")])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, validator, rejection_log
        )

        row = result_df.iloc[0]
        assert row["drug_concept_id"] == 88888
        assert row["drug_source_concept_id"] == 99999
        assert stats.remapped_count == 1


class TestBuildStartDateFromSplitColumns:
    """test_build_start_date_from_split_columns."""

    def test_assembled_correctly(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            DateStartedMonth="Mar",
            DateStartedDay=22,
            DateStartedYear=2019,
        )])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert result_df.iloc[0]["drug_exposure_start_date"] == "2019-03-22"


class TestBuildStartDateVisitFallback:
    """test_build_start_date_visit_fallback -- Missing start date uses visit_date."""

    def test_fallback_used(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            DateStartedMonth=None,
            DateStartedDay=None,
            DateStartedYear=None,
            visit_date="03/15/21",
        )])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 1
        assert result_df.iloc[0]["drug_exposure_start_date"] == "2021-03-15"
        assert stats.date_fallback_count == 1


class TestBuildStartDateMissingSkipped:
    """test_build_start_date_missing_skipped -- No start date AND no visit_date."""

    def test_row_rejected(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            DateStartedMonth=None,
            DateStartedDay=None,
            DateStartedYear=None,
            visit_date="",
        )])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 0
        assert stats.total_output_rows == 0
        assert rejection_log.error_count > 0


class TestBuildEndDateNullable:
    """test_build_end_date_nullable -- Missing stop columns produce NULL."""

    def test_null_end_date(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            DateStoppedMonth=None,
            DateStoppedDay=None,
            DateStoppedYear=None,
        )])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 1
        assert result_df.iloc[0]["drug_exposure_end_date"] is None


class TestBuildStopReasonPopulated:
    """test_build_stop_reason_populated."""

    def test_ineffective(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            ReasonForStoppin_Ineffective="1",
        )])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert result_df.iloc[0]["stop_reason"] == "Ineffective"


class TestBuildStopReasonMultiple:
    """test_build_stop_reason_multiple."""

    def test_semicolon_separated(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row(
            ReasonForStoppin_Ineffective="1",
            ReasonForStoppin_Sideeffects="1",
        )])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert result_df.iloc[0]["stop_reason"] == "Ineffective; Side effects"


class TestBuildSourceValuePreservation:
    """test_build_source_value_preservation (SRC-01)."""

    def test_source_value_matches_original(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        original = "Levetiracetam [CUI code:187832 100.0 [RxNorm]"
        df = pd.DataFrame([_base_row(MedRxNormCode=original)])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert result_df.iloc[0]["drug_source_value"] == original


class TestBuildSourceConceptIdPreservation:
    """test_build_source_concept_id_preservation (SRC-02)."""

    def test_pre_remapping_concept_id(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        validator = _make_vocab_validator({
            "99999": ConceptValidationResult(
                original_id=99999,
                resolved_id=88888,
                status=ConceptStatus.DEPRECATED_REMAPPED,
                concept_name="Remapped Drug",
                vocabulary_id="RxNorm",
                message="Remapped",
            ),
        })
        df = pd.DataFrame([_base_row(MedRxNormCode="99999")])
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, validator, rejection_log
        )

        row = result_df.iloc[0]
        # drug_source_concept_id holds the ORIGINAL concept_id (pre-remapping)
        assert row["drug_source_concept_id"] == 99999
        # drug_concept_id holds the REMAPPED standard concept
        assert row["drug_concept_id"] == 88888


class TestBuildVisitResolution:
    """test_build_visit_resolution."""

    def test_visit_occurrence_id_populated(
        self, registry: PersonIdRegistry, rejection_log: RejectionLog
    ) -> None:
        resolver = _make_visit_resolver({(1001, "2020-01-15"): 5001})
        df = pd.DataFrame([_base_row(visit_date="01/15/20")])
        result_df, _ = build_drug_exposures(
            df, registry, resolver, None, rejection_log
        )

        assert result_df.iloc[0]["visit_occurrence_id"] == 5001


class TestBuildUnresolvedPersonRejected:
    """test_build_unresolved_person_rejected."""

    def test_unknown_participant_logged(
        self, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        # Registry with only 1001, but data has 9999
        registry = _make_registry({1001: 1001})
        df = pd.DataFrame([_base_row(participant_id="9999")])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 0
        assert stats.total_output_rows == 0
        assert rejection_log.error_count > 0


class TestBuildStatsCoverage:
    """test_build_stats_coverage."""

    def test_coverage_rate_computed(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        validator = _make_vocab_validator({
            "187832": ConceptValidationResult(
                original_id=187832,
                resolved_id=187832,
                status=ConceptStatus.STANDARD,
                concept_name="Levetiracetam",
                vocabulary_id="RxNorm",
                message="Standard concept",
            ),
        })
        row1 = _base_row(participant_id="1001")
        row2 = _base_row(participant_id="1002", MedRxNormCode="")
        df = pd.DataFrame([row1, row2])
        _, stats = build_drug_exposures(
            df, registry, visit_resolver, validator, rejection_log
        )

        assert stats.total_output_rows == 2
        assert stats.mapped_count == 1
        assert stats.unmapped_count == 1
        assert stats.coverage_rate == pytest.approx(0.5)


class TestBuildWithoutVocabValidator:
    """test_build_without_vocab_validator -- offline mode."""

    def test_concept_ids_default_to_zero(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        df = pd.DataFrame([_base_row()])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert len(result_df) == 1
        assert result_df.iloc[0]["drug_concept_id"] == 0
        assert stats.unmapped_count == 1


class TestBuildRx10PrefixHandled:
    """test_build_rx10_prefix_handled."""

    def test_rx10_stripped_and_validated(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        validator = _make_vocab_validator({
            "203245": ConceptValidationResult(
                original_id=203245,
                resolved_id=203245,
                status=ConceptStatus.STANDARD,
                concept_name="Some Drug",
                vocabulary_id="RxNorm",
                message="Standard concept",
            ),
        })
        df = pd.DataFrame([_base_row(
            MedRxNormCode="DrugName [CUI code:RX10203245 100.0 [RxNorm]"
        )])
        result_df, stats = build_drug_exposures(
            df, registry, visit_resolver, validator, rejection_log
        )

        assert result_df.iloc[0]["drug_concept_id"] == 203245
        assert stats.mapped_count == 1


class TestBuildDrugTypeConceptId:
    """test_build_drug_type_concept_id -- All rows get 32882."""

    def test_all_rows_have_32882(
        self, registry: PersonIdRegistry, visit_resolver: VisitResolver, rejection_log: RejectionLog
    ) -> None:
        rows = [
            _base_row(participant_id="1001"),
            _base_row(participant_id="1002"),
            _base_row(participant_id="1003"),
        ]
        df = pd.DataFrame(rows)
        result_df, _ = build_drug_exposures(
            df, registry, visit_resolver, None, rejection_log
        )

        assert (result_df["drug_type_concept_id"] == 32882).all()
