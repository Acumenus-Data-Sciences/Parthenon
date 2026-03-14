# GIS Explorer v2 — Disease-Aware Spatial Analytics

## Overview

The GIS Explorer evolves from a hardcoded COVID-19 Pennsylvania view into a **data-driven disease spatial analytics tool**. It auto-detects available conditions and geography from the OMOP CDM, so the same codebase works with the PA Synthea demo today and any future OMOP dataset deployed globally. The name "GIS Explorer" is retained per OHDSI GIS Workgroup conventions.

**Core change:** Disease selection drives everything. Selecting a condition refreshes the choropleth, summary bar, study/cohort overlays, and county detail panel. Solr handles fast queries (search, choropleth, summaries). PostgreSQL handles deep relational drill-downs (comorbidities, drugs, outcomes).

## Architecture

### Three-Panel Layout

- **Top bar:** Disease summary stats (dynamic, adapts to selected condition)
- **Center:** Map with choropleth + study/cohort region overlays
- **Right sidebar:** Disease selector → metric controls → timeline → county detail (deep drill-down)

### Data Flow

1. On load, query Solr for available conditions (grouped by SNOMED hierarchy with curated labels) and available geographic scope
2. Default to the highest-prevalence condition + the most granular boundary level with data
3. All downstream queries parameterized by `condition_concept_id`
4. No geography hardcoding — geographic scope auto-detected from CDM data

### Components Replaced

| v1 Component | v2 Replacement | Reason |
|--------------|---------------|--------|
| `CovidSummaryBar` | `DiseaseSummaryBar` | Generalized for any condition |
| `MetricSelector` | `MetricSelector` (updated) | Same pattern, same metrics, parameterized by concept_id |
| `TimeSlider` | `TimeSlider` (updated) | Takes concept_id parameter |
| `CountyDetail` | `CountyDetail` (major expansion) | 9 collapsible sections |
| `LayerControls` | `DiseaseSelector` + simplified layer controls | Disease selection is primary; admin level secondary |
| `RegionDetail` | Merged into `CountyDetail` | Redundant with expanded county detail |
| `LegendPanel` | `LegendPanel` (kept) | Adapts label to selected metric |

---

## Disease Selector

### Component: `DiseaseSelector`

Three modes of access:

**1. Quick picks:** Top 10 conditions by prevalence, always visible as pill buttons. Queried from Solr at page load, not hardcoded. Example: Gingivitis (822K), Viral Sinusitis (639K), Hypertension (380K), Anemia (373K), etc.

**2. Category browser:** ~10-12 curated category groups derived from SNOMED `concept_ancestor` hierarchy. Categories use researcher-friendly labels, not raw SNOMED names. Clicking a category expands to show conditions within it, sorted by patient count.

Curated categories:
- Cardiovascular
- Respiratory
- Metabolic / Endocrine
- Infectious Disease
- Musculoskeletal
- Mental Health / Behavioral
- Renal / Urological
- Dental / Oral Health
- Gastrointestinal
- Neurological
- Injury / Trauma
- Other

**3. Search:** Fuzzy search input across all conditions, powered by Solr.

### Backend

New endpoint `GET /cdm-spatial/conditions` returns conditions with patient counts and SNOMED category assignments. Categories derived by querying `concept_ancestor` for each condition's nearest ancestor in a curated set of high-level SNOMED concepts. Results cached in Solr `gis_spatial` core.

New endpoint `GET /cdm-spatial/conditions/categories` returns category list with condition counts per category via Solr faceting.

---

## Disease Summary Bar

### Component: `DiseaseSummaryBar`

Replaces `CovidSummaryBar`. Dynamically populated based on selected condition:

- **Total cases** (distinct patients with condition)
- **Deaths** (patients with condition who died)
- **CFR %** (deaths / cases)
- **Affected regions** (counties with >= 1 case / total counties)
- **Prevalence per 100K** (cases / total population)
- **Hospitalizations** (inpatient visits with this condition)
- **Date range** (earliest to latest condition_start_date)

Labels are generic ("Cases" not "COVID-19 Cases") since the selected disease name is shown in the disease selector. Stats with zero values auto-hide.

---

## Metric Controls & Map Rendering

### Component: `MetricSelector` (updated)

Available metrics for any disease:
- **Cases** — distinct patients with condition per county
- **Deaths** — patients who died with this condition
- **CFR %** — case fatality rate
- **Hospitalizations** — inpatient visits with this condition
- **Prevalence** — cases per county population (rate)
- **Population** — total patients per county (context metric)

### Component: `TimeSlider` (updated)

Same behavior, but queries time periods for the selected condition (parameterized by `concept_id`).

### Map Rendering

- Choropleth colors by selected metric for selected disease — same gradient (dark -> crimson -> gold)
- Study/cohort overlays render as **teal dashed border** on counties with active studies, visually distinct from fill color
- Hover shows disease metric tooltip AND study name if applicable
- `LegendPanel` adapts label to selected metric name

### Backend

`cdm_spatial_query.py` generalizes — `refresh_county_stats()` takes a `concept_id` parameter. Stats cached per condition in `cdm_county_stats` with existing `concept_id` column.

---

## County Detail Panel (Rich Drill-Down)

### Component: `CountyDetail` (major expansion)

When a county is clicked, the sidebar shows a deep detail panel with **9 collapsible accordion sections**. Sections with no data auto-collapse.

### Section A — Key Metrics Grid
2-column cards: Cases, Deaths, CFR, Hospitalizations, Population, Prevalence rate.

### Section B — Comorbidity Breakdown
Top 10 co-occurring conditions for patients with the selected disease in this county. Horizontal bar chart showing overlap count (e.g., "Hypertension: 2,340 of 8,893 cases"). Queried via `condition_occurrence` self-join on `person_id`.

### Section C — Treatment / Drug Exposure
Top 10 medications prescribed to patients with this condition in this county. Joins `drug_exposure` -> `person` -> `location` -> crosswalk. Shows drug name + patient count.

### Section D — Visit Type Distribution
Horizontal stacked bar: Inpatient vs Outpatient vs ER vs Other. From `visit_occurrence.visit_concept_id` (9201=inpatient, 9202=outpatient, 9203=ER).

### Section E — Mortality & Outcomes
- Death rate for this condition vs county average
- Average observation period length for affected patients
- Readmission signal (patients with >1 inpatient visit within 30 days)

### Section F — Demographics
- Age distribution (horizontal bars)
- Gender breakdown
- Race/ethnicity if available in CDM

### Section G — Temporal Trends
Full monthly bar chart with trend line. Shows both case incidence and cumulative cases. Replaces the v1 sparkline.

### Section H — Benchmarking
"This county vs state average" comparison for key metrics. Arrow or delta indicators (above/below average).

### Section I — Studies & Cohorts
Studies active in this county that reference the selected condition. Cohort definitions with patients in this county matching the condition. Clickable links to study/cohort detail pages. If none exist: "No active studies for [condition]. Create one?" with pre-populated link.

### Backend

New endpoint `GET /cdm-spatial/county/{gid}/detail?concept_id=X` returns all sections in one response. Heavy relational query, but runs only on click.

---

## Study & Cohort Map Integration

### Geographic Derivation

Studies don't have direct geography. Geography is derived by:

1. **Study -> StudyCohort -> CohortDefinition -> expression_json:** Extract concept IDs from cohort criteria
2. **Match concept IDs against selected disease:** If the cohort references the selected condition concept (or a descendant via `concept_ancestor`), the study is relevant
3. **Study -> StudySite -> Source -> CDM patients -> location -> crosswalk -> counties:** Determine which counties have patients from that study's sites

### Map Overlay

Counties with active study presence get a **teal dashed border overlay**. Multiple studies = thicker border. Overlay sits on top of the disease choropleth without interfering with fill colors.

### Sidebar Integration

Below the metric selector, a collapsible "Studies & Cohorts" section shows matched studies/cohorts for the selected disease:
- Each entry: study title, status, patient count, number of counties
- Clicking highlights its counties on the map
- "View Study" link navigates to study detail page

### Filtering

Studies/cohorts are **filtered by selected disease** (option B from brainstorming). Only studies whose cohort definitions reference the currently selected condition concept appear.

### Backend

New endpoint `GET /cdm-spatial/studies?concept_id=X` returns studies with geographic footprints matching the condition.

---

## Solr Integration

### New Core: `gis_spatial`

~17K documents (258 conditions x 67 counties) for sub-second faceted queries.

### Document Structure

```json
{
  "id": "37311061_USA.39.51_1",
  "condition_concept_id": 37311061,
  "condition_name": "COVID-19",
  "snomed_category": "Infectious disease",
  "gadm_gid": "USA.39.51_1",
  "county_name": "Philadelphia",
  "parent_gid": "USA.39_1",
  "cases": 8893,
  "deaths": 185,
  "cfr": 2.08,
  "hospitalizations": 651,
  "population": 106888,
  "prevalence_per_100k": 8320.5,
  "time_periods": ["2020-03", "2020-04"],
  "monthly_cases": [120, 340],
  "updated_at": "2026-03-11T18:00:00Z"
}
```

### What Solr Handles

| Query | PG Time | Solr Time | Speedup |
|-------|---------|-----------|---------|
| Conditions list (258 conditions, patient counts) | 3,560 ms | ~5 ms | 712x |
| SNOMED category grouping | 14,397 ms | ~3 ms | 4,800x |
| Summary stats (COUNT DISTINCT) | 133 ms | ~2 ms | 66x |
| Choropleth data retrieval | 0.4 ms | ~3 ms | (already fast) |
| Time period listing | 0.5 ms | ~2 ms | (already fast) |

### What Stays in PostgreSQL

| Query | Time | Reason |
|-------|------|--------|
| Comorbidities (self-join condition_occurrence) | 307 ms | Relational joins |
| Drug exposures (condition -> drug_exposure) | 629 ms | Relational joins |
| Visit type distribution | 288 ms | Relational joins |
| Study/cohort geographic matching | TBD | Joins across app DB tables |
| Refresh / reindex pipeline | 170 ms/condition | Write path |

### Indexing Flow

1. `POST /cdm-spatial/refresh?concept_id=X` computes aggregates in PG
2. After PG write, pushes documents to Solr `gis_spatial` core
3. `POST /cdm-spatial/reindex-all` does full rebuild across all 258 conditions (~17K documents)

### Existing Infrastructure

Project has `SolrAdminController` with reindex/clear endpoints and a `vocabulary` core. New `gis_spatial` core config follows the same pattern.

---

## API Design

### Python AI Service (FastAPI)

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `GET /cdm-spatial/conditions` | Solr | All conditions with patient counts, SNOMED categories |
| `GET /cdm-spatial/conditions/categories` | Solr | Curated category list with counts per category |
| `POST /cdm-spatial/choropleth` | Solr | County choropleth for any condition + metric + time_period |
| `GET /cdm-spatial/summary?concept_id=X` | Solr | Disease summary stats |
| `GET /cdm-spatial/time-periods?concept_id=X` | Solr | Available YYYY-MM periods for a condition |
| `GET /cdm-spatial/county/{gid}/detail?concept_id=X` | PG | Rich county drill-down (all 9 sections) |
| `GET /cdm-spatial/studies?concept_id=X` | PG | Studies/cohorts matching condition with geographic footprints |
| `POST /cdm-spatial/refresh?concept_id=X` | PG+Solr | Rebuild aggregates for one condition |
| `POST /cdm-spatial/reindex-all` | PG+Solr | Full rebuild across all conditions |

### Deprecated

- `GET /cdm-spatial/covid-summary` -> `GET /cdm-spatial/summary?concept_id=X`
- Hardcoded `COVID_CONCEPT_ID` removed from service

### Laravel Proxy

All endpoints mirrored under `/api/v1/gis/cdm/`.

### Frontend

One `useQuery` hook per endpoint, parameterized by `concept_id`. Existing pattern from v1 hooks.

---

## Data-Driven Geography

The GIS Explorer does not hardcode Pennsylvania or any specific geography. On load:

1. Query Solr for distinct `parent_gid` values with data -> determines available regions
2. Auto-detect the geographic scope (PA counties today, could be UK districts tomorrow)
3. Set default viewport to center on the region with data
4. If multiple regions have data, show a region selector

This ensures the same frontend works for any OMOP CDM deployment without code changes.

---

## Implementation Phasing

### Phase 1 (MVP)
- Disease selector (quick picks + search + category browser)
- Generalized summary bar, metric selector, time slider
- Solr `gis_spatial` core with configset
- Generalized `refresh_county_stats()` and reindex pipeline
- County detail: Sections A (metrics), F (demographics), G (temporal trends)
- Updated GisPage wiring

### Phase 2 (Rich Detail)
- County detail: Sections B (comorbidities), C (drugs), D (visit types), E (mortality/outcomes)
- County detail: Section H (benchmarking)
- Charting library integration (Recharts) for Section G trend lines

### Phase 3 (Study/Cohort Integration)
- Study/cohort geographic derivation and map overlay
- County detail: Section I (studies/cohorts)
- Cross-database query (Laravel handles app DB queries, passes results to Python service)

### Phase 4 (Future — Data-Driven Geography)
- Auto-detect geographic scope from CDM data
- Multi-region support with region selector
- Dynamic viewport centering
- This is a design goal, not MVP scope

---

## Technical Clarifications

### Cross-Database Study/Cohort Derivation

Studies, cohort definitions, and `expression_json` live in Docker PG (`parthenon` database). CDM data lives in local PG (`ohdsi` database). The Python AI service connects only to local PG.

**Solution:** The `/studies?concept_id=X` endpoint lives in **Laravel** (not Python). Laravel queries the app DB for studies/cohorts matching the concept, then queries the CDM DB for geographic footprints. The frontend calls this through the existing Laravel API, not through the AI service proxy.

### Solr Core Configuration

Configset at `docker/solr/configsets/gis_spatial/conf/managed-schema`:

```xml
<field name="id" type="string" indexed="true" stored="true" required="true"/>
<field name="condition_concept_id" type="pint" indexed="true" stored="true"/>
<field name="condition_name" type="text_general" indexed="true" stored="true"/>
<field name="condition_name_exact" type="string" indexed="true" stored="true"/>
<field name="snomed_category" type="string" indexed="true" stored="true"/>
<field name="gadm_gid" type="string" indexed="true" stored="true"/>
<field name="county_name" type="text_general" indexed="true" stored="true"/>
<field name="parent_gid" type="string" indexed="true" stored="true"/>
<field name="cases" type="pint" indexed="true" stored="true"/>
<field name="deaths" type="pint" indexed="true" stored="true"/>
<field name="cfr" type="pfloat" indexed="true" stored="true"/>
<field name="hospitalizations" type="pint" indexed="true" stored="true"/>
<field name="population" type="pint" indexed="true" stored="true"/>
<field name="prevalence_per_100k" type="pfloat" indexed="true" stored="true"/>
<field name="time_periods" type="string" indexed="true" stored="true" multiValued="true"/>
<field name="monthly_cases" type="pint" indexed="true" stored="true" multiValued="true"/>
<field name="updated_at" type="pdate" indexed="true" stored="true"/>

<copyField source="condition_name" dest="condition_name_exact"/>
```

Mounted in `docker-compose.yml` alongside the existing `vocabulary` configset.

### Metric Type Naming

v2 retains the existing metric type names in `cdm_county_stats` (`cases`, `deaths`, `cfr`, `hospitalizations`, `patient_count`). The `concept_id` column distinguishes which condition the metric belongs to. No migration needed — the v1 COVID data already uses `concept_id = 37311061` and the same metric names generalize to any condition.

### Reindex Time Budget

Full reindex across 258 conditions: ~258 x 6 metrics x 170ms = ~4.4 minutes of PG compute, plus Solr indexing (~17K documents, <10 seconds). The `POST /cdm-spatial/reindex-all` endpoint runs **asynchronously** (returns immediately, runs in background). Progress tracked via polling endpoint. Admin-only (`role:super-admin` middleware on Laravel proxy).

### Summary Stats Precision

Solr-served summary stats (cases, deaths, hospitalizations) are **exact integers** pre-computed during the refresh pipeline and stored in Solr documents — not approximate COUNT DISTINCT queries. The Solr `stats` component sums pre-computed values. No precision trade-off.

### Total Counties/Regions

The `total_counties` value in the summary bar is dynamically computed: `SELECT COUNT(DISTINCT gadm_gid) FROM app.cdm_county_stats WHERE metric_type = 'patient_count'`. This is pre-computed during refresh and stored as a Solr aggregate, not hardcoded to 67.

### Error States

- **Solr down:** Disease selector falls back to a PG query against `cdm_county_stats` (slower but functional). Summary bar shows loading skeleton.
- **Condition with zero geographic data:** Disease selector shows the condition grayed out with "(no geographic data)" label. Selecting it shows an empty map with a message.
- **County detail loading:** Skeleton loaders per accordion section, sections load independently where possible.

### Authorization

| Endpoint | Auth |
|----------|------|
| `GET /cdm-spatial/conditions` | `auth:sanctum` |
| `GET /cdm-spatial/conditions/categories` | `auth:sanctum` |
| `POST /cdm-spatial/choropleth` | `auth:sanctum` |
| `GET /cdm-spatial/summary` | `auth:sanctum` |
| `GET /cdm-spatial/time-periods` | `auth:sanctum` |
| `GET /cdm-spatial/county/{gid}/detail` | `auth:sanctum` |
| `GET /cdm-spatial/studies` | `auth:sanctum` |
| `POST /cdm-spatial/refresh` | `role:super-admin` |
| `POST /cdm-spatial/reindex-all` | `role:super-admin` |
