"""Claude API client wrapper with cost estimation and audit logging."""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Per-million-token pricing (input / output) in USD
# ---------------------------------------------------------------------------

PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    # Fallback key for any unrecognised model — use Sonnet pricing
    "default": {"input": 3.0, "output": 15.0},
}


# ---------------------------------------------------------------------------
# Response dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ClaudeResponse:
    """Immutable response returned by :meth:`ClaudeClient.chat`."""

    reply: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    model: str
    latency_ms: float
    request_hash: str


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ClaudeClient:
    """Thin wrapper around the Anthropic messages API."""

    def __init__(
        self,
        *,
        api_key: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> None:
        if not api_key:
            raise ValueError("API key must not be empty")

        self.api_key = api_key
        self.model = model or settings.claude_model
        self.max_tokens = max_tokens or settings.claude_max_tokens
        self.timeout = timeout or settings.claude_timeout

        self._client = anthropic.Anthropic(api_key=self.api_key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat(
        self,
        *,
        system_prompt: str,
        message: str,
        history: Optional[list[dict[str, str]]] = None,
    ) -> ClaudeResponse:
        """Send *message* to Claude and return a :class:`ClaudeResponse`.

        Parameters
        ----------
        system_prompt:
            The system-level instruction for Claude.
        message:
            The current user message.
        history:
            Optional list of prior ``{"role": ..., "content": ...}`` turns.
        """
        messages: list[dict[str, str]] = list(history or [])
        messages.append({"role": "user", "content": message})

        # SHA-256 audit hash of the full request payload (not truncated)
        request_hash = self._compute_hash(
            system_prompt=system_prompt,
            messages=messages,
        )

        start = time.monotonic()
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=messages,
            )
        except Exception:
            logger.exception("Claude API call failed (hash=%s)", request_hash)
            raise

        latency_ms = (time.monotonic() - start) * 1000.0

        reply_text = response.content[0].text if response.content else ""
        tokens_in: int = response.usage.input_tokens
        tokens_out: int = response.usage.output_tokens
        actual_model: str = response.model
        cost_usd = self.estimate_cost(
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            model=actual_model,
        )

        return ClaudeResponse(
            reply=reply_text,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost_usd,
            model=actual_model,
            latency_ms=round(latency_ms, 2),
            request_hash=request_hash,
        )

    def estimate_cost(
        self,
        tokens_in: int,
        tokens_out: int,
        model: Optional[str] = None,
    ) -> float:
        """Return the estimated USD cost for *tokens_in* + *tokens_out*.

        Uses per-million-token pricing from :data:`PRICING`.
        Falls back to Sonnet pricing for unknown models.
        """
        key = model or self.model
        rates = PRICING.get(key) or PRICING["default"]
        cost = (tokens_in / 1_000_000) * rates["input"] + (
            tokens_out / 1_000_000
        ) * rates["output"]
        return float(cost)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_hash(*, system_prompt: str, messages: list[dict[str, str]]) -> str:
        """Compute a full (non-truncated) SHA-256 hex digest of the request."""
        hasher = hashlib.sha256()
        hasher.update(system_prompt.encode())
        for turn in messages:
            hasher.update(turn.get("role", "").encode())
            hasher.update(turn.get("content", "").encode())
        return hasher.hexdigest()
