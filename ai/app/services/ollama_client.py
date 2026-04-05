import os
from urllib.parse import urlparse

from typing import Any

import httpx

from app.config import settings

CONCEPT_MAPPING_PROMPT = """You are a medical terminology expert. Given a clinical term, suggest the most appropriate OMOP/SNOMED standard concept mapping.

Term: {term}
{context_line}

Respond in this exact JSON format:
{{
  "suggested_concept": "the standard concept name",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of why this mapping is appropriate"
}}
"""


async def check_ollama_health(base_url: str | None = None, model: str | None = None) -> str:
    """Check if an Ollama endpoint is reachable and a model is available."""
    resolved_base_url = base_url or settings.ollama_base_url
    resolved_model = model or settings.ollama_model
    parsed = urlparse(resolved_base_url)
    if parsed.hostname == "host.docker.internal" and not os.path.exists("/.dockerenv"):
        return "unavailable"

    try:
        timeout = httpx.Timeout(0.5, connect=0.5)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.get(f"{resolved_base_url}/api/tags")
            if response.status_code == 200:
                tags = response.json()
                models = [m.get("name", "") for m in tags.get("models", [])]
                if any(resolved_model in m for m in models):
                    return "ok"
                return f"model_not_found (available: {', '.join(models[:5])})"
            return "error"
    except Exception:
        return "unavailable"


async def generate_concept_mapping(term: str, context: str | None = None) -> dict[str, Any]:
    """Use Ollama with MedGemma to generate concept mapping suggestions."""
    context_line = f"Context: {context}" if context else ""
    prompt = CONCEPT_MAPPING_PROMPT.format(term=term, context_line=context_line)

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
            result = response.json()
            import json

            try:
                parsed = json.loads(result.get("response", "{}"))
                return {
                    "term": term,
                    "suggested_concept": parsed.get("suggested_concept"),
                    "confidence": float(parsed.get("confidence", 0.0)),
                    "reasoning": parsed.get("reasoning", ""),
                }
            except (json.JSONDecodeError, ValueError):
                return {
                    "term": term,
                    "suggested_concept": None,
                    "confidence": 0.0,
                    "reasoning": f"Failed to parse LLM response: {result.get('response', '')[:200]}",
                }
    except Exception as e:
        return {
            "term": term,
            "suggested_concept": None,
            "confidence": 0.0,
            "reasoning": f"Ollama error: {str(e)}",
        }
