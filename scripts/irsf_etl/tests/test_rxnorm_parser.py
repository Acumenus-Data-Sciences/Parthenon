"""Tests for RxNorm parser covering all format patterns and stop-reason assembly.

Covers the four MedRxNormCode format variants (CUI, bracket, bare numeric, RX10),
edge cases (empty, text-only, truncated), raw_value preservation, drug name
extraction, and the assemble_stop_reason function.
"""

from __future__ import annotations

import pytest

from scripts.irsf_etl.lib.rxnorm_parser import (
    RxNormParseResult,
    assemble_stop_reason,
    parse_rxnorm_code,
)


# --- parse_rxnorm_code tests ---


class TestParseCuiFormat:
    """Test CUI format: 'DrugName [CUI code:NNNNNN score [RxNorm]'."""

    def test_parse_cui_format(self) -> None:
        result = parse_rxnorm_code(
            "Keppra [C0876060 code:261547 100.0 [RxNorm]"
        )
        assert result.concept_code == "261547"
        assert result.drug_name == "Keppra"

    def test_parse_cui_format_preserves_raw(self) -> None:
        raw = "Keppra [C0876060 code:261547 100.0 [RxNorm]"
        result = parse_rxnorm_code(raw)
        assert result.raw_value == raw


class TestParseBracketFormat:
    """Test bracket format with brand name in brackets."""

    def test_parse_bracket_format(self) -> None:
        result = parse_rxnorm_code(
            "0.3 ML Epinephrine 0.5 MG/ML Auto-Injector [Epipen] "
            "[727386] code:727386 100.0 [RxNorm R]"
        )
        assert result.concept_code == "727386"

    def test_parse_bracket_format_drug_name(self) -> None:
        result = parse_rxnorm_code(
            "0.3 ML Epinephrine 0.5 MG/ML Auto-Injector [Epipen] "
            "[727386] code:727386 100.0 [RxNorm R]"
        )
        assert result.drug_name == "0.3 ML Epinephrine 0.5 MG/ML Auto-Injector"


class TestParseBareNumeric:
    """Test bare numeric format: just digits."""

    def test_parse_bare_numeric(self) -> None:
        result = parse_rxnorm_code("196502")
        assert result.concept_code == "196502"

    def test_parse_bare_numeric_drug_name_is_code(self) -> None:
        result = parse_rxnorm_code("196502")
        # For bare numeric, drug_name equals the code itself
        assert result.drug_name == "196502"


class TestParseRx10Prefix:
    """Test RX10 prefix format: code:RX10NNNNNN."""

    def test_parse_rx10_prefix(self) -> None:
        result = parse_rxnorm_code(
            "Depakene [C0700661 code:RX10203245 100.0 [RxNorm]"
        )
        assert result.concept_code == "203245"
        assert result.drug_name == "Depakene"


class TestParseEdgeCases:
    """Test edge cases: empty, text-only, truncated."""

    def test_parse_empty_string(self) -> None:
        result = parse_rxnorm_code("")
        assert result.concept_code is None
        assert result.drug_name == ""
        assert result.raw_value == ""

    def test_parse_whitespace_only(self) -> None:
        result = parse_rxnorm_code("   ")
        assert result.concept_code is None
        assert result.drug_name == ""

    def test_parse_text_only(self) -> None:
        result = parse_rxnorm_code("Peptamen")
        assert result.concept_code is None
        assert result.drug_name == "Peptamen"

    def test_parse_truncated_string(self) -> None:
        """Truncated formatted string with no code: field returns concept_code=None."""
        result = parse_rxnorm_code("Keppra [C0876060")
        assert result.concept_code is None
        assert result.drug_name == "Keppra"


class TestParseRawValuePreservation:
    """Test that raw_value always equals original input."""

    @pytest.mark.parametrize(
        "input_value",
        [
            "",
            "   ",
            "Peptamen",
            "196502",
            "Keppra [C0876060 code:261547 100.0 [RxNorm]",
            "Depakene [C0700661 code:RX10203245 100.0 [RxNorm]",
        ],
    )
    def test_parse_preserves_raw_value(self, input_value: str) -> None:
        result = parse_rxnorm_code(input_value)
        assert result.raw_value == input_value


class TestParseDrugNameExtraction:
    """Test drug name extraction (text before first '[', stripped)."""

    def test_parse_drug_name_extraction(self) -> None:
        result = parse_rxnorm_code(
            "Levetiracetam [C0876060 code:261547 100.0 [RxNorm]"
        )
        assert result.drug_name == "Levetiracetam"

    def test_parse_complex_drug_name(self) -> None:
        """Long clinical drug names with slashes/parentheses in name portion."""
        result = parse_rxnorm_code(
            "Acetaminophen 160 MG/5ML Oral Suspension (Children's Tylenol) "
            "[C1234567 code:999888 100.0 [RxNorm]"
        )
        assert result.drug_name == (
            "Acetaminophen 160 MG/5ML Oral Suspension (Children's Tylenol)"
        )
        assert result.concept_code == "999888"

    def test_parse_no_bracket_drug_name(self) -> None:
        """Drug name without brackets returns full string."""
        result = parse_rxnorm_code("Peptamen Junior")
        assert result.drug_name == "Peptamen Junior"


class TestParseResultImmutability:
    """Test that RxNormParseResult is frozen."""

    def test_result_is_frozen(self) -> None:
        result = parse_rxnorm_code("196502")
        with pytest.raises(AttributeError):
            result.concept_code = "999"  # type: ignore[misc]


# --- assemble_stop_reason tests ---


class TestAssembleStopReasonSingle:
    """Test single active reason."""

    def test_assemble_stop_reason_ineffective_only(self) -> None:
        result = assemble_stop_reason("1", "", "")
        assert result == "Ineffective"

    def test_assemble_stop_reason_side_effects_only(self) -> None:
        result = assemble_stop_reason("", "", "1")
        assert result == "Side effects"

    def test_assemble_stop_reason_not_needed_only(self) -> None:
        result = assemble_stop_reason("", "1", "")
        assert result == "Not needed"


class TestAssembleStopReasonMultiple:
    """Test multiple active reasons."""

    def test_assemble_stop_reason_two_active(self) -> None:
        result = assemble_stop_reason("1", "", "1")
        assert result == "Ineffective; Side effects"

    def test_assemble_stop_reason_ineffective_and_not_needed(self) -> None:
        result = assemble_stop_reason("1", "1", "")
        assert result == "Ineffective; Not needed"


class TestAssembleStopReasonNone:
    """Test no active reasons."""

    def test_assemble_stop_reason_none_active(self) -> None:
        result = assemble_stop_reason("", "", "")
        assert result is None

    def test_assemble_stop_reason_whitespace_values(self) -> None:
        result = assemble_stop_reason("  ", "  ", "  ")
        assert result is None


class TestAssembleStopReasonAllActive:
    """Test all three reasons active."""

    def test_assemble_stop_reason_all_active(self) -> None:
        result = assemble_stop_reason("1", "1", "1")
        assert result == "Ineffective; Side effects; Not needed"
