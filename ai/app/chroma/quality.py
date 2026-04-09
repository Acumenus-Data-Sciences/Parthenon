"""Heuristics for auditing ingestion sources before they are embedded."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import math
import re
from typing import Any

_WORD_RE = re.compile(r"\b[a-zA-Z][a-zA-Z0-9_-]{1,}\b")
_LONG_TOKEN_RE = re.compile(r"\b\S{35,}\b")
_REPEATED_PUNCT_RE = re.compile(r"([^\w\s])\1{3,}")
_NON_WORD_DENSE_RE = re.compile(r"[^a-zA-Z0-9\s]{8,}")

_GENERAL_BOILERPLATE_MARKERS = [
    "all rights reserved",
    "copyright",
    "permissions",
    "license",
    "doi:",
    "received for review",
    "accepted for publication",
    "correspondence to",
    "supplementary material",
    "acknowledg",
    "funding",
    "conflict of interest",
    "table of contents",
    "index",
    "references",
    "bibliography",
]

_OHDSI_PDF_BOILERPLATE_MARKERS = [
    "all rights reserved",
    "copyright",
    "permissions",
    "license",
    "received for review",
    "accepted for publication",
    "correspondence to",
    "supplementary material",
    "table of contents",
    "index",
]

_OHDSI_RELEVANCE_TERMS = [
    "ohdsi",
    "omop",
    "cdm",
    "atlas",
    "hades",
    "cohort",
    "phenotype",
    "vocabulary",
    "ehr",
    "claims",
    "clinical",
    "patient",
    "concept",
    "drug exposure",
    "condition occurrence",
    "observational",
    "healthcare",
    "fhir",
    "achilles",
]

_TEXTBOOK_RELEVANCE_TERMS = [
    "clinical",
    "disease",
    "patient",
    "cell",
    "gene",
    "genetic",
    "genome",
    "protein",
    "mutation",
    "therapy",
    "diagnosis",
    "physiology",
    "pathology",
    "biology",
    "medical",
]

_DOCS_RELEVANCE_TERMS = [
    "api",
    "workflow",
    "configuration",
    "deployment",
    "study",
    "cohort",
    "vocabulary",
    "clinical",
    "fhir",
    "etl",
    "data",
    "admin",
]


@dataclass(slots=True)
class AuditScores:
    metadata_score: float
    relevance_score: float
    boilerplate_score: float
    noise_score: float


@dataclass(slots=True)
class AuditMetrics:
    char_count: int
    word_count: int
    line_count: int
    alpha_ratio: float
    digit_ratio: float
    whitespace_ratio: float
    repeated_line_ratio: float
    long_token_ratio: float


@dataclass(slots=True)
class AuditResult:
    target_collection: str
    source_kind: str
    source_id: str
    path: str
    title: str
    disposition: str
    reasons: list[str]
    metrics: AuditMetrics
    scores: AuditScores
    missing_metadata: list[str]
    quality_score: float | None = None

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["metrics"] = asdict(self.metrics)
        payload["scores"] = asdict(self.scores)
        return payload


def audit_document(
    *,
    target_collection: str,
    source_kind: str,
    source_id: str,
    path: str,
    text: str,
    metadata: dict[str, Any] | None = None,
) -> AuditResult:
    """Score one candidate source for ingestion cleanliness and relevance."""
    metadata = metadata or {}
    normalized = _normalize_text(text)
    metrics = _compute_metrics(normalized)
    missing_metadata, metadata_score = _metadata_check(target_collection, source_kind, metadata)
    relevance_score = _compute_relevance_score(target_collection, normalized, metadata)
    boilerplate_score = _compute_boilerplate_score(target_collection, source_kind, normalized)
    noise_score = _compute_noise_score(normalized, metrics)
    quality_score = _coerce_float(metadata.get("quality_score"))

    reasons: list[str] = []
    severity = 0

    if metrics.word_count < _min_words_for(target_collection, source_kind):
        reasons.append(f"too_short:{metrics.word_count}_words")
        severity += 3
    if metrics.alpha_ratio < 0.55 and metrics.char_count >= 400:
        reasons.append(f"low_alpha_ratio:{metrics.alpha_ratio:.2f}")
        severity += 4
    if metrics.repeated_line_ratio >= 0.30:
        reasons.append(f"repeated_lines:{metrics.repeated_line_ratio:.2f}")
        severity += 3
    if metrics.long_token_ratio >= 0.08:
        reasons.append(f"long_tokens:{metrics.long_token_ratio:.2f}")
        severity += 2
    if noise_score >= 0.55:
        reasons.append(f"ocr_noise:{noise_score:.2f}")
        severity += 4
    elif noise_score >= 0.35:
        reasons.append(f"possible_noise:{noise_score:.2f}")
        severity += 2
    if boilerplate_score >= 0.45:
        reasons.append(f"boilerplate:{boilerplate_score:.2f}")
        severity += _boilerplate_penalty(target_collection, source_kind, relevance_score)
    elif boilerplate_score >= 0.25:
        reasons.append(f"possible_boilerplate:{boilerplate_score:.2f}")
        severity += _possible_boilerplate_penalty(target_collection, source_kind, relevance_score)
    if missing_metadata:
        reasons.append(f"missing_metadata:{','.join(missing_metadata)}")
        severity += 4 if _requires_strict_metadata(target_collection, source_kind) else 2
    if relevance_score < _review_relevance_floor(target_collection):
        reasons.append(f"low_relevance:{relevance_score:.2f}")
        severity += 3
    elif relevance_score < _accept_relevance_floor(target_collection):
        reasons.append(f"borderline_relevance:{relevance_score:.2f}")
        severity += 1
    if quality_score is not None and quality_score < 0.45:
        reasons.append(f"manifest_quality:{quality_score:.2f}")
        severity += 3

    disposition = "accept"
    if severity >= 7:
        disposition = "reject"
    elif severity >= 3:
        disposition = "review"

    if (
        boilerplate_score >= 0.45
        and relevance_score < _review_relevance_floor(target_collection)
        and metrics.word_count < 400
    ):
        disposition = "reject"

    title = str(metadata.get("title") or source_id or path)
    return AuditResult(
        target_collection=target_collection,
        source_kind=source_kind,
        source_id=source_id,
        path=path,
        title=title[:500],
        disposition=disposition,
        reasons=reasons,
        metrics=metrics,
        scores=AuditScores(
            metadata_score=metadata_score,
            relevance_score=relevance_score,
            boilerplate_score=boilerplate_score,
            noise_score=noise_score,
        ),
        missing_metadata=missing_metadata,
        quality_score=quality_score,
    )


def _normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _compute_metrics(text: str) -> AuditMetrics:
    char_count = len(text)
    words = _WORD_RE.findall(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    repeated_line_ratio = 0.0
    if lines:
        repeated_line_ratio = 1 - (len(set(lines)) / len(lines))

    alpha_chars = sum(1 for char in text if char.isalpha())
    digit_chars = sum(1 for char in text if char.isdigit())
    whitespace_chars = sum(1 for char in text if char.isspace())
    long_tokens = _LONG_TOKEN_RE.findall(text)

    safe_count = max(char_count, 1)
    word_count = len(words)
    return AuditMetrics(
        char_count=char_count,
        word_count=word_count,
        line_count=len(lines),
        alpha_ratio=alpha_chars / safe_count,
        digit_ratio=digit_chars / safe_count,
        whitespace_ratio=whitespace_chars / safe_count,
        repeated_line_ratio=repeated_line_ratio,
        long_token_ratio=len(long_tokens) / max(word_count, 1),
    )


def _metadata_check(
    target_collection: str,
    source_kind: str,
    metadata: dict[str, Any],
) -> tuple[list[str], float]:
    required = _required_metadata_fields(target_collection, source_kind)
    missing = [field for field in required if not _has_value(metadata.get(field))]
    if not required:
        return [], 1.0
    return missing, max(0.0, 1 - (len(missing) / len(required)))


def _required_metadata_fields(target_collection: str, source_kind: str) -> list[str]:
    if target_collection == "wiki_pages":
        return ["title", "doi", "authors", "journal", "publication_year"]
    if target_collection == "ohdsi_papers" and source_kind == "pdf":
        return ["title", "year"]
    if target_collection == "medical_textbooks":
        return ["title", "category"]
    if target_collection == "docs":
        return ["title"]
    return []


def _requires_strict_metadata(target_collection: str, source_kind: str) -> bool:
    return target_collection == "wiki_pages" or (
        target_collection == "ohdsi_papers" and source_kind == "pdf"
    )


def _compute_relevance_score(
    target_collection: str,
    text: str,
    metadata: dict[str, Any],
) -> float:
    terms = _relevance_terms_for(target_collection)
    if not terms:
        return 1.0

    lowered = text[:25000].lower()
    metadata_text = " ".join(str(value) for value in metadata.values() if _has_value(value)).lower()
    hits = 0.0
    for term in terms:
        if term in lowered:
            hits += 1.0
        elif term in metadata_text:
            hits += 0.5

    score = hits / max(len(terms) * 0.22, 1.0)
    return max(0.0, min(1.0, score))


def _relevance_terms_for(target_collection: str) -> list[str]:
    if target_collection in {"ohdsi_papers", "wiki_pages"}:
        return _OHDSI_RELEVANCE_TERMS
    if target_collection == "medical_textbooks":
        return _TEXTBOOK_RELEVANCE_TERMS
    if target_collection == "docs":
        return _DOCS_RELEVANCE_TERMS
    return []


def _boilerplate_markers_for(target_collection: str, source_kind: str) -> list[str]:
    if target_collection == "ohdsi_papers" and source_kind == "pdf":
        return _OHDSI_PDF_BOILERPLATE_MARKERS
    return _GENERAL_BOILERPLATE_MARKERS


def _boilerplate_heading_markers_for(target_collection: str, source_kind: str) -> list[str]:
    if target_collection == "ohdsi_papers" and source_kind == "pdf":
        return ["table of contents", "index"]
    return ["references", "bibliography", "acknowledgements", "table of contents", "index"]


def _compute_boilerplate_score(target_collection: str, source_kind: str, text: str) -> float:
    lowered = text.lower()
    hits = sum(1 for marker in _boilerplate_markers_for(target_collection, source_kind) if marker in lowered)

    heading_hits = 0
    for heading in _boilerplate_heading_markers_for(target_collection, source_kind):
        heading_hits += lowered.count(f"\n{heading}\n")
        heading_hits += lowered.count(f"\n## {heading}\n")

    score = (hits + (heading_hits * 1.5)) / 8.0
    return max(0.0, min(1.0, score))


def _boilerplate_penalty(target_collection: str, source_kind: str, relevance_score: float) -> int:
    if (
        target_collection == "ohdsi_papers"
        and source_kind == "pdf"
        and relevance_score >= _accept_relevance_floor(target_collection)
    ):
        return 0
    return 3


def _possible_boilerplate_penalty(target_collection: str, source_kind: str, relevance_score: float) -> int:
    if (
        target_collection == "ohdsi_papers"
        and source_kind == "pdf"
        and relevance_score >= _accept_relevance_floor(target_collection)
    ):
        return 0
    return 1


def _compute_noise_score(text: str, metrics: AuditMetrics) -> float:
    if not text:
        return 1.0

    long_token_penalty = min(1.0, metrics.long_token_ratio * 6)
    low_alpha_penalty = max(0.0, (0.70 - metrics.alpha_ratio) * 2.2)
    repeated_punct_penalty = min(1.0, len(_REPEATED_PUNCT_RE.findall(text)) / 10.0)
    dense_symbol_penalty = min(1.0, len(_NON_WORD_DENSE_RE.findall(text)) / 8.0)
    digit_penalty = max(0.0, (metrics.digit_ratio - 0.15) * 3.0)
    repeated_line_penalty = min(1.0, metrics.repeated_line_ratio * 2.0)

    score = statistics_mean(
        [
            long_token_penalty,
            low_alpha_penalty,
            repeated_punct_penalty,
            dense_symbol_penalty,
            digit_penalty,
            repeated_line_penalty,
        ]
    )
    return max(0.0, min(1.0, score))


def _review_relevance_floor(target_collection: str) -> float:
    if target_collection in {"ohdsi_papers", "wiki_pages"}:
        return 0.20
    if target_collection == "medical_textbooks":
        return 0.18
    return 0.08


def _accept_relevance_floor(target_collection: str) -> float:
    if target_collection in {"ohdsi_papers", "wiki_pages"}:
        return 0.35
    if target_collection == "medical_textbooks":
        return 0.28
    return 0.15


def _min_words_for(target_collection: str, source_kind: str) -> int:
    if target_collection == "docs":
        return 40
    if target_collection == "medical_textbooks":
        return 80
    if target_collection == "wiki_pages":
        return 100
    if target_collection == "ohdsi_papers" and source_kind == "pdf":
        return 80
    return 60


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def statistics_mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)
