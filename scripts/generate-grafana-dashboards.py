#!/usr/bin/env python3
"""Generate Grafana provisioned dashboard JSON files for Parthenon.

Run from project root:
    python3 scripts/generate-grafana-dashboards.py

Writes:
    monitoring/grafana/provisioning/dashboards/parthenon-overview.json
    monitoring/grafana/provisioning/dashboards/parthenon-logs.json
"""
import json
import pathlib

OUT = pathlib.Path("monitoring/grafana/provisioning/dashboards")

PROM_DS = {"type": "prometheus", "uid": "prometheus-parthenon"}
LOKI_DS = {"type": "loki",       "uid": "loki-parthenon"}

# Service groups: (display name, container name regex)
GROUPS = [
    ("Core Infrastructure", "parthenon-(php|nginx|postgres|redis|node|horizon|reverb)-.*"),
    ("AI & Analytics",      "parthenon-(ai|r)-.*"),
    ("Search & Databases",  "parthenon-(solr|chromadb)-.*"),
    ("Integrations",        "parthenon-(orthanc|study-agent|finngen-runner)-.*"),
    ("Monitoring Stack",    "parthenon-(grafana|prometheus|cadvisor|loki|promtail)-.*"),
]

THRESHOLDS_PCT = {
    "mode": "absolute",
    "steps": [
        {"color": "green",  "value": None},
        {"color": "yellow", "value": 50},
        {"color": "red",    "value": 80},
    ],
}

THRESHOLDS_HOST = {
    "mode": "absolute",
    "steps": [
        {"color": "green",  "value": None},
        {"color": "yellow", "value": 70},
        {"color": "red",    "value": 85},
    ],
}


# ---------------------------------------------------------------------------
# Panel builders
# ---------------------------------------------------------------------------

def stat_panel(pid, title, expr, unit="percent", thresholds=None, x=0, y=0, w=6, h=4):
    if thresholds is None:
        thresholds = THRESHOLDS_HOST
    return {
        "id": pid,
        "type": "stat",
        "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "datasource": PROM_DS,
        "targets": [
            {
                "refId": "A",
                "datasource": PROM_DS,
                "expr": expr,
                "instant": True,
                "range": False,
                "legendFormat": "__auto",
            }
        ],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": "auto",
            "textMode": "auto",
            "colorMode": "background",
            "graphMode": "none",
            "justifyMode": "auto",
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


def row_panel(pid, title, y):
    return {
        "id": pid,
        "type": "row",
        "title": title,
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 1},
        "collapsed": False,
        "panels": [],
    }


def table_panel(pid, title, pattern, y):
    def target(ref_id, expr):
        return {
            "refId": ref_id,
            "datasource": PROM_DS,
            "expr": expr,
            "instant": True,
            "range": False,
            "legendFormat": "{{name}}",
        }

    return {
        "id": pid,
        "type": "table",
        "title": title,
        "gridPos": {"x": 0, "y": y, "w": 24, "h": 7},
        "datasource": PROM_DS,
        "targets": [
            target("CPU",
                f'sum by (name)(rate(container_cpu_usage_seconds_total{{name=~"{pattern}",job="cadvisor"}}[$interval])) * 100'),
            target("RAM",
                f'sum by (name)(container_memory_working_set_bytes{{name=~"{pattern}",job="cadvisor"}})'),
            target("RAMPCT",
                f'sum by (name)(container_memory_working_set_bytes{{name=~"{pattern}",job="cadvisor"}})'
                f' / sum by (name)(container_spec_memory_limit_bytes{{name=~"{pattern}",job="cadvisor"}} != 0) * 100'),
            target("NETRX",
                f'sum by (name)(rate(container_network_receive_bytes_total{{name=~"{pattern}",job="cadvisor"}}[$interval]))'),
            target("NETTX",
                f'sum by (name)(rate(container_network_transmit_bytes_total{{name=~"{pattern}",job="cadvisor"}}[$interval]))'),
            target("RESTARTS",
                f'sum by (name)(increase(container_restarts_total{{name=~"{pattern}",job="cadvisor"}}[24h]))'),
        ],
        "transformations": [
            {"id": "merge", "options": {}},
            {
                "id": "organize",
                "options": {
                    "excludeByName": {"Time": True},
                    "renameByName": {
                        "name":             "Container",
                        "Value #CPU":       "CPU %",
                        "Value #RAM":       "RAM",
                        "Value #RAMPCT":    "RAM %",
                        "Value #NETRX":     "Net RX/s",
                        "Value #NETTX":     "Net TX/s",
                        "Value #RESTARTS":  "Restarts",
                    },
                    "indexByName": {
                        "name":            0,
                        "Value #CPU":      1,
                        "Value #RAM":      2,
                        "Value #RAMPCT":   3,
                        "Value #NETRX":    4,
                        "Value #NETTX":    5,
                        "Value #RESTARTS": 6,
                    },
                },
            },
        ],
        "options": {
            "sortBy": [{"displayName": "CPU %", "desc": True}],
            "cellHeight": "sm",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "fixed"},
                "custom": {"align": "auto", "displayMode": "auto"},
            },
            "overrides": [
                {
                    "matcher": {"id": "byName", "options": "CPU %"},
                    "properties": [
                        {"id": "unit", "value": "percent"},
                        {"id": "decimals", "value": 2},
                        {"id": "thresholds", "value": THRESHOLDS_PCT},
                        {"id": "custom.displayMode", "value": "color-background"},
                    ],
                },
                {
                    "matcher": {"id": "byName", "options": "RAM"},
                    "properties": [{"id": "unit", "value": "bytes"}],
                },
                {
                    "matcher": {"id": "byName", "options": "RAM %"},
                    "properties": [
                        {"id": "unit", "value": "percent"},
                        {"id": "decimals", "value": 1},
                        {"id": "thresholds", "value": THRESHOLDS_PCT},
                        {"id": "custom.displayMode", "value": "color-background"},
                    ],
                },
                {
                    "matcher": {"id": "byName", "options": "Net RX/s"},
                    "properties": [{"id": "unit", "value": "Bps"}],
                },
                {
                    "matcher": {"id": "byName", "options": "Net TX/s"},
                    "properties": [{"id": "unit", "value": "Bps"}],
                },
                {
                    "matcher": {"id": "byName", "options": "Restarts"},
                    "properties": [
                        {"id": "unit", "value": "short"},
                        {"id": "thresholds", "value": {
                            "mode": "absolute",
                            "steps": [
                                {"color": "green", "value": None},
                                {"color": "red",   "value": 1},
                            ],
                        }},
                        {"id": "custom.displayMode", "value": "color-background"},
                    ],
                },
            ],
        },
    }


# ---------------------------------------------------------------------------
# Dashboard builders
# ---------------------------------------------------------------------------

def make_overview():
    panels = []
    pid = 1

    # Row 0 — Host stats banner (4 stat panels, y=0, h=4)
    panels.append(stat_panel(pid, "Running Containers",
        'count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)',
        unit="short",
        thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        x=0, y=0))
    pid += 1

    panels.append(stat_panel(pid, "Host CPU %",
        '100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)',
        x=6, y=0))
    pid += 1

    panels.append(stat_panel(pid, "Host RAM %",
        '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
        x=12, y=0))
    pid += 1

    panels.append(stat_panel(pid, "Host Disk %",
        'avg(100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))',
        x=18, y=0))
    pid += 1

    # Rows 1-5 — one collapsible row + table per service group
    # Each block: 1 row header (h=1) + 7 table (h=7) = 8 units tall
    y = 4
    for group_name, pattern in GROUPS:
        panels.append(row_panel(pid, group_name, y))
        pid += 1
        panels.append(table_panel(pid, group_name, pattern, y + 1))
        pid += 1
        y += 8

    return {
        "uid": "parthenon-overview",
        "title": "Parthenon Overview",
        "description": "Resource usage for all Parthenon containers, grouped by function.",
        "tags": ["parthenon"],
        "timezone": "browser",
        "refresh": "30s",
        "schemaVersion": 39,
        "version": 1,
        "time": {"from": "now-1h", "to": "now"},
        "timepicker": {},
        "templating": {
            "list": [
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
                    "hide": 0,
                    "refresh": 2,
                    "skipUrlSync": False,
                }
            ]
        },
        "annotations": {"list": []},
        "panels": panels,
        "links": [],
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "liveNow": False,
        "weekStart": "",
    }


def make_logs():
    panels = []

    # Log rate timeseries (left, 12 wide)
    panels.append({
        "id": 1,
        "type": "timeseries",
        "title": "Log Rate / min",
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 6},
        "datasource": LOKI_DS,
        "targets": [
            {
                "refId": "A",
                "datasource": LOKI_DS,
                "expr": 'sum(rate({job="docker", container_name=~"parthenon-.*"}[1m]))',
                "legendFormat": "logs/s",
            }
        ],
        "options": {
            "tooltip": {"mode": "single", "sort": "none"},
            "legend": {"showLegend": False},
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "palette-classic"},
                "custom": {"lineWidth": 2, "fillOpacity": 10},
                "unit": "short",
            },
            "overrides": [],
        },
    })

    # Errors stat (top right, 6 wide)
    panels.append({
        "id": 2,
        "type": "stat",
        "title": "Errors (1h)",
        "gridPos": {"x": 12, "y": 0, "w": 6, "h": 6},
        "datasource": LOKI_DS,
        "targets": [
            {
                "refId": "A",
                "datasource": LOKI_DS,
                "expr": 'sum(count_over_time({job="docker", container_name=~"parthenon-.*"} |~ "(?i)error" [1h]))',
                "legendFormat": "",
            }
        ],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "colorMode": "background",
            "graphMode": "none",
            "justifyMode": "auto",
            "textMode": "auto",
            "orientation": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": "short",
                "noValue": "0",
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green", "value": None},
                        {"color": "red",   "value": 1},
                    ],
                },
            },
            "overrides": [],
        },
    })

    # Warnings stat (top far-right, 6 wide)
    panels.append({
        "id": 3,
        "type": "stat",
        "title": "Warnings (1h)",
        "gridPos": {"x": 18, "y": 0, "w": 6, "h": 6},
        "datasource": LOKI_DS,
        "targets": [
            {
                "refId": "A",
                "datasource": LOKI_DS,
                "expr": 'sum(count_over_time({job="docker", container_name=~"parthenon-.*"} |~ "(?i)warn" [1h]))',
                "legendFormat": "",
            }
        ],
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "colorMode": "background",
            "graphMode": "none",
            "justifyMode": "auto",
            "textMode": "auto",
            "orientation": "auto",
        },
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": "short",
                "noValue": "0",
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green",  "value": None},
                        {"color": "yellow", "value": 1},
                    ],
                },
            },
            "overrides": [],
        },
    })

    # Log stream panel (full width, below stats)
    panels.append({
        "id": 4,
        "type": "logs",
        "title": "Log Stream",
        "gridPos": {"x": 0, "y": 6, "w": 24, "h": 18},
        "datasource": LOKI_DS,
        "targets": [
            {
                "refId": "A",
                "datasource": LOKI_DS,
                "expr": '{job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$level"',
                "legendFormat": "",
                "maxLines": 500,
            }
        ],
        "options": {
            "dedupStrategy": "signature",
            "enableLogDetails": True,
            "prettifyLogMessage": False,
            "showCommonLabels": False,
            "showLabels": True,
            "showTime": True,
            "sortOrder": "Descending",
            "wrapLogMessage": True,
        },
    })

    return {
        "uid": "parthenon-logs",
        "title": "Parthenon Logs",
        "description": "Log stream and error/warning rates for all Parthenon containers.",
        "tags": ["parthenon", "logs"],
        "timezone": "browser",
        "refresh": "30s",
        "schemaVersion": 39,
        "version": 1,
        "time": {"from": "now-1h", "to": "now"},
        "timepicker": {},
        "templating": {
            "list": [
                {
                    # Loki label-values variable — uses Grafana's native Loki query type
                    # NOT label_values() which is Prometheus-only syntax
                    "name": "container",
                    "type": "query",
                    "label": "Container",
                    "datasource": LOKI_DS,
                    "definition": '{job="docker"}',
                    "query": {
                        "label": "container_name",
                        "stream": '{job="docker"}',
                        "type": 2,          # 2 = Label values in Grafana's Loki variable
                    },
                    "regex": "/parthenon-.*/",   # filter dropdown to parthenon-* only
                    "current": {
                        "selected": False,
                        "text": "parthenon-.*",
                        "value": "parthenon-.*",
                    },
                    "includeAll": False,
                    "multi": False,
                    "options": [],
                    "refresh": 2,           # refresh on time-range change
                    "sort": 1,
                    "hide": 0,
                    "skipUrlSync": False,
                },
                {
                    # Custom variable for log level filtering
                    # $level is used as |~ "(?i)$level" — valid LogQL for all values
                    "name": "level",
                    "type": "custom",
                    "label": "Level",
                    "current": {"selected": True, "text": "all", "value": ".*"},
                    "options": [
                        {"selected": True,  "text": "all",   "value": ".*"},
                        {"selected": False, "text": "error", "value": "error"},
                        {"selected": False, "text": "warn",  "value": "warn"},
                        {"selected": False, "text": "info",  "value": "info"},
                    ],
                    "query": ".*,error,warn,info",
                    "hide": 0,
                    "multi": False,
                    "includeAll": False,
                    "skipUrlSync": False,
                },
            ]
        },
        "annotations": {"list": []},
        "panels": panels,
        "links": [],
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "liveNow": False,
        "weekStart": "",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for fname, data in [
        ("parthenon-overview.json", make_overview()),
        ("parthenon-logs.json",     make_logs()),
    ]:
        path = OUT / fname
        path.write_text(json.dumps(data, indent=2))
        print(f"Wrote {path}  ({path.stat().st_size} bytes)")
