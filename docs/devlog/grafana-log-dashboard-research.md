# Grafana + Loki Log Analysis Dashboard Research Report
## For Parthenon Platform (20+ Docker Containers, Promtail -> Loki 3.0, Grafana 11)

**Date**: 2026-03-15

---

## Table of Contents

1. [Dashboard Architecture and Panel Layout](#1-dashboard-architecture-and-panel-layout)
2. [Recommended Panels (Full Specification)](#2-recommended-panels-full-specification)
3. [LogQL Queries for Every Panel](#3-logql-queries-for-every-panel)
4. [Template Variables](#4-template-variables)
5. [Panel Configuration Details](#5-panel-configuration-details)
6. [Color Scheme and Visual Design](#6-color-scheme-and-visual-design)
7. [Loki-Specific Features to Leverage](#7-loki-specific-features-to-leverage)
8. [Derived Fields Configuration](#8-derived-fields-configuration)
9. [Performance Considerations](#9-performance-considerations)
10. [Implementation Priority](#10-implementation-priority)

---

## 1. Dashboard Architecture and Panel Layout

### Design Philosophy

The best log analysis dashboards follow **progressive disclosure** — the same principle documented in our existing Grafana research. For a dedicated log dashboard, this translates to:

1. **Row 1 — Health-at-a-Glance** (stat panels): Total log volume, error count, error rate %, top error container
2. **Row 2 — Log Volume Over Time** (time series): Stacked area chart of log volume by level and by container
3. **Row 3 — Error Analysis** (bar chart + table): Top error patterns, error rate trends, error breakdown by service
4. **Row 4 — Log Level Distribution** (pie chart + bar gauge): Proportional breakdown across all services
5. **Row 5 — Live Log Stream** (logs panel): Full-text searchable log viewer with rich filtering
6. **Row 6 — Container Health** (state timeline): Per-container log activity and error state over time

### Grid Layout (24-column system)

```
Row 1: [Total Logs 6w] [Error Count 6w] [Error Rate % 6w] [Top Error Service 6w]     h=4
Row 2: [Log Volume by Level 12w] [Log Volume by Container 12w]                         h=8
Row 3: [Error Rate Trend 12w] [Top 10 Error Patterns 12w]                              h=8
Row 4: [Log Level Pie 8w] [Logs per Container Bar 8w] [Log Throughput Rate 8w]         h=7
Row 5: [Log Stream — full width 24w]                                                    h=16
Row 6: [Container Log Activity State Timeline 24w]                                      h=6
```

---

## 2. Recommended Panels (Full Specification)

### Row 1: Health-at-a-Glance (4 Stat Panels)

| Panel | Type | Purpose |
|-------|------|---------|
| Total Log Lines | Stat | Total log entries in the selected time range |
| Error Count | Stat | Count of error/critical/fatal logs — red threshold coloring |
| Error Rate % | Stat | Percentage of logs that are errors — with sparkline |
| Top Error Service | Stat | Container producing the most errors right now |

### Row 2: Log Volume Over Time (2 Time Series)

| Panel | Type | Purpose |
|-------|------|---------|
| Log Volume by Level | Time Series (stacked area) | Shows volume stacked by log level (debug/info/warn/error/critical) |
| Log Volume by Container | Time Series (stacked area) | Shows volume stacked by container/service name |

### Row 3: Error Analysis (2 Panels)

| Panel | Type | Purpose |
|-------|------|---------|
| Error Rate Trend | Time Series | Error rate per second over time — highlights spikes |
| Top 10 Error Patterns | Table | Most common error messages with count and last occurrence |

### Row 4: Distribution (3 Panels)

| Panel | Type | Purpose |
|-------|------|---------|
| Log Level Distribution | Pie Chart | Proportional breakdown of all log levels |
| Logs per Container | Bar Chart (horizontal) | Volume by container — identifies noisiest services |
| Log Throughput | Time Series | Lines per second — useful for capacity planning |

### Row 5: Live Log Stream (1 Panel)

| Panel | Type | Purpose |
|-------|------|---------|
| Log Stream | Logs | Full-text log viewer with syntax highlighting, JSON prettifying, and filtering |

### Row 6: Container Activity (1 Panel)

| Panel | Type | Purpose |
|-------|------|---------|
| Container Log Activity | State Timeline | Per-container view showing error/warn/healthy states over time |

---

## 3. LogQL Queries for Every Panel

### Row 1: Stat Panels

**Total Log Lines:**
```logql
sum(count_over_time({job="docker", service=~"$service"} |~ "$search" [$__auto]))
```

**Error Count:**
```logql
sum(count_over_time({job="docker", service=~"$service"} |~ "(?i)(error|err|critical|fatal|panic|exception)" |~ "$search" [$__auto]))
```

**Error Rate %:**
Use two queries with a math expression:
```logql
# Query A: errors
sum(count_over_time({job="docker", service=~"$service"} |~ "(?i)(error|critical|fatal|panic|exception)" [$__auto]))

# Query B: total
sum(count_over_time({job="docker", service=~"$service"} [$__auto]))

# Transform: A / B * 100
```

**Top Error Service:**
```logql
topk(1, sum by (service) (count_over_time({job="docker"} |~ "(?i)(error|critical|fatal|panic|exception)" [$__auto])))
```

### Row 2: Log Volume Time Series

**Log Volume by Level:**
```logql
sum by (detected_level) (count_over_time({job="docker", service=~"$service"} |~ "$search" [$__auto]))
```

If `detected_level` is not available (depends on Loki's automatic detection), use pattern extraction:

```logql
# For structured logs (JSON):
sum by (level) (count_over_time({job="docker", service=~"$service"} | json | level=~"$level" [$__auto]))

# For unstructured logs — regex extraction:
sum by (level) (count_over_time(
  {job="docker", service=~"$service"}
  | regexp "(?i)(?P<level>debug|info|notice|warn(?:ing)?|error|critical|fatal|panic|alert|emergency)"
  |~ "$search"
  [$__auto]
))
```

**Log Volume by Container:**
```logql
sum by (service) (count_over_time({job="docker", service=~"$service"} |~ "$search" [$__auto]))
```

### Row 3: Error Analysis

**Error Rate Trend:**
```logql
sum(rate({job="docker", service=~"$service"} |~ "(?i)(error|critical|fatal|panic|exception)" [$__auto]))
```

**Top 10 Error Patterns (Table):**
```logql
topk(10, sum by (service, pattern) (count_over_time(
  {job="docker", service=~"$service"}
  |~ "(?i)(error|critical|fatal|exception)"
  | pattern "<_> <level> <_> <pattern>"
  [$__auto]
)))
```

Alternative using `line_format` for cleaner pattern extraction:
```logql
topk(10, sum by (service) (count_over_time(
  {job="docker", service=~"$service"}
  |~ "(?i)(error|critical|fatal|exception)"
  [$__auto]
)))
```

For the table, an Instant query with `topk` works best. Add a second query to show sample error messages:
```logql
{job="docker", service=~"$service"} |~ "(?i)(error|critical|fatal|exception)" |~ "$search"
```

### Row 4: Distribution

**Log Level Pie Chart:**
```logql
sum by (detected_level) (count_over_time({job="docker", service=~"$service"} [$__auto]))
```

**Logs per Container (Bar Chart):**
```logql
sort_desc(sum by (service) (count_over_time({job="docker", service=~"$service"} [$__auto])))
```

**Log Throughput (lines/sec):**
```logql
sum(rate({job="docker", service=~"$service"} [$__auto]))
```

### Row 5: Log Stream

```logql
{job="docker", service=~"$service"} |~ "$search" | regexp "(?i)(?P<level>debug|info|notice|warn(?:ing)?|error|critical|fatal|panic|alert|emergency)"
```

For JSON-structured logs (Laravel, FastAPI, etc.):
```logql
{job="docker", service=~"$service"} |~ "$search" | json
```

### Row 6: State Timeline

For the state timeline, compute error presence per container in time buckets:
```logql
# Per-container error state (1 = errors present, 0 = clean)
sum by (service) (count_over_time({job="docker"} |~ "(?i)(error|critical|fatal)" [$__auto])) > 0
```

Use value mappings: 0 = "Healthy" (green), 1 = "Errors" (red).

---

## 4. Template Variables

### Variable Definitions

| Variable | Type | Query / Values | Multi | Include All |
|----------|------|----------------|-------|-------------|
| `datasource` | Datasource | Type: `loki` | No | No |
| `service` | Query | `label_values({job="docker"}, service)` | Yes | Yes (default) |
| `level` | Custom | `debug,info,notice,warn,warning,error,critical,fatal,panic` | Yes | Yes (default) |
| `search` | Text box | Default: `""` (empty) | N/A | N/A |

### Variable Configuration Details

**$service (Container/Service Selector):**
- Type: Query
- Data source: `$datasource`
- Query: `label_values({job="docker"}, service)`
- Multi-value: enabled
- Include All option: enabled, custom all value: `.*`
- Refresh: On time range change
- Sort: Alphabetical (asc)

**$level (Log Level Filter):**
- Type: Custom
- Values: `debug,info,notice,warn,warning,error,critical,fatal,panic`
- Multi-value: enabled
- Include All option: enabled, custom all value: `.*`

**$search (Free Text Search):**
- Type: Text box
- Default value: (empty string)
- Label: "Search"

### Using Variables in Queries

The `$service` multi-value variable with custom all value `.*` enables this pattern:
```logql
{job="docker", service=~"$service"}
```

When "All" is selected, it becomes `service=~".*"` (match all).
When specific services are selected, Grafana auto-joins them: `service=~"php|nginx|redis"`.

---

## 5. Panel Configuration Details

### Stat Panels (Row 1)

```json
{
  "type": "stat",
  "options": {
    "graphMode": "area",
    "textMode": "auto",
    "colorMode": "background",
    "orientation": "auto",
    "reduceOptions": {
      "calcs": ["sum"],
      "fields": "",
      "values": false
    }
  }
}
```

**Error Count thresholds:**
- Base: green (#73BF69)
- 100: yellow (#FADE2A)
- 500: orange (#FF9830)
- 1000: red (#F2495C)

**Error Rate % thresholds:**
- Base: green
- 1%: yellow
- 5%: orange
- 10%: red

### Time Series — Log Volume by Level (Row 2)

```json
{
  "type": "timeseries",
  "fieldConfig": {
    "defaults": {
      "custom": {
        "drawStyle": "bars",
        "barAlignment": 0,
        "fillOpacity": 80,
        "gradientMode": "none",
        "lineWidth": 0,
        "stacking": {
          "mode": "normal",
          "group": "A"
        },
        "showPoints": "never",
        "axisCenteredZero": false
      }
    },
    "overrides": [
      { "matcher": { "id": "byName", "options": "debug" }, "properties": [{ "id": "color", "value": { "fixedColor": "#8AB8FF", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "info" }, "properties": [{ "id": "color", "value": { "fixedColor": "#73BF69", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "warn" }, "properties": [{ "id": "color", "value": { "fixedColor": "#FADE2A", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "warning" }, "properties": [{ "id": "color", "value": { "fixedColor": "#FADE2A", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "error" }, "properties": [{ "id": "color", "value": { "fixedColor": "#F2495C", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "critical" }, "properties": [{ "id": "color", "value": { "fixedColor": "#FF4040", "mode": "fixed" } }] },
      { "matcher": { "id": "byName", "options": "fatal" }, "properties": [{ "id": "color", "value": { "fixedColor": "#C4162A", "mode": "fixed" } }] }
    ]
  },
  "options": {
    "tooltip": { "mode": "all", "sort": "desc" },
    "legend": { "displayMode": "table", "placement": "bottom", "calcs": ["sum", "mean", "max"] }
  }
}
```

**Why bars instead of lines for log volume:** Log volume is a discrete count per time bucket. Bars convey this more accurately than continuous lines. The stacked bar chart is the canonical visualization for log volume (used by Grafana Explore, Elastic Kibana, and Datadog). Fill opacity at 80 keeps bars solid and readable.

### Time Series — Log Volume by Container (Row 2)

Same configuration as above but with `stacking.mode: "normal"` and the default color palette (`mode: "palette-classic"`). No overrides needed since container names are dynamic.

### Time Series — Error Rate Trend (Row 3)

```json
{
  "type": "timeseries",
  "fieldConfig": {
    "defaults": {
      "custom": {
        "drawStyle": "line",
        "lineInterpolation": "smooth",
        "lineWidth": 2,
        "fillOpacity": 20,
        "gradientMode": "opacity",
        "showPoints": "never",
        "stacking": { "mode": "none" }
      },
      "color": { "mode": "fixed", "fixedColor": "#F2495C" },
      "unit": "ops"
    }
  },
  "options": {
    "tooltip": { "mode": "single" },
    "legend": { "displayMode": "list", "placement": "bottom" }
  }
}
```

A red line with opacity gradient fill makes error spikes visually alarming, which is the point.

### Table — Top Error Patterns (Row 3)

```json
{
  "type": "table",
  "options": {
    "showHeader": true,
    "cellHeight": "sm",
    "footer": { "show": true, "reducer": ["sum"], "fields": ["Value"] }
  },
  "fieldConfig": {
    "overrides": [
      {
        "matcher": { "id": "byName", "options": "Value" },
        "properties": [
          { "id": "custom.cellOptions", "value": { "type": "color-background" } },
          { "id": "thresholds", "value": { "steps": [
            { "color": "green", "value": null },
            { "color": "yellow", "value": 50 },
            { "color": "orange", "value": 200 },
            { "color": "red", "value": 500 }
          ]}}
        ]
      }
    ]
  }
}
```

### Pie Chart — Log Level Distribution (Row 4)

```json
{
  "type": "piechart",
  "options": {
    "reduceOptions": { "calcs": ["sum"] },
    "pieType": "donut",
    "legend": {
      "displayMode": "table",
      "placement": "right",
      "values": ["value", "percent"]
    },
    "tooltip": { "mode": "all", "sort": "desc" },
    "displayLabels": ["name", "percent"]
  }
}
```

Use the same color overrides as the log volume panel (debug=blue, info=green, warn=yellow, error=red, critical=dark red).

Donut style is preferred over a solid pie because it carries the same information with less visual weight, leaving room for the center to display the total count.

### Bar Chart — Logs per Container (Row 4)

```json
{
  "type": "barchart",
  "options": {
    "orientation": "horizontal",
    "barWidth": 0.7,
    "barRadius": 0.1,
    "showValue": "auto",
    "groupWidth": 0.75,
    "legend": { "displayMode": "hidden" },
    "tooltip": { "mode": "single" },
    "xTickLabelRotation": 0
  },
  "fieldConfig": {
    "defaults": {
      "color": { "mode": "palette-classic" },
      "custom": { "fillOpacity": 85 }
    }
  }
}
```

Horizontal orientation is critical for container names — they read left-to-right without rotation or truncation.

### Logs Panel (Row 5)

```json
{
  "type": "logs",
  "options": {
    "showTime": true,
    "showLabels": true,
    "showCommonLabels": false,
    "wrapLogMessage": true,
    "prettifyLogMessage": true,
    "enableLogDetails": true,
    "enableInfiniteScrolling": true,
    "showControls": true,
    "sortOrder": "Descending",
    "dedupStrategy": "none",
    "fontSize": ""
  }
}
```

Key settings:
- `prettifyLogMessage: true` — auto-formats JSON logs for readability
- `enableLogDetails: true` — click any line to see extracted fields and labels
- `enableInfiniteScrolling: true` — load more logs by scrolling down
- `showControls: true` — adds jump-to-first/last buttons and log level filters
- `wrapLogMessage: true` — prevents horizontal scrolling

### State Timeline (Row 6)

```json
{
  "type": "state-timeline",
  "options": {
    "showValue": "auto",
    "mergeValues": true,
    "alignValue": "left",
    "rowHeight": 0.8,
    "legend": { "displayMode": "list", "placement": "bottom" }
  },
  "fieldConfig": {
    "defaults": {
      "custom": { "lineWidth": 1, "fillOpacity": 80 },
      "mappings": [
        { "type": "value", "options": { "0": { "text": "Healthy", "color": "green" } } },
        { "type": "range", "options": { "from": 1, "to": 999999, "result": { "text": "Errors", "color": "red" } } }
      ]
    }
  }
}
```

---

## 6. Color Scheme and Visual Design

### Log Level Color Palette (Consistent Across All Panels)

| Level | Color | Hex | Rationale |
|-------|-------|-----|-----------|
| trace | Light purple | `#B877D9` | Subtle, rarely seen |
| debug | Light blue | `#8AB8FF` | Cool tone, low urgency |
| info | Green | `#73BF69` | Universal "all clear" |
| notice | Teal | `#33CCB3` | Slightly elevated from info |
| warn / warning | Yellow | `#FADE2A` | Standard caution color |
| error | Red | `#F2495C` | Grafana's standard red |
| critical | Dark red | `#FF4040` | More intense than error |
| fatal / panic | Deep crimson | `#C4162A` | Maximum severity |

These colors match Grafana's built-in log level colors, which ensures consistency with the Explore view and other dashboards.

### Dashboard-Level Settings

- **Theme**: Dark (matches Parthenon's clinical theme)
- **Time picker**: Default range `now-1h` to `now`, with common ranges: 15m, 30m, 1h, 3h, 6h, 12h, 24h, 7d
- **Refresh interval**: 10s (default), with options: 5s, 10s, 30s, 1m, 5m
- **Tags**: `logs`, `loki`, `docker`, `parthenon`

### Visual Hierarchy Principles

1. **Stat panels** use `colorMode: "background"` — fills the entire panel with threshold color for instant recognition
2. **Time series** use `drawStyle: "bars"` for volume, `drawStyle: "line"` for rates — distinguishes counts from rates visually
3. **Error-related panels** consistently use red tones — trains the eye to spot problems
4. **The logs panel** gets the most vertical space (height 16) — this is where operators spend the most time

---

## 7. Loki-Specific Features to Leverage

### JSON Parser for Structured Logs

Laravel (PHP container) and FastAPI (Python AI container) both produce structured logs. Use the `json` parser to extract fields:

```logql
{job="docker", service="php"} | json | level="error" | line_format "{{.message}}"
```

This extracts the `level` and `message` fields from JSON log entries, enabling proper filtering and cleaner display.

### Pattern Parser for Semi-Structured Logs

Nginx access logs follow a predictable format:

```logql
{job="docker", service="nginx"}
| pattern "<ip> - <user> [<_>] \"<method> <path> <_>\" <status> <size> \"<referer>\" \"<agent>\""
| status >= 400
```

### Regex Parser for Mixed Formats

For containers with inconsistent log formats:

```logql
{job="docker", service=~"$service"}
| regexp "(?P<timestamp>\\S+)\\s+(?P<level>\\w+)\\s+(?P<message>.*)"
```

### Line Format for Display

Clean up noisy log lines for the log stream panel:

```logql
{job="docker", service=~"$service"}
| json
| line_format "{{.level | upper | alignRight 8}} | {{.message}}"
```

### Label Format for Cleanup

Normalize inconsistent level labels:

```logql
| label_format level="{{ .level | lower }}"
| label_format level="{{ Replace .level \"warning\" \"warn\" -1 }}"
```

### Drop Noisy Labels

Remove labels that clutter the UI:

```logql
| drop __error__, __error_details__, stream
```

### Unwrap for Numeric Extraction

If logs contain response times or other numeric values:

```logql
avg_over_time(
  {job="docker", service="nginx"}
  | pattern "<_> <_> <_> [<_>] \"<_>\" <status> <size> \"<_>\" \"<_>\" <response_time>"
  | unwrap response_time
  [$__auto]
) by (service)
```

---

## 8. Derived Fields Configuration

Configure these in the Loki data source settings (Settings > Data Sources > Loki > Derived Fields).

### Trace ID Linking

If services emit trace IDs (for future Tempo integration):

| Setting | Value |
|---------|-------|
| Name | `TraceID` |
| Type | Regex |
| Regex | `(?:trace_?id|traceId)[=:]["']?([a-f0-9]{16,32})` |
| Internal link | Yes (to Tempo data source) |
| Query | `${__value.raw}` |

### Request ID Linking

For correlating logs across containers:

| Setting | Value |
|---------|-------|
| Name | `RequestID` |
| Type | Regex |
| Regex | `(?:request_?id|X-Request-Id)[=:]["']?([a-f0-9-]{36})` |
| URL | (internal link to same Loki data source) |
| Query | `{job="docker"} \|= "${__value.raw}"` |

### URL Path Extraction

For linking to application routes:

| Setting | Value |
|---------|-------|
| Name | `Path` |
| Type | Regex |
| Regex | `"(?:GET\|POST\|PUT\|DELETE\|PATCH) (/[^\s"]+)` |
| URL | `https://parthenon.acumenus.net${__value.raw}` |

**Performance note**: Keep derived field regex patterns simple. Complex patterns degrade browser performance on high-volume log streams.

---

## 9. Performance Considerations

### Query Optimization

1. **Always use label selectors first**: `{service="php"}` before `|~ "error"`. Label filtering happens at the index level and is orders of magnitude faster than line filtering.

2. **Use `$__auto` interval**: Let Grafana auto-calculate the step interval based on the visible time range. This prevents over-querying for long time ranges.

3. **Prefer `|=` over `|~`**: String contains (`|=`) is faster than regex matching (`|~`). Use regex only when pattern matching is needed.

4. **Chain filters narrow-to-wide**: Put the most selective filter first.
   ```logql
   # Good: specific label first, then line filter
   {service="php"} |= "SQLSTATE"

   # Bad: broad label, expensive regex
   {job="docker"} |~ "(?i)sql.*error.*connection"
   ```

5. **Limit `topk` queries**: `topk(10, ...)` is much cheaper than unbounded aggregations.

6. **Use Instant queries for stat panels and tables**: They query a single point in time rather than a range, reducing load.

### Dashboard Settings

- **Max data points**: Set to 1000 for time series panels (default is fine)
- **Query caching**: Enable if Grafana Enterprise; otherwise rely on Loki's built-in query cache
- **Panel refresh**: Stagger refresh intervals if dashboard is heavy — stat panels at 10s, time series at 30s, logs panel at 10s

### Parthenon-Specific Considerations

With 20+ containers, the `$service` variable with "All" selected will produce wide queries. Consider:
- Default to "All" for volume panels (aggregated, efficient)
- Default to specific high-value services for the log stream panel (raw logs, expensive)
- Group services in the variable: `php|nginx|redis` as "Core", `solr|chromadb|qdrant` as "Search", etc.

---

## 10. Implementation Priority

### Phase 1: Core (Must Have)

1. Template variables (`$datasource`, `$service`, `$search`)
2. Log Volume by Level (stacked bar time series)
3. Error Count stat panel
4. Log Stream panel with JSON prettifying
5. Logs per Container bar chart

### Phase 2: Analysis (High Value)

6. Error Rate % stat panel
7. Error Rate Trend time series
8. Log Level Distribution pie chart
9. Total Log Lines stat panel
10. Log Volume by Container time series

### Phase 3: Advanced (Polish)

11. Top Error Patterns table
12. Container Log Activity state timeline
13. Top Error Service stat panel
14. Log Throughput rate panel
15. Derived fields for request ID correlation

### Phase 4: Integration

16. Derived fields for trace ID linking (when Tempo is added)
17. Data links from error panels to filtered log stream
18. Dashboard links from the main Parthenon dashboard to this log dashboard
19. Annotations for deployment events

---

## Appendix A: Key LogQL Functions Reference

| Function | Purpose | Example |
|----------|---------|---------|
| `count_over_time` | Count log entries in a range | `count_over_time({service="php"}[5m])` |
| `rate` | Entries per second | `rate({service="php"}[5m])` |
| `bytes_rate` | Bytes per second | `bytes_rate({service="php"}[5m])` |
| `bytes_over_time` | Total bytes in range | `bytes_over_time({service="php"}[5m])` |
| `absent_over_time` | Returns 1 if no logs match (alerting) | `absent_over_time({service="php"}[5m])` |
| `sum by ()` | Aggregate by label | `sum by (service) (count_over_time(...))` |
| `topk(n, ...)` | Top N series by value | `topk(5, sum by (service) (...))` |
| `sort_desc` | Sort results descending | `sort_desc(sum by (service) (...))` |

## Appendix B: LogQL Parser Cheat Sheet

| Parser | Use Case | Syntax |
|--------|----------|--------|
| `json` | JSON-structured logs | `\| json` or `\| json field="nested.key"` |
| `logfmt` | key=value format logs | `\| logfmt` |
| `pattern` | Known text structure | `\| pattern "<ip> - <_> <method> <path>"` |
| `regexp` | Arbitrary extraction | `\| regexp "(?P<name>pattern)"` |
| `unpack` | Packed JSON with `_entry` | `\| unpack` |

## Appendix C: Template Function Highlights

| Function | Purpose | Example |
|----------|---------|---------|
| `lower` / `upper` | Case conversion | `{{ .level \| upper }}` |
| `trunc N` | Truncate string | `{{ .message \| trunc 100 }}` |
| `replace` | String substitution | `{{ Replace .msg "\\n" " " -1 }}` |
| `alignRight N` | Fixed-width padding | `{{ .level \| alignRight 8 }}` |
| `div` | Division | `{{ div .duration_ms 1000 }}s` |
| `toDate` | Parse date strings | `{{ toDate "2006-01-02" .date }}` |

## Appendix D: Promtail Label Context

Based on the current Parthenon Promtail configuration (`monitoring/promtail/promtail-config.yml`), the following labels are available for all queries:

| Label | Source | Example Values |
|-------|--------|----------------|
| `job` | Static | `docker` |
| `service` | Docker Compose service name | `php`, `nginx`, `redis`, `solr`, `python-ai` |
| `container_name` | Docker container name | `parthenon-php`, `parthenon-nginx` |
| `stream` | Docker stream type | `stdout`, `stderr` |

The `service` label (from `com.docker.compose.service`) is the primary filter for all dashboard queries. The `stream` label can be used to separate stdout/stderr: `{stream="stderr"}` typically contains errors.
