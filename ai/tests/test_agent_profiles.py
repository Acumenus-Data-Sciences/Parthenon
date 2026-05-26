from app.agents.profiles import get_profile, STUDY_DESIGN


def test_study_design_profile_locks_model_and_effort():
    p = get_profile("study_design")
    assert p.name == "study_design"
    assert p.model == "claude-opus-4-7"
    assert p.effort == "xhigh"
    assert "study" in p.system_prompt.lower()


def test_unknown_profile_raises():
    import pytest

    with pytest.raises(KeyError):
        get_profile("does-not-exist")
