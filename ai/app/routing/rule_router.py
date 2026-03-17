"""Rule Router — two-stage rule-based model routing for Abby AI.

Stage 1: Fast pattern matching on action keywords, greetings, and message length.
         Catches the clearest cases immediately.

Stage 2: Complexity scoring for messages that pass through stage 1 without a
         decisive result. Accumulates cloud/local scores from indicator terms.

Default: err toward cloud when uncertain (small cloud tiebreaker).
"""
from __future__ import annotations

import re
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Output type
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RoutingDecision:
    """Immutable routing decision returned by :class:`RuleRouter`."""
    model: str        # "claude" or "local"
    stage: int        # 1 or 2 (which stage made the decision)
    reason: str       # human-readable explanation
    confidence: float  # 0.0–1.0


# ---------------------------------------------------------------------------
# Stage 1 patterns
# ---------------------------------------------------------------------------

# Action keywords that signal the user wants to *do* something complex.
# "design" is excluded because it's ambiguous (e.g. "study design" is descriptive,
# not imperative). "explain", "interpret", "analyze" etc. belong in Stage 2 scoring.
_CLOUD_ACTION_WORDS = re.compile(
    r"\b(?:create|build|run|modify|delete|construct|generate|execute|schedule)\b",
    re.IGNORECASE,
)

# Clause markers used to detect structurally complex messages
_CLAUSE_MARKERS = re.compile(r"[,;]|\b(?:and|but|or)\b", re.IGNORECASE)

# Greetings and acknowledgements → local
_LOCAL_GREETINGS = re.compile(
    r"^(?:hi|hello|hey|thanks?|thank\s+you|ok|okay|sure|got\s+it|sounds\s+good)[!.,]?\s*(?:abby)?[!.,]?$",
    re.IGNORECASE,
)

# Simple lookup phrases for specific entities or counts → local.
# "What is concept 201826?" or "How many patients in our CDM?"
# Deliberately narrow: "what is a <general term>?" goes to Stage 2 for richer answers.
_LOCAL_SIMPLE_LOOKUP = re.compile(
    r"^(?:how\s+many|show\s+me|list|count)\b"
    r"|^what\s+is\s+(?:concept|the\s+count|the\s+number)",
    re.IGNORECASE,
)

_SIMPLE_LOOKUP_MAX_CHARS = 80  # treat as local only if message is short


# ---------------------------------------------------------------------------
# Stage 2 scoring indicators
# ---------------------------------------------------------------------------

# Terms that increase cloud score
_COMPLEXITY_INDICATORS: list[re.Pattern[str]] = [
    re.compile(r"\b(?:interpret|analyze|analyse|critique|best\s+practice|methodology|bias)\b", re.IGNORECASE),
    re.compile(r"\b(?:immortal\s+time|confound|causal|propensity|sensitivity\s+analysis)\b", re.IGNORECASE),
    re.compile(r"\b(?:survival\s+curve|hazard\s+ratio|kaplan.meier|cox\s+regression)\b", re.IGNORECASE),
    re.compile(r"\b(?:SQL|query|optimize|index|explain\s+plan)\b", re.IGNORECASE),
    re.compile(r"\b(?:explain|compare|contrast|evaluate|assess|recommend)\b", re.IGNORECASE),
]

# Terms that increase local score
_SIMPLICITY_INDICATORS: list[re.Pattern[str]] = [
    re.compile(r"^(?:yes|no|ok|okay)[.!]?\s*$", re.IGNORECASE),
    re.compile(r"^what\s+is\s+\w+\??\s*$", re.IGNORECASE),
    re.compile(r"^(?:show\s+me|list)\b", re.IGNORECASE),
    re.compile(r"^(?:what\s+is\s+a\b)", re.IGNORECASE),
]

_CLOUD_SCORE_PER_COMPLEXITY = 0.20
_LOCAL_SCORE_PER_SIMPLICITY = 0.30
_CLOUD_TIEBREAKER = 0.05  # err toward cloud when uncertain


# ---------------------------------------------------------------------------
# Router class
# ---------------------------------------------------------------------------

class RuleRouter:
    """Two-stage rule-based router: decides between 'claude' (cloud) and 'local'."""

    def route(self, message: str, *, budget_exhausted: bool = False) -> RoutingDecision:
        """Route *message* to either 'claude' or 'local'.

        Parameters
        ----------
        message:
            The raw user message text.
        budget_exhausted:
            When True, skip all routing logic and return local immediately.
        """
        if budget_exhausted:
            return RoutingDecision(
                model="local",
                stage=1,
                reason="budget_exhausted",
                confidence=1.0,
            )

        stripped = message.strip()

        # ── Stage 1 ──────────────────────────────────────────────────────────

        # Greeting / acknowledgement → local immediately
        if _LOCAL_GREETINGS.match(stripped):
            return RoutingDecision(
                model="local",
                stage=1,
                reason="stage1_greeting",
                confidence=0.95,
            )

        # Action word detected → cloud immediately
        if _CLOUD_ACTION_WORDS.search(stripped):
            return RoutingDecision(
                model="claude",
                stage=1,
                reason="stage1_action_word",
                confidence=0.90,
            )

        # Long message with multiple clause markers → cloud (complex request)
        if len(stripped) > 200 and len(_CLAUSE_MARKERS.findall(stripped)) >= 2:
            return RoutingDecision(
                model="claude",
                stage=1,
                reason="stage1_complex_message",
                confidence=0.85,
            )

        # Short simple lookup → local immediately
        if _LOCAL_SIMPLE_LOOKUP.match(stripped) and len(stripped) <= _SIMPLE_LOOKUP_MAX_CHARS:
            return RoutingDecision(
                model="local",
                stage=1,
                reason="stage1_simple_lookup",
                confidence=0.90,
            )

        # ── Stage 2: scoring ─────────────────────────────────────────────────

        cloud_score = 0.0 + _CLOUD_TIEBREAKER
        local_score = 0.0

        for pattern in _COMPLEXITY_INDICATORS:
            if pattern.search(stripped):
                cloud_score += _CLOUD_SCORE_PER_COMPLEXITY

        for pattern in _SIMPLICITY_INDICATORS:
            if pattern.search(stripped):
                local_score += _LOCAL_SCORE_PER_SIMPLICITY

        if cloud_score >= local_score:
            confidence = min(1.0, cloud_score / (cloud_score + local_score + 0.001) + 0.3)
            return RoutingDecision(
                model="claude",
                stage=2,
                reason="stage2_complexity_score",
                confidence=round(confidence, 3),
            )
        else:
            confidence = min(1.0, local_score / (cloud_score + local_score + 0.001) + 0.2)
            return RoutingDecision(
                model="local",
                stage=2,
                reason="stage2_simplicity_score",
                confidence=round(confidence, 3),
            )
