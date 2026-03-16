"""Live database context for Abby — queries Parthenon's PostgreSQL backend.

Provides Abby with awareness of what actually exists in the platform:
concept sets, cohort definitions, analyses, and data sources. Only queries
when the user's message signals intent to ask about existing data (keyword
detection), keeping Abby's context window clean for other queries.
"""
import logging
import re
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialized engine (connection pooled)
_engine: Engine | None = None


def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(settings.database_url, pool_size=2, pool_pre_ping=True)
    return _engine


# Keywords that signal the user wants to know about existing platform data.
# If none match, we skip the database query entirely (no context window cost).
_INTENT_PATTERNS = [
    # Concept sets
    re.compile(r"\b(concept\s*set|concept.set)\b", re.I),
    # Cohorts
    re.compile(r"\b(cohort|cohort\s*definition)\b", re.I),
    # Analyses / studies
    re.compile(r"\b(analys[ei]s|stud(?:y|ies)|characterization|incidence|estimation|prediction|pathway)\b", re.I),
    # Data sources
    re.compile(r"\b(data\s*source|database|CDM\s*source|source\s*daimon)\b", re.I),
    # Existence questions
    re.compile(r"\b(do\s+we\s+have|what.*(?:exist|defined|available|created|built|set\s*up))\b", re.I),
    # Listing / searching
    re.compile(r"\b(list|show|find|search|look\s*up|which|how\s*many)\b.*\b(concept|cohort|analys|stud)", re.I),
]


def _message_needs_db_context(message: str) -> bool:
    """Check if the user's message signals intent to query platform data."""
    return any(p.search(message) for p in _INTENT_PATTERNS)


def query_live_context(message: str, page_context: str) -> str:
    """Query the Parthenon database for relevant platform entities.

    Returns a formatted context string for injection into Abby's system prompt,
    or empty string if the query doesn't need database context.
    """
    if not _message_needs_db_context(message):
        return ""

    sections: list[str] = []
    keywords = _extract_search_terms(message)

    # Detect "list all" / "show all" intent — query without keyword filter
    is_list_all = bool(re.search(r"\b(list|show|all)\b.*\b(concept|cohort|analy)", message, re.I))

    try:
        engine = _get_engine()
        search_terms = [] if is_list_all else keywords

        # Query concept sets (with item counts and concept names)
        cs_results = _query_concept_sets(engine, search_terms)
        if cs_results:
            sections.append(_format_concept_sets(cs_results))

        # Query cohort definitions
        cd_results = _query_cohort_definitions(engine, search_terms)
        if cd_results:
            sections.append(_format_cohort_definitions(cd_results))

        # Query analysis executions
        ax_results = _query_analyses(engine, search_terms)
        if ax_results:
            sections.append(_format_analyses(ax_results))

    except Exception as e:
        logger.warning("Live database context query failed: %s", e)
        return ""

    if not sections:
        # Signal that we checked but found nothing
        return (
            "\n\nLIVE PLATFORM DATA (queried just now):\n"
            "No matching concept sets, cohort definitions, or analyses found "
            "in the current Parthenon instance for this query."
        )

    return (
        "\n\nLIVE PLATFORM DATA (queried just now from the Parthenon database):\n\n"
        + "\n\n".join(sections)
    )


def _extract_search_terms(message: str) -> list[str]:
    """Extract clinically meaningful search terms from the user's message.

    Strips common filler words and returns terms useful for ILIKE matching.
    """
    # Remove common question words and filler
    cleaned = re.sub(
        r"\b(do|we|have|what|which|are|is|the|a|an|any|our|my|"
        r"can|you|find|show|list|tell|me|about|for|in|on|of|"
        r"related|relevant|defined|existing|available|created|"
        r"concept\s*sets?|cohort\s*definitions?|cohorts?|analyses)\b",
        " ", message, flags=re.I,
    )
    # Strip punctuation and keep meaningful words (3+ chars)
    terms = [re.sub(r'[^\w\-]', '', w).strip() for w in cleaned.split()]
    terms = [t for t in terms if len(t) >= 3]
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in terms:
        lower = t.lower()
        if lower not in seen:
            seen.add(lower)
            unique.append(t)
    return unique[:5]  # Cap to avoid overly complex queries


def _query_concept_sets(engine: Engine, keywords: list[str]) -> list[dict[str, Any]]:
    """Query concept sets matching keywords, with item counts and concept names."""
    if not keywords:
        # No keywords: return all concept sets (they're few enough)
        query = text("""
            SELECT cs.id, cs.name, cs.description,
                   COUNT(csi.id) as item_count,
                   STRING_AGG(DISTINCT c.concept_name, ', ' ORDER BY c.concept_name) as concept_names
            FROM app.concept_sets cs
            LEFT JOIN app.concept_set_items csi ON csi.concept_set_id = cs.id
            LEFT JOIN omop.concept c ON c.concept_id = csi.concept_id
            WHERE cs.deleted_at IS NULL
            GROUP BY cs.id, cs.name, cs.description
            ORDER BY cs.name
            LIMIT 20
        """)
        with engine.connect() as conn:
            return [dict(r._mapping) for r in conn.execute(query)]

    # Build keyword filter
    conditions = " OR ".join(
        f"(cs.name ILIKE :kw{i} OR cs.description ILIKE :kw{i})"
        for i in range(len(keywords))
    )
    params = {f"kw{i}": f"%{kw}%" for i, kw in enumerate(keywords)}

    query = text(f"""
        SELECT cs.id, cs.name, cs.description,
               COUNT(csi.id) as item_count,
               STRING_AGG(DISTINCT c.concept_name, ', ' ORDER BY c.concept_name) as concept_names
        FROM app.concept_sets cs
        LEFT JOIN app.concept_set_items csi ON csi.concept_set_id = cs.id
        LEFT JOIN omop.concept c ON c.concept_id = csi.concept_id
        WHERE cs.deleted_at IS NULL AND ({conditions})
        GROUP BY cs.id, cs.name, cs.description
        ORDER BY cs.name
        LIMIT 20
    """)
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(query, params)]


def _query_cohort_definitions(engine: Engine, keywords: list[str]) -> list[dict[str, Any]]:
    """Query cohort definitions matching keywords."""
    if not keywords:
        query = text("""
            SELECT id, name, description, version, created_at
            FROM app.cohort_definitions
            WHERE deleted_at IS NULL
            ORDER BY name
            LIMIT 20
        """)
        with engine.connect() as conn:
            return [dict(r._mapping) for r in conn.execute(query)]

    conditions = " OR ".join(
        f"(cd.name ILIKE :kw{i} OR cd.description ILIKE :kw{i})"
        for i in range(len(keywords))
    )
    params = {f"kw{i}": f"%{kw}%" for i, kw in enumerate(keywords)}

    query = text(f"""
        SELECT cd.id, cd.name, cd.description, cd.version, cd.created_at
        FROM app.cohort_definitions cd
        WHERE cd.deleted_at IS NULL AND ({conditions})
        ORDER BY cd.name
        LIMIT 20
    """)
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(query, params)]


def _query_analyses(engine: Engine, keywords: list[str]) -> list[dict[str, Any]]:
    """Query analysis executions matching keywords."""
    try:
        if not keywords:
            query = text("""
                SELECT id, name, analysis_type, status, created_at
                FROM app.analysis_executions
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 10
            """)
        else:
            conditions = " OR ".join(
                f"(name ILIKE :kw{i})" for i in range(len(keywords))
            )
            params = {f"kw{i}": f"%{kw}%" for i, kw in enumerate(keywords)}
            query = text(f"""
                SELECT id, name, analysis_type, status, created_at
                FROM app.analysis_executions
                WHERE deleted_at IS NULL AND ({conditions})
                ORDER BY created_at DESC
                LIMIT 10
            """)

        with engine.connect() as conn:
            if keywords:
                return [dict(r._mapping) for r in conn.execute(query, params)]
            return [dict(r._mapping) for r in conn.execute(query)]
    except Exception:
        # Table might not exist yet
        return []


def _format_concept_sets(results: list[dict[str, Any]]) -> str:
    """Format concept set query results for the system prompt."""
    lines = ["**Concept Sets in Parthenon:**"]
    for r in results:
        name = r["name"]
        desc = r.get("description", "") or ""
        count = r.get("item_count", 0)
        concepts = r.get("concept_names", "") or ""
        line = f"- **{name}** ({count} concepts)"
        if desc:
            line += f" — {desc}"
        if concepts:
            line += f"\n  Concepts: {concepts}"
        lines.append(line)
    return "\n".join(lines)


def _format_cohort_definitions(results: list[dict[str, Any]]) -> str:
    """Format cohort definition results for the system prompt."""
    lines = ["**Cohort Definitions in Parthenon:**"]
    for r in results:
        name = r["name"]
        desc = r.get("description", "") or ""
        version = r.get("version", 1)
        line = f"- **{name}** (v{version})"
        if desc:
            line += f" — {desc}"
        lines.append(line)
    return "\n".join(lines)


def _format_analyses(results: list[dict[str, Any]]) -> str:
    """Format analysis execution results for the system prompt."""
    lines = ["**Analyses in Parthenon:**"]
    for r in results:
        name = r.get("name", "Unnamed")
        atype = r.get("analysis_type", "unknown")
        status = r.get("status", "unknown")
        lines.append(f"- **{name}** (type: {atype}, status: {status})")
    return "\n".join(lines)
