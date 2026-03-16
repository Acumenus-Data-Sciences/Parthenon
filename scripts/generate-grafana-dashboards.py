#!/usr/bin/env python3
"""Generate a single unified Grafana dashboard JSON for Parthenon.

Run from any directory:
    python3 scripts/generate-grafana-dashboards.py

Writes:
    monitoring/grafana/provisioning/dashboards/parthenon.json

Removes old/split dashboards:
    parthenon-log-analysis.json, parthenon-overview.json,
    parthenon-logs.json, cadvisor.json, node-exporter.json
"""
import json
import pathlib

OUT = pathlib.Path(__file__).parent.parent / "monitoring" / "grafana" / "provisioning" / "dashboards"

PROM_DS = {"type": "prometheus", "uid": "prometheus-parthenon"}
LOKI_DS = {"type": "loki", "uid": "loki-parthenon"}

# Thresholds
THRESH_HOST = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "yellow", "value": 70},
        {"color": "red", "value": 85},
    ],
}

# Parthenon gold threshold — replaces green with gold for host gauges
THRESH_HOST_GOLD = {
    "mode": "absolute",
    "steps": [
        {"color": "#C9A227", "value": None},
        {"color": "yellow", "value": 70},
        {"color": "red", "value": 85},
    ],
}

THRESH_ZERO = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "red", "value": 1},
    ],
}

# Log level color overrides
LOG_LEVEL_OVERRIDES = [
    {"matcher": {"id": "byName", "options": "debug"},    "properties": [{"id": "color", "value": {"fixedColor": "#8AB8FF", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "info"},     "properties": [{"id": "color", "value": {"fixedColor": "#73BF69", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "warn"},     "properties": [{"id": "color", "value": {"fixedColor": "#FADE2A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "warning"},  "properties": [{"id": "color", "value": {"fixedColor": "#FADE2A", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "error"},    "properties": [{"id": "color", "value": {"fixedColor": "#F2495C", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "critical"}, "properties": [{"id": "color", "value": {"fixedColor": "#FF4040", "mode": "fixed"}}]},
    {"matcher": {"id": "byName", "options": "fatal"},    "properties": [{"id": "color", "value": {"fixedColor": "#C4162A", "mode": "fixed"}}]},
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
# Dashboard builder — ONE unified dashboard, ALL rows open
# ---------------------------------------------------------------------------

def make_dashboard():
    global _pid
    _pid = 0
    panels = []
    y = 0

    # ==================================================================
    # Row 0 — Platform Health (no row header, always visible)
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

    panels.append(stat_panel("Containers Up",
        'count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)',
        x=4, y=y, w=4, h=5, unit="short",
        thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        graph_mode="area", instant=False,
        description="Number of Parthenon containers currently reporting metrics"))

    panels.append(gauge_panel("Host CPU",
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)',
        x=8, y=y, w=4, h=5, thresholds=THRESH_HOST_GOLD,
        description="Host CPU utilization percentage"))

    panels.append(gauge_panel("Host Memory",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=y, w=4, h=5, thresholds=THRESH_HOST_GOLD,
        description="Host memory utilization percentage"))

    panels.append(gauge_panel("Host Disk",
        'avg(100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))',
        x=16, y=y, w=4, h=5, thresholds=THRESH_HOST_GOLD,
        description="Root filesystem usage percentage"))

    panels.append(stat_panel("Error Rate",
        'sum(count_over_time({job="docker", container_name=~"parthenon-.*"} |~ "(?i)error" [$__interval]))',
        x=20, y=y, w=4, h=5, unit="short", datasource=LOKI_DS,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 1},
            {"color": "red", "value": 10},
        ]},
        graph_mode="area", instant=False, no_value="0",
        description="Log lines matching error patterns across all containers"))

    y += 5  # uniform h=5 for all panels in row 0

    # ==================================================================
    # Row 1 — Container Status (open)
    # ==================================================================
    panels.append(row_panel("Container Status", y))
    y += 1

    panels.append(state_timeline_panel("Container Health Timeline",
        'clamp_max(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}, 1)',
        x=0, y=y, w=16, h=8,
        description="Running state of all Parthenon containers over time"))

    panels.append(bar_gauge_panel("OOM Events (24h)",
        'sum by (name)(increase(container_oom_events_total{name=~"$container",job="cadvisor"}[24h]))',
        x=16, y=y, w=8, h=8, unit="short",
        thresholds=THRESH_ZERO,
        description="Out-of-memory events per container in the last 24 hours"))

    y += 8

    # Container Details table
    container_table_targets = [
        {
            "refId": "A",
            "expr": 'sum by (name)(rate(container_cpu_usage_seconds_total{name=~"$container",job="cadvisor"}[$interval])) * 100',
            "legendFormat": "{{name}}",
            "instant": True, "range": False, "format": "table",
        },
        {
            "refId": "B",
            "expr": 'sum by (name)(container_memory_working_set_bytes{name=~"$container",job="cadvisor"})',
            "legendFormat": "{{name}}",
            "instant": True, "range": False, "format": "table",
        },
        {
            "refId": "C",
            "expr": 'sum by (name)(container_spec_memory_limit_bytes{name=~"$container",job="cadvisor"})',
            "legendFormat": "{{name}}",
            "instant": True, "range": False, "format": "table",
        },
        {
            "refId": "D",
            "expr": 'sum by (name)(rate(container_network_receive_bytes_total{name=~"$container",job="cadvisor"}[$interval]))',
            "legendFormat": "{{name}}",
            "instant": True, "range": False, "format": "table",
        },
        {
            "refId": "E",
            "expr": 'sum by (name)(rate(container_network_transmit_bytes_total{name=~"$container",job="cadvisor"}[$interval]))',
            "legendFormat": "{{name}}",
            "instant": True, "range": False, "format": "table",
        },
    ]
    container_table_transforms = [
        {"id": "merge", "options": {}},
        {
            "id": "organize",
            "options": {
                "excludeByName": {"Time": True, "__name__": True, "job": True},
                "renameByName": {
                    "name": "Container",
                    "Value #A": "CPU %",
                    "Value #B": "Memory",
                    "Value #C": "Memory Limit",
                    "Value #D": "Net RX/s",
                    "Value #E": "Net TX/s",
                },
                "indexByName": {
                    "name": 0,
                    "Value #A": 1,
                    "Value #B": 2,
                    "Value #C": 3,
                    "Value #D": 4,
                    "Value #E": 5,
                },
            },
        },
    ]
    container_table_overrides = [
        {
            "matcher": {"id": "byName", "options": "CPU %"},
            "properties": [
                {"id": "unit", "value": "percent"},
                {"id": "custom.cellOptions", "value": {"type": "color-background"}},
                {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                    {"color": "green", "value": None},
                    {"color": "yellow", "value": 50},
                    {"color": "red", "value": 80},
                ]}},
            ],
        },
        {
            "matcher": {"id": "byName", "options": "Memory"},
            "properties": [{"id": "unit", "value": "bytes"}],
        },
        {
            "matcher": {"id": "byName", "options": "Memory Limit"},
            "properties": [{"id": "unit", "value": "bytes"}],
        },
        {
            "matcher": {"id": "byName", "options": "Net RX/s"},
            "properties": [{"id": "unit", "value": "Bps"}],
        },
        {
            "matcher": {"id": "byName", "options": "Net TX/s"},
            "properties": [{"id": "unit", "value": "Bps"}],
        },
    ]

    panels.append(table_panel("Container Details",
        container_table_targets, x=0, y=y, w=24, h=6,
        transformations=container_table_transforms,
        overrides=container_table_overrides,
        description="Resource usage per container — CPU, memory, and network"))

    y += 6

    # ==================================================================
    # Row 2 — Host Infrastructure USE (open)
    # ==================================================================
    panels.append(row_panel("Host Infrastructure", y))
    y += 1

    # Sub-row A: CPU + Memory
    panels.append(gauge_panel("CPU Utilization",
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)',
        x=0, y=y, w=4, h=5,
        description="Host CPU busy percentage (100% - idle)"))

    panels.append(time_series_panel("CPU Load (Saturation)", [
        ('node_load1', '1m', 'A'),
        ('node_load5', '5m', 'B'),
        ('node_load15', '15m', 'C'),
    ], x=4, y=y, w=8, h=5, unit="short",
        description="System load average — values above CPU count indicate saturation"))

    panels.append(gauge_panel("Memory Utilization",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=y, w=4, h=5,
        description="Host memory usage excluding caches and buffers"))

    panels.append(time_series_panel("Memory Swap", [
        ('node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes', 'Swap Used', 'A'),
    ], x=16, y=y, w=8, h=5, unit="bytes",
        description="Swap space in use — any swap usage indicates memory pressure"))

    y += 5

    # Sub-row B: Disk + Network
    panels.append(bar_gauge_panel("Disk Usage",
        '100 * (1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})',
        x=0, y=y, w=6, h=5, unit="percent", thresholds=THRESH_HOST,
        description="Filesystem usage per mount point"))

    panels.append(time_series_panel("Disk I/O", [
        ('rate(node_disk_read_bytes_total[$interval])', 'Read', 'A'),
        ('rate(node_disk_written_bytes_total[$interval])', 'Write', 'B'),
    ], x=6, y=y, w=6, h=5, unit="Bps",
        description="Disk read and write throughput"))

    # COMBINED Network Traffic — RX+TX in one panel (w=8)
    panels.append(time_series_panel("Network Traffic", [
        ('rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[$interval])', 'RX', 'A'),
        ('rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[$interval])', 'TX', 'B'),
    ], x=12, y=y, w=8, h=5, unit="Bps",
        description="Host network receive and transmit throughput"))

    panels.append(stat_panel("Network Errors",
        'sum(increase(node_network_receive_errs_total[$interval])) + sum(increase(node_network_transmit_errs_total[$interval]))',
        x=20, y=y, w=4, h=5, unit="short", thresholds=THRESH_ZERO, no_value="0",
        description="Network interface errors — any value above 0 needs investigation"))

    y += 5

    # ==================================================================
    # Row 3 — Container Resources (open)
    # ==================================================================
    panels.append(row_panel("Container Resources", y))
    y += 1

    # Sub-row A: CPU + Memory bar gauges
    panels.append(bar_gauge_panel("CPU by Container",
        'sum by (name)(rate(container_cpu_usage_seconds_total{name=~"$container",job="cadvisor"}[$interval])) * 100',
        x=0, y=y, w=12, h=10, unit="percent",
        description="Container CPU usage ranked highest to lowest"))

    panels.append(bar_gauge_panel("Memory by Container",
        'sum by (name)(container_memory_working_set_bytes{name=~"$container",job="cadvisor"})',
        x=12, y=y, w=12, h=10, unit="bytes",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 500 * 1024 * 1024},
            {"color": "red", "value": 2 * 1024 * 1024 * 1024},
        ]},
        description="Container memory usage ranked highest to lowest"))

    y += 10

    # Sub-row B: Combined Network RX+TX by Container
    panels.append(time_series_panel("Network by Container", [
        ('sum by (name)(rate(container_network_receive_bytes_total{name=~"$container",job="cadvisor"}[$interval]))', '{{name}} RX', 'A'),
        ('sum by (name)(rate(container_network_transmit_bytes_total{name=~"$container",job="cadvisor"}[$interval]))', '{{name}} TX', 'B'),
    ], x=0, y=y, w=24, h=8, unit="Bps",
        description="Per-container network throughput (RX and TX)"))

    y += 8

    # ==================================================================
    # Row 4 — Log Volume & Errors (open)
    # ==================================================================
    panels.append(row_panel("Log Volume & Errors", y))
    y += 1

    # Sub-row A: Log volume charts (stacked bars)
    panels.append(time_series_panel("Log Volume by Level", [
        ('sum by (detected_level)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))', '{{detected_level}}', 'A'),
    ], x=0, y=y, w=12, h=8, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none",
        show_points="never", overrides=LOG_LEVEL_OVERRIDES,
        description="Log line count over time, stacked by severity level. Requires Loki automatic level detection (detected_level label)."))

    panels.append(time_series_panel("Log Volume by Container", [
        ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))', '{{container_name}}', 'A'),
    ], x=12, y=y, w=12, h=8, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none",
        show_points="never",
        description="Log line count over time, stacked by container"))

    y += 8

    # Sub-row B: Error Rate Trend + Log Level Distribution (pie) + Log Throughput
    panels.append(time_series_panel("Error Rate Trend", [
        ('sum(rate({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto]))', 'errors/s', 'A'),
    ], x=0, y=y, w=8, h=8, unit="ops", datasource=LOKI_DS,
        fixed_color="#F2495C", fill_opacity=20,
        description="Error log lines per second over time"))

    panels.append(piechart_panel("Log Level Distribution",
        'sum by (detected_level)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))',
        x=8, y=y, w=8, h=8, datasource=LOKI_DS,
        pie_type="donut", legend_mode="table", legend_placement="right",
        legend_values=["value", "percent"],
        overrides=LOG_LEVEL_OVERRIDES,
        description="Proportional breakdown of log levels. Requires Loki automatic level detection (detected_level label)."))

    panels.append(time_series_panel("Log Throughput", [
        ('sum(rate({job="docker", container_name=~"$container"} [$__auto]))', 'lines/s', 'A'),
    ], x=16, y=y, w=8, h=8, unit="short", datasource=LOKI_DS,
        fill_opacity=25, gradient_mode="opacity", line_interpolation="smooth",
        description="Total log lines per second across all containers"))

    y += 8

    # Sub-row C: Top Error Services + Top Error Patterns
    panels.append(bar_gauge_panel("Top Error Services",
        'topk(10, sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto])))',
        x=0, y=y, w=12, h=8, unit="short", datasource=LOKI_DS,
        legend_format="{{container_name}}", instant=False,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 10},
            {"color": "orange", "value": 50},
            {"color": "red", "value": 100},
        ]},
        description="Containers producing the most error logs"))

    # Top Error Patterns — table
    error_patterns_targets = [
        {
            "refId": "A",
            "expr": 'topk(10, sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal|exception)" [$__auto])))',
            "legendFormat": "{{container_name}}",
            "instant": True, "range": False, "format": "table",
        },
    ]
    error_patterns_transforms = [
        {
            "id": "organize",
            "options": {
                "excludeByName": {"Time": True, "__name__": True, "job": True},
                "renameByName": {
                    "container_name": "Container",
                    "Value": "Count",
                },
            },
        },
    ]
    error_patterns_overrides = [
        {
            "matcher": {"id": "byName", "options": "Count"},
            "properties": [
                {"id": "custom.cellOptions", "value": {"type": "color-background"}},
                {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                    {"color": "green", "value": None},
                    {"color": "yellow", "value": 10},
                    {"color": "orange", "value": 50},
                    {"color": "red", "value": 100},
                ]}},
            ],
        },
    ]

    panels.append(table_panel("Top Error Patterns",
        error_patterns_targets, x=12, y=y, w=12, h=8,
        datasource=LOKI_DS,
        transformations=error_patterns_transforms,
        overrides=error_patterns_overrides,
        description="Most frequent error-producing containers"))

    y += 8

    # ==================================================================
    # Row 5 — Log Stream (open)
    # ==================================================================
    panels.append(row_panel("Log Stream", y))
    y += 1

    panels.append(logs_panel("Log Stream",
        '{job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$log_level" |= "$search"',
        x=0, y=y, w=24, h=14, max_lines=1000,
        description="Live log stream filtered by container, level, and search text"))

    # ==================================================================
    # Assemble dashboard
    # ==================================================================
    return {
        "uid": "parthenon",
        "title": "Parthenon",
        "description": "Unified observability dashboard for the Parthenon platform.",
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
                    "definition": 'label_values(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}, name)',
                    "query": {
                        "qryType": 1,
                        "query": 'label_values(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}, name)',
                    },
                    "regex": "",
                    "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
                    "includeAll": True,
                    "allValue": "parthenon-.*",
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
                {
                    "name": "search",
                    "type": "textbox",
                    "label": "Log Search",
                    "current": {"selected": False, "text": "", "value": ""},
                    "options": [{"selected": False, "text": "", "value": ""}],
                    "hide": 0, "skipUrlSync": False,
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

    # Remove old/split dashboards
    for old in ("parthenon-log-analysis.json", "parthenon-overview.json",
                "parthenon-logs.json", "cadvisor.json", "node-exporter.json"):
        old_path = OUT / old
        if old_path.exists():
            old_path.unlink()
            print(f"Deleted {old_path}")

    # Generate single unified dashboard
    dashboard = make_dashboard()
    path = OUT / "parthenon.json"
    path.write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {path}  ({path.stat().st_size} bytes)")
