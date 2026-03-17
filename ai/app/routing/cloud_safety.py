"""Cloud Safety Filter — allowlist-based protection for individual-level patient data.

Before assembling context for a cloud LLM (Claude), every ContextPiece must pass
through this filter. Pieces that contain individual-level CDM data are blocked;
aggregate, vocabulary, and institutional pieces are permitted.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.memory.context_assembler import ContextPiece


# ---------------------------------------------------------------------------
# Source allowlists / blocklists
# ---------------------------------------------------------------------------

# Sources that are explicitly safe to send to cloud models (aggregate / non-PHI)
CLOUD_SAFE_SOURCES: set[str] = {
    "help_docs",
    "faq_shared",
    "achilles_stats",
    "achilles_results",
    "dqd_summary",
    "dqd_results",
    "concept_lookup",
    "vocabulary",
    "snomed",
    "icd",
    "rxnorm",
    "loinc",
    "omop_vocabulary",
    "institutional_protocol",
    "shared_cohort_template",
    "user_preference",
    "working_memory",
    "page_context",
    "semantic_cache",
}

# Sources that contain individual-level clinical data — NEVER send to cloud
CLOUD_BLOCKED_SOURCES: set[str] = {
    # OMOP CDM clinical domain tables (individual-level)
    "cdm.person",
    "cdm.visit_occurrence",
    "cdm.visit_detail",
    "cdm.condition_occurrence",
    "cdm.drug_exposure",
    "cdm.procedure_occurrence",
    "cdm.device_exposure",
    "cdm.measurement",
    "cdm.observation",
    "cdm.note",
    "cdm.note_nlp",
    "cdm.specimen",
    "cdm.fact_relationship",
    "cdm.payer_plan_period",
    "cdm.cost",
    "cdm.drug_era",
    "cdm.dose_era",
    "cdm.condition_era",
    "cdm.episode",
    "cdm.episode_event",
    # Death and survey tables
    "cdm.death",
    "cdm.survey_conduct",
    # Raw / staging tables
    "raw.person",
    "raw.visit_occurrence",
    "raw.condition_occurrence",
    "staging.person",
    "staging.visit_occurrence",
}

# Regex patterns that indicate individual-level data in content
INDIVIDUAL_DATA_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bperson_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bvisit_occurrence_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bbirth_datetime\b", re.IGNORECASE),
    re.compile(r"\bpatient_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bsubject_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bcondition_occurrence_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bdrug_exposure_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bmeasurement_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bobservation_id\s*[=:]\s*\d+", re.IGNORECASE),
]


# ---------------------------------------------------------------------------
# Tier-based safety rules (imported lazily to avoid circular imports)
# ---------------------------------------------------------------------------

def _always_safe_tier(tier_value: str) -> bool:
    """Return True for tiers that are always safe to send to cloud models."""
    # These tiers are structurally safe (no patient data by design)
    # NOTE: "episodic" is intentionally excluded — episodic memories contain
    # user conversation history which may include PHI typed by users, so they
    # require content-level inspection before being sent to cloud models.
    always_safe_tiers = {"working", "page", "semantic", "institutional"}
    return tier_value in always_safe_tiers


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class CloudSafetyFilter:
    """Filters ContextPieces to remove individual-level data before cloud routing."""

    def is_cloud_safe(self, piece: "ContextPiece") -> bool:
        """Return True if the piece is safe to include in a cloud LLM prompt.

        Safety logic:
        1. Always-safe tiers (WORKING, PAGE, SEMANTIC, INSTITUTIONAL)
           pass unconditionally.
        2. EPISODIC tier pieces are scanned for individual-level data patterns
           (conversation history may contain PHI typed by users).
        3. LIVE tier pieces are checked against:
           a. Blocked source allowlist — any match → False
           b. Explicit safe sources → True
           c. Content pattern scan for individual data identifiers
        """
        tier_value = piece.tier.value  # e.g. "working", "live", "semantic"

        # Tier 1: always-safe tiers
        if _always_safe_tier(tier_value):
            return True

        # Tier 2: EPISODIC — conversation history may contain user-typed PHI
        if tier_value == "episodic":
            content = piece.content or ""
            for pattern in INDIVIDUAL_DATA_PATTERNS:
                if pattern.search(content):
                    return False
            return True

        # Tier 3: LIVE — requires source + content inspection
        source = (piece.source or "").strip().lower()

        # If source is explicitly blocked, reject immediately
        if source in CLOUD_BLOCKED_SOURCES:
            return False

        # If source is on the explicit safe allowlist, accept
        if source in CLOUD_SAFE_SOURCES:
            return True

        # Unknown source — scan content for individual-level data patterns
        content = piece.content or ""
        for pattern in INDIVIDUAL_DATA_PATTERNS:
            if pattern.search(content):
                return False

        # Default safe for unknown sources without individual-data patterns
        return True

    def filter_for_cloud(self, pieces: "list[ContextPiece]") -> "list[ContextPiece]":
        """Return only the pieces that pass the cloud safety check."""
        return [p for p in pieces if self.is_cloud_safe(p)]
