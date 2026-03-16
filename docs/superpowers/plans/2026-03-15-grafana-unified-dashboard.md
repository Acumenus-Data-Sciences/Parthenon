# Unified Parthenon Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two primitive Grafana dashboards with one unified, production-grade dashboard using gauges, state timelines, bar gauges, and integrated logs following USE methodology and progressive disclosure.

**Architecture:** Rewrite `scripts/generate-grafana-dashboards.py` to produce a single `parthenon.json` with 6 rows (20 always-visible panels + collapsed per-container detail and log explorer rows). Delete the old `parthenon-overview.json` and `parthenon-logs.json`. The generator uses panel-builder functions (stat, gauge, bar_gauge, time_series, state_timeline, logs, row) that each produce valid Grafana 11 JSON panel dicts.

**Tech Stack:** Python 3 (stdlib only), Grafana 11 JSON (schemaVersion 39), PromQL, LogQL.

---

## Chunk 1: Rewrite Generator Script

### Task 1: Rewrite `scripts/generate-grafana-dashboards.py`

**Files:**
- Rewrite: `scripts/generate-grafana-dashboards.py`

The entire script is replaced. The new version generates a single `parthenon.json` dashboard with 6 rows (Rows 0-5 from the spec).

- [ ] **Step 1: Write the complete new generator script**

Write the following to `scripts/generate-grafana-dashboards.py`:

```python
#!/usr/bin/env python3
"""Generate unified Grafana dashboard JSON for Parthenon.

Run from any directory:
    python3 scripts/generate-grafana-dashboards.py

Writes:
    monitoring/grafana/provisioning/dashboards/parthenon.json

Also removes the old split dashboards if they exist:
    monitoring/grafana/provisioning/dashboards/parthenon-overview.json
    monitoring/grafana/provisioning/dashboards/parthenon-logs.json
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

# ---------------------------------------------------------------------------
# Auto-incrementing panel ID
# ---------------------------------------------------------------------------
_pid_counter = 0


def _next_id():
    global _pid_counter
    _pid_counter += 1
    return _pid_counter


# ---------------------------------------------------------------------------
# Panel builders
# ---------------------------------------------------------------------------

def stat_panel(title, expr, x, y, w=4, h=4, *,
               unit="short", thresholds=None, datasource=None, no_value=None,
               graph_mode="none", value_mappings=None, instant=True):
    if datasource is None:
        datasource = PROM_DS
    if thresholds is None:
        thresholds = THRESH_HOST
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
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": "auto", "textMode": "auto",
            "colorMode": "background", "graphMode": graph_mode,
            "justifyMode": "auto",
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
                    orientation="horizontal", display_mode="gradient"):
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
                      unit="short", datasource=None, fill_opacity=10,
                      draw_style="line", stack=False,
                      legend_mode="list", legend_placement="bottom",
                      threshold_steps=None):
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
        "lineWidth": 1, "fillOpacity": fill_opacity,
        "drawStyle": draw_style, "pointSize": 5,
        "showPoints": "auto", "stacking": {"mode": "normal" if stack else "none"},
        "spanNulls": False,
    }
    defaults = {
        "color": {"mode": "palette-classic"},
        "custom": custom,
        "unit": unit,
    }
    if threshold_steps:
        defaults["thresholds"] = {"mode": "absolute", "steps": threshold_steps}
        custom["thresholdsStyle"] = {"mode": "line"}
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
        "fieldConfig": {"defaults": defaults, "overrides": []},
    }


def state_timeline_panel(title, expr, x, y, w=16, h=8, *, value_mappings=None):
    if value_mappings is None:
        value_mappings = [{"type": "value", "options": {
            "1": {"text": "Running", "color": "green", "index": 0},
        }}]
    return {
        "id": _next_id(), "type": "state-timeline", "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": PROM_DS,
        "targets": [{
            "refId": "A", "datasource": PROM_DS, "expr": expr,
            "legendFormat": "{{name}}", "instant": False, "range": True,
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
            "prettifyLogMessage": False, "showCommonLabels": False,
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
# Dashboard builder
# ---------------------------------------------------------------------------

def make_parthenon():
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
        x=8, y=y, w=4, h=4))
    panels.append(gauge_panel("Host Memory",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=y, w=4, h=4))
    panels.append(gauge_panel("Host Disk",
        'avg(100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))',
        x=16, y=y, w=4, h=4))
    panels.append(stat_panel("Error Rate",
        'sum(count_over_time({job="docker", container_name=~"parthenon-.*"} |~ "(?i)error" [$__interval]))',
        x=20, y=y, w=4, h=4, unit="short", datasource=LOKI_DS,
        thresholds={"mode": "absolute", "steps": [
            {"color": "green",  "value": None},
            {"color": "yellow", "value": 1},
            {"color": "red",    "value": 10},
        ]},
        graph_mode="area", instant=False, no_value="0"))
    y += 4

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
    # Panels inside a collapsed repeating row go in the row's panels array
    # with y positions relative to the row
    detail_panels = []
    ry = y + 1  # relative y for child panels
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
    y += 15  # row header + child panels height

    # ===================================================================
    # Row 5 — Centralized Log Explorer (collapsed)
    # ===================================================================
    log_panels = []
    ly = y + 1
    log_panels.append(time_series_panel("Log Volume by Container", [
            ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"}[$__interval]))', '{{container_name}}', 'A'),
        ], x=0, y=ly, w=24, h=6, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80, legend_placement="right"))
    ly += 6
    log_panels.append(time_series_panel("Error Volume", [
            ('sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} |~ "(?i)error" [$__interval]))', '{{container_name}}', 'A'),
        ], x=0, y=ly, w=24, h=4, unit="short", datasource=LOKI_DS,
        draw_style="bars", stack=True, fill_opacity=80))
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
        "graphTooltip": 1,  # shared crosshair
        "liveNow": False,
        "weekStart": "",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)

    # Remove old split dashboards
    for old in ("parthenon-overview.json", "parthenon-logs.json"):
        old_path = OUT / old
        if old_path.exists():
            old_path.unlink()
            print(f"Deleted {old_path}")

    # Generate unified dashboard
    dashboard = make_parthenon()
    path = OUT / "parthenon.json"
    path.write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {path}  ({path.stat().st_size} bytes)")
```

- [ ] **Step 2: Validate the script runs without errors**

```bash
cd /home/smudoshi/Github/Parthenon
python3 scripts/generate-grafana-dashboards.py
```

Expected:
```
Deleted monitoring/grafana/provisioning/dashboards/parthenon-overview.json
Deleted monitoring/grafana/provisioning/dashboards/parthenon-logs.json
Wrote monitoring/grafana/provisioning/dashboards/parthenon.json  (XXXXX bytes)
```

- [ ] **Step 3: Validate JSON is well-formed and has expected panel count**

```bash
python3 -c "
import json
d = json.load(open('monitoring/grafana/provisioning/dashboards/parthenon.json'))
top_panels = [p for p in d['panels'] if p['type'] != 'row']
row_panels = [p for p in d['panels'] if p['type'] == 'row']
collapsed_children = sum(len(r.get('panels', [])) for r in row_panels)
print(f'Top-level panels: {len(top_panels)}')
print(f'Rows: {len(row_panels)}')
print(f'Collapsed child panels: {collapsed_children}')
print(f'UID: {d[\"uid\"]}')
print(f'Refresh: {d[\"refresh\"]}')
print(f'Variables: {[v[\"name\"] for v in d[\"templating\"][\"list\"]]}')
print('JSON OK')
"
```

Expected: ~20 top-level panels, 5 rows (+ collapsed children), uid=parthenon, refresh=15s, 4 variables.

- [ ] **Step 4: Verify old dashboard files are deleted**

```bash
ls monitoring/grafana/provisioning/dashboards/
```

Expected: `cadvisor.json  dashboards.yml  node-exporter.json  parthenon.json` — no `parthenon-overview.json` or `parthenon-logs.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-grafana-dashboards.py \
        monitoring/grafana/provisioning/dashboards/parthenon.json
git rm monitoring/grafana/provisioning/dashboards/parthenon-overview.json \
       monitoring/grafana/provisioning/dashboards/parthenon-logs.json
git commit -m "feat: replace split dashboards with unified Parthenon dashboard

Progressive disclosure: health summary → container status → host USE →
resource comparison → per-container detail + logs. Gauges, state timelines,
bar gauges, and integrated Loki log panels replace primitive tables."
```

---

## Chunk 2: Deploy and Verify

### Task 2: Deploy and verify the unified dashboard

**Files:** None (operations only)

- [ ] **Step 1: Restart Grafana to pick up the new dashboard**

```bash
docker compose restart grafana
```

Wait 15 seconds, verify healthy:

```bash
docker compose ps grafana
```

Expected: `parthenon-grafana` healthy.

- [ ] **Step 2: Confirm the new dashboard appears and old ones are gone**

```bash
source .env
curl -s "https://parthenon.acumenus.net/grafana/api/search?type=dash-db" \
  -u "admin:${GRAFANA_ADMIN_PASSWORD}" \
  | python3 -c "import sys,json; [print(d['uid'], d['title']) for d in json.load(sys.stdin)]"
```

Expected: `parthenon Parthenon` appears. `parthenon-overview` and `parthenon-logs` do NOT appear.

- [ ] **Step 3: Verify the dashboard loads at the new URL**

```bash
curl -sI "https://parthenon.acumenus.net/grafana/d/parthenon" | head -3
```

Expected: `HTTP/2 200`.

- [ ] **Step 4: Verify Row 0 health panels return data**

```bash
source .env
# Test running containers count
curl -s "https://parthenon.acumenus.net/grafana/api/datasources/proxy/uid/prometheus-parthenon/api/v1/query?query=count(container_memory_working_set_bytes%7Bname%3D~%22parthenon-.*%22%2Cjob%3D%22cadvisor%22%7D%20%3E%200)" \
  -u "admin:${GRAFANA_ADMIN_PASSWORD}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Containers:', d['data']['result'][0]['value'][1])"
```

Expected: `Containers: <15-21>`.

- [ ] **Step 5: Verify state timeline and bar gauge panels have data**

```bash
source .env
# Test clamp_max query for state timeline
curl -s "https://parthenon.acumenus.net/grafana/api/datasources/proxy/uid/prometheus-parthenon/api/v1/query?query=clamp_max(container_memory_working_set_bytes%7Bname%3D~%22parthenon-.*%22%2Cjob%3D%22cadvisor%22%7D%2C%201)" \
  -u "admin:${GRAFANA_ADMIN_PASSWORD}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"data\"][\"result\"])} containers returning 1.0')"
```

Expected: `15-21 containers returning 1.0`.

- [ ] **Step 6: Verify Loki error rate panel works**

```bash
source .env
curl -s "https://parthenon.acumenus.net/grafana/api/datasources/proxy/uid/loki-parthenon/loki/api/v1/query?query=sum(count_over_time(%7Bjob%3D%22docker%22%2C%20container_name%3D~%22parthenon-.*%22%7D%20%7C~%20%22(%3Fi)error%22%20%5B5m%5D))" \
  -u "admin:${GRAFANA_ADMIN_PASSWORD}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Error count:', d.get('data',{}).get('result',[{}])[0].get('value',['','0'])[1] if d.get('data',{}).get('result') else '0')"
```

Expected: `Error count: <number>` (any value, confirms Loki responds).

- [ ] **Step 7: Update the System Health page Grafana link**

The `GrafanaLaunchCard` currently links to `/grafana/`. With the new unified dashboard, the link should go directly to it. No change needed — `/grafana/` loads Grafana's home page which shows the dashboard list. The user can navigate from there.

- [ ] **Step 8: Commit if any tweaks were needed**

If no tweaks: no commit — everything was committed in Task 1.

If any adjustments were made:

```bash
python3 scripts/generate-grafana-dashboards.py
git add scripts/generate-grafana-dashboards.py monitoring/grafana/provisioning/dashboards/parthenon.json
git commit -m "fix: adjust unified dashboard panels after live verification"
```
