"""Tests for the profile learner — extracts user research profile from conversations."""
import pytest
from app.memory.profile_learner import ProfileLearner, UserProfile


class TestProfileLearner:
    def test_extract_research_interest(self):
        learner = ProfileLearner()
        profile = UserProfile()
        messages = [
            {"role": "user", "content": "I'm studying incident diabetes in elderly populations"},
            {"role": "assistant", "content": "I can help with that..."},
        ]
        updated = learner.learn_from_conversation(profile, messages)
        assert any("diabetes" in interest.lower() for interest in updated.research_interests)

    def test_extract_preference_terse(self):
        learner = ProfileLearner()
        profile = UserProfile()
        messages = [
            {"role": "user", "content": "just give me the SQL, I don't need the explanation"},
            {"role": "assistant", "content": "SELECT..."},
        ]
        updated = learner.learn_from_conversation(profile, messages)
        assert updated.interaction_preferences.get("verbosity") == "terse"

    def test_extract_correction(self):
        learner = ProfileLearner()
        profile = UserProfile()
        messages = [
            {"role": "user", "content": "no, I meant Type 2 diabetes specifically, not Type 1"},
            {"role": "assistant", "content": "I see..."},
        ]
        updated = learner.learn_from_conversation(profile, messages)
        corrections = updated.interaction_preferences.get("corrections", [])
        assert len(corrections) > 0

    def test_expertise_calibration_requires_min_interactions(self):
        learner = ProfileLearner(min_interactions_for_calibration=5)
        profile = UserProfile()
        messages = [
            {"role": "user", "content": "What is a cohort?"},
            {"role": "assistant", "content": "A cohort is..."},
        ]
        updated = learner.learn_from_conversation(profile, messages)
        assert updated.expertise_domains.get("general") is None

    def test_does_not_mutate_input_profile(self):
        learner = ProfileLearner()
        original = UserProfile(research_interests=["existing"])
        messages = [{"role": "user", "content": "studying diabetes"}, {"role": "assistant", "content": "ok"}]
        updated = learner.learn_from_conversation(original, messages)
        assert "existing" in original.research_interests
        assert len(original.research_interests) == 1  # original unchanged

    def test_profile_serialization(self):
        profile = UserProfile(
            research_interests=["diabetes", "cardiovascular"],
            expertise_domains={"epidemiology": 0.8},
            interaction_preferences={"verbosity": "normal"},
            frequently_used={"concept_sets": ["diabetes_t2"]},
        )
        data = profile.to_dict()
        restored = UserProfile.from_dict(data)
        assert restored.research_interests == profile.research_interests
        assert restored.expertise_domains == profile.expertise_domains
