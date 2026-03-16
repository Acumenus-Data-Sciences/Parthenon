# Grafana Dashboard Revamp — Design Specification

**Date:** 2026-03-16
**Status:** Approved
**Supersedes:** 2026-03-15-grafana-dashboards-design.md, 2026-03-15-grafana-unified-dashboard-design.md

## Problem

The current Parthenon Grafana dashboard has 33 panels across 5 rows, many showing no data. It's too focused on host infrastructure metrics (CPU gauges, memory gauges, disk I/O, swap) that aren't useful for day-to-day operations. The dashboard lacks detailed log analysis for the services that matter most, and host-level logs (Apache, PostgreSQL 17) aren't collected at all.

## Goals

1. Replace the existing dashboard with a focused, log-centric monitoring view
2. Get host Apache and PostgreSQL 17 logs into Loki via Grafana Alloy
3. Provide detailed log analytics (parsed fields, error patterns, slow queries) not just raw streams
4. Keep container resource metrics only for Tier 1 services
5. Eliminate all panels that show no data

## Non-Goals

- Alerting rules (deferred to a future iteration)
- OHDSI-specific monitoring (excluded)
- Tier 3 monitoring infrastructure logs (Grafana, Prometheus, Loki, Alloy, cAdvisor, Node Exporter)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Log collector | Grafana Alloy (replaces Promtail) | Promtail EOL March 2, 2026. Alloy has debug UI, unified agent, active maintenance |
| Dashboard structure | Single dashboard, 7 collapsible rows | One URL to bookmark, rows collapse to reduce noise |
| Host log ingestion | Extend Alloy with file scrape jobs | Simplest approach — same container, add volume mounts |
| Container metrics scope | Tier 1 only (PHP, Nginx, AI, Postgres) | User only cares about core services, not monitoring infra |
| Log analytics depth | Full — parsed tables, top-N patterns, slow queries | Makes logs actionable for debugging, not just scrollable |

## Service Tiers

**Tier 1 — Dedicated log panels with parsed fields:**
- `parthenon-php` (Laravel backend)
- `parthenon-nginx` (request routing)
- `parthenon-ai` (Abby/FastAPI)
- `parthenon-postgres` (Docker database)

**Tier 2 — Shared filterable log panel:**
- `parthenon-horizon`, `parthenon-redis`, `parthenon-solr`, `parthenon-r` (R Plumber), `parthenon-chromadb`, `parthenon-study-agent`, `parthenon-reverb`, `parthenon-node` (Vite dev server), `parthenon-orthanc`, `parthenon-finngen-runner`, `parthenon-qdrant`

**Tier 3 — Excluded from dashboard (monitoring infrastructure):**
- `parthenon-grafana`, `parthenon-prometheus`, `parthenon-loki`, `parthenon-alloy` (replaces promtail), `parthenon-cadvisor`, `parthenon-node-exporter`

**Excluded — not running or ephemeral:**
- `parthenon-whiterabbit`, `parthenon-hecate`, `parthenon-fhir-to-cdm` (run on-demand, not persistent services)

## Infrastructure Changes

### 1. Replace Promtail with Grafana Alloy

Remove `parthenon-promtail` service from docker-compose.yml. Add `parthenon-alloy` service:

- **Image:** `grafana/alloy:v1.8.0` (pinned, not latest)
- **Volumes:**
  - `./monitoring/alloy/config.alloy:/etc/alloy/config.alloy:ro`
  - `/var/lib/docker/containers:/var/lib/docker/containers:ro`
  - `/var/run/docker.sock:/var/run/docker.sock:ro`
  - `/var/log/apache2:/var/log/apache2:ro`
  - `/var/log/postgresql:/var/log/postgresql:ro`
- **Ports:** `12345:12345` (debug UI)
- **Health check:** HTTP GET `http://localhost:12345/ready`
- **Network:** parthenon bridge
- **Depends on:** loki

### 2. Alloy Configuration

Three scrape sources in component-based config:

**A. Docker container logs** (migrated from Promtail):
- `discovery.docker` for container discovery + `loki.source.docker` for log collection
- Filter: `com.docker.compose.project=parthenon`
- Pipeline: JSON extraction → timestamp parsing → stream label → output log field
- Labels: `service`, `container_name`, `stream`

**B. Apache host logs:**
- `loki.source.file` for `/var/log/apache2/parthenon-access.log` and `/var/log/apache2/parthenon-error.log`
- Access log pipeline: `pattern` parser for Apache combined format → extracts `method`, `status`, `path`, `bytes_sent`
- Error log pipeline: regex parser → extracts `level`, `module`
- Labels: `job=apache`, `log_type=access|error`

**C. PostgreSQL 17 host logs:**
- `loki.source.file` for `/var/log/postgresql/postgresql-17-main.log`
- Pipeline: multiline stage (firstline: `^\d{4}-\d{2}-\d{2}`), regex parser → extracts `level`, `database`, `user`
- Labels: `job=postgresql`

### 3. PostgreSQL 17 Configuration

Set in `/etc/postgresql/17/main/postgresql.conf`:
- `log_min_duration_statement = 100` — log queries taking >100ms
- `log_line_prefix = '%t [%p] %u@%d '` — ensures timestamp, PID, user, and database appear in log lines (required for Alloy regex parsing)

Requires `pg_ctl reload` or `SELECT pg_reload_conf()`. No restart needed.

### 4. Docker Compose Cleanup

- Remove `parthenon-promtail` service
- Remove `monitoring/promtail/` directory
- Add `parthenon-alloy` service
- Create `monitoring/alloy/config.alloy`
- Update any Grafana/Loki dependencies that referenced Promtail

## Dashboard Specification

### Template Variables

| Variable | Type | Values | Default |
|----------|------|--------|---------|
| `container` | Query (Prometheus) | `label_values(container_memory_working_set_bytes{name=~"parthenon-(php\|nginx\|ai\|postgres)"}, name)` | All |
| `log_level` | Custom | `.*` (all), `error`, `warn`, `info`, `debug` | all |
| `service` | Custom | Tier 2 container names, multi-select | All |
| `search` | Textbox | Free text | (empty) |
| `status_code` | Custom | `.*` (All), `2\\d\\d`, `3\\d\\d`, `4\\d\\d`, `5\\d\\d` | All |
| `interval` | Interval | 1m, 5m, 15m, 30m | 5m |

### Row 1: Health Overview (Expanded by Default)

6 stat panels. Background color mode. No sparklines.

| # | Panel | Type | Source | Query | Thresholds |
|---|-------|------|--------|-------|------------|
| 1 | Platform Status | Stat | Prometheus | `count(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"} > 0)` with value mappings: ≥18="HEALTHY", 15-17="DEGRADED", <15="CRITICAL" | ≥18 green, ≥15 yellow, <15 red |
| 2 | Last Restart | Stat | Prometheus | `max(changes(container_start_time_seconds{name=~"parthenon-.*"}[1h]))` — shows how many container restarts in the last hour | 0 green, ≥1 yellow, ≥3 red |
| 3 | Error Count | Stat | Loki | `sum(count_over_time({container_name=~"parthenon-.*"} \|~ "(?i)error\|exception\|fatal" [$__range]))` | 0 green, ≥1 yellow, ≥10 red |
| 4 | Error Rate | Stat | Loki | `sum(rate({container_name=~"parthenon-.*"} \|~ "(?i)error\|exception\|fatal" [5m])) * 60` (errors per minute) | <0.1/min green, <1/min yellow, ≥1/min red |
| 5 | CPU Usage | Stat | Prometheus | `avg(sum(rate(container_cpu_usage_seconds_total{name=~"parthenon-.*"}[5m])) by (name)) * 100` | <70% green, <85% yellow, ≥85% red |
| 6 | Memory Usage | Stat | Prometheus | `sum(container_memory_working_set_bytes{name=~"parthenon-.*",job="cadvisor"}) / sum(machine_memory_bytes{job="node-exporter"}) * 100` (percentage of host memory) | <70% green, <85% yellow, ≥85% red |

### Row 2: Tier 1 Container Resources (Collapsed)

8 panels for PHP, Nginx, AI, Docker Postgres.

**Sub-row A — CPU & Memory:**

| # | Panel | Type | Query |
|---|-------|------|-------|
| 7 | CPU by Service | Time Series (stacked) | `sum(rate(container_cpu_usage_seconds_total{name=~"parthenon-(php\|nginx\|ai\|postgres)"}[5m])) by (name) * 100` |
| 8 | Memory by Service | Time Series (stacked) | `container_memory_working_set_bytes{name=~"parthenon-(php\|nginx\|ai\|postgres)"}` (unit: bytes IEC) |
| 9 | Memory vs Limit | Bar Gauge | `container_memory_working_set_bytes / container_spec_memory_limit_bytes * 100` |
| 10 | Container Restarts (24h) | Stat (repeat) | `changes(container_start_time_seconds{name=~"parthenon-(php\|nginx\|ai\|postgres)"}[24h])` |

**Sub-row B — Network & Filesystem:**

| # | Panel | Type | Query |
|---|-------|------|-------|
| 11 | Network RX | Time Series | `sum(rate(container_network_receive_bytes_total{name=~"parthenon-(php\|nginx\|ai\|postgres)"}[5m])) by (name)` |
| 12 | Network TX | Time Series | `sum(rate(container_network_transmit_bytes_total{...}[5m])) by (name)` |
| 13 | Disk I/O Read | Time Series | `sum(rate(container_fs_reads_bytes_total{...}[5m])) by (name)` |
| 14 | Disk I/O Write | Time Series | `sum(rate(container_fs_writes_bytes_total{...}[5m])) by (name)` |

All panels filtered by `$container` variable.

### Row 3: Apache Host Logs (Collapsed)

6 panels from Alloy file scraping.

| # | Panel | Type | Query |
|---|-------|------|-------|
| 15 | Request Rate by Status | Time Series | `sum by(status) (count_over_time({job="apache", log_type="access"} \| pattern '<ip> - <_> [<_>] "<method> <path> <_>" <status> <bytes>' [$__interval]))` Color: 2xx=green, 3xx=blue, 4xx=yellow, 5xx=red |
| 16 | Status Code Distribution | Pie Chart | Same pattern query with `[$__range]` |
| 17 | Top 10 Paths | Bar Gauge | `topk(10, sum by(path) (count_over_time({job="apache", log_type="access"} \| pattern '...' [$__range])))` |
| 18 | Top Error Paths | Table | Pattern filter `\| status >= 400`, grouped by path + status. Columns: Path, Status, Count |
| 19 | Apache Error Log | Logs | `{job="apache", log_type="error"} \|~ "$search"` Color-coded by level |
| 20 | Apache Access Log | Logs | `{job="apache", log_type="access"} \|~ "$search" \| pattern '...' \| status =~ "$status_code"` |

### Row 4: PHP / Laravel Logs (Collapsed)

5 panels from Docker container logs.

| # | Panel | Type | Query |
|---|-------|------|-------|
| 21 | Error Rate by Level | Time Series (stacked) | `sum by(level) (count_over_time({container_name="parthenon-php"} \| regexp '\\[\\d{4}-\\d{2}-\\d{2}[^\\]]+\\] \\w+\\.(?P<level>\\w+):' \| level=~"ERROR\|CRITICAL\|ALERT\|EMERGENCY" [$__interval]))` |
| 22 | Top 10 Exceptions | Bar Gauge | `topk(10, sum by(exception_class) (count_over_time({container_name="parthenon-php"} \|~ "Exception" \| regexp '(?P<exception_class>[A-Z]\\w+Exception)' [$__range])))` |
| 23 | Log Volume by Level | Time Series | `sum by(level) (count_over_time({container_name="parthenon-php"} \| regexp '...(?P<level>\\w+):' [$__interval]))` |
| 24 | Recent Errors | Table | Instant query: `{container_name="parthenon-php"} \| regexp '...' \| level=~"ERROR\|CRITICAL"` Columns: Timestamp, Level, Message |
| 25 | Live Log Stream | Logs | `{container_name="parthenon-php"} \|~ "$search" \| regexp '\\w+\\.(?P<level>\\w+):' \| level=~"$log_level"` |

### Row 5: AI Service / FastAPI Logs (Collapsed)

5 panels from Docker container logs.

| # | Panel | Type | Query |
|---|-------|------|-------|
| 26 | Request Rate by Status | Time Series | `sum by(status) (count_over_time({container_name="parthenon-ai"} \| pattern '<_> - "<method> <path> <_>" <status> <_>' [$__interval]))` |
| 27 | Error Rate | Time Series | `sum(count_over_time({container_name="parthenon-ai"} \|~ "(?i)error\|exception\|traceback\|fatal" [$__interval]))` |
| 28 | Top Error Patterns | Table | `topk(10, sum by(message) (count_over_time({container_name="parthenon-ai"} \|~ "(?i)error\|exception" \| regexp '(?P<message>(?:Error\|Exception\|Traceback)[^\n]{0,120})' [$__range])))` |
| 29 | Ollama & RAG Activity | Time Series | `sum by(type) (count_over_time({container_name="parthenon-ai"} \|~ "ollama\|chroma\|embeddi\|retriev" \| regexp '(?P<type>ollama\|chroma\|embed\|retriev)' [$__interval]))` |
| 30 | Live Log Stream | Logs | `{container_name="parthenon-ai"} \|~ "$search" \| regexp '(?P<level>INFO\|WARNING\|ERROR\|CRITICAL\|DEBUG)' \| level=~"$log_level"` |

### Row 6: PostgreSQL Logs (Collapsed)

5 panels — host PG17 (Alloy file scrape) + Docker Postgres (container logs).

| # | Panel | Type | Query |
|---|-------|------|-------|
| 31 | Slow Queries (>100ms) | Time Series | `count_over_time({job="postgresql"} \|= "duration:" \| regexp 'duration: (?P<duration>\\d+\\.\\d+) ms' \| duration > 100 [$__interval])` |
| 32 | Top Slow Queries | Table | `topk(10, avg_over_time({job="postgresql"} \|= "duration:" \| regexp 'duration: (?P<duration>\\d+\\.\\d+) ms\\s+statement: (?P<query>.+)' \| unwrap duration [$__range]) by (query))` Columns: Query, Avg Duration (ms) |
| 33 | Database Errors | Time Series | `sum by(level) (count_over_time({job="postgresql"} \| regexp '(?P<level>ERROR\|FATAL\|PANIC\|WARNING):' [$__interval]))` |
| 34 | Docker Postgres Log | Logs | `{container_name="parthenon-postgres"} \|~ "$search"` |
| 35 | Host PG17 Log | Logs | `{job="postgresql"} \|~ "$search"` |

**Prerequisite:** `log_min_duration_statement = 100` in `/etc/postgresql/17/main/postgresql.conf`.

### Row 7: Tier 2 Services (Collapsed)

3 panels — shared filterable view.

| # | Panel | Type | Query |
|---|-------|------|-------|
| 36 | Error Count by Service | Bar Gauge | `sum by(container_name) (count_over_time({container_name=~"parthenon-(horizon\|redis\|solr\|r\|chromadb\|study-agent\|reverb\|node\|orthanc\|finngen-runner\|qdrant)"} \|~ "(?i)error\|exception\|fatal" [$__range]))` |
| 37 | Log Volume by Service | Time Series (stacked) | `sum by(container_name) (count_over_time({container_name=~"parthenon-(horizon\|redis\|solr\|r\|chromadb\|study-agent\|reverb\|node\|orthanc\|finngen-runner\|qdrant)"} [$__interval]))` |
| 38 | Live Log Stream | Logs | `{container_name=~"$service"} \|~ "$search" \|~ "(?i)$log_level"` (uses line filter for level since Tier 2 logs have varied formats) |

## Color Scheme

Consistent across all panels:

| Log Level / Status | Color |
|--------------------|-------|
| DEBUG | Blue (#6E9FFF) |
| INFO | Green (#2DD4BF) — matches Parthenon teal |
| WARN / WARNING | Yellow (#C9A227) — matches Parthenon gold |
| ERROR | Red (#9B1B30) — matches Parthenon crimson |
| CRITICAL / FATAL / PANIC | Dark Red (#6B0F1A) |
| HTTP 2xx | Green |
| HTTP 3xx | Blue |
| HTTP 4xx | Yellow |
| HTTP 5xx | Red |

## Implementation Sequence

1. Configure PostgreSQL 17 slow query logging (`log_min_duration_statement`, `log_line_prefix`)
2. Create Alloy configuration (`monitoring/alloy/config.alloy`)
3. Update docker-compose.yml (replace Promtail with Alloy, add volume mounts)
4. Verify Alloy is collecting Docker + Apache + PostgreSQL logs in Loki
5. Rewrite dashboard generation script (`scripts/generate-grafana-dashboards.py`) — this file exists but must be completely rewritten for the new panel layout
6. Generate new `parthenon.json` dashboard
7. Restart Grafana, verify all panels show data
8. Remove old Promtail config files

## Rollback Plan

If the migration fails:
1. **Alloy → Promtail:** Revert docker-compose.yml to restore the `parthenon-promtail` service. Old config remains in `monitoring/promtail/` until step 8 succeeds.
2. **Dashboard:** The previous `parthenon.json` is in git history. `git checkout HEAD~1 -- monitoring/grafana/provisioning/dashboards/parthenon.json` restores it.
3. **PostgreSQL config:** `log_min_duration_statement` and `log_line_prefix` changes are safe and additive — no rollback needed.
4. **Loki data:** Preserved regardless of collector changes. Switching between Promtail and Alloy does not affect stored logs.

## Files Created

- `monitoring/alloy/config.alloy` — Alloy configuration (replaces Promtail config)

## Files Modified

- `docker-compose.yml` — replace Promtail service with Alloy
- `monitoring/grafana/provisioning/dashboards/parthenon.json` — regenerated dashboard
- `scripts/generate-grafana-dashboards.py` — rewritten for new panel layout
- `/etc/postgresql/17/main/postgresql.conf` — add `log_min_duration_statement` and `log_line_prefix`

## Files Removed

- `monitoring/promtail/promtail-config.yml` (only after Alloy is verified working)
