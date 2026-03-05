"""Clinical NLP service for entity extraction and concept linking."""

import re
from dataclasses import dataclass, field

from app.services.sapbert import SapBERTService
from app.db import search_nearest


@dataclass
class ClinicalEntity:
    """Extracted clinical entity."""
    text: str
    start: int
    end: int
    label: str
    concept_id: int | None = None
    concept_name: str | None = None
    confidence: float = 0.0
    negated: bool = False
    context: str = ""


@dataclass
class NlpResult:
    """Result of clinical NLP extraction."""
    text: str
    entities: list[ClinicalEntity] = field(default_factory=list)


# Regex patterns for common clinical entities
_MEDICAL_PATTERNS = {
    "DIAGNOSIS": [
        r"\b(?:diagnosed?\s+with|assessment|impression|diagnosis)\s*:?\s*([A-Z][a-z]+(?:\s+[a-z]+){0,5})",
        r"\b(type\s+[12]\s+diabetes(?:\s+mellitus)?)\b",
        r"\b(hypertension|hyperlipidemia|asthma|COPD|CHF|CAD|CKD|GERD|DVT|PE)\b",
        r"\b(atrial\s+fibrillation|heart\s+failure|renal\s+failure|liver\s+cirrhosis)\b",
        r"\b(pneumonia|bronchitis|urinary\s+tract\s+infection|cellulitis|sepsis)\b",
    ],
    "MEDICATION": [
        r"\b(metformin|lisinopril|atorvastatin|amlodipine|omeprazole|levothyroxine)\b",
        r"\b(metoprolol|losartan|gabapentin|hydrochlorothiazide|sertraline)\b",
        r"\b(aspirin|ibuprofen|acetaminophen|prednisone|amoxicillin|azithromycin)\b",
        r"\b(\w+(?:statin|pril|sartan|olol|prazole|mycin|cillin|pine|pam|lam))\b",
    ],
    "PROCEDURE": [
        r"\b(colonoscopy|endoscopy|echocardiogram|CT\s+scan|MRI|X-ray|ultrasound)\b",
        r"\b(biopsy|catheterization|intubation|dialysis|transfusion)\b",
        r"\b(appendectomy|cholecystectomy|arthroplasty|angioplasty)\b",
    ],
    "LAB_TEST": [
        r"\b(hemoglobin|hematocrit|WBC|RBC|platelet|creatinine|BUN)\b",
        r"\b(glucose|HbA1c|TSH|troponin|BNP|INR|PT|PTT|albumin)\b",
        r"\b(sodium|potassium|chloride|bicarbonate|calcium|magnesium)\b",
        r"\b(ALT|AST|ALP|bilirubin|lipase|amylase|LDH|CRP|ESR)\b",
    ],
    "ANATOMY": [
        r"\b(chest|abdomen|lung|liver|kidney|heart|brain|spine|pelvis)\b",
        r"\b(left\s+(?:arm|leg|knee|hip|shoulder)|right\s+(?:arm|leg|knee|hip|shoulder))\b",
    ],
}

# Negation patterns
_NEGATION_PATTERNS = [
    r"\b(?:no|not|without|denies|denied|negative\s+for|absence\s+of|ruled\s+out)\s+",
    r"\b(?:no\s+evidence\s+of|unlikely|never)\s+",
]


class ClinicalNlpService:
    """Clinical NLP service using regex patterns + SapBERT concept linking."""

    def __init__(self) -> None:
        self._sapbert: SapBERTService | None = None
        self._compiled_patterns: dict[str, list[re.Pattern]] = {}
        self._negation_patterns: list[re.Pattern] = []
        self._initialized = False

    def _initialize(self) -> None:
        """Lazy initialization of patterns."""
        if self._initialized:
            return

        for label, patterns in _MEDICAL_PATTERNS.items():
            self._compiled_patterns[label] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

        self._negation_patterns = [
            re.compile(p, re.IGNORECASE) for p in _NEGATION_PATTERNS
        ]

        self._initialized = True

    def _get_sapbert(self) -> SapBERTService:
        if self._sapbert is None:
            self._sapbert = SapBERTService()
        return self._sapbert

    def _is_negated(self, text: str, start: int) -> bool:
        """Check if entity at position is negated."""
        # Look at the 50 characters before the entity
        prefix = text[max(0, start - 50):start]
        for pattern in self._negation_patterns:
            if pattern.search(prefix):
                return True
        return False

    def _get_context(self, text: str, start: int, end: int, window: int = 100) -> str:
        """Get surrounding context for an entity."""
        ctx_start = max(0, start - window)
        ctx_end = min(len(text), end + window)
        return text[ctx_start:ctx_end].strip()

    def extract_entities(self, text: str) -> NlpResult:
        """Extract clinical entities from text using regex patterns."""
        self._initialize()

        entities: list[ClinicalEntity] = []
        seen_spans: set[tuple[int, int]] = set()

        for label, patterns in self._compiled_patterns.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    # Use the first capturing group if available, else full match
                    if match.lastindex and match.lastindex >= 1:
                        entity_text = match.group(1)
                        start = match.start(1)
                        end = match.end(1)
                    else:
                        entity_text = match.group(0)
                        start = match.start(0)
                        end = match.end(0)

                    span = (start, end)
                    if span in seen_spans:
                        continue
                    seen_spans.add(span)

                    negated = self._is_negated(text, start)
                    context = self._get_context(text, start, end)

                    entities.append(ClinicalEntity(
                        text=entity_text,
                        start=start,
                        end=end,
                        label=label,
                        negated=negated,
                        context=context,
                    ))

        # Sort by position
        entities.sort(key=lambda e: e.start)

        return NlpResult(text=text, entities=entities)

    async def extract_and_link(self, text: str, link_concepts: bool = True) -> NlpResult:
        """Extract entities and optionally link to OMOP concepts via SapBERT."""
        result = self.extract_entities(text)

        if not link_concepts or not result.entities:
            return result

        # Link entities to concepts via SapBERT similarity
        sapbert = self._get_sapbert()

        for entity in result.entities:
            try:
                embedding = sapbert.encode_single(entity.text)
                candidates = search_nearest(
                    embedding,
                    top_k=1,
                )

                if candidates:
                    best = candidates[0]
                    entity.concept_id = best["concept_id"]  # type: ignore[assignment]
                    entity.concept_name = best["concept_name"]  # type: ignore[assignment]
                    entity.confidence = best["similarity"]  # type: ignore[assignment]
            except Exception:
                # If linking fails, entity still has text/span/label
                pass

        return result


# Singleton
_service: ClinicalNlpService | None = None


def get_clinical_nlp_service() -> ClinicalNlpService:
    global _service
    if _service is None:
        _service = ClinicalNlpService()
    return _service
