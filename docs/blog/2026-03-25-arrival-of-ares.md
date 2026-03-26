---
slug: arrival-of-ares
title: "The Arrival of Ares to Parthenon"
authors: [mudoshi, claude]
tags: [ares, ohdsi, data-quality, characterization, network-analytics, milestone]
date: 2026-03-25
---

If you've worked in the OHDSI ecosystem, you know the pain: Atlas for cohort definitions, Achilles Results Viewer for characterization, a DQD dashboard for data quality, spreadsheets for feasibility assessments, and a prayer that everyone's looking at the same release of the same data. Ares changes that. Today we're announcing Ares v2 — Parthenon's network-level data observatory — a single unified module that replaces the fragmented constellation of OHDSI data characterization tools with 10 purpose-built analytical panels, 60+ API endpoints, and a clinical UI designed for researchers who need answers, not workarounds.

This is the biggest feature release in Parthenon's history.

<!-- truncate -->

## What Ares Replaces

To appreciate what Ares does, consider what a typical OHDSI site coordinator juggles today:

- **Atlas + WebAPI** for browsing data source reports and Achilles results
- **Achilles Results Viewer** (an R Shiny app) for characterization dashboards
- **DQD Dashboard** (another Shiny app, or raw CSVs) for data quality trending
- **Custom R scripts** for cross-source comparison of concept prevalence
- **Spreadsheets** for tracking which sources have which domains, when they were last refreshed, and whether they're suitable for a given study
- **Email threads** for annotating data events and coordinating between data stewards and researchers
- **No tooling at all** for cost analytics, diversity assessments, or FDA Diversity Action Plan compliance

Each tool has its own authentication, its own data model, its own release cycle, and its own way of defining "source." Ares collapses all of this into a single tab within Parthenon's Data Explorer, backed by the same PostgreSQL database, the same RBAC system, and the same API infrastructure that powers every other module.

## The 10 Panels

Ares is organized as a hub with 10 analytical panels, each addressing a distinct research operations question. Here's what we built and why.

### 1. Network Overview — Situational Awareness in 5 Seconds

The first thing a data coordinator needs every morning is a status board. Network Overview provides exactly that: one row per data source, with DQ trend sparklines, freshness indicators (color-coded with STALE badges for sources >30 days without a refresh), domain coverage rings, and person counts. An auto-generated alert banner surfaces the three most common operational emergencies — DQ score drops >5%, stale data, and unmapped code spikes — before you even start looking.

The DQ Radar toggle overlays Kahn framework dimensions (completeness, conformance value, conformance relational, plausibility atemporal, plausibility temporal) as a radar chart per source. Comparing radar "shapes" across sources immediately reveals dimensional weaknesses that aggregate scores hide. A source with 95% overall DQ but 40% plausibility temporal has a very different problem than one with 85% across all dimensions evenly.

### 2. Concept Comparison — The Question Every Network Study Starts With

"How prevalent is Type 2 Diabetes across our network?" is the single most common question in OHDSI network research. Concept Comparison answers it with four view modes:

- **Single Concept**: Bar chart showing rate per 1,000 persons across all sources, with confidence interval error bars
- **Multi-Concept**: Grouped bar chart comparing 2-5 concepts side-by-side
- **Attrition Funnel**: TriNetX-style horizontal funnel showing patient attrition as criteria are layered
- **Temporal**: Line chart tracking prevalence across releases over time

The killer feature here is the **Crude / Age-Sex Adjusted toggle**. Comparing a pediatric hospital's diabetes rate against a Medicare claims database using crude rates is meaningless — the demographics are completely different. When you toggle to age-sex standardized rates (using the US Census 2020 reference population), the comparisons become valid. A footnote documents the standardization method for reproducibility.

We also added **CDC Benchmark Lines** — when national prevalence data is available, a dashed reference line shows where each source sits relative to the expected rate. And you can compare entire **Concept Sets**, not just individual concepts — "all T2DM medications" across the network in one chart.

### 3. DQ History — Quality is a Trajectory, Not a Snapshot

A DQ score at a single point in time tells you almost nothing. Was it always this bad? Did it get worse after the last ETL? Did someone fix the completeness issues from Q3?

DQ History tracks quality over time with four tabs:

- **Trends**: Line chart of overall DQ pass rate per release, with background zones (green &gt;90%, amber 80-90%, red &lt;80%). Click any release point to open a delta table showing every check that changed status.
- **Heatmap**: Category-by-release grid, color-coded by pass rate. Instantly spot which quality categories are degrading over time.
- **Cross-Source**: Overlay DQ trend lines from multiple sources on one chart for direct comparison.
- **SLA**: Admin-only view where data stewards set minimum pass rate targets per DQ category. Compliance bars show actual vs. target with error budget remaining — like an SRE error budget, but for data quality.

Each DQ check also gets its own **6-point sparkline** showing its individual pass/fail history. Annotations from team members appear as markers on the trend chart, providing institutional context for data events.

### 4. Coverage Matrix — What Data Do You Actually Have?

The coverage matrix is a domain-by-source grid that answers the most fundamental question in study design: does this source have the data I need?

Three view modes (record counts, per-person density, and temporal date ranges) give different perspectives. The **Expected vs. Actual toggle** is particularly powerful — it compares what domains a source *type* (claims vs. EHR vs. registry) should have against what's actually present, flagging gaps as MISS and unexpected domains as BONUS.

The observation_period column gets a gold accent border because it's the single most important domain for study design — everything downstream depends on it.

### 5. Feasibility — Can Your Network Support This Study?

Feasibility assessment is where Ares goes from descriptive to prescriptive. Define your study criteria — required domains, concepts, visit types, date ranges, minimum patient count — and Ares evaluates every source against them.

Results include per-criterion scores with weighted composite scoring (domain 20%, concept 30%, visit 15%, date 15%, patient 20%) and a clear ELIGIBLE/INELIGIBLE verdict. But the real value is in the **Impact Analysis** waterfall chart, which shows which single criterion eliminates the most sources. When you need to relax a constraint to reach your enrollment target, this tells you which constraint to relax.

The **CONSORT Flow** diagram visualizes progressive source exclusion through each criterion gate — the same format used in clinical trial publications, now applied to site selection.

And for sources that pass feasibility, the **Patient Arrival Forecast** projects monthly patient accrual with confidence intervals, showing when you'll reach your target enrollment. It's the difference between "this source is eligible" and "this source will get you 500 patients by September."

Criteria sets can be saved as **templates** and shared across the research team — define your study's requirements once, reuse them as the network evolves.

### 6. Diversity — FDA Diversity Action Plans Built In

The FDA's 2024 Diversity Action Plan guidance fundamentally changed clinical trial enrollment. Sites now need to demonstrate — quantitatively — that their data sources represent diverse populations. Ares provides this out of the box.

The **Overview** tab shows Simpson's Diversity Index per source (0-1 scale, higher = more diverse), with gender/race/ethnicity breakdowns and benchmark overlay lines. The **DAP Gap** tab lets you set enrollment targets by demographic dimension and see which sources meet or miss them in a red/green matrix.

The **Geographic** tab goes deeper: state-level distribution bars, number of states covered, and — critically — an **Area Deprivation Index (ADI) histogram** showing socioeconomic representation. A network that covers 30 states but only draws from affluent ZIP codes isn't truly diverse. The ADI data quantifies this.

**Pooled** view lets you select multiple sources and see combined demographics across the pooled population — essential for multi-site study planning.

### 7. Releases — Version Control for Data

Every ETL run produces a new release of a data source. Ares tracks these with per-source release cards showing CDM version, vocabulary version, ETL version, and notes. Each card has an expandable **diff panel** showing what changed: person count deltas, record count deltas, DQ score changes, vocabulary version changes, and domain-level deltas.

The **Swimlane** timeline puts all sources on one horizontal axis with release dots positioned by date — immediately revealing which sources are updated regularly and which are falling behind. The **Calendar** view (GitHub contributions-style heatmap) shows release density by day across the network.

ETL provenance metadata — who ran it, what code version, how long it took — is captured when available, providing an audit trail for regulatory and reproducibility purposes.

### 8. Unmapped Codes — AI-Assisted Vocabulary Remediation

Unmapped source codes are the single biggest data quality problem in OMOP CDM implementations. Ares prioritizes them using an **impact score** (record count multiplied by domain weight — condition codes weighted 1.0, drug 0.9, procedure 0.8) so you focus mapping effort where it matters most.

The **Pareto chart** demonstrates the 80/20 rule visually: the top 20 unmapped codes typically account for 80%+ of all unmapped records. The **Treemap** view shows unmapped codes grouped by vocabulary, revealing whether the problem is concentrated in a single vocabulary or spread across many.

The standout feature is **AI Mapping Suggestions**: expand any unmapped code row to see the top 5 standard concept suggestions ranked by confidence (0-100%), powered by pgvector concept embedding similarity. Click Accept to stage a mapping — it doesn't write to the CDM directly; an admin must promote approved mappings. This is the same AI mapping infrastructure that powers Parthenon's Aqueduct ETL module, now integrated directly into the data quality workflow.

Export in **Usagi-compatible CSV format** means teams using OHDSI's standard mapping tool can seamlessly integrate Ares's prioritized list into their existing workflows.

### 9. Annotations — Institutional Memory for Data Events

Data events happen constantly: ETL runs complete, schema changes deploy, quality scores drop, researchers discover unexpected patterns. Without a structured way to capture this context, institutional knowledge lives in email threads and Slack messages that nobody can find six months later.

Ares Annotations provides a structured note system with four tag types:
- **Data Event** (teal) — something happened in the data
- **Research Note** (gold) — researcher observation or insight
- **Action Item** (crimson) — something that needs to be done
- **System** (indigo) — auto-generated by the platform

Annotations support **threaded discussions** (one level of nesting) for data steward-to-researcher conversations, and can be created directly from chart interactions — click a data point on a DQ trend chart and add context without leaving the visualization.

### 10. Cost Analysis — Healthcare Economics at Network Scale

Cost data in OMOP CDM is notoriously tricky. The `cost` table contains multiple cost types (charged, paid, allowed) that can differ by 3-10x, and mixing them in the same analysis is the #1 cost study error. Ares addresses this head-on with a **cost type filter** that applies globally across all cost views, with an amber warning banner when multiple types exist.

Six tabs cover the full cost analytics workflow: summary cards with Per Patient Per Year (PPPY) metrics, box-and-whisker distributions per domain (revealing the skewness that averages hide), care setting breakdowns, cross-source comparisons, top cost driver concepts, and monthly trends.

## 60+ API Endpoints, One Authentication Layer

Every panel is backed by a RESTful API under `/api/v1/`, split into network-scoped endpoints (cross-source analytics) and source-scoped endpoints (per-source detail). All endpoints require Sanctum authentication and RBAC permission checks — no public access to clinical data characterization.

Network-scoped endpoints include:

```
GET  /network/ares/overview              — Network health KPIs
GET  /network/ares/alerts                — Auto-generated alerts
GET  /network/ares/compare               — Single concept prevalence
GET  /network/ares/compare/standardized  — Age-sex adjusted rates
GET  /network/ares/coverage              — Domain x source matrix
GET  /network/ares/diversity             — Demographics + Simpson's index
GET  /network/ares/diversity/geographic  — State distribution + ADI
POST /network/ares/diversity/dap-check   — FDA DAP gap analysis
POST /network/ares/feasibility           — Run assessment
GET  /network/ares/cost/compare          — Cross-source cost comparison
```

Source-scoped endpoints cover DQ history, unmapped codes with AI suggestions, cost analytics, release management, annotations, and more — over 30 endpoints per source.

Rate-limited (throttled) endpoints protect computationally expensive operations like age-sex standardization, concept set comparisons, and patient arrival forecasts.

## Role-Based Access

Ares respects Parthenon's RBAC hierarchy:

| Capability | Viewer | Researcher | Data Steward | Admin |
|------------|:------:|:----------:|:------------:|:-----:|
| View all panels | Yes | Yes | Yes | Yes |
| Run feasibility assessments | - | Yes | Yes | Yes |
| Create annotations | - | Yes | Yes | Yes |
| Accept AI mapping suggestions | - | - | Yes | Yes |
| Set DQ SLA targets | - | - | Yes | Yes |
| Promote mappings to CDM | - | - | - | Yes |

New users get `viewer` role by default — they can see everything but can't modify anything. This follows Parthenon's principle of least privilege.

## Why "Ares"?

In Greek mythology, Ares is the god of war — but also of courage, strategy, and the willingness to confront hard truths. In OHDSI, data characterization is exactly that: confronting the hard truths about your data before you bet a clinical study on it. A network overview that hides quality problems isn't helping anyone. A feasibility assessment that ignores demographic bias produces misleading results. Ares doesn't sugarcoat — it shows you the DQ radar with its lopsided dimensions, the unmapped codes with their Pareto distribution, the diversity gaps with their ADI histograms.

The name also fits architecturally. In the Parthenon — both the building and the platform — Ares stands alongside Athena (wisdom, represented by our Abby AI assistant), Apollo (prediction, represented by the analytics engine), and Asclepius (healing, represented by the clinical data model). Each deity governs a domain. Ares governs the hard operational truths that make everything else possible.

## What This Means for the OHDSI Community

Ares v2 in Parthenon represents something that hasn't existed in the OHDSI ecosystem before: a unified, multi-source data observatory with modern web UI, AI-assisted mapping, standardized rate comparisons, feasibility assessment with arrival forecasting, FDA DAP compliance checking, cost analytics, and institutional annotation — all in one authenticated application with role-based access control.

The individual capabilities aren't new to the community. Achilles has characterized data for years. DQD has tracked quality. Atlas has browsed results. What's new is having all of it in one place, backed by a single API, with cross-source analytics that work at network scale rather than one-source-at-a-time.

For network study coordinators: you no longer need five tools and three spreadsheets to answer "which sites should participate in this study."

For data stewards: you can track quality trajectories, set SLA targets, and monitor unmapped code remediation in the same interface where researchers browse characterization results.

For researchers: feasibility assessment with patient arrival forecasting means you can make quantitative enrollment projections, not just "this source has enough patients."

For compliance teams: FDA Diversity Action Plan gap analysis is built in, with geographic and socioeconomic diversity metrics that go beyond simple demographic breakdowns.

## What's Next

Ares v2 ships with the full 10-panel suite, but there's more on the roadmap:

1. **Automated quality alerting** — Push notifications (email, Slack) when DQ scores drop below SLA targets or sources go stale
2. **Federated Ares** — Cross-institution characterization without moving data, leveraging Parthenon's federated study framework
3. **Longitudinal concept tracking** — Automated detection of concept prevalence anomalies (sudden spikes or drops that may indicate coding practice changes or ETL errors)
4. **Cost modeling** — Predictive cost modeling for study budgeting based on historical cost distributions and enrollment projections

Ares is live now at [parthenon.acumenus.net](https://parthenon.acumenus.net) under Data Explorer > Ares. Log in, click the tab, and see your network's data like you've never seen it before.

---

*Ares v2 was developed as part of Parthenon's mission to replace the fragmented OHDSI tool ecosystem with a single, unified platform for outcomes research. For questions, feedback, or feature requests, reach out to the Acumenus team.*
