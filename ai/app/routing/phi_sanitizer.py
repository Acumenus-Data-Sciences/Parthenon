"""PHI Sanitizer — regex-based PHI detection and optional spaCy NER redaction.

Designed for Abby AI: scans user queries before sending to cloud models to ensure
Protected Health Information (PHI) is never transmitted without explicit consent.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import spacy


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PHIFinding:
    """A single PHI match found in the input text."""
    pattern_type: str
    matched_text: str
    start: int
    end: int


@dataclass
class SanitizationResult:
    """Result of scanning a text for PHI."""
    phi_detected: bool
    redacted_text: str
    redaction_count: int
    findings: list[PHIFinding]
    original_hash: str  # SHA-256 of original text (for audit)

    @property
    def is_safe(self) -> bool:
        """True when no PHI was found."""
        return not self.phi_detected


# ---------------------------------------------------------------------------
# Pattern definitions
# ---------------------------------------------------------------------------

# Contextual terms that indicate the surrounding numbers are clinical
# vocabulary IDs (SNOMED, ICD, RxNorm, etc.) — not MRNs or PHI.
CLINICAL_CONTEXT_TERMS: set[str] = {
    "concept",
    "concept_id",
    "concept id",
    "snomed",
    "icd",
    "icd-9",
    "icd-10",
    "rxnorm",
    "loinc",
    "omop",
    "vocabulary",
    "domain",
    "standard",
    "drug",
    "condition",
    "procedure",
    "measurement",
    "observation",
    "code",
}

# Compiled patterns: (name, compiled_regex)
# Order matters — more specific patterns first.
PHI_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # SSN: xxx-xx-xxxx
    (
        "ssn",
        re.compile(
            r"\b\d{3}-\d{2}-\d{4}\b",
            re.IGNORECASE,
        ),
    ),
    # Email addresses
    (
        "email",
        re.compile(
            r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        ),
    ),
    # Phone numbers: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx
    # Requires contextual keyword OR (xxx) format to avoid false positives
    (
        "phone",
        re.compile(
            r"(?:"
            r"(?:call|phone|contact|fax|tel|telephone)\s+(?:patient\s+)?(?:at\s+)?"
            r"[\(\d][\d\s\-\.\(\)]{7,16}\d"
            r"|"
            r"\(\d{3}\)\s*\d{3}[\-\s]\d{4}"
            r")",
            re.IGNORECASE,
        ),
    ),
    # MRN: "MRN" or "Medical Record" keyword + 6–10 digit number
    (
        "mrn",
        re.compile(
            r"(?:MRN|medical\s+record\s+(?:number|#|no\.?))\s*[:\-#]?\s*(\d{6,10})\b",
            re.IGNORECASE,
        ),
    ),
    # Date of Birth: DOB / born / birth_date keyword + MM/DD/YYYY or MM-DD-YYYY
    (
        "dob",
        re.compile(
            r"(?:DOB|date\s+of\s+birth|birth(?:date|_date)?|born)\s*[:\-]?\s*"
            r"\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b",
            re.IGNORECASE,
        ),
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _has_clinical_context(text: str, match_start: int, match_end: int, window: int = 60) -> bool:
    """Return True if the match is surrounded by clinical vocabulary context terms."""
    context = text[max(0, match_start - window): match_end + window].lower()
    return any(term in context for term in CLINICAL_CONTEXT_TERMS)


def _deduplicate_findings(findings: list[PHIFinding]) -> list[PHIFinding]:
    """Remove overlapping findings, keeping the first (highest-priority) match."""
    if not findings:
        return []
    sorted_findings = sorted(findings, key=lambda f: f.start)
    result: list[PHIFinding] = [sorted_findings[0]]
    for finding in sorted_findings[1:]:
        last = result[-1]
        if finding.start >= last.end:
            result.append(finding)
    return result


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class PHISanitizer:
    """Scans text for PHI using regex patterns and optionally spaCy NER.

    Parameters
    ----------
    use_ner:
        When True, load spaCy ``en_core_web_sm`` and add NER-detected
        PERSON entities to findings. Set False for fast unit tests.
    """

    def __init__(self, use_ner: bool = True) -> None:
        self.use_ner = use_ner
        self._nlp: "spacy.Language | None" = None  # lazy-loaded

    def _get_nlp(self) -> "spacy.Language":
        if self._nlp is None:
            import spacy  # noqa: PLC0415
            self._nlp = spacy.load("en_core_web_sm")
        return self._nlp

    def scan(self, text: str) -> SanitizationResult:
        """Scan *text* for PHI and return a :class:`SanitizationResult`."""
        original_hash = hashlib.sha256(text.encode()).hexdigest()

        if not text:
            return SanitizationResult(
                phi_detected=False,
                redacted_text=text,
                redaction_count=0,
                findings=[],
                original_hash=original_hash,
            )

        findings: list[PHIFinding] = []

        # --- Regex patterns ---
        for pattern_name, pattern in PHI_PATTERNS:
            for m in pattern.finditer(text):
                # Suppress if surrounded by clinical vocabulary context
                if pattern_name == "mrn" and _has_clinical_context(text, m.start(), m.end()):
                    continue
                findings.append(
                    PHIFinding(
                        pattern_type=pattern_name,
                        matched_text=m.group(0),
                        start=m.start(),
                        end=m.end(),
                    )
                )

        # --- spaCy NER (optional) ---
        if self.use_ner:
            nlp = self._get_nlp()
            doc = nlp(text)
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    findings.append(
                        PHIFinding(
                            pattern_type="person_name",
                            matched_text=ent.text,
                            start=ent.start_char,
                            end=ent.end_char,
                        )
                    )

        findings = _deduplicate_findings(findings)

        # --- Build redacted text ---
        redacted = text
        # Sort in reverse order so replacements don't shift later indices
        for finding in sorted(findings, key=lambda f: f.start, reverse=True):
            redacted = redacted[: finding.start] + "[REDACTED]" + redacted[finding.end :]

        return SanitizationResult(
            phi_detected=len(findings) > 0,
            redacted_text=redacted,
            redaction_count=len(findings),
            findings=findings,
            original_hash=original_hash,
        )
