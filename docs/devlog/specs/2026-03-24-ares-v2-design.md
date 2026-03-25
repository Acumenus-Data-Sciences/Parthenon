# Ares v2 — Panel Enhancement Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Author:** Claude Code + Dr. Sanjay Udoshi
**Scope:** 70 enhancements across all 10 Ares panels, transforming each from basic v1 displays into industry-leading clinical data observatory views
**Depends on:** Ares Parity v1 at `docs/superpowers/specs/2026-03-24-ares-parity-design.md`

---

## 1. Design Philosophy

v1 achieved Ares parity — every panel is functional with basic tables and charts. v2 transforms each panel from a passive display into an active analytical tool by applying gold-standard patterns from:

- **Grafana/Datadog** — Sparklines, progressive disclosure annotations, SLA monitoring
- **TriNetX/IQVIA/Flatiron** — Multi-concept attrition funnels, feasibility scoring, patient arrival forecasting
- **Monte Carlo/Great Expectations** — Category heatmaps, anomaly detection, data observability
- **PCORnet/Sentinel** — Freshness monitoring, temporal coverage, observation period emphasis
- **MarketScan/Optum** — Cost distributions, PPPY metrics, cost-type awareness
- **FDA DAP guidance** — Disease-epidemiology benchmarks, diversity indices, geographic diversity

**Key principles:**
- Every table should have drill-down
- Every metric should have trend context (sparklines)
- Every view should support cross-source comparison
- Data freshness is as important as data quality
- Distributions trump averages (box plots > bar charts for skewed data)
- Auto-generated content beats manual effort (annotations, release notes)

---

## 2. Panel Enhancements

### 2.1 Network Overview (7 enhancements)

**Current:** 4 stat boxes + basic table with trend arrows (↑↓–).

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | DQ Trend Sparklines | Replace trend arrows with inline 6-point sparklines per source row. Shows shape of quality change (sudden drop vs gradual decline). CDC COVE recommends as highest-density trend indicator. | Low | High |
| 2 | Data Freshness Monitor | "Days since last refresh" column with amber (>14d) / red (>30d) thresholds and STALE badge. PCORnet: freshness predicts study failure better than DQ score. | Low | High |
| 3 | Domain Coverage Column | "X/12 domains" per source with mini progress ring. Links to Coverage Matrix. | Low | Medium |
| 4 | Person Count + Network Total | Person count per source. Network aggregate row at bottom: total persons, median DQ, total records. | Low | Medium |
| 5 | Row Click → Source Detail | Click source row → navigate to Data Explorer Overview tab with that source selected. Cross-links Ares ↔ single-source views. | Low | Medium |
| 6 | DQ Radar Profile | Small radar chart per source showing 5 Kahn DQ dimensions (completeness, conformance value, conformance relational, plausibility atemporal, plausibility temporal). Shape-based comparison. | Medium | Medium |
| 7 | Auto-Generated Alerts | Alert banner at top: "MIMIC-IV DQ dropped 5.2%", "SynPUF has 523 new unmapped codes", "Acumenus release pending review". Monte Carlo anomaly detection pattern. | Medium-High | High |

**Backend changes:**
- New endpoint `GET /network/ares/alerts` — computes alerts from DQ deltas, freshness, unmapped code spikes
- Extend `GET /network/ares/overview` to return per-source sparkline data (last 6 DQ scores), freshness (days since last release), domain count, person count
- Add DQ category breakdown per source for radar chart data

**Frontend changes:**
- Replace trend arrow column with `<Sparkline>` component
- Add freshness column with STALE badge logic
- Add domain count column with mini progress ring
- Network aggregate row at table bottom
- Row click handler → navigate to `/data-explorer/${sourceId}`
- New `RadarChart` component (Recharts RadarChart)
- New `AlertBanner` component at top of NetworkOverviewView

---

### 2.2 Concept Comparison (7 enhancements)

**Current:** Single-concept search + horizontal bar chart.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Multi-Concept Comparison | Chip-based selector for 2-5 concepts. Grouped bar chart with one color per concept. | Medium | High |
| 2 | Attrition Funnel View | Toggle view showing population shrinkage as criteria stack. TriNetX's #1 feature for multi-site feasibility. | Medium | Very High |
| 3 | Age-Sex Standardized Rates | Toggle between crude rate and age-sex standardized rate per 1000. IQVIA/TriNetX: crude rates misleading without standardization. No OHDSI tool does this. | Medium-High | High |
| 4 | Temporal Prevalence Trends | Show concept prevalence change across releases per source. Line chart overlay. | Medium | Medium |
| 5 | Concept Set Comparison | Compare entire concept sets (e.g., "all T2DM meds") across sources. Leverages OHDSI concept set paradigm. | Medium | Medium |
| 6 | Population Benchmark Line | Overlay national/CDC prevalence benchmark as dashed reference line. | High | Medium |
| 7 | Confidence Intervals | Error bars on rates per 1000. Small-source rates may be statistical noise. | Low | Medium |

**Backend changes:**
- New endpoint `GET /network/ares/compare/multi` — accepts multiple concept_ids, returns grouped prevalence data
- New endpoint `GET /network/ares/compare/funnel` — computes attrition: for each concept added, how many patients remain across each source
- New endpoint `GET /network/ares/compare/standardized?concept_id=&method=direct` — age-sex direct standardization using source demographics
- Extend compare endpoint to return temporal trend data per source across releases
- Concept set resolution: accept concept_set_id or concept_id list
- Confidence interval computation: Wilson score interval from count + population

**Frontend changes:**
- Chip-based multi-concept selector with remove buttons
- `ComparisonChart` supports grouped bars (multiple concepts per source)
- New `AttritionFunnel` component — horizontal shrinking bars
- Rate toggle: Crude / Age-Sex Adjusted
- New `TemporalPrevalenceChart` — line chart per source over releases
- Benchmark dashed line overlay on bar chart
- Error bars on bar chart using Recharts `ErrorBar`

---

### 2.3 DQ History (7 enhancements)

**Current:** Single-source line chart + flat delta table.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Category × Release Heatmap | Heatmap grid: X=releases, Y=DQ categories, cells colored by pass rate. Click cell → drill into specific checks. Monte Carlo/Anomalo/Great Expectations pattern. | Medium | Very High |
| 2 | Cross-Source DQ Overlay | All sources on same time axis as overlaid lines or small multiples. "All sources" option in source selector. | Medium | High |
| 3 | Check-Level History Sparklines | Per-check sparkline showing pass/fail history across releases. Human-readable check description alongside check ID. | Medium | High |
| 4 | DQ SLA Dashboard | Define per-source SLAs (e.g., completeness >90%). Show compliance chart with error budget burn-down. Datadog SLO pattern. | Medium-High | Medium |
| 5 | Regression Root Cause Linking | When check transitions PASS→FAIL, auto-link correlated events: vocabulary change, ETL run, new data. Cross-references release metadata and annotations. | High | High |
| 6 | Good/Bad Zone Shading | Background shading on trend chart: green zone >90%, amber 80-90%, red <80%. | Low | Medium |
| 7 | Export DQ Report | One-click CSV/PDF export of DQ history + deltas. For grant applications, IRB submissions, regulatory filings. | Medium | Medium |

**Backend changes:**
- Extend `GET /sources/{source}/ares/dq-history/category-trends` to return per-category-per-release pass rates (heatmap data)
- New endpoint `GET /network/ares/dq-overlay` — all sources' DQ trend on same timeline
- Extend deltas endpoint to include check description, check category, and per-check historical sparkline data
- New endpoint `POST /sources/{source}/ares/dq-sla` — define SLA targets per source. Requires `role:admin|super-admin|data-steward` (SLA definition is an admin operation that affects all users' quality views, not a researcher-level action).
- New table `app.dq_sla_targets`: source_id, category, min_pass_rate
- Regression linking: query release metadata + annotations where x_value matches release date
- Export endpoint: `GET /sources/{source}/ares/dq-history/export?format=csv|pdf`

**Frontend changes:**
- New `DqCategoryHeatmap` component — Recharts or custom SVG grid with click-to-drill
- Multi-source overlay on `DqTrendChart` — multiple colored lines
- Sparkline column in `DqDeltaTable` + check description column
- New `DqSlaView` component — SLA definition form + compliance chart
- Root cause panel: when hovering a check regression, show correlated release/annotation events
- Zone shading via Recharts `ReferenceArea`
- Export button with format selector

---

### 2.4 Coverage Matrix (7 enhancements)

**Current:** Static color-coded table with record counts.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Temporal Coverage Bars | Mini date range bars in each cell showing earliest→latest observation date. Sentinel pattern. A source with 1M records all from 2014 is useless for 2020-2024 studies. | Medium | Very High |
| 2 | Observation Period Highlight | Highlight observation_period column with distinct accent. PCORnet: most important, most overlooked domain. Warning when missing. | Low | High |
| 3 | Interactive Row/Column Highlighting | Hover row → highlight gaps. Hover column → highlight sources lacking domain. Click cell → navigate to source Domain tab. | Low | Medium |
| 4 | View Mode Toggle | Three modes: Records (absolute counts), Per Person (density), Date Range (temporal extent). Density normalizes across source size. | Low | Medium |
| 5 | Expected vs Actual Completeness | Benchmark row per source type (claims vs EHR vs registry). Color cells relative to expectation. EHR missing drug_exposure = expected; EHR missing condition = alarming. | Medium | Medium |
| 6 | Domain Summary Row + Source Column | Bottom row: network total per domain. Right column: domain completeness % per source (8/12). | Low | Medium |
| 7 | Export as Data Availability Letter | One-click export to PDF/CSV for grant applications, IRB submissions. Formatted "data availability" document. | Medium | Medium |

**Backend changes:**
- Extend `GET /network/ares/coverage` to return temporal extent per cell: `{record_count, density_per_person, earliest_date, latest_date}`
- Query `observation_period` table per source for date ranges per domain
- Add `source_type` field to Source model (claims/ehr/registry) or infer from daimons
- Compute expected completeness benchmarks per source type
- Export endpoint: `GET /network/ares/coverage/export?format=csv|pdf`

**Frontend changes:**
- Mini date range bar component inside matrix cells
- Observation_period column styled with distinct border/accent
- CSS `:hover` highlighting on rows and columns
- View mode toggle state + recalculate cell display
- Expected vs actual: benchmark row with colored comparison
- Summary row/column with aggregated stats
- Export button

---

### 2.5 Feasibility (7 enhancements)

**Current:** Binary PASS/FAIL scorecard.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Continuous 0-100 Scoring | Replace binary pass/fail with percentage scores per criterion. Composite weighted score. Aetion SPIFD framework. | Low | Very High |
| 2 | Criteria Impact Analysis | Waterfall/funnel showing which criterion eliminates most sources. TriNetX's protocol optimization approach. | Medium | Very High |
| 3 | Failure Reason Drill-Down | Click cell → see exactly which concepts missing, observation period gap, patient shortfall. | Medium | High |
| 4 | Median Observation Time Criterion | TriNetX: #1 predictor of study failure is insufficient observation time. Add median follow-up for eligible patients. | Medium | High |
| 5 | CONSORT-Style Attrition Diagram | Toggle to CONSORT-like flow: total sources → domain-eligible → concept-eligible → final. Aetion SPIFD recommendation. | Medium | Medium |
| 6 | Study Type Templates | Pre-built templates: retrospective cohort, case-control, claims CER, oncology basket trial, pharmacovigilance. Pre-fill criteria. | Medium | Medium |
| 7 | Patient Arrival Rate Forecast | For passing sources, estimate monthly patient accrual from historical data. TriNetX's killer feature. Answers "how long will enrollment take?" | High | Very High |

**Backend changes:**
- Modify `FeasibilityService::assess()` to return continuous scores (0-100) per criterion instead of boolean
- Compute per-criterion score: concepts = (found/required)*100, dates = overlap_months/required_months*100, etc.
- New: criteria impact analysis — run assessment removing one criterion at a time, return impact ranking
- Extend results to include failure details: which concepts missing, actual observation period overlap
- Add `median_observation_months` to feasibility criteria and assessment logic
- New endpoint `GET /network/ares/feasibility/{id}/impact` — criteria impact waterfall data
- New endpoint `GET /network/ares/feasibility/{id}/forecast` — patient arrival rate computation based on historical concept occurrence rates
- Feasibility templates: seeded data or config-driven template definitions
- New table `app.feasibility_templates`: id, name, study_type, criteria (jsonb)

**Frontend changes:**
- Percentage scores in cells with color gradient (0-100) instead of PASS/FAIL badges
- Composite score column with colored pill badge
- New `CriteriaImpactChart` — waterfall/funnel bars showing source elimination per criterion
- Click cell → slide-in panel showing missing concepts, observation overlap, etc.
- `FeasibilityForm` extended: median observation time input, template dropdown
- New `ConsortDiagram` — CONSORT-style flow visualization
- New `ArrivalForecastChart` — monthly patient accrual projection per source

---

### 2.6 Diversity (7 enhancements)

**Current:** Static stacked bars per source.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Disease-Epidemiology Benchmark Overlay | Dashed benchmark lines on demographic bars showing disease-specific prevalence. FDA DAP guidance: benchmarks must reflect disease epidemiology, not census. MRCT Model DAP pattern. | Medium | Very High |
| 2 | Simpson's Diversity Index | Single 0-1 index per source. Cards at top showing index + rating. Enables ranking sources by diversity. | Low | High |
| 3 | Age Distribution Pyramid | Population pyramid per source (male left, female right). Age is the most important demographic for study planning. | Medium | High |
| 4 | FDA DAP Gap Analysis | Define DAP enrollment targets → show red/green matrix per source vs targets. Directly supports regulatory compliance. | Medium | High |
| 5 | Pooled Source Demographics | Select 2-3 sources → see combined demographic profile. "Acumenus + MIMIC together give 52% minority representation." | Medium | Medium |
| 6 | Geographic + Socioeconomic Diversity | FDA DAP includes SES and geography. Derive ADI from GIS module. Show geographic coverage per source. Ahead of all competitors. | High | High |
| 7 | Diversity Trends Over Releases | Sparklines showing demographic composition change across releases per source. | Medium | Medium |

**Backend changes:**
- New endpoint `GET /network/ares/diversity/benchmarks?condition_concept_id=` — returns disease-specific demographic benchmarks (from published epidemiology data or configurable)
- Compute Simpson's Diversity Index: `1 - Σ(p_i²)` per source for race, ethnicity, gender
- Extend diversity endpoint to include age distribution (from Achilles analysis 3: age at first observation)
- New endpoint `POST /network/ares/diversity/dap-check` — accepts target percentages, returns gap analysis per source
- New endpoint `GET /network/ares/diversity/pooled?source_ids=1,2,3` — weighted merge of demographics
- Integration with GIS module: Area Deprivation Index lookup per source's patient ZIP codes
- Diversity trend: query demographics per release for sparkline data
- New table `app.diversity_benchmarks`: condition_concept_id, demographic_type, group_name, expected_percentage (seeded with common conditions)

**Frontend changes:**
- Dashed benchmark lines overlaid on stacked bars
- Diversity index cards at top of view with color-coded ratings
- New `AgePyramid` component — diverging horizontal bar chart
- New `DapGapMatrix` component — red/green target vs actual grid
- Source multi-select for pooled demographics view
- GIS integration: mini map or ADI distribution chart per source
- Release-over-release sparklines per demographic category

---

### 2.7 Releases (7 enhancements)

**Current:** Flat card list with create/delete.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Auto-Computed Release Diff | Delta summary per release: +/- persons, +/- records per domain, vocab version change, DQ score change. "git diff for data." | Medium | Very High |
| 2 | Swimlane Timeline View | Horizontal timeline with one lane per source. Releases as dots. Shows network-wide refresh cadence. | Medium | High |
| 3 | Auto-Generated Release Notes | Human-readable notes from diff: "Added 12,400 persons, drug_exposure grew 8%, 3 DQ checks resolved." | Medium | High |
| 4 | Edit Release Metadata | Inline edit of release name, versions, notes. v1 only supports create/delete. | Low | Medium |
| 5 | Release Calendar Heatmap | GitHub-contributions-style calendar showing release activity across all sources. Surfaces cadence patterns. | Medium | Medium |
| 6 | Release Impact Assessment | Cross-link to: which DQ checks changed, which unmapped codes appeared/disappeared, concept prevalence shifts. | Medium | Medium |
| 7 | ETL Provenance Metadata | Link release to ETL provenance: who ran it, code version, parameters, runtime. LakeFS: most issues at version boundaries. | Medium-High | Medium |

**Backend changes:**
- New endpoint `GET /sources/{source}/ares/releases/{id}/diff` — compute diff vs previous release: person delta, record delta per domain, vocab version change, DQ score change, unmapped code delta
- Auto-generate release notes string from diff data
- Swimlane data: `GET /network/ares/releases/timeline` — all releases across all sources with dates
- Calendar heatmap data: `GET /network/ares/releases/calendar` — release counts per day
- Impact assessment: join release to DQ deltas, unmapped code diffs, concept prevalence changes
- Add `etl_metadata` jsonb column to `source_releases` table for provenance (who, code_version, parameters, duration)
- Extend `UpdateReleaseRequest` to allow editing all metadata fields

**Frontend changes:**
- Diff summary panel inside each release card (auto-expanded)
- Auto-generated release notes as formatted text block
- New `SwimLaneTimeline` component — horizontal lanes with dot markers
- Edit button on release cards → inline form
- New `ReleaseCalendar` component — GitHub-style heatmap grid
- Impact links: clickable badges linking to DQ History and Unmapped Codes views
- ETL provenance section in release detail (collapsible)

---

### 2.8 Unmapped Codes (7 enhancements)

**Current:** Paginated table with filters.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Impact-Weighted Priority Score | Sort by `record_count × patient_count × domain_weight`. Book of OHDSI: "frequency should prioritize mapping effort." | Low | Very High |
| 2 | Pareto Chart View | Cumulative % of records covered as codes are mapped highest-to-lowest. OHDSI: 80% of unmapped records from <5% of codes. Banner: "Top 20 codes cover 81%." | Medium | High |
| 3 | AI-Suggested Mappings | pgvector concept embeddings suggest OMOP mappings with confidence score. Accept/Review/Skip buttons. Inline triage workflow. | Medium-High | Very High |
| 4 | Mapping Progress Tracker | Progress bar: X of Y reviewed, Z mapped, W unmappable. Mapping velocity (codes/week). | Medium | Medium |
| 5 | Cross-Release Unmapped Code Diff | "New This Release" toggle. NEW vs EXISTING badges. Urgent vs known gaps. | Medium | Medium |
| 6 | Vocabulary Treemap | Rectangles = source vocabularies, size = unmapped record count, color = mapping completion %. | Medium | Medium |
| 7 | Export for External Tools | Usagi-compatible CSV export. Bulk import of completed mappings. Round-trip between Parthenon and Usagi/IMO. | Medium | Medium |

**Backend changes:**
- Compute impact score: add `patient_count` column to `unmapped_source_codes` table (populated during Achilles analysis step by counting distinct person_id per source_code via domain tables). Impact = `record_count × patient_count × domain_weight` where domain_weight is configurable (default: condition=1.0, drug=0.9, procedure=0.8, measurement=0.7, observation=0.5, visit=0.3)
- New endpoint `GET /sources/{source}/ares/unmapped-codes/pareto` — cumulative percentage data
- AI suggestions: query pgvector concept embeddings for nearest standard concepts by source_code text similarity
- New endpoint `GET /sources/{source}/ares/unmapped-codes/{id}/suggestions` — top 5 concept matches with confidence
- New endpoint `POST /sources/{source}/ares/unmapped-codes/{id}/map` — accept mapping. **HIGHSEC note:** This does NOT write directly to `source_to_concept_map` (CdmModel is read-only per HIGHSEC 3.2). Instead, writes to a staging table `app.accepted_mappings` with status `pending_approval`. A separate admin-approved promotion step (via `permission:mapping.override`) copies approved mappings to `source_to_concept_map`. This two-stage approach respects the CdmModel read-only constraint while enabling the triage workflow.
- New table `app.accepted_mappings`: id, unmapped_code_id (FK), source_code, source_vocabulary_id, target_concept_id, confidence_score, status (pending_approval/approved/rejected), accepted_by (FK users), approved_by (FK users nullable), accepted_at, approved_at
- New endpoint `POST /admin/mappings/{id}/promote` — admin-only, copies approved mapping to `source_to_concept_map`. Requires `role:admin|super-admin|data-steward` + `permission:mapping.override`.
- New table `app.unmapped_code_reviews`: unmapped_code_id, status (pending/mapped/unmappable/skipped), mapped_concept_id, reviewed_by, reviewed_at
- Cross-release diff: compare unmapped codes between current and previous release
- Treemap data: aggregate unmapped codes by source_vocabulary_id
- Export endpoint: `GET /sources/{source}/ares/unmapped-codes/export?format=usagi|csv`

**Frontend changes:**
- Sort by impact score (default), with impact badge (#1, #2, #3...)
- Pareto insight banner + toggle to Pareto chart view
- AI suggestion column with confidence %, Accept/Review/Skip buttons
- Progress bar component at top of view
- NEW/EXISTING badges on codes with release diff toggle
- New `VocabularyTreemap` component
- Export button with format selector

---

### 2.9 Annotations (7 enhancements)

**Current:** Detached card list, view-only.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Chart-Anchored Progressive Disclosure | Render annotations as small markers ON charts. 4-6px dots at 40% opacity, expand on hover. Grafana core pattern. | High | Very High |
| 2 | Auto-Generated System Annotations | Auto-create annotations for: DQ drops >5%, new releases, unmapped code spikes, ETL failures. Grafana: auto-annotations used 4x more than manual. | Medium | Very High |
| 3 | Annotation Categories/Tags | Structured tags: data_event, research_note, action_item, system. Filter by tag. Color-coded badges. | Low | High |
| 4 | Chronological Timeline View | Vertical timeline with source-colored markers and dateline. Institutional knowledge log. | Medium | High |
| 5 | Threaded Discussions | Replies on annotations (Google Docs comments pattern). Data steward flags → engineer responds → researcher resolves. | Medium-High | Medium |
| 6 | Create from Charts | Click data point on any chart → "Add Note" popover. Pre-fills chart_type, x_value, source_id. In-situ creation. | Medium | High |
| 7 | Full-Text Search | Search annotation text, creator, chart type, source. Find "who noted the vocab update?" | Low | Medium |

**Backend changes:**
- Auto-annotation system: new `AutoAnnotationService` that listens to events (ReleaseCreated, DQ threshold breach, unmapped code spike) and creates system annotations
- Add `tag` column to `chart_annotations` table: varchar(30), values: data_event, research_note, action_item, system
- Add `parent_id` nullable FK to `chart_annotations` for threading (self-referential, flat threading only — max 1 level of replies, like GitHub issue comments. No recursive nesting.)
- Extend annotation API: `?tag=system&search=vocab&sort=created_at`
- New listener `CreateAutoAnnotation` on: `ReleaseCreated`, `AchillesRunCompleted`, `DqdRunCompleted`
- Auto-annotation logic: compare DQ score vs previous release, flag if delta > 5%; count new unmapped codes
- **Coexistence note:** `AutoAnnotationService` listeners are additive — they register alongside existing v1 listeners (`CreateAutoRelease`, `AssociateDqdWithRelease`, `ComputeDqDeltas`) in `EventServiceProvider`, not replacing them. Multiple listeners on the same event is standard Laravel behavior.

**Frontend changes:**
- Retrofit `AnnotationMarker` into DQ trend chart, temporal trend chart, cost trend chart, domain continuity chart
- Markers: small dots at chart x-positions, 40% opacity, scale up on hover, popover with text
- Tag badges on annotation cards with filter bar
- Timeline layout replacing flat card list
- Reply UI: nested annotation cards with indent
- "Add Note" click handler on chart data points → `AnnotationPopover` in create mode
- Search input in annotations view header

---

### 2.10 Cost Analysis (7 enhancements)

**Current:** Basic bar chart + line chart with averages.

| # | Enhancement | Description | Effort | Impact |
|---|---|---|---|---|
| 1 | Box-Whisker Distribution Plots | Replace average bars with box-and-whisker (median, IQR, outliers). Healthcare costs are right-skewed — means misleading. MarketScan standard. | Medium | Very High |
| 2 | Per-Patient-Per-Year (PPPY) | Standard HEOR denominator. $50M across 100K patients ($500 PPPY) vs 1K patients ($50K PPPY). | Low | High |
| 3 | Cost Type Filter + Warning | Toggle: Paid/Charged/Allowed. Warning when multiple types mixed. cost_type_concept_id values differ 3-10x. Prevents most common HEOR error. | Medium | High |
| 4 | Outlier Detection + Cost Concentration | Flag 99th percentile records. Pareto card: "Top 1% = 34% of total cost." Trimmed/Winsorized means option. | Medium | High |
| 5 | Cost by Care Setting | Breakdown by inpatient/outpatient/ER/pharmacy. Standard MarketScan/Optum view. Maps to visit_concept_id. | Medium | Medium |
| 6 | Cross-Source Cost Comparison | Side-by-side cost distributions per source. Small-multiples box plots. Reveals pricing/population differences. | Medium | Medium |
| 7 | Cost Drivers Analysis | Top 10 conditions/procedures/drugs by cost contribution. Treemap or bars. Drill into cost driver → patient count, avg cost, trend. | Medium-High | Medium |

**Backend changes:**
- Extend cost summary to return distribution data: min, p10, p25, median, p75, p90, max per domain
- Compute PPPY: total_cost / person_count / avg_observation_years
- Add cost_type_concept_id filter to all cost queries; return `available_cost_types` array
- Outlier detection: compute 99th percentile, count records above, compute concentration percentage
- Care setting breakdown: join cost to visit_occurrence, group by visit_concept_id categories
- Cross-source: `GET /network/ares/cost/compare` — distributions per source
- Cost drivers: `GET /sources/{source}/ares/cost/drivers` — top N concepts by total cost contribution
- New endpoint `GET /sources/{source}/ares/cost/distribution?domain=` — full distribution data for box plots

**Frontend changes:**
- New `CostBoxPlot` component — Recharts custom shape for box-and-whisker with outlier dots
- PPPY card alongside total cost card
- Cost type toggle + warning banner when multiple types detected
- Outlier Pareto card: "Top 1% = X% of total cost"
- New `CareSettingBreakdown` component — stacked bar or grouped bars by setting
- Cross-source toggle → small-multiples box plots
- New `CostDrivers` component — horizontal bars or treemap of top cost concepts with drill-down

---

## 3. New Database Tables

| Table | Purpose |
|---|---|
| `app.dq_sla_targets` | Per-source quality SLA thresholds (source_id, category, min_pass_rate) |
| `app.feasibility_templates` | Pre-built study type templates (name, study_type, criteria jsonb) |
| `app.diversity_benchmarks` | Disease-epidemiology demographic benchmarks (condition_concept_id, demographic_type, group_name, expected_percentage). User-configurable via admin import endpoint — no hardcoded seed. Initial dataset sourced from CDC WONDER prevalence data for top 20 conditions (cited in seed documentation for regulatory credibility). Admin can import/edit via `POST /admin/diversity-benchmarks`. |
| `app.unmapped_code_reviews` | Mapping triage workflow state (unmapped_code_id, status, mapped_concept_id, reviewed_by, reviewed_at) |

## 4. Altered Existing Tables

| Table | Change |
|---|---|
| `app.chart_annotations` | Add `tag` varchar(30), add `parent_id` nullable FK (self-referential for threading) |
| `app.source_releases` | Add `etl_metadata` jsonb nullable (provenance: who, code_version, parameters, duration) |
| `app.sources` | Add `source_type` varchar(20) nullable (claims/ehr/registry) — manually set by admin via Source settings, added to `$fillable`. Used for expected completeness benchmarks in Coverage Matrix. Not computed/inferred. |

## 5. New Backend Services

| Service | Purpose |
|---|---|
| `AutoAnnotationService` | Listens to events, auto-creates system annotations for DQ drops, releases, unmapped code spikes |
| `ConceptStandardizationService` | Age-sex direct standardization for concept prevalence rates |
| `PatientArrivalForecastService` | Estimate monthly patient accrual from historical concept occurrence data |
| `MappingSuggestionService` | pgvector-based concept embedding similarity for AI mapping suggestions |
| `ReleaseDiffService` | Compute diff between consecutive releases: person/record/domain/DQ/unmapped deltas |

## 6. Implementation Phasing

Given 70 enhancements, implementation should be phased by impact and dependency:

### Phase A: High-Impact, Low-Effort (Quick Wins)
All "Low effort" items across all panels. ~20 enhancements.
- Sparklines, freshness monitor, domain count, person count, row click (Panel 1)
- Confidence intervals (Panel 2)
- Good/bad zone shading (Panel 3)
- Observation period highlight, interactive highlighting, view mode toggle, summary row (Panel 4)
- Continuous scoring (Panel 5)
- Diversity index (Panel 6)
- Edit release metadata (Panel 7)
- Impact-weighted priority score (Panel 8)
- Tags, full-text search (Panel 9)
- PPPY metric (Panel 10)

### Phase B: Core Transformations
The highest-impact medium-effort items. ~25 enhancements.
- Auto-generated alerts (Panel 1)
- Multi-concept comparison, attrition funnel (Panel 2)
- Category heatmap, cross-source overlay, check sparklines (Panel 3)
- Temporal coverage bars, expected vs actual (Panel 4)
- Criteria impact, failure drill-down, observation time criterion, CONSORT diagram, templates (Panel 5)
- Benchmark overlay, age pyramid, DAP gap analysis, pooled demographics (Panel 6)
- Release diff, swimlane, auto-notes, calendar, impact assessment (Panel 7)
- Pareto chart, progress tracker, release diff, treemap, export (Panel 8)
- Auto-generated system annotations, timeline view, create from charts (Panel 9)
- Box-whisker, cost type filter, outlier detection, care setting (Panel 10)

### Phase C: Advanced Capabilities
Higher-effort, medium-impact items. ~15 enhancements.
- DQ radar profile (Panel 1)
- Age-sex standardization, temporal trends, concept sets, benchmark line (Panel 2)
- DQ SLA dashboard, regression root cause, export (Panel 3)
- Export data availability letter (Panel 4)
- Patient arrival forecast (Panel 5)
- Geographic + socioeconomic diversity, diversity trends (Panel 6)
- ETL provenance (Panel 7)
- AI-suggested mappings (Panel 8)
- Chart-anchored markers, threaded discussions (Panel 9)
- Cross-source cost comparison, cost drivers (Panel 10)

### Phase D: Differentiators (Priority Subset of Phase C)
**Note:** Phase D is not a sequential phase — it is a priority label on 5 items within Phase C that should be implemented first within that phase because they are competitive differentiators with no equivalent in any OHDSI tool or commercial competitor:
- Age-sex standardized rates (no OHDSI tool does this)
- Patient arrival rate forecast (TriNetX's killer feature)
- Geographic + socioeconomic diversity (FDA DAP compliance ahead of competitors)
- AI-suggested concept mappings (pgvector-powered)
- Cost type awareness with warnings (prevents most common HEOR error)

---

## 7. Security

All new endpoints follow existing HIGHSEC patterns:
- `auth:sanctum` + `permission:analyses.view` for read endpoints
- `permission:analyses.create` for write endpoints (mapping acceptance, SLA definition, template creation)
- Rate limiting on AI suggestion endpoints (computationally expensive)
- No PHI exposure — all data is aggregate-level
- Mapping acceptance writes to `source_to_concept_map` — requires `permission:mapping.override`

## 8. Testing Strategy

Each phase follows TDD:
- Unit tests per new service method
- Integration tests per new API endpoint
- Frontend component tests for new chart types
- TypeScript strict mode — no `any` types

Target: 80%+ coverage on new code, consistent with project standards.
