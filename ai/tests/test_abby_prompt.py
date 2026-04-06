"""Prompt-building guardrail tests for Abby."""

from unittest.mock import patch


def test_should_skip_live_context_for_grounded_definition_query():
    """Definition questions with retrieved docs should not add live DB context."""
    from app.routers.abby import ChatRequest, _should_skip_live_context

    request = ChatRequest(
        message="What is CohortMethod?",
        page_context="prediction",
        history=[],
    )

    assert _should_skip_live_context(request, "KNOWLEDGE BASE: CohortMethod is an R package")


def test_should_not_skip_live_context_without_grounding():
    """If no docs were retrieved, live context can still help."""
    from app.routers.abby import ChatRequest, _should_skip_live_context

    request = ChatRequest(
        message="What is CohortMethod?",
        page_context="prediction",
        history=[],
    )

    assert not _should_skip_live_context(request, "")


def test_grounded_definition_answer_prefers_retrieved_sentences():
    """Definition shortcut should synthesize from retrieved context, not general knowledge."""
    from app.routers.abby import ChatRequest, _try_grounded_definition_answer

    request = ChatRequest(
        message="What is CohortMethod?",
        page_context="prediction",
        history=[],
    )

    with patch("app.routers.abby.query_docs", return_value=[]), patch(
        "app.routers.abby.get_ranked_rag_results",
        return_value=[
            {
                "score": 0.9,
                "source_tag": "ohdsi",
                "source_label": "OHDSI Research Literature",
                "title": "CohortMethod package overview",
                "source_file": "papers/cohortmethod.md",
                "text": (
                    "CohortMethod is an R package for performing new-user cohort studies "
                    "in an observational database in the OMOP Common Data Model. "
                    "It supports comparative effectiveness analyses."
                ),
            }
        ],
    ):
        reply, sources = _try_grounded_definition_answer(request)

    assert "CohortMethod is an R package" in reply
    assert sources == [
        {
            "collection": "ohdsi",
            "label": "OHDSI Research Literature",
            "title": "CohortMethod package overview",
            "source_file": "papers/cohortmethod.md",
            "score": 0.9,
        }
    ]


def test_grounded_definition_skips_reference_only_top_chunk():
    """A source-URL chunk should not suppress a valid definition chunk with the same title."""
    from app.routers.abby import ChatRequest, _try_grounded_definition_answer

    request = ChatRequest(
        message="What is HGVS nomenclature?",
        page_context="genomics",
        history=[],
    )

    with patch(
        "app.routers.abby.query_docs",
        return_value=[
            {
                "score": 1.2,
                "source_tag": "docs",
                "source_label": "Parthenon Documentation",
                "title": "HGVS Variant Nomenclature",
                "source_file": "abby-seed/reference/hgvs.md",
                "text": "https://hgvs-nomenclature.org/recommendations/general/ Related local references: docs/devlog/phases/15-genomics.md",
            },
            {
                "score": 1.1,
                "source_tag": "docs",
                "source_label": "Parthenon Documentation",
                "title": "HGVS Variant Nomenclature",
                "source_file": "abby-seed/reference/hgvs.md",
                "text": "HGVS stands for Human Genome Variation Society nomenclature. It is the standard system for describing sequence variants.",
            },
        ]
    ):
        reply, sources = _try_grounded_definition_answer(request)

    assert reply == "HGVS stands for Human Genome Variation Society nomenclature."
    assert sources == [
        {
            "collection": "docs",
            "label": "Parthenon Documentation",
            "title": "HGVS Variant Nomenclature",
            "source_file": "abby-seed/reference/hgvs.md",
            "score": 1.1,
        }
    ]


def test_grounded_definition_prefers_definition_over_practical_distinction():
    """When multiple chunks share the same title, the selector should choose the direct definition."""
    from app.routers.abby import ChatRequest, _try_grounded_definition_answer

    request = ChatRequest(
        message="What is HGVS nomenclature?",
        page_context="genomics",
        history=[],
    )

    with patch(
        "app.routers.abby.query_docs",
        return_value=[
            {
                "score": 1.2,
                "source_tag": "docs",
                "source_label": "Parthenon Documentation",
                "title": "HGVS Variant Nomenclature",
                "source_file": "abby-seed/reference/hgvs.md",
                "text": "Practical distinction: HGVS tells you how the variant is named.",
            },
            {
                "score": 1.1,
                "source_tag": "docs",
                "source_label": "Parthenon Documentation",
                "title": "HGVS Variant Nomenclature",
                "source_file": "abby-seed/reference/hgvs.md",
                "text": "HGVS stands for Human Genome Variation Society nomenclature. It is the standard system for describing sequence variants.",
            },
        ]
    ):
        reply, _ = _try_grounded_definition_answer(request)

    assert reply == "HGVS stands for Human Genome Variation Society nomenclature."
