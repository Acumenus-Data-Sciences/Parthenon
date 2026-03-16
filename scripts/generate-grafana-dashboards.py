#!/usr/bin/env python3
"""Generate the Parthenon Grafana dashboard JSON.

Run from repo root:
    python3 scripts/generate-grafana-dashboards.py

Writes:
    monitoring/grafana/provisioning/dashboards/parthenon.json

Design spec:
    docs/superpowers/specs/2026-03-16-grafana-dashboard-revamp-design.md
"""
import json
import pathlib

OUT = pathlib.Path(__file__).parent.parent / "monitoring" / "grafana" / "provisioning" / "dashboards"

PROM_DS = {"type": "prometheus", "uid": "prometheus-parthenon"}
LOKI_DS = {"type": "loki", "uid": "loki-parthenon"}

# Tier 1 services — dedicated resource panels + log panels
TIER1 = "parthenon-(php|nginx|ai|postgres)"

# Tier 2 services — shared filterable log panel
TIER2 = "parthenon-(horizon|redis|solr|r|chromadb|study-agent|reverb|node|orthanc|finngen-runner|qdrant)"

# Thresholds
THRESH_PERCENT = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "yellow", "value": 70},
        {"color": "red", "value": 85},
    ],
}

# Backwards-compatible alias — panel builder defaults reference this
THRESH_HOST = THRESH_PERCENT

THRESH_ZERO = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "red", "value": 1},
    ],
}

THRESH_ERRORS = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "yellow", "value": 1},
        {"color": "red", "value": 10},
    ],
}

# Parthenon-branded log level colors
LOG_LEVEL_OVERRIDES = [
    {"matcher": {"id": "byName", "options": "debug"},     "properties": [{"id": "color", "value": {"fixedColor": "#6E9FFF", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "DEBUG"},      "properties": [{"id": "color", "value": {"fixedColor": "#6E9FFF", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "info"},       "properties": [{"id": "color", "value": {"fixedColor": "#2DD4BF", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "INFO"},       "properties": [{"id": "color", "value": {"fixedColor": "#2DD4BF", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "warn"},       "properties": [{"id": "color", "value": {"fixedColor": "#C9A227", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "WARNING"},    "properties": [{"id": "color", "value": {"fixedColor": "#C9A227", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "error"},      "properties": [{"id": "color", "value": {"fixedColor": "#9B1B30", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "ERROR"},      "properties": [{"id": "color", "value": {"fixedColor": "#9B1B30", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "critical"},   "properties": [{"id": "color", "value": {"fixedColor": "#6B0F1A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "CRITICAL"},   "properties": [{"id": "color", "value": {"fixedColor": "#6B0F1A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "fatal"},      "properties": [{"id": "color", "value": {"fixedColor": "#6B0F1A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "FATAL"},      "properties": [{"id": "color", "value": {"fixedColor": "#6B0F1A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "PANIC"},      "properties": [{"id": "color", "value": {"fixedColor": "#6B0F1A", "mode": "fixed"}}]},
]

# HTTP status code color overrides
HTTP_STATUS_OVERRIDES = [
    {"matcher": {"id": "byRegexp", "options": "/^2/"},  "properties": [{"id": "color", "value": {"fixedColor": "#2DD4BF", "mode": "fixed"}}]},
    {"matcher": {"id": "byRegexp", "options": "/^3/"},  "properties": [{"id": "color", "value": {"fixedColor": "#6E9FFF", "mode": "fixed"}}]},
    {"matcher": {"id": "byRegexp", "options": "/^4/"},  "properties": [{"id": "color", "value": {"fixedColor": "#C9A227", "mode": "fixed"}}]},
    {"matcher": {"id": "byRegexp", "options": "/^5/"},  "properties": [{"id": "color", "value": {"fixedColor": "#9B1B30", "mode": "fixed"}}]},
]

# ---------------------------------------------------------------------------
# Auto-incrementing panel ID
# ---------------------------------------------------------------------------
_pid = 0


def _next_id():
    global _pid
    _pid += 1
    return _pid


# ---------------------------------------------------------------------------
# Panel builders
# ---------------------------------------------------------------------------

def stat_panel(title, expr, x, y, w=4, h=4, *,
               unit="short", thresholds=None, datasource=None,
               no_value=None, graph_mode="none", value_mappings=None,
               instant=True, calcs=None, description=None):
    ds = datasource or PROM_DS
    th = thresholds or THRESH_HOST
    cl = calcs or ["lastNotNull"]
    defaults = {"color": {"mode": "thresholds"}, "unit": unit, "thresholds": th}
    if no_value is not None:
        defaults["noValue"] = no_value
    if value_mappings:
        defaults["mappings"] = value_mappings
    target = {"refId": "A", "datasource": ds, "expr": expr, "legendFormat": "__auto",
              "instant": instant, "range": not instant}
    panel = {
        "id": _next_id(), "type": "stat", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": [target],
        "options": {
            "reduceOptions": {"calcs": cl, "fields": "", "values": False},
            "orientation": "auto", "textMode": "auto",
            "colorMode": "background", "graphMode": graph_mode,
            "justifyMode": "auto", "wideLayout": True,
        },
        "fieldConfig": {"defaults": defaults, "overrides": []},
    }
    if description:
        panel["description"] = description
    return panel


def gauge_panel(title, expr, x, y, w=4, h=5, *,
                unit="percent", thresholds=None, min_val=0, max_val=100,
                description=None):
    th = thresholds or THRESH_HOST
    panel = {
        "id": _next_id(), "type": "gauge", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": PROM_DS,
        "targets": [{
            "refId": "A", "datasource": PROM_DS, "expr": expr,
            "instant": True, "range": False, "legendFormat": "__auto",
        }],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "showThresholdLabels": False, "showThresholdMarkers": True,
            "orientation": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit, "min": min_val, "max": max_val,
                "thresholds": th,
            },
            "overrides": [],
        },
    }
    if description:
        panel["description"] = description
    return panel


def bar_gauge_panel(title, expr, x, y, w=12, h=10, *,
                    unit="percent", thresholds=None, datasource=None,
                    orientation="horizontal", legend_format="{{name}}",
                    instant=True, description=None):
    ds = datasource or PROM_DS
    th = thresholds or {"mode": "absolute", "steps": [
        {"color": "green", "value": None},
        {"color": "yellow", "value": 50},
        {"color": "red", "value": 80},
    ]}
    panel = {
        "id": _next_id(), "type": "bargauge", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": [{
            "refId": "A", "datasource": ds, "expr": expr,
            "instant": instant, "range": not instant,
            "legendFormat": legend_format,
        }],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": orientation, "displayMode": "lcd",
            "showUnfilled": True, "valueMode": "color",
            "namePlacement": "auto", "sizing": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit, "thresholds": th,
            },
            "overrides": [],
        },
    }
    if description:
        panel["description"] = description
    return panel


def time_series_panel(title, targets_spec, x, y, w=12, h=5, *,
                      unit="short", datasource=None, fill_opacity=25,
                      draw_style="line", stack=False,
                      legend_mode="list", legend_placement="bottom",
                      threshold_steps=None, line_interpolation="smooth",
                      line_width=2, gradient_mode="opacity",
                      show_points="never", overrides=None,
                      color_mode="palette-classic", fixed_color=None,
                      description=None):
    """targets_spec: list of (expr, legend, refId) tuples."""
    ds = datasource or PROM_DS
    targets = []
    for expr, legend, ref_id in targets_spec:
        targets.append({
            "refId": ref_id, "datasource": ds,
            "expr": expr, "legendFormat": legend,
        })
    custom = {
        "axisBorderShow": False,
        "axisCenteredZero": False,
        "axisColorMode": "text",
        "axisLabel": "",
        "axisPlacement": "auto",
        "barAlignment": 0,
        "drawStyle": draw_style,
        "fillOpacity": fill_opacity,
        "gradientMode": gradient_mode,
        "hideFrom": {"legend": False, "tooltip": False, "viz": False},
        "insertNulls": False,
        "lineInterpolation": line_interpolation,
        "lineStyle": {"fill": "solid"},
        "lineWidth": line_width,
        "pointSize": 5,
        "scaleDistribution": {"type": "linear"},
        "showPoints": show_points,
        "spanNulls": False,
        "stacking": {"group": "A", "mode": "normal" if stack else "none"},
        "thresholdsStyle": {"mode": "off"},
    }
    color_config = {"mode": color_mode}
    if fixed_color:
        color_config = {"mode": "fixed", "fixedColor": fixed_color}
    defaults = {"color": color_config, "custom": custom, "unit": unit}
    if threshold_steps:
        defaults["thresholds"] = {"mode": "absolute", "steps": threshold_steps}
        custom["thresholdsStyle"] = {"mode": "line"}
    field_config = {"defaults": defaults, "overrides": overrides or []}
    panel = {
        "id": _next_id(), "type": "timeseries", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": targets,
        "options": {
            "tooltip": {"mode": "multi", "sort": "desc"},
            "legend": {"showLegend": True, "displayMode": legend_mode,
                       "placement": legend_placement},
        },
        "fieldConfig": field_config,
    }
    if description:
        panel["description"] = description
    return panel


def state_timeline_panel(title, expr, x, y, w=16, h=8, *,
                         value_mappings=None, datasource=None,
                         legend_format="{{name}}", description=None):
    ds = datasource or PROM_DS
    vm = value_mappings or [{"type": "value", "options": {
        "1": {"text": "Running", "color": "green", "index": 0},
    }}]
    panel = {
        "id": _next_id(), "type": "state-timeline", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": [{
            "refId": "A", "datasource": ds, "expr": expr,
            "legendFormat": legend_format, "instant": False, "range": True,
        }],
        "options": {
            "showValue": "auto", "mergeValues": True,
            "alignValue": "left", "rowHeight": 0.8,
            "tooltip": {"mode": "single"},
            "legend": {"showLegend": False},
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "mappings": vm,
                "thresholds": {"mode": "absolute", "steps": [
                    {"color": "red", "value": None},
                    {"color": "green", "value": 1},
                ]},
            },
            "overrides": [],
        },
    }
    if description:
        panel["description"] = description
    return panel


def logs_panel(title, expr, x, y, w=24, h=20, *, max_lines=1000,
               description=None):
    panel = {
        "id": _next_id(), "type": "logs", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS,
            "expr": expr, "legendFormat": "", "maxLines": max_lines,
        }],
        "options": {
            "dedupStrategy": "signature",
            "enableLogDetails": True,
            "prettifyLogMessage": True,
            "showCommonLabels": False,
            "showLabels": True,
            "showTime": True,
            "sortOrder": "Descending",
            "wrapLogMessage": True,
        },
    }
    if description:
        panel["description"] = description
    return panel


def piechart_panel(title, expr, x, y, w=8, h=8, *,
                   datasource=None, pie_type="donut",
                   legend_mode="table", legend_placement="right",
                   legend_values=None, overrides=None,
                   description=None):
    """Build a pie chart panel (Grafana piechart type)."""
    ds = datasource or PROM_DS
    lv = legend_values or ["value", "percent"]
    panel = {
        "id": _next_id(), "type": "piechart", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": [{
            "refId": "A", "datasource": ds,
            "expr": expr, "legendFormat": "__auto",
            "instant": False, "range": True,
        }],
        "options": {
            "pieType": pie_type,
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "tooltip": {"mode": "multi", "sort": "desc"},
            "legend": {
                "showLegend": True,
                "displayMode": legend_mode,
                "placement": legend_placement,
                "values": lv,
            },
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "palette-classic"},
            },
            "overrides": overrides or [],
        },
    }
    if description:
        panel["description"] = description
    return panel


def table_panel(title, targets_spec, x, y, w=24, h=6, *,
                datasource=None, transformations=None, overrides=None,
                description=None):
    """Build a table panel with multiple targets and transformations."""
    ds = datasource or PROM_DS
    targets = []
    for spec in targets_spec:
        t = {
            "refId": spec["refId"],
            "datasource": ds,
            "expr": spec["expr"],
            "legendFormat": spec.get("legendFormat", "__auto"),
            "instant": spec.get("instant", True),
            "range": spec.get("range", False),
            "format": spec.get("format", "table"),
        }
        targets.append(t)
    panel = {
        "id": _next_id(), "type": "table", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": ds,
        "targets": targets,
        "options": {
            "showHeader": True,
            "cellHeight": "sm",
            "footer": {"show": False},
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute", "steps": [
                    {"color": "green", "value": None},
                ]},
            },
            "overrides": overrides or [],
        },
    }
    if transformations:
        panel["transformations"] = transformations
    if description:
        panel["description"] = description
    return panel


def row_panel(title, y, *, collapsed=False, panels=None):
    return {
        "id": _next_id(), "type": "row", "title": title,
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 1},
        "collapsed": collapsed,
        "panels": panels or [],
    }


# ---------------------------------------------------------------------------
# Dashboard builder — log-centric, 7 rows
# ---------------------------------------------------------------------------

def make_dashboard():
    global _pid
    _pid = 0
    panels = []
    y = 0

    # ==================================================================
    # Row 1 — Health Overview (always expanded, no row header)
    # ==================================================================

    panels.append(stat_panel("Platform Status",
        'count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)',
        x=0, y=y, w=4, h=5, unit="short",
        thresholds={"mode": "absolute", "steps": [
            {"color": "red", "value": None},
            {"color": "yellow", "value": 15},
            {"color": "green", "value": 18},
        ]},
        value_mappings=[
            {"type": "range", "options": {"from": 18, "to": 999, "result": {"text": "HEALTHY", "color": "green", "index": 0}}},
            {"type": "range", "options": {"from": 15, "to": 17, "result": {"text": "DEGRADED", "color": "yellow", "index": 1}}},
            {"type": "range", "options": {"from": 0, "to": 14, "result": {"text": "CRITICAL", "color": "red", "index": 2}}},
        ],
        description="Overall platform health based on running container count"))

    panels.append(stat_panel("Last Restart",
        'max(changes(container_start_time_seconds{name=~"parthenon-.*"}[1h]))',
        x=4, y=y, w=4, h=5, unit="short",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 1},
            {"color": "red", "value": 3},
        ]},
        description="Container restarts in the last hour"))

    panels.append(stat_panel("Error Count",
        'sum(count_over_time({container_name=~"parthenon-.*"} |~ "(?i)error|exception|fatal" [$__range]))',
        x=8, y=y, w=4, h=5, unit="short", datasource=LOKI_DS,
        thresholds=THRESH_ERRORS, no_value="0",
        description="Total error log lines across all containers in selected time range"))

    panels.append(stat_panel("Error Rate",
        'sum(rate({container_name=~"parthenon-.*"} |~ "(?i)error|exception|fatal" [5m])) * 60',
        x=12, y=y, w=4, h=5, unit="short", datasource=LOKI_DS,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 0.1},
            {"color": "red", "value": 1},
        ]},
        no_value="0", instant=False,
        description="Errors per minute (5m rolling average)"))

    panels.append(stat_panel("CPU Usage",
        'avg(sum(rate(container_cpu_usage_seconds_total{name=~"parthenon-.*"}[5m])) by (name)) * 100',
        x=16, y=y, w=4, h=5, unit="percent",
        thresholds=THRESH_PERCENT,
        description="Average CPU usage across all Parthenon containers"))

    panels.append(stat_panel("Memory Usage",
        'sum(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}) / sum(machine_memory_bytes{job="node-exporter"}) * 100',
        x=20, y=y, w=4, h=5, unit="percent",
        thresholds=THRESH_PERCENT,
        description="Total container memory as percentage of host memory"))

    y += 5

    # ==================================================================
    # Row 2 — Tier 1 Container Resources (collapsed)
    # ==================================================================
    row2_panels = []
    ry = 0

    row2_panels.append(time_series_panel("CPU by Service", [
        (f'sum(rate(container_cpu_usage_seconds_total{{name=~"{TIER1}"}}[5m])) by (name) * 100', '{{name}}', 'A'),
    ], x=0, y=ry, w=6, h=8, unit="percent", stack=True,
        description="CPU usage per Tier 1 service"))

    row2_panels.append(time_series_panel("Memory by Service", [
        (f'container_memory_working_set_bytes{{name=~"{TIER1}"}}', '{{name}}', 'A'),
    ], x=6, y=ry, w=6, h=8, unit="bytes", stack=True,
        description="Working set memory per Tier 1 service"))

    row2_panels.append(bar_gauge_panel("Memory vs Limit",
        f'container_memory_working_set_bytes{{name=~"{TIER1}"}} / container_spec_memory_limit_bytes{{name=~"{TIER1}"}} * 100',
        x=12, y=ry, w=6, h=8, unit="percent", thresholds=THRESH_PERCENT,
        description="Memory usage as percentage of container limit"))

    row2_panels.append(stat_panel("Restarts (24h)",
        f'changes(container_start_time_seconds{{name=~"{TIER1}"}}[24h])',
        x=18, y=ry, w=6, h=8, unit="short", instant=False,
        thresholds=THRESH_ZERO,
        description="Container restart count in the last 24 hours"))

    ry += 8

    row2_panels.append(time_series_panel("Network RX", [
        (f'sum(rate(container_network_receive_bytes_total{{name=~"{TIER1}"}}[5m])) by (name)', '{{name}}', 'A'),
    ], x=0, y=ry, w=6, h=8, unit="Bps",
        description="Network receive rate per Tier 1 service"))

    row2_panels.append(time_series_panel("Network TX", [
        (f'sum(rate(container_network_transmit_bytes_total{{name=~"{TIER1}"}}[5m])) by (name)', '{{name}}', 'A'),
    ], x=6, y=ry, w=6, h=8, unit="Bps",
        description="Network transmit rate per Tier 1 service"))

    row2_panels.append(time_series_panel("Disk I/O Read", [
        (f'sum(rate(container_fs_reads_bytes_total{{name=~"{TIER1}"}}[5m])) by (name)', '{{name}}', 'A'),
    ], x=12, y=ry, w=6, h=8, unit="Bps",
        description="Disk read rate per Tier 1 service"))

    row2_panels.append(time_series_panel("Disk I/O Write", [
        (f'sum(rate(container_fs_writes_bytes_total{{name=~"{TIER1}"}}[5m])) by (name)', '{{name}}', 'A'),
    ], x=18, y=ry, w=6, h=8, unit="Bps",
        description="Disk write rate per Tier 1 service"))

    panels.append(row_panel("Tier 1 Container Resources", y, collapsed=True, panels=row2_panels))
    y += 1

    # ==================================================================
    # Row 3 — Apache Host Logs (collapsed)
    # ==================================================================
    row3_panels = []
    ry = 0

    APACHE_PATTERN = '<ip> - <_> [<_>] "<method> <path> <_>" <status> <bytes>'

    row3_panels.append(time_series_panel("Request Rate by Status", [
        ('sum by(status) (count_over_time({job="apache", log_type="access"} | pattern `' + APACHE_PATTERN + '` [$__interval]))', '{{status}}', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True, overrides=HTTP_STATUS_OVERRIDES,
        description="HTTP request rate grouped by status code"))

    row3_panels.append(piechart_panel("Status Code Distribution",
        'sum by(status) (count_over_time({job="apache", log_type="access"} | pattern `' + APACHE_PATTERN + '` [$__range]))',
        x=12, y=ry, w=6, h=8, datasource=LOKI_DS,
        overrides=HTTP_STATUS_OVERRIDES,
        description="Proportional breakdown of HTTP status codes"))

    row3_panels.append(bar_gauge_panel("Top 10 Paths",
        'topk(10, sum by(path) (count_over_time({job="apache", log_type="access"} | pattern `' + APACHE_PATTERN + '` [$__range])))',
        x=18, y=ry, w=6, h=8, unit="short", datasource=LOKI_DS,
        legend_format="{{path}}", instant=False,
        description="Most frequently requested URL paths"))

    ry += 8

    error_paths_targets = [{
        "refId": "A",
        "expr": 'topk(10, sum by(path, status) (count_over_time({job="apache", log_type="access"} | pattern `' + APACHE_PATTERN + '` | status >= 400 [$__range])))',
        "legendFormat": "", "instant": True, "range": False, "format": "table",
    }]
    error_paths_overrides = [
        {"matcher": {"id": "byName", "options": "status"}, "properties": [
            {"id": "custom.cellOptions", "value": {"type": "color-background"}},
            {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                {"color": "#C9A227", "value": None},
                {"color": "#9B1B30", "value": 500},
            ]}},
        ]},
    ]
    row3_panels.append(table_panel("Top Error Paths",
        error_paths_targets, x=0, y=ry, w=12, h=8,
        datasource=LOKI_DS, overrides=error_paths_overrides,
        description="URL paths returning 4xx/5xx status codes"))

    row3_panels.append(logs_panel("Apache Error Log",
        '{job="apache", log_type="error"} |~ "$search"',
        x=12, y=ry, w=12, h=8,
        description="Apache error log stream, filtered by search text"))

    ry += 8

    row3_panels.append(logs_panel("Apache Access Log",
        '{job="apache", log_type="access"} |~ "$search" | pattern `' + APACHE_PATTERN + '` | status =~ "$status_code"',
        x=0, y=ry, w=24, h=10,
        description="Apache access log stream, filtered by search text and status code"))

    panels.append(row_panel("Apache Host Logs", y, collapsed=True, panels=row3_panels))
    y += 1

    # ==================================================================
    # Row 4 — PHP / Laravel Logs (collapsed)
    # ==================================================================
    row4_panels = []
    ry = 0

    LARAVEL_LEVEL_RE = r'\w+\.(?P<level>\w+):'

    row4_panels.append(time_series_panel("Error Rate by Level", [
        ('sum by(level) (count_over_time({container_name="parthenon-php"} | regexp `\\[\\d{4}-\\d{2}-\\d{2}[^\\]]+\\] ' + LARAVEL_LEVEL_RE + '` | level=~"ERROR|CRITICAL|ALERT|EMERGENCY" [$__interval]))', '{{level}}', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True, overrides=LOG_LEVEL_OVERRIDES,
        description="Laravel error log lines by severity level"))

    row4_panels.append(bar_gauge_panel("Top 10 Exceptions",
        'topk(10, sum by(exception_class) (count_over_time({container_name="parthenon-php"} |~ "Exception" | regexp `(?P<exception_class>[A-Z]\\w+Exception)` [$__range])))',
        x=12, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        legend_format="{{exception_class}}", instant=False,
        description="Most frequently thrown exception types"))

    ry += 8

    row4_panels.append(time_series_panel("Log Volume by Level", [
        ('sum by(level) (count_over_time({container_name="parthenon-php"} | regexp `' + LARAVEL_LEVEL_RE + '` [$__interval]))', '{{level}}', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True, overrides=LOG_LEVEL_OVERRIDES,
        description="All PHP log lines grouped by level"))

    recent_errors_targets = [{
        "refId": "A",
        "expr": '{container_name="parthenon-php"} | regexp `\\[(?P<timestamp>[^\\]]+)\\] (?P<env>\\w+)\\.(?P<level>\\w+): (?P<message>.*)` | level=~"ERROR|CRITICAL"',
        "legendFormat": "", "instant": True, "range": False, "format": "table",
    }]
    row4_panels.append(table_panel("Recent Errors",
        recent_errors_targets, x=12, y=ry, w=12, h=8,
        datasource=LOKI_DS,
        description="Latest ERROR and CRITICAL log entries with message"))

    ry += 8

    row4_panels.append(logs_panel("Live Log Stream",
        '{container_name="parthenon-php"} |~ "$search" | regexp `' + LARAVEL_LEVEL_RE + '` | level=~"$log_level"',
        x=0, y=ry, w=24, h=12,
        description="PHP/Laravel log stream filtered by level and search text"))

    panels.append(row_panel("PHP / Laravel Logs", y, collapsed=True, panels=row4_panels))
    y += 1

    # ==================================================================
    # Row 5 — AI Service / FastAPI Logs (collapsed)
    # ==================================================================
    row5_panels = []
    ry = 0

    row5_panels.append(time_series_panel("Request Rate by Status", [
        ('sum by(status) (count_over_time({container_name="parthenon-ai"} | pattern `<_> - "<method> <path> <_>" <status> <_>` [$__interval]))', '{{status}}', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True, overrides=HTTP_STATUS_OVERRIDES,
        description="Uvicorn request rate by HTTP status code"))

    row5_panels.append(time_series_panel("Error Rate", [
        ('sum(count_over_time({container_name="parthenon-ai"} |~ "(?i)error|exception|traceback|fatal" [$__interval]))', 'errors', 'A'),
    ], x=12, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        fixed_color="#9B1B30",
        description="Error log line frequency for the AI service"))

    ry += 8

    ai_error_targets = [{
        "refId": "A",
        "expr": 'topk(10, sum by(message) (count_over_time({container_name="parthenon-ai"} |~ "(?i)error|exception" | regexp `(?P<message>(?:Error|Exception|Traceback)[^\\n]{0,120})` [$__range])))',
        "legendFormat": "", "instant": True, "range": False, "format": "table",
    }]
    row5_panels.append(table_panel("Top Error Patterns",
        ai_error_targets, x=0, y=ry, w=12, h=8,
        datasource=LOKI_DS,
        description="Most frequent error patterns (Ollama, RAG, SapBERT, etc.)"))

    row5_panels.append(time_series_panel("Ollama & RAG Activity", [
        ('sum by(type) (count_over_time({container_name="parthenon-ai"} |~ "ollama|chroma|embeddi|retriev" | regexp `(?P<type>ollama|chroma|embed|retriev)` [$__interval]))', '{{type}}', 'A'),
    ], x=12, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        description="RAG pipeline component activity over time"))

    ry += 8

    row5_panels.append(logs_panel("Live Log Stream",
        '{container_name="parthenon-ai"} |~ "$search" | regexp `(?P<level>INFO|WARNING|ERROR|CRITICAL|DEBUG)` | level=~"$log_level"',
        x=0, y=ry, w=24, h=12,
        description="AI service log stream filtered by level and search text"))

    panels.append(row_panel("AI Service / FastAPI Logs", y, collapsed=True, panels=row5_panels))
    y += 1

    # ==================================================================
    # Row 6 — PostgreSQL Logs (collapsed)
    # ==================================================================
    row6_panels = []
    ry = 0

    row6_panels.append(time_series_panel("Slow Queries (>100ms)", [
        ('count_over_time({job="postgresql"} |= "duration:" | regexp `duration: (?P<duration>\\d+\\.\\d+) ms` | duration > 100 [$__interval])', 'slow queries', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        fixed_color="#C9A227",
        description="Count of queries taking >100ms (requires log_min_duration_statement=100)"))

    slow_query_targets = [{
        "refId": "A",
        "expr": 'topk(10, avg_over_time({job="postgresql"} |= "duration:" | regexp `duration: (?P<duration>\\d+\\.\\d+) ms\\s+statement: (?P<query>.+)` | unwrap duration [$__range]) by (query))',
        "legendFormat": "", "instant": True, "range": False, "format": "table",
    }]
    row6_panels.append(table_panel("Top Slow Queries",
        slow_query_targets, x=12, y=ry, w=12, h=8,
        datasource=LOKI_DS,
        description="Queries ranked by average execution time"))

    ry += 8

    row6_panels.append(time_series_panel("Database Errors", [
        ('sum by(level) (count_over_time({job="postgresql"} | regexp `(?P<level>ERROR|FATAL|PANIC|WARNING):` [$__interval]))', '{{level}}', 'A'),
    ], x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True, overrides=LOG_LEVEL_OVERRIDES,
        description="PostgreSQL error and warning frequency"))

    row6_panels.append(logs_panel("Docker Postgres Log",
        '{container_name="parthenon-postgres"} |~ "$search"',
        x=12, y=ry, w=12, h=8,
        description="Docker PostgreSQL container log stream"))

    ry += 8

    row6_panels.append(logs_panel("Host PG17 Log",
        '{job="postgresql"} |~ "$search"',
        x=0, y=ry, w=24, h=12,
        description="Host PostgreSQL 17 log stream (production database)"))

    panels.append(row_panel("PostgreSQL Logs", y, collapsed=True, panels=row6_panels))
    y += 1

    # ==================================================================
    # Row 7 — Tier 2 Services (collapsed)
    # ==================================================================
    row7_panels = []
    ry = 0

    row7_panels.append(bar_gauge_panel("Error Count by Service",
        f'sum by(container_name) (count_over_time({{container_name=~"{TIER2}"}} |~ "(?i)error|exception|fatal" [$__range]))',
        x=0, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        legend_format="{{container_name}}", instant=False,
        thresholds=THRESH_ERRORS,
        description="Error count per Tier 2 service in selected time range"))

    row7_panels.append(time_series_panel("Log Volume by Service", [
        (f'sum by(container_name) (count_over_time({{container_name=~"{TIER2}"}} [$__interval]))', '{{container_name}}', 'A'),
    ], x=12, y=ry, w=12, h=8, unit="short", datasource=LOKI_DS,
        stack=True,
        description="Log line volume per Tier 2 service"))

    ry += 8

    row7_panels.append(logs_panel("Live Log Stream",
        '{container_name=~"$service"} |~ "$search" |~ "(?i)$log_level"',
        x=0, y=ry, w=24, h=12,
        description="Tier 2 service logs filtered by service selector, level, and search text"))

    panels.append(row_panel("Tier 2 Services", y, collapsed=True, panels=row7_panels))
    y += 1

    # ==================================================================
    # Assemble dashboard
    # ==================================================================
    return {
        "uid": "parthenon",
        "title": "Parthenon",
        "description": "Log-centric observability dashboard for the Parthenon platform.",
        "tags": ["parthenon"],
        "timezone": "browser",
        "refresh": "15s",
        "schemaVersion": 39,
        "version": 1,
        "time": {"from": "now-1h", "to": "now"},
        "timepicker": {},
        "templating": {
            "list": [
                {
                    "name": "container",
                    "type": "query",
                    "label": "Container",
                    "datasource": PROM_DS,
                    "definition": f'label_values(container_memory_working_set_bytes{{name=~"{TIER1}",job="cadvisor"}}, name)',
                    "query": {
                        "qryType": 1,
                        "query": f'label_values(container_memory_working_set_bytes{{name=~"{TIER1}",job="cadvisor"}}, name)',
                    },
                    "regex": "",
                    "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
                    "includeAll": True,
                    "allValue": TIER1,
                    "multi": True,
                    "options": [],
                    "refresh": 2,
                    "sort": 1,
                    "hide": 0,
                    "skipUrlSync": False,
                },
                {
                    "name": "log_level",
                    "type": "custom",
                    "label": "Log Level",
                    "current": {"selected": True, "text": "all", "value": ".*"},
                    "options": [
                        {"selected": True, "text": "all", "value": ".*"},
                        {"selected": False, "text": "error", "value": "error"},
                        {"selected": False, "text": "warn", "value": "warn"},
                        {"selected": False, "text": "info", "value": "info"},
                        {"selected": False, "text": "debug", "value": "debug"},
                    ],
                    "query": ".*,error,warn,info,debug",
                    "hide": 0, "multi": False, "includeAll": False,
                    "skipUrlSync": False,
                },
                {
                    "name": "service",
                    "type": "custom",
                    "label": "Service",
                    "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
                    "options": [
                        {"selected": True, "text": "All", "value": "$__all"},
                        {"selected": False, "text": "horizon", "value": "parthenon-horizon"},
                        {"selected": False, "text": "redis", "value": "parthenon-redis"},
                        {"selected": False, "text": "solr", "value": "parthenon-solr"},
                        {"selected": False, "text": "r-runtime", "value": "parthenon-r"},
                        {"selected": False, "text": "chromadb", "value": "parthenon-chromadb"},
                        {"selected": False, "text": "study-agent", "value": "parthenon-study-agent"},
                        {"selected": False, "text": "reverb", "value": "parthenon-reverb"},
                        {"selected": False, "text": "node", "value": "parthenon-node"},
                        {"selected": False, "text": "orthanc", "value": "parthenon-orthanc"},
                        {"selected": False, "text": "finngen-runner", "value": "parthenon-finngen-runner"},
                        {"selected": False, "text": "qdrant", "value": "parthenon-qdrant"},
                    ],
                    "query": "parthenon-horizon,parthenon-redis,parthenon-solr,parthenon-r,parthenon-chromadb,parthenon-study-agent,parthenon-reverb,parthenon-node,parthenon-orthanc,parthenon-finngen-runner,parthenon-qdrant",
                    "hide": 0, "multi": True, "includeAll": True,
                    "allValue": TIER2,
                    "skipUrlSync": False,
                },
                {
                    "name": "status_code",
                    "type": "custom",
                    "label": "Status Code",
                    "current": {"selected": True, "text": "All", "value": ".*"},
                    "options": [
                        {"selected": True, "text": "All", "value": ".*"},
                        {"selected": False, "text": "2xx", "value": "2\\d\\d"},
                        {"selected": False, "text": "3xx", "value": "3\\d\\d"},
                        {"selected": False, "text": "4xx", "value": "4\\d\\d"},
                        {"selected": False, "text": "5xx", "value": "5\\d\\d"},
                    ],
                    "query": ".*,2\\d\\d,3\\d\\d,4\\d\\d,5\\d\\d",
                    "hide": 0, "multi": False, "includeAll": False,
                    "skipUrlSync": False,
                },
                {
                    "name": "search",
                    "type": "textbox",
                    "label": "Log Search",
                    "current": {"selected": False, "text": "", "value": ""},
                    "options": [{"selected": False, "text": "", "value": ""}],
                    "hide": 0, "skipUrlSync": False,
                },
                {
                    "name": "interval",
                    "type": "interval",
                    "label": "Interval",
                    "current": {"selected": True, "text": "5m", "value": "5m"},
                    "options": [
                        {"selected": False, "text": "1m", "value": "1m"},
                        {"selected": True, "text": "5m", "value": "5m"},
                        {"selected": False, "text": "15m", "value": "15m"},
                        {"selected": False, "text": "30m", "value": "30m"},
                    ],
                    "hide": 0, "refresh": 2, "skipUrlSync": False,
                },
            ]
        },
        "annotations": {"list": []},
        "panels": panels,
        "links": [],
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 2,
        "liveNow": False,
        "weekStart": "",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)

    # Remove old split dashboards from previous versions
    for old in ("parthenon-log-analysis.json", "parthenon-overview.json",
                "parthenon-logs.json", "cadvisor.json", "node-exporter.json"):
        old_path = OUT / old
        if old_path.exists():
            old_path.unlink()
            print(f"Deleted {old_path}")

    dashboard = make_dashboard()
    path = OUT / "parthenon.json"
    path.write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {path}  ({path.stat().st_size} bytes)")
