"""Tests for RAG integration in Abby chat endpoint."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_chat_includes_rag_context_in_system_prompt():
    """Chat endpoint injects RAG context into the system prompt."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = "\n\nKNOWLEDGE BASE:\n- Some doc content"
        mock_ollama.return_value = "Here's the answer.\nSUGGESTIONS: [\"Next?\"]"

        resp = client.post("/abby/chat", json={
            "message": "How do I build a cohort?",
            "page_context": "cohort_builder",
        })

    assert resp.status_code == 200
    mock_rag.assert_called_once()
    # Verify system prompt passed to Ollama includes RAG content
    call_args = mock_ollama.call_args
    system_prompt = call_args.kwargs.get("system_prompt", "") or (call_args.args[0] if call_args.args else "")
    assert "KNOWLEDGE BASE" in system_prompt


def test_chat_works_without_rag_context():
    """Chat still works when RAG returns no results (graceful degradation)."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = ""
        mock_ollama.return_value = "I can help.\nSUGGESTIONS: [\"More?\"]"

        resp = client.post("/abby/chat", json={
            "message": "Hello",
            "page_context": "general",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "I can help" in data["reply"]


def test_context_assembler_produces_structured_prompt():
    """Verify the context assembler integrates with the existing RAG pipeline."""
    from app.memory.context_assembler import ContextAssembler, ContextPiece, ContextTier

    assembler = ContextAssembler.for_medgemma()
    pieces = [
        ContextPiece(tier=ContextTier.WORKING, content="User is building a diabetes cohort", relevance=1.0, tokens=50),
        ContextPiece(tier=ContextTier.SEMANTIC, content="Diabetes mellitus is a metabolic disease", relevance=0.7, tokens=50),
        ContextPiece(tier=ContextTier.EPISODIC, content="User has expertise in endocrinology", relevance=0.6, tokens=30),
    ]
    result = assembler.assemble(pieces)
    prompt = assembler.format_prompt(result)

    assert "Working Memory" in prompt
    assert "Domain Knowledge" in prompt
    assert "User History" in prompt
    assert "diabetes" in prompt.lower()


def test_intent_stack_serialization_across_turns():
    """Verify intent stack can persist across conversation turns."""
    from app.memory.intent_stack import IntentStack

    stack = IntentStack(max_depth=3, expiry_turns=10)
    stack.push("diabetes cohort building", turn=1)
    stack.push("metformin concept search", turn=2)

    serialized = stack.to_dict()
    restored = IntentStack.from_dict(serialized)

    assert restored.current_topic() == "metformin concept search"
    assert len(restored) == 2
    assert "diabetes" in restored.get_context_string()


def test_profile_learner_end_to_end():
    """Verify profile learner extracts meaningful data from realistic conversation."""
    from app.memory.profile_learner import ProfileLearner, UserProfile

    learner = ProfileLearner(min_interactions_for_calibration=1)
    profile = UserProfile()

    messages = [
        {"role": "user", "content": "I'm building a cohort for incident Type 2 diabetes patients on metformin"},
        {"role": "assistant", "content": "I can help with that. Let me find the relevant concepts..."},
        {"role": "user", "content": "Just give me the concept IDs, I don't need the explanation"},
        {"role": "assistant", "content": "SNOMED 201826, RxNorm 6809..."},
    ]

    updated = learner.learn_from_conversation(profile, messages)

    assert "diabetes" in updated.research_interests
    assert updated.interaction_preferences.get("verbosity") == "terse"
    assert updated.interaction_count == 2  # 2 user messages in the conversation
