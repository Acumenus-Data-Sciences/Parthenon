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


def test_rule_router_action_word_routes_to_cloud():
    from app.routing.rule_router import RuleRouter
    router = RuleRouter()
    result = router.route("Create a concept set for diabetes medications")
    assert result.model == "claude"
    assert result.stage == 1

def test_rule_router_greeting_routes_to_local():
    from app.routing.rule_router import RuleRouter
    router = RuleRouter()
    result = router.route("Hello Abby, how are you?")
    assert result.model == "local"

def test_phi_sanitizer_blocks_ssn():
    from app.routing.phi_sanitizer import PHISanitizer
    sanitizer = PHISanitizer(use_ner=False)
    result = sanitizer.scan("Patient SSN is 123-45-6789")
    assert result.phi_detected is True
    assert "123-45-6789" not in result.redacted_text

def test_phi_sanitizer_allows_clinical_content():
    from app.routing.phi_sanitizer import PHISanitizer
    sanitizer = PHISanitizer(use_ner=False)
    result = sanitizer.scan("What is the prevalence of Type 2 diabetes in patients over 65?")
    assert result.phi_detected is False

def test_cloud_safety_blocks_individual_data():
    from app.routing.cloud_safety import CloudSafetyFilter
    from app.memory.context_assembler import ContextPiece, ContextTier
    safety = CloudSafetyFilter()
    piece = ContextPiece(
        tier=ContextTier.LIVE,
        content="person_id: 12345, birth_datetime: 1965-03-15",
        relevance=0.8, tokens=50, source="cdm.person",
    )
    assert safety.is_cloud_safe(piece) is False

def test_context_assembler_claude_profile_accepts_large_context():
    from app.memory.context_assembler import ContextAssembler, ContextPiece, ContextTier
    assembler = ContextAssembler.for_model("claude")
    pieces = [
        ContextPiece(tier=ContextTier.WORKING, content="x" * 4000, relevance=1.0, tokens=4000),
        ContextPiece(tier=ContextTier.SEMANTIC, content="y" * 3000, relevance=0.7, tokens=3000),
        ContextPiece(tier=ContextTier.EPISODIC, content="z" * 2000, relevance=0.6, tokens=2000),
    ]
    result = assembler.assemble(pieces)
    assert len(result) == 3


def test_knowledge_graph_service_format_hierarchy():
    from app.knowledge.graph_service import KnowledgeGraphService
    from unittest.mock import MagicMock
    service = KnowledgeGraphService(engine=MagicMock(), redis_client=MagicMock())
    hierarchy = [
        {"concept_id": 4008576, "concept_name": "Diabetes mellitus", "domain_id": "Condition", "min_separation": 2},
        {"concept_id": 201820, "concept_name": "Type 2 DM", "domain_id": "Condition", "min_separation": 1},
    ]
    text = service.format_hierarchy(hierarchy, direction="ancestors")
    assert "Diabetes mellitus" in text
    assert "Type 2 DM" in text


def test_data_profile_format_warnings():
    from app.knowledge.data_profile import DataProfileService, DataGapWarning
    from unittest.mock import MagicMock
    service = DataProfileService(engine=MagicMock(), redis_client=MagicMock())
    warnings = [
        DataGapWarning(gap_type="sparse_domain", domain="Measurement",
                       severity="warning", message="Measurement has sparse data"),
    ]
    text = service.format_warnings(warnings)
    assert "Measurement" in text
    assert "DATA QUALITY" in text


def test_tool_registry_has_phase4_tools():
    from app.agency.tool_registry import ToolRegistry
    registry = ToolRegistry.default()
    assert registry.get("create_concept_set") is not None
    assert registry.get("create_cohort_definition") is not None
    assert registry.get("generate_cohort") is not None


def test_plan_engine_creates_valid_plan():
    from app.agency.plan_engine import PlanEngine, PlanStep, PlanStatus
    from unittest.mock import MagicMock
    engine = PlanEngine(action_logger=MagicMock(), api_client=MagicMock(), db_engine=MagicMock())
    plan = engine.create_plan(user_id=1, description="Test", steps=[
        {"tool_name": "create_concept_set", "parameters": {"name": "Test"}},
    ], auth_token="test-token")
    assert plan.status == PlanStatus.PENDING
    assert len(plan.steps) == 1


def test_action_logger_records_action():
    from app.agency.action_logger import ActionLogger
    from unittest.mock import MagicMock
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchone.return_value = (42,)
    al = ActionLogger(engine=mock_engine)
    result = al.log_action(user_id=1, action_type="create", tool_name="create_concept_set", risk_level="medium", parameters={"name": "Test"})
    assert result == 42
