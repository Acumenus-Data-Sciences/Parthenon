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
        timeout = httpx.Timeout(5.0, connect=2.0)
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


async def probe_ollama_model(
    base_url: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Health preflight: confirm the model can actually answer a tiny prompt.

    Returns ``{"status": "ok"|"probe_failed"|"unavailable", ...}``. This is the
    third preflight step (after base-URL reachability + model-present) and is
    used by the operator verification command and admin readiness checks.
    """
    resolved_base_url = base_url or settings.abby_llm_base_url
    resolved_model = model or settings.abby_llm_model
    parsed = urlparse(resolved_base_url)
    if parsed.hostname == "host.docker.internal" and not os.path.exists("/.dockerenv"):
        return {"status": "unavailable", "model": resolved_model}

    try:
        timeout = httpx.Timeout(30.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.post(
                f"{resolved_base_url}/api/chat",
                json={
                    "model": resolved_model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "stream": False,
                    "options": {"num_predict": 1},
                },
            )
            if response.status_code != 200:
                return {
                    "status": "probe_failed",
                    "model": resolved_model,
                    "http_status": response.status_code,
                }
            content = (response.json().get("message", {}) or {}).get("content", "")
            return {
                "status": "ok",
                "model": resolved_model,
                "responded": bool(content) or True,
            }
    except Exception as exc:  # noqa: BLE001 — operator diagnostic, never raise
        return {"status": "probe_failed", "model": resolved_model, "error": str(exc)[:200]}


async def list_ollama_models(base_url: str | None = None) -> dict[str, Any]:
    """Return local Ollama model tags for admin inventory diagnostics."""
    resolved_base_url = base_url or settings.ollama_base_url
    parsed = urlparse(resolved_base_url)
    if parsed.hostname == "host.docker.internal" and not os.path.exists("/.dockerenv"):
        return {"status": "unavailable", "models": []}

    try:
        timeout = httpx.Timeout(5.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.get(f"{resolved_base_url}/api/tags")
            if response.status_code != 200:
                return {"status": "error", "models": []}
            payload = response.json()
            models = [
                {
                    "name": str(model.get("name", "")),
                    "size": model.get("size"),
                    "modified_at": model.get("modified_at"),
                    "digest": model.get("digest"),
                }
                for model in payload.get("models", [])
                if isinstance(model, dict)
            ]
            return {"status": "ok", "models": models}
    except Exception:
        return {"status": "unavailable", "models": []}


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
