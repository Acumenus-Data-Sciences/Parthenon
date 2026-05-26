import pytest

from app.agents.profiles import get_profile, STUDY_DESIGN
from app.config import settings


def test_study_design_profile_locks_model_and_effort():
    p = get_profile("study_design")
    assert p.name == "study_design"
    assert p.model == "claude-opus-4-7"
    assert p.effort == "xhigh"
    assert "study" in p.system_prompt.lower()


def test_unknown_profile_raises():
    with pytest.raises(KeyError):
        get_profile("does-not-exist")


def test_publish_profile_model_and_effort():
    p = get_profile("publish")
    assert p.name == "publish"
    assert p.model == settings.agent_model
    assert p.effort == settings.agent_effort


def test_publish_profile_system_prompt_mentions_imrad_and_manuscript():
    p = get_profile("publish")
    prompt_lower = p.system_prompt.lower()
    assert "imrad" in prompt_lower or "manuscript" in prompt_lower


def test_publish_profile_system_prompt_prohibits_inventing_data():
    p = get_profile("publish")
    prompt_lower = p.system_prompt.lower()
    assert "never invent" in prompt_lower


def test_publish_profile_system_prompt_prohibits_filesystem_access():
    p = get_profile("publish")
    assert "filesystem" in p.system_prompt.lower()
