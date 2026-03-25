# Unified Parthenon Grafana Dashboard — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Replace the two primitive dashboards (parthenon-overview.json, parthenon-logs.json) with one unified, production-grade dashboard following Grafana best practices, USE methodology, and progressive disclosure.

---

## 1. Goal

One dashboard that answers "Is Parthenon OK?" in 5 seconds, "What's struggling?" in 15 seconds, and "Why?" in 60 seconds — combining container metrics, host infrastructure, and logs in a single pane of glass.

---

## 2. Replaces

| Old File | Disposition |
|---|---|
| `monitoring/grafana/provisioning/dashboards/parthenon-overview.json` | Deleted |
| `monitoring/grafana/provisioning/dashboards/parthenon-logs.json` | Deleted |

One new file: `monitoring/grafana/provisioning/dashboards/parthenon.json`

The community dashboards (`node-exporter.json`, `cadvisor.json`) remain for deep drill-down.

---

## 3. Dashboard Settings

```json
{
  "uid": "parthenon",
  "title": "Parthenon",
  "refresh": "15s",
  "time": { "from": "now-1h", "to": "now" },
  "timezone": "browser",
  "schemaVersion": 39
}
```

---

## 4. Template Variables

| Name | Type | Datasource | Query / Values | Details |
|---|---|---|---|---|
| `container` | Query | `prometheus-parthenon` | `label_values(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}, name)` | Multi-select, Include All, all value = `parthenon-.*` |
| `log_level` | Custom | — | `.*` (all), `error`, `warn`, `info` | Single select, default: all |
| `interval` | Interval | — | `1m,5m,15m,30m` | Default: 5m |
| `search` | Textbox | — | — | Free-text log search, default empty |

Variable chaining: `$container` filters both Prometheus and Loki panels. `$log_level` and `$search` filter only Loki panels.

**Note on `$container` in repeating rows:** When Row 4 repeats, Grafana iterates over discrete `$container` values (e.g., `parthenon-php`). Panels inside the repeating row use exact match (`name="$container"`) instead of regex (`name=~"$container"`), since each repeated instance receives a single concrete value. Non-repeating panels use regex match (`name=~"$container"`) to handle both single-select and All.

**Note on `$log_level` matching:** The filter `|~ "(?i)$log_level"` performs broad substring matching — e.g., "info" matches "information", "warn" matches "warning". This is intentional: it catches variant log formats (e.g., `WARNING`, `WARN`, `[warn]`) across different container log styles without requiring exact keyword boundaries.

---

## 5. Row 0 — Platform Health Summary (always open, never collapse)

**Purpose:** 5-second glance — "Is Parthenon OK?"

6 panels across 24 columns, h=4.

| Panel | Type | Width | Query | Thresholds/Notes |
|---|---|---|---|---|
| Platform Status | Stat (colored bg) | 4 | `count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)` | Value mappings: >=18 → "HEALTHY"/green, >=15 → "DEGRADED"/yellow, <15 → "CRITICAL"/red. Display the mapped text, not the number. |
| Containers Up | Stat + sparkline | 4 | `count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)` | Sparkline from range query. Green background. |
| Host CPU | Gauge | 4 | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)` | 0-100%, thresholds: green<70, yellow<85, red. |
| Host Memory | Gauge | 4 | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` | 0-100%, thresholds: green<70, yellow<85, red. |
| Host Disk | Gauge | 4 | `avg(100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))` | 0-100%, thresholds: green<70, yellow<85, red. |
| Error Rate | Stat (colored bg) + sparkline | 4 | Loki: `sum(count_over_time({job="docker", container_name=~"parthenon-.*"} \|~ "(?i)error" [$__interval]))` | Sparkline. Thresholds: green=0, yellow>=1, red>=10. Datasource: `loki-parthenon`. |

---

## 6. Row 1 — Container Status (collapsible, open by default)

**Purpose:** Which containers are healthy, which are struggling, any restarts?

| Panel | Type | Width | Height | Query | Notes |
|---|---|---|---|---|---|
| Container Health Timeline | State Timeline | 16 | 8 | `clamp_max(container_memory_working_set_bytes{name=~"$container",job="cadvisor"}, 1)` | One row per container. Value mappings: 1 → "Running"/green. When a container stops, the series goes absent and the State Timeline renders a gap (no data = not running). Shows state transitions over the selected time range. |
| Container OOM Events (24h) | Bar Gauge (horizontal) | 8 | 8 | `sum by (name)(increase(container_oom_events_total{name=~"$container",job="cadvisor"}[24h]))` | Sorted descending. Thresholds: green=0, red>=1. Only shows containers with events when filtered. |

---

## 7. Row 2 — Host Infrastructure / USE Method (collapsible, open by default)

**Purpose:** Is the underlying host healthy? Utilization + Saturation for each resource.

8 panels in 2 sub-rows of 4.

**Sub-row A (y offset +1, h=5):**

| Panel | Type | Width | Query | Notes |
|---|---|---|---|---|
| CPU Utilization | Gauge | 4 | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)` | 0-100%, thresholds 70/85. |
| CPU Load (Saturation) | Time Series | 8 | Three series: `node_load1`, `node_load5`, `node_load15`. Threshold line at CPU count: `count(node_cpu_seconds_total{mode="idle"})` | Load > CPU count = saturated. |
| Memory Utilization | Gauge | 4 | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` | 0-100%, thresholds 70/85. |
| Memory Swap | Time Series | 8 | `node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes` | Unit: bytes. Swap > 0 = saturation signal. |

**Sub-row B (y offset +6, h=5):**

| Panel | Type | Width | Query | Notes |
|---|---|---|---|---|
| Disk Usage | Bar Gauge (horizontal) | 6 | `100 * (1 - node_filesystem_avail_bytes{fstype!~"tmpfs\|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs\|overlay"})` | Per-mountpoint. Thresholds 70/85. |
| Disk I/O | Time Series | 6 | `rate(node_disk_read_bytes_total[$interval])` and `rate(node_disk_written_bytes_total[$interval])` | Unit: Bps. Two series. |
| Network Traffic | Time Series | 6 | `rate(node_network_receive_bytes_total{device!~"lo\|veth.*\|docker.*\|br-.*"}[$interval])` and `rate(node_network_transmit_bytes_total{...}[$interval])` | Unit: Bps. Filter virtual interfaces. |
| Network Errors | Stat (colored bg) | 6 | `sum(increase(node_network_receive_errs_total[$interval])) + sum(increase(node_network_transmit_errs_total[$interval]))` | Thresholds: green=0, red>=1. |

---

## 8. Row 3 — Container Resource Comparison (collapsible, open by default)

**Purpose:** Which containers are consuming the most resources? Sorted bar gauges for instant comparison.

4 panels arranged in 2 sub-rows of 2 (each panel is 12 wide, wrapping to next line). Each sub-row h=10.

| Panel | Type | Width | Query | Notes |
|---|---|---|---|---|
| CPU by Container | Bar Gauge (horizontal, sorted desc) | 12 | `sum by (name)(rate(container_cpu_usage_seconds_total{name=~"$container",job="cadvisor"}[$interval])) * 100` | Unit: percent. Thresholds: green<50, yellow<80, red. Display mode: gradient. |
| Memory by Container | Bar Gauge (horizontal, sorted desc) | 12 | `sum by (name)(container_memory_working_set_bytes{name=~"$container",job="cadvisor"})` | Unit: bytes. Display mode: gradient. Thresholds relative to available host memory. |
| Network RX by Container | Time Series | 12 | `sum by (name)(rate(container_network_receive_bytes_total{name=~"$container",job="cadvisor"}[$interval]))` | Unit: Bps. Legend: `{{name}}`. |
| Network TX by Container | Time Series | 12 | `sum by (name)(rate(container_network_transmit_bytes_total{name=~"$container",job="cadvisor"}[$interval]))` | Unit: Bps. Legend: `{{name}}`. |

---

## 9. Row 4 — Per-Container Detail (collapsible, COLLAPSED by default, REPEATING)

**Purpose:** Deep dive into any specific container — metrics + logs side by side.

**Repeat configuration:** Row repeats for each value of `$container`. Row title: `$container`.

When `$container` = All, one row per container is generated. When a specific container is selected, only that row appears.

5 panels per repeat instance, h varies.

**Top sub-row (h=6):**

| Panel | Type | Width | Query | Notes |
|---|---|---|---|---|
| Status | Stat (colored bg) | 3 | `clamp_max(container_memory_working_set_bytes{name="$container",job="cadvisor"}, 1)` | Value mappings: 1 → "UP"/green. No data → "DOWN"/red (use `noValue: "DOWN"` with red threshold at 0). |
| CPU | Time Series | 7 | `sum(rate(container_cpu_usage_seconds_total{name="$container",job="cadvisor"}[$interval])) * 100` | Unit: percent. Threshold lines at 50/80. |
| Memory | Time Series | 7 | `sum(container_memory_working_set_bytes{name="$container",job="cadvisor"})` | Unit: bytes. |
| Network | Time Series | 7 | Two series: `sum(rate(container_network_receive_bytes_total{name="$container",job="cadvisor"}[$interval]))` and `sum(rate(container_network_transmit_bytes_total{name="$container",job="cadvisor"}[$interval]))` | Unit: Bps. Legend: RX / TX. |

**Bottom sub-row (h=8, full width):**

| Panel | Type | Width | Query | Notes |
|---|---|---|---|---|
| Logs | Logs | 24 | `{job="docker", container_name=~"$container"} \| json \| line_format "{{.log}}" \|~ "(?i)$log_level" \|= "$search"` | Datasource: `loki-parthenon`. Newest first, dedup by signature, show time + container_name label. |

---

## 10. Row 5 — Centralized Log Explorer (collapsible, COLLAPSED by default)

**Purpose:** Search and browse logs across all containers.

3 panels.

| Panel | Type | Width | Height | Query | Notes |
|---|---|---|---|---|---|
| Log Volume by Container | Time Series (bar style) | 24 | 6 | `sum by (container_name)(count_over_time({job="docker", container_name=~"$container"}[$__interval]))` | Datasource: `loki-parthenon`. Stacked bars showing which containers log most. Legend: `{{container_name}}`. |
| Error Volume | Time Series (bar style, red) | 24 | 4 | `sum by (container_name)(count_over_time({job="docker", container_name=~"$container"} \|~ "(?i)error" [$__interval]))` | Datasource: `loki-parthenon`. Red color. |
| Log Stream | Logs | 24 | 16 | `{job="docker", container_name=~"$container"} \| json \| line_format "{{.log}}" \|~ "(?i)$log_level" \|= "$search"` | Datasource: `loki-parthenon`. maxLines: 1000. Newest first, dedup, show time + container_name. |

---

## 11. Performance Budget

| Row | Panels | Default State | Loaded on Open |
|---|---|---|---|
| Row 0: Health Summary | 6 | Open | Yes |
| Row 1: Container Status | 2 | Open | Yes |
| Row 2: Host Infrastructure | 8 | Open | Yes |
| Row 3: Container Comparison | 4 | Open | Yes |
| Row 4: Per-Container (×N) | 5 × N | **Collapsed** | No (deferred) |
| Row 5: Log Explorer | 3 | **Collapsed** | No (deferred) |
| **Visible on load** | **~20** | | Well within 25-30 panel limit |

Refresh interval: 15s (matches Prometheus scrape interval).

---

## 12. Files Changed or Created

| File | Change |
|---|---|
| `scripts/generate-grafana-dashboards.py` | Rewrite — generates single `parthenon.json` |
| `monitoring/grafana/provisioning/dashboards/parthenon.json` | New — unified dashboard |
| `monitoring/grafana/provisioning/dashboards/parthenon-overview.json` | Delete |
| `monitoring/grafana/provisioning/dashboards/parthenon-logs.json` | Delete |

No changes to docker-compose.yml, Apache, nginx, backend, or frontend.

---

## 13. Deployment

```bash
python3 scripts/generate-grafana-dashboards.py    # regenerate
docker compose restart grafana                     # pick up new JSON
```

Old dashboards disappear automatically (files deleted). New dashboard appears at `https://parthenon.acumenus.net/grafana/d/parthenon`.
