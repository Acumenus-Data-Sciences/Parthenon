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


def test_prompt_includes_working_and_episodic_memory():
    """Prompt builder injects explicit session memory and Chroma user history."""
    from app.memory.intent_stack import IntentStack
    from app.memory.scratch_pad import ScratchPad
    from app.routers.abby import ChatRequest, _build_chat_system_prompt

    intent_stack = IntentStack()
    intent_stack.push("diabetes cohort building", turn=1)
    scratch_pad = ScratchPad()
    scratch_pad.store("draft_sql", "SELECT COUNT(*) FROM omop.person")

    request = ChatRequest(
        message="How should I refine it?",
        page_context="cohort_builder",
        user_id=42,
    )
    session = {
        "intent_stack": intent_stack,
        "scratch_pad": scratch_pad,
        "turn": 1,
    }

    with (
        patch("app.routers.abby._get_help_context", return_value=""),
        patch("app.routers.abby.build_rag_context", return_value=""),
        patch("app.routers.abby._should_skip_live_context", return_value=True),
        patch("app.routers.abby._should_include_data_quality_context", return_value=False),
        patch("app.routers.abby._should_include_institutional_context", return_value=False),
        patch(
            "app.routers.abby.query_user_conversations",
            return_value=[
                {
                    "text": "Q: What washout should I use?\nA: We typically start with 180 days for claims data.",
                    "page_context": "cohort_builder",
                }
            ],
        ),
    ):
        prompt = _build_chat_system_prompt(request, model_profile="medgemma", session=session)

    assert "Active conversation topics: diabetes cohort building" in prompt
    assert "Working scratch pad:" in prompt
    assert "User History" in prompt
    assert "Relevant prior Abby conversations:" in prompt


def test_stream_chat_persists_memory_after_completion():
    """Streaming chat should update Abby memory just like the non-streaming route."""

    async def fake_stream_ollama(*, on_complete=None, **_kwargs):
        if on_complete is not None:
            on_complete("Stored streamed answer.", ["What next?"])
        yield 'data: {"token": "Stored streamed answer."}\n\n'
        yield 'data: [DONE]\n\n'

    with (
        patch("app.routers.abby._build_chat_system_prompt", return_value="You are Abby."),
        patch("app.routers.abby._stream_ollama", new=fake_stream_ollama),
        patch("app.routers.abby.store_conversation_turn") as mock_store,
        patch("app.routers.abby._fetch_user_profile", return_value=None),
        patch("app.routers.abby._save_user_profile"),
    ):
        resp = client.post("/abby/chat/stream", json={
            "message": "Remember this answer",
            "page_context": "general",
            "user_id": 42,
        })

    assert resp.status_code == 200
    assert "[DONE]" in resp.text
    mock_store.assert_called_once_with(
        user_id=42,
        question="Remember this answer",
        answer="Stored streamed answer.",
        page_context="general",
    )


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


# ---------------------------------------------------------------------------
# Phase 5 integration tests (Task 6)
# ---------------------------------------------------------------------------


def test_dag_parallel_waves() -> None:
    """Two independent steps should form 1 wave; a dependent step forms wave 2."""
    from app.agency.dag_executor import DAGPlan, DAGStep

    steps = [
        DAGStep(id="a", tool_name="create_concept_set", parameters={}),
        DAGStep(id="b", tool_name="create_cohort_definition", parameters={}),
        DAGStep(id="c", tool_name="generate_cohort", parameters={}, depends_on=["a", "b"]),
    ]
    plan = DAGPlan(steps=steps)
    waves = plan.get_execution_waves()

    assert len(waves) == 2
    assert {s.id for s in waves[0]} == {"a", "b"}
    assert {s.id for s in waves[1]} == {"c"}


def test_dry_run_simulates_plan() -> None:
    """DryRunSimulator should mark all steps as simulated=True."""
    from app.agency.dag_executor import DAGStep
    from app.agency.dry_run import DryRunSimulator

    steps = [
        DAGStep(id="s1", tool_name="create_concept_set", parameters={"name": "Diabetes"}),
        DAGStep(id="s2", tool_name="generate_cohort", parameters={"cohort_id": 1}),
    ]
    simulator = DryRunSimulator()
    results = simulator.simulate_plan(steps)

    assert len(results) == 2
    assert all(r.get("simulated") is True for r in results)


def test_sql_safety_blocks_dml() -> None:
    """validate_sql_safety should allow SELECT and block DROP."""
    from app.agency.tools.sql_tools import validate_sql_safety

    assert validate_sql_safety("SELECT * FROM cdm.person LIMIT 10") is True
    assert validate_sql_safety("DROP TABLE cdm.person") is False


def test_workflow_template_generates_steps() -> None:
    """incident_cohort template should return >= 3 steps."""
    from app.agency.workflow_templates import WorkflowTemplates

    steps = WorkflowTemplates.incident_cohort(
        condition_name="Diabetes",
        condition_concepts=[201826],
        drug_name="Metformin",
        drug_concepts=[6809],
    )
    assert len(steps) >= 3


# ---------------------------------------------------------------------------
# Phase 6 integration tests (Task 6)
# ---------------------------------------------------------------------------


def test_knowledge_capture_creates_artifact():
    from app.institutional.knowledge_capture import KnowledgeCapture
    from unittest.mock import MagicMock
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchone.return_value = (1,)
    kc = KnowledgeCapture(engine=mock_engine, embedder=None)
    artifact = kc.capture_cohort_creation(user_id=1, cohort_name="Test",
        concept_ids=[201826], expression_summary="Entry: diabetes")
    assert artifact.artifact_type == "cohort_pattern"

def test_knowledge_surfacer_formats_suggestions():
    from app.institutional.knowledge_surfacing import KnowledgeSurfacer
    from unittest.mock import MagicMock
    surfacer = KnowledgeSurfacer(knowledge_capture=MagicMock())
    text = surfacer.format_for_prompt([
        {"id": 1, "type": "cohort_pattern", "title": "T2DM", "summary": "Diabetes cohort", "usage_count": 3},
    ])
    assert "INSTITUTIONAL KNOWLEDGE" in text
    assert "T2DM" in text

def test_faq_promoter_threshold():
    from app.institutional.faq_promoter import FAQPromoter
    from unittest.mock import MagicMock
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchone.return_value = (1,)
    faq = FAQPromoter(engine=mock_engine, threshold=3)
    assert faq.check_and_promote("rare question", "answer") is False
