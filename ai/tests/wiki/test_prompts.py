from app.wiki.prompts import build_ingest_prompt, build_query_prompt


def test_build_ingest_prompt_includes_schema_and_source():
    prompt = build_ingest_prompt("schema text", "platform", "Paper A", "source body")
    assert "schema text" in prompt
    assert "Paper A" in prompt
    assert "source body" in prompt


def test_build_query_prompt_includes_question_and_context():
    prompt = build_query_prompt("What changed?", "# Page\nContext", "Paper A")
    assert "What changed?" in prompt
    assert "# Page" in prompt
    assert "Paper A" in prompt
