from typing import Any

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks

from app.models.cdm_spatial import (
    CdmChoroplethRequest,
    ConditionItem,
    ConditionCategory,
    ConditionSummary,
    CountyChoroplethItem,
    RefreshResult,
)
from app.services.cdm_spatial_query import (
    get_all_conditions,
    get_county_choropleth,
    get_available_time_periods,
    get_disease_summary,
    get_county_detail,
    refresh_county_stats,
    refresh_patient_counts,
)
from app.services.solr_spatial import (
    solr_available,
    get_conditions as solr_get_conditions,
    get_condition_categories as solr_get_categories,
    get_choropleth_from_solr,
    get_summary_from_solr,
    get_time_periods_from_solr,
)

router = APIRouter(prefix="/cdm-spatial", tags=["CDM Spatial"])


@router.get("/conditions", response_model=list[ConditionItem])
async def conditions(
    search: str | None = Query(default=None, description="Fuzzy search term"),
    category: str | None = Query(default=None, description="SNOMED category filter"),
    limit: int = Query(default=50, le=500),
) -> list[dict[str, Any]]:
    """Get available conditions with patient counts. Uses Solr if available, PG fallback."""
    if solr_available():
        return await solr_get_conditions(search=search, category=category, limit=limit)
    # Fallback to PG
    all_conds = await get_all_conditions()
    if search:
        search_lower = search.lower()
        all_conds = [c for c in all_conds if search_lower in c["name"].lower()]
    if category:
        all_conds = [c for c in all_conds if c["snomed_category"] == category]
    return all_conds[:limit]


@router.get("/conditions/categories", response_model=list[ConditionCategory])
async def condition_categories() -> list[dict[str, Any]]:
    """Get curated SNOMED category list with condition counts."""
    if solr_available():
        return await solr_get_categories()
    # Fallback: compute from PG
    all_conds = await get_all_conditions()
    cat_map: dict[str, dict[str, Any]] = {}
    for c in all_conds:
        cat = c["snomed_category"]
        if cat not in cat_map:
            cat_map[cat] = {"category": cat, "condition_count": 0, "total_patients": 0}
        cat_map[cat]["condition_count"] += 1
        cat_map[cat]["total_patients"] += c["patient_count"]
    return sorted(cat_map.values(), key=lambda x: x["total_patients"], reverse=True)


@router.post("/choropleth", response_model=list[CountyChoroplethItem])
async def choropleth(req: CdmChoroplethRequest) -> list[dict[str, Any]]:
    """Get county-level choropleth data for a given condition + metric."""
    return await get_county_choropleth(
        metric_type=req.metric.value,
        concept_id=req.concept_id,
        time_period=req.time_period,
    )


@router.get("/summary")
async def disease_summary(concept_id: int = Query(description="OMOP condition concept ID")) -> dict[str, Any]:
    """Get summary statistics for a condition. Uses Solr if available, PG fallback."""
    if solr_available():
        try:
            return await get_summary_from_solr(concept_id)
        except Exception:
            pass
    return await get_disease_summary(concept_id)


@router.get("/time-periods")
async def time_periods(
    concept_id: int = Query(description="OMOP condition concept ID"),
    metric: str = "cases_monthly",
) -> list[str]:
    """Get available YYYY-MM time periods for a condition."""
    if solr_available():
        try:
            return await get_time_periods_from_solr(concept_id)
        except Exception:
            pass
    return await get_available_time_periods(metric, concept_id)


@router.get("/county/{gadm_gid:path}")
async def county_detail(
    gadm_gid: str,
    concept_id: int = Query(description="OMOP condition concept ID"),
) -> dict[str, Any]:
    """Get detailed stats for a specific county and condition."""
    result = await get_county_detail(gadm_gid, concept_id)
    if result is None:
        raise HTTPException(status_code=404, detail="County not found or no data")
    return result


@router.post("/refresh", response_model=RefreshResult)
async def refresh(
    concept_id: int = Query(description="OMOP condition concept ID"),
) -> dict[str, Any]:
    """Rebuild county-level aggregates for one condition and push to Solr."""
    await refresh_patient_counts()
    stats = await refresh_county_stats(concept_id)
    return {"status": "ok", "metrics_computed": stats["metrics_computed"], "concept_id": concept_id}


@router.post("/reindex-all")
async def reindex_all(background_tasks: BackgroundTasks) -> dict[str, str]:
    """Full rebuild across all conditions. Runs asynchronously."""
    async def _reindex() -> None:
        from app.services.cdm_spatial_query import get_all_conditions as _get_all
        conditions = await _get_all()
        await refresh_patient_counts()
        for cond in conditions:
            try:
                await refresh_county_stats(cond["concept_id"])
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to refresh {cond['concept_id']}: {e}")

    background_tasks.add_task(_reindex)
    return {"status": "started", "message": "Full reindex running in background"}


# Legacy endpoint (v1 compat)
@router.get("/covid-summary")
async def covid_summary() -> dict[str, Any]:
    """Legacy endpoint — redirects to generalized summary with COVID concept."""
    return await get_disease_summary(37311061)
