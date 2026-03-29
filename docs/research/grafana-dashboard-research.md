# Grafana Dashboard Design Research Report
## For Parthenon Platform (20+ Docker Containers, Prometheus + Loki, Grafana 11)

**Date**: 2026-03-15

---

## Table of Contents

1. [Dashboard Design Principles](#1-dashboard-design-principles)
2. [Grafana Panel Types and Modern Features](#2-grafana-panel-types-and-modern-features)
3. [Production-Grade Docker Monitoring Dashboards](#3-production-grade-docker-monitoring-dashboards)
4. [USE/RED Methodology](#4-usered-methodology)
5. [Single-Pane-of-Glass Patterns](#5-single-pane-of-glass-patterns)
6. [Canvas Panel for Topology Visualization](#6-canvas-panel-for-topology-visualization)
7. [Color Psychology and Thresholds](#7-color-psychology-and-thresholds)
8. [Dashboard Performance](#8-dashboard-performance)
9. [Row Organization for 20+ Services](#9-row-organization-for-20-services)
10. [Log Integration with Metric Dashboards](#10-log-integration-with-metric-dashboards)
11. [Recommended Dashboard Architecture](#11-recommended-dashboard-architecture)

---

## 1. Dashboard Design Principles

### Information Hierarchy: General to Specific

The single most important principle from Grafana Labs is **progressive disclosure** — organize data from general to specific, creating a narrative that guides viewers through the dashboard. The official documentation explicitly recommends:

- **Top of dashboard**: High-level health indicators (stat panels, gauges) — "Is everything OK?"
- **Middle rows**: Trend data and comparative metrics (time series) — "What's happening over time?"
- **Bottom rows / drill-down**: Detailed data (tables, logs) — "What are the specifics?"

This mirrors how SRE teams triage: glance at the top for a health check, scan the middle for anomalies, dive into the bottom for root cause analysis.

*Source: [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)*

### Layout Patterns

- **24-column grid system**: Grafana's layout foundation. Use it to create balanced, consistent panel sizes.
- **Z-pattern reading**: Place the most critical metrics in the top-left and top-right positions, following natural eye movement. Studies cited by Grafana practitioners suggest this reduces cognitive load by ~40% vs random placement.
- **Consistent spacing**: 20px margins between rows, 10px gaps between panels.
- **Consistent panel sizes**: Panels within a row should be the same height. Related panels should be the same width.

*Source: [CompileNRun Dashboard Layouts](https://www.compilenrun.com/docs/observability/grafana/grafana-dashboards/dashboard-layouts/)*

### Critical Do's and Don'ts

**Do:**
- Add documentation via Text panels and panel descriptions (tooltip `i` icons)
- Compare like-to-like metrics; split when magnitude differs greatly
- Normalize axes (CPU as percentage, not raw ticks)
- Version-control dashboard JSON
- Use meaningful dashboard names describing purpose
- Use template variables instead of creating separate dashboards per service

**Don't:**
- Stack graph data (it hides important information and can be misleading)
- Allow uncontrolled dashboard sprawl (one dashboard per service)
- Use unnecessary auto-refresh rates
- Edit dashboards in production — test in a staging/dev copy first
- Copy dashboards without significant changes (use variables instead)

*Source: [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)*

---

## 2. Grafana Panel Types and Modern Features

### Complete Visualization Inventory (Grafana 11+)

| Panel Type | Best For | When to Use in Parthenon |
|---|---|---|
| **Stat** | Single KPI values with optional sparkline | Container count, total CPU %, total memory %, uptime |
| **Gauge** | Single value against min/max range | Per-service CPU/memory utilization (0-100%) |
| **Bar Gauge** | Comparing multiple values against thresholds | Side-by-side container resource comparison |
| **Time Series** | Metrics over time (the workhorse) | CPU, memory, network, disk trends |
| **State Timeline** | State changes over time (bars showing duration) | Container health states (running/stopped/restarting) |
| **Status History** | Periodic state snapshots | Service availability matrix |
| **Table** | Detailed multi-column data | Container details: image, uptime, restart count, ports |
| **Logs** | Log streams | Loki log panels filtered by container |
| **Heatmap** | Density/distribution in 2D | Request latency distribution, I/O patterns |
| **Pie Chart** | Part-to-whole proportions | Resource allocation across service tiers |
| **Canvas** | Free-form layout with data binding | Architecture topology diagram |
| **Node Graph** | Directed graphs, network topology | Service dependency visualization |
| **Bar Chart** | Categorical comparisons | Container resource comparison bars |
| **Histogram** | Value distribution | Response time distribution |
| **Text** | Documentation, instructions | Section headers, dashboard usage guide |
| **Alert List** | Active alert summary | Current firing alerts at top of dashboard |

### Key Grafana 11 Features

- **Canvas panel actions**: Elements can trigger API calls (e.g., restart a container via Portainer API)
- **Bar gauge legend support**: Legends are now available in bar gauge visualizations
- **Scenes-powered dashboards** (11.3+): Improved rendering and interaction model
- **Improved pan/zoom on Canvas**: Re-engineered for placing elements beyond panel edges
- **Data links and actions**: Configurable per-element in Canvas panels

*Sources: [Grafana Visualizations Docs](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/), [Grafana 11.3 Release](https://grafana.com/blog/2024/10/23/grafana-11.3-release-all-the-new-features/)*

---

## 3. Production-Grade Docker Monitoring Dashboards

### Analysis of Top Community Dashboards

**Dashboard 893 — Docker and System Monitoring** (most popular, foundational)
- **Organization**: Two main sections — System Metrics (top) using gauges/text, Docker Metrics (bottom) using graphs
- **System metrics**: Uptime, memory/swap, disk usage (with alerts), load average (with alerts), network traffic, CPU usage, disk I/O
- **Container metrics**: CPU per container, network TX/RX per container, memory/swap per container, available memory remaining
- **Visualization types**: Gauges for quick system overview, graphs for all temporal data
- **Data sources**: cAdvisor + Prometheus + Node Exporter

*Source: [Dashboard 893](https://grafana.com/grafana/dashboards/893-main/)*

**Dashboard 19908 — cAdvisor Docker Insights**
- Focused specifically on cAdvisor data
- Tracks CPU, memory, I/O, and container restart counts
- Uses Prometheus as the sole data source

*Source: [Dashboard 19908](https://grafana.com/grafana/dashboards/19908-docker-container-monitoring-with-prometheus-and-cadvisor/)*

**Dashboard 179 — Docker and Host Monitoring w/ Prometheus**
- Part of the `dockprom` project (stefanprodan/dockprom on GitHub)
- Comes with automated provisioning of datasources and dashboards
- Combines host and container views

*Source: [Dashboard 179](https://grafana.com/grafana/dashboards/179-docker-prometheus-monitoring/)*

### Common Patterns Across Top Dashboards

1. **Template variables** at the top: Job, Node/Host, Container selectors with multi-value support
2. **System-first, then containers**: Host health at the top, container detail below
3. **Gauges for "right now"**: Current CPU/memory/disk utilization
4. **Time series for trends**: Everything that changes over time gets a graph
5. **Alerts on critical resources**: Disk, memory, and load thresholds with visual indicators

### What Makes These "Primitive"

The community dashboards share common weaknesses:
- No log integration (pure metrics)
- No architectural context (no topology view)
- No USE/RED methodology structure
- Basic or no state/health visualization
- Separate dashboards for system vs container vs logs (not unified)
- No canvas or visual topology elements

---

## 4. USE/RED Methodology

### USE Method (Infrastructure — "How happy are your machines?")

Created by Brendan Gregg. For **every resource** (CPU, memory, disk, network), measure:

| Signal | Definition | Parthenon Metrics |
|---|---|---|
| **Utilization** | % of resource capacity in use | `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, `node_filesystem_avail_bytes` |
| **Saturation** | Queue length / work waiting | CPU load average (`node_load1/5/15`), disk I/O queue, memory swap usage |
| **Errors** | Resource-level failures | Network errors (`node_network_receive_errs_total`), disk errors |

### RED Method (Services — "How happy are your users?")

Created by Tom Wilkie (Grafana Labs). For **every service**, measure:

| Signal | Definition | Parthenon Metrics |
|---|---|---|
| **Rate** | Requests per second | HTTP request counters from application exporters |
| **Errors** | Failed requests per second | HTTP 5xx responses, error log rate from Loki |
| **Duration** | Response time distribution (p50, p90, p99) | Request duration histograms |

### How They Complement Each Other

- **USE tells you WHY** infrastructure is struggling (CPU saturated, disk full)
- **RED tells you WHAT** users experience (slow responses, errors)
- When RED shows high duration, check USE for saturation on the relevant resource
- **Dashboard layout implication**: Tom Wilkie recommends one row per service, with RED metrics. USE metrics form the infrastructure section above.

### Practical Layout from Tom Wilkie's GrafanaCon Talk

```
Row: Service A
  [Request Rate]  [Error Rate]  [Latency p50/p90/p99]

Row: Service B
  [Request Rate]  [Error Rate]  [Latency p50/p90/p99]
```

With request/error rates on the left and latency on the right, ordered to reflect data flow.

*Sources: [Grafana RED Method Blog](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/), [Better Stack USE and RED Guide](https://betterstack.com/community/guides/monitoring/red-use-metrics/)*

---

## 5. Single-Pane-of-Glass Patterns

### Core Grafana Features for Unified Dashboards

**Mixed Data Sources**: Grafana supports multiple data sources per dashboard and even per panel. A single panel can query both Prometheus and Loki using mixed mode.

**Dashboard Variables (Template Variables)**: Dropdown selectors at the top that filter all panels simultaneously. For Parthenon:
- `$container` — select one or all containers
- `$service_tier` — filter by tier (infrastructure, backend, frontend, database)
- `$timerange` — control time window
- `$log_level` — filter log severity (error, warn, info, debug)
- `$search` — free-text log search

**Data Links**: Clickable links on panel values/series that navigate to other dashboards or external tools, passing context (container name, time range) as URL parameters. Example: clicking a container name in a metrics panel opens the log panel filtered to that container.

**Annotations**: Events from different data sources overlaid on time series graphs. Useful for marking deployments, restarts, or alert triggers directly on metric graphs.

**Transformations**: Merge, Join by field, and computed fields allow normalizing and combining data from Prometheus and Loki in a single panel.

### Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│  Variables: [$container] [$service_tier] [$search]  │
├─────────────────────────────────────────────────────┤
│  Row 0: Platform Overview (Canvas topology + stats) │
├─────────────────────────────────────────────────────┤
│  Row 1: Infrastructure USE (CPU, Mem, Disk, Net)    │
├─────────────────────────────────────────────────────┤
│  Row 2: Container Overview (table + bar gauges)     │
├─────────────────────────────────────────────────────┤
│  Row 3-N: Per-Service Detail (metrics + logs)       │
├─────────────────────────────────────────────────────┤
│  Row N+1: Centralized Logs Panel                    │
└─────────────────────────────────────────────────────┘
```

*Sources: [Grafana Data Sources Docs](https://grafana.com/docs/grafana/latest/datasources/), [Unified Dashboard Example](https://nsalexamy.github.io/service-foundry/pages/documents/o11y-foundry/grafana-unified-dashboard/)*

---

## 6. Canvas Panel for Topology Visualization

### Capability Assessment

The Canvas panel is well-suited for creating a Parthenon architecture topology. Key capabilities:

**Element Placement**: Elements can be placed freely on the canvas with snap-to-grid alignment. Available elements include shapes, text, metric values, images, and buttons.

**Data Binding**: Every element property (color, text, size) can be bound to query results. For example, a container box can turn green when healthy and red when down, driven by a Prometheus query like `up{container="nginx"}`.

**Connections**: Lines between elements with configurable:
- Color (can be data-driven — green for healthy connections, red for errors)
- Direction (arrows showing data flow)
- Style (solid, dashed, dotted)
- Animation (flowing dots showing live traffic)

**Interactive Actions**: Buttons can trigger API calls (e.g., POST to restart a container), and all elements support data links to drill down into specific service dashboards.

**Pan and Zoom**: The canvas supports pan and zoom for navigating large topologies.

### Practical Application for Parthenon

A Canvas panel could visualize the Parthenon stack as a topology diagram:

```
[Internet] → [Nginx] → [Frontend App]
                    ↘ [Backend API] → [PostgreSQL]
                                    → [Redis]
                    ↘ [Worker Services]
[Prometheus] ← [cAdvisor] ← [All Containers]
[Loki] ← [Promtail] ← [All Container Logs]
```

Each node colored by health status, with connection lines showing data flow. Clicking any node would filter the dashboard to that service.

### Limitations

- Canvas panels require manual layout (no auto-discovery of topology)
- Complex canvases with many elements may impact rendering performance
- Element positioning is static — adding/removing containers requires manual canvas updates
- For 20+ containers, the canvas can become cluttered; consider grouping by tier

*Sources: [Canvas Panel Blog](https://grafana.com/blog/2024/05/14/canvas-panel-in-grafana-create-custom-visualizations-with-all-the-latest-features/), [Canvas Docs](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/canvas/)*

---

## 7. Color Psychology and Thresholds

### Standard Color Conventions

Grafana's own guidance and community consensus:

| Color | Meaning | Use Case |
|---|---|---|
| **Green** (#73BF69) | Healthy, normal, OK | Utilization < 70%, no errors |
| **Yellow/Orange** (#FF9830) | Warning, elevated | Utilization 70-85%, error rate rising |
| **Red** (#F2495C) | Critical, danger | Utilization > 85%, errors high, service down |
| **Blue** (#5794F2) | Informational, neutral | Baseline metrics, informational stats |
| **Purple** (#B877D9) | Special/highlighted | Custom metrics, non-standard signals |
| **Super light green** background | Subtle healthy indicator | Stat panel backgrounds when value is OK |

### Threshold Configuration by Panel Type

**Stat Panels**: Use background color mode with thresholds. The large number changes color contextually.
- Example: Container Count stat — green if all 20+ running, yellow if 1-2 down, red if 3+ down

**Gauges**: Natural fit for utilization metrics (0-100%). Set thresholds at:
- 0-70%: Green
- 70-85%: Yellow
- 85-100%: Red

**Bar Gauges**: Three display modes:
- **Gradient**: Smooth color transition through thresholds (best for utilization)
- **Retro LCD**: Segmented cells (visually distinctive, good for dashboards shown on wall monitors)
- **Basic**: Single color based on current threshold (simplest, least distracting)

**Time Series**: Use threshold lines (horizontal dashed lines) to show warning/critical boundaries on graphs. Color series by threshold zones using "Color scheme: From thresholds (by value)".

### When to Use Which Panel

| Metric Type | Best Panel | Rationale |
|---|---|---|
| Current single value (is it OK?) | **Stat** | Glanceable, background color conveys status instantly |
| Current value against a range | **Gauge** | Visual proportion of "how full" |
| Compare N services | **Bar Gauge** | Side-by-side comparison with threshold colors |
| Trend over time | **Time Series** | The only choice for temporal patterns |
| Current state (up/down) | **Stat** with value mapping | Map 0→"DOWN"/red, 1→"UP"/green |
| State history | **State Timeline** | Shows duration in each state as colored bars |

### Accessibility

- Always supplement color with text labels or value mappings (e.g., "UP"/"DOWN" not just green/red)
- Use line style differentiation (solid/dashed) in addition to color for time series
- Consider colorblind-safe palettes — avoid relying solely on red/green distinction

*Sources: [Grafana Threshold Docs](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-thresholds/), [Extreme Dashboard Makeover](https://deepwiki.com/grafana/extreme-dashboard-makeover-breakouts/3.1-visualization-types)*

---

## 8. Dashboard Performance

### Panel Count Guidance

There is no hard limit, but practical recommendations:
- **25-30 panels visible at once** is the practical upper limit before rendering degrades
- Use **collapsible rows** so panels in collapsed rows are NOT loaded until expanded
- This allows a dashboard with 80+ total panels if only 20-30 are visible at any time

### Query Optimization for Prometheus

1. **Use label selectors** to narrow series: `container_cpu_usage_seconds_total{name=~"parthenon.*"}` not just `container_cpu_usage_seconds_total`
2. **Use `$__interval` in range queries** and `$__range` in instant queries
3. **Avoid high-cardinality label grouping** (don't group by request ID, use container name)
4. **Consolidate similar queries**: Use regex label matching to combine multiple queries into one
5. **Set Max Data Points** per panel to avoid returning more points than pixels
6. **Set Min Interval** to match your scrape interval (e.g., 15s) — no point querying at higher resolution
7. **Reuse query results** across panels using the "Reuse query" feature or shared queries

### Query Optimization for Loki

1. **Use Instant queries** for aggregations (tables, stats) — much faster than range queries
2. **Use narrow label selectors** before applying line filters: `{container="nginx"} |= "error"` not `{job="containers"} |= "error"`
3. **Avoid broad regex in log queries** — Loki processes every line matching label selectors
4. **Use `logfmt` or `json` parsers** after label filtering, not before
5. **Limit log panels to specific containers** via variable, never show all container logs unfiltered

### Refresh Interval Strategy

| Dashboard Use | Recommended Refresh |
|---|---|
| Wall-mounted monitoring display | 30s |
| Active troubleshooting | 10s |
| Daily review | Off (manual) |
| Default for Parthenon | **15s** (matches typical Prometheus scrape interval) |

### Performance Architecture

- Collapsed rows = deferred loading = free panels that don't cost performance until opened
- Consider recording rules for expensive PromQL expressions that multiple panels need
- Cache Prometheus queries for panels that don't need real-time data (e.g., container info table)

*Sources: [Grafana Query Optimization Blog](https://grafana.com/blog/grafana-dashboards-tips-for-optimizing-query-performance/), [CompileNRun Performance Guide](https://www.compilenrun.com/docs/observability/grafana/grafana-performance/performance-optimization/)*

---

## 9. Row Organization for 20+ Services

### Strategy: Tiered Rows with Variable-Driven Repeat

For 20+ containers, the key insight is: **not all containers deserve equal dashboard real estate**. Organize by tier:

**Tier 1 — Always Visible (Critical Infrastructure)**
- Nginx/reverse proxy
- PostgreSQL database
- Backend API
- Frontend application

**Tier 2 — Collapsible Rows (Supporting Services)**
- Redis, Celery workers, background jobs
- Monitoring stack (Prometheus, Grafana, Loki)

**Tier 3 — On-Demand (Variable-Driven Repeat)**
- All other containers via a repeating row driven by `$container` variable

### Collapsible Rows

Rows can be collapsed/expanded. When collapsed, panels inside are NOT loaded — this is critical for performance with 20+ services. The approach:

1. Top rows (always open): Platform overview, infrastructure health
2. Middle rows (collapsed by default): Per-tier service groups
3. Bottom rows: Log panels, detail tables

### Variable-Driven Repeating Rows

The most powerful pattern for scaling to many services:

1. Create a template variable `$container` with a query like `label_values(container_cpu_usage_seconds_total, name)`
2. Create a row with title `Container: $container`
3. Set "Repeat for" to `$container`
4. Panels within the row use `$container` in their queries

This automatically generates one row per container with identical panel layout. Users can select specific containers or "All" from the dropdown.

### Recommended Variable Hierarchy

```
$datasource  → Prometheus (allows switching data sources)
$host        → Node/host selector
$tier        → "infrastructure", "backend", "frontend", "database", "monitoring"
$container   → Container name (filtered by $tier if chained)
$log_level   → "error", "warn", "info", "debug"
$search      → Free-text log filter
```

Chain variables so selecting a `$tier` filters the `$container` dropdown to only containers in that tier.

*Sources: [Grafana Repeat Rows Blog](https://grafana.com/blog/2020/06/09/learn-grafana-how-to-automatically-repeat-rows-and-panels-in-dynamic-dashboards/), [Medium: Repeating Rows and Panels](https://medium.com/@platform.engineers/configuring-repeating-rows-and-panels-in-grafana-b365facf2bae)*

---

## 10. Log Integration with Metric Dashboards

### Six Techniques for Effective Log Integration

Based on Grafana Labs' official recommendations:

**1. Logs Panel with Variable Filtering**
Add a Logs panel using Loki that shares the dashboard's `$container` variable:
```
{container="$container"} |= "$search"
```
When a user selects a container in the dropdown, both metric and log panels update simultaneously.

**2. Data Links from Metrics to Logs**
Configure data links on metric panels (e.g., time series showing error rate) to navigate to the Logs panel or Explore view with pre-filled Loki queries. Pass context via URL parameters:
```
/explore?left={"queries":[{"expr":"{container=\"${__field.labels.container}\"} |= \"error\""}]}
```

**3. Log Volume Visualization**
Use a time series panel with a Loki `count_over_time` query to show log volume as a bar chart above the Logs panel. This pattern (used in Grafana Explore) gives visual context for log density.

**4. Error Log Rate Alongside Metrics**
Place a time series panel showing `sum(count_over_time({container="$container"} |= "error" [$__interval]))` directly next to or below the corresponding service's metric panels. This correlates error bursts in logs with metric anomalies.

**5. Ad Hoc Filter Tables**
Parse logs with `logfmt` or `json` parser and aggregate into table panels showing top error paths, most common log patterns, or error counts by type. Use Instant query type for performance.

**6. Instructional Text Panels**
Include a Text panel explaining how to use log filtering, what variables control which panels, and how data links work. This is especially valuable for a complex unified dashboard.

### Mixed Data Source Pattern

A single row can contain:
- Left: Prometheus time series (CPU, memory, error rate)
- Right: Loki Logs panel (filtered to same container)
- Both driven by the same `$container` variable

This creates a powerful correlation view: see the metric anomaly and the corresponding log entries side by side.

*Sources: [6 Ways to Improve Log Dashboards](https://grafana.com/blog/2023/05/18/6-easy-ways-to-improve-your-log-dashboards-with-grafana-and-grafana-loki/), [Loki Quick Tip](https://grafana.com/blog/2020/04/08/loki-quick-tip-how-to-create-a-grafana-dashboard-for-searching-logs-using-loki-and-prometheus/)*

---

## 11. Recommended Dashboard Architecture

### The Unified Parthenon Dashboard

Synthesizing all findings, here is the concrete architecture for a single, production-grade unified dashboard.

### Dashboard Variables (Top Bar)

```
$datasource   | Prometheus data source selector
$loki         | Loki data source selector
$host         | Node/host (for multi-host future)
$tier         | Service tier: All, Infrastructure, Backend, Frontend, Database, Monitoring
$container    | Container name (chained from $tier, multi-value, include All)
$log_level    | Log severity: All, error, warn, info, debug
$search       | Free-text log search (text box)
```

### Row-by-Row Layout

---

#### Row 0: Platform Health Summary (ALWAYS VISIBLE — never collapse)

**Purpose**: 5-second glance answers "Is Parthenon OK?"

| Panel | Type | Width | Content |
|---|---|---|---|
| Platform Status | **Stat** (colored background) | 4 cols | Value mapping: all containers up = "HEALTHY"/green, any down = "DEGRADED"/yellow, critical down = "CRITICAL"/red |
| Containers Running | **Stat** with sparkline | 4 cols | `count(container_last_seen{name=~".+"} > (time() - 60))` |
| Total CPU Usage | **Gauge** | 4 cols | Sum of all container CPU %, thresholds at 70/85% |
| Total Memory Usage | **Gauge** | 4 cols | Sum of all container memory %, thresholds at 70/85% |
| Error Log Rate | **Stat** with sparkline | 4 cols | `sum(count_over_time({job="containers"} |= "error" [$__interval]))` — red threshold if > 10/min |
| Uptime | **Stat** | 4 cols | Host uptime from Node Exporter |

---

#### Row 1: Architecture Topology (COLLAPSIBLE — open by default)

**Purpose**: Visual map of the Parthenon platform in action

| Panel | Type | Width | Content |
|---|---|---|---|
| Parthenon Architecture | **Canvas** | 24 cols (full width) | Topology diagram showing all containers grouped by tier, with connection lines showing data flow. Each node colored by health status (green/yellow/red) via data binding. Clicking a node sets `$container` variable and scrolls to detail. |

**Canvas Elements**:
- Rectangle nodes for each container, grouped visually by tier
- Connection lines with arrows showing request flow (Internet → Nginx → Backend → DB)
- Color bound to `up{}` metric per container
- Text labels showing container name and current CPU/memory
- Connections animated for live traffic indication

---

#### Row 2: Container Status Matrix (COLLAPSIBLE — open by default)

**Purpose**: Which containers are up, which are struggling?

| Panel | Type | Width | Content |
|---|---|---|---|
| Container Health Timeline | **State Timeline** | 16 cols | Show running/stopped/restarting states for all containers over the selected time range, one row per container |
| Container Restart Count | **Bar Gauge** (horizontal) | 8 cols | `changes(container_last_seen{name=~".+"}[1h])` — highlight containers that have restarted |

---

#### Row 3: Host Infrastructure — USE Method (COLLAPSIBLE — open by default)

**Purpose**: Is the underlying host healthy? (USE method)

| Panel | Type | Width | Content |
|---|---|---|---|
| CPU Utilization | **Gauge** | 4 cols | `100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| CPU Saturation (Load) | **Time Series** | 8 cols | `node_load1`, `node_load5`, `node_load15` with CPU count as threshold line |
| Memory Utilization | **Gauge** | 4 cols | `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` |
| Memory Saturation (Swap) | **Time Series** | 8 cols | Swap usage over time |
| Disk Utilization | **Bar Gauge** | 6 cols | Per-mount filesystem usage % |
| Disk I/O | **Time Series** | 6 cols | Read/write bytes per second |
| Network Utilization | **Time Series** | 6 cols | `node_network_receive_bytes_total` / `transmit` rates |
| Network Errors | **Stat** | 6 cols | `node_network_receive_errs_total` + `transmit_errs` — red if > 0 |

---

#### Row 4: Container Resource Comparison (COLLAPSIBLE — open by default)

**Purpose**: Which containers are consuming the most resources?

| Panel | Type | Width | Content |
|---|---|---|---|
| CPU by Container | **Bar Gauge** (horizontal, sorted) | 12 cols | All containers ranked by CPU usage, threshold colors |
| Memory by Container | **Bar Gauge** (horizontal, sorted) | 12 cols | All containers ranked by memory usage, threshold colors |
| Network I/O by Container | **Time Series** (stacked — exception to the no-stacking rule, justified for network breakdown) | 12 cols | Per-container network receive/transmit rates |
| Disk I/O by Container | **Time Series** | 12 cols | Per-container block I/O |

---

#### Row 5: Container Detail — Per-Service (COLLAPSIBLE — collapsed by default, REPEATING)

**Purpose**: Deep dive into any specific container

**Configuration**: This row repeats for each value of `$container`. Title: `Container: $container`

| Panel | Type | Width | Content |
|---|---|---|---|
| Status | **Stat** | 3 cols | Up/Down with value mapping |
| CPU | **Time Series** | 7 cols | CPU usage for `$container` over time |
| Memory | **Time Series** | 7 cols | Memory usage for `$container` over time |
| Network | **Time Series** | 7 cols | Network RX/TX for `$container` |
| Recent Logs | **Logs** | 24 cols (full width below) | `{container="$container"} |~ "$search"` filtered by `$log_level` |

---

#### Row 6: Centralized Log Explorer (COLLAPSIBLE — collapsed by default)

**Purpose**: Search and browse logs across all containers

| Panel | Type | Width | Content |
|---|---|---|---|
| Log Volume Over Time | **Time Series** (bar style) | 24 cols | `sum by (container) (count_over_time({job="containers"} [$__interval]))` — shows which containers are logging most |
| Error Log Volume | **Time Series** (bar style, red) | 24 cols | `sum by (container) (count_over_time({job="containers"} |= "error" [$__interval]))` |
| Live Logs | **Logs** | 24 cols | `{container=~"$container"} |~ "$search"` with `$log_level` filter — full log stream |

---

#### Row 7: Alerts Summary (COLLAPSIBLE — collapsed by default)

**Purpose**: Current alert state

| Panel | Type | Width | Content |
|---|---|---|---|
| Firing Alerts | **Alert List** | 12 cols | All currently firing alerts |
| Recent Annotations | **Annotations List** | 12 cols | Deployment events, restart events |

---

### Data Links Configuration

| From Panel | Link Target | Context Passed |
|---|---|---|
| Any container name in a table/bar gauge | Row 5 (Container Detail) | `$container` set to clicked value |
| Error rate time series spike | Row 6 (Log Explorer) filtered to errors | Time range + container name |
| Canvas node click | Row 5 (Container Detail) | `$container` set to clicked node |
| Container in State Timeline | Grafana Explore (Loki) | Container + time range |

### Annotations

- **Deployment events**: Mark on all time series graphs when containers are redeployed
- **Restart events**: Mark when containers restart unexpectedly
- **Alert events**: Mark when alerts fire/resolve

### Total Panel Count Estimate

| Row | Panels | Default State |
|---|---|---|
| Row 0: Health Summary | 6 | Open |
| Row 1: Topology | 1 | Open |
| Row 2: Status Matrix | 2 | Open |
| Row 3: Host Infrastructure | 8 | Open |
| Row 4: Container Comparison | 4 | Open |
| Row 5: Per-Service Detail | 5 x N (repeat) | **Collapsed** |
| Row 6: Log Explorer | 3 | **Collapsed** |
| Row 7: Alerts | 2 | **Collapsed** |
| **Visible at once** | **~21** | Well within performance limits |
| **Total with all expanded** | **~126** (for 20 containers) | Collapsed rows defer loading |

### Key Design Decisions Summary

1. **Canvas topology over Node Graph**: Canvas allows custom layout matching the actual Parthenon architecture, with data-bound health colors and clickable navigation. Node Graph auto-layouts but lacks the custom positioning needed for an architecture diagram.

2. **State Timeline over simple up/down stats**: State Timeline shows duration of outages and restart patterns over time, far more informative than a point-in-time status indicator alone.

3. **Repeating rows over separate dashboards**: One dashboard with variable-driven repeating rows keeps everything unified while scaling to N containers without manual dashboard creation.

4. **Collapsed-by-default for detail rows**: Keeps the dashboard fast while making deep detail available one click away.

5. **Bar Gauge for resource ranking**: Immediately shows which of 20+ containers is the resource hog, sorted and color-coded.

6. **Mixed Prometheus + Loki per row**: Side-by-side metrics and logs in the per-service detail row enables instant correlation without switching dashboards.

7. **15s refresh interval**: Matches typical Prometheus scrape interval; fast enough for monitoring, light enough for performance with 20+ panels visible.

---

### Sources

- [Grafana Dashboard Best Practices (Official Docs)](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- [Grafana Visualizations Documentation](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/)
- [MetricFire: 7 Best Practices for Grafana Dashboard Design](https://www.metricfire.com/blog/7-best-practices-for-grafana-dashboard-design/)
- [CompileNRun: Dashboard Layouts](https://www.compilenrun.com/docs/observability/grafana/grafana-dashboards/dashboard-layouts/)
- [Grafana: The RED Method](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/)
- [Better Stack: RED and USE Metrics](https://betterstack.com/community/guides/monitoring/red-use-metrics/)
- [Grafana: Query Performance Optimization](https://grafana.com/blog/grafana-dashboards-tips-for-optimizing-query-performance/)
- [Grafana: 6 Ways to Improve Log Dashboards](https://grafana.com/blog/2023/05/18/6-easy-ways-to-improve-your-log-dashboards-with-grafana-and-grafana-loki/)
- [Grafana: Canvas Panel Features](https://grafana.com/blog/2024/05/14/canvas-panel-in-grafana-create-custom-visualizations-with-all-the-latest-features/)
- [Grafana: Repeating Rows and Panels](https://grafana.com/blog/2020/06/09/learn-grafana-how-to-automatically-repeat-rows-and-panels-in-dynamic-dashboards/)
- [Grafana: Threshold Configuration](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-thresholds/)
- [Grafana: State Timeline Docs](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/state-timeline/)
- [Grafana: Canvas Docs](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/canvas/)
- [Dashboard 893: Docker and System Monitoring](https://grafana.com/grafana/dashboards/893-main/)
- [Dashboard 19908: cAdvisor Docker Insights](https://grafana.com/grafana/dashboards/19908-docker-container-monitoring-with-prometheus-and-cadvisor/)
- [Unified Observability Dashboard Example](https://nsalexamy.github.io/service-foundry/pages/documents/o11y-foundry/grafana-unified-dashboard/)
- [Grafana Extreme Dashboard Makeover](https://deepwiki.com/grafana/extreme-dashboard-makeover-breakouts/3.1-visualization-types)
- [Grafana 11.3 Release Notes](https://grafana.com/blog/2024/10/23/grafana-11.3-release-all-the-new-features/)
- [Grafana 12: Dynamic Dashboards](https://grafana.com/blog/dynamic-dashboards-grafana-12/)
