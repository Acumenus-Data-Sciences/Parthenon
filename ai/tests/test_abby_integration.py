"""
Integration tests for the Abby chat pipeline.

These tests are the authoritative regression suite for the Abby chat system.
Every bug discovered in production should result in a new test here BEFORE
the fix is written.

Coverage areas:
  1. Pydantic model validation — the PHP→Python serialization boundary
  2. /abby/chat endpoint — happy path and all known failure modes
  3. Response contract — what the Laravel backend expects
  4. Multi-turn conversation — history and conversation_id handling
  5. Profile handling — null/empty/populated user profiles
  6. Helper functions — _extract_suggestions, _strip_thinking_tokens
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.abby import (
    ChatRequest,
    ChatResponse,
    ResearchProfile,
    RoutingDecision,
    UserProfile,
    _extract_suggestions,
    _is_reference_only_grounded_sentence,
    _looks_truncated_visible_reply,
    _needs_visible_reply_retry,
    _save_user_profile,
    _should_store_conversation_answer,
    _strip_thinking_tokens,
    _user_exists,
)

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

OLLAMA_REPLY = "Here is my answer.\nSUGGESTIONS: [\"Follow up?\", \"More detail?\"]"


def _mock_chat_patches() -> tuple:
    """Return the set of patches needed to isolate /abby/chat from external deps."""
    return (
        patch("app.routers.abby.call_ollama", new_callable=AsyncMock, return_value=OLLAMA_REPLY),
        patch("app.routers.abby.build_rag_context", return_value=""),
        patch("app.routers.abby.store_conversation_turn"),
        patch("app.routers.abby._save_user_profile"),
        patch("app.routers.abby._fetch_user_profile", return_value=None),
        # DB-touching helpers inside _build_chat_system_prompt
        patch("app.routers.abby.DataProfileService", autospec=True),
        patch("app.knowledge.data_profile.DataProfileService", autospec=True, create=True),
    )


def _post_chat(payload: dict[str, Any]) -> Any:
    """POST to /abby/chat with all external deps patched.

    We patch _build_chat_system_prompt to return a simple string rather than
    trying to mock all the lazy imports inside it (DataProfileService,
    KnowledgeCapture, etc.). The endpoint contract tests care about request
    parsing and response shape, not prompt construction.
    """
    with (
        patch("app.routers.abby.call_ollama", new_callable=AsyncMock, return_value=OLLAMA_REPLY),
        patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
        patch("app.routers.abby.store_conversation_turn"),
        patch("app.routers.abby._save_user_profile"),
        patch("app.routers.abby._fetch_user_profile", return_value=None),
        patch("app.routers.abby._get_cost_tracker") as mock_tracker,
    ):
        mock_cost = MagicMock()
        mock_cost.is_budget_exhausted.return_value = False
        mock_tracker.return_value = mock_cost
        return client.post("/abby/chat", json=payload)


# ===========================================================================
# Section 1: ResearchProfile model — PHP→Python serialization boundary
# ===========================================================================
# These tests cover the exact payloads that PHP sends from Laravel.
# PHP json_encode([]) always produces "[]" regardless of whether the column
# is a list or a JSON object. These coercions MUST hold.

class TestResearchProfileCoercion:
    """PHP sends [] for any empty JSONB column; we must coerce to correct types."""

    def test_empty_list_coerced_to_dict_for_expertise_domains(self) -> None:
        rp = ResearchProfile(expertise_domains=[])  # type: ignore[arg-type]
        assert rp.expertise_domains == {}

    def test_empty_list_coerced_to_dict_for_interaction_preferences(self) -> None:
        rp = ResearchProfile(interaction_preferences=[])  # type: ignore[arg-type]
        assert rp.interaction_preferences == {}

    def test_empty_list_coerced_to_dict_for_frequently_used(self) -> None:
        rp = ResearchProfile(frequently_used=[])  # type: ignore[arg-type]
        assert rp.frequently_used == {}

    def test_none_coerced_to_empty_list_for_research_interests(self) -> None:
        rp = ResearchProfile(research_interests=None)
        assert rp.research_interests == []

    def test_none_coerced_to_empty_dict_for_expertise_domains(self) -> None:
        rp = ResearchProfile(expertise_domains=None)
        assert rp.expertise_domains == {}

    def test_none_coerced_to_empty_dict_for_interaction_preferences(self) -> None:
        rp = ResearchProfile(interaction_preferences=None)
        assert rp.interaction_preferences == {}

    def test_none_coerced_to_empty_dict_for_frequently_used(self) -> None:
        rp = ResearchProfile(frequently_used=None)
        assert rp.frequently_used == {}

    def test_none_coerced_to_zero_for_interaction_count(self) -> None:
        rp = ResearchProfile(interaction_count=None)
        assert rp.interaction_count == 0

    def test_fully_null_profile_parses_without_error(self) -> None:
        """The case when a user has no saved profile and Laravel sends all nulls."""
        rp = ResearchProfile(
            research_interests=None,
            expertise_domains=None,
            interaction_preferences=None,
            frequently_used=None,
            interaction_count=None,
        )
        assert rp.research_interests == []
        assert rp.expertise_domains == {}
        assert rp.interaction_preferences == {}
        assert rp.frequently_used == {}
        assert rp.interaction_count == 0

    def test_fully_empty_list_profile_parses_without_error(self) -> None:
        """The worst-case PHP payload: every field serialised as []."""
        rp = ResearchProfile.model_validate({
            "research_interests": [],
            "expertise_domains": [],
            "interaction_preferences": [],
            "frequently_used": [],
            "interaction_count": None,
        })
        assert rp.expertise_domains == {}
        assert rp.interaction_preferences == {}
        assert rp.frequently_used == {}
        assert rp.research_interests == []

    def test_populated_values_pass_through_unchanged(self) -> None:
        rp = ResearchProfile(
            research_interests=["diabetes", "oncology"],
            expertise_domains={"endocrinology": 0.9},
            interaction_preferences={"verbosity": "terse"},
            frequently_used={"condition": 5},
            interaction_count=12,
        )
        assert rp.research_interests == ["diabetes", "oncology"]
        assert rp.expertise_domains == {"endocrinology": 0.9}
        assert rp.interaction_count == 12

    def test_empty_object_profile_parses_without_error(self) -> None:
        """Laravel can also send research_profile: {} (empty object)."""
        rp = ResearchProfile.model_validate({})
        assert rp.research_interests == []
        assert rp.expertise_domains == {}


# ===========================================================================
# Section 2: ChatRequest validation
# ===========================================================================

class TestChatRequestValidation:
    """ChatRequest must accept every payload shape that the frontend/Laravel sends."""

    def test_minimal_request_is_valid(self) -> None:
        req = ChatRequest(message="Hello Abby")
        assert req.message == "Hello Abby"
        assert req.page_context == "general"
        assert req.history == []
        assert req.user_profile is None
        assert req.user_id is None
        assert req.conversation_id is None

    def test_request_with_null_user_profile(self) -> None:
        req = ChatRequest(message="Test", user_profile=None)
        assert req.user_profile is None

    def test_request_with_empty_user_profile(self) -> None:
        req = ChatRequest(message="Test", user_profile={})  # type: ignore[arg-type]
        assert req.user_profile is not None
        assert req.user_profile.name == ""

    def test_request_with_php_serialized_empty_research_profile(self) -> None:
        """Exact payload shape that Laravel sends for a user with no saved profile."""
        payload = {
            "message": "Help me with cohorts",
            "page_context": "cohort_builder",
            "user_profile": {
                "name": "Dr. Smith",
                "research_profile": {
                    "research_interests": [],
                    "expertise_domains": [],
                    "interaction_preferences": [],
                    "frequently_used": [],
                    "interaction_count": None,
                },
            },
        }
        req = ChatRequest.model_validate(payload)
        assert req.user_profile is not None
        rp = req.user_profile.research_profile
        assert rp.expertise_domains == {}
        assert rp.research_interests == []

    def test_request_with_history(self) -> None:
        req = ChatRequest(
            message="Follow up",
            history=[
                {"role": "user", "content": "First question"},
                {"role": "assistant", "content": "First answer"},
            ],
        )
        assert len(req.history) == 2
        assert req.history[0].role == "user"

    def test_request_with_conversation_id(self) -> None:
        req = ChatRequest(message="Continue", conversation_id=42)
        assert req.conversation_id == 42

    def test_request_with_null_conversation_id(self) -> None:
        req = ChatRequest(message="Start", conversation_id=None)
        assert req.conversation_id is None

    def test_request_with_page_data(self) -> None:
        req = ChatRequest(
            message="What is wrong with this cohort?",
            page_context="cohort_builder",
            page_data={"cohort_name": "Diabetes Patients", "cohort_id": 7},
        )
        assert req.page_data["cohort_name"] == "Diabetes Patients"


# ===========================================================================
# Section 3: /abby/chat endpoint — response contract
# ===========================================================================
# Every test here asserts on what Laravel reads from the response.
# The contract: { reply: str, suggestions: list[str], routing: dict }

class TestChatEndpointResponseContract:
    """The /abby/chat endpoint must return the correct structure for every valid input."""

    def test_minimal_request_returns_200(self) -> None:
        resp = _post_chat({"message": "Hello Abby"})
        assert resp.status_code == 200

    def test_response_contains_reply(self) -> None:
        resp = _post_chat({"message": "Hello Abby"})
        data = resp.json()
        assert "reply" in data
        assert isinstance(data["reply"], str)
        assert len(data["reply"]) > 0

    def test_response_contains_suggestions_list(self) -> None:
        resp = _post_chat({"message": "Hello Abby"})
        data = resp.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)

    def test_response_contains_routing_dict(self) -> None:
        resp = _post_chat({"message": "Hello Abby"})
        data = resp.json()
        assert "routing" in data
        assert "model" in data["routing"]

    def test_truncated_local_reply_retries_and_stores_final_answer(self) -> None:
        truncated = (
            "ClinVar is a public archive hosted by the National Center for Biotechnology "
            "Information that aggregates variant interpretations to enrich"
        )
        recovered = "ClinVar is a public archive of variant interpretations hosted by NCBI."
        with (
            patch("app.routers.abby.call_ollama", new_callable=AsyncMock, side_effect=[truncated, recovered]) as mock_ollama,
            patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
            patch("app.routers.abby._try_grounded_definition_answer", return_value=("", [])),
            patch("app.routers.abby.store_conversation_turn") as mock_store,
            patch("app.routers.abby._save_user_profile"),
            patch("app.routers.abby._fetch_user_profile", return_value=None),
            patch("app.routers.abby._get_cost_tracker") as mock_tracker,
            patch(
                "app.routers.abby._router.route",
                return_value=RoutingDecision(model="local", stage=0, reason="test", confidence=1.0),
            ),
        ):
            mock_cost = MagicMock()
            mock_cost.is_budget_exhausted.return_value = False
            mock_tracker.return_value = mock_cost

            resp = client.post("/abby/chat", json={
                "message": "What is ClinVar?",
                "page_context": "genomics",
                "user_id": 1,
            })

        assert resp.status_code == 200
        assert resp.json()["reply"] == recovered
        assert mock_ollama.await_count == 2
        assert mock_store.call_args.kwargs["answer"] == recovered

    def test_grounded_definition_returns_sources_and_skips_memory_storage(self) -> None:
        with (
            patch(
                "app.routers.abby._try_grounded_definition_answer",
                return_value=(
                    "ClinVar is the NCBI public archive of submitted interpretations of human genetic variants.",
                    [
                        {
                            "collection": "docs",
                            "label": "Parthenon Documentation",
                            "title": "ClinVar",
                            "source_file": "docs/abby-seed/reference/clinvar.md",
                            "score": 0.93,
                        }
                    ],
                ),
            ),
            patch("app.routers.abby.store_conversation_turn") as mock_store,
            patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
            patch("app.routers.abby._save_user_profile"),
            patch("app.routers.abby._fetch_user_profile", return_value=None),
            patch("app.routers.abby._get_cost_tracker") as mock_tracker,
        ):
            mock_cost = MagicMock()
            mock_cost.is_budget_exhausted.return_value = False
            mock_tracker.return_value = mock_cost

            resp = client.post("/abby/chat", json={
                "message": "What is ClinVar?",
                "page_context": "genomics",
                "user_id": 1,
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["routing"]["reason"] == "grounded_definition"
        assert data["sources"] == [
            {
                "collection": "docs",
                "label": "Parthenon Documentation",
                "title": "ClinVar",
                "source_file": "docs/abby-seed/reference/clinvar.md",
                "score": 0.93,
            }
        ]
        mock_store.assert_not_called()

    def test_stream_grounded_definition_emits_sources_event(self) -> None:
        with patch(
            "app.routers.abby._try_grounded_definition_answer",
            return_value=(
                "ClinVar is the NCBI public archive of submitted interpretations of human genetic variants.",
                [
                    {
                        "collection": "docs",
                        "label": "Parthenon Documentation",
                        "title": "ClinVar",
                        "source_file": "docs/abby-seed/reference/clinvar.md",
                        "section": "Definition",
                        "score": 0.93,
                    }
                ],
            ),
        ):
            with client.stream(
                "POST",
                "/abby/chat/stream",
                json={
                    "message": "What is ClinVar?",
                    "page_context": "genomics",
                },
            ) as resp:
                lines = [
                    line.decode() if isinstance(line, bytes) else line
                    for line in resp.iter_lines()
                    if line
                ]

        assert resp.status_code == 200
        payloads = [
            json.loads(line.removeprefix("data: "))
            for line in lines
            if line.startswith("data: ") and line != "data: [DONE]"
        ]
        assert {"token": "ClinVar is the NCBI public archive of submitted interpretations of human genetic variants."} in payloads
        assert {
            "sources": [
                {
                    "collection": "docs",
                    "label": "Parthenon Documentation",
                    "title": "ClinVar",
                    "source_file": "docs/abby-seed/reference/clinvar.md",
                    "section": "Definition",
                    "score": 0.93,
                }
            ]
        } in payloads

    def test_anonymous_user_no_user_id(self) -> None:
        """No user_id — no profile fetch, no profile save, still returns reply."""
        resp = _post_chat({
            "message": "What is OMOP CDM?",
            "page_context": "general",
        })
        assert resp.status_code == 200
        assert len(resp.json()["reply"]) > 0

    def test_authenticated_user_with_empty_php_profile(self) -> None:
        """User exists but research_profile fields are all PHP-empty-arrays."""
        resp = _post_chat({
            "message": "Help me with cohorts",
            "page_context": "cohort_builder",
            "user_id": 1,
            "user_profile": {
                "name": "Dr. Smith",
                "research_profile": {
                    "research_interests": [],
                    "expertise_domains": [],
                    "interaction_preferences": [],
                    "frequently_used": [],
                    "interaction_count": None,
                },
            },
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert len(data["reply"]) > 0

    def test_authenticated_user_with_null_research_profile(self) -> None:
        """user_profile present but research_profile not set."""
        resp = _post_chat({
            "message": "What is a cohort?",
            "user_id": 5,
            "user_profile": {"name": "Researcher"},
        })
        assert resp.status_code == 200
        assert len(resp.json()["reply"]) > 0

    def test_request_with_null_user_profile_field(self) -> None:
        """user_profile is explicitly null — as sent when user has no saved profile."""
        resp = _post_chat({
            "message": "Explain OMOP",
            "user_profile": None,
        })
        assert resp.status_code == 200
        assert resp.json()["reply"]

    def test_multi_turn_conversation_with_history(self) -> None:
        """History is accepted and the endpoint returns a reply."""
        resp = _post_chat({
            "message": "Can you elaborate on that?",
            "page_context": "general",
            "history": [
                {"role": "user", "content": "What is a cohort?"},
                {"role": "assistant", "content": "A cohort is a group of patients..."},
            ],
            "conversation_id": None,
        })
        assert resp.status_code == 200
        assert resp.json()["reply"]

    def test_multi_turn_with_conversation_id(self) -> None:
        """conversation_id is accepted alongside history."""
        resp = _post_chat({
            "message": "What about incidence rates?",
            "history": [
                {"role": "user", "content": "What is OMOP?"},
                {"role": "assistant", "content": "OMOP is a common data model."},
            ],
            "conversation_id": 99,
        })
        assert resp.status_code == 200
        assert resp.json()["reply"]

    def test_commons_ask_abby_page_context(self) -> None:
        """The commons ask-abby page_context (sent by AskAbbyChannel) is accepted."""
        resp = _post_chat({
            "message": "What cohort patterns have worked for diabetes?",
            "page_context": "commons_ask_abby",
            "page_data": {
                "channel_id": "ask-abby",
                "channel_name": "ask-abby",
            },
        })
        assert resp.status_code == 200

    def test_history_is_forwarded_to_ollama(self) -> None:
        """Verify history turns reach call_ollama."""
        with (
            patch("app.routers.abby.call_ollama", new_callable=AsyncMock, return_value=OLLAMA_REPLY) as mock_ollama,
            patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
            patch("app.routers.abby.store_conversation_turn"),
            patch("app.routers.abby._save_user_profile"),
            patch("app.routers.abby._fetch_user_profile", return_value=None),
            patch("app.routers.abby._get_cost_tracker") as mock_tracker,
        ):
            mock_cost = MagicMock()
            mock_cost.is_budget_exhausted.return_value = False
            mock_tracker.return_value = mock_cost

            client.post("/abby/chat", json={
                "message": "Follow-up question",
                "history": [
                    {"role": "user", "content": "Prior question"},
                    {"role": "assistant", "content": "Prior answer"},
                ],
            })

        mock_ollama.assert_called_once()
        call_kwargs = mock_ollama.call_args.kwargs
        history_arg = call_kwargs.get("history", [])
        assert len(history_arg) == 2
        assert history_arg[0].role == "user"
        assert history_arg[0].content == "Prior question"

    def test_no_422_for_known_php_payload(self) -> None:
        """The exact JSON that AbbyAiController.php sends — must never 422."""
        # This is the worst-case payload extracted from the PHP controller:
        # $profileData = (object)[] → serialises as {}
        # research_profile: {} inside user_profile
        resp = _post_chat({
            "message": "test",
            "page_context": "general",
            "page_data": {},
            "history": [],
            "user_profile": {
                "name": "Dr. Test",
                "research_profile": {},
            },
            "user_id": 1,
            "conversation_id": None,
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_suggestions_stripped_from_reply(self) -> None:
        """reply field must NOT contain the raw SUGGESTIONS: line."""
        resp = _post_chat({"message": "What is OMOP?"})
        data = resp.json()
        assert "SUGGESTIONS:" not in data["reply"]

    def test_suggestions_parsed_into_list(self) -> None:
        resp = _post_chat({"message": "What is OMOP?"})
        data = resp.json()
        assert data["suggestions"] == ["Follow up?", "More detail?"]


# ===========================================================================
# Section 4: Helper function unit tests
# ===========================================================================

class TestExtractSuggestions:
    """_extract_suggestions must robustly parse or skip the SUGGESTIONS block."""

    def test_parses_valid_suggestions(self) -> None:
        reply, suggestions = _extract_suggestions(
            'Answer text.\nSUGGESTIONS: ["What next?", "How to fix?"]'
        )
        assert reply == "Answer text."
        assert suggestions == ["What next?", "How to fix?"]

    def test_returns_empty_list_when_no_suggestions(self) -> None:
        reply, suggestions = _extract_suggestions("Just the answer.")
        assert reply == "Just the answer."
        assert suggestions == []

    def test_handles_malformed_json_in_suggestions(self) -> None:
        reply, suggestions = _extract_suggestions(
            "Answer.\nSUGGESTIONS: not valid json at all"
        )
        assert reply == "Answer."
        assert suggestions == []

    def test_caps_at_three_suggestions(self) -> None:
        _, suggestions = _extract_suggestions(
            'A.\nSUGGESTIONS: ["1","2","3","4","5"]'
        )
        assert len(suggestions) == 3

    def test_handles_empty_string(self) -> None:
        reply, suggestions = _extract_suggestions("")
        assert reply == ""
        assert suggestions == []

    def test_parses_medgemma_singular_suggestion_format(self) -> None:
        """MedGemma outputs 'Suggestion: text' lines instead of JSON array."""
        raw = (
            "Answer about heart failure study.\n"
            "Suggestion: Would you like to explore cohort design?\n"
            "Suggestion: Are you interested in specific medications?\n"
            "Suggestion: Do you need help with concept sets?"
        )
        reply, suggestions = _extract_suggestions(raw)
        assert "Suggestion:" not in reply
        assert len(suggestions) == 3
        assert "cohort design" in suggestions[0]

    def test_parses_medgemma_inline_suggestion_format(self) -> None:
        """MedGemma sometimes puts all Suggestion: entries on one line."""
        raw = (
            "Answer text. "
            "Suggestion: First? "
            "Suggestion: Second? "
            "Suggestion: Third?"
        )
        reply, suggestions = _extract_suggestions(raw)
        assert len(suggestions) == 3
        assert "Suggestion:" not in reply

    def test_medgemma_suggestions_capped_at_three(self) -> None:
        raw = "\n".join([
            "Body text.",
            "Suggestion: One?",
            "Suggestion: Two?",
            "Suggestion: Three?",
            "Suggestion: Four?",
        ])
        _, suggestions = _extract_suggestions(raw)
        assert len(suggestions) == 3


class TestStripThinkingTokens:
    """_strip_thinking_tokens must remove MedGemma chain-of-thought blocks."""

    def test_strips_thinking_block(self) -> None:
        raw = "<unused94>thinking content here<unused95>Actual answer."
        result = _strip_thinking_tokens(raw)
        assert result == "Actual answer."
        assert "<unused94>" not in result

    def test_strips_orphaned_tokens(self) -> None:
        raw = "<unused87>Actual answer."
        result = _strip_thinking_tokens(raw)
        assert "<unused87>" not in result
        assert "Actual answer." in result

    def test_leaves_normal_text_unchanged(self) -> None:
        raw = "This is a normal answer about OMOP CDM."
        assert _strip_thinking_tokens(raw) == raw

    def test_handles_multiline_thinking_block(self) -> None:
        raw = "<unused94>line1\nline2\nline3<unused95>Clean answer."
        result = _strip_thinking_tokens(raw)
        assert "Clean answer." in result
        assert "line1" not in result

    def test_strips_plain_thought_prefix(self) -> None:
        raw = "thought\nActual answer about OMOP CDM."
        result = _strip_thinking_tokens(raw)
        assert result == "Actual answer about OMOP CDM."

    def test_strips_qwen_thinking_block(self) -> None:
        raw = "<think>\ninternal reasoning\n</think>\nFinal answer."
        result = _strip_thinking_tokens(raw)
        assert result == "Final answer."

    def test_strips_unclosed_qwen_thinking_block(self) -> None:
        raw = "<think>\ninternal reasoning only"
        result = _strip_thinking_tokens(raw)
        assert result == ""


class TestLocalReplyQualityGuards:
    def test_detects_truncated_visible_reply(self) -> None:
        reply = (
            "ClinVar is a public archive hosted by the National Center for Biotechnology "
            "Information that aggregates variant interpretations to enrich"
        )
        assert _looks_truncated_visible_reply(reply) is True
        assert _needs_visible_reply_retry(reply, reply) is True

    def test_does_not_flag_complete_sentence(self) -> None:
        reply = "ClinVar is a public archive of variant interpretations hosted by NCBI."
        assert _looks_truncated_visible_reply(reply) is False
        assert _should_store_conversation_answer(reply) is True

    def test_refuses_to_store_abstract_fragment_answers(self) -> None:
        reply = "Results We identified 96 trials reporting results on ClinicalTrials.gov."
        assert _should_store_conversation_answer(reply) is False

    def test_hidden_reasoning_still_triggers_retry(self) -> None:
        raw = "<think>internal reasoning only"
        assert _needs_visible_reply_retry(raw, "") is True

    def test_reference_only_grounded_sentence_is_rejected(self) -> None:
        assert _is_reference_only_grounded_sentence(
            "https://hgvs-nomenclature.org/recommendations/general/ Related local references: docs/devlog/phases/15-genomics.md"
        ) is True

    def test_save_user_profile_skips_missing_users(self) -> None:
        with (
            patch("app.routers.abby._user_exists", return_value=False),
            patch("app.routers.abby._get_shared_engine") as mock_engine,
        ):
            _save_user_profile(1, {"research_interests": ["genomics"]})
        mock_engine.assert_not_called()

    def test_user_exists_queries_app_users_schema(self) -> None:
        mock_engine = MagicMock()
        mock_conn = mock_engine.connect.return_value.__enter__.return_value
        mock_result = MagicMock()
        mock_result.scalar.return_value = True
        mock_conn.execute.return_value = mock_result

        with patch("app.routers.abby._get_shared_engine", return_value=mock_engine):
            assert _user_exists(117) is True

        query_text = str(mock_conn.execute.call_args.args[0])
        assert "FROM app.users" in query_text


# ===========================================================================
# Section 5: Router registration (import safety)
# ===========================================================================

class TestRouterRegistration:
    """The abby router must load even when optional packages are absent."""

    def test_abby_chat_endpoint_is_registered(self) -> None:
        """If claude_client.py has an import error, the router must still load."""
        routes = [r.path for r in app.routes]  # type: ignore[attr-defined]
        assert "/abby/chat" in routes

    def test_abby_chat_returns_200_without_anthropic(self) -> None:
        """Anthropic is not installed; all requests must fall back to Ollama."""
        resp = _post_chat({"message": "Test without anthropic"})
        assert resp.status_code == 200
        assert resp.json()["routing"]["model"] == "local"


# ===========================================================================
# Section 6: Regression tests — one test per past production bug
# ===========================================================================

class TestRegressions:
    """
    Each test is named after the bug it guards. Adding a test here before
    writing the fix is mandatory.
    """

    def test_regression_empty_php_array_for_expertise_domains_no_422(self) -> None:
        """
        Bug: PHP json_encode([]) on empty JSONB dict columns sends []
        which fails Pydantic's dict[str, float] validation → 422.
        Fix: coerce_nulls validator maps [] → {} for dict fields.
        """
        rp = ResearchProfile.model_validate({"expertise_domains": []})
        assert rp.expertise_domains == {}

    def test_regression_null_research_profile_no_422(self) -> None:
        """
        Bug: Laravel sends research_profile: {} (empty object) for users with
        no saved profile → Pydantic 422 on required fields.
        Fix: all ResearchProfile fields have empty defaults.
        """
        up = UserProfile.model_validate({"name": "Test", "research_profile": {}})
        assert up.research_profile.research_interests == []

    def test_regression_chat_returns_reply_not_empty(self) -> None:
        """
        Bug: When Pydantic 422'd, Laravel absorbed the error and returned a
        200 with no reply field → frontend silently showed nothing.
        Fix: proper coercion so no 422 occurs.
        """
        resp = _post_chat({
            "message": "What is OMOP?",
            "user_id": 1,
            "user_profile": {
                "name": "Dr. Test",
                "research_profile": {
                    "research_interests": [],
                    "expertise_domains": [],
                    "interaction_preferences": [],
                    "frequently_used": [],
                    "interaction_count": None,
                },
            },
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert len(data["reply"]) > 0

    def test_regression_history_reaches_ollama_not_dropped(self) -> None:
        """
        Bug: /abby/chat accepted history in the request but the service
        dropped it before calling Ollama — multi-turn had no context.
        Fix: history passed as-is to call_ollama().
        """
        with (
            patch("app.routers.abby.call_ollama", new_callable=AsyncMock, return_value=OLLAMA_REPLY) as mock_ollama,
            patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
            patch("app.routers.abby.store_conversation_turn"),
            patch("app.routers.abby._save_user_profile"),
            patch("app.routers.abby._fetch_user_profile", return_value=None),
            patch("app.routers.abby._get_cost_tracker") as mock_tracker,
        ):
            mock_cost = MagicMock()
            mock_cost.is_budget_exhausted.return_value = False
            mock_tracker.return_value = mock_cost

            client.post("/abby/chat", json={
                "message": "Tell me more",
                "history": [
                    {"role": "user", "content": "Prior message"},
                    {"role": "assistant", "content": "Prior response"},
                ],
            })

        mock_ollama.assert_called_once()
        history_arg = mock_ollama.call_args.kwargs.get("history", [])
        # History must not be empty
        assert len(history_arg) == 2

    def test_regression_ollama_routing_when_claude_unavailable(self) -> None:
        """
        Bug: import anthropic at module level caused ImportError that
        prevented the entire abby router from loading — all /abby/* routes 404'd.
        Fix: conditional import with _ANTHROPIC_AVAILABLE flag.
        """
        # If the router is registered and returns 200, the import guard works.
        resp = _post_chat({"message": "test"})
        assert resp.status_code == 200
        # Must use local (Ollama) since no Claude API key is set in test env
        assert resp.json()["routing"]["model"] == "local"

    def test_regression_commons_ask_abby_page_context_not_rejected(self) -> None:
        """
        Bug: commons_ask_abby page_context fell through to the default/general
        system prompt without error — but the endpoint should never 422 on
        an unknown page_context, just use the general prompt.
        """
        resp = _post_chat({
            "message": "Cohort help",
            "page_context": "commons_ask_abby",
        })
        assert resp.status_code == 200
