"""Profile learner — extracts user research interests, preferences, and expertise from conversations.

Uses keyword extraction and regex patterns only (no LLM calls).
All operations follow immutable patterns — inputs are never mutated.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Domain keyword index — maps domain name → list of trigger keywords
# ---------------------------------------------------------------------------
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "diabetes": [
        "diabetes", "diabetic", "insulin", "glucose", "hba1c", "glycemic",
        "type 1", "type 2", "t1d", "t2d", "hyperglycemia", "hypoglycemia",
    ],
    "cardiovascular": [
        "cardiovascular", "cardiac", "heart", "coronary", "stroke", "atrial",
        "hypertension", "blood pressure", "myocardial", "infarction", "atherosclerosis",
    ],
    "oncology": [
        "cancer", "tumor", "tumour", "oncology", "malignancy", "chemotherapy",
        "radiation", "metastasis", "carcinoma", "leukemia", "lymphoma",
    ],
    "respiratory": [
        "asthma", "copd", "respiratory", "pulmonary", "lung", "emphysema",
        "bronchitis", "spirometry", "inhaler", "oxygen",
    ],
    "mental_health": [
        "depression", "anxiety", "mental health", "psychiatric", "schizophrenia",
        "bipolar", "adhd", "ptsd", "suicide", "psychosis",
    ],
    "epidemiology": [
        "incidence", "prevalence", "cohort", "exposure", "outcome", "hazard ratio",
        "odds ratio", "relative risk", "confidence interval", "p-value",
        "epidemiology", "epidemiological",
    ],
    "pharmacology": [
        "drug", "medication", "prescription", "adverse event", "side effect",
        "pharmacology", "dosage", "clinical trial", "efficacy", "pharmacokinetics",
    ],
    "genomics": [
        "genomics", "variant", "snp", "genome", "allele", "gwas", "mutation",
        "genetic", "chromosome", "sequencing", "vcf",
    ],
    "geriatrics": [
        "elderly", "geriatric", "aging", "older adult", "senescence",
        "dementia", "alzheimer", "frailty", "nursing home",
    ],
    "pediatrics": [
        "pediatric", "child", "infant", "neonatal", "adolescent", "newborn",
        "congenital", "birth defect",
    ],
}

# ---------------------------------------------------------------------------
# Verbosity / style preference indicators
# ---------------------------------------------------------------------------
TERSE_INDICATORS: list[re.Pattern] = [
    re.compile(r"just (give|show|tell|provide) me", re.IGNORECASE),
    re.compile(r"don'?t (need|want) (the )?(explanation|context|details|justification)", re.IGNORECASE),
    re.compile(r"skip (the )?(explanation|context|details|intro|preamble)", re.IGNORECASE),
    re.compile(r"(short|brief|concise|terse|quick)\s+(answer|response|version|summary)", re.IGNORECASE),
    re.compile(r"(only|just) (the )?(sql|code|query|answer|result)", re.IGNORECASE),
]

VERBOSE_INDICATORS: list[re.Pattern] = [
    re.compile(r"(explain|walk me through|describe|elaborate|tell me more)", re.IGNORECASE),
    re.compile(r"(why|how does|what is the reason)", re.IGNORECASE),
    re.compile(r"(step[- ]by[- ]step|in detail|thoroughly)", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Correction detection patterns
# ---------------------------------------------------------------------------
CORRECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"^no[,.]?\s+i meant", re.IGNORECASE),
    re.compile(r"^(actually|no)[,.]?\s+i (meant|said|was asking about)", re.IGNORECASE),
    re.compile(r"not\s+\w+[,.]?\s+i meant", re.IGNORECASE),
    re.compile(r"(i meant|i was thinking of|i wanted)\s+\w+", re.IGNORECASE),
    re.compile(r"^(wait|no)[,.]?\s+(that'?s not|i didn'?t mean)", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Expertise calibration signals
# ---------------------------------------------------------------------------
EXPERT_KEYWORDS: list[str] = [
    "phenotype", "omop", "cdm", "cohort definition", "concept set",
    "icd-10", "icd-9", "snomed", "rxnorm", "loinc",
    "hazard ratio", "propensity score", "incidence rate", "kaplan-meier",
    "negative binomial", "poisson regression",
]

BEGINNER_KEYWORDS: list[str] = [
    "what is a cohort", "what is omop", "what does", "can you explain",
    "i'm new to", "i don't understand", "i'm not sure what",
    "what is the difference between",
]

# ---------------------------------------------------------------------------
# Entity extraction for frequently used items
# ---------------------------------------------------------------------------
CONCEPT_SET_PATTERN = re.compile(
    r'(?:concept set|phenotype|cohort)[:\s]+"?([A-Za-z0-9_\- ]+)"?',
    re.IGNORECASE,
)
DATASET_PATTERN = re.compile(
    r'(?:dataset|database|data source)[:\s]+"?([A-Za-z0-9_\- ]+)"?',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# UserProfile dataclass
# ---------------------------------------------------------------------------
@dataclass
class UserProfile:
    """Immutable snapshot of a user's inferred research profile."""

    research_interests: list[str] = field(default_factory=list)
    expertise_domains: dict[str, float] = field(default_factory=dict)
    interaction_preferences: dict[str, Any] = field(default_factory=dict)
    frequently_used: dict[str, list[str]] = field(default_factory=dict)
    interaction_count: int = 0

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "research_interests": list(self.research_interests),
            "expertise_domains": dict(self.expertise_domains),
            "interaction_preferences": dict(self.interaction_preferences),
            "frequently_used": {k: list(v) for k, v in self.frequently_used.items()},
            "interaction_count": self.interaction_count,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UserProfile":
        return cls(
            research_interests=list(data.get("research_interests", [])),
            expertise_domains=dict(data.get("expertise_domains", {})),
            interaction_preferences=dict(data.get("interaction_preferences", {})),
            frequently_used={k: list(v) for k, v in data.get("frequently_used", {}).items()},
            interaction_count=int(data.get("interaction_count", 0)),
        )

    def get_context_string(self) -> str:
        """Return a short human-readable summary for use in LLM prompts."""
        parts: list[str] = []
        if self.research_interests:
            parts.append(f"Research interests: {', '.join(self.research_interests[:5])}")
        if self.expertise_domains:
            top = sorted(self.expertise_domains.items(), key=lambda x: x[1], reverse=True)[:3]
            parts.append(f"Expertise: {', '.join(f'{d}({s:.1f})' for d, s in top)}")
        verbosity = self.interaction_preferences.get("verbosity")
        if verbosity:
            parts.append(f"Prefers {verbosity} responses")
        return "; ".join(parts)


# ---------------------------------------------------------------------------
# ProfileLearner
# ---------------------------------------------------------------------------
class ProfileLearner:
    """Extracts and updates a UserProfile from conversation messages.

    All methods return new UserProfile objects — inputs are never mutated.
    """

    def __init__(self, min_interactions_for_calibration: int = 3) -> None:
        self.min_interactions_for_calibration = min_interactions_for_calibration

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def learn_from_conversation(
        self,
        profile: UserProfile,
        messages: list[dict[str, str]],
    ) -> UserProfile:
        """Return a NEW UserProfile enriched from the given messages.

        The original ``profile`` is NEVER mutated.
        """
        # Build a deep copy to work with
        new_profile = UserProfile.from_dict(profile.to_dict())
        new_profile = UserProfile(
            research_interests=list(new_profile.research_interests),
            expertise_domains=dict(new_profile.expertise_domains),
            interaction_preferences=dict(new_profile.interaction_preferences),
            frequently_used={k: list(v) for k, v in new_profile.frequently_used.items()},
            interaction_count=new_profile.interaction_count + len(
                [m for m in messages if m.get("role") == "user"]
            ),
        )

        # Extract only user messages for analysis
        user_messages = [m["content"] for m in messages if m.get("role") == "user"]
        combined_text = " ".join(user_messages)
        combined_lower = combined_text.lower()

        new_profile = self._learn_interests(new_profile, combined_lower)
        new_profile = self._learn_preferences(new_profile, user_messages)
        new_profile = self._learn_frequently_used(new_profile, combined_text)
        new_profile = self._calibrate_expertise(new_profile, combined_lower)

        return new_profile

    # ------------------------------------------------------------------
    # Private helpers — each returns a new UserProfile copy
    # ------------------------------------------------------------------

    def _learn_interests(self, profile: UserProfile, combined_lower: str) -> UserProfile:
        """Add domain interests detected in the lowercased text."""
        new_interests = list(profile.research_interests)
        for domain, keywords in DOMAIN_KEYWORDS.items():
            if any(kw in combined_lower for kw in keywords):
                # Use the first matching keyword as the interest label
                matched_kw = next(kw for kw in keywords if kw in combined_lower)
                label = matched_kw  # e.g. "diabetes", "type 2"
                if label not in new_interests:
                    new_interests.append(label)

        return UserProfile(
            research_interests=new_interests,
            expertise_domains=dict(profile.expertise_domains),
            interaction_preferences=dict(profile.interaction_preferences),
            frequently_used={k: list(v) for k, v in profile.frequently_used.items()},
            interaction_count=profile.interaction_count,
        )

    def _learn_preferences(
        self, profile: UserProfile, user_messages: list[str]
    ) -> UserProfile:
        """Detect verbosity preference and correction events."""
        new_prefs = dict(profile.interaction_preferences)

        terse_count = 0
        verbose_count = 0
        new_corrections: list[str] = list(new_prefs.get("corrections", []))

        for msg in user_messages:
            for pattern in TERSE_INDICATORS:
                if pattern.search(msg):
                    terse_count += 1
                    break
            for pattern in VERBOSE_INDICATORS:
                if pattern.search(msg):
                    verbose_count += 1
                    break
            for pattern in CORRECTION_PATTERNS:
                if pattern.search(msg):
                    new_corrections.append(msg[:120])
                    break

        if terse_count > verbose_count and terse_count > 0:
            new_prefs["verbosity"] = "terse"
        elif verbose_count > terse_count and verbose_count > 0:
            new_prefs["verbosity"] = "verbose"

        if new_corrections:
            new_prefs["corrections"] = new_corrections

        return UserProfile(
            research_interests=list(profile.research_interests),
            expertise_domains=dict(profile.expertise_domains),
            interaction_preferences=new_prefs,
            frequently_used={k: list(v) for k, v in profile.frequently_used.items()},
            interaction_count=profile.interaction_count,
        )

    def _learn_frequently_used(self, profile: UserProfile, combined_text: str) -> UserProfile:
        """Extract entity mentions (concept sets, datasets) from original-case text."""
        new_frequently_used = {k: list(v) for k, v in profile.frequently_used.items()}

        concept_matches = CONCEPT_SET_PATTERN.findall(combined_text)
        if concept_matches:
            existing = new_frequently_used.get("concept_sets", [])
            for match in concept_matches:
                cleaned = match.strip()
                if cleaned and cleaned not in existing:
                    existing.append(cleaned)
            new_frequently_used["concept_sets"] = existing

        dataset_matches = DATASET_PATTERN.findall(combined_text)
        if dataset_matches:
            existing = new_frequently_used.get("datasets", [])
            for match in dataset_matches:
                cleaned = match.strip()
                if cleaned and cleaned not in existing:
                    existing.append(cleaned)
            new_frequently_used["datasets"] = existing

        return UserProfile(
            research_interests=list(profile.research_interests),
            expertise_domains=dict(profile.expertise_domains),
            interaction_preferences=dict(profile.interaction_preferences),
            frequently_used=new_frequently_used,
            interaction_count=profile.interaction_count,
        )

    def _calibrate_expertise(self, profile: UserProfile, combined_lower: str) -> UserProfile:
        """Infer expertise level only after enough interactions have accumulated."""
        if profile.interaction_count < self.min_interactions_for_calibration:
            return profile

        expert_hits = sum(1 for kw in EXPERT_KEYWORDS if kw in combined_lower)
        beginner_hits = sum(1 for kw in BEGINNER_KEYWORDS if kw in combined_lower)

        if expert_hits == 0 and beginner_hits == 0:
            return profile

        total = expert_hits + beginner_hits
        score = expert_hits / total if total > 0 else 0.5

        new_domains = dict(profile.expertise_domains)
        current = new_domains.get("general", 0.5)
        # Exponential moving average for smooth updates
        new_domains["general"] = round(0.7 * current + 0.3 * score, 3)

        return UserProfile(
            research_interests=list(profile.research_interests),
            expertise_domains=new_domains,
            interaction_preferences=dict(profile.interaction_preferences),
            frequently_used={k: list(v) for k, v in profile.frequently_used.items()},
            interaction_count=profile.interaction_count,
        )
