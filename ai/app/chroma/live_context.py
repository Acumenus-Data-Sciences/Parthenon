"""Live database context for Abby — queries Parthenon's PostgreSQL backend.

Eight contextual tools that give Abby real-time awareness of the platform:

  1. search_concept_sets    — concept sets with OMOP concept names + descendants
  2. list_cohort_definitions — cohorts with generation status + patient counts
  3. get_concept_set_detail  — expand a specific concept set's items
  4. query_vocabulary        — search OMOP concepts (SNOMED, ICD10, RxNorm, LOINC)
  5. get_achilles_stats      — CDM characterization: record counts, top conditions/drugs
  6. get_dqd_summary         — data quality check pass/fail rates
  7. get_cohort_counts       — patient counts from cohort generations
  8. get_cdm_summary         — person count, domain record counts, data sources

Each tool is only invoked when the user's message signals relevant intent,
keeping Abby's context window clean for other queries.
"""
import logging
import re
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.config import settings

logger = logging.getLogger(__name__)

_engine: Engine | None = None


def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(settings.database_url, pool_size=3, pool_pre_ping=True)
    return _engine


# ── Intent detection ─────────────────────────────────────────────────────────
# Each tool has its own intent patterns. Only matching tools fire.

_TOOL_INTENTS: dict[str, list[re.Pattern]] = {
    "concept_sets": [
        re.compile(r"\b(concept\s*set)", re.I),
        re.compile(r"\b(do\s+we\s+have|what.*defined|what.*available).*\b(concept|set)\b", re.I),
    ],
    "cohort_definitions": [
        re.compile(r"\b(cohort|cohort\s*definition)", re.I),
        re.compile(r"\b(do\s+we\s+have|what.*defined).*cohort", re.I),
    ],
    "vocabulary": [
        re.compile(r"\b(vocabulary|concept_id|SNOMED|ICD|RxNorm|LOINC|ATC|CPT)\b", re.I),
        re.compile(r"\b(search|find|look\s*up).*\b(concept|term|code|drug|condition|procedure|measurement)\b", re.I),
    ],
    "achilles": [
        re.compile(r"\b(achilles|characteriz|distribution|prevalence|top\s+condition|top\s+drug|most\s+common)\b", re.I),
        re.compile(r"\bhow\s+many\s+(patient|people|person|record)", re.I),
    ],
    "dqd": [
        re.compile(r"\b(data\s*quality|DQD|quality\s*check|plausibility|conformance|completeness)\b", re.I),
    ],
    "cohort_counts": [
        re.compile(r"\bhow\s+many.*(patient|people|person|match).*cohort\b", re.I),
        re.compile(r"\bcohort.*(count|size|patient|generated|result)\b", re.I),
    ],
    "cdm_summary": [
        re.compile(r"\b(CDM|database|data\s*source|how\s+big|overview|summary)\b.*\b(source|database|CDM|size|record|patient)\b", re.I),
        re.compile(r"\b(data\s*source|source\s*daimon|which.*database|what.*loaded)\b", re.I),
        re.compile(r"\bhow\s+many\s+(record|row|observation|total)", re.I),
    ],
    "analyses": [
        re.compile(r"\b(analys[ei]s|stud(?:y|ies)|characterization|incidence|estimation|prediction|pathway)\b", re.I),
    ],
    # Knowledge graph intents
    "graph_ancestors": [
        re.compile(r'\b(ancestor|parent|broader|hierarchy|supertype|generali[sz]e)\b', re.I),
    ],
    "graph_descendants": [
        re.compile(r'\b(descendant|child|narrower|subtype|speciali[sz]e|specific)\b', re.I),
    ],
    "graph_related": [
        re.compile(r'\b(related|relationship|connected|associated|mapped|linked)\b', re.I),
    ],
    "graph_siblings": [
        re.compile(r'\b(sibling|similar|same\s+(level|category|class)|peer|alternative)\b', re.I),
    ],
    "data_profile": [
        re.compile(r'\b(coverage|data\s+quality|sparse|gap|temporal|how\s+much\s+data|cdm\s+summary)\b', re.I),
    ],
    # Catch-all for broad existence questions
    "broad_search": [
        re.compile(r"\b(do\s+we\s+have|what.*(?:exist|defined|available|created|built|set\s*up))\b", re.I),
        re.compile(r"\b(list|show|find|which)\b.*\b(concept|cohort|analys|stud|everything)\b", re.I),
    ],
}


def _detect_intents(message: str) -> set[str]:
    """Detect which tools should fire based on message intent."""
    intents: set[str] = set()
    for tool, patterns in _TOOL_INTENTS.items():
        if any(p.search(message) for p in patterns):
            intents.add(tool)
    # Broad search triggers the 3 core tools
    if "broad_search" in intents and len(intents) == 1:
        intents = {"concept_sets", "cohort_definitions", "analyses"}
    intents.discard("broad_search")
    return intents


def _extract_search_terms(message: str) -> list[str]:
    """Extract clinically meaningful search terms from the user's message."""
    cleaned = re.sub(
        r"\b(do|we|have|what|which|are|is|the|a|an|any|our|my|"
        r"can|you|find|show|list|tell|me|about|for|in|on|of|with|"
        r"related|relevant|defined|existing|available|created|"
        r"concept\s*sets?|cohort\s*definitions?|cohorts?|analyses?|"
        r"studies|patients?|how\s+many|data\s*base|please)\b",
        " ", message, flags=re.I,
    )
    terms = [re.sub(r'[^\w\-]', '', w).strip() for w in cleaned.split()]
    terms = [t for t in terms if len(t) >= 3]
    seen: set[str] = set()
    unique: list[str] = []
    for t in terms:
        lower = t.lower()
        if lower not in seen:
            seen.add(lower)
            unique.append(t)
    return unique[:5]


# ── Main entry point ─────────────────────────────────────────────────────────

def query_live_context(message: str, page_context: str) -> str:
    """Query the Parthenon database with only the tools relevant to the user's question.

    Returns formatted context string, or empty string if no tools match.
    """
    intents = _detect_intents(message)
    if not intents:
        return ""

    keywords = _extract_search_terms(message)
    is_list_all = bool(re.search(r"\b(list|show|all)\b.*\b(concept|cohort|analy|everything)", message, re.I))
    search_terms = [] if is_list_all else keywords

    sections: list[str] = []
    engine = _get_engine()

    try:
        if "concept_sets" in intents:
            r = _tool_search_concept_sets(engine, search_terms)
            if r:
                sections.append(r)

        if "cohort_definitions" in intents or "cohort_counts" in intents:
            r = _tool_list_cohort_definitions(engine, search_terms)
            if r:
                sections.append(r)

        if "vocabulary" in intents:
            r = _tool_query_vocabulary(engine, keywords)
            if r:
                sections.append(r)

        if "achilles" in intents:
            r = _tool_get_achilles_stats(engine, keywords)
            if r:
                sections.append(r)

        if "dqd" in intents:
            r = _tool_get_dqd_summary(engine)
            if r:
                sections.append(r)

        if "cdm_summary" in intents:
            r = _tool_get_cdm_summary(engine)
            if r:
                sections.append(r)

        if "analyses" in intents:
            r = _tool_get_analyses(engine, search_terms)
            if r:
                sections.append(r)

        # Knowledge graph queries
        if any(intent in intents for intent in ("graph_ancestors", "graph_descendants", "graph_related", "graph_siblings")):
            r = _tool_graph_query(message)
            if r:
                sections.append("\n\nCONCEPT HIERARCHY:\n" + r)

        # CDM data profile
        if "data_profile" in intents:
            r = _tool_data_profile(message)
            if r:
                sections.append("\n\nCDM DATA PROFILE:\n" + r)

    except Exception as e:
        logger.warning("Live database context failed: %s", e)
        return ""

    if not sections:
        return (
            "\n\nLIVE PLATFORM DATA (queried just now):\n"
            "No matching data found in the Parthenon instance for this query."
        )

    logger.info("Live context: %d sections for intents %s", len(sections), intents)
    return (
        "\n\nLIVE PLATFORM DATA (queried just now from the Parthenon database):\n\n"
        + "\n\n".join(sections)
    )


# ── Tool 1: Search Concept Sets ──────────────────────────────────────────────

def _tool_search_concept_sets(engine: Engine, keywords: list[str]) -> str:
    if not keywords:
        query = text("""
            SELECT cs.id, cs.name, cs.description,
                   COUNT(csi.id) as item_count,
                   STRING_AGG(DISTINCT c.concept_name, ', ' ORDER BY c.concept_name) as concept_names
            FROM app.concept_sets cs
            LEFT JOIN app.concept_set_items csi ON csi.concept_set_id = cs.id
            LEFT JOIN vocab.concept c ON c.concept_id = csi.concept_id
            WHERE cs.deleted_at IS NULL
            GROUP BY cs.id, cs.name, cs.description
            ORDER BY cs.name LIMIT 25
        """)
        rows = _exec(engine, query)
    else:
        cond = _ilike_or("cs.name", "cs.description", keywords)
        query = text(f"""
            SELECT cs.id, cs.name, cs.description,
                   COUNT(csi.id) as item_count,
                   STRING_AGG(DISTINCT c.concept_name, ', ' ORDER BY c.concept_name) as concept_names
            FROM app.concept_sets cs
            LEFT JOIN app.concept_set_items csi ON csi.concept_set_id = cs.id
            LEFT JOIN vocab.concept c ON c.concept_id = csi.concept_id
            WHERE cs.deleted_at IS NULL AND ({cond})
            GROUP BY cs.id, cs.name, cs.description
            ORDER BY cs.name LIMIT 25
        """)
        rows = _exec(engine, query, _kw_params(keywords))

    if not rows:
        return ""
    lines = [f"**Concept Sets ({len(rows)} found):**"]
    for r in rows:
        line = f"- **{r['name']}** (ID: {r['id']}, {r.get('item_count', 0)} concepts)"
        if r.get("description"):
            line += f" — {r['description']}"
        if r.get("concept_names"):
            line += f"\n  Includes: {r['concept_names']}"
        lines.append(line)
    return "\n".join(lines)


# ── Tool 2: List Cohort Definitions (with generation counts) ─────────────────

def _tool_list_cohort_definitions(engine: Engine, keywords: list[str]) -> str:
    if not keywords:
        query = text("""
            SELECT cd.id, cd.name, cd.description, cd.version,
                   cg.status as gen_status, cg.person_count, cg.completed_at
            FROM app.cohort_definitions cd
            LEFT JOIN LATERAL (
                SELECT status, person_count, completed_at
                FROM app.cohort_generations
                WHERE cohort_definition_id = cd.id
                ORDER BY completed_at DESC NULLS LAST LIMIT 1
            ) cg ON true
            WHERE cd.deleted_at IS NULL
            ORDER BY cd.name LIMIT 25
        """)
        rows = _exec(engine, query)
    else:
        cond = _ilike_or("cd.name", "cd.description", keywords)
        query = text(f"""
            SELECT cd.id, cd.name, cd.description, cd.version,
                   cg.status as gen_status, cg.person_count, cg.completed_at
            FROM app.cohort_definitions cd
            LEFT JOIN LATERAL (
                SELECT status, person_count, completed_at
                FROM app.cohort_generations
                WHERE cohort_definition_id = cd.id
                ORDER BY completed_at DESC NULLS LAST LIMIT 1
            ) cg ON true
            WHERE cd.deleted_at IS NULL AND ({cond})
            ORDER BY cd.name LIMIT 25
        """)
        rows = _exec(engine, query, _kw_params(keywords))

    if not rows:
        return ""
    lines = [f"**Cohort Definitions ({len(rows)} found):**"]
    for r in rows:
        gen = ""
        if r.get("gen_status") == "completed" and r.get("person_count") is not None:
            gen = f", **{r['person_count']:,} patients** matched"
        elif r.get("gen_status"):
            gen = f", generation: {r['gen_status']}"
        line = f"- **{r['name']}** (ID: {r['id']}, v{r.get('version', 1)}{gen})"
        if r.get("description"):
            desc = r["description"][:200]
            line += f"\n  {desc}"
        lines.append(line)
    return "\n".join(lines)


# ── Tool 3: Query Vocabulary ─────────────────────────────────────────────────

def _tool_query_vocabulary(engine: Engine, keywords: list[str]) -> str:
    if not keywords:
        return ""
    cond = " OR ".join(f"c.concept_name ILIKE :kw{i}" for i in range(len(keywords)))
    query = text(f"""
        SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id,
               c.concept_class_id, c.standard_concept
        FROM vocab.concept c
        WHERE ({cond}) AND c.standard_concept = 'S'
        ORDER BY c.concept_name
        LIMIT 15
    """)
    rows = _exec(engine, query, _kw_params(keywords))
    if not rows:
        return ""
    lines = [f"**OMOP Vocabulary Search ({len(rows)} standard concepts found):**"]
    for r in rows:
        std = "Standard" if r.get("standard_concept") == "S" else "Non-standard"
        lines.append(
            f"- **{r['concept_name']}** (ID: {r['concept_id']}, "
            f"{r['domain_id']}, {r['vocabulary_id']}, {r.get('concept_class_id', '')})"
        )
    return "\n".join(lines)


# ── Tool 4: Achilles Stats ───────────────────────────────────────────────────

def _tool_get_achilles_stats(engine: Engine, keywords: list[str]) -> str:
    """Get CDM characterization stats from Achilles results.

    Key analysis IDs:
      1 = total persons, 113 = persons by gender
      200 = visit type counts, 400 = condition counts
      600 = procedure counts, 700 = drug counts
      800 = observation counts, 900 = drug era counts
    """
    sections: list[str] = []

    # Total persons
    r = _exec_one(engine, text(
        "SELECT count_value FROM results.achilles_results WHERE analysis_id = 1 LIMIT 1"
    ))
    total_persons = r["count_value"] if r else 0

    if total_persons:
        sections.append(f"**CDM Summary:** {total_persons:,} total persons")

    # Top conditions (analysis 400 = condition occurrence counts)
    if not keywords or any(k.lower() in ("condition", "disease", "diagnosis") for k in keywords):
        rows = _exec(engine, text("""
            SELECT c.concept_name, ar.count_value
            FROM results.achilles_results ar
            JOIN vocab.concept c ON c.concept_id = CAST(ar.stratum_1 AS INTEGER)
            WHERE ar.analysis_id = 400
            ORDER BY ar.count_value DESC LIMIT 10
        """))
        if rows:
            lines = ["**Top 10 Conditions by Record Count:**"]
            for r in rows:
                lines.append(f"- {r['concept_name']}: {r['count_value']:,}")
            sections.append("\n".join(lines))

    # Top drugs (analysis 700)
    if not keywords or any(k.lower() in ("drug", "medication", "prescription", "rx") for k in keywords):
        rows = _exec(engine, text("""
            SELECT c.concept_name, ar.count_value
            FROM results.achilles_results ar
            JOIN vocab.concept c ON c.concept_id = CAST(ar.stratum_1 AS INTEGER)
            WHERE ar.analysis_id = 700
            ORDER BY ar.count_value DESC LIMIT 10
        """))
        if rows:
            lines = ["**Top 10 Drugs by Record Count:**"]
            for r in rows:
                lines.append(f"- {r['concept_name']}: {r['count_value']:,}")
            sections.append("\n".join(lines))

    # If specific keyword, search Achilles for matching concepts
    if keywords:
        cond = " OR ".join(f"c.concept_name ILIKE :kw{i}" for i in range(len(keywords)))
        rows = _exec(engine, text(f"""
            SELECT c.concept_name, c.domain_id, ar.count_value
            FROM results.achilles_results ar
            JOIN vocab.concept c ON c.concept_id = CAST(ar.stratum_1 AS INTEGER)
            WHERE ar.analysis_id IN (400, 600, 700, 800) AND ({cond})
            ORDER BY ar.count_value DESC LIMIT 10
        """), _kw_params(keywords))
        if rows:
            lines = [f"**Records matching '{' '.join(keywords)}':**"]
            for r in rows:
                lines.append(f"- {r['concept_name']} ({r['domain_id']}): {r['count_value']:,} records")
            sections.append("\n".join(lines))

    return "\n\n".join(sections) if sections else ""


# ── Tool 5: DQD Summary ──────────────────────────────────────────────────────

def _tool_get_dqd_summary(engine: Engine) -> str:
    try:
        rows = _exec(engine, text("""
            SELECT check_name, category, num_violated_rows, num_denominator_rows,
                   threshold_value, notes_value
            FROM app.dqd_results
            WHERE num_violated_rows > 0
            ORDER BY num_violated_rows DESC LIMIT 10
        """))
        if not rows:
            # Try alternate table name
            rows = _exec(engine, text("""
                SELECT category, count(*) as checks,
                       SUM(CASE WHEN failed = true THEN 1 ELSE 0 END) as failed_count
                FROM app.dqd_results
                GROUP BY category ORDER BY category
            """))

        if not rows:
            return ""
        lines = ["**Data Quality Summary (top issues):**"]
        for r in rows:
            if "check_name" in r:
                lines.append(
                    f"- {r.get('category', 'Unknown')}/{r['check_name']}: "
                    f"{r.get('num_violated_rows', 0):,} violations"
                )
            else:
                lines.append(f"- {r['category']}: {r.get('failed_count', 0)} failed / {r.get('checks', 0)} checks")
        return "\n".join(lines)
    except Exception:
        return ""


# ── Tool 6: CDM Summary ──────────────────────────────────────────────────────

def _tool_get_cdm_summary(engine: Engine) -> str:
    sections: list[str] = []

    # Data sources
    rows = _exec(engine, text("""
        SELECT s.id, s.source_name, s.source_key
        FROM app.sources s WHERE s.deleted_at IS NULL ORDER BY s.source_name
    """))
    if rows:
        lines = ["**Data Sources:**"]
        for r in rows:
            lines.append(f"- **{r['source_name']}** (key: {r['source_key']})")
        sections.append("\n".join(lines))

    # Person count from Achilles
    person_row = _exec_one(engine, text(
        "SELECT count_value FROM results.achilles_results WHERE analysis_id = 1 LIMIT 1"
    ))
    if person_row:
        sections.append(f"**Total Persons in CDM:** {person_row['count_value']:,}")

    # Domain record counts (from Achilles analysis 200 = visit, 400 = condition, etc.)
    rows = _exec(engine, text("""
        SELECT
            CASE ar.analysis_id
                WHEN 200 THEN 'Visits'
                WHEN 400 THEN 'Conditions'
                WHEN 600 THEN 'Procedures'
                WHEN 700 THEN 'Drug Exposures'
                WHEN 800 THEN 'Observations'
                WHEN 2100 THEN 'Device Exposures'
            END as domain,
            SUM(ar.count_value) as total
        FROM results.achilles_results ar
        WHERE ar.analysis_id IN (200, 400, 600, 700, 800, 2100)
        GROUP BY ar.analysis_id
        ORDER BY total DESC
    """))
    if rows:
        lines = ["**Domain Record Counts:**"]
        for r in rows:
            if r.get("domain"):
                lines.append(f"- {r['domain']}: {r['total']:,}")
        sections.append("\n".join(lines))

    # Vocabulary stats
    rows = _exec(engine, text("""
        SELECT domain_id, COUNT(*) as cnt
        FROM vocab.concept WHERE standard_concept = 'S'
        GROUP BY domain_id ORDER BY cnt DESC LIMIT 8
    """))
    if rows:
        lines = ["**Vocabulary (standard concepts by domain):**"]
        for r in rows:
            lines.append(f"- {r['domain_id']}: {r['cnt']:,}")
        sections.append("\n".join(lines))

    return "\n\n".join(sections) if sections else ""


# ── Tool 7: Analyses ─────────────────────────────────────────────────────────

def _tool_get_analyses(engine: Engine, keywords: list[str]) -> str:
    try:
        if not keywords:
            query = text("""
                SELECT id, name, analysis_type, status, created_at
                FROM app.analysis_executions WHERE deleted_at IS NULL
                ORDER BY created_at DESC LIMIT 10
            """)
            rows = _exec(engine, query)
        else:
            cond = _ilike_or("name", "name", keywords)  # search name only
            query = text(f"""
                SELECT id, name, analysis_type, status, created_at
                FROM app.analysis_executions WHERE deleted_at IS NULL AND ({cond})
                ORDER BY created_at DESC LIMIT 10
            """)
            rows = _exec(engine, query, _kw_params(keywords))
        if not rows:
            return ""
        lines = [f"**Analyses ({len(rows)} found):**"]
        for r in rows:
            lines.append(f"- **{r.get('name', 'Unnamed')}** (type: {r.get('analysis_type', '?')}, status: {r.get('status', '?')})")
        return "\n".join(lines)
    except Exception:
        return ""


# ── Tool 8: Knowledge Graph Query ────────────────────────────────────────────

def _tool_graph_query(query: str) -> str:
    """Query the OMOP concept hierarchy."""
    try:
        from app.knowledge.graph_service import KnowledgeGraphService
        import redis as redis_lib

        engine = _get_engine()
        try:
            redis_client = redis_lib.from_url(settings.redis_url)
        except Exception:
            redis_client = None

        service = KnowledgeGraphService(engine=engine, redis_client=redis_client)

        # Extract concept ID from query if present (e.g., "concept 201826")
        concept_match = re.search(r'\bconcept\s*(?:id\s*)?(\d+)\b', query, re.IGNORECASE)
        if not concept_match:
            return ""

        concept_id = int(concept_match.group(1))
        parts: list[str] = []

        # Determine which graph operation based on query keywords
        q_lower = query.lower()
        if any(kw in q_lower for kw in ("ancestor", "parent", "broader", "hierarchy")):
            ancestors = service.get_ancestors(concept_id, max_levels=3)
            if ancestors:
                parts.append(service.format_hierarchy(ancestors, direction="ancestors"))

        if any(kw in q_lower for kw in ("descendant", "child", "narrower", "subtype", "specific")):
            descendants = service.get_descendants(concept_id, max_levels=2)
            if descendants:
                parts.append(service.format_hierarchy(descendants, direction="descendants"))

        if any(kw in q_lower for kw in ("sibling", "similar", "alternative", "peer")):
            siblings = service.get_siblings(concept_id)
            if siblings:
                parts.append(service.format_hierarchy(siblings, direction="siblings"))

        if any(kw in q_lower for kw in ("related", "relationship", "connected")):
            related = service.find_related(concept_id)
            if related:
                parts.append(service.format_related(related))

        # Default: show ancestors + descendants if no specific direction matched
        if not parts:
            ancestors = service.get_ancestors(concept_id, max_levels=2)
            descendants = service.get_descendants(concept_id, max_levels=2)
            if ancestors:
                parts.append(service.format_hierarchy(ancestors, direction="ancestors"))
            if descendants:
                parts.append(service.format_hierarchy(descendants, direction="descendants"))

        return "\n\n".join(parts) if parts else ""
    except Exception:
        logger.exception("Graph query tool failed")
        return ""


# ── Tool 9: Data Profile ──────────────────────────────────────────────────────

def _tool_data_profile(query: str) -> str:  # noqa: ARG001
    """Get CDM data profile with gap warnings."""
    try:
        from app.knowledge.data_profile import DataProfileService
        import redis as redis_lib

        engine = _get_engine()
        try:
            redis_client = redis_lib.from_url(settings.redis_url)
        except Exception:
            redis_client = None

        service = DataProfileService(engine=engine, redis_client=redis_client)
        profile = service.get_profile_summary()

        tc = profile["temporal_coverage"]
        start_date = tc.get("min_date", "unknown")
        end_date = tc.get("max_date", "unknown")

        lines = [f"CDM Profile: {profile['person_count']:,} patients"]
        lines.append(f"Temporal coverage: {start_date} to {end_date}")

        if profile["domain_density"]:
            lines.append("\nDomain density:")
            for d in profile["domain_density"][:7]:
                lines.append(f"  {d['domain']}: {d['record_count']:,} records")

        if profile["warnings"]:
            lines.append("")
            for w in profile["warnings"]:
                severity = w["severity"]
                if severity == "warning":
                    icon = "\u26a0\ufe0f"
                elif severity == "critical":
                    icon = "\U0001f534"
                else:
                    icon = "\u2139\ufe0f"
                lines.append(f"  {icon} {w['message']}")

        return "\n".join(lines)
    except Exception:
        logger.exception("Data profile tool failed")
        return ""


# ── SQL helpers ───────────────────────────────────────────────────────────────

def _exec(engine: Engine, query: Any, params: dict | None = None) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        result = conn.execute(query, params or {})
        return [dict(r._mapping) for r in result]


def _exec_one(engine: Engine, query: Any, params: dict | None = None) -> dict[str, Any] | None:
    rows = _exec(engine, query, params)
    return rows[0] if rows else None


def _ilike_or(col1: str, col2: str, keywords: list[str]) -> str:
    return " OR ".join(f"({col1} ILIKE :kw{i} OR {col2} ILIKE :kw{i})" for i in range(len(keywords)))


def _kw_params(keywords: list[str]) -> dict[str, str]:
    return {f"kw{i}": f"%{kw}%" for i, kw in enumerate(keywords)}
