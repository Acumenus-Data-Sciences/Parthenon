# Grafana Observability Overhaul — Exporters, Dashboard, and Monitoring Fix

**Date:** 2026-04-03
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Impact:** Full-stack observability with 4 healthy Prometheus targets, 33-panel clinical-themed dashboard, PostgreSQL and Redis metrics

---

## Summary

Replaced the log-centric Grafana dashboard with a structured operational observability dashboard. Added postgres_exporter and redis_exporter to the monitoring stack, fixed a long-standing node-exporter connectivity issue, and built a 33-panel dashboard using the Parthenon clinical dark theme (teal/gold/crimson color system).

## Starting Point

The existing Grafana dashboard was essentially a log viewer with a few stat panels:
- Only 2 working Prometheus targets (cAdvisor, node-exporter — node-exporter was actually down)
- No PostgreSQL metrics (flying blind on connections, transactions, cache hit ratios)
- No Redis metrics (no visibility into queue depth, memory pressure, or evictions)
- No structured layout — logs dominated the dashboard with no resource utilization charts
- Default Grafana colors with no visual consistency

## Changes

### New Exporters

| Service | Image | Metrics |
|---------|-------|---------|
| `postgres-exporter` | `prometheuscommunity/postgres-exporter:v0.16.0` | `pg_stat_activity`, `pg_stat_user_tables`, transactions, cache hit ratios |
| `redis-exporter` | `oliver006/redis_exporter:v1.66.0-alpine` | Memory, ops/sec, connected clients, evictions, keyspace stats |

Both added to `docker-compose.yml` with health checks, memory limits, and proper dependency ordering.

### Node-Exporter Fix

The `node-exporter` had been unreachable from Prometheus since deployment. Root cause: `network_mode: host` placed it on the host network stack, but Prometheus on the `parthenon` bridge network couldn't reach `host.docker.internal:9100` due to iptables rules blocking container-to-host traffic.

Fix: Removed `network_mode: host` and added node-exporter to the `parthenon` network. Host metrics (CPU, memory, disk) still work correctly via volume mounts (`/host/proc`, `/host/sys`, `/rootfs`). Changed Prometheus scrape target from `host.docker.internal:9100` to `node-exporter:9100`.

### Dashboard Redesign

Replaced the 3,749-line log-heavy dashboard with a structured 6-section layout:

| Section | Panels | Key Metrics |
|---------|--------|-------------|
| Service Health | 5 stat/gauge panels | Platform status, HTTP 5xx rate, PG connections, Redis memory %, queue depth |
| Container Resources | 3 timeseries | CPU by container, memory by container, network I/O (rx/tx) |
| Host Resources | 2 gauges + 1 timeseries | Host CPU %, host memory %, disk I/O (NVMe/md0 aware) |
| PostgreSQL | 3 timeseries + 1 table | Connections by state, transactions/sec, cache hit ratio, top 20 tables by size |
| Redis & Queues | 2 stats + 2 timeseries + 2 stats | Uptime, clients, ops/sec, memory (used vs max), evictions, hit rate |
| Application Logs | 1 bar chart + 1 timeseries + 4 logs | Error volume by service, log volume by level, PHP/PG/Apache/AI logs |

### Clinical Dark Theme

All panels use the Parthenon color system:
- `#0E0E11` — base background
- `#2DD4BF` — teal (healthy/good)
- `#C9A227` — gold (warning)
- `#9B1B30` — crimson (critical/error)

Thresholds on every metric panel ensure at-a-glance status: green means healthy, gold means investigate, crimson means act now.

## Gotcha: Scratch Images and Health Checks

The default `redis_exporter:v1.66.0` image is a scratch/distroless build with no shell. Health checks using `CMD-SHELL` fail because there's no `sh` binary. Switched to `v1.66.0-alpine` which includes `wget` for health check pings.

## Prometheus Targets (Final State)

| Target | Endpoint | Status |
|--------|----------|--------|
| cAdvisor | `cadvisor:8080` | up |
| node-exporter | `node-exporter:9100` | up |
| postgres-exporter | `postgres-exporter:9187` | up |
| redis-exporter | `redis-exporter:9121` | up |

## Files Modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added postgres-exporter, redis-exporter; fixed node-exporter networking |
| `monitoring/prometheus/prometheus.yml` | Added postgres-exporter and redis-exporter scrape jobs; fixed node-exporter target |
| `monitoring/grafana/provisioning/dashboards/parthenon.json` | Complete dashboard rebuild (33 panels, 6 sections) |

## Verification

All 4 Prometheus targets confirmed up and scraping. Sample metrics verified:
- PG connections: 24 state groups across 4 databases, 1 active
- Redis: 4.0 MB used, 52 connected clients
- Host CPU: 90.9%, Host Memory: 53.2%
- Grafana loaded dashboard v6 with 33 panels (7 stat, 4 gauge, 10 timeseries, 1 bar chart, 1 table, 4 logs, 6 rows)
