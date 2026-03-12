"""Solr read service for GIS spatial queries.

Reads pre-indexed condition-county documents from the gis_spatial core.
Handles: conditions list, categories, choropleth, summary, time-periods.
Falls back to PostgreSQL via cdm_spatial_query if Solr is unavailable.
"""
from __future__ import annotations

import logging
import os

import pysolr

logger = logging.getLogger(__name__)

SOLR_URL = os.getenv("SOLR_URL", "http://solr:8983/solr")
SOLR_CORE = "gis_spatial"

_solr: pysolr.Solr | None = None


def get_solr() -> pysolr.Solr:
    global _solr
    if _solr is None:
        _solr = pysolr.Solr(
            f"{SOLR_URL}/{SOLR_CORE}",
            always_commit=False,
            timeout=10,
        )
    return _solr


def solr_available() -> bool:
    try:
        get_solr().ping()
        return True
    except Exception:
        logger.warning("Solr gis_spatial core not available")
        return False


async def get_conditions(
    search: str | None = None,
    category: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Get conditions with patient counts from Solr."""
    solr = get_solr()

    # Group by condition_concept_id to get unique conditions with summed cases
    params = {
        "q": f"condition_name:{search}*" if search else "*:*",
        "rows": 0,
        "facet": "true",
        "facet.pivot": "condition_concept_id,condition_name_exact,snomed_category",
        "facet.pivot.mincount": 1,
        "facet.limit": limit,
        "stats": "true",
        "stats.field": "cases",
    }

    if category:
        params["fq"] = f'snomed_category:"{category}"'

    results = solr.search(**params)

    # Parse pivot facets into condition list
    conditions = []
    pivots = results.facets.get("facet_pivot", {}).get(
        "condition_concept_id,condition_name_exact,snomed_category", []
    )

    for pivot in pivots:
        concept_id = pivot["value"]
        name = pivot["pivot"][0]["value"] if pivot.get("pivot") else str(concept_id)
        cat = (
            pivot["pivot"][0]["pivot"][0]["value"]
            if pivot.get("pivot") and pivot["pivot"][0].get("pivot")
            else "Other"
        )
        conditions.append({
            "concept_id": concept_id,
            "name": name,
            "patient_count": pivot["count"],
            "snomed_category": cat,
        })

    # Sort by patient count descending
    conditions.sort(key=lambda c: c["patient_count"], reverse=True)
    return conditions[:limit]


async def get_condition_categories() -> list[dict]:
    """Get SNOMED category list with counts from Solr faceting."""
    solr = get_solr()

    results = solr.search(
        q="*:*",
        rows=0,
        facet="true",
        **{"facet.field": "snomed_category", "facet.mincount": 1, "facet.sort": "count"},
    )

    facet_counts = results.facets.get("facet_fields", {}).get("snomed_category", [])
    categories = []
    for i in range(0, len(facet_counts), 2):
        categories.append({
            "category": facet_counts[i],
            "condition_count": facet_counts[i + 1],
            "total_patients": 0,
        })

    return categories


async def get_choropleth_from_solr(
    concept_id: int,
    metric: str = "cases",
    time_period: str | None = None,
) -> list[dict]:
    """Get county choropleth data from Solr for a given condition + metric."""
    solr = get_solr()

    fq = [f"condition_concept_id:{concept_id}"]
    if time_period:
        fq.append(f'time_periods:"{time_period}"')

    results = solr.search(
        q="*:*",
        fq=fq,
        fl=f"gadm_gid,county_name_exact,{metric},population,cfr",
        rows=500,
        sort=f"{metric} desc",
    )

    items = []
    for doc in results:
        value = doc.get(metric, 0)
        pop = doc.get("population", 0)
        rate = round(value / pop * 100, 2) if pop and metric in ("cases", "deaths") else None

        items.append({
            "boundary_id": 0,
            "gid": doc["gadm_gid"],
            "name": doc.get("county_name_exact", ""),
            "value": float(value) if value else 0,
            "denominator": float(pop) if pop else None,
            "rate": float(doc.get("cfr", 0)) if metric == "cfr" else rate,
        })

    return items


async def get_summary_from_solr(concept_id: int) -> dict:
    """Get disease summary stats from Solr aggregation."""
    solr = get_solr()

    results = solr.search(
        q="*:*",
        fq=f"condition_concept_id:{concept_id}",
        rows=0,
        stats="true",
        **{
            "stats.field": ["cases", "deaths", "hospitalizations", "population"],
        },
    )

    stats = results.stats.get("stats_fields", {})
    total_cases = int(stats.get("cases", {}).get("sum", 0))
    total_deaths = int(stats.get("deaths", {}).get("sum", 0))
    total_pop = int(stats.get("population", {}).get("sum", 0))
    affected = int(stats.get("cases", {}).get("count", 0))

    # Get condition name from first doc
    name_result = solr.search(
        q="*:*",
        fq=f"condition_concept_id:{concept_id}",
        fl="condition_name_exact",
        rows=1,
    )
    condition_name = name_result.docs[0].get("condition_name_exact", "") if name_result.docs else ""

    cfr = round(total_deaths / total_cases * 100, 2) if total_cases > 0 else 0.0
    prev = round(total_cases / total_pop * 100_000, 1) if total_pop > 0 else 0.0

    return {
        "condition_concept_id": concept_id,
        "condition_name": condition_name,
        "total_cases": total_cases,
        "total_deaths": total_deaths,
        "case_fatality_rate": cfr,
        "total_population": total_pop,
        "prevalence_per_100k": prev,
        "affected_counties": affected,
        "total_counties": affected,
        "date_range": {"start": None, "end": None},
    }


async def get_time_periods_from_solr(concept_id: int) -> list[str]:
    """Get available time periods for a condition from Solr."""
    solr = get_solr()

    results = solr.search(
        q="*:*",
        fq=f"condition_concept_id:{concept_id}",
        rows=0,
        facet="true",
        **{"facet.field": "time_periods", "facet.mincount": 1, "facet.sort": "index", "facet.limit": 200},
    )

    facet_counts = results.facets.get("facet_fields", {}).get("time_periods", [])
    periods = [facet_counts[i] for i in range(0, len(facet_counts), 2)]
    return sorted(periods)


def push_to_solr(documents: list[dict]) -> int:
    """Push condition-county documents to Solr. Returns count indexed."""
    if not documents:
        return 0

    solr = get_solr()
    batch_size = 500
    total = 0

    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        solr.add(batch, commit=False)
        total += len(batch)

    solr.commit()
    return total
