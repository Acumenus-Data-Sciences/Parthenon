from app.config import Settings


def test_agent_settings_have_expected_defaults():
    s = Settings()
    assert s.agent_model == "claude-opus-4-7"
    assert s.agent_effort == "xhigh"
    assert s.agent_max_turns == 24
    assert s.agent_max_budget_usd == 5.0
    assert s.agent_max_concurrent_turns == 4
    # Reverb defaults target the internal reverb container
    assert s.reverb_host == "reverb"
    assert s.reverb_port == 8080
    assert s.reverb_scheme == "http"
