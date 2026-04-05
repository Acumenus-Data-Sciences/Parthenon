"""FAQ promotion — clusters frequent Abby questions into the shared FAQ collection.

Nightly batch jobs scan recent Abby conversation memory, find semantically
similar questions, and promote clusters that meet the threshold
(>= 5 occurrences, >= 3 distinct users).
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.chroma.collections import get_conversation_memory_collection, get_faq_collection

logger = logging.getLogger(__name__)

MIN_FREQUENCY = 5
MIN_USERS = 3
SIMILARITY_THRESHOLD = 0.85


def _scan_recent_conversations(days: int = 7) -> list[dict]:
    """Scan shared Abby conversation memory for recent Q&A pairs."""
    collection = get_conversation_memory_collection()
    recent_pairs: list[dict] = []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    entries = collection.get(include=["documents", "metadatas"])
    docs_list = entries.get("documents") or []
    meta_list = entries.get("metadatas") or []

    for doc, meta in zip(docs_list, meta_list):
        meta = meta or {}
        ts = str(meta.get("timestamp", ""))
        if ts < cutoff:
            continue

        doc_str = doc if doc is not None else ""
        lines = doc_str.split("\n", 1)
        question = lines[0].removeprefix("Q: ") if lines else doc_str
        answer = lines[1].removeprefix("A: ") if len(lines) > 1 else ""
        recent_pairs.append({
            "question": question,
            "answer": answer,
            "user_id": int(meta.get("user_id", 0) or 0),
        })

    return recent_pairs


def promote_frequent_questions(days: int = 7) -> dict[str, int]:
    """Scan recent conversations and promote frequent Q&A pairs to FAQ.

    Returns stats: {"scanned": N, "promoted": N}
    """
    pairs = _scan_recent_conversations(days)
    stats = {"scanned": len(pairs), "promoted": 0}

    if len(pairs) < MIN_FREQUENCY:
        return stats

    faq_collection = get_faq_collection()

    # Simple clustering: group by first question, then check similarity
    clusters: list[dict[str, Any]] = []

    for pair in pairs:
        matched = False
        for cluster in clusters:
            # Check if question is similar to cluster representative
            try:
                results = faq_collection.query(
                    query_texts=[pair["question"]],
                    n_results=1,
                )
                distances = results.get("distances")
                if distances and distances[0] and distances[0][0] < (1 - SIMILARITY_THRESHOLD):
                    cluster["answers"].append(pair["answer"])
                    cluster["user_ids"].add(pair["user_id"])
                    matched = True
                    break
            except Exception:
                pass

        if not matched:
            clusters.append({
                "question": pair["question"],
                "answers": [pair["answer"]],
                "user_ids": {pair["user_id"]},
            })

    # Promote clusters meeting thresholds
    for cluster in clusters:
        freq = len(cluster["answers"])
        user_count = len(cluster["user_ids"])
        if freq >= MIN_FREQUENCY and user_count >= MIN_USERS:
            canonical_answer = cluster["answers"][0]
            doc = f"Q: {cluster['question']}\nA: {canonical_answer}"
            doc_id = f"faq_{uuid.uuid4().hex[:12]}"

            faq_collection.upsert(
                ids=[doc_id],
                documents=[doc],
                metadatas=[{
                    "frequency": freq,
                    "source_users_count": user_count,
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "source": "auto_promoted",
                }],
            )
            stats["promoted"] += 1
            logger.info("Promoted FAQ: %s (freq=%d, users=%d)", cluster["question"][:50], freq, user_count)

    return stats


def seed_demo_faqs() -> dict[str, int]:
    """Seed the FAQ collection with representative OHDSI Q&A pairs.

    Provides initial FAQ entries so the collection is useful before
    enough organic conversations accumulate for auto-promotion.
    Returns stats: {"seeded": N, "skipped": N}
    """
    faq_collection = get_faq_collection()
    stats = {"seeded": 0, "skipped": 0}

    demo_faqs = [
        {
            "question": "What is the OMOP Common Data Model?",
            "answer": "The OMOP CDM is a standardized data model for observational health data. It maps diverse source data into a common format with standard vocabularies, enabling consistent analytics across institutions.",
        },
        {
            "question": "How do I create a cohort definition?",
            "answer": "Use the Cohort Builder to define inclusion/exclusion criteria. Start with an initial event (e.g., condition occurrence), add qualifying criteria, and set observation period requirements. The definition is stored as a JSON expression.",
        },
        {
            "question": "What is the difference between a concept and a concept_id?",
            "answer": "A concept_id is the numeric identifier for a concept in the OMOP vocabulary. A concept includes the id plus its name, domain, vocabulary, class, and standard/non-standard status.",
        },
        {
            "question": "How do I map source codes to standard concepts?",
            "answer": "Use the Concept Mapping tool. Upload your source codes and Abby will suggest OMOP standard concept mappings with confidence scores. Review and approve the mappings, then apply them to your ETL.",
        },
        {
            "question": "What are HADES packages?",
            "answer": "HADES (Health Analytics Data-to-Evidence Suite) is a set of R packages by OHDSI for large-scale analytics: CohortMethod for causal inference, PatientLevelPrediction for ML models, CohortDiagnostics for cohort evaluation, and more.",
        },
        {
            "question": "How do I run a characterization analysis?",
            "answer": "Go to Analyses, create a new characterization study, select your target cohort, choose the features to characterize (demographics, conditions, drugs, etc.), and execute. Results appear in the Results Explorer.",
        },
        {
            "question": "What is Achilles and what does it do?",
            "answer": "Achilles generates descriptive statistics for your OMOP CDM database — record counts, distributions, data quality checks. It runs automated analyses across all CDM tables and stores results for the Data Quality Dashboard.",
        },
        {
            "question": "How do I check data quality?",
            "answer": "The Data Quality Dashboard (DQD) runs automated checks on your CDM data: completeness, conformance, plausibility, and temporal checks. Run Achilles first, then DQD to identify issues.",
        },
    ]

    for faq in demo_faqs:
        doc_id = f"faq_seed_{faq['question'][:30].replace(' ', '_').lower()}"
        existing = faq_collection.get(ids=[doc_id], include=[])
        if existing.get("ids"):
            stats["skipped"] += 1
            continue

        doc = f"Q: {faq['question']}\nA: {faq['answer']}"
        faq_collection.upsert(
            ids=[doc_id],
            documents=[doc],
            metadatas=[{
                "frequency": 0,
                "source_users_count": 0,
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "source": "seed",
            }],
        )
        stats["seeded"] += 1

    logger.info("FAQ seeding complete: %s", stats)
    return stats
