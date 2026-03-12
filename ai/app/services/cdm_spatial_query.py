"""CDM spatial aggregation queries.

Joins OMOP CDM clinical data through the ZIP-to-county crosswalk to produce
county-level metrics for choropleth rendering.

All queries target local PG 17 (ohdsi database) via GIS_DATABASE_URL.
CDM data lives in the 'omop' schema; GIS/crosswalk data in 'app' schema.
"""
from __future__ import annotations

import logging
import os

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

logger = logging.getLogger(__name__)

GIS_DATABASE_URL = os.getenv("GIS_DATABASE_URL", os.getenv("DATABASE_URL", ""))
ASYNC_DATABASE_URL = GIS_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Curated SNOMED category mapping: ancestor concept_id -> label
SNOMED_CATEGORIES: dict[int, str] = {
    134057: "Cardiovascular",
    320136: "Respiratory",
    4027384: "Metabolic / Endocrine",
    432795: "Infectious Disease",
    4211994: "Musculoskeletal",
    441542: "Mental Health / Behavioral",
    4027396: "Renal / Urological",
    4116241: "Dental / Oral Health",
    4302537: "Gastrointestinal",
    376337: "Neurological",
    440921: "Injury / Trauma",
}


def get_engine() -> AsyncEngine:
    return create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=5,
        connect_args={"server_settings": {"search_path": "app,omop,public"}},
    )


async def get_all_conditions() -> list[dict[str, Any]]:
    """Get all distinct conditions in the CDM with patient counts and SNOMED categories."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT co.condition_concept_id, c.concept_name,
                   COUNT(DISTINCT co.person_id) as patient_count
            FROM omop.condition_occurrence co
            JOIN omop.concept c ON c.concept_id = co.condition_concept_id
            WHERE co.condition_concept_id != 0
            GROUP BY co.condition_concept_id, c.concept_name
            ORDER BY patient_count DESC
        """))
        conditions = result.fetchall()

        ancestor_ids = list(SNOMED_CATEGORIES.keys())
        placeholders = ",".join(str(a) for a in ancestor_ids)

        category_result = await session.execute(text(f"""
            SELECT DISTINCT ca.descendant_concept_id, ca.ancestor_concept_id,
                   ca.min_levels_of_separation
            FROM omop.concept_ancestor ca
            WHERE ca.ancestor_concept_id IN ({placeholders})
              AND ca.descendant_concept_id IN (
                  SELECT DISTINCT condition_concept_id
                  FROM omop.condition_occurrence
                  WHERE condition_concept_id != 0
              )
            ORDER BY ca.descendant_concept_id, ca.min_levels_of_separation
        """))
        cat_rows = category_result.fetchall()

    await engine.dispose()

    category_map: dict[int, str] = {}
    for row in cat_rows:
        cid = row.descendant_concept_id
        if cid not in category_map:
            category_map[cid] = SNOMED_CATEGORIES.get(row.ancestor_concept_id, "Other")

    return [
        {
            "concept_id": row.condition_concept_id,
            "name": row.concept_name,
            "patient_count": row.patient_count,
            "snomed_category": category_map.get(row.condition_concept_id, "Other"),
        }
        for row in conditions
    ]


async def refresh_county_stats(concept_id: int) -> dict[str, Any]:
    """Rebuild county-level aggregates for a single condition."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats: dict[str, Any] = {"metrics_computed": 0, "concept_id": concept_id}

    async with async_session() as session:
        await session.execute(
            text("DELETE FROM app.cdm_county_stats WHERE concept_id = :cid OR (concept_id IS NULL AND :cid = 0)"),
            {"cid": concept_id},
        )

        # 1. Cases per county (all-time)
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'cases', :cid,
                   COUNT(DISTINCT co.person_id), NOW()
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"cid": concept_id})
        stats["metrics_computed"] += 1

        # 2. Deaths per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'deaths', :cid,
                   COUNT(DISTINCT d.person_id), NOW()
            FROM omop.death d
            JOIN omop.condition_occurrence co ON co.person_id = d.person_id
                AND co.condition_concept_id = :cid
            JOIN omop.person p ON p.person_id = d.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"cid": concept_id})
        stats["metrics_computed"] += 1

        # 3. CFR per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, denominator, rate, updated_at)
            SELECT
                cases.gadm_gid, cases.county_name, 'cfr', :cid,
                COALESCE(deaths.cnt, 0), cases.cnt,
                CASE WHEN cases.cnt > 0
                     THEN ROUND(COALESCE(deaths.cnt, 0)::numeric / cases.cnt * 100, 2)
                     ELSE 0 END,
                NOW()
            FROM (
                SELECT zc.gadm_gid, zc.county_name, COUNT(DISTINCT co.person_id) as cnt
                FROM omop.condition_occurrence co
                JOIN omop.person p ON p.person_id = co.person_id
                JOIN omop.location l ON l.location_id = p.location_id
                JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
                WHERE co.condition_concept_id = :cid
                  AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
                GROUP BY zc.gadm_gid, zc.county_name
            ) cases
            LEFT JOIN (
                SELECT zc.gadm_gid, COUNT(DISTINCT d.person_id) as cnt
                FROM omop.death d
                JOIN omop.condition_occurrence co ON co.person_id = d.person_id
                    AND co.condition_concept_id = :cid
                JOIN omop.person p ON p.person_id = d.person_id
                JOIN omop.location l ON l.location_id = p.location_id
                JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
                WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
                GROUP BY zc.gadm_gid
            ) deaths ON deaths.gadm_gid = cases.gadm_gid
        """), {"cid": concept_id})
        stats["metrics_computed"] += 1

        # 4. Monthly cases per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, time_period, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'cases_monthly', :cid,
                   TO_CHAR(co.condition_start_date, 'YYYY-MM'),
                   COUNT(DISTINCT co.person_id), NOW()
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
              AND co.condition_start_date IS NOT NULL
            GROUP BY zc.gadm_gid, zc.county_name, TO_CHAR(co.condition_start_date, 'YYYY-MM')
        """), {"cid": concept_id})
        stats["metrics_computed"] += 1

        # 5. Hospitalizations per county
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, concept_id, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'hospitalization', :cid,
                   COUNT(DISTINCT vo.person_id), NOW()
            FROM omop.visit_occurrence vo
            JOIN omop.condition_occurrence co ON co.person_id = vo.person_id
                AND co.condition_concept_id = :cid
                AND co.condition_start_date BETWEEN vo.visit_start_date
                    AND COALESCE(vo.visit_end_date, vo.visit_start_date + INTERVAL '30 days')
            JOIN omop.person p ON p.person_id = vo.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE vo.visit_concept_id = 9201
              AND zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """), {"cid": concept_id})
        stats["metrics_computed"] += 1

        await session.commit()

        # Build Solr documents from freshly computed stats
        result = await session.execute(text("""
            SELECT gadm_gid, county_name, metric_type, value, denominator, rate, time_period
            FROM app.cdm_county_stats
            WHERE concept_id = :cid
            ORDER BY gadm_gid, metric_type
        """), {"cid": concept_id})
        rows = result.fetchall()

        name_result = await session.execute(text(
            "SELECT concept_name FROM omop.concept WHERE concept_id = :cid"
        ), {"cid": concept_id})
        name_row = name_result.fetchone()
        condition_name = name_row.concept_name if name_row else str(concept_id)

        pop_result = await session.execute(text("""
            SELECT gadm_gid, value FROM app.cdm_county_stats
            WHERE metric_type = 'patient_count' AND concept_id IS NULL
        """))
        pop_map = {r.gadm_gid: int(r.value) for r in pop_result}

    await engine.dispose()

    # Build Solr documents: one per county
    county_data: dict[str, dict[str, Any]] = {}
    for row in rows:
        gid = row.gadm_gid
        if gid not in county_data:
            county_data[gid] = {
                "id": f"{concept_id}_{gid}",
                "condition_concept_id": concept_id,
                "condition_name": condition_name,
                "condition_name_exact": condition_name,
                "snomed_category": "Other",
                "gadm_gid": gid,
                "county_name": row.county_name,
                "county_name_exact": row.county_name,
                "parent_gid": gid.rsplit(".", 1)[0] + "_1" if "." in gid else gid,
                "cases": 0,
                "deaths": 0,
                "cfr": 0.0,
                "hospitalizations": 0,
                "population": pop_map.get(gid, 0),
                "prevalence_per_100k": 0.0,
                "time_periods": [],
                "monthly_cases": [],
                "updated_at": None,
            }

        d = county_data[gid]
        if row.time_period:
            d["time_periods"].append(row.time_period)
            d["monthly_cases"].append(int(row.value))
        elif row.metric_type == "cases":
            d["cases"] = int(row.value)
            pop = d["population"]
            d["prevalence_per_100k"] = round(int(row.value) / pop * 100_000, 1) if pop > 0 else 0.0
        elif row.metric_type == "deaths":
            d["deaths"] = int(row.value)
        elif row.metric_type == "cfr":
            d["cfr"] = float(row.rate) if row.rate else 0.0
        elif row.metric_type == "hospitalization":
            d["hospitalizations"] = int(row.value)

    documents = list(county_data.values())
    if documents:
        try:
            from app.services.solr_spatial import push_to_solr
            indexed = push_to_solr(documents)
            stats["solr_indexed"] = indexed
            logger.info(f"Pushed {indexed} documents to Solr for concept {concept_id}")
        except Exception as e:
            logger.warning(f"Solr push failed (PG data is still saved): {e}")
            stats["solr_error"] = str(e)

    return stats


async def refresh_patient_counts() -> int:
    """Rebuild patient_count per county (population baseline). Returns count."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await session.execute(text(
            "DELETE FROM app.cdm_county_stats WHERE metric_type = 'patient_count' AND concept_id IS NULL"
        ))
        await session.execute(text("""
            INSERT INTO app.cdm_county_stats (gadm_gid, county_name, metric_type, value, updated_at)
            SELECT zc.gadm_gid, zc.county_name, 'patient_count',
                   COUNT(DISTINCT p.person_id), NOW()
            FROM omop.person p
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE zc.gadm_gid IS NOT NULL AND l.zip != '00000'
            GROUP BY zc.gadm_gid, zc.county_name
        """))
        await session.commit()

    await engine.dispose()
    return 1


async def get_county_choropleth(
    metric_type: str,
    concept_id: int | None = None,
    time_period: str | None = None,
) -> list[dict[str, Any]]:
    """Read pre-computed county stats for choropleth rendering."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["cs.metric_type = :metric"]
    params: dict[str, Any] = {"metric": metric_type}

    if concept_id:
        conditions.append("cs.concept_id = :concept_id")
        params["concept_id"] = concept_id

    if time_period:
        conditions.append("cs.time_period = :period")
        params["period"] = time_period
    else:
        conditions.append("cs.time_period IS NULL")

    where = " AND ".join(conditions)

    async with async_session() as session:
        result = await session.execute(text(f"""
            SELECT cs.gadm_gid, cs.county_name, cs.value, cs.denominator, cs.rate,
                   b.id as boundary_id
            FROM app.cdm_county_stats cs
            JOIN app.gis_admin_boundaries b ON b.gid = cs.gadm_gid
            WHERE {where}
            ORDER BY cs.value DESC
        """), params)
        rows = result.fetchall()

    await engine.dispose()

    return [
        {
            "boundary_id": row.boundary_id,
            "gid": row.gadm_gid,
            "name": row.county_name,
            "value": float(row.value) if row.value else 0,
            "denominator": float(row.denominator) if row.denominator else None,
            "rate": float(row.rate) if row.rate else None,
        }
        for row in rows
    ]


async def get_available_time_periods(
    metric_type: str = "cases_monthly",
    concept_id: int | None = None,
) -> list[str]:
    """Return sorted list of available YYYY-MM periods."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["metric_type = :metric", "time_period IS NOT NULL"]
    params: dict[str, Any] = {"metric": metric_type}

    if concept_id:
        conditions.append("concept_id = :concept_id")
        params["concept_id"] = concept_id

    where = " AND ".join(conditions)

    async with async_session() as session:
        result = await session.execute(text(f"""
            SELECT DISTINCT time_period
            FROM app.cdm_county_stats
            WHERE {where}
            ORDER BY time_period
        """), params)
        periods = [row.time_period for row in result]

    await engine.dispose()
    return periods


async def get_disease_summary(concept_id: int) -> dict[str, Any]:
    """Return summary stats for any condition."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        name_result = await session.execute(text(
            "SELECT concept_name FROM omop.concept WHERE concept_id = :cid"
        ), {"cid": concept_id})
        name_row = name_result.fetchone()
        condition_name = name_row.concept_name if name_row else str(concept_id)

        cases = await session.execute(text(
            "SELECT COUNT(DISTINCT person_id) FROM omop.condition_occurrence WHERE condition_concept_id = :cid"
        ), {"cid": concept_id})
        total_cases = cases.scalar() or 0

        deaths = await session.execute(text("""
            SELECT COUNT(DISTINCT d.person_id)
            FROM omop.death d
            JOIN omop.condition_occurrence co ON co.person_id = d.person_id
            WHERE co.condition_concept_id = :cid
        """), {"cid": concept_id})
        total_deaths = deaths.scalar() or 0

        pop = await session.execute(text("SELECT COUNT(*) FROM omop.person"))
        total_pop = pop.scalar() or 0

        counties = await session.execute(text(
            "SELECT COUNT(DISTINCT gadm_gid) FROM app.cdm_county_stats WHERE metric_type = 'cases' AND concept_id = :cid"
        ), {"cid": concept_id})
        affected_counties = counties.scalar() or 0

        total_counties = await session.execute(text(
            "SELECT COUNT(DISTINCT gadm_gid) FROM app.cdm_county_stats WHERE metric_type = 'patient_count'"
        ))
        total_county_count = total_counties.scalar() or 0

        dates = await session.execute(text("""
            SELECT MIN(condition_start_date), MAX(condition_start_date)
            FROM omop.condition_occurrence WHERE condition_concept_id = :cid
        """), {"cid": concept_id})
        date_row = dates.fetchone()

    await engine.dispose()

    cfr = round(total_deaths / total_cases * 100, 2) if total_cases > 0 else 0

    return {
        "condition_concept_id": concept_id,
        "condition_name": condition_name,
        "total_cases": total_cases,
        "total_deaths": total_deaths,
        "case_fatality_rate": cfr,
        "total_population": total_pop,
        "prevalence_per_100k": round(total_cases / total_pop * 100_000, 1) if total_pop > 0 else 0,
        "affected_counties": affected_counties,
        "total_counties": total_county_count,
        "date_range": {
            "start": date_row[0].isoformat() if date_row and date_row[0] else None,
            "end": date_row[1].isoformat() if date_row and date_row[1] else None,
        },
    }


async def get_county_detail(gadm_gid: str, concept_id: int) -> dict[str, Any] | None:
    """Get detailed stats for a single county for a specific condition."""
    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("""
            SELECT metric_type, concept_id, time_period, value, denominator, rate
            FROM app.cdm_county_stats WHERE gadm_gid = :gid AND (concept_id = :cid OR concept_id IS NULL)
            ORDER BY metric_type, time_period
        """), {"gid": gadm_gid, "cid": concept_id})
        rows = result.fetchall()

        if not rows:
            await engine.dispose()
            return None

        boundary = await session.execute(text("""
            SELECT b.id, b.name, ST_Area(b.geom::geography) / 1e6 as area_km2
            FROM app.gis_admin_boundaries b WHERE b.gid = :gid
        """), {"gid": gadm_gid})
        b_row = boundary.fetchone()

        age_dist = await session.execute(text("""
            SELECT
                CASE
                    WHEN 2026 - p.year_of_birth < 18 THEN '0-17'
                    WHEN 2026 - p.year_of_birth < 35 THEN '18-34'
                    WHEN 2026 - p.year_of_birth < 50 THEN '35-49'
                    WHEN 2026 - p.year_of_birth < 65 THEN '50-64'
                    ELSE '65+'
                END as age_group,
                COUNT(DISTINCT p.person_id) as count
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid AND zc.gadm_gid = :gid
              AND l.zip != '00000'
            GROUP BY age_group ORDER BY age_group
        """), {"cid": concept_id, "gid": gadm_gid})
        age_groups = [{"group": r.age_group, "count": r.count} for r in age_dist]

        gender_dist = await session.execute(text("""
            SELECT
                CASE p.gender_concept_id WHEN 8507 THEN 'Male' WHEN 8532 THEN 'Female' ELSE 'Other' END as gender,
                COUNT(DISTINCT p.person_id) as count
            FROM omop.condition_occurrence co
            JOIN omop.person p ON p.person_id = co.person_id
            JOIN omop.location l ON l.location_id = p.location_id
            JOIN app.zip_county_crosswalk zc ON zc.zip = l.zip
            WHERE co.condition_concept_id = :cid AND zc.gadm_gid = :gid
              AND l.zip != '00000'
            GROUP BY gender
        """), {"cid": concept_id, "gid": gadm_gid})
        genders = [{"gender": r.gender, "count": r.count} for r in gender_dist]

    await engine.dispose()

    metrics = {}
    timeline = []
    for row in rows:
        if row.time_period:
            timeline.append({"period": row.time_period, "metric": row.metric_type, "value": float(row.value)})
        else:
            metrics[row.metric_type] = {
                "value": float(row.value),
                "denominator": float(row.denominator) if row.denominator else None,
                "rate": float(row.rate) if row.rate else None,
            }

    return {
        "gadm_gid": gadm_gid,
        "name": b_row.name if b_row else gadm_gid,
        "boundary_id": b_row.id if b_row else None,
        "area_km2": round(b_row.area_km2, 1) if b_row and b_row.area_km2 else None,
        "metrics": metrics,
        "timeline": timeline,
        "demographics": {"age_groups": age_groups, "gender": genders},
    }
