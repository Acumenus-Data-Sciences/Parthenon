"""RxNorm formatted-string parser and stop-reason assembler.

Extracts numeric RxNorm concept codes from the four MedRxNormCode format
variants found in the IRSF Natural History Study medication data:

1. CUI format: "DrugName [CUI code:123456 100.0 [RxNorm]"
2. Bracket format: "Drug [Brand] [727386] code:727386 100.0 [RxNorm R]"
3. Bare numeric: "196502"
4. RX10 prefix: "DrugName [CUI code:RX10203245 100.0 [RxNorm]"

Also assembles stop_reason from three boolean ReasonForStoppin columns.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Compiled regexes at module level for performance on 42K rows
_RE_CODE_NUMERIC = re.compile(r"code:(\d+)")
_RE_CODE_RX10 = re.compile(r"code:RX10(\d+)")
_RE_BARE_NUMERIC = re.compile(r"^\d+$")


@dataclass(frozen=True)
class RxNormParseResult:
    """Immutable result of parsing a MedRxNormCode value.

    Attributes:
        concept_code: Extracted numeric RxNorm code as string, or None if not found.
        drug_name: Extracted drug name from the formatted string.
        raw_value: Original MedRxNormCode value for source_value preservation.
    """

    concept_code: str | None
    drug_name: str
    raw_value: str


def _extract_drug_name(value: str) -> str:
    """Extract drug name as text before the first '[' character, stripped.

    If no '[' is found, returns the full string stripped.
    """
    bracket_pos = value.find("[")
    if bracket_pos == -1:
        return value.strip()
    return value[:bracket_pos].strip()


def parse_rxnorm_code(med_rxnorm_code: str) -> RxNormParseResult:
    """Parse a MedRxNormCode string to extract the numeric RxNorm concept code.

    Strategy (ordered):
      1. Empty/whitespace -> concept_code=None, drug_name=""
      2. Try code:(digits) regex for CUI and bracket patterns
      3. Try code:RX10(digits) for RX10-prefix codes
      4. Try bare numeric match for plain codes
      5. No match -> concept_code=None with extracted drug_name

    Args:
        med_rxnorm_code: Raw MedRxNormCode string value from source data.

    Returns:
        RxNormParseResult with extracted concept_code, drug_name, and raw_value.
    """
    raw = med_rxnorm_code
    stripped = med_rxnorm_code.strip()

    # 1. Empty/whitespace
    if not stripped:
        return RxNormParseResult(concept_code=None, drug_name="", raw_value=raw)

    drug_name = _extract_drug_name(stripped)

    # 2. Try code:(digits) -- covers CUI and bracket patterns
    match = _RE_CODE_NUMERIC.search(stripped)
    if match:
        return RxNormParseResult(
            concept_code=match.group(1),
            drug_name=drug_name,
            raw_value=raw,
        )

    # 3. Try code:RX10(digits) -- RX10 prefix codes
    match = _RE_CODE_RX10.search(stripped)
    if match:
        return RxNormParseResult(
            concept_code=match.group(1),
            drug_name=drug_name,
            raw_value=raw,
        )

    # 4. Try bare numeric match
    match = _RE_BARE_NUMERIC.match(stripped)
    if match:
        return RxNormParseResult(
            concept_code=stripped,
            drug_name=stripped,
            raw_value=raw,
        )

    # 5. No match found
    return RxNormParseResult(
        concept_code=None,
        drug_name=drug_name,
        raw_value=raw,
    )


def assemble_stop_reason(
    ineffective: str, not_needed: str, side_effects: str
) -> str | None:
    """Concatenate active ReasonForStoppin boolean columns into a semicolon-separated string.

    Args:
        ineffective: "1" if medication was ineffective, "" otherwise.
        not_needed: "1" if medication was not needed, "" otherwise.
        side_effects: "1" if medication caused side effects, "" otherwise.

    Returns:
        Semicolon-separated string of active reasons in severity order
        (Ineffective; Side effects; Not needed), or None if no reasons active.
    """
    reasons: list[str] = []

    # Severity order: Ineffective, Side effects, Not needed
    if str(ineffective).strip() == "1":
        reasons.append("Ineffective")
    if str(side_effects).strip() == "1":
        reasons.append("Side effects")
    if str(not_needed).strip() == "1":
        reasons.append("Not needed")

    if not reasons:
        return None

    return "; ".join(reasons)
