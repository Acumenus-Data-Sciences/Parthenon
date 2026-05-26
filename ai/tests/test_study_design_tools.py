import httpx
import respx

from app.agents.study_design_tools import StudyDesignToolContext, build_tool_pack

BASE = "http://nginx:80/api/v1"


def _ctx() -> StudyDesignToolContext:
    return StudyDesignToolContext(
        study_slug="t2dm-study",
        design_session_id=7,
        version_id=3,
        auth_token="scoped-token-xyz",
    )


def _ctx_no_version() -> StudyDesignToolContext:
    return StudyDesignToolContext(
        study_slug="t2dm-study",
        design_session_id=7,
        version_id=None,
        auth_token="scoped-token-xyz",
    )


@respx.mock
async def test_version_scoped_tools_error_cleanly_without_a_version():
    # No HTTP route registered: if a tool built `versions/None` and called out,
    # respx would raise. Instead each version-scoped tool must short-circuit.
    tools = {t.name: t for t in build_tool_pack(_ctx_no_version())}
    for name in ("get_guidance", "recommend_phenotypes", "draft_concept_sets"):
        args = {"drafts": []} if name == "draft_concept_sets" else {}
        result = await tools[name].handler(args)
        assert result.get("is_error") is True
        assert "version" in result["content"][0]["text"].lower()


@respx.mock
async def test_search_concepts_calls_vocabulary_search():
    route = respx.get(f"{BASE}/vocabulary/search").mock(
        return_value=httpx.Response(200, json={"data": [{"concept_id": 201826, "concept_name": "Type 2 diabetes mellitus"}], "total": 1})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["search_concepts"].handler({"query": "type 2 diabetes", "limit": 5})

    assert route.called
    sent = route.calls.last.request
    assert sent.headers["authorization"] == "Bearer scoped-token-xyz"
    assert "type 2 diabetes" in sent.url.params["q"]
    assert "Type 2 diabetes mellitus" in result["content"][0]["text"]


@respx.mock
async def test_get_guidance_uses_nested_path():
    respx.get(f"{BASE}/studies/t2dm-study/design-sessions/7/versions/3/guidance").mock(
        return_value=httpx.Response(200, json={"data": {"initial_gate": {"status": "blocked"}}})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_guidance"].handler({})
    assert "blocked" in result["content"][0]["text"]


@respx.mock
async def test_draft_concept_sets_posts_validated_shape():
    route = respx.post(f"{BASE}/studies/t2dm-study/design-sessions/7/versions/3/concept-sets/draft").mock(
        return_value=httpx.Response(201, json={"data": [{"id": 99, "title": "T2DM"}]})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    drafts = [{"title": "T2DM", "concepts": [{"concept_id": 201826, "include_descendants": True}]}]
    result = await tools["draft_concept_sets"].handler({"drafts": drafts})
    assert route.called
    assert route.calls.last.request.method == "POST"
    assert "T2DM" in result["content"][0]["text"]


@respx.mock
async def test_tool_returns_error_content_on_http_failure():
    respx.get(f"{BASE}/vocabulary/search").mock(return_value=httpx.Response(403, json={"message": "Forbidden"}))
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["search_concepts"].handler({"query": "x"})
    assert result.get("is_error") is True
    assert "403" in result["content"][0]["text"]
