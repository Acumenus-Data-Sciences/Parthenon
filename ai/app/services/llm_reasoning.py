"""LLM reasoning strategy for concept mapping.

Uses Ollama (MedGemma) to evaluate and re-rank SapBERT candidate
concepts. The LLM receives the original term, optional context, and
the top-5 candidates, then picks the best match with a confidence
score and reasoning.
"""

import json
import logging

import httpx

from app.config import settings
from app.models.schemas import ConceptCandidate

logger = logging.getLogger(__name__)

STRATEGY_NAME = "llm_reasoning"

ENHANCED_PROMPT = """You are a medical terminology expert specializing in OMOP CDM concept mapping.

Given a clinical term, optional context, and a list of candidate OMOP concepts found by semantic similarity, evaluate each candidate and select the best mapping.

## Source term
{term}

## Context
{context}

## Candidate concepts (from semantic search)
{candidates_text}

## Instructions
1. Evaluate each candidate against the source term.
2. Pick the single best candidate (or "none" if no candidate is appropriate).
3. For each candidate you consider viable, assign a confidence between 0.0 and 1.0.
4. Explain your reasoning briefly.

Respond in this exact JSON format:
{{
  "rankings": [
    {{
      "concept_id": <int>,
      "concept_name": "<string>",
      "confidence": <float 0.0-1.0>,
      "reasoning": "<brief explanation>"
    }}
  ]
}}

Return up to 5 candidates sorted by confidence descending. Only include candidates with confidence > 0.1.
"""


class LLMReasoningStrategy:
    """Re-rank candidate concepts using LLM clinical reasoning."""

    async def match(
        self,
        term: str,
        context: str | None,
        candidate_concepts: list[dict[str, object]],
    ) -> list[ConceptCandidate]:
        """Ask the LLM to evaluate and re-rank candidate concepts.

        Args:
            term: The source clinical term.
            context: Optional clinical context (table name, column, etc.).
            candidate_concepts: Top SapBERT candidates as dicts with
                concept_id, concept_name, domain_id, vocabulary_id, score.

        Returns:
            List of ConceptCandidate with LLM-adjusted confidence scores.
            Returns an empty list if Ollama is unavailable.
        """
        if not candidate_concepts:
            return []

        # Build a readable list of candidates for the prompt
        candidates_lines: list[str] = []
        for i, c in enumerate(candidate_concepts[:5], 1):
            candidates_lines.append(
                f"{i}. concept_id={c['concept_id']}, "
                f"name=\"{c['concept_name']}\", "
                f"domain={c.get('domain_id', 'N/A')}, "
                f"vocabulary={c.get('vocabulary_id', 'N/A')}, "
                f"similarity={c.get('score', 0.0):.3f}"
            )
        candidates_text = "\n".join(candidates_lines)

        prompt = ENHANCED_PROMPT.format(
            term=term,
            context=context or "No additional context provided.",
            candidates_text=candidates_text,
        )

        try:
            async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
                response = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": settings.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                response.raise_for_status()
        except Exception:
            logger.warning(
                "Ollama unavailable for LLM reasoning on term=%r", term
            )
            return []

        # Parse LLM response
        try:
            result = response.json()
            parsed = json.loads(result.get("response", "{}"))
        except (json.JSONDecodeError, ValueError):
            logger.warning(
                "Failed to parse LLM JSON response for term=%r", term
            )
            return []

        rankings = parsed.get("rankings", [])
        if not isinstance(rankings, list):
            return []

        # Build a lookup from the original candidates for domain/vocabulary
        candidate_lookup: dict[int, dict[str, object]] = {
            int(c["concept_id"]): c for c in candidate_concepts  # type: ignore[call-overload]
        }

        candidates: list[ConceptCandidate] = []
        for entry in rankings:
            try:
                cid = int(entry["concept_id"])
                confidence = float(entry.get("confidence", 0.0))
                confidence = max(0.0, min(1.0, confidence))
            except (KeyError, TypeError, ValueError):
                continue

            # Use original candidate metadata where available
            orig = candidate_lookup.get(cid, {})
            candidates.append(
                ConceptCandidate(
                    concept_id=cid,
                    concept_name=str(
                        entry.get("concept_name", orig.get("concept_name", ""))
                    ),
                    domain_id=str(orig.get("domain_id", "")),
                    vocabulary_id=str(orig.get("vocabulary_id", "")),
                    score=confidence,
                    strategy=STRATEGY_NAME,
                )
            )

        return candidates
