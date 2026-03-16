#!/usr/bin/env python3
"""Generate Grafana dashboard JSONs for Parthenon.

Run from any directory:
    python3 scripts/generate-grafana-dashboards.py

Writes:
    monitoring/grafana/provisioning/dashboards/parthenon.json
    monitoring/grafana/provisioning/dashboards/parthenon-log-analysis.json

Also removes old/community dashboards if they exist:
    parthenon-overview.json, parthenon-logs.json,
    cadvisor.json, node-exporter.json
"""
import json
import pathlib

OUT = pathlib.Path(__file__).parent.parent / "monitoring" / "grafana" / "provisioning" / "dashboards"

PROM_DS = {"type": "prometheus", "uid": "prometheus-parthenon"}
LOKI_DS = {"type": "loki",       "uid": "loki-parthenon"}

THRESH_HOST = {
    "mode": "absolute",
    "steps": [
        {"color": "green",  "value": None},
        {"color": "yellow", "value": 70},
        {"color": "red",    "value": 85},
    ],
}
THRESH_PCT = {
    "mode": "absolute",
    "steps": [
        {"color": "green",  "value": None},
        {"color": "yellow", "value": 50},
        {"color": "red",    "value": 80},
    ],
}
THRESH_ZERO = {
    "mode": "absolute",
    "steps": [
        {"color": "green", "value": None},
        {"color": "red",   "value": 1},
    ],
}

# Log level color overrides used across both dashboards
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
_pid_counter = 0


def _next_id():
    global _pid_counter
    _pid_counter += 1
    return _pid_counter


def _reset_ids():
    global _pid_counter
    _pid_counter = 0


# ---------------------------------------------------------------------------
# Panel builders — Main Parthenon dashboard (with styling fixes)
# ---------------------------------------------------------------------------

def stat_panel(title, expr, x, y, w=4, h=4, *,
               unit="short", thresholds=None, datasource=None, no_value=None,
               graph_mode="none", value_mappings=None, instant=True,
               calcs=None):
    if datasource is None:
        datasource = PROM_DS
    if thresholds is None:
        thresholds = THRESH_HOST
    if calcs is None:
        calcs = ["lastNotNull"]
    defaults = {
        "color": {"mode": "thresholds"},
        "unit": unit,
        "thresholds": thresholds,
    }
    if no_value is not None:
        defaults["noValue"] = no_value
    if value_mappings:
        defaults["mappings"] = value_mappings
    target = {
        "refId": "A", "datasource": datasource, "expr": expr,
        "legendFormat": "__auto",
    }
    if instant:
        target["instant"] = True
        target["range"] = False
    else:
        target["instant"] = False
        target["range"] = True
    return {
        "id": _next_id(), "type": "stat", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": datasource,
        "targets": [target],
        "options": {
            "reduceOptions": {"calcs": calcs, "fields": "", "values": False},
            "orientation": "auto", "textMode": "auto",
            "colorMode": "background", "graphMode": graph_mode,
            "justifyMode": "auto",
            "wideLayout": True,
        },
        "fieldConfig": {"defaults": defaults, "overrides": []},
    }


def gauge_panel(title, expr, x, y, w=4, h=5, *,
                unit="percent", thresholds=None, min_val=0, max_val=100):
    if thresholds is None:
        thresholds = THRESH_HOST
    return {
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
                "thresholds": thresholds,
            },
            "overrides": [],
        },
    }


def bar_gauge_panel(title, expr, x, y, w=12, h=10, *,
                    unit="percent", thresholds=None,
                    orientation="horizontal", display_mode="lcd"):
    if thresholds is None:
        thresholds = THRESH_PCT
    return {
        "id": _next_id(), "type": "bargauge", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": PROM_DS,
        "targets": [{
            "refId": "A", "datasource": PROM_DS, "expr": expr,
            "instant": True, "range": False, "legendFormat": "{{name}}",
        }],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": orientation, "displayMode": display_mode,
            "showUnfilled": True, "valueMode": "color",
            "namePlacement": "auto", "sizing": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit,
                "thresholds": thresholds,
            },
            "overrides": [],
        },
    }


def time_series_panel(title, targets_spec, x, y, w=12, h=5, *,
                      unit="short", datasource=None, fill_opacity=25,
                      draw_style="line", stack=False,
                      legend_mode="list", legend_placement="bottom",
                      threshold_steps=None, line_interpolation="smooth",
                      line_width=2, gradient_mode="opacity",
                      show_points="never", overrides=None,
                      color_mode="palette-classic", fixed_color=None):
    """targets_spec: list of (expr, legend, refId) tuples."""
    if datasource is None:
        datasource = PROM_DS
    targets = []
    for expr, legend, ref_id in targets_spec:
        targets.append({
            "refId": ref_id, "datasource": datasource,
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
    defaults = {
        "color": color_config,
        "custom": custom,
        "unit": unit,
    }
    if threshold_steps:
        defaults["thresholds"] = {"mode": "absolute", "steps": threshold_steps}
        custom["thresholdsStyle"] = {"mode": "line"}
    field_config = {"defaults": defaults, "overrides": overrides or []}
    return {
        "id": _next_id(), "type": "timeseries", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": datasource,
        "targets": targets,
        "options": {
            "tooltip": {"mode": "multi", "sort": "desc"},
            "legend": {"showLegend": True, "displayMode": legend_mode,
                       "placement": legend_placement},
        },
        "fieldConfig": field_config,
    }


def state_timeline_panel(title, expr, x, y, w=16, h=8, *,
                         value_mappings=None, datasource=None,
                         legend_format="{{name}}"):
    if datasource is None:
        datasource = PROM_DS
    if value_mappings is None:
        value_mappings = [{"type": "value", "options": {
            "1": {"text": "Running", "color": "green", "index": 0},
        }}]
    return {
        "id": _next_id(), "type": "state-timeline", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": datasource,
        "targets": [{
            "refId": "A", "datasource": datasource, "expr": expr,
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
                "mappings": value_mappings,
                "thresholds": {"mode": "absolute", "steps": [
                    {"color": "red", "value": None},
                    {"color": "green", "value": 1},
                ]},
            },
            "overrides": [],
        },
    }


def logs_panel(title, expr, x, y, w=24, h=8, *, max_lines=500):
    return {
        "id": _next_id(), "type": "logs", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS,
            "expr": expr, "legendFormat": "", "maxLines": max_lines,
        }],
        "options": {
            "dedupStrategy": "signature", "enableLogDetails": True,
            "prettifyLogMessage": True, "showCommonLabels": False,
            "showLabels": True, "showTime": True,
            "sortOrder": "Descending", "wrapLogMessage": True,
        },
    }


def row_panel(title, y, *, collapsed=False, repeat=None, panels=None):
    r = {
        "id": _next_id(), "type": "row", "title": title,
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 1},
        "collapsed": collapsed,
        "panels": panels or [],
    }
    if repeat:
        r["repeat"] = repeat
        r["repeatDirection"] = "v"
    return r


# ---------------------------------------------------------------------------
# Log Analysis dashboard panel builders
# ---------------------------------------------------------------------------

def log_stat_panel(title, expr, x, y, w=6, h=4, *,
                   unit="short", thresholds=None, graph_mode="area",
                   calcs=None, text_mode="auto", instant=False):
    if thresholds is None:
        thresholds = {"mode": "absolute", "steps": [{"color": "green", "value": None}]}
    if calcs is None:
        calcs = ["sum"]
    return {
        "id": _next_id(), "type": "stat", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS, "expr": expr,
            "legendFormat": "__auto",
            "instant": instant, "range": not instant,
        }],
        "options": {
            "reduceOptions": {"calcs": calcs, "fields": "", "values": False},
            "orientation": "auto", "textMode": text_mode,
            "colorMode": "background", "graphMode": graph_mode,
            "justifyMode": "auto",
            "wideLayout": True,
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit,
                "thresholds": thresholds,
            },
            "overrides": [],
        },
    }


def log_bar_gauge_panel(title, expr, x, y, w=12, h=8, *,
                        unit="short", thresholds=None, orientation="horizontal",
                        display_mode="lcd"):
    if thresholds is None:
        thresholds = {"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "red", "value": 1},
        ]}
    return {
        "id": _next_id(), "type": "bargauge", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS, "expr": expr,
            "legendFormat": "{{container_name}}",
            "instant": True, "range": False,
        }],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": orientation, "displayMode": display_mode,
            "showUnfilled": True, "valueMode": "color",
            "namePlacement": "auto", "sizing": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit,
                "thresholds": thresholds,
            },
            "overrides": [],
        },
    }


def piechart_panel(title, expr, x, y, w=8, h=7, *, overrides=None):
    return {
        "id": _next_id(), "type": "piechart", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS, "expr": expr,
            "legendFormat": "__auto",
            "instant": False, "range": True,
        }],
        "options": {
            "reduceOptions": {"calcs": ["sum"], "fields": "", "values": False},
            "pieType": "donut",
            "legend": {
                "displayMode": "table",
                "placement": "right",
                "values": ["value", "percent"],
            },
            "tooltip": {"mode": "all", "sort": "desc"},
            "displayLabels": ["name", "percent"],
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "palette-classic"},
            },
            "overrides": overrides or [],
        },
    }


def barchart_panel(title, expr, x, y, w=8, h=7):
    return {
        "id": _next_id(), "type": "barchart", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS, "expr": expr,
            "legendFormat": "__auto",
            "instant": False, "range": True,
        }],
        "options": {
            "orientation": "horizontal",
            "barWidth": 0.7,
            "barRadius": 0.1,
            "showValue": "auto",
            "groupWidth": 0.75,
            "legend": {"displayMode": "hidden"},
            "tooltip": {"mode": "single"},
            "xTickLabelRotation": 0,
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "palette-classic"},
                "custom": {"fillOpacity": 85},
            },
            "overrides": [],
        },
    }


# ---------------------------------------------------------------------------
# Dashboard builder — Main Parthenon (with styling fixes)
# ---------------------------------------------------------------------------

def make_parthenon():
    _reset_ids()
    panels = []
    y = 0

    # ===================================================================
    # Row 0 — Platform Health Summary (always visible, no row header)
    # ===================================================================
    panels.append(stat_panel("Platform Status",
        'count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)',
        x=0, y=y, w=4, h=4, unit="short",
        thresholds={"mode": "absolute", "steps": [
            {"color": "red",    "value": None},
            {"color": "yellow", "value": 15},
            {"color": "green",  "value": 18},
        ]},
        value_mappings=[
            {"type": "range", "options": {"from": 18, "to": 999, "result": {"text": "HEALTHY", "color": "green", "index": 0}}},
            {"type": "range", "options": {"from": 15, "to": 17,  "result": {"text": "DEGRADED", "color": "yellow", "index": 1}}},
            {"type": "range", "options": {"from": 0,  "to": 14,  "result": {"text": "CRITICAL", "color": "red", "index": 2}}},
        ]))
    panels.append(stat_panel("Containers Up",
        'count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)',
        x=4, y=y, w=4, h=4, unit="short",
        thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        graph_mode="area", instant=False))
    panels.append(gauge_panel("Host CPU",
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)',
        x=8, y=y, w=4, h=5))
    panels.append(gauge_panel("Host Memory",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=y, w=4, h=5))
    panels.append(gauge_panel("Host Disk",
        'avg(100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))',
        x=16, y=y, w=4, h=5))
    panels.append(stat_panel("Error Rate",
        'sum(count_over_time({job="docker", container_name=~"parthenon-.*"} |~ "(?i)error" [$__interval]))',
        x=20, y=y, w=4, h=4, unit="short", datasource=LOKI_DS,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green",  "value": None},
            {"color": "yellow", "value": 1},
            {"color": "red",    "value": 10},
        ]},
        graph_mode="area", instant=False, no_value="0"))
    y += 5  # accommodate taller gauge panels

    # ===================================================================
    # Row 1 — Container Status
    # ===================================================================
    panels.append(row_panel("Container Status", y))
    y += 1
    panels.append(state_timeline_panel("Container Health Timeline",
        'clamp_max(container_memory_working_set_bytes{name=~"$container",job="cadvisor"}, 1)',
        x=0, y=y, w=16, h=8))
    panels.append(bar_gauge_panel("OOM Events (24h)",
        'sum by (name)(increase(container_oom_events_total{name=~"$container",job="cadvisor"}[24h]))',
        x=16, y=y, w=8, h=8, unit="short", thresholds=THRESH_ZERO))
    y += 8

    # ===================================================================
    # Row 2 — Host Infrastructure (USE Method)
    # ===================================================================
    panels.append(row_panel("Host Infrastructure", y))
    y += 1

    # Sub-row A: CPU + Memory
    panels.append(gauge_panel("CPU Utilization",
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)',
        x=0, y=y, w=4, h=5))
    panels.append(time_series_panel("CPU Load (Saturation)", [
            ('node_load1', '1m', 'A'),
            ('node_load5', '5m', 'B'),
            ('node_load15', '15m', 'C'),
        ], x=4, y=y, w=8, h=5, unit="short"))
    panels.append(gauge_panel("Memory Utilization",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=y, w=4, h=5))
    panels.append(time_series_panel("Memory Swap", [
            ('node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes', 'Swap Used', 'A'),
        ], x=16, y=y, w=8, h=5, unit="bytes"))
    y += 5

    # Sub-row B: Disk + Network
    panels.append(bar_gauge_panel("Disk Usage",
        '100 * (1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})',
        x=0, y=y, w=6, h=5, unit="percent", thresholds=THRESH_HOST))
    panels.append(time_series_panel("Disk I/O", [
            ('rate(node_disk_read_bytes_total[$interval])', 'Read', 'A'),
            ('rate(node_disk_written_bytes_total[$interval])', 'Write', 'B'),
        ], x=6, y=y, w=6, h=5, unit="Bps"))
    panels.append(time_series_panel("Network Traffic", [
            ('rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[$interval])', 'RX', 'A'),
            ('rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[$interval])', 'TX', 'B'),
        ], x=12, y=y, w=6, h=5, unit="Bps"))
    panels.append(stat_panel("Network Errors",
        'sum(increase(node_network_receive_errs_total[$interval])) + sum(increase(node_network_transmit_errs_total[$interval]))',
        x=18, y=y, w=6, h=5, unit="short", thresholds=THRESH_ZERO, no_value="0"))
    y += 5

    # ===================================================================
    # Row 3 — Container Resource Comparison
    # ===================================================================
    panels.append(row_panel("Container Resource Comparison", y))
    y += 1
    panels.append(bar_gauge_panel("CPU by Container",
        'sum by (name)(rate(container_cpu_usage_seconds_total{name=~"$container",job="cadvisor"}[$interval])) * 100',
        x=0, y=y, w=12, h=10, unit="percent", thresholds=THRESH_PCT))
    panels.append(bar_gauge_panel("Memory by Container",
        'sum by (name)(container_memory_working_set_bytes{name=~"$container",job="cadvisor"})',
        x=12, y=y, w=12, h=10, unit="bytes",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green",  "value": None},
            {"color": "yellow", "value": 500 * 1024 * 1024},   # 500 MB
            {"color": "red",    "value": 2 * 1024 * 1024 * 1024},  # 2 GB
        ]}))
    y += 10
    panels.append(time_series_panel("Network RX by Container", [
            ('sum by (name)(rate(container_network_receive_bytes_total{name=~"$container",job="cadvisor"}[$interval]))', '{{name}}', 'A'),
        ], x=0, y=y, w=12, h=8, unit="Bps"))
    panels.append(time_series_panel("Network TX by Container", [
            ('sum by (name)(rate(container_network_transmit_bytes_total{name=~"$container",job="cadvisor"}[$interval]))', '{{name}}', 'A'),
        ], x=12, y=y, w=12, h=8, unit="Bps"))
    y += 8

    # ===================================================================
    # Row 4 — Per-Container Detail (collapsed, repeating)
    # ===================================================================
    detail_panels = []
    ry = y + 1
    detail_panels.append(stat_panel("Status",
        'clamp_max(container_memory_working_set_bytes{name="$container",job="cadvisor"}, 1)',
        x=0, y=ry, w=3, h=6, unit="short",
        thresholds={"mode": "absolute", "steps": [
            {"color": "red",   "value": None},
            {"color": "green", "value": 1},
        ]},
        no_value="DOWN",
        value_mappings=[
            {"type": "value", "options": {"1": {"text": "UP", "color": "green", "index": 0}}},
        ]))
    detail_panels.append(time_series_panel("CPU", [
            ('sum(rate(container_cpu_usage_seconds_total{name="$container",job="cadvisor"}[$interval])) * 100', 'CPU %', 'A'),
        ], x=3, y=ry, w=7, h=6, unit="percent",
        threshold_steps=[{"color": "green", "value": None}, {"color": "yellow", "value": 50}, {"color": "red", "value": 80}]))
    detail_panels.append(time_series_panel("Memory", [
            ('sum(container_memory_working_set_bytes{name="$container",job="cadvisor"})', 'Used', 'A'),
        ], x=10, y=ry, w=7, h=6, unit="bytes"))
    detail_panels.append(time_series_panel("Network", [
            ('sum(rate(container_network_receive_bytes_total{name="$container",job="cadvisor"}[$interval]))', 'RX', 'A'),
            ('sum(rate(container_network_transmit_bytes_total{name="$container",job="cadvisor"}[$interval]))', 'TX', 'B'),
        ], x=17, y=ry, w=7, h=6, unit="Bps"))
    ry += 6
    detail_panels.append(logs_panel("Logs",
        '{job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$log_level" |= "$search"',
        x=0, y=ry, w=24, h=8, max_lines=200))

    panels.append(row_panel("$container", y, collapsed=True,
                            repeat="container", panels=detail_panels))
    y += 15

    # ===================================================================
    # Row 5 — Centralized Log Explorer (collapsed)
    # ===================================================================
    log_panels = []
    ly = y + 1
    log_panels.append(time_series_panel("Log Volume by Container", [
            ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"}[$__interval]))', '{{container_name}}', 'A'),
        ], x=0, y=ly, w=24, h=6, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none",
        legend_placement="right"))
    ly += 6
    log_panels.append(time_series_panel("Error Volume", [
            ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)error" [$__interval]))', '{{container_name}}', 'A'),
        ], x=0, y=ly, w=24, h=4, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none"))
    ly += 4
    log_panels.append(logs_panel("Log Stream",
        '{job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$log_level" |= "$search"',
        x=0, y=ly, w=24, h=16, max_lines=1000))

    panels.append(row_panel("Log Explorer", y, collapsed=True, panels=log_panels))

    # ===================================================================
    # Assemble dashboard
    # ===================================================================
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
                        {"selected": True,  "text": "all",   "value": ".*"},
                        {"selected": False, "text": "error", "value": "error"},
                        {"selected": False, "text": "warn",  "value": "warn"},
                        {"selected": False, "text": "info",  "value": "info"},
                    ],
                    "query": ".*,error,warn,info",
                    "hide": 0, "multi": False, "includeAll": False,
                    "skipUrlSync": False,
                },
                {
                    "name": "interval",
                    "type": "interval",
                    "label": "Interval",
                    "current": {"selected": True, "text": "5m", "value": "5m"},
                    "options": [
                        {"selected": False, "text": "1m",  "value": "1m"},
                        {"selected": True,  "text": "5m",  "value": "5m"},
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
        "graphTooltip": 2,  # shared tooltip
        "liveNow": False,
        "weekStart": "",
    }


# ---------------------------------------------------------------------------
# Dashboard builder — Log Analysis
# ---------------------------------------------------------------------------

def make_log_analysis():
    _reset_ids()
    panels = []
    y = 0

    # ===================================================================
    # Row 0 — Stats (no row header, always visible)
    # ===================================================================
    panels.append(log_stat_panel("Total Logs",
        'sum(count_over_time({job="docker", container_name=~"$container"} [$__auto]))',
        x=0, y=y, w=6, h=4,
        thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}]}))

    panels.append(log_stat_panel("Error Count",
        'sum(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal|panic|exception)" [$__auto]))',
        x=6, y=y, w=6, h=4,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green",  "value": None},
            {"color": "yellow", "value": 100},
            {"color": "orange", "value": 500},
            {"color": "red",    "value": 1000},
        ]}))

    panels.append(log_stat_panel("Error Rate %",
        'sum(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)error" [$__auto])) / sum(count_over_time({job="docker", container_name=~"$container"} [$__auto])) * 100',
        x=12, y=y, w=6, h=4, unit="percent",
        thresholds={"mode": "absolute", "steps": [
            {"color": "green",  "value": None},
            {"color": "yellow", "value": 1},
            {"color": "orange", "value": 5},
            {"color": "red",    "value": 10},
        ]}))

    panels.append(log_stat_panel("Top Error Source",
        'topk(1, sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto])))',
        x=18, y=y, w=6, h=4, text_mode="name",
        thresholds={"mode": "absolute", "steps": [
            {"color": "red", "value": None},
        ]}))

    y += 4

    # ===================================================================
    # Row 1 — Log Volume (collapsible, open)
    # ===================================================================
    panels.append(row_panel("Log Volume", y))
    y += 1

    panels.append(time_series_panel("Log Volume by Level", [
            ('sum by (detected_level)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))', '{{detected_level}}', 'A'),
        ], x=0, y=y, w=12, h=8, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none",
        show_points="never",
        overrides=LOG_LEVEL_OVERRIDES))

    panels.append(time_series_panel("Log Volume by Container", [
            ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))', '{{container_name}}', 'A'),
        ], x=12, y=y, w=12, h=8, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80,
        line_width=0, line_interpolation="linear", gradient_mode="none",
        show_points="never"))

    y += 8

    # ===================================================================
    # Row 2 — Error Analysis (collapsible, open)
    # ===================================================================
    panels.append(row_panel("Error Analysis", y))
    y += 1

    panels.append(time_series_panel("Error Rate Trend", [
            ('sum(rate({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto]))', 'errors/s', 'A'),
        ], x=0, y=y, w=12, h=8, unit="ops", datasource=LOKI_DS,
        fixed_color="#F2495C", fill_opacity=20))

    panels.append(log_bar_gauge_panel("Top Error Services",
        'topk(10, sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto])))',
        x=12, y=y, w=12, h=8,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green", "value": None},
            {"color": "yellow", "value": 10},
            {"color": "orange", "value": 50},
            {"color": "red", "value": 100},
        ]}))

    y += 8

    # ===================================================================
    # Row 3 — Distribution (collapsible, open)
    # ===================================================================
    panels.append(row_panel("Distribution", y))
    y += 1

    panels.append(piechart_panel("Log Level Distribution",
        'sum by (detected_level)(count_over_time({job="docker", container_name=~"$container"} [$__auto]))',
        x=0, y=y, w=8, h=7,
        overrides=LOG_LEVEL_OVERRIDES))

    panels.append(barchart_panel("Logs per Container",
        'sort_desc(sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} [$__auto])))',
        x=8, y=y, w=8, h=7))

    panels.append(time_series_panel("Log Throughput", [
            ('sum(rate({job="docker", container_name=~"$container"} [$__auto]))', 'lines/s', 'A'),
        ], x=16, y=y, w=8, h=7, unit="short", datasource=LOKI_DS))

    y += 7

    # ===================================================================
    # Row 4 — Log Stream (collapsible, open)
    # ===================================================================
    panels.append(row_panel("Log Stream", y))
    y += 1

    panels.append({
        "id": _next_id(), "type": "logs", "title": "Log Stream",
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 18},
        "datasource": LOKI_DS,
        "targets": [{
            "refId": "A", "datasource": LOKI_DS,
            "expr": '{job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$level" |= "$search"',
            "legendFormat": "", "maxLines": 1000,
        }],
        "options": {
            "prettifyLogMessage": True,
            "enableLogDetails": True,
            "wrapLogMessage": True,
            "sortOrder": "Descending",
            "showTime": True,
            "showLabels": True,
            "showCommonLabels": False,
            "dedupStrategy": "none",
        },
    })

    y += 18

    # ===================================================================
    # Row 5 — Container Activity (collapsible, collapsed)
    # ===================================================================
    activity_panels = []
    ay = y + 1

    activity_panels.append(state_timeline_panel("Container Error Activity",
        'sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)(error|critical|fatal)" [$__auto])) > 0',
        x=0, y=ay, w=24, h=6,
        datasource=LOKI_DS,
        legend_format="{{container_name}}",
        value_mappings=[
            {"type": "special", "options": {"match": "null+nan", "result": {"text": "Clean", "color": "green", "index": 0}}},
            {"type": "value", "options": {"0": {"text": "Clean", "color": "green", "index": 1}}},
            {"type": "range", "options": {"from": 1, "to": 999999, "result": {"text": "Errors", "color": "red", "index": 2}}},
        ]))

    panels.append(row_panel("Container Activity", y, collapsed=True, panels=activity_panels))

    # ===================================================================
    # Assemble dashboard
    # ===================================================================
    return {
        "uid": "parthenon-log-analysis",
        "title": "Parthenon Log Analysis",
        "description": "Dedicated log analysis dashboard for the Parthenon platform.",
        "tags": ["parthenon", "logs", "loki"],
        "timezone": "browser",
        "refresh": "10s",
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
                    "datasource": LOKI_DS,
                    "definition": 'label_values({job="docker"}, container_name)',
                    "query": {
                        "qryType": 1,
                        "query": 'label_values({job="docker"}, container_name)',
                    },
                    "regex": "/parthenon-.*/",
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
                    "name": "search",
                    "type": "textbox",
                    "label": "Search",
                    "current": {"selected": False, "text": "", "value": ""},
                    "options": [{"selected": False, "text": "", "value": ""}],
                    "hide": 0, "skipUrlSync": False,
                },
                {
                    "name": "level",
                    "type": "custom",
                    "label": "Level",
                    "current": {"selected": True, "text": "all", "value": ".*"},
                    "options": [
                        {"selected": True,  "text": "all",   "value": ".*"},
                        {"selected": False, "text": "error", "value": "error"},
                        {"selected": False, "text": "warn",  "value": "warn"},
                        {"selected": False, "text": "info",  "value": "info"},
                        {"selected": False, "text": "debug", "value": "debug"},
                    ],
                    "query": ".*,error,warn,info,debug",
                    "hide": 0, "multi": False, "includeAll": False,
                    "skipUrlSync": False,
                },
            ]
        },
        "annotations": {"list": []},
        "panels": panels,
        "links": [],
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 2,  # shared tooltip
        "liveNow": False,
        "weekStart": "",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)

    # Remove old/community dashboards
    for old in ("parthenon-overview.json", "parthenon-logs.json",
                "cadvisor.json", "node-exporter.json"):
        old_path = OUT / old
        if old_path.exists():
            old_path.unlink()
            print(f"Deleted {old_path}")

    # Generate main Parthenon dashboard (with styling fixes)
    dashboard = make_parthenon()
    path = OUT / "parthenon.json"
    path.write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {path}  ({path.stat().st_size} bytes)")

    # Generate log analysis dashboard
    log_dashboard = make_log_analysis()
    log_path = OUT / "parthenon-log-analysis.json"
    log_path.write_text(json.dumps(log_dashboard, indent=2))
    print(f"Wrote {log_path}  ({log_path.stat().st_size} bytes)")
