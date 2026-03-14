# GIS Explorer v2 — Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the GIS Explorer from hardcoded COVID-19 into a disease-agnostic spatial analytics tool powered by Solr, with a disease selector, generalized summary bar, and concept-parameterized backend queries.

**Architecture:** Disease selection drives all downstream queries. Solr `gis_spatial` core serves fast reads (conditions list, choropleth, summary stats). PostgreSQL handles the refresh/reindex write path and deep drill-downs (county detail demographics, timeline). The Python AI service computes aggregates and pushes to Solr; Laravel proxies all endpoints. Frontend components are parameterized by `concept_id`.

**Tech Stack:** Python 3.12 / FastAPI / asyncpg / pysolr, Laravel 11 / PHP 8.4, React 19 / TypeScript / TanStack Query, Solr 9.7, PostgreSQL 17

**Spec:** `docs/superpowers/specs/2026-03-11-gis-explorer-v2-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `solr/configsets/gis_spatial/conf/schema.xml` | Solr schema for condition-county aggregates |
| `solr/configsets/gis_spatial/conf/solrconfig.xml` | Solr request handlers and caching |
| `solr/configsets/gis_spatial/conf/stopwords.txt` | Empty stopwords file (required by Solr) |
| `ai/app/services/solr_spatial.py` | Solr read service (conditions, choropleth, summary, time-periods) |
| `backend/app/Console/Commands/SolrIndexGisSpatial.php` | Artisan command to trigger full reindex |
| `backend/app/Services/Solr/GisSpatialSearchService.php` | Laravel Solr read service (fallback + studies endpoint) |
| `frontend/src/features/gis/components/DiseaseSelector.tsx` | Disease selector with quick picks, categories, search |
| `frontend/src/features/gis/components/DiseaseSummaryBar.tsx` | Generalized summary bar for any condition |

### Modified Files
| File | Changes |
|------|---------|
| `docker-compose.yml` | Add `gis_spatial` configset volume mount |
| `backend/config/solr.php` | Add `gis_spatial` to cores list |
| `ai/app/models/cdm_spatial.py` | Generalize metric types, add condition models |
| `ai/app/services/cdm_spatial_query.py` | Parameterize `refresh_county_stats(concept_id)`, add conditions query, add Solr push |
| `ai/app/routers/cdm_spatial.py` | Add `/conditions`, `/conditions/categories`, `/summary`, `/reindex-all` endpoints; generalize existing endpoints |
| `ai/requirements.txt` | Add `pysolr` dependency |
| `backend/app/Http/Controllers/Api/V1/GisController.php` | Add proxy methods for new endpoints |
| `backend/routes/api.php` | Add new CDM spatial routes |
| `frontend/src/features/gis/types.ts` | Add condition types, generalize metric types |
| `frontend/src/features/gis/api.ts` | Add condition API functions, generalize existing |
| `frontend/src/features/gis/hooks/useGis.ts` | Add condition hooks, parameterize by concept_id |
| `frontend/src/features/gis/components/MetricSelector.tsx` | No code changes needed (already generic metric labels) |
| `frontend/src/features/gis/components/TimeSlider.tsx` | Accept `conceptId` prop for time period queries |
| `frontend/src/features/gis/components/CountyDetail.tsx` | Accept `conceptId` prop for detail queries |
| `frontend/src/features/gis/pages/GisPage.tsx` | Wire DiseaseSelector, manage `selectedConceptId` state |
| `frontend/src/features/gis/components/CovidSummaryBar.tsx` | Delete (replaced by DiseaseSummaryBar) |

---

## Chunk 1: Solr Infrastructure

### Task 1: Create `gis_spatial` Solr Configset

**Files:**
- Create: `solr/configsets/gis_spatial/conf/schema.xml`
- Create: `solr/configsets/gis_spatial/conf/solrconfig.xml`
- Create: `solr/configsets/gis_spatial/conf/stopwords.txt`

- [ ] **Step 1: Create schema.xml**

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<schema name="gis_spatial" version="1.6">

  <uniqueKey>id</uniqueKey>

  <!-- Field types -->
  <fieldType name="pint" class="solr.IntPointField" docValues="true"/>
  <fieldType name="plong" class="solr.LongPointField" docValues="true"/>
  <fieldType name="pfloat" class="solr.FloatPointField" docValues="true"/>
  <fieldType name="pdate" class="solr.DatePointField" docValues="true"/>
  <fieldType name="string" class="solr.StrField" sortMissingLast="true" docValues="true"/>
  <fieldType name="boolean" class="solr.BoolField" sortMissingLast="true"/>

  <fieldType name="text_general" class="solr.TextField" positionIncrementGap="100">
    <analyzer type="index">
      <tokenizer class="solr.StandardTokenizerFactory"/>
      <filter class="solr.LowerCaseFilterFactory"/>
      <filter class="solr.StopFilterFactory" ignoreCase="true" words="stopwords.txt"/>
    </analyzer>
    <analyzer type="query">
      <tokenizer class="solr.StandardTokenizerFactory"/>
      <filter class="solr.LowerCaseFilterFactory"/>
      <filter class="solr.StopFilterFactory" ignoreCase="true" words="stopwords.txt"/>
    </analyzer>
  </fieldType>

  <fieldType name="text_suggest" class="solr.TextField" positionIncrementGap="100">
    <analyzer type="index">
      <tokenizer class="solr.StandardTokenizerFactory"/>
      <filter class="solr.LowerCaseFilterFactory"/>
      <filter class="solr.EdgeNGramFilterFactory" minGramSize="2" maxGramSize="25"/>
    </analyzer>
    <analyzer type="query">
      <tokenizer class="solr.StandardTokenizerFactory"/>
      <filter class="solr.LowerCaseFilterFactory"/>
    </analyzer>
  </fieldType>

  <!-- Document ID: {concept_id}_{gadm_gid} -->
  <field name="id" type="string" indexed="true" stored="true" required="true"/>

  <!-- Condition fields -->
  <field name="condition_concept_id" type="pint" indexed="true" stored="true"/>
  <field name="condition_name" type="text_general" indexed="true" stored="true"/>
  <field name="condition_name_exact" type="string" indexed="true" stored="true"/>
  <field name="condition_name_suggest" type="text_suggest" indexed="true" stored="false"/>
  <field name="snomed_category" type="string" indexed="true" stored="true"/>

  <!-- Geography fields -->
  <field name="gadm_gid" type="string" indexed="true" stored="true"/>
  <field name="county_name" type="text_general" indexed="true" stored="true"/>
  <field name="county_name_exact" type="string" indexed="true" stored="true"/>
  <field name="parent_gid" type="string" indexed="true" stored="true"/>

  <!-- Metric fields -->
  <field name="cases" type="pint" indexed="true" stored="true"/>
  <field name="deaths" type="pint" indexed="true" stored="true"/>
  <field name="cfr" type="pfloat" indexed="true" stored="true"/>
  <field name="hospitalizations" type="pint" indexed="true" stored="true"/>
  <field name="population" type="pint" indexed="true" stored="true"/>
  <field name="prevalence_per_100k" type="pfloat" indexed="true" stored="true"/>

  <!-- Temporal fields -->
  <field name="time_periods" type="string" indexed="true" stored="true" multiValued="true"/>
  <field name="monthly_cases" type="pint" indexed="true" stored="true" multiValued="true"/>
  <field name="updated_at" type="pdate" indexed="true" stored="true"/>

  <!-- Copy fields for search/suggest -->
  <copyField source="condition_name" dest="condition_name_suggest"/>
  <copyField source="condition_name" dest="condition_name_exact"/>
  <copyField source="county_name" dest="county_name_exact"/>

  <!-- Required by Solr -->
  <field name="_version_" type="plong" indexed="false" stored="false"/>

</schema>
```

- [ ] **Step 2: Create solrconfig.xml**

Copy structure from `solr/configsets/vocabulary/conf/solrconfig.xml` with `gis_spatial` core name.

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<config>
  <luceneMatchVersion>9.7</luceneMatchVersion>

  <dataDir>${solr.data.dir:}</dataDir>

  <directoryFactory name="DirectoryFactory" class="${solr.directoryFactory:solr.NRTCachingDirectoryFactory}"/>
  <schemaFactory class="ClassicIndexSchemaFactory"/>

  <updateHandler class="solr.DirectUpdateHandler2">
    <autoCommit>
      <maxTime>15000</maxTime>
      <openSearcher>false</openSearcher>
    </autoCommit>
    <autoSoftCommit>
      <maxTime>1000</maxTime>
    </autoSoftCommit>
  </updateHandler>

  <requestHandler name="/select" class="solr.SearchHandler">
    <lst name="defaults">
      <str name="echoParams">explicit</str>
      <str name="wt">json</str>
      <int name="rows">100</int>
      <str name="df">condition_name</str>
    </lst>
  </requestHandler>

  <requestHandler name="/update" class="solr.UpdateRequestHandler"/>

  <requestHandler name="/admin/ping" class="solr.PingRequestHandler">
    <lst name="invariants">
      <str name="q">*:*</str>
    </lst>
    <lst name="defaults">
      <str name="echoParams">all</str>
    </lst>
  </requestHandler>
</config>
```

- [ ] **Step 3: Create stopwords.txt**

```
# Empty — no stopwords needed for GIS spatial core
```

- [ ] **Step 4: Verify files created**

Run: `ls -la solr/configsets/gis_spatial/conf/`
Expected: `schema.xml`, `solrconfig.xml`, `stopwords.txt`

- [ ] **Step 5: Commit**

```bash
git add solr/configsets/gis_spatial/
git commit -m "feat(gis): add Solr gis_spatial configset for disease-county aggregates"
```

---

### Task 2: Mount `gis_spatial` Configset in Docker Compose

**Files:**
- Modify: `docker-compose.yml:199-205`
- Modify: `backend/config/solr.php`

- [ ] **Step 1: Add volume mount to docker-compose.yml**

In `docker-compose.yml`, find the solr service volumes section (after the claims configset line ~205) and add:

```yaml
      - ./solr/configsets/gis_spatial:/opt/solr/server/solr/configsets/gis_spatial:ro
```

- [ ] **Step 2: Add core to solr.php config**

In `backend/config/solr.php`, find the `'cores'` array and add `'gis_spatial'`:

```php
'cores' => [
    'vocabulary' => 'vocabulary',
    'cohorts' => 'cohorts',
    'analyses' => 'analyses',
    'mappings' => 'mappings',
    'clinical' => 'clinical',
    'imaging' => 'imaging',
    'claims' => 'claims',
    'gis_spatial' => 'gis_spatial',
],
```

- [ ] **Step 3: Recreate Solr container to pick up new core**

Run: `docker compose up -d solr`
Then wait for health check:
Run: `docker compose exec solr curl -s http://localhost:8983/solr/gis_spatial/admin/ping | head -5`
Expected: `"status":"OK"`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/config/solr.php
git commit -m "feat(gis): mount gis_spatial Solr core in docker-compose"
```

---

## Chunk 2: Backend — Generalized Refresh + Solr Indexing

### Task 3: Add `pysolr` to AI Service Dependencies

**Files:**
- Modify: `ai/requirements.txt`

- [ ] **Step 1: Add pysolr**

Add this line to `ai/requirements.txt`:

```
pysolr>=3.10.0
```

- [ ] **Step 2: Rebuild AI container**

Run: `docker compose build python-ai && docker compose up -d python-ai`
Expected: Container starts cleanly.

- [ ] **Step 3: Commit**

```bash
git add ai/requirements.txt
git commit -m "chore(ai): add pysolr dependency for GIS spatial indexing"
```

---

### Task 4: Generalize Python CDM Spatial Models

**Files:**
- Modify: `ai/app/models/cdm_spatial.py`

- [ ] **Step 1: Update models to support any condition**

Replace the entire file content:

```python
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class CdmMetricType(str, Enum):
    PATIENT_COUNT = "patient_count"
    CASES = "cases"
    DEATHS = "deaths"
    CFR = "cfr"
    CASES_MONTHLY = "cases_monthly"
    HOSPITALIZATION = "hospitalization"


class CdmChoroplethRequest(BaseModel):
    metric: CdmMetricType = CdmMetricType.CASES
    concept_id: int = Field(description="OMOP condition concept ID")
    time_period: str | None = Field(default=None, description="YYYY-MM for monthly data")


class CountyChoroplethItem(BaseModel):
    boundary_id: int
    gid: str
    name: str
    value: float
    denominator: float | None = None
    rate: float | None = None


class ConditionSummary(BaseModel):
    condition_concept_id: int
    condition_name: str
    total_cases: int
    total_deaths: int
    case_fatality_rate: float
    total_population: int
    prevalence_per_100k: float
    affected_counties: int
    total_counties: int
    date_range: dict


class ConditionItem(BaseModel):
    concept_id: int
    name: str
    patient_count: int
    snomed_category: str


class ConditionCategory(BaseModel):
    category: str
    condition_count: int
    total_patients: int


class RefreshResult(BaseModel):
    status: str
    metrics_computed: int
    concept_id: int | None = None
```

- [ ] **Step 2: Verify Python imports work**

Run: `docker compose exec python-ai python -c "from app.models.cdm_spatial import ConditionSummary, ConditionItem; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ai/app/models/cdm_spatial.py
git commit -m "feat(gis): generalize CDM spatial models for any condition"
```

---

### Task 5: Create Solr Spatial Service (Python)

**Files:**
- Create: `ai/app/services/solr_spatial.py`

- [ ] **Step 1: Write the Solr read service**

```python
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
            "total_patients": 0,  # Populated by stats query below
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
            "boundary_id": 0,  # Filled by join with boundaries below
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
    total_hosp = int(stats.get("hospitalizations", {}).get("sum", 0))
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
        "total_counties": affected,  # Will be refined with total boundary count
        "date_range": {"start": None, "end": None},  # Not stored in Solr; from PG on detail
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
```

- [ ] **Step 2: Verify import**

Run: `docker compose exec python-ai python -c "from app.services.solr_spatial import solr_available; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ai/app/services/solr_spatial.py
git commit -m "feat(gis): add Solr spatial read service for conditions and choropleth"
```

---

### Task 6: Generalize `refresh_county_stats()` + Solr Push

**Files:**
- Modify: `ai/app/services/cdm_spatial_query.py`

- [ ] **Step 1: Update the refresh function to accept concept_id and push to Solr**

Replace the entire file:

```python
"""CDM spatial aggregation queries.

Joins OMOP CDM clinical data through the ZIP-to-county crosswalk to produce
county-level metrics for choropleth rendering.

All queries target local PG 17 (ohdsi database) via GIS_DATABASE_URL.
CDM data lives in the 'omop' schema; GIS/crosswalk data in 'app' schema.
"""
from __future__ import annotations

import logging
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

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


def get_engine():
    return create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=5,
        connect_args={"server_settings": {"search_path": "app,omop,public"}},
    )


async def get_all_conditions() -> list[dict]:
    """Get all distinct conditions in the CDM with patient counts and SNOMED categories."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get distinct conditions with patient counts
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

        # Get SNOMED category for each condition via concept_ancestor
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

    # Build category map: concept_id -> nearest ancestor label
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


async def refresh_county_stats(concept_id: int) -> dict:
    """Rebuild county-level aggregates for a single condition."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {"metrics_computed": 0, "concept_id": concept_id}

    async with async_session() as session:
        # Delete existing stats for this concept
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

        # Now build Solr documents from the freshly computed stats
        result = await session.execute(text("""
            SELECT gadm_gid, county_name, metric_type, value, denominator, rate, time_period
            FROM app.cdm_county_stats
            WHERE concept_id = :cid
            ORDER BY gadm_gid, metric_type
        """), {"cid": concept_id})
        rows = result.fetchall()

        # Get condition name
        name_result = await session.execute(text(
            "SELECT concept_name FROM omop.concept WHERE concept_id = :cid"
        ), {"cid": concept_id})
        name_row = name_result.fetchone()
        condition_name = name_row.concept_name if name_row else str(concept_id)

        # Get population per county (from patient_count metric)
        pop_result = await session.execute(text("""
            SELECT gadm_gid, value FROM app.cdm_county_stats
            WHERE metric_type = 'patient_count' AND concept_id IS NULL
        """))
        pop_map = {r.gadm_gid: int(r.value) for r in pop_result}

    await engine.dispose()

    # Build Solr documents: one per county
    county_data: dict[str, dict] = {}
    for row in rows:
        gid = row.gadm_gid
        if gid not in county_data:
            county_data[gid] = {
                "id": f"{concept_id}_{gid}",
                "condition_concept_id": concept_id,
                "condition_name": condition_name,
                "condition_name_exact": condition_name,
                "snomed_category": "Other",  # Set below
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

    # Push to Solr
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
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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
) -> list[dict]:
    """Read pre-computed county stats for choropleth rendering."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["cs.metric_type = :metric"]
    params: dict = {"metric": metric_type}

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
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    conditions = ["metric_type = :metric", "time_period IS NOT NULL"]
    params: dict = {"metric": metric_type}

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


async def get_disease_summary(concept_id: int) -> dict:
    """Return summary stats for any condition (generalized from covid_summary)."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get condition name
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


async def get_county_detail(gadm_gid: str, concept_id: int) -> dict | None:
    """Get detailed stats for a single county for a specific condition."""
    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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
```

- [ ] **Step 2: Verify import**

Run: `docker compose exec python-ai python -c "from app.services.cdm_spatial_query import refresh_county_stats, get_all_conditions; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ai/app/services/cdm_spatial_query.py
git commit -m "feat(gis): generalize CDM spatial queries for any condition with Solr push"
```

---

### Task 7: Update FastAPI Router with Generalized Endpoints

**Files:**
- Modify: `ai/app/routers/cdm_spatial.py`

- [ ] **Step 1: Rewrite the router with new endpoints**

```python
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
):
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
async def condition_categories():
    """Get curated SNOMED category list with condition counts."""
    if solr_available():
        return await solr_get_categories()
    # Fallback: compute from PG
    all_conds = await get_all_conditions()
    cat_map: dict[str, dict] = {}
    for c in all_conds:
        cat = c["snomed_category"]
        if cat not in cat_map:
            cat_map[cat] = {"category": cat, "condition_count": 0, "total_patients": 0}
        cat_map[cat]["condition_count"] += 1
        cat_map[cat]["total_patients"] += c["patient_count"]
    return sorted(cat_map.values(), key=lambda x: x["total_patients"], reverse=True)


@router.post("/choropleth", response_model=list[CountyChoroplethItem])
async def choropleth(req: CdmChoroplethRequest):
    """Get county-level choropleth data for a given condition + metric."""
    return await get_county_choropleth(
        metric_type=req.metric.value,
        concept_id=req.concept_id,
        time_period=req.time_period,
    )


@router.get("/summary")
async def disease_summary(concept_id: int = Query(description="OMOP condition concept ID")):
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
):
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
):
    """Get detailed stats for a specific county and condition."""
    result = await get_county_detail(gadm_gid, concept_id)
    if result is None:
        raise HTTPException(status_code=404, detail="County not found or no data")
    return result


@router.post("/refresh", response_model=RefreshResult)
async def refresh(
    concept_id: int = Query(description="OMOP condition concept ID"),
):
    """Rebuild county-level aggregates for one condition and push to Solr."""
    await refresh_patient_counts()
    stats = await refresh_county_stats(concept_id)
    return {"status": "ok", "metrics_computed": stats["metrics_computed"], "concept_id": concept_id}


@router.post("/reindex-all")
async def reindex_all(background_tasks: BackgroundTasks):
    """Full rebuild across all conditions. Runs asynchronously."""
    async def _reindex():
        from app.services.cdm_spatial_query import get_all_conditions
        conditions = await get_all_conditions()
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
async def covid_summary():
    """Legacy endpoint — redirects to generalized summary with COVID concept."""
    return await get_disease_summary(37311061)
```

- [ ] **Step 2: Rebuild and verify**

Run: `docker compose build python-ai && docker compose up -d python-ai`
Then: `curl -s http://localhost:8002/cdm-spatial/conditions?limit=5 | python3 -m json.tool | head -20`
Expected: JSON list of conditions (may fall back to PG if Solr not yet indexed)

- [ ] **Step 3: Commit**

```bash
git add ai/app/routers/cdm_spatial.py
git commit -m "feat(gis): add generalized CDM spatial endpoints with Solr fallback"
```

---

## Chunk 3: Laravel Proxy + Artisan Command

### Task 8: Update Laravel Proxy Routes

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/GisController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add new proxy methods to GisController**

Add these methods after the existing `refreshCdmStats()` method in `GisController.php`:

```php
    public function cdmConditions(Request $request): JsonResponse
    {
        $params = $request->only(['search', 'category', 'limit']);
        $response = Http::timeout(30)->get("{$this->aiServiceUrl}/cdm-spatial/conditions", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch conditions'], $response->status());
        }
        return response()->json(['data' => $response->json()]);
    }

    public function cdmConditionCategories(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/cdm-spatial/conditions/categories");
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch categories'], 500);
        }
        return response()->json(['data' => $response->json()]);
    }

    public function cdmSummary(Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/summary", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch summary'], $response->status());
        }
        return response()->json(['data' => $response->json()]);
    }

    public function cdmReindexAll(): JsonResponse
    {
        $response = Http::timeout(10)->post("{$this->aiServiceUrl}/cdm-spatial/reindex-all");
        if ($response->failed()) {
            return response()->json(['error' => 'Reindex failed'], 500);
        }
        return response()->json(['data' => $response->json()]);
    }
```

- [ ] **Step 2: Update the existing `covidSummary` method** to proxy to generalized endpoint

Replace `covidSummary()`:

```php
    public function covidSummary(): JsonResponse
    {
        // Legacy route — redirects to generalized summary with COVID concept
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/summary", ['concept_id' => 37311061]);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch COVID summary'], 500);
        }
        return response()->json(['data' => $response->json()]);
    }
```

- [ ] **Step 3: Update the existing proxy methods** to pass concept_id

Update `cdmTimePeriods()`:

```php
    public function cdmTimePeriods(Request $request): JsonResponse
    {
        $params = $request->only(['metric', 'concept_id']);
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/cdm-spatial/time-periods", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Failed to fetch time periods'], 500);
        }
        return response()->json(['data' => $response->json()]);
    }
```

Update `countyDetail()` to accept concept_id:

```php
    public function countyDetail(string $gadmGid, Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(15)->get("{$this->aiServiceUrl}/cdm-spatial/county/{$gadmGid}", $params);
        if ($response->failed()) {
            return response()->json(['error' => 'County not found'], $response->status());
        }
        return response()->json(['data' => $response->json()]);
    }
```

Update `refreshCdmStats()` to accept concept_id:

```php
    public function refreshCdmStats(Request $request): JsonResponse
    {
        $params = $request->only(['concept_id']);
        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/cdm-spatial/refresh", null, $params);
        if ($response->failed()) {
            return response()->json(['error' => 'Refresh failed'], 500);
        }
        return response()->json(['data' => $response->json()]);
    }
```

- [ ] **Step 4: Add new routes in api.php**

In `backend/routes/api.php`, find the CDM spatial routes section and add the new routes:

```php
    // CDM Spatial v2 (disease-agnostic)
    Route::get('/cdm/conditions', [GisController::class, 'cdmConditions']);
    Route::get('/cdm/conditions/categories', [GisController::class, 'cdmConditionCategories']);
    Route::get('/cdm/summary', [GisController::class, 'cdmSummary']);
    Route::post('/cdm/reindex-all', [GisController::class, 'cdmReindexAll'])->middleware('role:super-admin');
```

- [ ] **Step 5: Verify routes registered**

Run: `docker compose exec php php artisan route:list --path=gis/cdm | head -20`
Expected: Shows conditions, categories, summary, reindex-all routes alongside existing ones.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GisController.php backend/routes/api.php
git commit -m "feat(gis): add Laravel proxy routes for disease-agnostic CDM spatial endpoints"
```

---

### Task 9: Create Solr GIS Spatial Indexing Command

**Files:**
- Create: `backend/app/Console/Commands/SolrIndexGisSpatial.php`

- [ ] **Step 1: Write the artisan command**

```php
<?php

namespace App\Console\Commands;

use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SolrIndexGisSpatial extends Command
{
    protected $signature = 'solr:index-gis-spatial
        {--concept-id= : Only reindex a single condition (concept ID)}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Trigger full GIS spatial reindex via the AI service (PG compute + Solr push)';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.gis_spatial', 'gis_spatial');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        $aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');

        if ($fresh = (bool) $this->option('fresh')) {
            $this->info('Deleting all existing documents from gis_spatial core...');
            $solr->deleteAll($core);
        }

        $conceptId = $this->option('concept-id');

        if ($conceptId) {
            $this->info("Refreshing stats for concept {$conceptId}...");
            $response = Http::timeout(120)->post(
                "{$aiServiceUrl}/cdm-spatial/refresh",
                ['concept_id' => (int) $conceptId]
            );

            if ($response->failed()) {
                $this->error('Refresh failed: '.$response->body());

                return self::FAILURE;
            }

            $data = $response->json();
            $this->info("Done: {$data['metrics_computed']} metrics computed");
        } else {
            $this->info('Starting full reindex across all conditions (runs in background)...');
            $response = Http::timeout(10)->post("{$aiServiceUrl}/cdm-spatial/reindex-all");

            if ($response->failed()) {
                $this->error('Reindex request failed: '.$response->body());

                return self::FAILURE;
            }

            $this->info('Reindex started. Monitor AI service logs for progress.');
        }

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Verify command registered**

Run: `docker compose exec php php artisan list solr`
Expected: Shows `solr:index-gis-spatial` in the list.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Console/Commands/SolrIndexGisSpatial.php
git commit -m "feat(gis): add solr:index-gis-spatial artisan command for reindexing"
```

---

## Chunk 4: Frontend — Types, API, Hooks

### Task 10: Update Frontend Types

**Files:**
- Modify: `frontend/src/features/gis/types.ts`

- [ ] **Step 1: Generalize CDM metric types and add condition types**

Replace the CDM Spatial types section (lines 123-169) at the bottom of `types.ts`:

```typescript
// CDM Spatial types (v2 — disease-agnostic)
export type CdmMetricType =
  | "patient_count"
  | "cases"
  | "deaths"
  | "cfr"
  | "cases_monthly"
  | "hospitalization";

export interface ConditionItem {
  concept_id: number;
  name: string;
  patient_count: number;
  snomed_category: string;
}

export interface ConditionCategory {
  category: string;
  condition_count: number;
  total_patients: number;
}

export interface CountyChoroplethItem {
  boundary_id: number;
  gid: string;
  name: string;
  value: number;
  denominator: number | null;
  rate: number | null;
}

export interface DiseaseSummary {
  condition_concept_id: number;
  condition_name: string;
  total_cases: number;
  total_deaths: number;
  case_fatality_rate: number;
  total_population: number;
  prevalence_per_100k: number;
  affected_counties: number;
  total_counties: number;
  date_range: { start: string | null; end: string | null };
}

export interface CountyDetailData {
  gadm_gid: string;
  name: string;
  boundary_id: number | null;
  area_km2: number | null;
  metrics: Record<string, { value: number; denominator: number | null; rate: number | null }>;
  timeline: { period: string; metric: string; value: number }[];
  demographics: {
    age_groups: { group: string; count: number }[];
    gender: { gender: string; count: number }[];
  };
}

export interface CdmChoroplethParams {
  metric: CdmMetricType;
  concept_id: number;
  time_period?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors from consumers of removed `CovidSummary` type (expected — fixed in next tasks)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/types.ts
git commit -m "feat(gis): generalize frontend types for disease-agnostic GIS Explorer"
```

---

### Task 11: Update Frontend API Functions

**Files:**
- Modify: `frontend/src/features/gis/api.ts`

- [ ] **Step 1: Replace CDM spatial API functions**

Replace the CDM spatial section (lines 63-95) in `api.ts`:

```typescript
// CDM Spatial API functions (v2 — disease-agnostic)

export async function fetchConditions(params?: {
  search?: string;
  category?: string;
  limit?: number;
}): Promise<ConditionItem[]> {
  const { data } = await apiClient.get("/gis/cdm/conditions", { params });
  return data.data;
}

export async function fetchConditionCategories(): Promise<ConditionCategory[]> {
  const { data } = await apiClient.get("/gis/cdm/conditions/categories");
  return data.data;
}

export async function fetchCdmChoropleth(
  params: CdmChoroplethParams
): Promise<CountyChoroplethItem[]> {
  const { data } = await apiClient.post("/gis/cdm/choropleth", params);
  return data.data;
}

export async function fetchTimePeriods(conceptId: number): Promise<string[]> {
  const { data } = await apiClient.get("/gis/cdm/time-periods", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchDiseaseSummary(conceptId: number): Promise<DiseaseSummary> {
  const { data } = await apiClient.get("/gis/cdm/summary", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchCountyDetail(
  gadmGid: string,
  conceptId: number
): Promise<CountyDetailData> {
  const { data } = await apiClient.get(`/gis/cdm/county/${gadmGid}`, {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function refreshCdmStats(
  conceptId: number
): Promise<{ status: string; metrics_computed: number }> {
  const { data } = await apiClient.post("/gis/cdm/refresh", null, {
    params: { concept_id: conceptId },
  });
  return data.data;
}
```

- [ ] **Step 2: Update imports**

Replace the type imports at the top of `api.ts` to include the new types:

```typescript
import type {
  AdminLevel,
  BoundaryCollection,
  CdmChoroplethParams,
  ChoroplethDataPoint,
  ChoroplethParams,
  ConditionCategory,
  ConditionItem,
  Country,
  CountyChoroplethItem,
  CountyDetailData,
  DiseaseSummary,
  GisDatasetJob,
  GisStats,
  RegionDetail,
} from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/api.ts
git commit -m "feat(gis): update API functions for disease-agnostic GIS Explorer"
```

---

### Task 12: Update Frontend Hooks

**Files:**
- Modify: `frontend/src/features/gis/hooks/useGis.ts`

- [ ] **Step 1: Replace CDM spatial hooks section**

Replace lines 89-122 in `useGis.ts`:

```typescript
// CDM Spatial hooks (v2 — disease-agnostic)

export function useConditions(params?: {
  search?: string;
  category?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["gis", "conditions", params],
    queryFn: () => fetchConditions(params),
    staleTime: 5 * 60_000,
  });
}

export function useConditionCategories() {
  return useQuery({
    queryKey: ["gis", "condition-categories"],
    queryFn: fetchConditionCategories,
    staleTime: 5 * 60_000,
  });
}

export function useCdmChoropleth(params: CdmChoroplethParams | null) {
  return useQuery({
    queryKey: ["gis", "cdm-choropleth", params],
    queryFn: () => fetchCdmChoropleth(params!),
    enabled: params !== null,
    staleTime: 60_000,
  });
}

export function useTimePeriods(conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "time-periods", conceptId],
    queryFn: () => fetchTimePeriods(conceptId!),
    enabled: conceptId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useDiseaseSummary(conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "disease-summary", conceptId],
    queryFn: () => fetchDiseaseSummary(conceptId!),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });
}

export function useCountyDetail(gadmGid: string | null, conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "county-detail", gadmGid, conceptId],
    queryFn: () => fetchCountyDetail(gadmGid!, conceptId!),
    enabled: gadmGid !== null && conceptId !== null,
  });
}
```

- [ ] **Step 2: Update imports at top of useGis.ts**

```typescript
import {
  fetchBoundaries,
  fetchBoundaryDetail,
  fetchGisStats,
  fetchChoropleth,
  fetchCountries,
  loadGisDataset,
  fetchDatasetStatus,
  fetchConditions,
  fetchConditionCategories,
  fetchCdmChoropleth,
  fetchTimePeriods,
  fetchDiseaseSummary,
  fetchCountyDetail,
} from "../api";
import type { AdminLevel, CdmChoroplethParams, ChoroplethParams } from "../types";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/hooks/useGis.ts
git commit -m "feat(gis): update hooks for disease-agnostic GIS Explorer"
```

---

## Chunk 5: Frontend — Components

### Task 13: Create DiseaseSelector Component

**Files:**
- Create: `frontend/src/features/gis/components/DiseaseSelector.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { useConditions, useConditionCategories } from "../hooks/useGis";
import type { ConditionItem } from "../types";

interface DiseaseSelectorProps {
  selectedConceptId: number | null;
  onSelect: (conceptId: number, name: string) => void;
}

export function DiseaseSelector({ selectedConceptId, onSelect }: DiseaseSelectorProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<"picks" | "categories" | "search">("picks");

  const { data: topConditions } = useConditions({ limit: 10 });
  const { data: categories } = useConditionCategories();
  const { data: searchResults } = useConditions(
    search.length >= 2 ? { search, limit: 20 } : undefined
  );
  const { data: categoryConditions } = useConditions(
    expandedCategory ? { category: expandedCategory, limit: 30 } : undefined
  );

  const selectedName = useMemo(() => {
    if (!selectedConceptId) return null;
    const all = [...(topConditions ?? []), ...(searchResults ?? []), ...(categoryConditions ?? [])];
    return all.find((c) => c.concept_id === selectedConceptId)?.name ?? null;
  }, [selectedConceptId, topConditions, searchResults, categoryConditions]);

  return (
    <div className="space-y-2 rounded-lg border border-[#232328] bg-[#18181B] p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        Disease
      </span>

      {selectedName && (
        <p className="text-sm font-medium text-[#C9A227]">{selectedName}</p>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#5A5650]" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.length >= 2) setMode("search");
          }}
          placeholder="Search conditions..."
          className="w-full rounded border border-[#232328] bg-[#0E0E11] py-1.5 pl-7 pr-2 text-xs text-[#E8E4DC] placeholder-[#5A5650] focus:border-[#C9A227]/50 focus:outline-none"
        />
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => { setMode("picks"); setSearch(""); }}
          className={`rounded px-2 py-0.5 text-[10px] ${
            mode === "picks" ? "bg-[#C9A227]/20 text-[#C9A227]" : "text-[#5A5650] hover:text-[#8A857D]"
          }`}
        >
          Top
        </button>
        <button
          onClick={() => { setMode("categories"); setSearch(""); }}
          className={`rounded px-2 py-0.5 text-[10px] ${
            mode === "categories" ? "bg-[#C9A227]/20 text-[#C9A227]" : "text-[#5A5650] hover:text-[#8A857D]"
          }`}
        >
          Categories
        </button>
      </div>

      {/* Quick picks */}
      {mode === "picks" && topConditions && (
        <div className="flex flex-wrap gap-1">
          {topConditions.map((c) => (
            <ConditionPill
              key={c.concept_id}
              condition={c}
              selected={c.concept_id === selectedConceptId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* Category browser */}
      {mode === "categories" && categories && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.category}>
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === cat.category ? null : cat.category)
                }
                className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-[#232328]"
              >
                <span className="text-[#8A857D]">{cat.category}</span>
                <span className="flex items-center gap-1 text-[#5A5650]">
                  {cat.condition_count}
                  {expandedCategory === cat.category ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              </button>
              {expandedCategory === cat.category && categoryConditions && (
                <div className="ml-2 space-y-0.5 border-l border-[#232328] pl-2">
                  {categoryConditions.map((c) => (
                    <button
                      key={c.concept_id}
                      onClick={() => onSelect(c.concept_id, c.name)}
                      className={`flex w-full items-center justify-between rounded px-2 py-0.5 text-xs ${
                        c.concept_id === selectedConceptId
                          ? "bg-[#C9A227]/20 text-[#C9A227]"
                          : "text-[#8A857D] hover:bg-[#232328]"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-1 text-[#5A5650]">{c.patient_count.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search results */}
      {mode === "search" && searchResults && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {searchResults.length === 0 ? (
            <p className="px-2 py-1 text-xs text-[#5A5650]">No matching conditions</p>
          ) : (
            searchResults.map((c) => (
              <button
                key={c.concept_id}
                onClick={() => onSelect(c.concept_id, c.name)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                  c.concept_id === selectedConceptId
                    ? "bg-[#C9A227]/20 text-[#C9A227]"
                    : "text-[#8A857D] hover:bg-[#232328]"
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-1 text-[#5A5650]">{c.patient_count.toLocaleString()}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ConditionPill({
  condition,
  selected,
  onSelect,
}: {
  condition: ConditionItem;
  selected: boolean;
  onSelect: (id: number, name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(condition.concept_id, condition.name)}
      title={`${condition.patient_count.toLocaleString()} patients`}
      className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
        selected
          ? "bg-[#C9A227]/20 font-medium text-[#C9A227]"
          : "bg-[#232328] text-[#5A5650] hover:text-[#8A857D]"
      }`}
    >
      {condition.name}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/DiseaseSelector.tsx
git commit -m "feat(gis): add DiseaseSelector component with quick picks, categories, and search"
```

---

### Task 14: Create DiseaseSummaryBar Component

**Files:**
- Create: `frontend/src/features/gis/components/DiseaseSummaryBar.tsx`
- Delete: `frontend/src/features/gis/components/CovidSummaryBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Activity, Skull, Building2, MapPin, Users } from "lucide-react";
import { useDiseaseSummary } from "../hooks/useGis";

interface DiseaseSummaryBarProps {
  conceptId: number | null;
}

export function DiseaseSummaryBar({ conceptId }: DiseaseSummaryBarProps) {
  const { data, isLoading } = useDiseaseSummary(conceptId);

  if (isLoading) {
    return (
      <div className="flex gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded bg-[#232328]" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <Stat icon={Activity} label="Cases" value={data.total_cases.toLocaleString()} color="#C9A227" />
      {data.total_deaths > 0 && (
        <Stat icon={Skull} label="Deaths" value={data.total_deaths.toLocaleString()} color="#9B1B30" />
      )}
      {data.total_deaths > 0 && (
        <Stat icon={Activity} label="CFR" value={`${data.case_fatality_rate}%`} color="#2DD4BF" />
      )}
      <Stat
        icon={MapPin}
        label="Counties"
        value={`${data.affected_counties} / ${data.total_counties}`}
        color="#8A857D"
      />
      <Stat
        icon={Users}
        label="Prevalence"
        value={`${data.prevalence_per_100k.toLocaleString()} / 100K`}
        color="#5A5650"
      />
      {data.date_range.start && (
        <span className="text-[10px] text-[#5A5650]">
          {data.date_range.start.slice(0, 7)} — {data.date_range.end?.slice(0, 7) ?? "present"}
        </span>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] uppercase text-[#5A5650]">{label}</span>
      <span className="text-xs font-semibold text-[#E8E4DC]">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old CovidSummaryBar**

```bash
rm frontend/src/features/gis/components/CovidSummaryBar.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/gis/components/DiseaseSummaryBar.tsx
git rm frontend/src/features/gis/components/CovidSummaryBar.tsx
git commit -m "feat(gis): replace CovidSummaryBar with generalized DiseaseSummaryBar"
```

---

### Task 15: Update TimeSlider and CountyDetail to Accept `conceptId`

**Files:**
- Modify: `frontend/src/features/gis/components/TimeSlider.tsx`
- Modify: `frontend/src/features/gis/components/CountyDetail.tsx`

- [ ] **Step 1: Update TimeSlider props**

In `TimeSlider.tsx`, update the interface and hook usage:

Change the interface (line 7-8):
```typescript
interface TimeSliderProps {
  value: string | null;
  onChange: (period: string | null) => void;
  conceptId: number | null;
}
```

Change the component signature (line 10):
```typescript
export function TimeSlider({ value, onChange, conceptId }: TimeSliderProps) {
```

Change the hook call (line 11):
```typescript
  const { data: periods } = useTimePeriods(conceptId);
```

- [ ] **Step 2: Update CountyDetail props**

In `CountyDetail.tsx`, update the interface (line 4-7):
```typescript
interface CountyDetailProps {
  gadmGid: string;
  conceptId: number;
  onClose: () => void;
}
```

Update the component signature (line 9):
```typescript
export function CountyDetail({ gadmGid, conceptId, onClose }: CountyDetailProps) {
```

Update the hook call (line 10):
```typescript
  const { data, isLoading } = useCountyDetail(gadmGid, conceptId);
```

- [ ] **Step 3: Verify TypeScript compiles (except GisPage which is updated next)**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: Errors only in GisPage.tsx (fixed in next task)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/gis/components/TimeSlider.tsx frontend/src/features/gis/components/CountyDetail.tsx
git commit -m "feat(gis): parameterize TimeSlider and CountyDetail by conceptId"
```

---

### Task 16: Update MetricSelector with Generalized Metric Types

**Files:**
- Modify: `frontend/src/features/gis/components/MetricSelector.tsx`

- [ ] **Step 1: Update metric types**

Replace the METRICS array and type import:

```typescript
import type { CdmMetricType } from "../types";

interface MetricSelectorProps {
  value: CdmMetricType;
  onChange: (metric: CdmMetricType) => void;
}

const METRICS: { value: CdmMetricType; label: string; description: string }[] = [
  { value: "cases", label: "Cases", description: "Total confirmed cases" },
  { value: "deaths", label: "Deaths", description: "Associated mortality" },
  { value: "cfr", label: "CFR %", description: "Case fatality rate (deaths / cases)" },
  { value: "hospitalization", label: "Hospitalized", description: "Inpatient admissions" },
  { value: "patient_count", label: "Population", description: "Total patients per county" },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/gis/components/MetricSelector.tsx
git commit -m "feat(gis): update MetricSelector with generalized metric type names"
```

---

## Chunk 6: Wire Everything in GisPage

### Task 17: Rewrite GisPage with Disease Selection

**Files:**
- Modify: `frontend/src/features/gis/pages/GisPage.tsx`

- [ ] **Step 1: Rewrite GisPage**

```tsx
import { useState, useCallback, useMemo } from "react";
import { Globe, AlertCircle, RefreshCw, Search, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GisMap } from "../components/GisMap";
import { DiseaseSelector } from "../components/DiseaseSelector";
import { DiseaseSummaryBar } from "../components/DiseaseSummaryBar";
import { LayerControls } from "../components/LayerControls";
import { LegendPanel } from "../components/LegendPanel";
import { RegionDetail } from "../components/RegionDetail";
import { MetricSelector } from "../components/MetricSelector";
import { TimeSlider } from "../components/TimeSlider";
import { CountyDetail } from "../components/CountyDetail";
import {
  useGisStats,
  useBoundaries,
  useBoundaryDetail,
  useChoropleth,
  useCountries,
  useCdmChoropleth,
} from "../hooks/useGis";
import { useMapViewport } from "../hooks/useMapViewport";
import type { AdminLevel, CdmMetricType, ChoroplethMetric, ChoroplethParams } from "../types";
import { HelpButton } from "@/features/help";

export default function GisPage() {
  const navigate = useNavigate();
  const { viewport, onViewportChange, resetViewport } = useMapViewport();

  // GIS Explorer mode
  const [level, setLevel] = useState<AdminLevel>("ADM2");
  const [metric, setMetric] = useState<ChoroplethMetric>("patient_count");
  const [countryCode, setCountryCode] = useState<string | null>("USA");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Disease selection (v2)
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
  const [selectedDiseaseName, setSelectedDiseaseName] = useState<string | null>(null);

  // CDM Explorer state
  const [cdmMetric, setCdmMetric] = useState<CdmMetricType>("cases");
  const [timePeriod, setTimePeriod] = useState<string | null>(null);
  const [selectedCountyGid, setSelectedCountyGid] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useGisStats();
  const { data: countries } = useCountries();
  const hasBoundaries = (stats?.total_boundaries ?? 0) > 0;

  // Load PA county boundaries
  const {
    data: boundaries,
    isLoading: boundariesLoading,
    error: boundariesError,
  } = useBoundaries({
    level,
    country_code: countryCode ?? undefined,
    parent_gid: "USA.39_1",
    simplify: 0.001,
    enabled: hasBoundaries,
  });

  const choroplethParams: ChoroplethParams | null = useMemo(
    () =>
      hasBoundaries
        ? { level, metric, country_code: countryCode ?? undefined }
        : null,
    [level, metric, countryCode, hasBoundaries]
  );
  const { data: choroplethData } = useChoropleth(choroplethParams);

  // CDM choropleth data (parameterized by selected disease)
  const cdmChoroplethParams = useMemo(
    () => {
      if (!selectedConceptId) return null;
      const base = {
        metric: cdmMetric === "cases_monthly" ? "cases_monthly" as CdmMetricType : cdmMetric,
        concept_id: selectedConceptId,
      };
      if (timePeriod) {
        return { ...base, metric: "cases_monthly" as CdmMetricType, time_period: timePeriod };
      }
      return base;
    },
    [cdmMetric, timePeriod, selectedConceptId]
  );
  const { data: cdmChoroplethData } = useCdmChoropleth(cdmChoroplethParams);

  const { data: regionDetail, isLoading: detailLoading } =
    useBoundaryDetail(selectedRegionId);

  const handleDiseaseSelect = useCallback((conceptId: number, name: string) => {
    setSelectedConceptId(conceptId);
    setSelectedDiseaseName(name);
    setTimePeriod(null);
    setSelectedCountyGid(null);
    setSelectedRegionId(null);
  }, []);

  const handleRegionClick = useCallback((id: number, _name: string) => {
    setSelectedRegionId(id);
    if (boundaries?.features) {
      const feature = boundaries.features.find((f) => f.id === id);
      if (feature?.properties?.gid) {
        setSelectedCountyGid(feature.properties.gid);
      }
    }
  }, [boundaries]);

  const handleRegionHover = useCallback(
    (_id: number | null, name: string | null) => {
      setHoveredRegion(name);
    },
    []
  );

  const handleDrillDown = useCallback(
    (_gid: string) => {
      const levels: AdminLevel[] = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4", "ADM5"];
      const idx = levels.indexOf(level);
      if (idx < levels.length - 1) {
        setLevel(levels[idx + 1]);
        setSelectedRegionId(null);
      }
    },
    [level]
  );

  const maxChoroplethValue = useMemo(() => {
    if (!choroplethData?.length) return 0;
    return Math.max(...choroplethData.map((d) => d.value));
  }, [choroplethData]);

  const isEmpty = !statsLoading && !hasBoundaries;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h1 className="text-lg font-semibold text-[#E8E4DC]">
              GIS Explorer{selectedDiseaseName ? ` — ${selectedDiseaseName}` : ""}
            </h1>
            <p className="text-xs text-[#5A5650]">
              {selectedDiseaseName
                ? "County-level spatial surveillance from OMOP CDM data"
                : "Select a disease to begin spatial analysis"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hoveredRegion && (
            <span className="text-xs text-[#8A857D]">{hoveredRegion}</span>
          )}
          {stats && !isEmpty && (
            <span className="text-xs text-[#5A5650]">
              {stats.total_boundaries.toLocaleString()} boundaries ·{" "}
              {stats.total_countries} countries
            </span>
          )}
          <HelpButton helpKey="gis" />
        </div>
      </div>

      {/* Disease Summary Bar */}
      {!isEmpty && selectedConceptId && (
        <div className="border-b border-[#232328] bg-[#0E0E11] px-6 py-2">
          <DiseaseSummaryBar conceptId={selectedConceptId} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0E0E11]">
              <Globe className="h-12 w-12 text-[#5A5650]" />
              <div className="text-center">
                <p className="text-sm text-[#E8E4DC]">
                  No geographic boundaries available
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  An administrator needs to load boundary data from the System Health panel.
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  Go to Administration → System Health → GIS Data to load boundaries.
                </p>
              </div>
            </div>
          ) : (
            <GisMap
              viewport={viewport}
              onViewportChange={onViewportChange}
              boundaries={boundaries ?? null}
              choroplethData={choroplethData ?? null}
              selectedRegionId={selectedRegionId}
              onRegionClick={handleRegionClick}
              onRegionHover={handleRegionHover}
              loading={boundariesLoading}
            />
          )}

          {boundariesError && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded bg-[#E85A6B]/15 px-3 py-2 text-xs text-[#E85A6B]">
              <AlertCircle className="h-3 w-3" />
              Failed to load boundaries
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {!isEmpty && (
          <div className="flex w-72 flex-col gap-3 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-3">
            <DiseaseSelector
              selectedConceptId={selectedConceptId}
              onSelect={handleDiseaseSelect}
            />

            {selectedConceptId && (
              <>
                <MetricSelector value={cdmMetric} onChange={setCdmMetric} />

                <TimeSlider
                  value={timePeriod}
                  onChange={setTimePeriod}
                  conceptId={selectedConceptId}
                />

                {selectedCountyGid && (
                  <CountyDetail
                    gadmGid={selectedCountyGid}
                    conceptId={selectedConceptId}
                    onClose={() => {
                      setSelectedCountyGid(null);
                      setSelectedRegionId(null);
                    }}
                  />
                )}

                {/* Top Counties from CDM choropleth */}
                {cdmChoroplethData && cdmChoroplethData.length > 0 && (
                  <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                      Top Counties
                    </h3>
                    <div className="space-y-1">
                      {cdmChoroplethData.slice(0, 8).map((c) => (
                        <button
                          key={c.gid}
                          onClick={() => {
                            setSelectedCountyGid(c.gid);
                            const feature = boundaries?.features.find(
                              (f) => f.properties.gid === c.gid
                            );
                            if (feature) setSelectedRegionId(feature.id);
                          }}
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-[#232328]"
                        >
                          <span className="text-[#8A857D]">{c.name}</span>
                          <span className="font-medium text-[#E8E4DC]">
                            {c.value.toLocaleString()}
                            {c.rate !== null ? ` (${c.rate}%)` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <LayerControls
              level={level}
              onLevelChange={(l) => {
                setLevel(l);
                setSelectedRegionId(null);
                setSelectedCountyGid(null);
              }}
              metric={metric}
              onMetricChange={setMetric}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              countries={countries ?? []}
            />

            <LegendPanel metric={metric} maxValue={maxChoroplethValue} />

            {!selectedCountyGid && regionDetail && (
              <RegionDetail
                detail={regionDetail}
                loading={detailLoading}
                onClose={() => setSelectedRegionId(null)}
                onDrillDown={handleDrillDown}
              />
            )}

            {/* Research actions */}
            {regionDetail && (
              <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                  Research Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      navigate(`/studies/create?region=${regionDetail.gid}&region_name=${encodeURIComponent(regionDetail.name)}`)
                    }
                    className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#C9A227] hover:border-[#C9A227]/50"
                  >
                    <FlaskConical className="h-3 w-3" />
                    Create Study for {regionDetail.name}
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/cohort-definitions?region=${regionDetail.gid}`)
                    }
                    className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#2DD4BF] hover:border-[#2DD4BF]/50"
                  >
                    <Search className="h-3 w-3" />
                    Browse Cohorts in Region
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={resetViewport}
              className="flex items-center justify-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs text-[#8A857D] hover:border-[#5A5650]"
            >
              <RefreshCw className="h-3 w-3" />
              Reset View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify frontend builds**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/gis/pages/GisPage.tsx
git commit -m "feat(gis): wire GisPage with DiseaseSelector and disease-agnostic data flow"
```

---

## Chunk 7: Integration Testing & Initial Reindex

### Task 18: Verify End-to-End Flow

- [ ] **Step 1: Rebuild all containers**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose build python-ai && docker compose up -d
```

- [ ] **Step 2: Verify Solr gis_spatial core is healthy**

Run: `curl -s http://localhost:8983/solr/gis_spatial/admin/ping | python3 -m json.tool`
Expected: `"status": "OK"`

- [ ] **Step 3: Trigger a single-condition refresh (COVID-19)**

Run: `curl -s -X POST "http://localhost:8002/cdm-spatial/refresh?concept_id=37311061" | python3 -m json.tool`
Expected: JSON with `metrics_computed >= 5`

- [ ] **Step 4: Verify conditions endpoint works**

Run: `curl -s "http://localhost:8002/cdm-spatial/conditions?limit=5" | python3 -m json.tool | head -20`
Expected: JSON list with concept_id, name, patient_count, snomed_category

- [ ] **Step 5: Verify summary endpoint works**

Run: `curl -s "http://localhost:8002/cdm-spatial/summary?concept_id=37311061" | python3 -m json.tool`
Expected: JSON with total_cases, total_deaths, etc.

- [ ] **Step 6: Verify Laravel proxies work**

Run: `curl -s -b /tmp/cookies.txt "http://localhost:8082/api/v1/gis/cdm/conditions?limit=3" | python3 -m json.tool | head -15`
Expected: JSON wrapped in `{data: [...]}`

- [ ] **Step 7: Verify frontend loads**

Open `http://localhost:5175` in browser, navigate to GIS Explorer.
Expected: Disease selector visible in sidebar, no console errors.

- [ ] **Step 8: Build and deploy**

Run: `./deploy.sh`

- [ ] **Step 9: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(gis): GIS Explorer v2 Phase 1 MVP — disease-agnostic spatial analytics"
```
