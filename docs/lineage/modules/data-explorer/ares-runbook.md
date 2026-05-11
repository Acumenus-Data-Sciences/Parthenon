# Ares v2 — User Guide

Ares is Parthenon's **network-level data observatory**. It provides characterization, quality tracking, and cross-source analysis across all your clinical data sources — replacing what would require Atlas, Achilles Results Viewer, DQD Dashboard, and several spreadsheets combined.

**Access:** Data Explorer tab > Ares

---

## Getting There

1. Log in at `https://parthenon.acumenus.net`
2. Click **Data Explorer** in the left sidebar
3. Click the **Ares** tab (6th tab in the tab bar)
4. You land on the **Ares Hub** — a dashboard with 10 clickable cards

The breadcrumb at the top always shows where you are. Click "Ares" in the breadcrumb to return to the Hub from any panel.

---

## The 10 Panels

### 1. Network Overview

**What it shows:** Health summary across all data sources at a glance.

**Key features:**

- **Alert Banner** — Auto-generated warnings at the top when something needs attention:
  - DQ score dropped more than 5% since last release
  - Source data is stale (>14 days since last refresh, >30 days = STALE badge)
  - Spike in unmapped codes
- **Source Table** — One row per source with:
  - **DQ Trend Sparkline** — 6-point mini chart showing quality trajectory (replaces old up/down arrows)
  - **Freshness** — Days since last data refresh, color-coded (green/amber/red) with STALE badge
  - **Domains** — Mini progress ring showing X/12 clinical domains with data
  - **Person Count** — Total patients in that source
  - **Click any row** to jump to that source's detail view in Data Explorer
- **Network Total Row** — Aggregate stats at the bottom (total persons, median DQ)
- **DQ Radar** — Toggle radar chart showing 5 Kahn quality dimensions per source (completeness, conformance value, conformance relational, plausibility atemporal, plausibility temporal). Compare source "shapes" — a lopsided radar reveals dimensional weaknesses.

---

### 2. Concept Comparison

**What it shows:** How prevalent a concept (or set of concepts) is across your network.

**View modes:**

| Mode | What You See |
|------|-------------|
| **Single Concept** | Search for one concept → bar chart showing rate per 1,000 across sources with confidence interval error bars |
| **Multi-Concept** | Select 2-5 concepts via chip selector → grouped bar chart comparing prevalence side by side |
| **Attrition Funnel** | Select multiple concepts → horizontal funnel showing how many patients remain as each criterion is added (TriNetX-style) |
| **Temporal** | Line chart showing how a concept's prevalence changes across releases per source |

**Special features:**

- **Crude / Age-Sex Adjusted toggle** — When viewing rates per 1,000, switch to age-sex standardized rates. This uses the US Census 2020 reference population to remove demographic bias when comparing sources with different age/sex distributions. A footnote shows the standardization method.
- **Confidence Intervals** — Error bars on every rate bar. Small sources with wide intervals may be statistical noise.
- **CDC Benchmark Line** — When available, a dashed reference line shows the national prevalence rate (e.g., "CDC National Rate: 82.3 per 1,000").
- **Concept Sets** — Compare entire concept sets (e.g., "all T2DM medications") across sources, not just individual concepts.

---

### 3. DQ History

**What it shows:** Data quality trends over time for a selected source.

**Tabs:**

| Tab | What You See |
|-----|-------------|
| **Trends** | Line chart of overall DQ pass rate per release. Background zones: green (>90%), amber (80-90%), red (<80%). Click any release point to see what changed. |
| **Heatmap** | Category x Release grid — each cell color-coded by pass rate. Spot which categories degrade over time. |
| **Cross-Source** | Overlay DQ trend lines from multiple sources on one chart for comparison. |
| **SLA** | (Admin only) Set minimum pass rate targets per DQ category. See compliance bars showing actual vs target, with error budget remaining. |

**Additional features:**

- **Delta Table** — When you click a release on the trend chart, see every DQ check that changed status (new failure, resolved, existing, stable)
- **Check Sparklines** — Mini 6-point sparklines per DQ check showing its pass/fail history
- **Export CSV** — Download all DQ trend data for offline analysis
- **Annotation Markers** — Small dots on the trend chart where team members left notes about data events

---

### 4. Coverage Matrix

**What it shows:** Which clinical domains have data in which sources (domain x source grid).

**View modes:**

| Mode | Cell Shows |
|------|-----------|
| **Records** | Raw record count per domain per source |
| **Per Person** | Records divided by person count (density) |
| **Date Range** | Temporal coverage bars showing earliest-to-latest dates |

**Special features:**

- **Observation Period Highlight** — The observation_period column has a gold accent border — it's the most important domain for study design
- **Hover Highlighting** — Hover over any row to highlight the entire source; hover a column header to highlight the domain across all sources
- **Expected vs Actual** — Toggle to see OK/MISS/BONUS indicators comparing what domains a source type (claims/EHR/registry) should have vs what's actually present
- **Summary Row** — Network total record count per domain at the bottom
- **Summary Column** — Domains count (X/12) per source on the right
- **Export CSV** — Download the coverage matrix as a spreadsheet

---

### 5. Feasibility

**What it shows:** Can your sources support a proposed study? Evaluates sources against criteria you define.

**Workflow:**

1. **Define Criteria** — Choose required domains, concepts, visit types, date ranges, minimum patient count. Or select a **saved template** to pre-fill criteria.
2. **Run Assessment** — System evaluates every source and returns per-criterion scores.
3. **Review Results** — Score table showing:
   - Per-criterion scores (0-100%) with color gradient (teal >=90, gold >=70, amber >=50, crimson <50)
   - Weighted **composite score** (domain 20%, concept 30%, visit 15%, date 15%, patient 20%)
   - ELIGIBLE / INELIGIBLE verdict with composite percentage

**View toggles:**

| View | What You See |
|------|-------------|
| **Score Table** | Per-source, per-criterion scores |
| **Impact Analysis** | Waterfall chart showing which criterion eliminates the most sources — helps you relax the right constraint |
| **CONSORT Flow** | CONSORT-style diagram showing progressive source exclusion through each criterion gate |

**Patient Arrival Forecast:** For sources that pass feasibility, click the **Forecast** button to see a projected monthly patient accrual chart:
- Solid line = historical monthly new patient counts
- Dashed line = projected counts (linear regression)
- Shaded band = confidence interval (widens over time)
- Reference line = target patient count from your criteria
- Annotation = "Target reached in ~X months"

**Templates:** Save frequently used criteria sets. Public templates are visible to all researchers.

---

### 6. Diversity

**What it shows:** Demographic composition of each source — critical for FDA Diversity Action Plans (DAP).

**Tabs:**

| Tab | What You See |
|-----|-------------|
| **Overview** | Simpson's Diversity Index cards (0-1 scale, higher = more diverse) per source. Below: gender/race/ethnicity pie charts per source with benchmark overlay lines. |
| **Age Pyramid** | Population pyramid (male left, female right) for a selected source. Standard age-group bands. |
| **DAP Gap** | FDA Diversity Action Plan gap analysis. Set enrollment targets by demographic dimension → see which sources meet/miss targets with red/green matrix. |
| **Pooled** | Select multiple sources → see combined demographic proportions across the pooled population. |
| **Geographic** | State distribution (horizontal bars), geographic reach (number of states), ADI decile histogram (Area Deprivation Index — lower = more disadvantaged areas represented), median ADI card. |
| **Trends** | Simpson's Diversity Index per source over releases. Toggle between composite, gender, race, or ethnicity dimensions. |

**Rating scale for Simpson's Index:**
- Very High (>=0.8) — teal
- High (>=0.6) — gold
- Moderate (>=0.4) — amber
- Low (<0.4) — crimson

---

### 7. Releases

**What it shows:** Version history of data loads per source, with diffs and network-wide timelines.

**Tabs:**

| Tab | What You See |
|-----|-------------|
| **Releases** | Per-source release cards with metadata (CDM version, vocabulary version, ETL version, notes). Each card has an expandable **diff panel** showing what changed: person count delta, record count delta, DQ score change, vocabulary version change, domain-level deltas. Edit button (pencil icon) for inline metadata editing. |
| **Swimlane** | Horizontal timeline with one lane per source, release dots positioned by date. See release cadence across the network. |
| **Calendar** | GitHub-contributions-style heatmap calendar showing release density by day. |

**ETL Provenance:** When populated, release cards show a collapsible section with: who ran the ETL, code version, runtime duration, start time, and parameters.

---

### 8. Unmapped Codes

**What it shows:** Source codes that don't map to standard OMOP concepts — prioritized for remediation.

**View modes:**

| View | What You See |
|------|-------------|
| **Table** | Paginated list sorted by **impact score** (record count x domain weight). Top 3 get crimson priority badges (#1, #2, #3). Condition codes weighted highest (1.0), drug (0.9), procedure (0.8), etc. |
| **Pareto** | Pareto chart: bars = record count per code, line = cumulative percentage. Shows how the top 20 codes often account for 80%+ of unmapped records. |
| **Treemap** | Vocabulary treemap showing unmapped codes grouped and sized by vocabulary. |

**Mapping Progress Tracker:** Stacked progress bar showing mapped / deferred / excluded / pending counts.

**AI Mapping Suggestions:** Expand any unmapped code row to see the **MappingSuggestionPanel**:
- Top 5 standard concept suggestions ranked by confidence (0-100%)
- Powered by pgvector concept embedding similarity
- Click **Accept** to stage a mapping in `accepted_mappings` (does NOT write to the CDM — an admin must promote approved mappings)

**Export:** Download unmapped codes in Usagi-compatible CSV format for offline mapping workflows.

---

### 9. Annotations

**What it shows:** Team notes and system-generated observations attached to charts and data events.

**View modes:**

| View | What You See |
|------|-------------|
| **List** | Annotation cards with creator, date, source, chart type. Color-coded tag badges. |
| **Timeline** | Chronological vertical timeline with tag-colored markers. |

**Tag types:**
- **Data Event** (teal) — Something happened in the data (ETL run, schema change)
- **Research Note** (gold) — Researcher observation or insight
- **Action Item** (crimson) — Something that needs to be done
- **System** (indigo) — Auto-generated by the platform (DQ drops, releases, etc.)

**Filtering:** Tag filter pills + full-text search box. Combine both for targeted queries (e.g., tag=system + search="vocab").

**Threaded Discussions:** Click Reply on any annotation to start a discussion thread (1 level of nesting). Useful for data steward ↔ researcher conversations about data events.

**Create from Charts:** When viewing DQ trend charts, annotation markers appear at data points where notes exist. Use the create-from-chart popover to add context-aware annotations directly from chart interactions.

---

### 10. Cost Analysis

**What it shows:** Healthcare cost analytics across domains, sources, and care settings.

**Tabs:**

| Tab | What You See |
|------|-------------|
| **Overview** | Summary cards: Total Cost (teal), PPPY — Per Patient Per Year (gold), Persons, Avg Observation Period. Domain breakdown bar chart below. |
| **Distribution** | Box-and-whisker plots per domain showing cost distribution (min, P10, P25, median, P75, P90, max). Reveals skewness that averages hide. |
| **Care Setting** | Cost breakdown by care setting (Inpatient, Outpatient, ER, Pharmacy) with per-setting PPPY. |
| **Cross-Source** | Network-wide comparison: small-multiples box plots per source. |
| **Cost Drivers** | Top 10 concepts by total cost with horizontal bars showing concept name, total cost, % of total, record count, patient count. |
| **Trends** | Monthly cost totals over time. |

**Cost Type Filter:** Dropdown selector for cost type (Charged Amount, Paid Amount, Allowed Amount, etc.). When multiple cost types exist in a source, an amber warning banner appears:

> "This source contains 3 cost types (paid, charged, allowed). Mixing types can distort analysis by 3-10x. Filter to a single type."

All cost views update when you change the cost type filter.

---

## Role-Based Access

| Feature | Viewer | Researcher | Data Steward | Admin |
|---------|--------|-----------|-------------|-------|
| View all panels | Yes | Yes | Yes | Yes |
| Run feasibility assessments | No | Yes | Yes | Yes |
| Create annotations | No | Yes | Yes | Yes |
| Accept AI mapping suggestions | No | No | Yes | Yes |
| Set DQ SLA targets | No | No | Yes | Yes |
| Promote mappings to CDM | No | No | No | Yes |
| Manage releases | No | Yes | Yes | Yes |
| Save feasibility templates | No | Yes | Yes | Yes |

---

## Tips

1. **Start with Network Overview** — The alert banner and sparklines give you immediate situational awareness across all sources.

2. **Use Age-Sex Adjusted rates** for cross-source comparisons — Crude rates are misleading when sources have different demographics (e.g., a pediatric hospital vs a Medicare claims database).

3. **Check Coverage Matrix before designing studies** — The expected-vs-actual toggle quickly reveals if a source is missing domains you need.

4. **Use Feasibility templates** — Save your study criteria once, reuse across assessments. The impact analysis tab helps you understand which criteria to relax.

5. **Watch the DQ SLA dashboard** — Set category-level quality targets and monitor error budget burn-down to catch degradation before it affects studies.

6. **Export for offline work** — DQ history, coverage matrix, and unmapped codes all support CSV export for further analysis in R, Python, or Excel.

7. **Use the Pareto chart for unmapped codes** — Focus mapping efforts on the top 20 codes that cover 80% of records. The AI suggestions accelerate the process.

8. **Annotate data events as they happen** — System auto-annotations capture DQ drops and releases. Add research notes to build institutional knowledge. Future researchers will thank you.

9. **Cost type filter is critical for HEOR** — Always filter to a single cost type before analysis. Mixing charged and paid amounts in the same analysis is the #1 cost study error.

10. **Geographic diversity matters for FDA DAP** — Use the Geographic tab in Diversity to demonstrate your network covers diverse populations. The ADI histogram shows socioeconomic representation.

---

## API Reference

All Ares endpoints are under `/api/v1/` and require authentication (`Bearer` token).

### Network-Scoped (cross-source)

| Endpoint | Description |
|----------|-------------|
| `GET /network/ares/overview` | Network health KPIs + per-source sparklines, freshness, domains, persons |
| `GET /network/ares/alerts` | Auto-generated alerts (DQ drops, staleness, unmapped spikes) |
| `GET /network/ares/compare?concept_id=` | Single concept prevalence comparison with CIs and benchmark |
| `GET /network/ares/compare/multi?concept_ids=` | Multi-concept grouped comparison |
| `GET /network/ares/compare/funnel?concept_ids=` | Attrition funnel across concepts |
| `GET /network/ares/compare/standardized?concept_id=` | Age-sex standardized rates (throttled) |
| `GET /network/ares/compare/temporal?concept_id=` | Temporal prevalence per release |
| `GET /network/ares/compare/concept-set?concept_ids=` | Concept set union comparison (throttled) |
| `GET /network/ares/coverage` | Domain x source coverage matrix |
| `GET /network/ares/coverage/extended` | Coverage with temporal extent + expected vs actual |
| `GET /network/ares/coverage/export?format=csv` | Download coverage matrix CSV |
| `GET /network/ares/diversity` | Demographics per source with Simpson's index |
| `GET /network/ares/diversity/geographic` | State distribution + ADI data |
| `GET /network/ares/diversity/pooled?source_ids=` | Pooled demographics across selected sources |
| `POST /network/ares/diversity/dap-check` | FDA DAP gap analysis against targets |
| `GET /network/ares/dq-radar` | Kahn dimension radar profiles for all sources |
| `GET /network/ares/dq-summary` | Latest DQ pass rate per source |
| `GET /network/ares/dq-overlay` | Cross-source DQ overlay data |
| `GET /network/ares/feasibility` | List all assessments |
| `POST /network/ares/feasibility` | Run new feasibility assessment |
| `GET /network/ares/feasibility/{id}` | Get assessment results |
| `GET /network/ares/feasibility/{id}/impact` | Criteria impact analysis |
| `GET /network/ares/feasibility/{id}/forecast?source_id=` | Patient arrival forecast (throttled) |
| `GET /network/ares/feasibility/templates` | List saved templates |
| `POST /network/ares/feasibility/templates` | Save new template |
| `GET /network/ares/cost` | Network cost summary |
| `GET /network/ares/cost/compare` | Cross-source cost comparison |
| `GET /network/ares/cost/compare/detailed?domain=` | Detailed distribution comparison |
| `GET /network/ares/annotations` | All network annotations |
| `GET /network/ares/releases/timeline` | Swimlane timeline data |
| `GET /network/ares/releases/calendar` | Release calendar events |

### Source-Scoped (per data source)

| Endpoint | Description |
|----------|-------------|
| `GET /sources/{id}/ares/releases` | Release history for source |
| `GET /sources/{id}/ares/releases/{rid}/diff` | Diff between release and previous |
| `GET /sources/{id}/ares/dq-history` | DQ trend data |
| `GET /sources/{id}/ares/dq-history/heatmap` | Category x release heatmap |
| `GET /sources/{id}/ares/dq-history/sparklines?release_id=` | Per-check sparklines |
| `GET /sources/{id}/ares/dq-history/export` | CSV export of DQ data |
| `GET /sources/{id}/ares/dq-radar` | Kahn dimension radar profile |
| `GET /sources/{id}/ares/dq-sla` | SLA targets |
| `POST /sources/{id}/ares/dq-sla` | Set SLA targets (admin/steward) |
| `GET /sources/{id}/ares/dq-sla/compliance` | SLA compliance check |
| `GET /sources/{id}/ares/annotations` | Annotations (filterable: `?tag=` `?search=`) |
| `GET /sources/{id}/ares/annotations/timeline` | Annotation timeline |
| `GET /sources/{id}/ares/unmapped-codes/summary` | Unmapped code summary |
| `GET /sources/{id}/ares/unmapped-codes/pareto` | Pareto chart data |
| `GET /sources/{id}/ares/unmapped-codes/progress` | Mapping progress stats |
| `GET /sources/{id}/ares/unmapped-codes/treemap` | Vocabulary treemap data |
| `GET /sources/{id}/ares/unmapped-codes/export` | Usagi CSV export |
| `GET /sources/{id}/ares/unmapped-codes/{codeId}/suggestions` | AI mapping suggestions (throttled) |
| `POST /sources/{id}/ares/unmapped-codes/{codeId}/map` | Accept mapping suggestion |
| `GET /sources/{id}/ares/cost/summary` | Cost summary with PPPY |
| `GET /sources/{id}/ares/cost/distribution` | Box plot distribution data |
| `GET /sources/{id}/ares/cost/care-setting` | Care setting breakdown |
| `GET /sources/{id}/ares/cost/types` | Available cost types |
| `GET /sources/{id}/ares/cost/drivers` | Top cost driver concepts |
| `GET /sources/{id}/ares/cost/trends` | Monthly cost trends |
| `GET /sources/{id}/ares/diversity/age-pyramid` | Age-sex pyramid data |
| `GET /sources/{id}/ares/diversity/trends` | Diversity index over releases |
| `GET /sources/{id}/ares/domain-continuity` | Record counts per domain over releases |
