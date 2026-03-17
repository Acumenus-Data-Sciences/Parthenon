"""Context assembly pipeline — ranked, budget-aware prompt construction for LLM calls."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ContextTier(Enum):
    WORKING = "working"
    PAGE = "page"
    LIVE = "live"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    INSTITUTIONAL = "institutional"


TIER_DISPLAY_NAMES = {
    ContextTier.WORKING: "Working Memory",
    ContextTier.PAGE: "Page Context",
    ContextTier.LIVE: "Live Database Context",
    ContextTier.EPISODIC: "User History",
    ContextTier.SEMANTIC: "Domain Knowledge",
    ContextTier.INSTITUTIONAL: "Institutional Knowledge",
}

TIER_ORDER = [
    ContextTier.WORKING, ContextTier.PAGE, ContextTier.LIVE,
    ContextTier.EPISODIC, ContextTier.SEMANTIC, ContextTier.INSTITUTIONAL,
]

MEDGEMMA_TIER_BUDGETS = {
    ContextTier.WORKING: 1500, ContextTier.PAGE: 500, ContextTier.LIVE: 800,
    ContextTier.EPISODIC: 400, ContextTier.SEMANTIC: 600, ContextTier.INSTITUTIONAL: 200,
}

CLAUDE_TIER_BUDGETS = {
    ContextTier.WORKING: 8000,
    ContextTier.PAGE: 2000,
    ContextTier.LIVE: 4000,
    ContextTier.EPISODIC: 4000,
    ContextTier.SEMANTIC: 6000,
    ContextTier.INSTITUTIONAL: 4000,
}

SAFETY_MINIMUM_TOKENS = 200


@dataclass
class ContextPiece:
    tier: ContextTier
    content: str
    relevance: float
    tokens: int
    source: str = ""
    is_safety_critical: bool = False


class ContextAssembler:
    """Assembles context from multiple tiers into a budget-aware prompt."""

    def __init__(self, total_budget: int = 4000, tier_budgets: dict[ContextTier, int] | None = None) -> None:
        self.total_budget = total_budget
        self.tier_budgets = tier_budgets or {}

    @classmethod
    def for_medgemma(cls) -> ContextAssembler:
        return cls(total_budget=4000, tier_budgets=MEDGEMMA_TIER_BUDGETS)

    @classmethod
    def for_model(cls, model_name: str) -> ContextAssembler:
        """Factory for model-specific context assembly."""
        if model_name == "medgemma":
            return cls.for_medgemma()
        if model_name == "claude":
            return cls(total_budget=28000, tier_budgets=CLAUDE_TIER_BUDGETS)
        raise ValueError(f"Unknown model profile: {model_name}. Available: medgemma, claude")

    def assemble(self, pieces: list[ContextPiece]) -> list[ContextPiece]:
        if not pieces:
            return []
        safety_pieces = [p for p in pieces if p.is_safety_critical]
        regular_pieces = [p for p in pieces if not p.is_safety_critical]
        regular_pieces.sort(key=lambda p: p.relevance, reverse=True)
        safety_tokens = sum(p.tokens for p in safety_pieces)
        remaining_budget = self.total_budget - safety_tokens
        selected: list[ContextPiece] = []
        tier_usage: dict[ContextTier, int] = {}
        used_tokens = 0
        for piece in regular_pieces:
            tier_limit = self.tier_budgets.get(piece.tier)
            current_tier_usage = tier_usage.get(piece.tier, 0)
            if tier_limit is not None and (current_tier_usage + piece.tokens) > tier_limit:
                continue
            if (used_tokens + piece.tokens) > remaining_budget:
                continue
            selected.append(piece)
            used_tokens += piece.tokens
            tier_usage[piece.tier] = current_tier_usage + piece.tokens
        selected.extend(safety_pieces)
        tier_rank = {tier: i for i, tier in enumerate(TIER_ORDER)}
        selected.sort(key=lambda p: (tier_rank.get(p.tier, 99), -p.relevance))
        return selected

    def format_prompt(self, pieces: list[ContextPiece]) -> str:
        if not pieces:
            return ""
        sections: dict[ContextTier, list[str]] = {}
        for piece in pieces:
            if piece.tier not in sections:
                sections[piece.tier] = []
            sections[piece.tier].append(piece.content)
        parts = []
        for tier in TIER_ORDER:
            if tier in sections:
                display_name = TIER_DISPLAY_NAMES[tier]
                parts.append(f"## {display_name}")
                parts.extend(sections[tier])
                parts.append("")
        return "\n".join(parts)
