# Grafana Dashboards — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Add two custom provisioned dashboards to the Parthenon Grafana stack — a Parthenon Overview and a Logs Explorer — alongside the two existing community dashboards.

---

## 1. Goal

Give Parthenon admins a complete observability suite in Grafana: at-a-glance container health for all Parthenon services, a searchable log stream with error/warning rate tracking, and the existing community host/container drill-down dashboards.

---

## 2. Dashboard Inventory

| Dashboard | Source | Purpose |
|---|---|---|
| `parthenon-overview.json` | New (custom) | All Parthenon containers — CPU, RAM, network, restarts |
| `parthenon-logs.json` | New (custom) | Loki log stream with error/warning rate graphs |
| `node-exporter.json` | Existing (community 1860) | Host system deep-dive — unchanged |
| `cadvisor.json` | Existing (community 14282) | Per-container drill-down — unchanged |

All four JSONs live in `monitoring/grafana/provisioning/dashboards/` and are auto-loaded at Grafana startup via the existing `dashboards.yml` provisioning config. Grafana polls the directory every 30 seconds — new files appear without a restart.

---

## 3. Datasource UIDs

`monitoring/grafana/provisioning/datasources/datasources.yml` pins stable UIDs so dashboard JSONs are portable across installs:

```yaml
datasources:
  - name: Prometheus
    uid: prometheus-parthenon
    ...
  - name: Loki
    uid: loki-parthenon
    ...
```

All dashboard JSON files reference these stable UIDs directly (no `__inputs` indirection needed for provisioned dashboards).

---

## 4. Dashboard 1 — Parthenon Overview

**Dashboard UID:** `parthenon-overview`

### 4.1 Template Variables

| Variable | Type | Query | Purpose |
|---|---|---|---|
| `interval` | Interval | `1m,5m,15m,30m` | Rate window for CPU/network calculations |

### 4.2 Layout

**Row 0 — Host Stats Banner (4 stat panels)**

| Panel | Query | Thresholds |
|---|---|---|
| Running Containers | `count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)` | green |
| Host CPU % | `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[$interval])) * 100)` | green < 70, yellow < 85, red |
| Host RAM % | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` | green < 70, yellow < 85, red |
| Host Disk % | `100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})` | green < 70, yellow < 85, red |

All four panels use datasource `prometheus-parthenon`.

**Note on Running Containers metric:** `container_memory_working_set_bytes` is stable across all cAdvisor versions. `container_last_seen` was removed in cAdvisor > 0.44 and must not be used.

**Rows 1–5 — Service Groups (one collapsible Grafana row per group)**

Each group contains a single **Table panel** with these columns:

| Column | PromQL | Unit |
|---|---|---|
| Container | label `name` (display field after stripping `-1` suffix) | — |
| CPU % | `sum by (name)(rate(container_cpu_usage_seconds_total{name=~"PATTERN",job="cadvisor"}[$interval])) * 100` | percent |
| RAM | `sum by (name)(container_memory_working_set_bytes{name=~"PATTERN",job="cadvisor"})` | bytes (auto) |
| RAM % | `sum by (name)(container_memory_working_set_bytes{name=~"PATTERN",job="cadvisor"}) / sum by (name)(container_spec_memory_limit_bytes{name=~"PATTERN",job="cadvisor"} != 0) * 100` | percent — `!= 0` guard prevents divide-by-zero; no-limit containers show no value |
| Net RX/s | `sum by (name)(rate(container_network_receive_bytes_total{name=~"PATTERN",job="cadvisor"}[$interval]))` | bytes/s |
| Net TX/s | `sum by (name)(rate(container_network_transmit_bytes_total{name=~"PATTERN",job="cadvisor"}[$interval]))` | bytes/s |
| Restarts | `sum by (name)(increase(container_restarts_total{name=~"PATTERN",job="cadvisor"}[24h]))` | short |

**Important:** All network queries use `sum by (name)` to collapse per-interface series into a single value per container.

Each table uses **color thresholds** on CPU% and RAM% columns: green < 50, yellow < 80, red.

### 4.3 Service Groups and Container Patterns

`PATTERN` in each group's table panels:

| Grafana Row | `name` regex |
|---|---|
| Core Infrastructure | `parthenon-(php\|nginx\|postgres\|redis\|node\|horizon\|reverb)-.*` |
| AI & Analytics | `parthenon-(ai\|r)-.*` |
| Search & Databases | `parthenon-(solr\|chromadb)-.*` |
| Integrations | `parthenon-(orthanc\|study-agent\|finngen-runner)-.*` |
| Monitoring Stack | `parthenon-(grafana\|prometheus\|cadvisor\|loki\|promtail)-.*` |

**Container naming:** Docker Compose names containers `<project>-<service>-<replica>` (e.g. `parthenon-php-1`). All patterns use `name=~"parthenon-<service>-.*"` to match any replica count.

### 4.4 Dashboard Settings

```json
{
  "uid": "parthenon-overview",
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "timezone": "browser"
}
```

---

## 5. Dashboard 2 — Logs Explorer

**Dashboard UID:** `parthenon-logs`

### 5.1 Template Variables

| Variable | Type | Details |
|---|---|---|
| `container` | Query (Loki) | Query type: "Label values", Label: `container_name`, Stream selector: `{job="docker"}`. Regex field (in variable definition): `/parthenon-.*/`. Default value: `parthenon-.*` (matches all Parthenon containers). |
| `level` | Custom | Values: `.*` (label: "all"), `error`, `warn`, `info`. Default: all. |

**Note on `container` variable:** `label_values()` is Prometheus syntax and does not work with Loki datasources. Use Grafana's native Loki variable query with type "Label values" and stream selector `{job="docker"}`, then apply the `/parthenon-.*/` regex filter in the variable's Regex field.

### 5.2 Layout

**Row 0 — Stats Bar (3 panels)**

| Panel | Type | Datasource | Query |
|---|---|---|---|
| Log Rate /min | Time series | `loki-parthenon` | `sum(rate({job="docker", container_name=~"parthenon-.*"}[1m]))` |
| Errors (1h) | Stat | `loki-parthenon` | `sum(count_over_time({job="docker", container_name=~"parthenon-.*"} \|~ "(?i)error" [1h]))` |
| Warnings (1h) | Stat | `loki-parthenon` | `sum(count_over_time({job="docker", container_name=~"parthenon-.*"} \|~ "(?i)warn" [1h]))` |

Error stat threshold: red > 0. Warning stat threshold: yellow > 0.

**Row 1 — Log Stream (full width)**

- **Type:** Logs panel (Grafana native)
- **Datasource:** `loki-parthenon`
- **Query:**
  ```logql
  {job="docker", container_name=~"$container"} | json | line_format "{{.log}}" |~ "(?i)$level"
  ```
- **Variable wiring:** `$container` defaults to `parthenon-.*` (the variable's Regex field `/parthenon-.*/` scopes the dropdown to only Parthenon containers; when "all" is selected the raw value is `parthenon-.*`). `$level` values are `.*` (default = match all), `error`, `warn`, `info`. The `|~ "(?i)$level"` regex filter is valid LogQL for all values including `.*`.
- **Options:** newest-first, deduplicate lines, show `container_name` label, show timestamps

### 5.3 Dashboard Settings

```json
{
  "uid": "parthenon-logs",
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "timezone": "browser"
}
```

---

## 6. Promtail Pipeline Update

To enable `container_name` label filtering in Loki queries, the Promtail pipeline must add the `docker: {}` stage. This stage reads `/var/run/docker.sock` (already mounted read-only) to map each container's log path to its Docker Compose service name, adding `container_name` as a Loki label.

**Change to `monitoring/promtail/promtail-config.yml`** — append to the existing `pipeline_stages` list:

```yaml
pipeline_stages:
  - json:
      expressions:
        log: log
        stream: stream
        time: time
  - timestamp:
      source: time
      format: RFC3339Nano
  - labels:
      stream:
  - output:
      source: log
  - docker: {}    # ADD THIS: enriches logs with container_name from Docker socket
```

The `docker: {}` stage is standalone — it derives the container ID from the log file path internally. No preceding regex stage is needed.

---

## 7. Files Changed or Created

| File | Change |
|---|---|
| `monitoring/grafana/provisioning/datasources/datasources.yml` | Add stable `uid` fields to both datasources |
| `monitoring/grafana/provisioning/dashboards/parthenon-overview.json` | New — Parthenon Overview dashboard |
| `monitoring/grafana/provisioning/dashboards/parthenon-logs.json` | New — Logs Explorer dashboard |
| `monitoring/promtail/promtail-config.yml` | Add `- docker: {}` pipeline stage |

No changes to `docker-compose.yml`, Apache, nginx, backend, or frontend.

---

## 8. Deployment

```bash
docker compose restart promtail   # picks up docker: {} stage; begins adding container_name labels
docker compose restart grafana    # picks up stable datasource UIDs + new provisioned dashboards
```

After restart, new dashboards appear in Grafana under the **General** folder within 30 seconds (provisioning poll interval). The `container_name` label is available in Loki for all new log lines ingested after promtail restarts.
