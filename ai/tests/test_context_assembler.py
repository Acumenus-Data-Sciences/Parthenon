"""Tests for the context assembly pipeline — ranked, budget-aware prompt construction."""
import pytest
from app.memory.context_assembler import ContextAssembler, ContextPiece, ContextTier


class TestContextAssembler:
    def test_assemble_within_budget(self):
        assembler = ContextAssembler(total_budget=1000)
        pieces = [
            ContextPiece(tier=ContextTier.WORKING, content="session context", relevance=1.0, tokens=100),
            ContextPiece(tier=ContextTier.PAGE, content="page data", relevance=0.9, tokens=80),
        ]
        result = assembler.assemble(pieces)
        assert len(result) == 2
        assert result[0].tier == ContextTier.WORKING

    def test_budget_overflow_drops_lowest_relevance(self):
        assembler = ContextAssembler(total_budget=200)
        pieces = [
            ContextPiece(tier=ContextTier.WORKING, content="important", relevance=1.0, tokens=150),
            ContextPiece(tier=ContextTier.INSTITUTIONAL, content="nice to have", relevance=0.3, tokens=100),
        ]
        result = assembler.assemble(pieces)
        assert len(result) == 1
        assert result[0].tier == ContextTier.WORKING

    def test_guaranteed_minimum_for_safety_context(self):
        assembler = ContextAssembler(total_budget=300)
        pieces = [
            ContextPiece(tier=ContextTier.WORKING, content="session", relevance=1.0, tokens=250),
            ContextPiece(tier=ContextTier.SEMANTIC, content="DATA QUALITY WARNING: sparse lab data", relevance=0.5, tokens=80, is_safety_critical=True),
        ]
        result = assembler.assemble(pieces)
        tiers = [p.tier for p in result]
        assert ContextTier.SEMANTIC in tiers

    def test_per_tier_budget_limits(self):
        budgets = {ContextTier.EPISODIC: 100}
        assembler = ContextAssembler(total_budget=2000, tier_budgets=budgets)
        pieces = [
            ContextPiece(tier=ContextTier.EPISODIC, content="history 1", relevance=0.8, tokens=80),
            ContextPiece(tier=ContextTier.EPISODIC, content="history 2", relevance=0.7, tokens=80),
        ]
        result = assembler.assemble(pieces)
        episodic_pieces = [p for p in result if p.tier == ContextTier.EPISODIC]
        assert len(episodic_pieces) == 1

    def test_format_prompt_produces_sectioned_output(self):
        assembler = ContextAssembler(total_budget=2000)
        pieces = [
            ContextPiece(tier=ContextTier.WORKING, content="current session", relevance=1.0, tokens=50),
            ContextPiece(tier=ContextTier.SEMANTIC, content="domain knowledge", relevance=0.6, tokens=50),
        ]
        result = assembler.assemble(pieces)
        prompt = assembler.format_prompt(result)
        assert "## Working Memory" in prompt
        assert "## Domain Knowledge" in prompt

    def test_empty_input_returns_empty(self):
        assembler = ContextAssembler(total_budget=1000)
        result = assembler.assemble([])
        assert result == []

    def test_medgemma_default_budget(self):
        assembler = ContextAssembler.for_medgemma()
        assert assembler.total_budget == 4000
